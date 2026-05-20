package com.ruleengine.domain.enums;

public enum ProcessNodeType {
    START,        // 开始节点
    END,          // 结束节点
    RULE_TASK,    // 规则任务（调用现有规则引擎）
    SERVICE_TASK, // 服务任务（调用Spring Bean / HTTP）
    SCRIPT_TASK,  // 脚本任务（Groovy/SpEL）
    DELAY_TASK,   // 延时任务
    DIFY_TASK,    // DIFY任务
    LLM_TASK,     // 大模型任务
    HUMAN_TASK,   // 人工任务
    CONDITION     // 条件分支
}
