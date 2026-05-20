package com.ruleengine.dto;

import com.alibaba.excel.annotation.ExcelProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 规则导出 Excel 行映射
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RuleExportRow {
    @ExcelProperty("规则编码")
    private String code;

    @ExcelProperty("规则名称")
    private String name;

    @ExcelProperty("状态")
    private String status;

    @ExcelProperty("备注")
    private String remark;

    @ExcelProperty("条件字段")
    private String conditionField;

    @ExcelProperty("操作符")
    private String operator;

    @ExcelProperty("条件值")
    private String conditionValue;

    @ExcelProperty("画布JSON")
    private String canvasData;
}
