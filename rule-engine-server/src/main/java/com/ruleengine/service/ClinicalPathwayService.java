package com.ruleengine.service;

import com.ruleengine.domain.ClinicalPathway;
import com.ruleengine.domain.PathwayStage;
import com.ruleengine.domain.PathwayTask;
import com.ruleengine.domain.enums.PathwayStatus;
import com.ruleengine.repository.ClinicalPathwayRepository;
import com.ruleengine.repository.PathwayStageRepository;
import com.ruleengine.repository.PathwayTaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ClinicalPathwayService {

    private final ClinicalPathwayRepository clinicalPathwayRepository;
    private final PathwayStageRepository pathwayStageRepository;
    private final PathwayTaskRepository pathwayTaskRepository;

    public List<ClinicalPathway> findAll() {
        return clinicalPathwayRepository.findByDeletedFalse();
    }

    public ClinicalPathway findById(Long id) {
        return clinicalPathwayRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("临床路径不存在: " + id));
    }

    @Transactional
    public ClinicalPathway save(ClinicalPathway pathway) {
        if (pathway.getStatus() == null) {
            pathway.setStatus(PathwayStatus.DRAFT);
        }
        return clinicalPathwayRepository.save(pathway);
    }

    @Transactional
    public ClinicalPathway update(Long id, ClinicalPathway pathway) {
        ClinicalPathway existing = findById(id);
        if (existing.getStatus() == PathwayStatus.PUBLISHED) {
            throw new RuntimeException("已发布的临床路径不能直接修改，请先撤回");
        }
        existing.setCode(pathway.getCode());
        existing.setName(pathway.getName());
        existing.setDescription(pathway.getDescription());
        existing.setVersion(pathway.getVersion());
        existing.setIndication(pathway.getIndication());
        existing.setAdmissionRuleCode(pathway.getAdmissionRuleCode());
        existing.setProcessDefId(pathway.getProcessDefId());
        return clinicalPathwayRepository.save(existing);
    }

    public List<PathwayStage> findStagesByPathwayId(Long pathwayId) {
        return pathwayStageRepository.findByPathwayIdOrderBySortOrderAsc(pathwayId);
    }

    public List<PathwayTask> findTasksByStageId(Long stageId) {
        return pathwayTaskRepository.findByStageIdOrderBySortOrderAsc(stageId);
    }

    @Transactional
    public List<PathwayStage> saveStages(Long pathwayId, List<PathwayStage> stages) {
        ClinicalPathway pathway = findById(pathwayId);
        if (pathway.getStatus() == PathwayStatus.PUBLISHED) {
            throw new RuntimeException("已发布的临床路径不能修改阶段");
        }

        List<PathwayStage> existingStages = pathwayStageRepository.findByPathwayId(pathwayId);
        for (PathwayStage stage : existingStages) {
            List<PathwayTask> existingTasks = pathwayTaskRepository.findByStageId(stage.getId());
            pathwayTaskRepository.deleteAll(existingTasks);
        }
        pathwayStageRepository.deleteAll(existingStages);

        List<PathwayStage> savedStages = new ArrayList<>();
        for (PathwayStage stage : stages) {
            stage.setPathwayId(pathwayId);
            stage.setId(null);
            savedStages.add(pathwayStageRepository.save(stage));
        }
        log.info("临床路径 [{}] 已保存 {} 个阶段", pathway.getCode(), savedStages.size());
        return savedStages;
    }

    @Transactional
    public List<PathwayTask> saveTasks(Long stageId, List<PathwayTask> tasks) {
        PathwayStage stage = pathwayStageRepository.findById(stageId)
                .orElseThrow(() -> new RuntimeException("阶段不存在: " + stageId));
        ClinicalPathway pathway = findById(stage.getPathwayId());
        if (pathway.getStatus() == PathwayStatus.PUBLISHED) {
            throw new RuntimeException("已发布的临床路径不能修改任务");
        }

        List<PathwayTask> existingTasks = pathwayTaskRepository.findByStageId(stageId);
        pathwayTaskRepository.deleteAll(existingTasks);

        List<PathwayTask> savedTasks = new ArrayList<>();
        for (PathwayTask task : tasks) {
            task.setStageId(stageId);
            task.setId(null);
            savedTasks.add(pathwayTaskRepository.save(task));
        }
        log.info("临床路径阶段 [{}] 已保存 {} 个任务", stage.getCode(), savedTasks.size());
        return savedTasks;
    }

    @Transactional
    public ClinicalPathway publish(Long id) {
        ClinicalPathway pathway = findById(id);
        List<PathwayStage> stages = pathwayStageRepository.findByPathwayId(id);
        if (stages.isEmpty()) {
            throw new RuntimeException("临床路径尚未配置阶段，无法发布");
        }
        pathway.setStatus(PathwayStatus.PUBLISHED);
        log.info("临床路径 [{}] 已发布", pathway.getCode());
        return clinicalPathwayRepository.save(pathway);
    }

    @Transactional
    public ClinicalPathway deleteById(Long id) {
        ClinicalPathway pathway = findById(id);
        pathway.setDeleted(true);
        pathway.setDeletedAt(LocalDateTime.now());
        log.info("临床路径 [{}] 已删除", pathway.getCode());
        return clinicalPathwayRepository.save(pathway);
    }

    public Map<String, Object> findFullPathway(Long id) {
        ClinicalPathway pathway = findById(id);
        List<PathwayStage> stages = pathwayStageRepository.findByPathwayIdOrderBySortOrderAsc(id);

        List<Map<String, Object>> stageList = new ArrayList<>();
        for (PathwayStage stage : stages) {
            Map<String, Object> stageMap = new LinkedHashMap<>();
            stageMap.put("id", stage.getId());
            stageMap.put("pathwayId", stage.getPathwayId());
            stageMap.put("name", stage.getName());
            stageMap.put("code", stage.getCode());
            stageMap.put("sortOrder", stage.getSortOrder());
            stageMap.put("description", stage.getDescription());
            stageMap.put("exitRuleCode", stage.getExitRuleCode());
            stageMap.put("createdAt", stage.getCreatedAt());
            stageMap.put("updatedAt", stage.getUpdatedAt());

            List<PathwayTask> tasks = pathwayTaskRepository.findByStageIdOrderBySortOrderAsc(stage.getId());
            stageMap.put("tasks", tasks);
            stageList.add(stageMap);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", pathway.getId());
        result.put("code", pathway.getCode());
        result.put("name", pathway.getName());
        result.put("description", pathway.getDescription());
        result.put("version", pathway.getVersion());
        result.put("status", pathway.getStatus());
        result.put("indication", pathway.getIndication());
        result.put("admissionRuleCode", pathway.getAdmissionRuleCode());
        result.put("processDefId", pathway.getProcessDefId());
        result.put("createdAt", pathway.getCreatedAt());
        result.put("updatedAt", pathway.getUpdatedAt());
        result.put("stages", stageList);
        return result;
    }
}
