package com.ruleengine.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.util.*;

/**
 * 标准化决策响应 — 规则引擎的"输出契约"
 *
 * 包含路径执行轨迹、每条决策建议及对应的指南证据引用。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DecisionResponse {

    /** 路径编码 */
    private String pathwayCode;

    /** 路径名称 */
    private String pathwayName;

    /** 执行状态 */
    private String status;  // IN_PROGRESS / COMPLETED / ERROR

    /** 决策建议列表 */
    @Builder.Default
    private List<DecisionItem> decisions = new ArrayList<>();

    /** 风险提示 */
    @Builder.Default
    private List<Risks> risks = new ArrayList<>();

    /** 执行轨迹（每个阶段的执行记录） */
    @Builder.Default
    private List<StageExecution> executionTrace = new ArrayList<>();

    /** 原始上下文快照 */
    private ClinicalContext context;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Risks {
        private String type;
        private String level;   // HIGH / MEDIUM / LOW
        private String description;
    }
}
