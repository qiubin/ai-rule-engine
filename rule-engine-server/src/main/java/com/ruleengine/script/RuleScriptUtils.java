package com.ruleengine.script;

import lombok.extern.slf4j.Slf4j;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.regex.Matcher;
import java.lang.reflect.Array;
import java.util.Collection;
import java.util.Collections;
import java.util.regex.Pattern;

/**
 * 规则引擎业务处理脚本/工具类
 * 封装了正则匹配、矛盾判断、数据判断和时间判断等核心方法，供规则执行时调用。
 */
@Slf4j
public class RuleScriptUtils {

    /**
     * 0. 在集合中：判断字段值是否精确匹配给定集合中的某一项。
     * 集合通过逗号/顿号/分号分隔，如 "A,B,C"。
     */
    public static boolean inSet(Object value, String setStr) {
        if (value == null || !StringUtils.hasText(setStr)) return false;
        String str = String.valueOf(value).trim();
        List<String> items = parseKeywordList(setStr);
        return items.contains(str);
    }

    /**
     * 1. 正则匹配：基于输入的1个字符串，判断是否命中，命中时返回TRUE。
     * 应用场景：诱因正则匹配，描述不清返回TRUE；缺症状时间描述，描述不清返回TRUE；
     *
     * @param input 待匹配的字符串
     * @param regex 匹配规则（正则表达式）
     * @return 命中正则，或输入为空（即描述不清/缺失）时返回 TRUE
     */
    public static boolean regexMatch(String input, String regex) {
        if (!StringUtils.hasText(input)) {
            // 描述不清/缺描述返回 TRUE
            return true;
        }
        if (!StringUtils.hasText(regex)) {
            return false;
        }
        Pattern pattern = Pattern.compile(regex);
        Matcher matcher = pattern.matcher(input);
        return matcher.find();
    }

    /**
     * 2. 正则匹配（多条件）：基于条件1的字符串与条件2的字符串计算结果，再与条件3的字符串判断是否命中。
     * 应用场景：抗菌药物匹配。条件1（抗菌药物集合）与条件2（医嘱药物）匹配出使用的药物，
     * 再与条件3（病程记录）匹配是否描述。未描述返回 TRUE。
     *
     * @param antiBioticsSet  条件1：抗菌药物集合（可通过逗号分隔的字符串传入）
     * @param doctorsOrder    条件2：医嘱中的药物字符串
     * @param courseRecord    条件3：病程记录字符串
     * @return 医嘱中使用了抗菌药物但病程记录中未描述，返回 TRUE
     */
    public static boolean multiConditionRegexMatch(String antiBioticsSet, String doctorsOrder, String courseRecord) {
        if (!StringUtils.hasText(antiBioticsSet) || !StringUtils.hasText(doctorsOrder)) {
            return false; // 缺少基础匹配条件
        }

        // 1. 从抗菌药物集合中提取出医嘱里实际使用的抗菌药物
        List<String> antibiotics = Arrays.asList(antiBioticsSet.split("[,|，]"));
        String matchedAntibiotic = null;
        for (String antibiotic : antibiotics) {
            if (doctorsOrder.contains(antibiotic.trim())) {
                matchedAntibiotic = antibiotic.trim();
                break;
            }
        }

        // 2. 如果医嘱中没有使用抗菌药物，则不需要进行后续判断
        if (matchedAntibiotic == null) {
            return false;
        }

        // 3. 判断条件3（病程记录）中是否包含了该抗菌药物记录
        // 如果病程记录为空，或者未包含该抗菌药物的相关描述，返回 TRUE（表示"未描述"）
        if (!StringUtils.hasText(courseRecord) || !courseRecord.contains(matchedAntibiotic)) {
            return true;
        }

        return false;
    }

