package com.ruleengine.process.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ruleengine.domain.ProcessDefinition;
import com.ruleengine.domain.ProcessInstance;
import com.ruleengine.domain.enums.ProcessInstanceStatus;
import com.ruleengine.repository.ProcessDefinitionRepository;
import com.ruleengine.repository.ProcessInstanceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.util.*;
import java.util.concurrent.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class ProcessExecutionEngine {

    private final ProcessDefinitionRepository processDefinitionRepository;
    private final ProcessInstanceRepository processInstanceRepository;
    private final ObjectMapper objectMapper;

    private final List<StepExecutor> stepExecutors;
    private final Map<String, StepExecutor> executorMap = new ConcurrentHashMap<>();

    private final ExecutorService asyncExecutor = Executors.newCachedThreadPool();

    @PostConstruct
    public void init() {
        if (stepExecutors != null) {
            for (StepExecutor executor : stepExecutors) {
                executorMap.put(executor.getNodeType(), executor);
                log.info("注册步骤执行器: {}", executor.getNodeType());
            }
        }
    }

    /**
     * 启动流程实例
     */
    public ProcessInstance startProcess(String processCode, String businessKey,
                                         Map<String, Object> variables) {
        ProcessDefinition definition = processDefinitionRepository.findByCode(processCode)
                .orElseThrow(() -> new RuntimeException("流程定义不存在: " + processCode));

        if (definition.getCanvasData() == null || definition.getCanvasData().isEmpty()) {
            throw new RuntimeException("流程画布未配置: " + processCode);
        }

        ProcessInstance instance = new ProcessInstance();
        instance.setProcessDefId(definition.getId());
        instance.setProcessCode(processCode);
        instance.setBusinessKey(businessKey);
        instance.setStatus(ProcessInstanceStatus.RUNNING);
        instance.setVariables(toJson(variables));
        instance = processInstanceRepository.save(instance);

        // 异步执行
        final Long instanceId = instance.getId();
        asyncExecutor.submit(() -> executeInstance(instanceId));

        return instance;
    }

    /**
     * 同步执行流程实例（用于测试），返回含节点级别结果的详情
     */
    public Map<String, Object> executeSync(String processCode,
                                            Map<String, Object> variables) {
        ProcessDefinition definition = processDefinitionRepository.findByCode(processCode)
                .orElseThrow(() -> new RuntimeException("流程定义不存在: " + processCode));

        // 创建实例
        ProcessInstance instance = new ProcessInstance();
        instance.setProcessDefId(definition.getId());
        instance.setProcessCode(processCode);
        instance.setStatus(ProcessInstanceStatus.RUNNING);
        instance.setVariables(toJson(variables));
        instance = processInstanceRepository.save(instance);

        try {
            // 同步执行 DAG
            ExecutionContext context = executeDagSync(definition, instance, variables);

            // 检查执行是否被标记为失败（executeDAG 内通过 failInstance 设置）
            ProcessInstance finalState = processInstanceRepository.findById(instance.getId()).orElse(instance);
            boolean alreadyFailed = finalState.getStatus() == ProcessInstanceStatus.FAILED;

            if (!alreadyFailed) {
                instance.setStatus(ProcessInstanceStatus.COMPLETED);
            }
            instance.setVariables(toJson(context.getVariables()));
            instance.setExecutionLog(toJson(context.getExecutionLog()));
            instance.setCurrentNodeIds(String.join(",", context.getActiveNodeIds()));
            instance.setEndTime(java.time.LocalDateTime.now());
            processInstanceRepository.save(instance);

            // 构建返回结果（含节点结果）
            Map<String, Object> result = buildResult(instance);
            result.put("node_results", context.getNodeResults());
            return result;
        } catch (Exception e) {
            log.error("流程 [{}] 同步执行异常", processCode, e);
            instance.setStatus(ProcessInstanceStatus.FAILED);
            instance.setErrorMessage(e.getMessage());
            instance.setEndTime(java.time.LocalDateTime.now());
            processInstanceRepository.save(instance);

            Map<String, Object> result = buildResult(instance);
            result.put("node_results", new java.util.HashMap<>());
            return result;
        }
    }

    /** 同步执行 DAG，返回 ExecutionContext */
    private ExecutionContext executeDagSync(ProcessDefinition definition,
                                            ProcessInstance instance,
                                            Map<String, Object> variables) throws Exception {
        JsonNode canvas = objectMapper.readTree(definition.getCanvasData());
        ExecutionContext context = new ExecutionContext(
                instance.getId(), definition.getId(), instance.getBusinessKey(),
                variables != null ? new HashMap<>(variables) : new HashMap<>());
        context.setCanvasData(canvas);

        // 解析节点配置
        if (definition.getNodeConfigs() != null && !definition.getNodeConfigs().isEmpty()) {
            JsonNode configs = objectMapper.readTree(definition.getNodeConfigs());
            if (configs.isObject()) {
                configs.fields().forEachRemaining(entry ->
                        context.getNodeConfigs().put(entry.getKey(), entry.getValue()));
            }
        }

        JsonNode nodes = canvas.get("nodes");
        JsonNode edges = canvas.get("edges");
        if (nodes == null || !nodes.isArray()) {
            throw new RuntimeException("画布缺少 nodes");
        }

        String startNodeId = findStartNode(nodes);
        if (startNodeId == null) {
            throw new RuntimeException("画布缺少 start 节点");
        }

        executeDAG(startNodeId, nodes, edges, context, instance);
        return context;
    }

    /**
     * 恢复挂起的流程实例（用于 HumanTask / DelayTask 唤醒）
     */
    public void resumeInstance(Long instanceId, Map<String, Object> resumeVariables) {
        ProcessInstance instance = processInstanceRepository.findById(instanceId)
                .orElseThrow(() -> new RuntimeException("流程实例不存在: " + instanceId));

        if (instance.getStatus() != ProcessInstanceStatus.SUSPENDED) {
            throw new RuntimeException("流程实例未挂起，无法恢复: " + instanceId);
        }

        // 合并恢复变量
        try {
            Map<String, Object> vars = parseJson(instance.getVariables());
            if (resumeVariables != null) {
                vars.putAll(resumeVariables);
            }
            instance.setVariables(toJson(vars));
            instance.setStatus(ProcessInstanceStatus.RUNNING);
            processInstanceRepository.save(instance);
        } catch (Exception e) {
            throw new RuntimeException("恢复变量解析失败: " + e.getMessage(), e);
        }

        // 异步继续执行
        asyncExecutor.submit(() -> executeInstance(instanceId));
    }

    /**
     * 终止流程实例
     */
    public void terminateInstance(Long instanceId) {
        ProcessInstance instance = processInstanceRepository.findById(instanceId)
                .orElseThrow(() -> new RuntimeException("流程实例不存在: " + instanceId));
        instance.setStatus(ProcessInstanceStatus.TERMINATED);
        instance.setEndTime(java.time.LocalDateTime.now());
        processInstanceRepository.save(instance);
        log.info("流程实例 [{}] 已终止", instanceId);
    }

    /**
     * 核心执行逻辑
     */
    void executeInstance(Long instanceId) {
        ProcessInstance instance = processInstanceRepository.findById(instanceId).orElse(null);
        if (instance == null) {
            log.error("流程实例不存在: {}", instanceId);
            return;
        }

        ProcessDefinition definition = processDefinitionRepository.findById(instance.getProcessDefId())
                .orElse(null);
        if (definition == null) {
            failInstance(instance, "流程定义不存在");
            return;
        }

        try {
            JsonNode canvas = objectMapper.readTree(definition.getCanvasData());
            Map<String, Object> vars = parseJson(instance.getVariables());
            ExecutionContext context = new ExecutionContext(
                    instanceId, definition.getId(), instance.getBusinessKey(), vars);
            context.setCanvasData(canvas);

            // 解析节点配置
            if (definition.getNodeConfigs() != null && !definition.getNodeConfigs().isEmpty()) {
                JsonNode configs = objectMapper.readTree(definition.getNodeConfigs());
                if (configs.isObject()) {
                    configs.fields().forEachRemaining(entry ->
                            context.getNodeConfigs().put(entry.getKey(), entry.getValue()));
                }
            }

            // 查找 start 节点
            JsonNode nodes = canvas.get("nodes");
            JsonNode edges = canvas.get("edges");
            if (nodes == null || !nodes.isArray()) {
                failInstance(instance, "画布缺少 nodes");
                return;
            }

            String startNodeId = findStartNode(nodes);
            if (startNodeId == null) {
                failInstance(instance, "画布缺少 start 节点");
                return;
            }

            // 执行 DAG
            executeDAG(startNodeId, nodes, edges, context, instance);

        } catch (Exception e) {
            log.error("流程实例 [{}] 执行异常", instanceId, e);
            failInstance(instance, e.getMessage());
        }
    }

    private void executeDAG(String startNodeId, JsonNode nodes, JsonNode edges,
                            ExecutionContext context, ProcessInstance instance) {
        Map<String, JsonNode> nodeMap = buildNodeMap(nodes);
        Map<String, List<JsonNode>> outgoingEdges = buildOutgoingEdges(edges);
        Map<String, List<JsonNode>> incomingEdges = buildIncomingEdges(edges);

        Queue<String> queue = new LinkedList<>();
        queue.add(startNodeId);
        context.setActiveNodeIds(new ArrayList<>(queue));

        int maxSteps = 500;
        int stepCount = 0;

        while (!queue.isEmpty() && stepCount < maxSteps) {
            stepCount++;
            String nodeId = queue.poll();
            JsonNode node = nodeMap.get(nodeId);
            if (node == null) continue;

            String nodeType = node.has("type") ? node.get("type").asText() : "";
            JsonNode nodeData = node.has("data") ? node.get("data") : objectMapper.createObjectNode();
            JsonNode config = context.getNodeConfigs().getOrDefault(nodeId, objectMapper.createObjectNode());

            // 执行节点
            StepResult result = executeNode(nodeId, nodeType, nodeData, config, context);

            if (result.status == StepStatus.SUSPENDED) {
                // 挂起流程
                instance.setStatus(ProcessInstanceStatus.SUSPENDED);
                instance.setCurrentNodeIds(nodeId);
                instance.setVariables(toJson(context.getVariables()));
                instance.setExecutionLog(toJson(context.getExecutionLog()));
                processInstanceRepository.save(instance);
                log.info("流程实例 [{}] 在节点 [{}] 挂起", instance.getId(), nodeId);
                return;
            }

            context.markExecuted(nodeId);

            if (result.status == StepStatus.FAILED) {
                failInstance(instance, "节点 [" + nodeId + "] 执行失败: " + result.message);
                return;
            }

            // 确定下一个节点
            List<String> nextNodeIds = determineNextNodes(nodeId, nodeType, nodeData,
                    result, outgoingEdges, nodeMap, context);

            // 检查汇聚条件（AND/OR）
            for (String nextId : nextNodeIds) {
                JsonNode nextNode = nodeMap.get(nextId);
                if (nextNode == null) continue;
                String nextType = nextNode.has("type") ? nextNode.get("type").asText() : "";

                if ("and".equalsIgnoreCase(nextType)) {
                    // 检查所有前置边是否都已到达
                    List<JsonNode> inEdges = incomingEdges.getOrDefault(nextId, Collections.emptyList());
                    boolean allReached = true;
                    for (JsonNode e : inEdges) {
                        String src = e.get("source").asText();
                        if (!context.isExecuted(src)) {
                            allReached = false;
                            break;
                        }
                    }
                    if (!allReached) {
                        continue; // 等待其他分支
                    }
                }

                if (!context.isExecuted(nextId) && !queue.contains(nextId)) {
                    queue.add(nextId);
                }
            }

            context.setActiveNodeIds(new ArrayList<>(queue));

            // 持久化中间状态
            if (stepCount % 10 == 0) {
                instance.setVariables(toJson(context.getVariables()));
                instance.setCurrentNodeIds(String.join(",", queue));
                instance.setExecutionLog(toJson(context.getExecutionLog()));
                processInstanceRepository.save(instance);
            }
        }

        if (stepCount >= maxSteps) {
            failInstance(instance, "执行步数超过上限 (" + maxSteps + ")，可能存在循环");
            return;
        }

        // 执行完成
        instance.setStatus(ProcessInstanceStatus.COMPLETED);
        instance.setEndTime(java.time.LocalDateTime.now());
        instance.setVariables(toJson(context.getVariables()));
        instance.setCurrentNodeIds(null);
        instance.setExecutionLog(toJson(context.getExecutionLog()));
        processInstanceRepository.save(instance);
        log.info("流程实例 [{}] 执行完成", instance.getId());
    }

    private StepResult executeNode(String nodeId, String nodeType, JsonNode nodeData,
                                    JsonNode config, ExecutionContext context) {
        try {
            // 标准化节点类型
            String normalizedType = normalizeNodeType(nodeType);
            StepExecutor executor = executorMap.get(normalizedType);

            if (executor == null) {
                // 对于 start/end 节点，直接通过
                if ("START".equals(normalizedType) || "END".equals(normalizedType)) {
                    context.addLog(nodeId, normalizedType, "SUCCESS", null, "节点直接通过");
                    return StepResult.success(null);
                }
                log.warn("节点 [{}] 类型 [{}] 无对应执行器，跳过", nodeId, normalizedType);
                context.addLog(nodeId, normalizedType, "SKIPPED", null, "无执行器");
                return StepResult.success(null);
            }

            Object result = executor.execute(nodeId, nodeData, config, context);
            context.setNodeResult(nodeId, result);

            // 检测人工任务挂起标记
            if (result instanceof Map && Boolean.TRUE.equals(((Map<?, ?>) result).get("suspended"))) {
                context.addLog(nodeId, normalizedType, "SUSPENDED", result, "等待人工确认");
                return StepResult.suspended();
            }

            context.addLog(nodeId, normalizedType, "SUCCESS", result, null);
            return StepResult.success(result);

        } catch (Exception e) {
            log.error("节点 [{}] 执行异常", nodeId, e);
            context.addLog(nodeId, nodeType, "FAILED", null, e.getMessage());
            return StepResult.fail(e.getMessage());
        }
    }

    private String normalizeNodeType(String type) {
        if (type == null) return "";
        String upper = type.toUpperCase();
        // 兼容旧类型
        switch (upper) {
            case "START": return "START";
            case "END": return "END";
            case "RULE": return "RULE_TASK";
            case "CONDITION": return "CONDITION";
            case "AND": return "AND";
            case "OR": return "OR";
            default: return upper;
        }
    }

    private List<String> determineNextNodes(String nodeId, String nodeType, JsonNode nodeData,
                                             StepResult result,
                                             Map<String, List<JsonNode>> outgoingEdges,
                                             Map<String, JsonNode> nodeMap,
                                             ExecutionContext context) {
        List<JsonNode> edges = outgoingEdges.getOrDefault(nodeId, Collections.emptyList());
        List<String> nextIds = new ArrayList<>();

        String normalizedType = normalizeNodeType(nodeType);

        if ("CONDITION".equals(normalizedType)) {
            // 条件分支：根据上一步结果选择 true/false
            // 这里使用 context 中前一个 RULE 节点的执行结果
            // 简化：CONDITION 节点的 config 中指定 refNodeId 和 expected
            JsonNode config = nodeData.has("conditionConfig") ? nodeData.get("conditionConfig") : nodeData;
            String refNodeId = config.has("refNodeId") ? config.get("refNodeId").asText() : null;
            String expected = config.has("expected") ? config.get("expected").asText() : "matched";

            boolean isMatched = false;
            if (refNodeId != null) {
                Object refResult = context.getNodeResult(refNodeId);
                if (refResult instanceof Map) {
                    Boolean matched = (Boolean) ((Map<?, ?>) refResult).get("matched");
                    isMatched = Boolean.TRUE.equals(matched);
                }
            }

            boolean shouldTakeTrue = ("matched".equals(expected) && isMatched)
                    || ("not_matched".equals(expected) && !isMatched);

            for (JsonNode edge : edges) {
                String handle = edge.has("sourceHandle") ? edge.get("sourceHandle").asText() : "";
                if (shouldTakeTrue && "true".equals(handle)) {
                    nextIds.add(edge.get("target").asText());
                } else if (!shouldTakeTrue && "false".equals(handle)) {
                    nextIds.add(edge.get("target").asText());
                }
            }
        } else {
            // 其他节点：走所有出边
            for (JsonNode edge : edges) {
                nextIds.add(edge.get("target").asText());
            }
        }

        return nextIds;
    }

    private String findStartNode(JsonNode nodes) {
        for (JsonNode node : nodes) {
            String type = node.has("type") ? node.get("type").asText() : "";
            if ("start".equalsIgnoreCase(type)) {
                return node.get("id").asText();
            }
        }
        return null;
    }

    private Map<String, JsonNode> buildNodeMap(JsonNode nodes) {
        Map<String, JsonNode> map = new HashMap<>();
        for (JsonNode node : nodes) {
            String id = node.get("id").asText();
            map.put(id, node);
        }
        return map;
    }

    private Map<String, List<JsonNode>> buildOutgoingEdges(JsonNode edges) {
        Map<String, List<JsonNode>> map = new HashMap<>();
        if (edges == null || !edges.isArray()) return map;
        for (JsonNode edge : edges) {
            String source = edge.get("source").asText();
            map.computeIfAbsent(source, k -> new ArrayList<>()).add(edge);
        }
        return map;
    }

    private Map<String, List<JsonNode>> buildIncomingEdges(JsonNode edges) {
        Map<String, List<JsonNode>> map = new HashMap<>();
        if (edges == null || !edges.isArray()) return map;
        for (JsonNode edge : edges) {
            String target = edge.get("target").asText();
            map.computeIfAbsent(target, k -> new ArrayList<>()).add(edge);
        }
        return map;
    }

    private void failInstance(ProcessInstance instance, String errorMessage) {
        instance.setStatus(ProcessInstanceStatus.FAILED);
        instance.setErrorMessage(errorMessage);
        instance.setEndTime(java.time.LocalDateTime.now());
        processInstanceRepository.save(instance);
        log.error("流程实例 [{}] 失败: {}", instance.getId(), errorMessage);
    }

    private Map<String, Object> buildResult(ProcessInstance instance) {
        Map<String, Object> result = new HashMap<>();
        result.put("instanceId", instance.getId());
        result.put("processDefId", instance.getProcessDefId());
        result.put("processCode", instance.getProcessCode());
        result.put("status", instance.getStatus());
        result.put("businessKey", instance.getBusinessKey());
        result.put("variables", parseJson(instance.getVariables()));
        result.put("currentNodeIds", instance.getCurrentNodeIds());
        result.put("executionLog", parseJson(instance.getExecutionLog()));
        result.put("errorMessage", instance.getErrorMessage());
        result.put("createdAt", instance.getCreatedAt());
        result.put("endTime", instance.getEndTime());
        return result;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJson(String json) {
        if (json == null || json.isEmpty()) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            return new HashMap<>();
        }
    }

    private String toJson(Object obj) {
        if (obj == null) return null;
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return "{}";
        }
    }

    // --- 内部类 ---

    enum StepStatus {
        SUCCESS, FAILED, SUSPENDED
    }

    static class StepResult {
        StepStatus status;
        Object data;
        String message;

        static StepResult success(Object data) {
            StepResult r = new StepResult();
            r.status = StepStatus.SUCCESS;
            r.data = data;
            return r;
        }

        static StepResult fail(String message) {
            StepResult r = new StepResult();
            r.status = StepStatus.FAILED;
            r.message = message;
            return r;
        }

        static StepResult suspended() {
            StepResult r = new StepResult();
            r.status = StepStatus.SUSPENDED;
            return r;
        }
    }
}
