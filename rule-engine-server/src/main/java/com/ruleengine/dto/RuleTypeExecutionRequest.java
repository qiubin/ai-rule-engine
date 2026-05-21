package com.ruleengine.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.HashMap;
import java.util.Map;

/**
 * 规则类型级统一执行请求
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RuleTypeExecutionRequest {

    /** 执行入参（患者数据等） */
    private Map<String, Object> parameters = new HashMap<>();

    /** 执行选项 */
    private ExecutionOptions options = new ExecutionOptions();

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ExecutionOptions {
        /** 命中一条后是否停止执行后续规则 */
        private boolean stopOnFirstMatch = false;

        /** 是否只执行已发布的规则（默认 true） */
        private boolean onlyPublished = true;

        /** 单条规则执行失败时是否中断整体执行 */
        private boolean failFast = false;
    }
}
