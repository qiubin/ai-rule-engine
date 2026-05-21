package com.ruleengine.service;

import com.ruleengine.domain.Rule;
import com.ruleengine.domain.RuleType;
import com.ruleengine.domain.enums.RuleStatus;
import com.ruleengine.dto.RuleTypeExecutionRequest;
import com.ruleengine.dto.RuleTypeExecutionResult;
import com.ruleengine.drools.adapter.EmrDataService;
import com.ruleengine.drools.runtime.RuleExecutor;
import com.ruleengine.repository.RuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 规则类型级统一执行服务
 * 以规则类型为归集，对外提供批量执行能力
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RuleTypeExecutionService {

    private final RuleRepository ruleRepository;
    private final RuleTypeService ruleTypeService;
    private final RuleExecutor ruleExecutor;
    private final EmrDataService emrDataService;
    private final RuleExecutionLogService ruleExecutionLogService;

    /**
     * 按规则类型 ID 执行该类型下所有规则
     */
    public RuleTypeExecutionResult executeByTypeId(Long ruleTypeId, RuleTypeExecutionRequest request) {
        RuleType ruleType = ruleTypeService.findById(ruleTypeId);
        List<Rule> rules = findRules(ruleTypeId, request.getOptions());
        return doExecute(ruleType, rules, request);
    }

    /**
     * 按规则类型编码执行该类型下所有规则
     */
    public RuleTypeExecutionResult executeByTypeCode(String typeCode, RuleTypeExecutionRequest request) {
        RuleType ruleType = ruleTypeService.findByCode(typeCode);
        List<Rule> rules = findRules(ruleType.getId(), request.getOptions());
        return doExecute(ruleType, rules, request);
    }

    /**
     * 查询该类型下待执行的规则列表
     */
    private List<Rule> findRules(Long ruleTypeId, RuleTypeExecutionRequest.ExecutionOptions options) {
        List<Rule> rules;
        if (options.isOnlyPublished()) {
            rules = ruleRepository.findByRuleTypeIdAndStatusAndDeletedFalse(ruleTypeId, RuleStatus.PUBLISHED);
        } else {
            rules = ruleRepository.findByDeletedFalseAndRuleTypeId(ruleTypeId);
        }
        if (rules == null || rules.isEmpty()) {
            return Collections.emptyList();
        }
        return rules;
    }

    /**
     * 执行规则列表并汇总结果
     */
    private RuleTypeExecutionResult doExecute(RuleType ruleType, List<Rule> rules, RuleTypeExecutionRequest request) {
        Map<String, Object> parameters = enrichWithHisData(request.getParameters());
        RuleTypeExecutionRequest.ExecutionOptions options = request.getOptions();

        List<RuleTypeExecutionResult.SingleRuleResult> results = new ArrayList<>();
        int matchedCount = 0;
        int failedCount = 0;
        int executedCount = 0;

        for (Rule rule : rules) {
            long start = System.currentTimeMillis();
            String status = "SUCCESS";
            String errorMessage = null;
            Map<String, Object> rawResult = null;
            boolean matched = false;
            int fired = 0;

            try {
                if (rule.getDroolsDrl() == null || rule.getDroolsDrl().isEmpty()) {
                    throw new RuntimeException("规则尚未发布，无 DRL 文本");
                }
                rawResult = ruleExecutor.execute(rule.getCode(), rule.getDroolsDrl(), parameters);
                matched = Boolean.TRUE.equals(rawResult.get("matched"));
                fired = rawResult != null ? (int) rawResult.getOrDefault("firedRules", 0) : 0;
                if (matched) {
                    matchedCount++;
                }
                executedCount++;
            } catch (Exception e) {
                status = "ERROR";
                errorMessage = e.getMessage();
                failedCount++;
                log.warn("规则类型 [{}] 下规则 [{}] 执行失败: {}", ruleType.getCode(), rule.getCode(), e.getMessage());
                if (options.isFailFast()) {
                    break;
                }
            } finally {
                long duration = System.currentTimeMillis() - start;
                List<String> hitNodeIds = rawResult != null ? ruleExecutionLogService.extractHitNodeIds(rawResult) : new ArrayList<>();
                try {
                    ruleExecutionLogService.saveLog(
                            rule.getId(), rule.getCode(), rule.getVersion(),
                            parameters, rawResult != null ? rawResult : new HashMap<>(),
                            hitNodeIds, fired, duration, status, errorMessage
                    );
                } catch (Exception logEx) {
                    log.warn("保存执行日志失败: {}", logEx.getMessage());
                }

                RuleTypeExecutionResult.SingleRuleResult singleResult = RuleTypeExecutionResult.SingleRuleResult.builder()
                        .ruleId(rule.getId())
                        .ruleCode(rule.getCode())
                        .ruleName(rule.getName())
                        .matched(matched)
                        .firedRules(fired)
                        .details(rawResult != null ? rawResult : new HashMap<>())
                        .durationMs(duration)
                        .status(status)
                        .errorMessage(errorMessage)
                        .build();
                results.add(singleResult);
            }

            // 短路：命中后停止
            if (options.isStopOnFirstMatch() && matched) {
                break;
            }
        }

        RuleTypeExecutionResult.Summary summary = RuleTypeExecutionResult.Summary.builder()
                .total(rules.size())
                .matched(matchedCount)
                .unmatched(executedCount - matchedCount)
                .failed(failedCount)
                .executed(executedCount)
                .build();

        return RuleTypeExecutionResult.builder()
                .ruleTypeId(ruleType.getId())
                .ruleTypeCode(ruleType.getCode())
                .ruleTypeName(ruleType.getName())
                .summary(summary)
                .results(results)
                .build();
    }

    /**
     * 从 HIS 系统补充患者数据
     */
    private Map<String, Object> enrichWithHisData(Map<String, Object> parameters) {
        if (parameters == null) {
            parameters = new HashMap<>();
        }
        if (parameters.containsKey("patientId")) {
            String patientId = String.valueOf(parameters.get("patientId"));
            String admissionId = parameters.containsKey("admissionId")
                    ? String.valueOf(parameters.get("admissionId")) : null;
            Map<String, Object> emrData = emrDataService.fetchPatientData(patientId, admissionId);
            emrData.putAll(parameters);
            parameters = emrData;
        }
        return parameters;
    }
}
