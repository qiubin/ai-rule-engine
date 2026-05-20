package com.ruleengine.process.engine.step;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ruleengine.process.engine.ExecutionContext;
import com.ruleengine.process.engine.StepExecutor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * LLM 任务执行器
 * 调用 OpenAI 兼容接口执行大模型推理
 */
@Slf4j
@Component
public class LlmStepExecutor implements StepExecutor {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = new RestTemplate();

    @Override
    public String getNodeType() {
        return "LLM_TASK";
    }

    @Override
    public Object execute(String nodeId, JsonNode nodeData, JsonNode config, ExecutionContext context) {
        String model = config.has("model") ? config.get("model").asText() : "gpt-3.5-turbo";
        String apiKey = config.has("apiKey") ? config.get("apiKey").asText() : "";
        String baseUrl = config.has("baseUrl") ? config.get("baseUrl").asText() : "https://api.openai.com/v1";
        String prompt = config.has("prompt") ? config.get("prompt").asText() : "";
        double temperature = config.has("temperature") ? config.get("temperature").asDouble() : 0.7;
        int maxTokens = config.has("maxTokens") ? config.get("maxTokens").asInt() : 2048;

        if (prompt.isEmpty()) {
            throw new RuntimeException("LLM_TASK 节点缺少 prompt 配置");
        }

        // 替换 ${variable} 占位符
        String resolvedPrompt = resolvePlaceholders(prompt, context);

        // 构建 OpenAI 兼容请求体
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

            if (response.getBody() != null) {
                try {
                    JsonNode responseJson = objectMapper.readTree(response.getBody());

                    // 提取 content
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

                    // 提取 usage
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
