package com.ruleengine.controller;

import com.ruleengine.domain.ProcessDefinition;
import com.ruleengine.domain.ProcessInstance;
import com.ruleengine.service.ProcessDefinitionService;
import com.ruleengine.service.ProcessInstanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/processes")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ProcessController {

    private final ProcessDefinitionService processDefinitionService;
    private final ProcessInstanceService processInstanceService;

    // --- 流程定义 CRUD ---

    @GetMapping
    public ResponseEntity<List<ProcessDefinition>> list() {
        return ResponseEntity.ok(processDefinitionService.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProcessDefinition> getById(@PathVariable Long id) {
        return ResponseEntity.ok(processDefinitionService.findById(id));
    }

    @PostMapping
    public ResponseEntity<ProcessDefinition> create(@RequestBody Map<String, Object> body) {
        String code = (String) body.getOrDefault("code", body.get("id"));
        String name = (String) body.getOrDefault("name", code);
        ProcessDefinition definition = new ProcessDefinition();
        definition.setCode(code != null ? code : "pipeline_" + System.currentTimeMillis());
        definition.setName(name != null ? name : definition.getCode());
        return ResponseEntity.ok(processDefinitionService.save(definition));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProcessDefinition> update(@PathVariable Long id, @RequestBody ProcessDefinition definition) {
        return ResponseEntity.ok(processDefinitionService.update(id, definition));
    }

    @PutMapping("/{id}/canvas")
    public ResponseEntity<ProcessDefinition> saveCanvas(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(processDefinitionService.saveCanvas(id, body.get("canvasData"), body.get("nodeConfigs")));
    }

    @PostMapping("/{id}/publish")
    public ResponseEntity<ProcessDefinition> publish(@PathVariable Long id) {
        return ResponseEntity.ok(processDefinitionService.publish(id));
    }

    @PostMapping("/{id}/withdraw")
    public ResponseEntity<ProcessDefinition> withdraw(@PathVariable Long id) {
        return ResponseEntity.ok(processDefinitionService.withdraw(id));
    }

    @PostMapping("/{id}/disable")
    public ResponseEntity<ProcessDefinition> disable(@PathVariable Long id) {
        return ResponseEntity.ok(processDefinitionService.disable(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ProcessDefinition> delete(@PathVariable Long id) {
        return ResponseEntity.ok(processDefinitionService.deleteById(id));
    }

    @PostMapping("/{id}/rename")
    public ResponseEntity<ProcessDefinition> rename(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(processDefinitionService.rename(id, body.get("name")));
    }

    @PostMapping("/duplicate")
    public ResponseEntity<ProcessDefinition> duplicate(@RequestBody Map<String, Object> body) {
        Long sourceId = Long.valueOf(body.get("source_id").toString());
        String targetCode = (String) body.get("target_id");
        String targetName = (String) body.get("name");
        return ResponseEntity.ok(processDefinitionService.duplicate(sourceId, targetCode, targetName));
    }

    // --- 流程实例 ---

    @GetMapping("/instances")
    public ResponseEntity<List<ProcessInstance>> listInstances() {
        return ResponseEntity.ok(processInstanceService.findAll());
    }

    @GetMapping("/instances/{id}")
    public ResponseEntity<ProcessInstance> getInstance(@PathVariable Long id) {
        return ResponseEntity.ok(processInstanceService.findById(id));
    }

    @PostMapping("/{code}/start")
    public ResponseEntity<ProcessInstance> start(@PathVariable String code, @RequestBody Map<String, Object> body) {
        String businessKey = body != null ? (String) body.get("businessKey") : null;
        @SuppressWarnings("unchecked")
        Map<String, Object> variables = body != null ? (Map<String, Object>) body.get("variables") : null;
        return ResponseEntity.ok(processInstanceService.start(code, businessKey, variables));
    }

    @PostMapping("/{code}/execute")
    public ResponseEntity<Map<String, Object>> execute(@PathVariable String code, @RequestBody Map<String, Object> variables) {
        return ResponseEntity.ok(processInstanceService.executeSync(code, variables));
    }

    @PostMapping("/instances/{id}/resume")
    public ResponseEntity<Void> resume(@PathVariable Long id, @RequestBody Map<String, Object> variables) {
        processInstanceService.resume(id, variables);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/instances/{id}/terminate")
    public ResponseEntity<Void> terminate(@PathVariable Long id) {
        processInstanceService.terminate(id);
        return ResponseEntity.ok().build();
    }
}
