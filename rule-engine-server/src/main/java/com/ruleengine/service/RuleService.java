package com.ruleengine.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ruleengine.domain.Rule;
import com.ruleengine.domain.enums.RuleStatus;
import com.ruleengine.drools.compiler.DrlCompiler;
import com.ruleengine.drools.runtime.RuleExecutor;
import com.ruleengine.repository.RuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RuleService {

    private final RuleRepository ruleRepository;
    private final DrlCompiler drlCompiler;
    private final RuleExecutor ruleExecutor;
    private final ObjectMapper objectMapper;
    private final RuleExecutionLogService ruleExecutionLogService;
    private final RuleVersionService ruleVersionService;
    private final com.ruleengine.drools.adapter.EmrDataService emrDataService;

    public List<Rule> findAll() {
        return ruleRepository.findByDeletedFalse();
    }

    public List<Rule> findByRuleTypeId(Long ruleTypeId) {
        return ruleRepository.findByDeletedFalseAndRuleTypeId(ruleTypeId);
    }

    public List<Rule> findByRuleTypeIds(List<Long> ruleTypeIds) {
        if (ruleTypeIds == null || ruleTypeIds.isEmpty()) {
            return Collections.emptyList();
        }
        return ruleRepository.findByDeletedFalseAndRuleTypeIdIn(ruleTypeIds);
    }

    public List<Rule> findDeleted() {
        return ruleRepository.findByDeletedTrue();
    }

    public Rule findById(Long id) {
        return ruleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("规则不存在: " + id));
    }

    public Rule findByCode(String code) {
        return ruleRepository.findByCode(code)
                .orElseThrow(() -> new RuntimeException("规则不存在: " + code));
    }

    @Transactional
    public Rule save(Rule rule) {
        validateRuleType(rule);
        if (rule.getStatus() == null) {
            rule.setStatus(RuleStatus.DRAFT);
        }
        return ruleRepository.save(rule);
    }

    @Transactional
    public Rule update(Long id, Rule rule) {
        Rule existing = findById(id);
        if (existing.getStatus() == RuleStatus.PUBLISHED) {
            throw new RuntimeException("已发布的规则不能直接修改，请先创建新版本");
        }
        validateRuleType(rule);
        existing.setName(rule.getName());
        existing.setRemark(rule.getRemark());
        existing.setRuleTypeId(rule.getRuleTypeId());
        return ruleRepository.save(existing);
    }

    @SneakyThrows
    @Transactional
    public Rule saveCanvas(Long id, String canvasData) {
        Rule rule = findById(id);
        validateRuleType(rule);
        rule.setCanvasData(canvasData);

        JsonNode canvasNode = objectMapper.readTree(canvasData);
        String drl = drlCompiler.compile(rule.getCode(), canvasNode);
        rule.setDroolsDrl(drl);

        Integer nextVersion = ruleVersionService.getNextVersion(rule.getId());
        ruleVersionService.createVersion(rule.getId(), nextVersion, canvasData, drl, null);
        rule.setVersion(String.valueOf(nextVersion));

        log.info("规则 [{}] 画布已保存，版本 {}，DRL 已生成", rule.getCode(), nextVersion);
        return ruleRepository.save(rule);
    }

    @Transactional
    public Rule publish(Long id) {
        Rule rule = findById(id);
        if (rule.getDroolsDrl() == null || rule.getDroolsDrl().isEmpty()) {
            throw new RuntimeException("规则尚未配置画布，无法发布");
        }
        rule.setStatus(RuleStatus.PUBLISHED);
        ruleExecutor.compileAndCache(rule.getCode(), rule.getDroolsDrl());
        log.info("规则 [{}] 已发布", rule.getCode());
        return ruleRepository.save(rule);
    }

    @Transactional
    public Rule withdraw(Long id) {
        Rule rule = findById(id);
        if (rule.getStatus() != RuleStatus.PUBLISHED) {
            throw new RuntimeException("只有已发布的规则才能撤回");
        }
        rule.setStatus(RuleStatus.DRAFT);
        log.info("规则 [{}] 已撤回为草稿", rule.getCode());
        return ruleRepository.save(rule);
    }

    @Transactional
    public Rule disable(Long id) {
        Rule rule = findById(id);
        if (rule.getStatus() != RuleStatus.PUBLISHED) {
            throw new RuntimeException("只有已发布的规则才能停用");
        }
        rule.setStatus(RuleStatus.DISABLED);
        log.info("规则 [{}] 已停用", rule.getCode());
        return ruleRepository.save(rule);
    }

    @Transactional
    public Rule deleteById(Long id) {
        Rule rule = findById(id);
        rule.setDeleted(true);
        rule.setDeletedAt(LocalDateTime.now());
        log.info("规则 [{}] 已移入回收站", rule.getCode());
        return ruleRepository.save(rule);
    }

    @Transactional
    public Rule restore(Long id) {
        Rule rule = findById(id);
        if (!Boolean.TRUE.equals(rule.getDeleted())) {
            throw new RuntimeException("该规则不在回收站中");
        }
        rule.setDeleted(false);
        rule.setDeletedAt(null);
        rule.setStatus(RuleStatus.DRAFT);
        log.info("规则 [{}] 已从回收站恢复", rule.getCode());
        return ruleRepository.save(rule);
    }

    @Transactional
    public void permanentDelete(Long id) {
        Rule rule = findById(id);
        if (!Boolean.TRUE.equals(rule.getDeleted())) {
            throw new RuntimeException("只能彻底删除回收站中的规则");
        }
        ruleRepository.deleteById(id);
        log.info("规则 [{}] 已彻底删除", rule.getCode());
    }

    public Map<String, Object> execute(String ruleCode, Map<String, Object> parameters) {
        Rule rule = findByCode(ruleCode);
        if (rule.getStatus() != RuleStatus.PUBLISHED) {
            throw new RuntimeException("规则未发布，无法执行");
        }
        parameters = enrichWithHisData(parameters);
        long start = System.currentTimeMillis();
        String status = "SUCCESS";
        String errorMessage = null;
        Map<String, Object> result = null;
        try {
            result = ruleExecutor.execute(ruleCode, rule.getDroolsDrl(), parameters);
            if (!Boolean.TRUE.equals(result.get("matched"))) {
                status = "NO_HIT";
            }
        } catch (Exception e) {
            status = "ERROR";
            errorMessage = e.getMessage();
            throw e;
        } finally {
            long duration = System.currentTimeMillis() - start;
            int firedCount = result != null ? (int) result.getOrDefault("firedRules", 0) : 0;
            List<String> hitNodeIds = result != null ? ruleExecutionLogService.extractHitNodeIds(result) : new ArrayList<>();
            try {
                ruleExecutionLogService.saveLog(
                        rule.getId(), rule.getCode(), rule.getVersion(),
                        parameters, result != null ? result : new HashMap<>(),
                        hitNodeIds, firedCount, duration, status, errorMessage
                );
            } catch (Exception logEx) {
                log.warn("保存执行日志失败: {}", logEx.getMessage());
            }
        }
        return result;
    }

    @SneakyThrows
    public Map<String, Object> testExecute(Long id, Map<String, Object> parameters) {
        Rule rule = findById(id);
        if (rule.getCanvasData() == null || rule.getCanvasData().isEmpty()) {
            throw new RuntimeException("规则尚未配置画布，无法测试执行");
        }
        // 测试执行时重新编译 DRL，确保使用最新的编译器逻辑
        JsonNode canvasNode = objectMapper.readTree(rule.getCanvasData());
        String drl = drlCompiler.compile(rule.getCode(), canvasNode);
        if (drl == null || drl.isEmpty()) {
            throw new RuntimeException("规则画布为空，无法生成 DRL");
        }
        // 测试执行时强制重新编译并缓存最新 DRL，避免使用旧缓存版本
        ruleExecutor.compileAndCache(rule.getCode(), drl);

        parameters = enrichWithHisData(parameters);
        long start = System.currentTimeMillis();
        String status = "SUCCESS";
        String errorMessage = null;
        Map<String, Object> result = null;
        try {
            result = ruleExecutor.execute(rule.getCode(), drl, parameters);
            if (!Boolean.TRUE.equals(result.get("matched"))) {
                status = "NO_HIT";
            }
        } catch (Exception e) {
            status = "ERROR";
            errorMessage = e.getMessage();
            throw e;
        } finally {
            long duration = System.currentTimeMillis() - start;
            int firedCount = result != null ? (int) result.getOrDefault("firedRules", 0) : 0;
            List<String> hitNodeIds = result != null ? ruleExecutionLogService.extractHitNodeIds(result) : new ArrayList<>();
            try {
                ruleExecutionLogService.saveLog(
                        rule.getId(), rule.getCode(), rule.getVersion(),
                        parameters, result != null ? result : new HashMap<>(),
                        hitNodeIds, firedCount, duration, status, errorMessage
                );
            } catch (Exception logEx) {
                log.warn("保存执行日志失败: {}", logEx.getMessage());
            }
        }
        return result;
    }

    @SneakyThrows
    public Map<String, Object> batchTestExecute(List<Long> ruleIds, Map<String, Object> parameters) {
        List<Map<String, Object>> results = new ArrayList<>();
        int matchedCount = 0;
        int executedCount = 0;

        for (Long id : ruleIds) {
            Rule rule = null;
            long start = System.currentTimeMillis();
            String logStatus = "SUCCESS";
            String logError = null;
            Map<String, Object> result = null;
            try {
                rule = findById(id);
                if (rule.getCanvasData() == null || rule.getCanvasData().isEmpty()) {
                    continue;
                }
                JsonNode canvasNode = objectMapper.readTree(rule.getCanvasData());
                String drl = drlCompiler.compile(rule.getCode(), canvasNode);
                if (drl == null || drl.isEmpty()) {
                    continue;
                }
                result = ruleExecutor.execute(rule.getCode(), drl, parameters);
                executedCount++;
                if (!Boolean.TRUE.equals(result.get("matched"))) {
                    logStatus = "NO_HIT";
                }

                Map<String, Object> summary = new HashMap<>();
                summary.put("ruleId", rule.getId());
                summary.put("ruleCode", rule.getCode());
                summary.put("ruleName", rule.getName());
                summary.put("status", rule.getStatus());
                summary.put("matched", result.get("matched"));
                summary.put("firedRules", result.get("firedRules"));
                summary.put("results", result.get("results"));

                if (Boolean.TRUE.equals(result.get("matched"))) {
                    matchedCount++;
                }
                results.add(summary);
            } catch (Exception e) {
                logStatus = "ERROR";
                logError = e.getMessage();
                log.warn("规则 [{}] 批量测试执行失败: {}", rule != null ? rule.getCode() : id, e.getMessage());
                Map<String, Object> summary = new HashMap<>();
                summary.put("ruleId", id);
                summary.put("ruleCode", rule != null ? rule.getCode() : "");
                summary.put("ruleName", rule != null ? rule.getName() : "");
                summary.put("status", rule != null ? rule.getStatus() : "");
                summary.put("matched", false);
                summary.put("firedRules", 0);
                summary.put("error", e.getMessage());
                results.add(summary);
            } finally {
                if (rule != null) {
                    long duration = System.currentTimeMillis() - start;
                    int firedCount = result != null ? (int) result.getOrDefault("firedRules", 0) : 0;
                    List<String> hitNodeIds = result != null ? ruleExecutionLogService.extractHitNodeIds(result) : new ArrayList<>();
                    try {
                        ruleExecutionLogService.saveLog(
                                rule.getId(), rule.getCode(), rule.getVersion(),
                                parameters, result != null ? result : new HashMap<>(),
                                hitNodeIds, firedCount, duration, logStatus, logError
                        );
                    } catch (Exception logEx) {
                        log.warn("保存执行日志失败: {}", logEx.getMessage());
                    }
                }
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("total", ruleIds.size());
        response.put("executed", executedCount);
        response.put("matched", matchedCount);
        response.put("details", results);
        response.put("parameters", parameters);
        return response;
    }

    private Map<String, Object> enrichWithHisData(Map<String, Object> parameters) {
        if (parameters == null) {
            parameters = new HashMap<>();
        }
        if (parameters.containsKey("patientId")) {
            String patientId = String.valueOf(parameters.get("patientId"));
            String admissionId = parameters.containsKey("admissionId")
                    ? String.valueOf(parameters.get("admissionId")) : null;
            Map<String, Object> emrData = emrDataService.fetchPatientData(patientId, admissionId);
            // 传入参数优先级高于 HIS 数据（方便测试时覆盖）
            emrData.putAll(parameters);
            parameters = emrData;
        }
        return parameters;
    }

    private void validateRuleType(Rule rule) {
        if (rule.getRuleTypeId() == null) {
            throw new RuntimeException("规则必须选择规则类型");
        }
    }
}
