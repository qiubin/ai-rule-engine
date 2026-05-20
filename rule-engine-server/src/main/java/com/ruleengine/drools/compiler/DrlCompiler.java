package com.ruleengine.drools.compiler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
@RequiredArgsConstructor
public class DrlCompiler {

    private final ObjectMapper objectMapper;

    private static final String DRL_TEMPLATE =
            "package rules.%s;\n" +
            "import java.util.Map;\n" +
            "import java.util.HashMap;\n" +
            "import com.ruleengine.script.RuleScriptUtils;\n" +
            "import com.ruleengine.script.DictScriptService;\n" +
            "global java.util.Map result\n" +
            "global com.ruleengine.script.DictScriptService dictUtils\n" +
            "\n" +
            "%s\n";

    @SneakyThrows
    public String compile(String ruleCode, JsonNode canvasData) {
        ArrayNode nodes = (ArrayNode) canvasData.get("nodes");
        ArrayNode edges = (ArrayNode) canvasData.get("edges");

        if (nodes == null || nodes.isEmpty()) {
            return "";
        }

        Map<String, JsonNode> nodeMap = new HashMap<>();
        Map<String, List<JsonNode>> adjacency = new HashMap<>();
        Map<String, List<JsonNode>> reverseAdjacency = new HashMap<>();
        
        for (JsonNode node : nodes) {
            String id = node.get("id").asText();
            nodeMap.put(id, node);
            adjacency.put(id, new ArrayList<>());
            reverseAdjacency.put(id, new ArrayList<>());
        }
        
        if (edges != null) {
            for (JsonNode edge : edges) {
                String source = edge.get("source").asText();
                String target = edge.get("target").asText();
                adjacency.computeIfAbsent(source, k -> new ArrayList<>()).add(edge);
                reverseAdjacency.computeIfAbsent(target, k -> new ArrayList<>()).add(edge);
            }
        }

        // 预计算 and/or 节点的上游条件组合
        Map<String, String> gateConditions = new HashMap<>();
        for (JsonNode node : nodes) {
            String type = node.get("type").asText();
            if ("and".equals(type) || "or".equals(type)) {
                String nodeId = node.get("id").asText();
                String separator = "and".equals(type) ? " && " : " || ";
                String combined = combineUpstreamConditions(nodeId, nodeMap, reverseAdjacency, separator, new HashSet<>());
                // OR 节点条件需要加括号，避免与下游 && 产生优先级错误（A || B && C 会被解析为 A || (B && C)）
                if ("or".equals(type) && !combined.isEmpty()) {
                    combined = "(" + combined + ")";
                }
                gateConditions.put(nodeId, combined);
            }
        }

        String startNodeId = nodeMap.values().stream()
                .filter(n -> "start".equals(n.get("type").asText()))
                .findFirst()
                .map(n -> n.get("id").asText())
                .orElse(nodeMap.keySet().iterator().next());

        StringBuilder rulesBuilder = new StringBuilder();
        Set<String> generatedRules = new HashSet<>();
        
        generateRuleRecursive(ruleCode, startNodeId, nodeMap, adjacency, gateConditions,
                rulesBuilder, generatedRules, "", new ArrayList<>(), 0);

        String drl = String.format(DRL_TEMPLATE, sanitizePackage(ruleCode), rulesBuilder.toString());
        log.debug("生成的 DRL:\n{}", drl);
        return drl;
    }

