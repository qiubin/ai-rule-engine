package com.ruleengine.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.util.*;

/**
 * 标准化就诊上下文 — 规则引擎的"输入契约"
 *
 * 由业务系统（HIS/EMR/LIS/PACS）拼装后传入，规则引擎不持久化这些数据。
 * 评分（scores）由外部系统计算好传入，例如 CHA2DS2-VA = 3。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClinicalContext {

    /** 患者基本信息 */
    private PatientInfo patient;

    /** 就诊信息 */
    private VisitInfo visit;

    /** 外部已计算的评分结果（如 CHA2DS2-VA、HAS-BLED 等） */
    @Builder.Default
    private List<ScoreItem> scores = new ArrayList<>();

    /** 当前用药列表 */
    @Builder.Default
    private List<MedicationItem> medications = new ArrayList<>();

    /** 检验结果 */
    @Builder.Default
    private List<LabResult> labs = new ArrayList<>();

    /** 生命体征 */
    private VitalSigns vitals;

    /** 扩展字段，用于传递各系统特有的额外数据 */
    @Builder.Default
    private Map<String, Object> extensions = new HashMap<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PatientInfo {
        private String patientId;
        private Integer age;
        private String gender;      // M/F
        private Double weightKg;
        private Double heightCm;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VisitInfo {
        private String visitId;
        private String departmentCode;
        private String departmentName;
        private List<String> diagnosisCodes;  // ICD-10 codes
        private List<String> diagnosisNames;
        private String visitType;    // INPATIENT / OUTPATIENT / EMERGENCY
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ScoreItem {
        private String name;         // e.g. "CHA2DS2-VA", "HAS-BLED"
        private Double value;
        private String description;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MedicationItem {
        private String drugCode;
        private String drugName;
        private String dose;
        private String frequency;
        private String route;
        private String startDate;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LabResult {
        private String code;
        private String name;
        private String value;
        private String unit;
        private String resultTime;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VitalSigns {
        private Double systolicBp;
        private Double diastolicBp;
        private Integer heartRate;
        private Double temperature;
    }

    /** 转换为规则引擎可消费的扁平 Map */
    public Map<String, Object> toFlatMap() {
        Map<String, Object> map = new HashMap<>();
        if (patient != null) {
            map.put("patientId", patient.getPatientId());
            map.put("age", patient.getAge());
            map.put("gender", patient.getGender());
            map.put("weight", patient.getWeightKg());
            map.put("height", patient.getHeightCm());
        }
        if (visit != null) {
            map.put("departmentCode", visit.getDepartmentCode());
            map.put("departmentName", visit.getDepartmentName());
            map.put("visitType", visit.getVisitType());
            map.put("diagnosisCodes", visit.getDiagnosisCodes());
            map.put("diagnosisNames", visit.getDiagnosisNames());
        }
        if (vitals != null) {
            map.put("systolicBp", vitals.getSystolicBp());
            map.put("diastolicBp", vitals.getDiastolicBp());
            map.put("heartRate", vitals.getHeartRate());
        }
        // 评分压平: score.CHA2DS2-VA, score.HAS-BLED
        if (scores != null) {
            for (ScoreItem s : scores) {
                map.put("score." + s.getName(), s.getValue());
                if (s.getDescription() != null) {
                    map.put("score." + s.getName() + ".desc", s.getDescription());
                }
            }
        }
        // 当前用药
        if (medications != null && !medications.isEmpty()) {
            List<String> drugCodes = new ArrayList<>();
            List<String> drugNames = new ArrayList<>();
            for (MedicationItem m : medications) {
                drugCodes.add(m.getDrugCode());
                drugNames.add(m.getDrugName());
                map.put("medication." + m.getDrugCode() + ".dose", m.getDose());
                map.put("medication." + m.getDrugCode() + ".freq", m.getFrequency());
            }
            map.put("medicationCodes", drugCodes);
            map.put("medicationNames", drugNames);
        }
        // 检验结果
        if (labs != null) {
            for (LabResult l : labs) {
                map.put("lab." + l.getCode(), l.getValue());
                map.put("lab." + l.getCode() + ".unit", l.getUnit());
            }
        }
        // 扩展字段
        if (extensions != null) {
            map.putAll(extensions);
        }
        return map;
    }

    /** 从扁平 Map 反向构建（用于兼容现有接口） */
    public static ClinicalContext fromFlatMap(Map<String, Object> map) {
        ClinicalContextBuilder builder = ClinicalContext.builder();

        PatientInfo.PatientInfoBuilder p = PatientInfo.builder();
        if (map.containsKey("patientId")) p.patientId(str(map.get("patientId")));
        if (map.containsKey("age")) p.age(intVal(map.get("age")));
        if (map.containsKey("gender")) p.gender(str(map.get("gender")));
        if (map.containsKey("weight")) p.weightKg(doubleVal(map.get("weight")));
        builder.patient(p.build());

        VisitInfo.VisitInfoBuilder v = VisitInfo.builder();
        if (map.containsKey("visitId")) v.visitId(str(map.get("visitId")));
        if (map.containsKey("departmentCode")) v.departmentCode(str(map.get("departmentCode")));
        if (map.containsKey("visitType")) v.visitType(str(map.get("visitType")));
        builder.visit(v.build());

        builder.extensions(new HashMap<>(map));
        return builder.build();
    }

    private static String str(Object o) { return o != null ? String.valueOf(o) : null; }
    private static Integer intVal(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).intValue();
        try { return Integer.parseInt(String.valueOf(o)); } catch (Exception e) { return null; }
    }
    private static Double doubleVal(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).doubleValue();
        try { return Double.parseDouble(String.valueOf(o)); } catch (Exception e) { return null; }
    }
}
