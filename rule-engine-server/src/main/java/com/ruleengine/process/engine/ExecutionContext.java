package com.ruleengine.process.engine;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 流程执行上下文，承载节点间变量传递和执行状态
 */
@Data
public class ExecutionContext {

    /** 流程实例ID */
    private Long instanceId;

    /** 流程定义ID */
    private Long processDefId;

    /** 业务标识 */
    private String businessKey;

    /** 流程变量（节点间共享） */
    private Map<String, Object> variables = new ConcurrentHashMap<>();

    /** 节点执行结果缓存：nodeId -> result */
    private Map<String, Object> nodeResults = new ConcurrentHashMap<>();

    /** 已执行的节点ID集合（防循环） */
    private Set<String> executedNodes = ConcurrentHashMap.newKeySet();

    /** 当前激活的节点ID列表 */
    private List<String> activeNodeIds = new ArrayList<>();

    /** 执行日志 */
    private List<Map<String, Object>> executionLog = new ArrayList<>();

    /** 流程画布：nodes + edges */
    private JsonNode canvasData;

    /** 节点额外配置：nodeId -> config */
    private Map<String, JsonNode> nodeConfigs = new HashMap<>();

    public ExecutionContext() {}

    public ExecutionContext(Long instanceId, Long processDefId, String businessKey,
                            Map<String, Object> initialVariables) {
        this.instanceId = instanceId;
        this.processDefId = processDefId;
        this.businessKey = businessKey;
        if (initialVariables != null) {
            this.variables.putAll(initialVariables);
        }
    }

    public void setVariable(String key, Object value) {
        this.variables.put(key, value);
    }

    public Object getVariable(String key) {
        return this.variables.get(key);
    }

    @SuppressWarnings("unchecked")
    public <T> T getVariable(String key, Class<T> type) {
        Object value = this.variables.get(key);
        if (value == null) return null;
        if (type.isInstance(value)) {
            return (T) value;
        }
        return null;
    }

    public void setNodeResult(String nodeId, Object result) {
        this.nodeResults.put(nodeId, result);
    }

    public Object getNodeResult(String nodeId) {
        return this.nodeResults.get(nodeId);
    }

    public void markExecuted(String nodeId) {
        this.executedNodes.add(nodeId);
    }

    public boolean isExecuted(String nodeId) {
        return this.executedNodes.contains(nodeId);
    }

    public void addLog(String nodeId, String nodeType, String status, Object result, String message) {
        Map<String, Object> log = new LinkedHashMap<>();
        log.put("nodeId", nodeId);
        log.put("nodeType", nodeType);
        log.put("status", status);
        log.put("result", result);
        log.put("message", message);
        log.put("timestamp", System.currentTimeMillis());
        this.executionLog.add(log);
    }

    public Map<String, Object> toResultMap() {
        Map<String, Object> result = new HashMap<>();
        result.put("instanceId", instanceId);
        result.put("processDefId", processDefId);
        result.put("businessKey", businessKey);
        result.put("variables", variables);
        result.put("nodeResults", nodeResults);
        result.put("executionLog", executionLog);
        result.put("executedNodes", new ArrayList<>(executedNodes));
        return result;
    }
}
