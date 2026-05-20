package com.ruleengine.repository;

import com.ruleengine.domain.PathwayInstance;
import com.ruleengine.domain.enums.PathwayInstanceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PathwayInstanceRepository extends JpaRepository<PathwayInstance, Long> {
    List<PathwayInstance> findByPathwayId(Long pathwayId);
    List<PathwayInstance> findByPatientId(String patientId);
    List<PathwayInstance> findByStatus(PathwayInstanceStatus status);
    Optional<PathwayInstance> findByBusinessKey(String businessKey);
    List<PathwayInstance> findByPathwayIdAndStatus(Long pathwayId, PathwayInstanceStatus status);
}
