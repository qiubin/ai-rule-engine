package com.ruleengine.process.engine.step;

import com.fasterxml.jackson.databind.JsonNode;
import com.ruleengine.drools.adapter.EmrDataService;
import com.ruleengine.process.engine.ExecutionContext;
import com.ruleengine.process.engine.StepExecutor;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
public class ServiceStepExecutor implements StepExecutor {

    private final EmrDataService emrDataService;

    private final RestTemplate restTemplate = new RestTemplate();
    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("\\$\\{([^}]+)}");

    @Override
    public String getNodeType() {
        return "SERVICE_TASK";
    }

    @Override
    public Object execute(String nodeId, JsonNode nodeData, JsonNode config, ExecutionContext context) {
        if (config == null) {
            throw new RuntimeException("SERVICE_TASK 节点未配置 config: " + nodeId);
        }

        // 优先走 HTTP 调用配置
        if (config.has("url")) {
            return executeHttpCall(nodeId, config, context);
        }

        // 本地 Bean 调用
        String beanName = config.has("beanName") ? config.get("beanName").asText() : null;
        if (beanName == null || beanName.isEmpty()) {
            throw new RuntimeException("SERVICE_TASK 节点未配置 beanName 或 url: " + nodeId);
        }

        if ("emrDataService".equals(beanName)) {
            String patientId = resolveValue(config, "patientId", context);
            String admissionId = resolveValue(config, "admissionId", context);
            if (patientId == null || patientId.isEmpty()) {
                patientId = (String) context.getVariable("patientId");
            }
            if (admissionId == null || admissionId.isEmpty()) {
                admissionId = (String) context.getVariable("admissionId");
            }
            return emrDataService.fetchPatientData(patientId, admissionId);
        }

        throw new RuntimeException("SERVICE_TASK 不支持的 beanName: " + beanName + ", nodeId=" + nodeId);
    }

    private Object executeHttpCall(String nodeId, JsonNode config, ExecutionContext context) {
        String url = substituteVariables(config.get("url").asText(), context);
        String method = config.has("method") ? config.get("method").asText().toUpperCase() : "GET";

        HttpHeaders headers = new HttpHeaders();
        if (config.has("headers")) {
            JsonNode headersNode = config.get("headers");
            Iterator<Map.Entry<String, JsonNode>> it = headersNode.fields();
            while (it.hasNext()) {
                Map.Entry<String, JsonNode> entry = it.next();
                headers.set(entry.getKey(), substituteVariables(entry.getValue().asText(), context));
            }
        }
        headers.setContentType(MediaType.APPLICATION_JSON);

        String body = null;
        if (config.has("body")) {
            body = substituteVariables(config.get("body").asText(), context);
        }

        HttpEntity<String> entity = body != null ? new HttpEntity<>(body, headers) : new HttpEntity<>(headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.valueOf(method), entity, String.class);
            Map<String, Object> result = new HashMap<>();
            result.put("statusCode", response.getStatusCodeValue());
            result.put("body", response.getBody());
            result.put("headers", response.getHeaders());
            return result;
        } catch (Exception e) {
            throw new RuntimeException("SERVICE_TASK HTTP 调用失败: " + url + ", nodeId=" + nodeId, e);
        }
    }

    private String resolveValue(JsonNode config, String key, ExecutionContext context) {
        if (config.has(key)) {
            String val = config.get(key).asText();
            return substituteVariables(val, context);
        }
        return null;
    }

    private String substituteVariables(String template, ExecutionContext context) {
        if (template == null) {
            return null;
        }
        Matcher matcher = PLACEHOLDER_PATTERN.matcher(template);
        StringBuffer sb = new StringBuffer();
        while (matcher.find()) {
            String varName = matcher.group(1);
            Object value = context.getVariable(varName);
            String replacement = value != null ? value.toString() : "";
            matcher.appendReplacement(sb, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(sb);
        return sb.toString();
    }
}
