package com.ruleengine.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

/**
 * 阶段执行记录 — 用于追踪决策路径的执行轨迹
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StageExecution {

    /** 阶段名称 */
    private String stageName;

    /** 阶段编码 */
    private String stageCode;

    /** 执行顺序 */
    private Integer sortOrder;

    /** 执行状态 SKIPPED / SUCCESS / ERROR / NO_MATCH */
    private String status;

    /** 触发的决策数 */
    private Integer firedCount;

    /** 是否匹配 */
    private Boolean matched;

    /** 详细结果 */
    private Object result;

    /** 错误信息 */
    private String errorMessage;
}
