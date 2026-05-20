package com.ruleengine.repository;

import com.ruleengine.domain.ProcessInstance;
import com.ruleengine.domain.enums.ProcessInstanceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProcessInstanceRepository extends JpaRepository<ProcessInstance, Long> {
    List<ProcessInstance> findByProcessDefId(Long processDefId);
    List<ProcessInstance> findByStatus(ProcessInstanceStatus status);
    List<ProcessInstance> findByBusinessKey(String businessKey);
    List<ProcessInstance> findByProcessDefIdAndStatus(Long processDefId, ProcessInstanceStatus status);
}
