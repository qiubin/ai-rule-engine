package com.ruleengine.domain.enums;

public enum ProcessInstanceStatus {
    RUNNING,      // 运行中
    COMPLETED,    // 已完成
    FAILED,       // 执行失败
    SUSPENDED,    // 挂起（等待人工确认/延时）
    TERMINATED    // 已终止
}