    /**
     * 3. 矛盾判断：基于输入的2个字符串，判断是否存在矛盾关系，命中时返回TRUE。
     * 应用场景：个人史描述与既往诊断存在矛盾；过敏史与既往史描述矛盾；门诊主诉与入院主诉症状矛盾。
     * 
     * @param str1 第一个字符串（如：既往史/门诊主诉）
     * @param str2 第二个字符串（如：过敏史/入院主诉）
     * @param negativeWords 否定词表（如："无", "否认", "未发现"），多词用逗号分隔
     * @param keywords 需要比对的关键症状或疾病词汇集合（逗号分隔）
     * @return 存在矛盾关系时返回 TRUE
     */
    public static boolean contradictionCheck(String str1, String str2, String negativeWords, String keywords) {
        if (!StringUtils.hasText(str1) || !StringUtils.hasText(str2)) {
            return false;
        }
        
        List<String> negWords = Arrays.asList(negativeWords.split("[,|，]"));
        List<String> keys = Arrays.asList(keywords.split("[,|，]"));

        for (String key : keys) {
            String k = key.trim();
            if (!StringUtils.hasText(k)) continue;

            // 判断 str1 中是否否定了关键信息
            boolean str1Negative = containsNegativeContext(str1, k, negWords);
            // 判断 str1 中是否肯定了关键信息
            boolean str1Positive = str1.contains(k) && !str1Negative;

            // 判断 str2 中是否否定了关键信息
            boolean str2Negative = containsNegativeContext(str2, k, negWords);
            // 判断 str2 中是否肯定了关键信息
            boolean str2Positive = str2.contains(k) && !str2Negative;

            // 矛盾情况1：str1 肯定但 str2 否定，或矛盾情况2：str1 否定但 str2 肯定
            if ((str1Positive && str2Negative) || (str1Negative && str2Positive)) {
                log.debug("发现矛盾信息：针对关键字 '{}', str1='{}', str2='{}'", k, str1, str2);
                return true;
            }
        }
        return false;
    }

    /**
     * 辅助方法：判断文本中是否对目标词汇包含否定语境。
     */
    private static boolean containsNegativeContext(String text, String keyword, List<String> negativeWords) {
        if (!text.contains(keyword)) {
            return false;
        }
        // 简单策略：目标词汇前面一定字符范围内是否存在否定词
        int keyIndex = text.indexOf(keyword);
        String prefixText = text.substring(Math.max(0, keyIndex - 10), keyIndex);
        for (String negWord : negativeWords) {
            if (prefixText.contains(negWord.trim())) {
                return true;
            }
        }
        return false;
    }

    /**
     * 4. 数据判断：判断输入的1个数据大小，命中时返回TRUE。
     * 
     * @param inputData 输入的数据
     * @param operator 运算符（如 ">", "<", "==", ">=", "<="）
     * @param threshold 比较的阈值
     * @return 命中条件时返回 TRUE
     */
    public static boolean dataCheck(Double inputData, String operator, Double threshold) {
        if (inputData == null || threshold == null || !StringUtils.hasText(operator)) {
            return false;
        }

        switch (operator.trim()) {
            case ">":
                return inputData > threshold;
            case "<":
                return inputData < threshold;
            case "==":
            case "=":
                return Double.compare(inputData, threshold) == 0;
            case ">=":
                return inputData >= threshold;
            case "<=":
                return inputData <= threshold;
            case "!=":
                return Double.compare(inputData, threshold) != 0;
            default:
                log.warn("不支持的操作符: {}", operator);
                return false;
        }
    }

