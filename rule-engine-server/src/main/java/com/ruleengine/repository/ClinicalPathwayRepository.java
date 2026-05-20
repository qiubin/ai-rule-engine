package com.ruleengine.repository;

import com.ruleengine.domain.ClinicalPathway;
import com.ruleengine.domain.enums.PathwayStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClinicalPathwayRepository extends JpaRepository<ClinicalPathway, Long> {
    Optional<ClinicalPathway> findByCode(String code);
    List<ClinicalPathway> findByStatus(PathwayStatus status);
    List<ClinicalPathway> findByDeletedFalse();
    List<ClinicalPathway> findByDeletedFalseAndStatus(PathwayStatus status);
}
