package com.ruleengine.process.engine;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * 步骤执行器 SPI，每种节点类型对应一个实现
 */
public interface StepExecutor {

    /**
     * 返回支持的节点类型名称（如 "RULE_TASK", "SERVICE_TASK"）
     */
    String getNodeType();

    /**
     * 执行节点逻辑
     *
     * @param nodeId   节点ID
     * @param nodeData 节点数据（包含 label, config 等）
     * @param config   节点额外配置
     * @param context  执行上下文
     * @return 执行结果，会存入 context.nodeResults
     */
    Object execute(String nodeId, JsonNode nodeData, JsonNode config, ExecutionContext context);
}
