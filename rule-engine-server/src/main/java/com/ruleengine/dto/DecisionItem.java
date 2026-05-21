package com.ruleengine.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

/**
 * 单条决策建议
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DecisionItem {

    /** 决策类型 */
    private String type;    // MEDICATION / DOSAGE / CONTRANDICATION / MONITOR / GENERAL

    /** 建议动作描述 */
    private String action;

    /** 详细说明 */
    private String detail;

    /** 指南证据等级 I / IIa / IIb / III */
    private String evidenceLevel;

    /** 证据水平 A / B / C */
    private String evidenceGrade;

    /** 指南来源 */
    private String guideline;

    /** 优先级 MANDATORY / RECOMMENDED / OPTIONAL */
    private String priority;

    /** 关联药品编码 */
    private String drugCode;

    /** 关联药品名称 */
    private String drugName;

    /** 起始剂量 */
    private String startDose;

    /** 目标剂量 */
    private String targetDose;

    /** 频次 */
    private String frequency;
}