    /**
     * 6. 白名单匹配：校验输入字符串中只含有允许列表中的关键词。
     * 应用场景：主诉中只含有特定症状，不能出现其他症状。
     *
     * 工作原理：
     * 1. 用 "全部列表" 去识别输入文本中出现了哪些关键词
     * 2. 检查识别到的关键词是否都在 "允许列表" 中
     * 3. 如果 "全部列表" 为空，则退化为：检查输入中是否包含至少一个允许列表中的词
     *
     * @param input           待校验的字符串
     * @param allowedKeywords 允许的关键词列表（逗号/顿号分隔）
     * @param allKeywords     全部关键词列表（逗号/顿号分隔，用于识别文本中出现的所有关键词；若为空，则只做正向包含检查）
     * @return 输入中只含有允许的关键词时返回 TRUE
     */
    public static boolean whitelistMatch(String input, String allowedKeywords, String allKeywords) {
        if (!StringUtils.hasText(input) || !StringUtils.hasText(allowedKeywords)) {
            return false;
        }

        List<String> allowed = parseKeywordList(allowedKeywords);
        if (allowed.isEmpty()) return false;

        log.debug("白名单匹配开始：输入='{}', 允许列表='{}', 全部列表='{}'", input, allowedKeywords, allKeywords);
        log.debug("解析后的允许列表：{}，全部列表：{}"
            , allowed
            , StringUtils.hasText(allKeywords) ? parseKeywordList(allKeywords) : "(空，使用允许列表)"
        );

        // 若未提供全部列表，则退化为正向包含检查
        List<String> all = StringUtils.hasText(allKeywords) ? parseKeywordList(allKeywords) : new ArrayList<>(allowed);

        // 找出输入中匹配到的所有关键词
        Set<String> foundInInput = new HashSet<>();
        for (String keyword : all) {
            if (input.contains(keyword)) {
                foundInInput.add(keyword);
                log.debug("在输入中匹配到关键词：'{}'", keyword);
            }
        }

        if (foundInInput.isEmpty()) {
            log.debug("白名单校验失败：输入中未匹配到任何关键词");
            return false;
        }

        // 必须至少匹配到一个允许的关键词
        boolean hasAllowed = foundInInput.stream().anyMatch(found ->
                allowed.stream().anyMatch(a -> a.equals(found))
        );
        if (!hasAllowed) {
            log.debug("白名单校验失败：输入中未包含任何允许的关键词。匹配到的词：{}，允许列表：{}", foundInInput, allowed);
            return false;
        }

        // 若提供了全部列表，则严格检查是否有不允许的关键词
        if (StringUtils.hasText(allKeywords)) {
            for (String found : foundInInput) {
                boolean isAllowed = allowed.stream().anyMatch(a -> a.equals(found));
                if (!isAllowed) {
                    log.info("白名单校验失败：发现不允许的关键词 '{}'，输入='{}'", found, input);
                    return false;
                }
            }
        }

        log.debug("白名单校验通过：输入='{}'", input);
        return true;
    }

    /**
     * 7. 存在性冲突校验：检查两个字段对同一关键词是否存在"一个包含、一个不包含"的矛盾。
     * 应用场景：门诊主诉提到"糖尿病"但入院主诉未提及；或两个诊断记录中对同一症状描述不一致。
     *
     * @param strA     第一个字符串
     * @param strB     第二个字符串
     * @param keywords 要检查冲突的关键词列表（逗号分隔）
     * @return 存在冲突时返回 TRUE
     */
    public static boolean existenceConflict(String strA, String strB, String keywords) {
        if (!StringUtils.hasText(strA) || !StringUtils.hasText(strB) || !StringUtils.hasText(keywords)) {
            return false;
        }

        List<String> keys = parseKeywordList(keywords);
        for (String key : keys) {
            boolean aHas = strA.contains(key);
            boolean bHas = strB.contains(key);

            // 一个包含但另一个不包含 = 矛盾
            if (aHas != bHas) {
                log.debug("存在性冲突：关键字 '{}', A包含={}, B包含={}", key, aHas, bHas);
                return true;
            }
        }

        return false;
    }

