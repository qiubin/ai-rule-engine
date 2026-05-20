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
 * Dify Workflow 任务执行器
 * 调用 Dify API 执行工作流
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DifyStepExecutor implements StepExecutor {

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate = new RestTemplate();

    @Override
    public String getNodeType() {
        return "DIFY_TASK";
    }

    @Override
    public Object execute(String nodeId, JsonNode nodeData, JsonNode config, ExecutionContext context) {
        String workflowId = config.has("workflowId") ? config.get("workflowId").asText() : "";
        String apiKey = config.has("apiKey") ? config.get("apiKey").asText() : "";
        String baseUrl = config.has("baseUrl") ? config.get("baseUrl").asText() : "https://api.dify.ai/v1";

        if (workflowId.isEmpty()) {
            throw new RuntimeException("DIFY_TASK 节点缺少 workflowId 配置");
        }

        // 构建 inputs，支持 ${variable} 占位符替换
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

        // 构建请求体
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
            errorResult.put("workflowId", workflowId);
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