    private void generateRuleRecursive(String ruleCode, String nodeId,
                                       Map<String, JsonNode> nodeMap,
                                       Map<String, List<JsonNode>> adjacency,
                                       Map<String, String> gateConditions,
                                       StringBuilder rulesBuilder, Set<String> generatedRules,
                                       String parentCondition, List<String> parentConditionIds, int depth) {
        if (depth > 50) {
            return;
        }

        JsonNode node = nodeMap.get(nodeId);
        if (node == null) return;

        String type = node.get("type").asText();
        
        // and/or 节点不受 generatedRules 限制（允许多入边重复访问）
        if (!"and".equals(type) && !"or".equals(type)) {
            String key = nodeId + "_" + parentCondition;
            if (generatedRules.contains(key)) {
                return;
            }
            generatedRules.add(key);
        }

        String nodeLabel = node.has("data") && node.get("data").has("label") 
                ? node.get("data").get("label").asText() 
                : nodeId;

        if ("start".equals(type)) {
            List<JsonNode> outEdges = adjacency.getOrDefault(nodeId, Collections.emptyList());
            for (JsonNode edge : outEdges) {
                generateRuleRecursive(ruleCode, edge.get("target").asText(), nodeMap, adjacency, gateConditions,
                        rulesBuilder, generatedRules, parentCondition, parentConditionIds, depth + 1);
            }
        } else if ("condition".equals(type)) {
            String conditionExpr = buildConditionExpression(node);
            String fullCondition = parentCondition.isEmpty() ? conditionExpr
                    : parentCondition + " && " + conditionExpr;

            List<String> branchIds = new ArrayList<>(parentConditionIds);
            branchIds.add(nodeId);

            List<JsonNode> outEdges = adjacency.getOrDefault(nodeId, Collections.emptyList());
            for (JsonNode edge : outEdges) {
                String label = edge.has("label") ? edge.get("label").asText() : "";
                String sourceHandle = edge.has("sourceHandle") ? edge.get("sourceHandle").asText() : "";
                boolean isTrueBranch = "true".equals(sourceHandle) || "是".equals(label) || "true".equalsIgnoreCase(label) || label.isEmpty();

                String branchCondition = isTrueBranch ? fullCondition : negateCondition(fullCondition);
                String targetId = edge.get("target").asText();

                JsonNode targetNode = nodeMap.get(targetId);
                if (targetNode != null && "result".equals(targetNode.get("type").asText())) {
                    generateResultRule(ruleCode, nodeLabel, branchCondition, targetNode, branchIds, rulesBuilder);
                } else {
                    generateRuleRecursive(ruleCode, targetId, nodeMap, adjacency, gateConditions,
                            rulesBuilder, generatedRules, branchCondition, branchIds, depth + 1);
                }
            }
        } else if ("result".equals(type)) {
            generateResultRule(ruleCode, nodeLabel, parentCondition, node, parentConditionIds, rulesBuilder);
        } else if ("and".equals(type) || "or".equals(type)) {
            // 使用预计算的上游条件组合，替代 parentCondition
            String gateCondition = gateConditions.getOrDefault(nodeId, "");
            String finalCondition = gateCondition.isEmpty() ? parentCondition : gateCondition;

            List<JsonNode> outEdges = adjacency.getOrDefault(nodeId, Collections.emptyList());
            for (JsonNode edge : outEdges) {
                generateRuleRecursive(ruleCode, edge.get("target").asText(), nodeMap, adjacency, gateConditions,
                        rulesBuilder, generatedRules, finalCondition, parentConditionIds, depth + 1);
            }
        }
    }

    /**
     * 递归收集指定节点所有上游的 condition 节点条件，并用指定分隔符连接
     */
    private String combineUpstreamConditions(String nodeId, Map<String, JsonNode> nodeMap,
                                              Map<String, List<JsonNode>> reverseAdjacency,
                                              String separator, Set<String> visited) {
        if (visited.contains(nodeId)) return "";
        visited.add(nodeId);
        
        List<JsonNode> inEdges = reverseAdjacency.getOrDefault(nodeId, Collections.emptyList());
        List<String> conditions = new ArrayList<>();
        
        for (JsonNode edge : inEdges) {
            String sourceId = edge.get("source").asText();
            JsonNode sourceNode = nodeMap.get(sourceId);
            if (sourceNode == null) continue;
            
            String sourceType = sourceNode.get("type").asText();
            if ("condition".equals(sourceType)) {
                conditions.add(buildConditionExpression(sourceNode));
            } else if ("and".equals(sourceType) || "or".equals(sourceType)) {
                String subSep = "and".equals(sourceType) ? " && " : " || ";
                String subCond = combineUpstreamConditions(sourceId, nodeMap, reverseAdjacency, subSep, visited);
                if (!subCond.isEmpty()) conditions.add(subCond);
            }
        }
        
        return String.join(separator, conditions);
    }

