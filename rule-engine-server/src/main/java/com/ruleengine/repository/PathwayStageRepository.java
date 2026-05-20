package com.ruleengine.repository;

import com.ruleengine.domain.PathwayStage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PathwayStageRepository extends JpaRepository<PathwayStage, Long> {
    List<PathwayStage> findByPathwayId(Long pathwayId);
    List<PathwayStage> findByPathwayIdOrderBySortOrderAsc(Long pathwayId);
}
