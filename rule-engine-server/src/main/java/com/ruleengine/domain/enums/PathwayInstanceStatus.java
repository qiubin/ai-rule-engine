package com.ruleengine.domain.enums;

public enum PathwayInstanceStatus {
    ADMISSION_PENDING,  // 准入待审核
    ACTIVE,             // 执行中
    STAGE_TRANSITION,   // 阶段流转中
    COMPLETED,          // 已完成
    EXITED,             // 已退出
    TERMINATED          // 已终止
}
