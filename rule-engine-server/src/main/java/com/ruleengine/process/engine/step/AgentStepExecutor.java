package com.ruleengine.process.engine.step;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ruleengine.process.engine.ExecutionContext;
import com.ruleengine.process.engine.StepExecutor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * 智能体任务执行器
 * 统一封装 Dify 工作流与大模型(LLM)两种调用模式，通过 agentType 配置区分
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AgentStepExecutor implements StepExecutor {

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate = new RestTemplate();

    @Override
    public String getNodeType() {
        return "AGENT_TASK";
    }

    @Override
    public Object execute(String nodeId, JsonNode nodeData, JsonNode config, ExecutionContext context) {
        String agentType = config.has("agentType") ? config.get("agentType").asText() : "";

        // 兼容旧流程：未配置 agentType 时，根据其他字段自动推断
        if (agentType.isEmpty()) {
            if (config.has("workflowId") && !config.get("workflowId").asText().isEmpty()) {
                agentType = "dify";
            } else {
                agentType = "llm";
            }
        }

        if ("dify".equalsIgnoreCase(agentType)) {
            return executeDify(nodeId, config, context);
        } else {
            return executeLlm(nodeId, config, context);
        }
    }

    /**
     * 调用 Dify Workflow
     */
    private Object executeDify(String nodeId, JsonNode config, ExecutionContext context) {
        String workflowId = config.has("workflowId") ? config.get("workflowId").asText() : "";
        String apiKey = config.has("apiKey") ? config.get("apiKey").asText() : "";
        String baseUrl = config.has("baseUrl") ? config.get("baseUrl").asText() : "https://api.dify.ai/v1";

        if (workflowId.isEmpty()) {
            throw new RuntimeException("AGENT_TASK (dify) 节点缺少 workflowId 配置");
        }

        Map<String, Object> inputs = new HashMap<>();
        if (config.has("inputs") && config.get("inputs").isObject()) {
            JsonNode inputsNode = config.get("inputs");
            Iterator<Map.Entry<String, JsonNode>> fields = inputsNode.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> entry = fields.next();
                String rawValue = entry.getValue().asText();
                String resolvedValue = resolvePlaceholders(rawValue, context);
                inputs.put(entry.getKey(), resolvedValue);
            }
        }

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("inputs", inputs);
        requestBody.put("response_mode", "blocking");
        requestBody.put("user", "process-engine");

        String url = baseUrl.endsWith("/") ? baseUrl + "workflows/run" : baseUrl + "/workflows/run";

        log.info("节点 [{}] 调用 Dify workflow [{}], url={}", nodeId, workflowId, url);

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
            if (!apiKey.isEmpty()) {
                headers.set("Authorization", "Bearer " + apiKey);
            }

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);

            Map<String, Object> result = new HashMap<>();
            result.put("success", response.getStatusCode().is2xxSuccessful());
            result.put("agentType", "dify");
            result.put("workflowId", workflowId);

            if (response.getBody() != null) {
                try {
                    JsonNode responseJson = objectMapper.readTree(response.getBody());
                    result.put("outputs", objectMapper.convertValue(responseJson, Map.class));
                } catch (Exception e) {
                    result.put("outputs", response.getBody());
                }
            }

            return result;
        } catch (Exception e) {
            log.error("节点 [{}] 调用 Dify 失败: {}", nodeId, e.getMessage());
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("success", false);
            errorResult.put("agentType", "dify");
            errorResult.put("workflowId", workflowId);
            errorResult.put("error", e.getMessage());
            return errorResult;
        }
    }

    /**
     * 调用 LLM OpenAI 兼容接口
     */
    private Object executeLlm(String nodeId, JsonNode config, ExecutionContext context) {
        String model = config.has("model") ? config.get("model").asText() : "gpt-3.5-turbo";
        String apiKey = config.has("apiKey") ? config.get("apiKey").asText() : "";
        String baseUrl = config.has("baseUrl") ? config.get("baseUrl").asText() : "https://api.openai.com/v1";
        String prompt = config.has("prompt") ? config.get("prompt").asText() : "";
        double temperature = config.has("temperature") ? config.get("temperature").asDouble() : 0.7;
        int maxTokens = config.has("maxTokens") ? config.get("maxTokens").asInt() : 2048;

        if (prompt.isEmpty()) {
            throw new RuntimeException("AGENT_TASK (llm) 节点缺少 prompt 配置");
        }

        String resolvedPrompt = resolvePlaceholders(prompt, context);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", model);

        List<Map<String, String>> messages = new ArrayList<>();
        Map<String, String> userMessage = new HashMap<>();
        userMessage.put("role", "user");
        userMessage.put("content", resolvedPrompt);
        messages.add(userMessage);
        requestBody.put("messages", messages);

        requestBody.put("temperature", temperature);
        requestBody.put("max_tokens", maxTokens);

        String url = baseUrl.endsWith("/") ? baseUrl + "chat/completions" : baseUrl + "/chat/completions";

        log.info("节点 [{}] 调用 LLM model=[{}], url={}", nodeId, model, url);

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(new ArrayList<>(Arrays.asList(MediaType.APPLICATION_JSON)));
            if (!apiKey.isEmpty()) {
                headers.set("Authorization", "Bearer " + apiKey);
            }

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);

            Map<String, Object> result = new HashMap<>();
            result.put("success", response.getStatusCode().is2xxSuccessful());
            result.put("agentType", "llm");

            if (response.getBody() != null) {
                try {
                    JsonNode responseJson = objectMapper.readTree(response.getBody());

                    JsonNode choices = responseJson.get("choices");
                    if (choices != null && choices.isArray() && choices.size() > 0) {
                        JsonNode firstChoice = choices.get(0);
                        JsonNode message = firstChoice.get("message");
                        if (message != null && message.has("content")) {
                            result.put("content", message.get("content").asText());
                        } else if (firstChoice.has("text")) {
                            result.put("content", firstChoice.get("text").asText());
                        }
                    }

                    JsonNode usage = responseJson.get("usage");
                    if (usage != null) {
                        Map<String, Object> usageMap = new HashMap<>();
                        if (usage.has("prompt_tokens")) {
                            usageMap.put("promptTokens", usage.get("prompt_tokens").asInt());
                        }
                        if (usage.has("completion_tokens")) {
                            usageMap.put("completionTokens", usage.get("completion_tokens").asInt());
                        }
                        if (usage.has("total_tokens")) {
                            usageMap.put("totalTokens", usage.get("total_tokens").asInt());
                        }
                        result.put("usage", usageMap);
                    }

                    result.put("rawResponse", objectMapper.convertValue(responseJson, Map.class));
                } catch (Exception e) {
                    result.put("content", response.getBody());
                }
            }

            return result;
        } catch (Exception e) {
            log.error("节点 [{}] 调用 LLM 失败: {}", nodeId, e.getMessage());
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("success", false);
            errorResult.put("agentType", "llm");
            errorResult.put("error", e.getMessage());
            return errorResult;
        }
    }

    /**
     * 替换 ${variable} 占位符为上下文变量值
     */
    private String resolvePlaceholders(String text, ExecutionContext context) {
        if (text == null || !text.contains("${")) {
            return text;
        }
        StringBuilder result = new StringBuilder();
        int i = 0;
        while (i < text.length()) {
            int start = text.indexOf("${", i);
            if (start == -1) {
                result.append(text.substring(i));
                break;
            }
            result.append(text, i, start);
            int end = text.indexOf("}", start);
            if (end == -1) {
                result.append(text.substring(start));
                break;
            }
            String varName = text.substring(start + 2, end).trim();
            Object varValue = context.getVariable(varName);
            result.append(varValue != null ? String.valueOf(varValue) : "");
            i = end + 1;
        }
        return result.toString();
    }
}
