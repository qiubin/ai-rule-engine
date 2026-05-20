package com.ruleengine.process.engine.step;

import com.fasterxml.jackson.databind.JsonNode;
import com.ruleengine.process.engine.ExecutionContext;
import com.ruleengine.process.engine.StepExecutor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * 人工任务执行器
 * 执行到该节点时挂起流程实例，等待人工确认后恢复
 */
@Slf4j
@Component
public class HumanStepExecutor implements StepExecutor {

    @Override
    public String getNodeType() {
        return "HUMAN_TASK";
    }

    @Override
    public Object execute(String nodeId, JsonNode nodeData, JsonNode config, ExecutionContext context) {
        String taskName = config.has("taskName") ? config.get("taskName").asText() : "人工审批";
        String description = config.has("description") ? config.get("description").asText() : "";
        String assignee = config.has("assignee") ? config.get("assignee").asText() : "";

        log.info("节点 [{}] 触发人工任务 [{}]，流程实例挂起", nodeId, taskName);

        Map<String, Object> result = new HashMap<>();
        result.put("suspended", true);
        result.put("taskName", taskName);
        result.put("message", "等待人工确认");

        if (!description.isEmpty()) {
            result.put("description", description);
        }
        if (!assignee.isEmpty()) {
            result.put("assignee", assignee);
        }

        // 将挂起信息写入上下文变量，便于外部查询
        context.setVariable("_humanTask_" + nodeId, result);
        context.setVariable("_currentHumanTask", result);

        return result;
    }
}
