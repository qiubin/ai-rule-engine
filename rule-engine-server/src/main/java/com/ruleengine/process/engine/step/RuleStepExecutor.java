package com.ruleengine.process.engine.step;

import com.fasterxml.jackson.databind.JsonNode;
import com.ruleengine.process.engine.ExecutionContext;
import com.ruleengine.process.engine.StepExecutor;
import com.ruleengine.service.RuleService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class RuleStepExecutor implements StepExecutor {

    private final RuleService ruleService;

    @Override
    public String getNodeType() {
        return "RULE_TASK";
    }

    @Override
    public Object execute(String nodeId, JsonNode nodeData, JsonNode config, ExecutionContext context) {
        String ruleCode = null;
        if (nodeData != null && nodeData.has("data") && nodeData.get("data").has("ruleCode")) {
            ruleCode = nodeData.get("data").get("ruleCode").asText();
        }
        if (ruleCode == null || ruleCode.isEmpty()) {
            throw new RuntimeException("RULE_TASK 节点未配置 ruleCode: " + nodeId);
        }
        Map<String, Object> result = ruleService.execute(ruleCode, context.getVariables());
        return result;
    }
}
