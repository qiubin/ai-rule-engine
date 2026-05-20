package com.ruleengine.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ruleengine.domain.ProcessDefinition;
import com.ruleengine.domain.enums.ProcessStatus;
import com.ruleengine.repository.ProcessDefinitionRepository;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProcessDefinitionService {

    private final ProcessDefinitionRepository processDefinitionRepository;
    private final ObjectMapper objectMapper;

    public List<ProcessDefinition> findAll() {
        return processDefinitionRepository.findByDeletedFalse();
    }

    public List<ProcessDefinition> findPublished() {
        return processDefinitionRepository.findByDeletedFalseAndStatus(ProcessStatus.PUBLISHED);
    }

    public ProcessDefinition findById(Long id) {
        return processDefinitionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("流程定义不存在: " + id));
    }

    public ProcessDefinition findByCode(String code) {
        return processDefinitionRepository.findByCode(code)
                .orElseThrow(() -> new RuntimeException("流程定义不存在: " + code));
    }

    @Transactional
    public ProcessDefinition save(ProcessDefinition definition) {
        if (definition.getStatus() == null) {
            definition.setStatus(ProcessStatus.DRAFT);
        }
        return processDefinitionRepository.save(definition);
    }

    @Transactional
    public ProcessDefinition update(Long id, ProcessDefinition definition) {
        ProcessDefinition existing = findById(id);
        if (existing.getStatus() == ProcessStatus.PUBLISHED) {
            throw new RuntimeException("已发布的流程不能直接修改，请先创建新版本");
        }
        existing.setCode(definition.getCode());
        existing.setName(definition.getName());
        existing.setDescription(definition.getDescription());
        return processDefinitionRepository.save(existing);
    }

    @SneakyThrows
    @Transactional
    public ProcessDefinition saveCanvas(Long id, String canvasData, String nodeConfigs) {
        ProcessDefinition definition = findById(id);
        definition.setCanvasData(canvasData);
        if (nodeConfigs != null) {
            definition.setNodeConfigs(nodeConfigs);
        }
        log.info("流程 [{}] 画布已保存", definition.getCode());
        return processDefinitionRepository.save(definition);
    }

    @Transactional
    public ProcessDefinition publish(Long id) {
        ProcessDefinition definition = findById(id);
        if (definition.getCanvasData() == null || definition.getCanvasData().isEmpty()) {
            throw new RuntimeException("流程尚未配置画布，无法发布");
        }
        definition.setStatus(ProcessStatus.PUBLISHED);
        log.info("流程 [{}] 已发布", definition.getCode());
        return processDefinitionRepository.save(definition);
    }

    @Transactional
    public ProcessDefinition withdraw(Long id) {
        ProcessDefinition definition = findById(id);
        if (definition.getStatus() != ProcessStatus.PUBLISHED) {
            throw new RuntimeException("只有已发布的流程才能撤回");
        }
        definition.setStatus(ProcessStatus.DRAFT);
        log.info("流程 [{}] 已撤回为草稿", definition.getCode());
        return processDefinitionRepository.save(definition);
    }

    @Transactional
    public ProcessDefinition disable(Long id) {
        ProcessDefinition definition = findById(id);
        if (definition.getStatus() != ProcessStatus.PUBLISHED) {
            throw new RuntimeException("只有已发布的流程才能停用");
        }
        definition.setStatus(ProcessStatus.DISABLED);
        log.info("流程 [{}] 已停用", definition.getCode());
        return processDefinitionRepository.save(definition);
    }

    @Transactional
    public ProcessDefinition deleteById(Long id) {
        ProcessDefinition definition = findById(id);
        definition.setDeleted(true);
        definition.setDeletedAt(LocalDateTime.now());
        log.info("流程 [{}] 已删除", definition.getCode());
        return processDefinitionRepository.save(definition);
    }

    @Transactional
    public ProcessDefinition rename(Long id, String newName) {
        ProcessDefinition definition = findById(id);
        definition.setName(newName);
        log.info("流程 [{}] 已重命名为 [{}]", definition.getCode(), newName);
        return processDefinitionRepository.save(definition);
    }

    @Transactional
    public ProcessDefinition duplicate(Long sourceId, String targetCode, String targetName) {
        ProcessDefinition source = findById(sourceId);
        if (processDefinitionRepository.findByCode(targetCode).isPresent()) {
            throw new RuntimeException("流程编码已存在: " + targetCode);
        }
        ProcessDefinition copy = new ProcessDefinition();
        copy.setCode(targetCode);
        copy.setName(targetName != null ? targetName : targetCode);
        copy.setCanvasData(source.getCanvasData());
        copy.setNodeConfigs(source.getNodeConfigs());
        copy.setStatus(ProcessStatus.DRAFT);
        ProcessDefinition saved = processDefinitionRepository.save(copy);
        log.info("流程 [{}] 已复制为 [{}]", source.getCode(), saved.getCode());
        return saved;
    }
}
