package com.ruleengine.drools.runtime;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ruleengine.domain.ClinicalPathway;
import com.ruleengine.domain.PathwayStage;
import com.ruleengine.domain.PathwayTask;
import com.ruleengine.dto.ClinicalContext;
import com.ruleengine.dto.DecisionItem;
import com.ruleengine.dto.DecisionResponse;
import com.ruleengine.dto.StageExecution;
import com.ruleengine.repository.ClinicalPathwayRepository;
import com.ruleengine.repository.PathwayStageRepository;
import com.ruleengine.repository.PathwayTaskRepository;
import com.ruleengine.service.RuleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 决策路径引擎 — 临床路径编排执行器
 *
 * 接收标准化就诊上下文，按路径定义（阶段→任务）顺序执行，
 * 支持条件跳过（exitRuleCode）、多类型任务（RULE/SERVICE/HUMAN）、
 * 执行轨迹追踪。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DecisionPathEngine {

    private final ClinicalPathwayRepository pathwayRepository;
    private final PathwayStageRepository stageRepository;
    private final PathwayTaskRepository taskRepository;
    private final RuleService ruleService;
    private final ObjectMapper objectMapper;

    /**
     * 执行完整决策路径
     *
     * @param pathwayId 路径ID
     * @param context   标准化就诊上下文
     * @return 决策响应（含执行轨迹）
     */
    public DecisionResponse execute(Long pathwayId, ClinicalContext context) {
        ClinicalPathway pathway = pathwayRepository.findById(pathwayId)
                .orElseThrow(() -> new RuntimeException("决策路径不存在: " + pathwayId));

        List<PathwayStage> stages = stageRepository.findByPathwayIdOrderBySortOrderAsc(pathwayId);

        Map<String, Object> flatParams = context.toFlatMap();

        DecisionResponse.DecisionResponseBuilder responseBuilder = DecisionResponse.builder()
                .pathwayCode(pathway.getCode())
                .pathwayName(pathway.getName())
                .status("COMPLETED")
                .context(context);

        List<DecisionItem> allDecisions = new ArrayList<>();
        List<StageExecution> trace = new ArrayList<>();

        for (PathwayStage stage : stages) {
            StageExecution.StageExecutionBuilder stageTrace = StageExecution.builder()
                    .stageName(stage.getName())
                    .stageCode(stage.getCode())
                    .sortOrder(stage.getSortOrder());

            try {
                // 1. 检查阶段退出条件（exitRuleCode）
                if (shouldSkipStage(stage, flatParams)) {
                    stageTrace.status("SKIPPED")
                            .matched(false)
                            .firedCount(0)
                            .result("阶段退出条件满足，已跳过");
                    trace.add(stageTrace.build());
                    log.info("阶段 [{}] 退出条件满足，已跳过", stage.getCode());
                    continue;
                }

                // 2. 执行阶段下的所有任务
                List<PathwayTask> tasks = taskRepository.findByStageIdOrderBySortOrderAsc(stage.getId());
                List<DecisionItem> stageDecisions = new ArrayList<>();
                int firedCount = 0;
                boolean stageMatched = false;

                for (PathwayTask task : tasks) {
                    DecisionTaskResult taskResult = executeTask(task, flatParams, stage.getCode());
                    if (taskResult != null) {
                        if (taskResult.decisions != null) {
                            stageDecisions.addAll(taskResult.decisions);
                        }
                        firedCount += taskResult.firedCount;
                        if (taskResult.matched) {
                            stageMatched = true;
                        }
                    }
                }

                allDecisions.addAll(stageDecisions);

                stageTrace.status(stageMatched ? "SUCCESS" : "NO_MATCH")
                        .matched(stageMatched)
                        .firedCount(firedCount)
                        .result(stageDecisions);

            } catch (Exception e) {
                log.error("阶段 [{}] 执行异常: {}", stage.getCode(), e.getMessage(), e);
                stageTrace.status("ERROR")
                        .matched(false)
                        .firedCount(0)
                        .errorMessage(e.getMessage());
            }

            trace.add(stageTrace.build());
        }

        return responseBuilder
                .decisions(allDecisions)
                .executionTrace(trace)
                .build();
    }

    /**
     * 检查是否需要跳过当前阶段
     * exitRuleCode 对应的规则若匹配（matched=true），则跳过该阶段
     */
    private boolean shouldSkipStage(PathwayStage stage, Map<String, Object> params) {
        if (stage.getExitRuleCode() == null || stage.getExitRuleCode().trim().isEmpty()) {
            return false;
        }
        try {
            Map<String, Object> result = ruleService.execute(stage.getExitRuleCode(), params);
            boolean matched = Boolean.TRUE.equals(result.get("matched"));
            if (matched) {
                log.info("退出规则 [{}] 匹配，跳过阶段 [{}]", stage.getExitRuleCode(), stage.getCode());
            }
            return matched;
        } catch (Exception e) {
            log.warn("退出规则 [{}] 执行异常，不跳过阶段 [{}]: {}", stage.getExitRuleCode(), stage.getCode(), e.getMessage());
            return false;
        }
    }

    /**
     * 执行单个任务
     */
    private DecisionTaskResult executeTask(PathwayTask task, Map<String, Object> params, String stageCode) {
        switch (task.getTaskType()) {
            case RULE:
                return executeRuleTask(task, params);
            case SERVICE:
                return executeServiceTask(task, params);
            case HUMAN:
                return executeHumanTask(task);
            case CHECKLIST:
                return executeChecklistTask(task);
            case AGENT:
            default:
                log.info("任务类型 [{}] 暂不支持自动执行，跳过", task.getTaskType());
                return null;
        }
    }

    /**
     * 执行规则任务：调用 RuleService.execute() 执行规则
     */
    private DecisionTaskResult executeRuleTask(PathwayTask task, Map<String, Object> params) {
        String ruleCode = task.getProcessNodeId();
        if (ruleCode == null || ruleCode.trim().isEmpty()) {
            // 从 config JSON 中读取
            if (task.getConfig() != null && !task.getConfig().isEmpty()) {
                try {
                    Map<String, Object> config = objectMapper.readValue(task.getConfig(), Map.class);
                    ruleCode = (String) config.get("ruleCode");
                } catch (Exception e) {
                    log.warn("任务 [{}] config 解析失败: {}", task.getCode(), e.getMessage());
                }
            }
        }
        if (ruleCode == null || ruleCode.trim().isEmpty()) {
            log.warn("任务 [{}] 未配置规则编码，跳过", task.getCode());
            return null;
        }

        Map<String, Object> result = ruleService.execute(ruleCode, params);
        boolean matched = Boolean.TRUE.equals(result.get("matched"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rawResults = (List<Map<String, Object>>) result.get("results");
        int firedCount = (int) result.getOrDefault("firedRules", 0);

        List<DecisionItem> decisions = new ArrayList<>();
        if (rawResults != null) {
            for (Map<String, Object> r : rawResults) {
                decisions.add(DecisionItem.builder()
                        .type(str(r.get("resultType")))
                        .action(str(r.get("resultValue")))
                        .detail(str(r.get("content")))
                        .evidenceLevel(extractEvidenceLevel(r))
                        .evidenceGrade(extractEvidenceGrade(r))
                        .guideline(extractGuideline(r))
                        .build());
            }
        }

        return new DecisionTaskResult(decisions, firedCount, matched);
    }

    /**
     * 执行服务调用任务：模拟调用，记录待人工处理
     */
    private DecisionTaskResult executeServiceTask(PathwayTask task, Map<String, Object> params) {
        String serviceTarget = task.getProcessNodeId();
        log.info("服务任务 [{}] 需调用外部服务: {}", task.getCode(), serviceTarget);

        DecisionItem item = DecisionItem.builder()
                .type("SERVICE")
                .action("调用外部服务: " + (serviceTarget != null ? serviceTarget : "未配置"))
                .detail("该任务需业务系统配合完成，规则引擎已记录请求")
                .priority("RECOMMENDED")
                .build();

        return new DecisionTaskResult(Collections.singletonList(item), 0, true);
    }

    /**
     * 执行人工任务：记录待人工决策
     */
    private DecisionTaskResult executeHumanTask(PathwayTask task) {
        log.info("人工任务 [{}] 需人工处理", task.getCode());
        DecisionItem item = DecisionItem.builder()
                .type("HUMAN")
                .action(task.getName())
                .detail("需要临床医生判断")
                .priority("RECOMMENDED")
                .build();
        return new DecisionTaskResult(Collections.singletonList(item), 0, false);
    }

    /**
     * 执行检查清单任务
     */
    private DecisionTaskResult executeChecklistTask(PathwayTask task) {
        DecisionItem item = DecisionItem.builder()
                .type("MONITOR")
                .action("检查清单: " + task.getName())
                .detail("请确认清单项完成情况")
                .priority("OPTIONAL")
                .build();
        return new DecisionTaskResult(Collections.singletonList(item), 0, false);
    }

    // ==== 辅助方法 ====

    private String extractEvidenceLevel(Map<String, Object> r) {
        String metadata = str(r.get("metadata"));
        if (metadata != null && !metadata.isEmpty()) {
            try {
                Map<String, Object> meta = objectMapper.readValue(metadata, Map.class);
                String level = str(meta.get("evidenceLevel"));
                if (level != null) return level;
            } catch (Exception ignored) {}
        }
        return null;
    }

    private String extractEvidenceGrade(Map<String, Object> r) {
        String metadata = str(r.get("metadata"));
        if (metadata != null && !metadata.isEmpty()) {
            try {
                Map<String, Object> meta = objectMapper.readValue(metadata, Map.class);
                String grade = str(meta.get("evidenceGrade"));
                if (grade != null) return grade;
            } catch (Exception ignored) {}
        }
        return null;
    }

    private String extractGuideline(Map<String, Object> r) {
        String metadata = str(r.get("metadata"));
        if (metadata != null && !metadata.isEmpty()) {
            try {
                Map<String, Object> meta = objectMapper.readValue(metadata, Map.class);
                String guideline = str(meta.get("guideline"));
                if (guideline != null) return guideline;
            } catch (Exception ignored) {}
        }
        return null;
    }

    private String str(Object o) { return o != null ? String.valueOf(o) : null; }

    /** 任务执行结果内部封装 */
    private static class DecisionTaskResult {
        final List<DecisionItem> decisions;
        final int firedCount;
        final boolean matched;

        DecisionTaskResult(List<DecisionItem> decisions, int firedCount, boolean matched) {
            this.decisions = decisions;
            this.firedCount = firedCount;
            this.matched = matched;
        }
    }
}