    private String buildConditionExpression(JsonNode node) {
        JsonNode data = node.get("data");
        if (data == null || !data.has("conditionConfig")) {
            return "true";
        }
        JsonNode config = data.get("conditionConfig");
        String field = config.has("field") ? config.get("field").asText() : "param";
        String operator = config.has("operator") ? config.get("operator").asText() : "==";
        JsonNode value = config.get("value");
        
        String valueStr = value != null ? value.asText() : "";
        valueStr = valueStr.replace("\\", "\\\\").replace("\"", "\\\"");
        
        JsonNode extra1Node = config.get("extraValue1");
        String extraValue1 = extra1Node != null && !extra1Node.isNull() ? extra1Node.asText() : "";
        extraValue1 = extraValue1.replace("\\", "\\\\").replace("\"", "\\\"");

        JsonNode extra2Node = config.get("extraValue2");
        String extraValue2 = extra2Node != null && !extra2Node.isNull() ? extra2Node.asText() : "";
        extraValue2 = extraValue2.replace("\\", "\\\\").replace("\"", "\\\"");

        JsonNode extra3Node = config.get("extraValue3");
        String extraValue3 = extra3Node != null && !extra3Node.isNull() ? extra3Node.asText() : "";
        extraValue3 = extraValue3.replace("\\", "\\\\").replace("\"", "\\\"");

        JsonNode extra4Node = config.get("extraValue4");
        String extraValue4 = extra4Node != null && !extra4Node.isNull() ? extra4Node.asText() : "";
        extraValue4 = extraValue4.replace("\\", "\\\\").replace("\"", "\\\"");

        // 读取字典编码配置
        JsonNode dictCodeNode = config.get("dictCode");
        String dictCode = dictCodeNode != null && !dictCodeNode.isNull() ? dictCodeNode.asText() : "";
        dictCode = dictCode.replace("\\", "\\\\").replace("\"", "\\\"");

        JsonNode allDictCodeNode = config.get("allDictCode");
        String allDictCode = allDictCodeNode != null && !allDictCodeNode.isNull() ? allDictCodeNode.asText() : "";
        allDictCode = allDictCode.replace("\\", "\\\\").replace("\"", "\\\"");

        JsonNode dictAttrNode = config.get("dictAttr");
        String dictAttr = dictAttrNode != null && !dictAttrNode.isNull() ? dictAttrNode.asText() : "itemName";
        dictAttr = dictAttr.replace("\\", "\\\\").replace("\"", "\\\"");

        JsonNode allDictAttrNode = config.get("allDictAttr");
        String allDictAttr = allDictAttrNode != null && !allDictAttrNode.isNull() ? allDictAttrNode.asText() : "itemName";
        allDictAttr = allDictAttr.replace("\\", "\\\\").replace("\"", "\\\"");

        if ("==".equals(operator) || "equals".equals(operator)) {
            return String.format("$param.get(\"%s\") != null && \"%s\".equals(String.valueOf($param.get(\"%s\")))", field, valueStr, field);
        } else if ("!=".equals(operator) || "notEquals".equals(operator)) {
            return String.format("$param.get(\"%s\") != null && !\"%s\".equals(String.valueOf($param.get(\"%s\")))", field, valueStr, field);
        } else if (">".equals(operator) || "greaterThan".equals(operator)) {
            return String.format("$param.get(\"%s\") != null && Double.parseDouble(String.valueOf($param.get(\"%s\"))) > %s", field, field, valueStr);
        } else if ("<".equals(operator) || "lessThan".equals(operator)) {
            return String.format("$param.get(\"%s\") != null && Double.parseDouble(String.valueOf($param.get(\"%s\"))) < %s", field, field, valueStr);
        } else if (">=".equals(operator)) {
            return String.format("$param.get(\"%s\") != null && Double.parseDouble(String.valueOf($param.get(\"%s\"))) >= %s", field, field, valueStr);
        } else if ("<=".equals(operator)) {
            return String.format("$param.get(\"%s\") != null && Double.parseDouble(String.valueOf($param.get(\"%s\"))) <= %s", field, field, valueStr);
        } else if ("between".equals(operator)) {
            return String.format("RuleScriptUtils.isBetween($param.get(\"%s\"), \"%s\", \"%s\")", field, valueStr, extraValue1);
        } else if ("contains".equals(operator)) {
            return String.format("$param.get(\"%s\") != null && String.valueOf($param.get(\"%s\")).contains(\"%s\")", field, field, valueStr);
        } else if ("arrayContains".equals(operator)) {
            return String.format("$param.get(\"%s\") != null && RuleScriptUtils.arrayContains($param.get(\"%s\"), \"%s\")", field, field, valueStr);
        } else if ("regex_match".equals(operator)) {
            return String.format("$param.get(\"%s\") != null && String.valueOf($param.get(\"%s\")).matches(\"%s\")", field, field, valueStr);
        } else if ("regex_not_match".equals(operator)) {
            return String.format("$param.get(\"%s\") != null && !String.valueOf($param.get(\"%s\")).matches(\"%s\")", field, field, valueStr);
        } else if ("regexMatch".equals(operator)) {
            if (!dictCode.isEmpty()) {
                return String.format("dictUtils.regexMatch((String)$param.get(\"%s\"), \"%s\", \"%s\")", field, dictCode, dictAttr);
            }
            return String.format("RuleScriptUtils.regexMatch((String)$param.get(\"%s\"), \"%s\")", field, valueStr);
        } else if ("multiRegexMatch".equals(operator)) {
            String courseRecordField = !extraValue1.isEmpty() ? extraValue1 : "courseRecord";
            if (!dictCode.isEmpty()) {
                return String.format("dictUtils.multiConditionRegexMatch(\"%s\", \"%s\", (String)$param.get(\"%s\"), (String)$param.get(\"%s\"))", dictCode, dictAttr, field, courseRecordField);
            }
            return String.format("RuleScriptUtils.multiConditionRegexMatch(\"%s\", (String)$param.get(\"%s\"), (String)$param.get(\"%s\"))", valueStr, field, courseRecordField);
        } else if ("contradictionCheck".equals(operator)) {
            String str2Field = !extraValue2.isEmpty() ? extraValue2 : "入院主诉";
            if (!dictCode.isEmpty() && !allDictCode.isEmpty()) {
                return String.format("dictUtils.contradictionCheck((String)$param.get(\"%s\"), (String)$param.get(\"%s\"), \"%s\", \"%s\", \"%s\", \"%s\")", field, str2Field, dictCode, dictAttr, allDictCode, allDictAttr);
            }
            String negativeWords = valueStr;
            String keywords = extraValue1;
            return String.format("RuleScriptUtils.contradictionCheck((String)$param.get(\"%s\"), (String)$param.get(\"%s\"), \"%s\", \"%s\")", field, str2Field, negativeWords, keywords);
        } else if ("existenceConflict".equals(operator)) {
            String str2Field = !extraValue1.isEmpty() ? extraValue1 : "入院主诉";
            if (!dictCode.isEmpty()) {
                return String.format("dictUtils.existenceConflict((String)$param.get(\"%s\"), (String)$param.get(\"%s\"), \"%s\", \"%s\")", field, str2Field, dictCode, dictAttr);
            }
            String keywords = valueStr;
            return String.format("RuleScriptUtils.existenceConflict((String)$param.get(\"%s\"), (String)$param.get(\"%s\"), \"%s\")", field, str2Field, keywords);
        } else if ("whitelistMatch".equals(operator)) {
            String allowedKeywords = valueStr;
            String allKeywords = extraValue1;
            return String.format("RuleScriptUtils.whitelistMatch((String)$param.get(\"%s\"), \"%s\", \"%s\")", field, allowedKeywords, allKeywords);
        } else if ("dictMatch".equals(operator)) {
            if (!extraValue1.isEmpty()) {
                // 用户在前端勾选了具体字典值
                return String.format("dictUtils.dictMatchWithSelected((String)$param.get(\"%s\"), \"%s\", \"%s\", \"%s\")", field, dictCode, extraValue1, dictAttr);
            }
            return String.format("dictUtils.whitelistMatch((String)$param.get(\"%s\"), \"%s\", \"%s\", \"%s\")", field, dictCode, allDictCode, dictAttr);
        } else if ("dataCheck".equals(operator)) {
            String op = valueStr;
            String thresholdStr = extraValue1;
            return String.format("$param.get(\"%s\") != null && RuleScriptUtils.dataCheck(Double.valueOf(String.valueOf($param.get(\"%s\"))), \"%s\", Double.valueOf(\"%s\"))", field, field, op, thresholdStr);
        } else if ("timeCheck".equals(operator)) {
            String baseTimeField = valueStr;
            String minValue = (!extraValue1.trim().isEmpty() && !extraValue1.equalsIgnoreCase("null")) ? extraValue1 : "null";
            String maxValue = (!extraValue2.trim().isEmpty() && !extraValue2.equalsIgnoreCase("null")) ? extraValue2 : "null";
            String timeUnit = (!extraValue3.trim().isEmpty()) ? extraValue3 : "HOUR";
            return String.format("RuleScriptUtils.timeCheck((String)$param.get(\"%s\"), (String)$param.get(\"%s\"), %s, %s, \"%s\")", field, baseTimeField, minValue, maxValue, timeUnit);
        } else if ("lengthCheck".equals(operator)) {
            String op = valueStr;
            String threshold = extraValue1;
            return String.format("RuleScriptUtils.lengthCheck((String)$param.get(\"%s\"), \"%s\", Integer.parseInt(\"%s\"))", field, op, threshold);
        } else if ("isBlank".equals(operator)) {
            return String.format("RuleScriptUtils.isBlank($param.get(\"%s\"))", field);
        } else if ("isNotBlank".equals(operator)) {
            return String.format("RuleScriptUtils.isNotBlank($param.get(\"%s\"))", field);
        } else if ("similarity".equals(operator)) {
            String otherField = valueStr;
            String threshold = extraValue1;
            return String.format("RuleScriptUtils.similarity((String)$param.get(\"%s\"), (String)$param.get(\"%s\"), Double.parseDouble(\"%s\"))", field, otherField, threshold);
        } else if ("arrayLength".equals(operator)) {
            String op = valueStr;
            String threshold = extraValue1;
            return String.format("RuleScriptUtils.arrayLength($param.get(\"%s\"), \"%s\", Integer.parseInt(\"%s\"))", field, op, threshold);
        } else if ("arrayIntersect".equals(operator)) {
            String otherField = valueStr;
            String op = extraValue1;
            String threshold = extraValue2;
            return String.format("RuleScriptUtils.arrayIntersect($param.get(\"%s\"), $param.get(\"%s\"), \"%s\", Integer.parseInt(\"%s\"))", field, otherField, op, threshold);
        } else if ("fieldCompare".equals(operator)) {
            String fieldA = valueStr;
            String fieldB = extraValue1;
            String compareType = extraValue2;
            String op = extraValue3;
            String threshold = extraValue4;
            return String.format("RuleScriptUtils.fieldCompare($param.get(\"%s\"), $param.get(\"%s\"), \"%s\", \"%s\", \"%s\")", fieldA, fieldB, compareType, op, threshold);
        } else if ("IN_SET".equals(operator)) {
            return String.format("RuleScriptUtils.inSet($param.get(\"%s\"), \"%s\")", field, valueStr);
        }
        return "true";
    }

