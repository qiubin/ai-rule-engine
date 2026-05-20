package com.ruleengine.process.engine.step;

import com.fasterxml.jackson.databind.JsonNode;
import com.ruleengine.process.engine.ExecutionContext;
import com.ruleengine.process.engine.StepExecutor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * 延迟任务执行器
 * 根据配置暂停指定时长后继续执行
 */
@Slf4j
@Component
public class DelayStepExecutor implements StepExecutor {

    @Override
    public String getNodeType() {
        return "DELAY_TASK";
    }

    @Override
    public Object execute(String nodeId, JsonNode nodeData, JsonNode config, ExecutionContext context) {
        long delayMs = 0;

        if (config.has("delayMs")) {
            delayMs = config.get("delayMs").asLong();
        } else if (config.has("delaySeconds")) {
            delayMs = config.get("delaySeconds").asLong() * 1000;
        }

        if (delayMs <= 0) {
            delayMs = 1000;
            log.warn("节点 [{}] 延迟时间未配置或无效，使用默认值 1000ms", nodeId);
        }

        log.info("节点 [{}] 开始延迟 {} ms", nodeId, delayMs);

        try {
            Thread.sleep(delayMs);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("节点 [{}] 延迟被中断", nodeId);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("delayed", true);
        result.put("delayMs", delayMs);
        return result;
    }
}
