package com.ruleengine.controller;

import com.ruleengine.dto.RuleImportPreview;
import lombok.Data;

import java.util.List;

/**
 * 规则导入确认请求
 */
@Data
public class ImportConfirmRequest {
    private List<RuleImportPreview> previews;
    private List<String> selectedCodes;
    private Long ruleTypeId;
}