    private String negateCondition(String condition) {
        return "!(" + condition + ")";
    }

    private static final Pattern TIME_CHECK_PATTERN = Pattern.compile(
            "RuleScriptUtils\\.timeCheck\\(\\(String\\)\\$param\\.get\\(\"([^\"]+)\"\\), \\(String\\)\\$param\\.get\\(\"([^\"]+)\"\\), ([^,]+), ([^,]+), \"([^\"]+)\"\\)"
    );

    private String extractTimeDiffComputation(String condition) {
        Matcher matcher = TIME_CHECK_PATTERN.matcher(condition);
        if (matcher.find()) {
            String field = matcher.group(1);
            String baseField = matcher.group(2);
            String unit = matcher.group(5);
            return "    long _diff = RuleScriptUtils.computeTimeDiff((String)$param.get(\"" + field + "\"), (String)$param.get(\"" + baseField + "\"), \"" + unit + "\");\n"
                    + "    $param.put(\"_timeDiff\", String.valueOf(_diff));\n";
        }
        return "";
    }

    private void generateResultRule(String ruleCode, String nodeLabel, String condition,
                                     JsonNode resultNode, List<String> hitConditionIds, StringBuilder rulesBuilder) {
        JsonNode data = resultNode.get("data");
        JsonNode resultConfig = data != null && data.has("resultConfig") ? data.get("resultConfig") : null;
        String resultType = resultConfig != null && resultConfig.has("resultType") ? resultConfig.get("resultType").asText() : "DEFAULT";
        String resultValue = resultConfig != null && resultConfig.has("resultValue") ? resultConfig.get("resultValue").asText() : nodeLabel;
        String content = resultConfig != null && resultConfig.has("content") ? resultConfig.get("content").asText() : "";
        String metadata = resultConfig != null && resultConfig.has("metadata") ? resultConfig.get("metadata").asText() : "";
        String resultNodeId = resultNode.get("id").asText();

        StringBuilder idsBuilder = new StringBuilder();
        idsBuilder.append("java.util.Arrays.asList(");
        for (int i = 0; i < hitConditionIds.size(); i++) {
            if (i > 0) idsBuilder.append(", ");
            idsBuilder.append("\"").append(hitConditionIds.get(i)).append("\"");
        }
        idsBuilder.append(")");

        String ruleName = sanitizeRuleName(ruleCode + "_" + nodeLabel + "_" + resultNodeId);

        String timeDiffCode = extractTimeDiffComputation(condition);

        rulesBuilder.append("rule \"").append(ruleName).append("\"\n")
                .append("when\n")
                .append("    $param : Map(").append(condition).append(")\n")
                .append("then\n");
        if (!timeDiffCode.isEmpty()) {
            rulesBuilder.append(timeDiffCode);
        }
        rulesBuilder.append("    Map r = new HashMap();\n")
                .append("    r.put(\"ruleCode\", \"").append(ruleCode).append("\");\n")
                .append("    r.put(\"nodeLabel\", \"").append(nodeLabel).append("\");\n")
                .append("    r.put(\"resultType\", \"").append(resultType).append("\");\n")
                .append("    r.put(\"resultValue\", \"").append(resultValue).append("\");\n")
                .append("    r.put(\"content\", \"").append(content).append("\");\n");
        if (!metadata.isEmpty()) {
            rulesBuilder.append("    r.put(\"metadata\", \"").append(escapeJsonString(metadata)).append("\");\n");
        }
        rulesBuilder.append("    r.put(\"matched\", true);\n")
                .append("    r.put(\"resultNodeId\", \"").append(resultNodeId).append("\");\n")
                .append("    r.put(\"hitConditionIds\", ").append(idsBuilder.toString()).append(");\n")
                .append("    result.put(\"result_\" + System.currentTimeMillis(), r);\n")
                .append("end\n")
                .append("\n");
    }

    private String escapeJsonString(String str) {
        if (str == null) return "";
        return str.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
    }

    private String sanitizePackage(String code) {
        String sanitized = code.replaceAll("[^a-zA-Z0-9]", "_").toLowerCase();
        if (sanitized.length() > 0 && Character.isDigit(sanitized.charAt(0))) {
            sanitized = "r_" + sanitized;
        }
        return sanitized;
    }

    private String sanitizeRuleName(String name) {
        int len = Math.min(name.length(), 100);
        String sanitized = name.substring(0, len).replaceAll("[^a-zA-Z0-9_\u4e00-\u9fa5]", "_");
        if (sanitized.length() > 0 && Character.isDigit(sanitized.charAt(0))) {
            sanitized = "r_" + sanitized;
        }
        return sanitized;
    }
}
