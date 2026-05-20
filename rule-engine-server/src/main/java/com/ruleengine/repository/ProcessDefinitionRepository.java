package com.ruleengine.repository;

import com.ruleengine.domain.ProcessDefinition;
import com.ruleengine.domain.enums.ProcessStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProcessDefinitionRepository extends JpaRepository<ProcessDefinition, Long> {
    Optional<ProcessDefinition> findByCode(String code);
    List<ProcessDefinition> findByStatus(ProcessStatus status);
    List<ProcessDefinition> findByDeletedFalse();
    List<ProcessDefinition> findByDeletedFalseAndStatus(ProcessStatus status);
    long countByDeletedFalse();
}
