package com.ruleengine.controller;

import com.ruleengine.domain.ClinicalPathway;
import com.ruleengine.domain.PathwayStage;
import com.ruleengine.domain.PathwayTask;
import com.ruleengine.dto.ClinicalContext;
import com.ruleengine.dto.DecisionResponse;
import com.ruleengine.service.ClinicalPathwayService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/pathways")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ClinicalPathwayController {

    private final ClinicalPathwayService clinicalPathwayService;

    @GetMapping
    public ResponseEntity<List<ClinicalPathway>> list() {
        return ResponseEntity.ok(clinicalPathwayService.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClinicalPathway> getById(@PathVariable Long id) {
        return ResponseEntity.ok(clinicalPathwayService.findById(id));
    }

    @GetMapping("/{id}/full")
    public ResponseEntity<Map<String, Object>> getFullPathway(@PathVariable Long id) {
        return ResponseEntity.ok(clinicalPathwayService.findFullPathway(id));
    }

    @PostMapping
    public ResponseEntity<ClinicalPathway> create(@RequestBody ClinicalPathway pathway) {
        return ResponseEntity.ok(clinicalPathwayService.save(pathway));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ClinicalPathway> update(@PathVariable Long id, @RequestBody ClinicalPathway pathway) {
        return ResponseEntity.ok(clinicalPathwayService.update(id, pathway));
    }

    @PostMapping("/{id}/publish")
    public ResponseEntity<ClinicalPathway> publish(@PathVariable Long id) {
        return ResponseEntity.ok(clinicalPathwayService.publish(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ClinicalPathway> delete(@PathVariable Long id) {
        return ResponseEntity.ok(clinicalPathwayService.deleteById(id));
    }

    @PostMapping("/{id}/stages")
    public ResponseEntity<List<PathwayStage>> saveStages(
            @PathVariable Long id,
            @RequestBody List<PathwayStage> stages) {
        return ResponseEntity.ok(clinicalPathwayService.saveStages(id, stages));
    }

    @PostMapping("/{id}/tasks")
    public ResponseEntity<List<PathwayTask>> saveTasks(
            @PathVariable Long id,
            @RequestBody List<PathwayTask> tasks) {
        return ResponseEntity.ok(clinicalPathwayService.saveTasks(id, tasks));
    }

    /**
     * 执行决策路径（串联 ClinicalContext → DecisionPathEngine → DecisionResponse）
     */
    @PostMapping("/{id}/execute")
    public ResponseEntity<DecisionResponse> execute(
            @PathVariable Long id,
            @RequestBody ClinicalContext context) {
        return ResponseEntity.ok(clinicalPathwayService.executeDecisionPath(id, context));
    }

    /**
     * 查询已发布的路径列表（供测试界面选择）
     */
    @GetMapping("/published")
    public ResponseEntity<List<ClinicalPathway>> listPublished() {
        return ResponseEntity.ok(clinicalPathwayService.findAllPublished());
    }
}
