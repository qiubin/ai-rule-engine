package com.ruleengine.domain.enums;

public enum PathwayTaskType {
    RULE,       // 规则任务
    DIFY,       // Dify AI任务
    LLM,        // 大模型任务
    SERVICE,    // 服务调用任务
    HUMAN,      // 人工任务
    CHECKLIST   // 检查清单任务
}
