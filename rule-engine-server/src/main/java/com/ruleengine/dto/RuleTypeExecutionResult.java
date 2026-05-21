package com.ruleengine.dto;

import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * 规则类型级统一执行结果
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RuleTypeExecutionResult {

    /** 规则类型 ID */
    private Long ruleTypeId;

    /** 规则类型编码 */
    private String ruleTypeCode;

    /** 规则类型名称 */
    private String ruleTypeName;

    /** 执行汇总 */
    private Summary summary;

    /** 每条规则的执行明细 */
    private List<SingleRuleResult> results;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Summary {
        /** 规则总数 */
        private int total;

        /** 命中规则数 */
        private int matched;

        /** 未命中规则数 */
        private int unmatched;

        /** 执行失败的规则数 */
        private int failed;

        /** 实际执行的规则数 */
        private int executed;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SingleRuleResult {
        /** 规则 ID */
        private Long ruleId;

        /** 规则编码 */
        private String ruleCode;

        /** 规则名称 */
        private String ruleName;

        /** 是否命中 */
        private boolean matched;

        /** 触发规则数 */
        private int firedRules;

        /** 执行结果详情 */
        private Map<String, Object> details;

        /** 执行耗时（毫秒） */
        private long durationMs;

        /** 执行状态：SUCCESS / NO_HIT / ERROR */
        private String status;

        /** 错误信息（仅 ERROR 时有值） */
        private String errorMessage;
    }
}
