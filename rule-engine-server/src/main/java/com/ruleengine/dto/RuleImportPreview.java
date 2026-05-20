package com.ruleengine.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 规则导入预览项（未保存到数据库）
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RuleImportPreview {
    private String code;
    private String name;
    private String field;
    private String operator;
    private String value;
    private String canvasJson;
    private String sourceIndicator;
    private String sourceMethod;
}
