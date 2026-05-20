package com.ruleengine.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ruleengine.domain.ProcessInstance;
import com.ruleengine.domain.enums.ProcessInstanceStatus;
import com.ruleengine.process.engine.ProcessExecutionEngine;
import com.ruleengine.repository.ProcessInstanceRepository;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProcessInstanceService {

    private final ProcessInstanceRepository processInstanceRepository;
    private final ProcessExecutionEngine processExecutionEngine;
    private final ObjectMapper objectMapper;

    public List<ProcessInstance> findAll() {
        return processInstanceRepository.findAll();
    }

    public List<ProcessInstance> findByProcessDefId(Long processDefId) {
        return processInstanceRepository.findByProcessDefId(processDefId);
    }

    public List<ProcessInstance> findByStatus(ProcessInstanceStatus status) {
        return processInstanceRepository.findByStatus(status);
    }

    public ProcessInstance findById(Long id) {
        return processInstanceRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("流程实例不存在: " + id));
    }

    @Transactional
    public ProcessInstance start(String processCode, String businessKey,
                                  Map<String, Object> variables) {
        return processExecutionEngine.startProcess(processCode, businessKey, variables);
    }

    @Transactional
    public Map<String, Object> executeSync(String processCode,
                                            Map<String, Object> variables) {
        return processExecutionEngine.executeSync(processCode, variables);
    }

    @Transactional
    public void resume(Long instanceId, Map<String, Object> variables) {
        processExecutionEngine.resumeInstance(instanceId, variables);
    }

    @Transactional
    public void terminate(Long instanceId) {
        processExecutionEngine.terminateInstance(instanceId);
    }

    @SneakyThrows
    @Transactional
    public ProcessInstance updateVariables(Long instanceId, Map<String, Object> variables) {
        ProcessInstance instance = findById(instanceId);
        Map<String, Object> existingVars = parseJson(instance.getVariables());
        existingVars.putAll(variables);
        instance.setVariables(objectMapper.writeValueAsString(existingVars));
        return processInstanceRepository.save(instance);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJson(String json) {
        if (json == null || json.isEmpty()) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            return new HashMap<>();
        }
    }
}
