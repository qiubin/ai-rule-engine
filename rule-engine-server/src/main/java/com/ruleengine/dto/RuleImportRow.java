package com.ruleengine.dto;

import com.alibaba.excel.annotation.ExcelProperty;
import lombok.Data;

/**
 * 规则导入 Excel 行映射
 * 默认读取第1列=模板/分类，第2列=质控指标，第3列=实现方法
 */
@Data
public class RuleImportRow {
    @ExcelProperty(index = 0)
    private String template;

    @ExcelProperty(index = 1)
    private String indicator;

    @ExcelProperty(index = 2)
    private String method;
}
