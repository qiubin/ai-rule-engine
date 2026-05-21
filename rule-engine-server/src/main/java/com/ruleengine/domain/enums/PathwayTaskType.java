package com.ruleengine.domain.enums;

public enum PathwayTaskType {
    RULE,       // 规则任务
    AGENT,      // 智能体任务（Dify / 大模型）
    SERVICE,    // 服务调用任务
    HUMAN,      // 人工任务
    CHECKLIST   // 检查清单任务
}
