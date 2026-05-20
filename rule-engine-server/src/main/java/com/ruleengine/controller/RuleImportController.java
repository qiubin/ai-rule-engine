package com.ruleengine.controller;

import com.ruleengine.domain.Rule;
import com.ruleengine.dto.RuleImportPreview;
import com.ruleengine.service.RuleImportService;
import com.ruleengine.service.RuleExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * 规则批量导入/导出控制器
 * 支持上传质控指标 Excel 自动生成规则画布，以及导出规则列表
 */
@RestController
@RequestMapping("/api/v1/rules")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class RuleImportController {

    private final RuleImportService ruleImportService;
    private final RuleExportService ruleExportService;

    /**
     * 从 Excel 导入规则（一键导入，兼容旧方式）
     */
    @PostMapping("/import")
    public ResponseEntity<List<Rule>> importRules(
            @RequestParam("file") MultipartFile file,
            @RequestParam("ruleTypeId") Long ruleTypeId,
            @RequestParam(value = "maxCount", required = false) Integer maxCount) throws IOException {
        List<Rule> rules = ruleImportService.importFromExcel(file, ruleTypeId, maxCount);
        return ResponseEntity.ok(rules);
    }

    /**
     * 导入预览：上传文件后返回匹配到的规则列表（不保存）
     */
    @PostMapping("/import-preview")
    public ResponseEntity<List<RuleImportPreview>> importPreview(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "maxCount", required = false) Integer maxCount) throws IOException {
        List<RuleImportPreview> previews = ruleImportService.previewFromExcel(file, maxCount);
        return ResponseEntity.ok(previews);
    }

    /**
     * 确认导入：传入预览列表和选中的 code，保存规则
     */
    @PostMapping("/import-confirm")
    public ResponseEntity<List<Rule>> importConfirm(
            @RequestBody ImportConfirmRequest request) {
        List<Rule> rules = ruleImportService.confirmImport(
                request.getPreviews(), request.getSelectedCodes(), request.getRuleTypeId());
        return ResponseEntity.ok(rules);
    }

    /**
     * 导出规则列表为 Excel（按规则类型）
     */
    @GetMapping("/export")
    public ResponseEntity<byte[]> exportRules(
            @RequestParam(required = false) Long ruleTypeId,
            @RequestParam(required = false) String ruleTypeIds) throws IOException {
        List<Long> ids = new ArrayList<>();
        if (ruleTypeIds != null && !ruleTypeIds.trim().isEmpty()) {
            for (String s : ruleTypeIds.split(",")) {
                try { ids.add(Long.parseLong(s.trim())); } catch (NumberFormatException ignored) {}
            }
        }
        if (ruleTypeId != null) {
            ids.add(ruleTypeId);
        }
        if (ids.isEmpty()) {
            throw new RuntimeException("请指定规则类型");
        }
        byte[] bytes = ruleExportService.exportToExcel(ids);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=rules-export.xlsx")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(bytes);
    }

    /**
     * 导出选中的规则为 Excel
     */
    @PostMapping("/export")
    public ResponseEntity<byte[]> exportSelectedRules(@RequestBody List<Long> ruleIds) throws IOException {
        if (ruleIds == null || ruleIds.isEmpty()) {
            throw new RuntimeException("请选择要导出的规则");
        }
        byte[] bytes = ruleExportService.exportByIds(ruleIds);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=rules-export.xlsx")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(bytes);
    }
}
