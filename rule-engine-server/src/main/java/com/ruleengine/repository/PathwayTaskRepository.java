package com.ruleengine.repository;

import com.ruleengine.domain.PathwayTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PathwayTaskRepository extends JpaRepository<PathwayTask, Long> {
    List<PathwayTask> findByStageId(Long stageId);
    List<PathwayTask> findByStageIdOrderBySortOrderAsc(Long stageId);
}
