package com.ruleengine.service;

import com.alibaba.excel.EasyExcel;
import com.alibaba.excel.context.AnalysisContext;
import com.alibaba.excel.read.listener.ReadListener;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ruleengine.domain.Rule;
import com.ruleengine.domain.enums.RuleStatus;
import com.ruleengine.dto.RuleImportPreview;
import com.ruleengine.dto.RuleImportRow;
import com.ruleengine.repository.RuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;

/**
 * 规则批量导入服务：读取质控指标 Excel，按模板匹配自动生成规则画布
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RuleImportService {

    private final RuleRepository ruleRepository;
    private final ObjectMapper objectMapper;

    /**
     * 规则模板映射表：将质控指标映射为系统可实现的规则
     * (关键词匹配, 字段, 操作符, 值, extra1, extra2, 规则名称)
     */
    private static final List<RuleTemplate> RULE_TEMPLATES = Arrays.asList(
        new RuleTemplate("持续时间", "主诉", "regex_match", ".*[时月周天年日].*", "", "", "主诉无持续时间描述"),
        new RuleTemplate("现病史.*空|缺现病史", "现病史", "isBlank", "", "", "", "缺现病史"),
        new RuleTemplate("体格检查.*空", "体格检查", "isBlank", "", "", "", "体格检查为空"),
        new RuleTemplate("辅助检查.*时间", "辅助检查", "regex_match", ".*(\\d{4}[-._]\\d{1,2}[-._]\\d{1,2}|年.*月.*日|\\d{1,4}[-._]\\d{1,2}).*", "", "", "辅助检查缺时间描述"),
        new RuleTemplate("诊断依据.*空|诊断依据.*缺陷", "诊断依据", "isBlank", "", "", "", "首次病程诊断依据为空"),
        new RuleTemplate("诊疗计划.*空|诊疗计划.*缺陷", "诊疗计划", "isBlank", "", "", "", "诊疗计划为空"),
        new RuleTemplate("输血.*效果", "输血效果及后续记录", "isBlank", "", "", "", "输血记录缺输血效果记录"),
        new RuleTemplate("一般情况|二便|精神|饮食|睡眠", "现病史", "regex_match", ".*(二便|一般状况|精神|饮食|睡眠|大便|小便|脉搏|呼吸|体温|未诉不适|一般情况|生命体征|神志).*", "", "", "现病史缺一般情况描述"),
        new RuleTemplate("阴性体征.*小于|阴性体征.*不足|阴性体征.*少于", "NEGATIVE_SIGNS", "arrayLength", "<", "5", "", "阴性体征数量不足"),
        new RuleTemplate("症状.*不一致|主诉.*现病史.*不一致", "主诉阳性症状", "arrayIntersect", "现病史阳性症状", "==", "0", "主诉与现病史症状不一致"),
        new RuleTemplate("起病时间", "现病史", "regex_match", ".*(\\d{4}[-_]\\d{1,2}[-_]\\d{1,2}|入院前.*[天小时周年月分钟]|患者\\d{4}|患者，年|患者，月|患者，日|患者，天).*", "", "", "现病史起病时间描述不准确"),
        new RuleTemplate("发病诱因", "现病史", "regex_match", ".*(予以|给|行|治疗|口服|注射|检查|服用|体检|未予.*处理|心电图|B超|彩超|CT|核磁|MR|造影|体检.*发现|检查.*发现|未.*治疗|未.*诊疗|未.*诊治|就诊.*当地|就诊.*院|当地.*就诊|院.*就诊|就医|治疗|诊疗|诊治).*", "", "", "现病史发病诱因描述不清"),
        new RuleTemplate("症状性质", "现病史", "regex_match", ".*(时|程度|性质|部位|颜色|诱因|表现|状态).*", "", "", "现病史缺症状性质描述"),
        new RuleTemplate("症状程度", "现病史", "regex_match", ".*(程度|性质|范围|发作频率|发热|呼吸困难|咳嗽|咳痰|水肿|轻度|重度|中度).*", "", "", "现病史缺症状程度描述"),
        new RuleTemplate("鉴别诊断.*阴性", "NEGATIVE_SIGNS", "arrayLength", "<", "5", "", "缺有鉴别诊断意义的阴性体征"),
        new RuleTemplate("疾病发展变化", "现病史", "regex_match", ".*(量|质|范围|诱发|缓解因素|出现|消失|新增|加重|缓解|影响变化).*", "", "", "现病史缺疾病发展变化描述"),
        new RuleTemplate("发病后诊治", "现病史", "regex_match", ".*(进一步|当地医院|至|就诊|我院|上级医院|至本院|未系统诊治|自行口服).*", "", "", "现病史缺发病后诊治情况描述"),
        new RuleTemplate("伴随病情|伴随症状", "POSITIVE_SYMPTOMS", "arrayLength", "==", "0", "", "缺伴随病情症状与体征描述"),
        new RuleTemplate("外院检查.*医院", "辅助检查", "regex_match", ".*(医院|实验室|中心|院|所|科).*", "", "", "外院检查未注明医院名称"),
        new RuleTemplate("检查.*结果|辅助检查.*结果", "辅助检查", "regex_match", ".*[考虑可能：:\\(（结果示].*", "", "", "辅助检查缺主要检查结果"),
        new RuleTemplate("首次病程.*拷贝|病程.*雷同|相似度", "首次病程", "similarity", "首次病程2", "0.995", "", "首次病程记录涉嫌拷贝"),
        new RuleTemplate("病程.*相似度|雷同", "当日病程", "similarity", "既往病程", "0.99", "", "二次以上病程记录完全相同"),
        new RuleTemplate("病危.*告知|危重.*家属", "病程记录", "regex_match", ".*[告知报明].*[危重患者家属].*", "", "", "危重患者未记录告知情况"),
        new RuleTemplate("术后.*注意事项", "术后首次病程", "isBlank", "", "", "", "术后注意事项未记录"),
        new RuleTemplate("查房.*补充|查房.*新发现", "查房记录", "regex_match", ".*(追问病史|无补充|确认病史|查体|无新发现|补充诊断|确定诊断|询问病史|病史无补充).*", "", "", "查房记录无补充查体新发现"),
        new RuleTemplate("疑难.*主持人", "主持人小结", "lengthCheck", "<", "10", "", "疑难病例讨论无主持人小结"),
        new RuleTemplate("病情摘要", "病情摘要", "lengthCheck", "<", "30", "", "疑难病例讨论无病情摘要"),
        new RuleTemplate("交班.*接班.*雷同", "交班记录", "similarity", "接班记录", "0.99", "", "交班与接班记录雷同"),
        new RuleTemplate("转出.*转入.*雷同", "转出记录", "similarity", "转入记录", "0.99", "", "转出和转入记录雷同"),
        new RuleTemplate("危急值.*报告时间", "危急值记录", "regex_match", ".*\\d{4}[-._]\\d{1,2}[-._]\\d{1,2}.*|.*年.*月.*日.*|.*\\d{1,2}:\\d{1,2}.*", "", "", "危急值记录无报告时间"),
        new RuleTemplate("术前讨论.*姓名|术前讨论.*职务", "术前讨论记录", "regex_match", ".*姓名.*职务.*|.*职务.*姓名.*", "", "", "术前讨论记录人员信息不全"),
        new RuleTemplate("意外.*防范", "手术知情同意书", "isBlank", "", "", "", "术前讨论缺意外及防范措施")
    );

    private static class RuleTemplate {
        final String keywords;
        final String field;
        final String operator;
        final String value;
        final String extra1;
        final String extra2;
        final String name;

        RuleTemplate(String keywords, String field, String operator, String value,
                       String extra1, String extra2, String name) {
            this.keywords = keywords;
            this.field = field;
            this.operator = operator;
            this.value = value;
            this.extra1 = extra1;
            this.extra2 = extra2;
            this.name = name;
        }
    }

    @Transactional
    public List<Rule> importFromExcel(MultipartFile file, Long ruleTypeId, Integer maxCount) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new RuntimeException("上传文件为空");
        }

        List<RuleImportRow> rows = new ArrayList<>();
        EasyExcel.read(file.getInputStream(), RuleImportRow.class, new ReadListener<RuleImportRow>() {
            @Override
            public void invoke(RuleImportRow data, AnalysisContext context) {
                if (data.getIndicator() != null && !data.getIndicator().trim().isEmpty()
                    && data.getMethod() != null && !data.getMethod().trim().isEmpty()
                    && !"nan".equalsIgnoreCase(data.getMethod().trim())) {
                    rows.add(data);
                }
            }
            @Override
            public void doAfterAllAnalysed(AnalysisContext context) {}
        }).sheet().doRead();

        log.info("读取到 {} 条质控指标", rows.size());

        int count = maxCount != null && maxCount > 0 ? maxCount : Integer.MAX_VALUE;
        List<Rule> generated = new ArrayList<>();
        Set<Integer> usedIndices = new HashSet<>();
        int ruleIdx = 1;

        for (RuleTemplate template : RULE_TEMPLATES) {
            if (ruleIdx > count) break;

            for (int i = 0; i < rows.size(); i++) {
                if (usedIndices.contains(i)) continue;

                RuleImportRow row = rows.get(i);
                String indicator = row.getIndicator();
                String method = row.getMethod();

                boolean matched = false;
                for (String kw : template.keywords.split("\\|")) {
                    if (indicator.contains(kw) || method.contains(kw)) {
                        matched = true;
                        break;
                    }
                }

                if (matched) {
                    String code = String.format("MR_QC_%03d", ruleIdx);
                    // 检查 code 是否已存在
                    if (ruleRepository.findByCode(code).isPresent()) {
                        // 寻找下一个可用序号
                        int suffix = ruleIdx;
                        while (ruleRepository.findByCode(String.format("MR_QC_%03d", suffix)).isPresent()) {
                            suffix++;
                        }
                        code = String.format("MR_QC_%03d", suffix);
                    }

                    String canvasJson = buildCanvasJson(code, template.field, template.operator,
                                                        template.value, template.extra1, template.extra2);

                    Rule rule = new Rule();
                    rule.setCode(code);
                    rule.setName(template.name);
                    rule.setRuleTypeId(ruleTypeId);
                    rule.setStatus(RuleStatus.DRAFT);
                    rule.setVersion("1.0.0");
                    rule.setCanvasData(canvasJson);
                    rule.setDeleted(false);

                    ruleRepository.save(rule);
                    generated.add(rule);

                    usedIndices.add(i);
                    ruleIdx++;
                    break;
                }
            }
        }

        log.info("成功生成 {} 条规则", generated.size());
        return generated;
    }

    /**
     * 预览：解析 Excel 返回匹配到的规则列表（不保存到数据库）
     */
    public List<RuleImportPreview> previewFromExcel(MultipartFile file, Integer maxCount) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new RuntimeException("上传文件为空");
        }

        List<RuleImportRow> rows = new ArrayList<>();
        EasyExcel.read(file.getInputStream(), RuleImportRow.class, new ReadListener<RuleImportRow>() {
            @Override
            public void invoke(RuleImportRow data, AnalysisContext context) {
                if (data.getIndicator() != null && !data.getIndicator().trim().isEmpty()
                    && data.getMethod() != null && !data.getMethod().trim().isEmpty()
                    && !"nan".equalsIgnoreCase(data.getMethod().trim())) {
                    rows.add(data);
                }
            }
            @Override
            public void doAfterAllAnalysed(AnalysisContext context) {}
        }).sheet().doRead();

        int count = maxCount != null && maxCount > 0 ? maxCount : Integer.MAX_VALUE;
        List<RuleImportPreview> previews = new ArrayList<>();
        Set<Integer> usedIndices = new HashSet<>();
        int ruleIdx = 1;

        for (RuleTemplate template : RULE_TEMPLATES) {
            if (ruleIdx > count) break;
            for (int i = 0; i < rows.size(); i++) {
                if (usedIndices.contains(i)) continue;
                RuleImportRow row = rows.get(i);
                boolean matched = false;
                for (String kw : template.keywords.split("\\|")) {
                    if (row.getIndicator().contains(kw) || row.getMethod().contains(kw)) {
                        matched = true;
                        break;
                    }
                }
                if (matched) {
                    String code = String.format("MR_QC_%03d", ruleIdx);
                    String canvasJson = buildCanvasJson(code, template.field, template.operator,
                                                        template.value, template.extra1, template.extra2);
                    previews.add(new RuleImportPreview(
                        code, template.name, template.field, template.operator,
                        template.value, canvasJson, row.getIndicator(), row.getMethod()
                    ));
                    usedIndices.add(i);
                    ruleIdx++;
                    break;
                }
            }
        }
        return previews;
    }

    /**
     * 确认导入：根据预览列表和选中的 code 保存规则
     */
    @Transactional
    public List<Rule> confirmImport(List<RuleImportPreview> previews, List<String> selectedCodes,
                                     Long ruleTypeId) {
        List<Rule> saved = new ArrayList<>();
        int suffix = 1;
        for (RuleImportPreview preview : previews) {
            if (!selectedCodes.contains(preview.getCode())) continue;

            // 生成唯一 code
            String code = preview.getCode();
            while (ruleRepository.findByCode(code).isPresent()) {
                code = preview.getCode() + "_" + suffix;
                suffix++;
            }

            Rule rule = new Rule();
            rule.setCode(code);
            rule.setName(preview.getName());
            rule.setRuleTypeId(ruleTypeId);
            rule.setStatus(RuleStatus.DRAFT);
            rule.setVersion("1.0.0");
            rule.setCanvasData(preview.getCanvasJson());
            rule.setDeleted(false);

            ruleRepository.save(rule);
            saved.add(rule);
        }
        return saved;
    }

    private String buildCanvasJson(String ruleName, String field, String operator,
                                    String value, String extraValue1, String extraValue2) {
        String condId = "cond-" + ruleName;
        String resPassId = "res-pass-" + ruleName;
        String resFailId = "res-fail-" + ruleName;
        String startId = "start";

        Map<String, Object> conditionConfig = new LinkedHashMap<>();
        conditionConfig.put("field", field);
        conditionConfig.put("operator", operator);
        conditionConfig.put("value", value);
        conditionConfig.put("valueSource", "PARAM");
        if (extraValue1 != null && !extraValue1.isEmpty()) {
            conditionConfig.put("extraValue1", extraValue1);
        }
        if (extraValue2 != null && !extraValue2.isEmpty()) {
            conditionConfig.put("extraValue2", extraValue2);
        }

        List<Map<String, Object>> nodes = new ArrayList<>();
        nodes.add(createNode(startId, "start", 100, 200, "开始", null));
        nodes.add(createNode(condId, "condition", 300, 200, ruleName, conditionConfig));
        Map<String, Object> passConfig = new LinkedHashMap<>();
        passConfig.put("resultType", "MESSAGE");
        passConfig.put("resultValue", ruleName + ": 通过");
        nodes.add(createNode(resPassId, "result", 600, 150, "通过", passConfig));
        Map<String, Object> failConfig = new LinkedHashMap<>();
        failConfig.put("resultType", "WARNING");
        failConfig.put("resultValue", ruleName + ": " + ruleName);
        nodes.add(createNode(resFailId, "result", 600, 250, "质控不通过", failConfig));

        List<Map<String, Object>> edges = new ArrayList<>();
        edges.add(createEdge("e-" + ruleName + "-1", startId, condId, null, null));
        edges.add(createEdge("e-" + ruleName + "-2", condId, resPassId, "true", "是"));
        edges.add(createEdge("e-" + ruleName + "-3", condId, resFailId, "false", "否"));

        Map<String, Object> canvas = new LinkedHashMap<>();
        canvas.put("nodes", nodes);
        canvas.put("edges", edges);

        try {
            return objectMapper.writeValueAsString(canvas);
        } catch (Exception e) {
            log.error("画布JSON序列化失败", e);
            return "{}";
        }
    }

    private Map<String, Object> createNode(String id, String type, int x, int y,
                                            String label, Map<String, Object> config) {
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("id", id);
        node.put("type", type);
        Map<String, Object> position = new LinkedHashMap<>();
        position.put("x", x);
        position.put("y", y);
        node.put("position", position);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("label", label);
        if (config != null) {
            if ("condition".equals(type)) {
                data.put("conditionConfig", config);
            } else if ("result".equals(type)) {
                data.put("resultConfig", config);
            }
        }
        node.put("data", data);
        return node;
    }

    private Map<String, Object> createEdge(String id, String source, String target,
                                            String sourceHandle, String label) {
        Map<String, Object> edge = new LinkedHashMap<>();
        edge.put("id", id);
        edge.put("source", source);
        edge.put("target", target);
        if (sourceHandle != null) {
            edge.put("sourceHandle", sourceHandle);
        }
        if (label != null) {
            edge.put("label", label);
        }
        return edge;
    }
}
