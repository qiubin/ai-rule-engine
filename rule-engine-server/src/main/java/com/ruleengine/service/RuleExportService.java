package com.ruleengine.service;

import com.alibaba.excel.EasyExcel;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ruleengine.domain.Rule;
import com.ruleengine.dto.RuleExportRow;
import com.ruleengine.repository.RuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * 规则批量导出服务：将规则列表导出为 Excel
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RuleExportService {

    private final RuleRepository ruleRepository;
    private final ObjectMapper objectMapper;

    /**
     * 导出指定规则类型下的所有规则为 Excel
     * @param ruleTypeIds 规则类型ID列表（含子类型）
     * @return Excel 文件字节数组
     */
    public byte[] exportToExcel(List<Long> ruleTypeIds) throws IOException {
        List<Rule> rules = ruleRepository.findByRuleTypeIdIn(ruleTypeIds);
        List<RuleExportRow> rows = new ArrayList<>();

        for (Rule rule : rules) {
            if (Boolean.TRUE.equals(rule.getDeleted())) {
                continue;
            }
            String statusLabel;
            switch (rule.getStatus()) {
                case PUBLISHED: statusLabel = "已发布"; break;
                case DISABLED: statusLabel = "已停用"; break;
                default: statusLabel = "草稿"; break;
            }

            // 尝试从画布解析条件信息
            String condField = "";
            String condOperator = "";
            String condValue = "";
            if (rule.getCanvasData() != null && !rule.getCanvasData().isEmpty()) {
                try {
                    JsonNode canvas = objectMapper.readTree(rule.getCanvasData());
                    JsonNode nodes = canvas.get("nodes");
                    if (nodes != null && nodes.isArray()) {
                        for (JsonNode node : nodes) {
                            if ("condition".equals(node.path("type").asText(""))) {
                                JsonNode cfg = node.path("data").path("conditionConfig");
                                if (!cfg.isMissingNode()) {
                                    condField = cfg.path("field").asText("");
                                    condOperator = cfg.path("operator").asText("");
                                    condValue = cfg.path("value").asText("");
                                    break; // 只取第一个条件节点
                                }
                            }
                        }
                    }
                } catch (Exception e) {
                    log.warn("解析规则 [{}] 画布失败: {}", rule.getCode(), e.getMessage());
                }
            }

            rows.add(new RuleExportRow(
                rule.getCode(),
                rule.getName(),
                statusLabel,
                rule.getRemark() != null ? rule.getRemark() : "",
                condField,
                condOperator,
                condValue,
                rule.getCanvasData() != null ? rule.getCanvasData() : ""
            ));
        }

        return writeExcel(rows);
    }

    /**
     * 根据规则ID列表导出选中的规则
     */
    public byte[] exportByIds(List<Long> ruleIds) throws IOException {
        List<Rule> rules = ruleRepository.findAllById(ruleIds);
        List<RuleExportRow> rows = new ArrayList<>();
        for (Rule rule : rules) {
            if (Boolean.TRUE.equals(rule.getDeleted())) continue;
            rows.add(convertToRow(rule));
        }
        return writeExcel(rows);
    }

    private RuleExportRow convertToRow(Rule rule) {
        String statusLabel;
        switch (rule.getStatus()) {
            case PUBLISHED: statusLabel = "已发布"; break;
            case DISABLED: statusLabel = "已停用"; break;
            default: statusLabel = "草稿"; break;
        }

        String condField = "";
        String condOperator = "";
        String condValue = "";
        if (rule.getCanvasData() != null && !rule.getCanvasData().isEmpty()) {
            try {
                JsonNode canvas = objectMapper.readTree(rule.getCanvasData());
                JsonNode nodes = canvas.get("nodes");
                if (nodes != null && nodes.isArray()) {
                    for (JsonNode node : nodes) {
                        if ("condition".equals(node.path("type").asText(""))) {
                            JsonNode cfg = node.path("data").path("conditionConfig");
                            if (!cfg.isMissingNode()) {
                                condField = cfg.path("field").asText("");
                                condOperator = cfg.path("operator").asText("");
                                condValue = cfg.path("value").asText("");
                                break;
                            }
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("解析规则 [{}] 画布失败: {}", rule.getCode(), e.getMessage());
            }
        }

        return new RuleExportRow(
            rule.getCode(),
            rule.getName(),
            statusLabel,
            rule.getRemark() != null ? rule.getRemark() : "",
            condField,
            condOperator,
            condValue,
            rule.getCanvasData() != null ? rule.getCanvasData() : ""
        );
    }

    private byte[] writeExcel(List<RuleExportRow> rows) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        EasyExcel.write(out, RuleExportRow.class)
            .sheet("规则列表")
            .doWrite(rows);
        return out.toByteArray();
    }
}