    /**
     * 辅助方法：将分隔的字符串解析为关键词列表
     * 支持的分隔符：英文逗号, 中文逗号， 顿号、 分号; 中文分号； 竖线|
     */
    private static List<String> parseKeywordList(String keywords) {
        if (!StringUtils.hasText(keywords)) {
            return new ArrayList<>();
        }
        return Arrays.stream(keywords.split("[,|，、;；]"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }

    /**
     * 5. 时间判断：判断输入的时间是否在设定的时间范围内，命中时返回TRUE。
     *
     * @param targetTime 输入的目标时间字符串（如 "2024-05-01 10:00:00"）
     * @param baseTime 基准时间字符串（如 "2024-05-01 08:00:00"）
     * @param minHours 最小相差小时数（如果为 null，则不设下限）
     * @param maxHours 最大相差小时数（如果为 null，则不设上限）
     * @return 在时间范围内返回 TRUE
     */
    public static boolean timeCheck(String targetTime, String baseTime, Integer minHours, Integer maxHours) {
        return timeCheck(targetTime, baseTime, minHours, maxHours, "HOUR");
    }

    /**
     * 时间判断（支持多种时间单位）：判断两个时间字段的差值是否在设定范围内，命中时返回TRUE。
     *
     * @param targetTime 目标时间字符串
     * @param baseTime 基准时间字符串
     * @param minValue 最小相差值（null 表示不限制）
     * @param maxValue 最大相差值（null 表示不限制）
     * @param unit 时间单位：HOUR / MINUTE / DAY
     * @return 在时间范围内返回 TRUE
     */
    public static boolean timeCheck(String targetTime, String baseTime, Integer minValue, Integer maxValue, String unit) {
        log.info("[timeCheck] targetTime={}, baseTime={}, minValue={}, maxValue={}, unit={}", targetTime, baseTime, minValue, maxValue, unit);
        if (!StringUtils.hasText(targetTime) || !StringUtils.hasText(baseTime)) {
            log.warn("[timeCheck] 返回false: targetTime或baseTime为空");
            return false;
        }

        try {
            LocalDateTime target = parseDateTime(targetTime);
            LocalDateTime base = parseDateTime(baseTime);
            log.info("[timeCheck] 解析后 target={}, base={}", target, base);
            if (target == null || base == null) {
                log.warn("[timeCheck] 返回false: parseDateTime返回null, targetParsed={}, baseParsed={}", target, base);
                return false;
            }

            ChronoUnit chronoUnit;
            String unitNorm = (unit != null) ? unit.trim().toUpperCase() : "HOUR";
            switch (unitNorm) {
                case "MINUTE":
                    chronoUnit = ChronoUnit.MINUTES;
                    break;
                case "DAY":
                    chronoUnit = ChronoUnit.DAYS;
                    break;
                case "HOUR":
                default:
                    chronoUnit = ChronoUnit.HOURS;
                    break;
            }

            long diff = Math.abs(chronoUnit.between(base, target));
            log.info("[timeCheck] diff={}, unit={}", diff, unitNorm);

            boolean minCondition = (minValue == null) || (diff >= minValue);
            boolean maxCondition = (maxValue == null) || (diff <= maxValue);
            log.info("[timeCheck] minCondition={}, maxCondition={}, 最终结果={}", minCondition, maxCondition, minCondition && maxCondition);

            return minCondition && maxCondition;
        } catch (Exception e) {
            log.error("[timeCheck] 解析错误, targetTime: {}, baseTime: {}, unit: {}", targetTime, baseTime, unit, e);
            return false;
        }
    }

    /**
     * 计算两个时间的差值，供 DRL 结果节点引用。
     *
     * @param targetTime 目标时间字符串
     * @param baseTime 基准时间字符串
     * @param unit 时间单位：HOUR / MINUTE / DAY
     * @return 差值（绝对值），解析失败返回 -1
     */
    public static long computeTimeDiff(String targetTime, String baseTime, String unit) {
        if (!StringUtils.hasText(targetTime) || !StringUtils.hasText(baseTime)) {
            return -1;
        }
        try {
            LocalDateTime target = parseDateTime(targetTime);
            LocalDateTime base = parseDateTime(baseTime);
            if (target == null || base == null) {
                return -1;
            }
            ChronoUnit chronoUnit;
            String unitNorm = (unit != null) ? unit.trim().toUpperCase() : "HOUR";
            switch (unitNorm) {
                case "MINUTE":
                    chronoUnit = ChronoUnit.MINUTES;
                    break;
                case "DAY":
                    chronoUnit = ChronoUnit.DAYS;
                    break;
                case "HOUR":
                default:
                    chronoUnit = ChronoUnit.HOURS;
                    break;
            }
            return Math.abs(chronoUnit.between(base, target));
        } catch (Exception e) {
            log.error("[computeTimeDiff] 解析错误, targetTime: {}, baseTime: {}, unit: {}", targetTime, baseTime, unit, e);
            return -1;
        }
    }

    /**
     * 6. 字段长度校验：判断输入字符串的长度，命中时返回TRUE。
     * 应用场景：字段非空校验（长度=0）、字段过短/过长校验。
     */
    public static boolean lengthCheck(String input, String op, int threshold) {
        if (input == null) input = "";
        int len = input.length();
        switch (op.trim()) {
            case ">": return len > threshold;
            case "<": return len < threshold;
            case ">=": return len >= threshold;
            case "<=": return len <= threshold;
            case "==": case "=": return len == threshold;
            case "!=": return len != threshold;
            default: log.warn("不支持的lengthCheck操作符: {}", op); return false;
        }
    }

    /**
     * 7. 空值校验：判断输入值是否为 null 或空白字符串，命中时返回TRUE。
     * 应用场景：字段缺失、必填项未填写。
     */
    public static boolean isBlank(Object v) {
        if (v == null) return true;
        String s = String.valueOf(v);
        return !StringUtils.hasText(s);
    }

    /**
     * 非空校验：判断输入值是否非 null 且非空白字符串，命中时返回TRUE。
     * 应用场景：必填项已填写、字段已记录。
     */
    public static boolean isNotBlank(Object v) {
        return !isBlank(v);
    }

    /**
     * 8. 文本相似度：基于 HanLP 分词的 Jaccard 系数判断两段文本相似度是否超过阈值，命中时返回TRUE。
     * 优先使用 HanLP 分词，若不可用则自动回退到字符二元组。
     * 应用场景：病程记录雷同判断（R56/R65/R73/R74/R75）。
     */
    public static boolean similarity(String a, String b, double threshold) {
        if (!StringUtils.hasText(a) || !StringUtils.hasText(b)) {
            return true; // 任一为空视为异常，触发质控
        }
        double sim;
        try {
            sim = tokenJaccard(a, b);
        } catch (Exception e) {
            sim = bigramJaccard(a, b);
        }
        log.debug("similarity: a_len={}, b_len={}, sim={}", a.length(), b.length(), sim);
        return sim >= threshold;
    }

    private static double tokenJaccard(String a, String b) {
        List<com.hankcs.hanlp.seg.common.Term> termsA = com.hankcs.hanlp.HanLP.segment(a);
        List<com.hankcs.hanlp.seg.common.Term> termsB = com.hankcs.hanlp.HanLP.segment(b);
        Set<String> sa = termsA.stream().map(t -> t.word).collect(Collectors.toSet());
        Set<String> sb = termsB.stream().map(t -> t.word).collect(Collectors.toSet());
        if (sa.isEmpty() && sb.isEmpty()) {
            return 1.0;
        }
        Set<String> intersection = new HashSet<>(sa);
        intersection.retainAll(sb);
        Set<String> union = new HashSet<>(sa);
        union.addAll(sb);
        return union.isEmpty() ? 0.0 : (double) intersection.size() / union.size();
    }

    private static double bigramJaccard(String a, String b) {
        Set<String> sa = toBigrams(a);
        Set<String> sb = toBigrams(b);
        if (sa.isEmpty() && sb.isEmpty()) {
            return 1.0;
        }
        Set<String> intersection = new HashSet<>(sa);
        intersection.retainAll(sb);
        Set<String> union = new HashSet<>(sa);
        union.addAll(sb);
        return union.isEmpty() ? 0.0 : (double) intersection.size() / union.size();
    }

    private static Set<String> toBigrams(String s) {
        Set<String> set = new HashSet<>();
        for (int i = 0; i < s.length() - 1; i++) {
            set.add(s.substring(i, i + 2));
        }
        return set;
    }

    /**
     * 9. 集合长度校验：判断集合（或数组）的元素个数，命中时返回TRUE。
     * 应用场景：阴性症状个数校验（R17/R29：个数<5 触发质控）。
     */
    public static boolean arrayLength(Object collection, String op, int threshold) {
        if (collection == null) collection = Collections.emptyList();
        int size;
        if (collection instanceof Collection) {
            size = ((Collection<?>) collection).size();
        } else if (collection.getClass().isArray()) {
            size = Array.getLength(collection);
        } else {
            log.warn("arrayLength 不支持的类型: {}", collection.getClass());
            return false;
        }
        switch (op.trim()) {
            case ">": return size > threshold;
            case "<": return size < threshold;
            case ">=": return size >= threshold;
            case "<=": return size <= threshold;
            case "==": case "=": return size == threshold;
            case "!=": return size != threshold;
            default: log.warn("不支持的arrayLength操作符: {}", op); return false;
        }
    }

    /**
     * 10. 集合交集校验：判断两个集合的交集元素个数，命中时返回TRUE。
     * 应用场景：门诊主诉与入院主诉症状交集对比（R9/R20：交集为空触发质控）。
     */
    public static boolean arrayIntersect(Object collA, Object collB, String op, int threshold) {
        Collection<?> a = toCollection(collA);
        Collection<?> b = toCollection(collB);
        if (a == null) a = Collections.emptyList();
        if (b == null) b = Collections.emptyList();

        Set<Object> intersection = new HashSet<>(a);
        intersection.retainAll(b);
        int count = intersection.size();

        switch (op.trim()) {
            case ">": return count > threshold;
            case "<": return count < threshold;
            case ">=": return count >= threshold;
            case "<=": return count <= threshold;
            case "==": case "=": return count == threshold;
            case "!=": return count != threshold;
            default: log.warn("不支持的arrayIntersect操作符: {}", op); return false;
        }
    }

    private static Collection<?> toCollection(Object o) {
        if (o == null) return null;
        if (o instanceof Collection) return (Collection<?>) o;
        if (o.getClass().isArray()) return Arrays.asList((Object[]) o);
        log.warn("无法转为集合: {}", o.getClass());
        return null;
    }

    /**
     * 10.5 集合元素包含校验：判断集合中是否至少有一个元素包含目标字符串。
     * 支持逗号分隔的多值：只要集合中任一元素包含任一目标值即命中。
     * 应用场景：多条诊断中是否包含指定诊断名称（如 "脑梗死,高血压"）。
     */
    public static boolean arrayContains(Object collection, String target) {
        if (collection == null || target == null) return false;
        Collection<?> coll = toCollection(collection);
        if (coll == null) return false;
        String[] targets = target.split(",");
        for (String t : targets) {
            String trimmed = t.trim();
            if (trimmed.isEmpty()) continue;
            if (coll.stream().anyMatch(item -> String.valueOf(item).contains(trimmed))) {
                return true;
            }
        }
        return false;
    }

    /**
     * 11. 字段比对：比较两个字段的值，支持时间差、数值差、字符串相等。
     * 应用场景：入院时间与病史采集时间差(R1)、脉搏与心率矛盾(R42)、长期医嘱时间校验(R3)。
     *
     * @param valA        字段A的值
     * @param valB        字段B的值
     * @param compareType 比较类型：TIME_DIFF_HOUR/MINUTE/DAY, NUMERIC_DIFF, STRING_EQ
     * @param op          比较符：>, <, ==, >=, <=, !=
     * @param threshold   阈值
     * @return 命中条件返回 TRUE
     */
    public static boolean fieldCompare(Object valA, Object valB, String compareType, String op, String threshold) {
        if (valA == null || valB == null || !StringUtils.hasText(compareType)
                || !StringUtils.hasText(op) || !StringUtils.hasText(threshold)) {
            return false;
        }

        double diff;
        switch (compareType.trim()) {
            case "TIME_DIFF_HOUR":
                diff = timeDiff(valA, valB, ChronoUnit.HOURS);
                break;
            case "TIME_DIFF_MINUTE":
                diff = timeDiff(valA, valB, ChronoUnit.MINUTES);
                break;
            case "TIME_DIFF_DAY":
                diff = timeDiff(valA, valB, ChronoUnit.DAYS);
                break;
            case "NUMERIC_DIFF":
                diff = Math.abs(toDouble(valA) - toDouble(valB));
                break;
            case "STRING_EQ":
                return compareString(String.valueOf(valA), String.valueOf(valB), op);
            default:
                log.warn("不支持的 fieldCompare 比较类型: {}", compareType);
                return false;
        }

        return compareNumeric(diff, op, Double.parseDouble(threshold));
    }

    private static double timeDiff(Object valA, Object valB, ChronoUnit unit) {
        LocalDateTime dtA = parseDateTime(valA);
        LocalDateTime dtB = parseDateTime(valB);
        if (dtA == null || dtB == null) {
            return Double.MAX_VALUE;
        }
        return Math.abs(dtA.until(dtB, unit));
    }

    private static LocalDateTime parseDateTime(Object value) {
        if (value == null) return null;
        String s = String.valueOf(value).trim();
        if (!StringUtils.hasText(s)) return null;

        // 先尝试带时间的格式
        String[] dateTimePatterns = {
            "yyyy-MM-dd HH:mm:ss",
            "yyyy-MM-dd HH:mm",
            "yyyy/MM/dd HH:mm:ss",
            "yyyy/MM/dd HH:mm",
            "yyyy年MM月dd日 HH:mm:ss",
            "yyyy年MM月dd日 HH:mm",
        };
        for (String p : dateTimePatterns) {
            try {
                return LocalDateTime.parse(s, DateTimeFormatter.ofPattern(p));
            } catch (Exception e) {
                // 继续尝试下一种格式
            }
        }

        // 纯日期格式：解析为 LocalDate 后补 00:00:00
        String[] dateOnlyPatterns = {
            "yyyy-MM-dd",
            "yyyy/MM/dd",
            "yyyy年MM月dd日",
        };
        for (String p : dateOnlyPatterns) {
            try {
                LocalDate date = LocalDate.parse(s, DateTimeFormatter.ofPattern(p));
                return LocalDateTime.of(date, LocalTime.MIN);
            } catch (Exception e) {
                // 继续尝试下一种格式
            }
        }

        log.warn("无法解析时间: {}", s);
        return null;
    }

    private static double toDouble(Object value) {
        if (value == null) return 0;
        String s = String.valueOf(value).trim();
        try {
            return Double.parseDouble(s);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static boolean compareNumeric(double diff, String op, double threshold) {
        switch (op.trim()) {
            case ">": return diff > threshold;
            case "<": return diff < threshold;
            case "==": case "=": return Double.compare(diff, threshold) == 0;
            case ">=": return diff >= threshold;
            case "<=": return diff <= threshold;
            case "!=": return Double.compare(diff, threshold) != 0;
            default:
                log.warn("不支持的 fieldCompare 操作符: {}", op);
                return false;
        }
    }

    private static boolean compareString(String a, String b, String op) {
        switch (op.trim()) {
            case "==": case "=": return a.equals(b);
            case "!=": return !a.equals(b);
            default:
                log.warn("STRING_EQ 只支持 == 和 !=, 当前: {}", op);
                return false;
        }
    }

    /**
     * 范围判断：value 是否在 [min, max] 范围内
     */
    public static boolean isBetween(double value, double min, double max) {
        return value >= min && value <= max;
    }

    /**
     * 范围判断（带类型安全）：将任意类型值转为 double 后判断是否在 [min, max] 范围内
     * 值为 null、非数字或解析失败时返回 false
     */
    public static boolean isBetween(Object value, double min, double max) {
        if (value == null) return false;
        try {
            double v = Double.parseDouble(String.valueOf(value).trim());
            boolean result = v >= min && v <= max;
            log.debug("isBetween({}, {}, {}) = {}", v, min, max, result);
            return result;
        } catch (NumberFormatException e) {
            log.debug("isBetween: 无法解析为数字: {}", value);
            return false;
        }
    }

    /**
     * 范围判断（全字符串入参）：方便从 DRL 直接传入字符串避免数值解析错误
     */
    public static boolean isBetween(Object value, String minStr, String maxStr) {
        if (value == null) return false;
        try {
            double v = Double.parseDouble(String.valueOf(value).trim());
            double min = Double.parseDouble(minStr.trim());
            double max = Double.parseDouble(maxStr.trim());
            boolean result = v >= min && v <= max;
            log.debug("isBetween({}, {}, {}) = {}", v, min, max, result);
            return result;
        } catch (NumberFormatException e) {
            log.debug("isBetween 参数无法解析: value={}, min={}, max={}", value, minStr, maxStr);
            return false;
        }
    }

}
