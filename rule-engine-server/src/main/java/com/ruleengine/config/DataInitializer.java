package com.ruleengine.config;

import com.ruleengine.domain.*;
import com.ruleengine.domain.enums.*;
import com.ruleengine.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final DictionaryRepository dictionaryRepository;
    private final DictionaryItemRepository dictionaryItemRepository;
    private final DataElementRepository dataElementRepository;
    private final ConditionModelRepository conditionModelRepository;
    private final ConditionModelCategoryRepository categoryRepository;
    private final DataSetRepository dataSetRepository;
    private final ResultConfigRepository resultConfigRepository;
    private final AdapterConfigRepository adapterConfigRepository;
    private final JdbcTemplate jdbcTemplate;

    private void ensureTableExists() {
        try {
            jdbcTemplate.queryForObject("SELECT COUNT(*) FROM rule", Integer.class);
        } catch (Exception e) {
            log.info("Creating missing 'rule' table...");
            jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS rule (" +
                "  id BIGINT AUTO_INCREMENT PRIMARY KEY," +
                "  code VARCHAR(64) NOT NULL UNIQUE," +
                "  name VARCHAR(128) NOT NULL," +
                "  version VARCHAR(16) DEFAULT '1.0.0'," +
                "  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT'," +
                "  rule_type_id BIGINT NOT NULL," +
                "  canvas_data LONGTEXT," +
                "  drools_drl LONGTEXT," +
                "  remark VARCHAR(512)," +
                "  created_at DATETIME DEFAULT CURRENT_TIMESTAMP," +
                "  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
            );
            log.info("'rule' table created.");
        }
    }

    private void ensureExecutionLogTableExists() {
        try {
            jdbcTemplate.queryForObject("SELECT COUNT(*) FROM rule_execution_log", Integer.class);
        } catch (Exception e) {
            log.info("Creating missing 'rule_execution_log' table...");
            jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS rule_execution_log (" +
                "  id BIGINT AUTO_INCREMENT PRIMARY KEY," +
                "  rule_id BIGINT NOT NULL," +
                "  rule_code VARCHAR(64)," +
                "  rule_version VARCHAR(16)," +
                "  params_json LONGTEXT," +
                "  output_json LONGTEXT," +
                "  hit_node_ids LONGTEXT," +
                "  fired_count INT," +
                "  duration_ms BIGINT," +
                "  status VARCHAR(16) NOT NULL," +
                "  error_message LONGTEXT," +
                "  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP," +
                "  INDEX idx_rule_id (rule_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
            );
            log.info("'rule_execution_log' table created.");
        }
    }

    private void ensureAccessLogTableExists() {
        try {
            jdbcTemplate.queryForObject("SELECT COUNT(*) FROM access_log", Integer.class);
        } catch (Exception e) {
            log.info("Creating missing 'access_log' table...");
            jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS access_log (" +
                "  id BIGINT AUTO_INCREMENT PRIMARY KEY," +
                "  page_name VARCHAR(128)," +
                "  request_path VARCHAR(512)," +
                "  request_method VARCHAR(16)," +
                "  client_ip VARCHAR(64)," +
                "  user_agent VARCHAR(512)," +
                "  access_time DATETIME DEFAULT CURRENT_TIMESTAMP," +
                "  INDEX idx_access_time (access_time)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
            );
            log.info("'access_log' table created.");
        }
    }

    private void ensureRuleVersionTableExists() {
        try {
            jdbcTemplate.queryForObject("SELECT COUNT(*) FROM rule_version", Integer.class);
        } catch (Exception e) {
            log.info("Creating missing 'rule_version' table...");
            jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS rule_version (" +
                "  id BIGINT AUTO_INCREMENT PRIMARY KEY," +
                "  rule_id BIGINT NOT NULL," +
                "  version INT NOT NULL," +
                "  canvas_data LONGTEXT," +
                "  drools_drl LONGTEXT," +
                "  change_note VARCHAR(255)," +
                "  created_at DATETIME DEFAULT CURRENT_TIMESTAMP," +
                "  INDEX idx_rule_id (rule_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
            );
            log.info("'rule_version' table created.");
        }
    }

    private void ensureProcessDefinitionTableExists() {
        try {
            jdbcTemplate.queryForObject("SELECT COUNT(*) FROM process_definition", Integer.class);
        } catch (Exception e) {
            log.info("Creating missing 'process_definition' table...");
            jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS process_definition (" +
                "  id BIGINT AUTO_INCREMENT PRIMARY KEY," +
                "  code VARCHAR(64) NOT NULL UNIQUE," +
                "  name VARCHAR(128) NOT NULL," +
                "  description VARCHAR(512)," +
                "  version VARCHAR(16) DEFAULT '1.0.0'," +
                "  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT'," +
                "  canvas_data LONGTEXT," +
                "  node_configs LONGTEXT," +
                "  created_at DATETIME DEFAULT CURRENT_TIMESTAMP," +
                "  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," +
                "  deleted TINYINT(1) DEFAULT 0," +
                "  deleted_at DATETIME" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
            );
            log.info("'process_definition' table created.");
        }
    }

    private void ensureProcessInstanceTableExists() {
        try {
            jdbcTemplate.queryForObject("SELECT COUNT(*) FROM process_instance", Integer.class);
        } catch (Exception e) {
            log.info("Creating missing 'process_instance' table...");
            jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS process_instance (" +
                "  id BIGINT AUTO_INCREMENT PRIMARY KEY," +
                "  process_def_id BIGINT NOT NULL," +
                "  process_code VARCHAR(64) NOT NULL," +
                "  business_key VARCHAR(128)," +
                "  status VARCHAR(16) NOT NULL DEFAULT 'RUNNING'," +
                "  variables LONGTEXT," +
                "  current_node_ids VARCHAR(512)," +
                "  execution_log LONGTEXT," +
                "  error_message VARCHAR(1024)," +
                "  created_at DATETIME DEFAULT CURRENT_TIMESTAMP," +
                "  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," +
                "  end_time DATETIME," +
                "  INDEX idx_process_def_id (process_def_id)," +
                "  INDEX idx_business_key (business_key)," +
                "  INDEX idx_status (status)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
            );
            log.info("'process_instance' table created.");
        }
    }

    private void ensureClinicalPathwayTablesExist() {
        try {
            jdbcTemplate.queryForObject("SELECT COUNT(*) FROM clinical_pathway", Integer.class);
        } catch (Exception e) {
            log.info("Creating clinical_pathway tables...");
            jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS clinical_pathway (" +
                "  id BIGINT AUTO_INCREMENT PRIMARY KEY," +
                "  code VARCHAR(64) NOT NULL UNIQUE," +
                "  name VARCHAR(128) NOT NULL," +
                "  description VARCHAR(512)," +
                "  version VARCHAR(16) DEFAULT '1.0.0'," +
                "  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT'," +
                "  indication VARCHAR(512)," +
                "  admission_rule_code VARCHAR(64)," +
                "  process_def_id BIGINT," +
                "  created_at DATETIME DEFAULT CURRENT_TIMESTAMP," +
                "  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," +
                "  deleted TINYINT(1) DEFAULT 0," +
                "  deleted_at DATETIME" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
            );
            jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS pathway_stage (" +
                "  id BIGINT AUTO_INCREMENT PRIMARY KEY," +
                "  pathway_id BIGINT NOT NULL," +
                "  name VARCHAR(128) NOT NULL," +
                "  code VARCHAR(64)," +
                "  sort_order INT DEFAULT 0," +
                "  description VARCHAR(512)," +
                "  exit_rule_code VARCHAR(64)," +
                "  created_at DATETIME DEFAULT CURRENT_TIMESTAMP," +
                "  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," +
                "  INDEX idx_pathway_id (pathway_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
            );
            jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS pathway_task (" +
                "  id BIGINT AUTO_INCREMENT PRIMARY KEY," +
                "  stage_id BIGINT NOT NULL," +
                "  name VARCHAR(128) NOT NULL," +
                "  code VARCHAR(64)," +
                "  task_type VARCHAR(16) NOT NULL," +
                "  process_node_id VARCHAR(64)," +
                "  config LONGTEXT," +
                "  required TINYINT(1) DEFAULT 1," +
                "  sort_order INT DEFAULT 0," +
                "  created_at DATETIME DEFAULT CURRENT_TIMESTAMP," +
                "  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," +
                "  INDEX idx_stage_id (stage_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
            );
            jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS pathway_instance (" +
                "  id BIGINT AUTO_INCREMENT PRIMARY KEY," +
                "  pathway_id BIGINT NOT NULL," +
                "  patient_id VARCHAR(64)," +
                "  visit_id VARCHAR(64)," +
                "  business_key VARCHAR(128)," +
                "  status VARCHAR(16) NOT NULL DEFAULT 'ADMISSION_PENDING'," +
                "  current_stage_id BIGINT," +
                "  current_stage_entry_time DATETIME," +
                "  variables LONGTEXT," +
                "  execution_log LONGTEXT," +
                "  created_at DATETIME DEFAULT CURRENT_TIMESTAMP," +
                "  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," +
                "  end_time DATETIME," +
                "  INDEX idx_pathway_id (pathway_id)," +
                "  INDEX idx_patient_id (patient_id)," +
                "  INDEX idx_business_key (business_key)," +
                "  INDEX idx_status (status)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
            );
            log.info("Clinical pathway tables created.");
        }
    }

    private void migrateDataElementIds() {
        // 反向迁移：把 condition_model_data_elements 中的数据复制回 condition_model.data_element_id
        try {
            List<java.util.Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT condition_model_id, data_element_id FROM condition_model_data_elements"
            );
            for (java.util.Map<String, Object> row : rows) {
                Long modelId = ((Number) row.get("condition_model_id")).longValue();
                Long deId = ((Number) row.get("data_element_id")).longValue();
                jdbcTemplate.update(
                    "UPDATE condition_model SET data_element_id = ? WHERE id = ? AND (data_element_id IS NULL OR data_element_id = 0)",
                    deId, modelId
                );
            }
            log.info("Reverse migration: {} rows restored.", rows.size());
        } catch (Exception e) {
            log.warn("Reverse migration skipped: {}", e.getMessage());
        }
    }

    @Override
    @Transactional
    public void run(String... args) {
        ensureTableExists();
        ensureExecutionLogTableExists();
        ensureRuleVersionTableExists();
        ensureAccessLogTableExists();
        ensureProcessDefinitionTableExists();
        ensureProcessInstanceTableExists();
        ensureClinicalPathwayTablesExist();
        migrateDataElementIds();
        log.info("开始检查并初始化基础数据...");

        initDictionaries();
        initDataSets();
        initDataElements();
        initRuleTypes();
        initConditionModelCategories();
        initConditionModels();
        syncResultCategory();
        initForbiddenTypeCondition();
        initResultConfigs();

        initAdapterConfig();

        log.info("基础数据初始化完成");
    }

    private void initAdapterConfig() {
        try {
            List<AdapterConfig> existing = adapterConfigRepository.findAll();
            if (!existing.isEmpty()) {
                log.info("适配器配置已存在，跳过初始化");
                return;
            }
            AdapterConfig cfg = new AdapterConfig();
            cfg.setEnabled(false);
            cfg.setBaseUrl("");
            cfg.setAdapterPath("/api/v1/adapter/emr");
            cfg.setAuthType("none");
            cfg.setAuthToken("");
            cfg.setApiKey("");
            cfg.setConnectTimeoutMs(5000);
            cfg.setReadTimeoutMs(10000);
            adapterConfigRepository.save(cfg);
            log.info("适配器默认配置已创建");
        } catch (Exception e) {
            log.warn("适配器配置初始化失败: {}", e.getMessage());
        }
    }

    private void resetAllRulesToDraft() {
        try {
            int updated = jdbcTemplate.update("UPDATE rule SET status = 'DRAFT' WHERE status = 'PUBLISHED'");
            if (updated > 0) {
                log.info("已将 {} 条已发布规则重置为 DRAFT 状态", updated);
            }
        } catch (Exception e) {
            log.warn("重置规则状态失败: {}", e.getMessage());
        }
    }

    private void initDictionaries() {
        if (dictionaryRepository.count() > 0) {
            log.info("字典数据已存在，跳过");
            return;
        }
        saveDictionary("GENDER", "性别", new Object[][]{{"M", "男", "1"}, {"F", "女", "2"}, {"U", "未知", "9"}});
        initIcd10Dictionary();
        initMedicalDictionaries();
        saveDictionary("NURSING_LEVEL", "护理分级", new Object[][]{{"LEVEL_1", "特级护理", "1"}, {"LEVEL_2", "一级护理", "2"}, {"LEVEL_3", "二级护理", "3"}, {"LEVEL_4", "三级护理", "4"}});
        saveDictionary("FORBIDDEN_TYPE", "禁忌类别", new Object[][]{{"ABSOLUTE", "绝对禁忌", "ABSOLUTE"}, {"RELATIVE", "相对禁忌", "RELATIVE"}, {"WARNING", "预警提醒", "WARNING"}, {"MESSAGE", "消息提醒", "MESSAGE"}});
        initSurgeryDictionary();
    }

    private void initSurgeryDictionary() {
        // ICD-9-CM3 手术操作编码字典头（条目通过 docs/icd9_cm3_surgery_dict.sql 导入）
        if (dictionaryRepository.findByCode("ICD9_CM3_SURGERY").isPresent()) {
            return;
        }
        Dictionary dict = new Dictionary();
        dict.setCode("ICD9_CM3_SURGERY");
        dict.setName("国家临床版2.0手术操作编码（ICD-9-CM3）");
        dict.setDescription("ICD-9-CM3手术操作编码标准字典，条目通过SQL脚本导入");
        dictionaryRepository.save(dict);
        log.info("ICD-9-CM3手术字典头已创建，请运行 docs/icd9_cm3_surgery_dict.sql 导入条目");
    }

    private void initMedicalDictionaries() {
        // 阳性症状
        saveDictionary("SYMPTOM_POSITIVE", "阳性症状",
                new Object[][]{
                        {"FEVER", "发热", "发热"},
                        {"HEADACHE", "头痛", "头痛"},
                        {"CHEST_PAIN", "胸痛", "胸痛"},
                        {"DYSPNEA", "呼吸困难", "呼吸困难"},
                        {"COUGH", "咳嗽", "咳嗽"},
                        {"HEMATEMESIS", "呕血", "呕血"},
                        {"HEMATOCHEZIA", "便血", "便血"},
                        {"ABDOMINAL_PAIN", "腹痛", "腹痛"},
                        {"NAUSEA", "恶心", "恶心"},
                        {"VOMITING", "呕吐", "呕吐"},
                        {"DIARRHEA", "腹泻", "腹泻"},
                        {"CONSTIPATION", "便秘", "便秘"},
                        {"EDEMA", "水肿", "水肿"},
                        {"PALPITATION", "心悸", "心悸"},
                        {"DIZZINESS", "头晕", "头晕"},
                        {"FATIGUE", "乏力", "乏力"},
                        {"WEIGHT_LOSS", "消瘦", "消瘦"},
                        {"CHILLS", "寒战", "寒战"},
                        {"SWEATING", "出汗", "出汗"},
                        {"FEVER_NIGHT", "夜间发热", "夜间发热"}
                });

        // 阴性症状
        saveDictionary("SYMPTOM_NEGATIVE", "阴性症状",
                new Object[][]{
                        {"NO_FEVER", "无发热", "无发热"},
                        {"NO_HEADACHE", "无头痛", "无头痛"},
                        {"NO_CHEST_PAIN", "无胸痛", "无胸痛"},
                        {"NO_DYSPNEA", "无呼吸困难", "无呼吸困难"},
                        {"NO_COUGH", "无咳嗽", "无咳嗽"},
                        {"NO_ABDOMINAL_PAIN", "无腹痛", "无腹痛"},
                        {"NO_NAUSEA", "无恶心", "无恶心"},
                        {"NO_VOMITING", "无呕吐", "无呕吐"}
                });

        // 阳性体征
        saveDictionary("SIGN_POSITIVE", "阳性体征",
                new Object[][]{
                        {"TENDERNESS", "压痛", "压痛"},
                        {"REBOUND_TENDERNESS", "反跳痛", "反跳痛"},
                        {"MURPHY_SIGN", "墨菲氏征阳性", "墨菲氏征阳性"},
                        {"MCBURNEY_TENDERNESS", "麦氏点压痛", "麦氏点压痛"},
                        {"HEPATOMEGALY", "肝大", "肝大"},
                        {"SPLENOMEGALY", "脾大", "脾大"},
                        {"LYMPHADENOPATHY", "淋巴结肿大", "淋巴结肿大"},
                        {"EDEMA_LOWER", "双下肢水肿", "双下肢水肿"},
                        {"RALES", "湿啰音", "湿啰音"},
                        {"WHEEZING", "哮鸣音", "哮鸣音"},
                        {"JAUNDICE", "黄疸", "黄疸"},
                        {"HEART_MURMUR", "心脏杂音", "心脏杂音"}
                });

        // 阴性体征
        saveDictionary("SIGN_NEGATIVE", "阴性体征",
                new Object[][]{
                        {"NO_TENDERNESS", "无压痛", "无压痛"},
                        {"NO_REBOUND", "无反跳痛", "无反跳痛"},
                        {"NO_EDEMA", "无水肿", "无水肿"},
                        {"NO_LYMPHADENOPATHY", "无淋巴结肿大", "无淋巴结肿大"},
                        {"NO_WHEEZING", "无哮鸣音", "无哮鸣音"}
                });

        // 否定词
        saveDictionary("NEGATION_WORDS", "否定词",
                new Object[][]{
                        {"NO", "无", "无"},
                        {"DENY", "否认", "否认"},
                        {"NOT_FOUND", "未发现", "未发现"},
                        {"NOT_VISIBLE", "未见", "未见"},
                        {"NOT_HAVE", "没有", "没有"},
                        {"NOT_CLEAR", "不清", "不清"},
                        {"NOT_EXACT", "不明确", "不明确"},
                        {"EXCLUDE", "排除", "排除"},
                        {"NOT_SEE", "未查见", "未查见"},
                        {"WITHOUT", "不伴", "不伴"},
                        {"NEGATIVE", "阴性", "阴性"}
                });

        // 手术
        saveDictionary("SURGERY", "手术",
                new Object[][]{
                        {"APPENDECTOMY", "阑尾切除术", "阑尾切除术"},
                        {"CHOLECYSTECTOMY", "胆囊切除术", "胆囊切除术"},
                        {"THYROIDECTOMY", "甲状腺切除术", "甲状腺切除术"},
                        {"MASTECTOMY", "乳房切除术", "乳房切除术"},
                        {"HYSTERECTOMY", "子宫切除术", "子宫切除术"},
                        {"CABG", "冠状动脉搭桥术", "冠状动脉搭桥术"},
                        {"PCI", "经皮冠状动脉介入治疗", "经皮冠状动脉介入治疗"},
                        {"APPENDECTOMY_LAP", "腹腔镜阑尾切除术", "腹腔镜阑尾切除术"},
                        {"CHOLECYSTECTOMY_LAP", "腹腔镜胆囊切除术", "腹腔镜胆囊切除术"},
                        {"COLECTOMY", "结肠切除术", "结肠切除术"}
                });

        // 检查
        saveDictionary("EXAM", "检查",
                new Object[][]{
                        {"CT", "CT", "CT"},
                        {"MRI", "核磁共振", "核磁共振"},
                        {"X_RAY", "X线", "X线"},
                        {"ULTRASOUND", "超声", "超声"},
                        {"ECG", "心电图", "心电图"},
                        {"EEG", "脑电图", "脑电图"},
                        {"GASTROSCOPY", "胃镜", "胃镜"},
                        {"COLONOSCOPY", "肠镜", "肠镜"},
                        {"BRONCHOSCOPY", "支气管镜", "支气管镜"},
                        {"BLOOD_TEST", "血常规", "血常规"},
                        {"URINE_TEST", "尿常规", "尿常规"},
                        {"BIOCHEMISTRY", "生化全套", "生化全套"},
                        {"TUMOR_MARKER", "肿瘤标志物", "肿瘤标志物"},
                        {"BMP", "B超", "B超"},
                        {"COLOR_DOPPLER", "彩超", "彩超"}
                });

        // 药品（扩展，覆盖常见质控场景）
        saveDictionary("DRUG", "药品",
                new Object[][]{
                        {"PENICILLIN", "青霉素", "PENICILLIN"},
                        {"CEFTRIAXONE", "头孢曲松", "CEFTRIAXONE"},
                        {"METFORMIN", "二甲双胍", "METFORMIN"},
                        {"ASPIRIN", "阿司匹林", "阿司匹林"},
                        {"CLOPIDOGREL", "氯吡格雷", "氯吡格雷"},
                        {"ATORVASTATIN", "阿托伐他汀", "阿托伐他汀"},
                        {"AMLODIPINE", "氨氯地平", "氨氯地平"},
                        {"CAPTOPRIL", "卡托普利", "卡托普利"},
                        {"FUROSEMIDE", "呋塞米", "呋塞米"},
                        {"DIGOXIN", "地高辛", "地高辛"},
                        {"INSULIN", "胰岛素", "胰岛素"},
                        {"GLIPIZIDE", "格列吡嗪", "格列吡嗪"},
                        {"OMEPRAZOLE", "奥美拉唑", "奥美拉唑"},
                        {"PANTOPRAZOLE", "泮托拉唑", "泮托拉唑"},
                        {"MORPHINE", "吗啡", "吗啡"},
                        {"TRAMADOL", "曲马多", "曲马多"},
                        {"PARACETAMOL", "对乙酰氨基酚", "对乙酰氨基酚"},
                        {"CEFAZOLIN", "头孢唑林", "头孢唑林"},
                        {"VANCOMYCIN", "万古霉素", "万古霉素"},
                        {"MEROPENEM", "美罗培南", "美罗培南"}
                });
    }

    private void initIcd10Dictionary() {
        Dictionary dict = new Dictionary();
        dict.setCode("ICD10");
        dict.setName("ICD10诊断编码");
        dictionaryRepository.save(dict);
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                getClass().getResourceAsStream("/data/icd10.txt"), StandardCharsets.UTF_8))) {
            String line;
            int sort = 1;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) continue;
                String[] parts = line.split("\\|", 2);
                if (parts.length < 2) continue;
                DictionaryItem di = new DictionaryItem();
                di.setDictCode("ICD10");
                di.setItemCode(parts[0]);
                di.setItemName(parts[1]);
                di.setItemValue(parts[0]);
                di.setSortOrder(sort++);
                di.setDictionary(dict);
                dictionaryItemRepository.save(di);
            }
            log.info("ICD10字典已初始化，共 {} 条", sort - 1);
        } catch (Exception e) {
            log.error("ICD10字典初始化失败", e);
        }
    }

    private void saveDictionary(String code, String name, Object[][] items) {
        Dictionary dict = new Dictionary();
        dict.setCode(code);
        dict.setName(name);
        dictionaryRepository.save(dict);
        int sort = 1;
        for (Object[] item : items) {
            DictionaryItem di = new DictionaryItem();
            di.setDictCode(code);
            di.setItemCode((String) item[0]);
            di.setItemName((String) item[1]);
            di.setItemValue((String) item[2]);
            di.setSortOrder(sort++);
            di.setDictionary(dict);
            dictionaryItemRepository.save(di);
        }
    }

    private void initDataSets() {
        if (dataSetRepository.count() > 0) {
            log.info("数据集已存在，跳过");
            return;
        }
        DataSet ds = new DataSet();
        ds.setCode("GENERAL");
        ds.setName("通用数据集");
        ds.setDescription("默认通用数据集");
        dataSetRepository.save(ds);
        log.info("通用数据集已创建");
    }

    private void initDataElements() {
        DataSet generalSet = dataSetRepository.findByCode("GENERAL").orElse(null);
        if (generalSet == null) {
            log.warn("通用数据集不存在，跳过数据元初始化");
            return;
        }
        Long datasetId = generalSet.getId();
        // 为现有数据元补充 datasetId
        boolean needFix = dataElementRepository.findAll().stream()
                .anyMatch(de -> de.getDatasetId() == null);
        if (needFix) {
            log.info("为现有数据元补充数据集...");
            for (DataElement de : dataElementRepository.findAll()) {
                if (de.getDatasetId() == null) {
                    de.setDatasetId(generalSet.getId());
                    dataElementRepository.save(de);
                }
            }
        }
        // 基础数据元（幂等创建）
        saveDataElement("PATIENT_AGE", "患者年龄", DataType.NUMERIC, null, "患者年龄，单位为岁", datasetId);
        saveDataElement("PATIENT_GENDER", "患者性别", DataType.DICTIONARY, "GENDER", null, datasetId);
        saveDataElement("DIAGNOSIS_CODE", "诊断编码", DataType.DICTIONARY_SET, "ICD10", null, datasetId);
        saveDataElement("DRUG_ORDER", "医嘱药品", DataType.DICTIONARY_SET, "DRUG", null, datasetId);
        saveDataElement("LAB_RESULT_VALUE", "检验结果值", DataType.NUMERIC, null, null, datasetId);
        saveDataElement("EMR_CONTENT", "病历文书内容", DataType.STRING, null, null, datasetId);
        saveDataElement("VITAL_BP", "血压", DataType.NUMERIC, null, "单位：mmHg", datasetId);
        saveDataElement("VITAL_TEMP", "体温", DataType.NUMERIC, null, "单位：℃", datasetId);
        // NLP 衍生数据元
        saveDataElement("POSITIVE_SYMPTOMS", "阳性症状", DataType.STRING_LIST, null, "NLP提取的阳性症状列表", datasetId);
        saveDataElement("NEGATIVE_SYMPTOMS", "阴性症状", DataType.STRING_LIST, null, "NLP提取的阴性症状列表", datasetId);
        saveDataElement("POSITIVE_SIGNS", "阳性体征", DataType.STRING_LIST, null, "NLP提取的阳性体征列表", datasetId);
        saveDataElement("NEGATIVE_SIGNS", "阴性体征", DataType.STRING_LIST, null, "NLP提取的阴性体征列表", datasetId);
        saveDataElement("POSITIVE_DRUGS", "阳性药品", DataType.STRING_LIST, null, "NLP提取的阳性药品列表", datasetId);
        saveDataElement("POSITIVE_EXAMS", "阳性检查", DataType.STRING_LIST, null, "NLP提取的阳性检查列表", datasetId);
        saveDataElement("POSITIVE_SURGERIES", "阳性手术", DataType.STRING_LIST, null, "NLP提取的阳性手术列表", datasetId);
        saveDataElement("POSITIVE_DISEASES", "阳性疾病", DataType.STRING_LIST, null, "NLP提取的阳性疾病列表", datasetId);

        // 适配器字段数据元（与 HIS 适配器返回字段名对应，通过 camelName 映射）
        saveDataElement("CHIEF_COMPLAINT", "主诉", DataType.STRING, null, "患者主诉内容", datasetId, "chiefComplaint");
        saveDataElement("PRESENT_ILLNESS", "现病史", DataType.STRING, null, "现病史内容", datasetId, "presentIllnessHistory");
        saveDataElement("PHYSICAL_EXAM", "体格检查", DataType.STRING, null, "体格检查内容", datasetId, "physicalExamination");
        saveDataElement("AUXILIARY_EXAM", "辅助检查", DataType.STRING, null, "辅助检查内容", datasetId, "auxiliaryExamination");
        saveDataElement("DIAGNOSIS", "诊断", DataType.STRING, null, "诊断内容", datasetId, "diagnosis");
        saveDataElement("FIRST_COURSE", "首次病程", DataType.STRING, null, "首次病程记录", datasetId, "firstCourseRecord");
        saveDataElement("DAILY_COURSE", "日常病程", DataType.STRING, null, "日常病程记录", datasetId, "dailyCourseRecord");
        saveDataElement("PAST_HISTORY", "既往史", DataType.STRING, null, "既往史内容", datasetId, "pastHistory");
        saveDataElement("ADMISSION_TIME", "入院时间", DataType.STRING, null, "入院时间，格式 yyyy-MM-dd HH:mm:ss", datasetId, "admissionTime");
        saveDataElement("MEDICAL_HISTORY_TIME", "病史采集时间", DataType.STRING, null, "病史采集时间，格式 yyyy-MM-dd HH:mm:ss", datasetId, "medicalHistoryTime");
        saveDataElement("PULSE", "脉搏", DataType.NUMERIC, null, "脉搏次数/分", datasetId, "pulse");
        saveDataElement("HEART_RATE", "心率", DataType.NUMERIC, null, "心率次数/分", datasetId, "heartRate");

        // 手术风险规则专用数据元
        saveDataElement("SURGERY_ORDER", "手术医嘱", DataType.STRING, null, "手术医嘱内容，用于匹配手术名称", datasetId, "surgeryOrder");
        saveDataElement("LAB_LVEF", "左室射血分数(LVEF)", DataType.NUMERIC, null, "心脏彩超LVEF值，单位%", datasetId, "lvefValue");
        saveDataElement("LAB_PT", "凝血酶原时间(PT)", DataType.NUMERIC, null, "凝血功能PT值，单位秒", datasetId, "ptValue");
        saveDataElement("LAB_APTT", "活化部分凝血活酶时间(APTT)", DataType.NUMERIC, null, "凝血功能APTT值，单位秒", datasetId, "apttValue");
        saveDataElement("LAB_PLATELET", "血小板计数", DataType.NUMERIC, null, "血常规血小板计数，单位×10^9/L", datasetId, "plateletCount");
        saveDataElement("LAB_BUN", "血尿素氮(BUN)", DataType.NUMERIC, null, "肾功能BUN值，单位mmol/L", datasetId, "bunValue");
        saveDataElement("LAB_CREA", "血肌酐(Cr)", DataType.NUMERIC, null, "肾功能肌酐值，单位μmol/L", datasetId, "creatinineValue");
        saveDataElement("LAB_GFR", "肾小球滤过率(GFR)", DataType.NUMERIC, null, "肾功能GFR值，单位ml/min/1.73m²", datasetId, "gfrValue");
        saveDataElement("ECOG_SCORE", "ECOG评分", DataType.NUMERIC, null, "ECOG体力状态评分，0-5分", datasetId, "ecogScore");
        saveDataElement("PREGNANCY_STATUS", "妊娠状态", DataType.STRING, null, "妊娠状态描述", datasetId, "pregnancyStatus");
    }

    private void saveDataElement(String code, String name, DataType dataType, String dictCode, String description, Long datasetId) {
        saveDataElement(code, name, dataType, dictCode, description, datasetId, null);
    }

    private void saveDataElement(String code, String name, DataType dataType, String dictCode, String description, Long datasetId, String camelName) {
        if (dataElementRepository.findByCode(code).isPresent()) {
            return;
        }
        DataElement de = new DataElement();
        de.setCode(code);
        de.setName(name);
        de.setDataType(dataType);
        de.setDictCode(dictCode);
        de.setDescription(description);
        de.setDatasetId(datasetId);
        de.setCamelName(camelName);
        dataElementRepository.save(de);
        log.info("创建数据元: {} (camelName={})", code, camelName);
    }

    private void initRuleTypes() {
        // 规则类型完全由前端管理（rule_type 表），不再硬编码初始化
        // 删除后在数据库中物理删除即可，重启不会自动恢复
    }

    private void initConditionModelCategories() {
        saveCategoryIfNotExists("PATIENT_INFO", "患者信息", "患者基本信息相关", 1);
        saveCategoryIfNotExists("ORDERS", "医嘱信息", "医嘱相关", 2);
        saveCategoryIfNotExists("DIAGNOSIS", "诊断信息", "诊断相关", 3);
        saveCategoryIfNotExists("MEDICAL_RECORD", "病历文书", "病历文书相关", 4);
        saveCategoryIfNotExists("VITAL_SIGNS", "生命体征", "生命体征相关", 5);
        saveCategoryIfNotExists("RESULT_CONDITION", "结果条件", "规则执行结果相关条件", 6);
        saveCategoryIfNotExists("LAB_RESULT", "检验结果", "检验检查结果相关", 7);
        saveCategoryIfNotExists("ASSESSMENT", "评估量表", "患者评估量表相关", 8);
        saveCategoryIfNotExists("SURGERY", "手术信息", "手术医嘱及相关", 9);
    }

    private void saveCategoryIfNotExists(String code, String name, String description, int sort) {
        if (categoryRepository.findByCode(code).isPresent()) {
            return;
        }
        ConditionModelCategory cat = new ConditionModelCategory();
        cat.setCode(code);
        cat.setName(name);
        cat.setDescription(description);
        cat.setSortOrder(sort);
        categoryRepository.save(cat);
        log.info("创建条件分类: {}", code);
    }

    private void initConditionModels() {
        boolean needFixCategory = conditionModelRepository.findAll().stream()
                .anyMatch(cm -> cm.getCategoryId() == null);
        if (needFixCategory) {
            log.info("条件缺少分类，开始修复...");
            fixConditionModelCategories();
        }

        ConditionModelCategory patientCat = categoryRepository.findByCode("PATIENT_INFO").orElse(null);
        ConditionModelCategory ordersCat = categoryRepository.findByCode("ORDERS").orElse(null);
        ConditionModelCategory diagnosisCat = categoryRepository.findByCode("DIAGNOSIS").orElse(null);
        ConditionModelCategory emrCat = categoryRepository.findByCode("MEDICAL_RECORD").orElse(null);
        ConditionModelCategory vitalCat = categoryRepository.findByCode("VITAL_SIGNS").orElse(null);

        DataElement age = findDe("PATIENT_AGE");
        DataElement gender = findDe("PATIENT_GENDER");
        DataElement diagnosis = findDe("DIAGNOSIS_CODE");
        DataElement drug = findDe("DRUG_ORDER");
        DataElement emr = findDe("EMR_CONTENT");
        DataElement bp = findDe("VITAL_BP");
        DataElement temp = findDe("VITAL_TEMP");
        DataElement posSymptoms = findDe("POSITIVE_SYMPTOMS");
        DataElement negSymptoms = findDe("NEGATIVE_SYMPTOMS");
        DataElement posSigns = findDe("POSITIVE_SIGNS");
        DataElement negSigns = findDe("NEGATIVE_SIGNS");

        if (age != null) saveConditionModel(age.getId(), patientCat != null ? patientCat.getId() : null, Arrays.asList("==", "!=", ">", "<"), ValueSource.PARAM, NodeUsage.CONDITION);
        if (gender != null) saveConditionModel(gender.getId(), patientCat != null ? patientCat.getId() : null, Collections.singletonList("=="), ValueSource.PARAM, NodeUsage.CONDITION);
        if (diagnosis != null) saveConditionModel(diagnosis.getId(), diagnosisCat != null ? diagnosisCat.getId() : null, Collections.singletonList("IN_SET"), ValueSource.PARAM, NodeUsage.CONDITION);
        if (drug != null) saveConditionModel(drug.getId(), ordersCat != null ? ordersCat.getId() : null, Collections.singletonList("IN_SET"), ValueSource.PARAM, NodeUsage.CONDITION);
        saveConditionModel(null, null, Collections.singletonList("=="), ValueSource.PARAM, NodeUsage.RESULT);
        if (emr != null) saveConditionModel(emr.getId(), emrCat != null ? emrCat.getId() : null, Arrays.asList("==", "contains", "regex_match", "regexMatch", "existenceConflict", "whitelistMatch", "dictMatch", "medicalNer", "negationCheck", "tokenSimilarity", "allNegated"), ValueSource.ADAPTER, NodeUsage.CONDITION);
        if (bp != null) saveConditionModel(bp.getId(), vitalCat != null ? vitalCat.getId() : null, Arrays.asList("==", "!=", ">", "<"), ValueSource.PARAM, NodeUsage.BOTH);
        if (temp != null) saveConditionModel(temp.getId(), vitalCat != null ? vitalCat.getId() : null, Arrays.asList("==", "!=", ">", "<"), ValueSource.PARAM, NodeUsage.BOTH);
        // NLP 衍生数据元的条件模型
        if (posSymptoms != null) saveConditionModel(posSymptoms.getId(), emrCat != null ? emrCat.getId() : null, Arrays.asList("contains", "arrayLength", "arrayIntersect"), ValueSource.ADAPTER, NodeUsage.CONDITION);
        if (negSymptoms != null) saveConditionModel(negSymptoms.getId(), emrCat != null ? emrCat.getId() : null, Arrays.asList("contains", "arrayLength", "arrayIntersect"), ValueSource.ADAPTER, NodeUsage.CONDITION);
        if (posSigns != null) saveConditionModel(posSigns.getId(), emrCat != null ? emrCat.getId() : null, Arrays.asList("contains", "arrayLength", "arrayIntersect"), ValueSource.ADAPTER, NodeUsage.CONDITION);
        if (negSigns != null) saveConditionModel(negSigns.getId(), emrCat != null ? emrCat.getId() : null, Arrays.asList("contains", "arrayLength", "arrayIntersect"), ValueSource.ADAPTER, NodeUsage.CONDITION);
        saveConditionModel(null, null, Collections.singletonList("=="), ValueSource.PARAM, NodeUsage.RESULT);

        // 适配器字段条件模型（病历文书相关）
        initAdapterConditionModels(emrCat, vitalCat, patientCat);
        // 手术风险规则专用条件模型
        initSurgeryRiskConditionModels();
    }

    private void initAdapterConditionModels(ConditionModelCategory emrCat, ConditionModelCategory vitalCat, ConditionModelCategory patientCat) {
        DataElement chiefComplaint = findDe("CHIEF_COMPLAINT");
        DataElement presentIllness = findDe("PRESENT_ILLNESS");
        DataElement physicalExam = findDe("PHYSICAL_EXAM");
        DataElement auxiliaryExam = findDe("AUXILIARY_EXAM");
        DataElement diagnosisContent = findDe("DIAGNOSIS");
        DataElement firstCourse = findDe("FIRST_COURSE");
        DataElement dailyCourse = findDe("DAILY_COURSE");
        DataElement pastHistory = findDe("PAST_HISTORY");
        DataElement admissionTime = findDe("ADMISSION_TIME");
        DataElement medicalHistoryTime = findDe("MEDICAL_HISTORY_TIME");
        DataElement pulse = findDe("PULSE");
        DataElement heartRate = findDe("HEART_RATE");

        // 主诉：正则匹配、medicalNer
        if (chiefComplaint != null) saveConditionModel(chiefComplaint.getId(), emrCat != null ? emrCat.getId() : null,
                Arrays.asList("regex_match", "medicalNer", "lengthCheck", "isBlank"), ValueSource.ADAPTER, NodeUsage.CONDITION);
        // 现病史：正则匹配、medicalNer、isBlank
        if (presentIllness != null) saveConditionModel(presentIllness.getId(), emrCat != null ? emrCat.getId() : null,
                Arrays.asList("regex_match", "medicalNer", "isBlank", "lengthCheck", "similarity"), ValueSource.ADAPTER, NodeUsage.CONDITION);
        // 体格检查：medicalNer、regex_match、fieldCompare（脉搏vs心率）
        if (physicalExam != null) saveConditionModel(physicalExam.getId(), emrCat != null ? emrCat.getId() : null,
                Arrays.asList("regex_match", "medicalNer", "isBlank", "similarity"), ValueSource.ADAPTER, NodeUsage.CONDITION);
        // 辅助检查：regex_match、similarity
        if (auxiliaryExam != null) saveConditionModel(auxiliaryExam.getId(), emrCat != null ? emrCat.getId() : null,
                Arrays.asList("regex_match", "similarity", "isBlank"), ValueSource.ADAPTER, NodeUsage.CONDITION);
        // 诊断：regex_match、dictMatch
        if (diagnosisContent != null) saveConditionModel(diagnosisContent.getId(), emrCat != null ? emrCat.getId() : null,
                Arrays.asList("regex_match", "dictMatch", "isBlank"), ValueSource.ADAPTER, NodeUsage.CONDITION);
        // 首次病程：similarity、regex_match
        if (firstCourse != null) saveConditionModel(firstCourse.getId(), emrCat != null ? emrCat.getId() : null,
                Arrays.asList("similarity", "regex_match", "isBlank", "lengthCheck"), ValueSource.ADAPTER, NodeUsage.CONDITION);
        // 日常病程：similarity
        if (dailyCourse != null) saveConditionModel(dailyCourse.getId(), emrCat != null ? emrCat.getId() : null,
                Arrays.asList("similarity", "regex_match", "isBlank"), ValueSource.ADAPTER, NodeUsage.CONDITION);
        // 既往史：existenceConflict
        if (pastHistory != null) saveConditionModel(pastHistory.getId(), emrCat != null ? emrCat.getId() : null,
                Arrays.asList("existenceConflict", "regex_match", "isBlank"), ValueSource.ADAPTER, NodeUsage.CONDITION);
        // 入院时间 / 病史采集时间：fieldCompare（双字段时间差）
        if (admissionTime != null) saveConditionModel(admissionTime.getId(), patientCat != null ? patientCat.getId() : null,
                Arrays.asList("fieldCompare", "timeCheck"), ValueSource.ADAPTER, NodeUsage.CONDITION);
        if (medicalHistoryTime != null) saveConditionModel(medicalHistoryTime.getId(), patientCat != null ? patientCat.getId() : null,
                Arrays.asList("fieldCompare", "timeCheck"), ValueSource.ADAPTER, NodeUsage.CONDITION);
        // 脉搏 / 心率：fieldCompare（双字段数值比对）
        if (pulse != null) saveConditionModel(pulse.getId(), vitalCat != null ? vitalCat.getId() : null,
                Arrays.asList("fieldCompare", "dataCheck"), ValueSource.ADAPTER, NodeUsage.CONDITION);
        if (heartRate != null) saveConditionModel(heartRate.getId(), vitalCat != null ? vitalCat.getId() : null,
                Arrays.asList("fieldCompare", "dataCheck"), ValueSource.ADAPTER, NodeUsage.CONDITION);
    }

    private void initSurgeryRiskConditionModels() {
        ConditionModelCategory surgeryCat = categoryRepository.findByCode("SURGERY").orElse(null);
        ConditionModelCategory labCat = categoryRepository.findByCode("LAB_RESULT").orElse(null);
        ConditionModelCategory assessmentCat = categoryRepository.findByCode("ASSESSMENT").orElse(null);
        ConditionModelCategory diagnosisCat = categoryRepository.findByCode("DIAGNOSIS").orElse(null);
        ConditionModelCategory patientCat = categoryRepository.findByCode("PATIENT_INFO").orElse(null);

        DataElement surgeryOrder = findDe("SURGERY_ORDER");
        DataElement lvef = findDe("LAB_LVEF");
        DataElement pt = findDe("LAB_PT");
        DataElement aptt = findDe("LAB_APTT");
        DataElement platelet = findDe("LAB_PLATELET");
        DataElement bun = findDe("LAB_BUN");
        DataElement crea = findDe("LAB_CREA");
        DataElement gfr = findDe("LAB_GFR");
        DataElement ecog = findDe("ECOG_SCORE");
        DataElement pregnancy = findDe("PREGNANCY_STATUS");
        DataElement diagnosis = findDe("DIAGNOSIS");
        DataElement emr = findDe("EMR_CONTENT");
        DataElement age = findDe("PATIENT_AGE");
        DataElement gender = findDe("PATIENT_GENDER");

        // 手术医嘱：contains匹配（手术名称）
        if (surgeryOrder != null) saveConditionModel(surgeryOrder.getId(), surgeryCat != null ? surgeryCat.getId() : null,
                Arrays.asList("contains", "=="), ValueSource.ADAPTER, NodeUsage.CONDITION);
        // 检验细项：数值比较
        if (lvef != null) saveConditionModel(lvef.getId(), labCat != null ? labCat.getId() : null,
                Arrays.asList(">", "<", ">=", "<=", "=="), ValueSource.ADAPTER, NodeUsage.CONDITION);
        if (pt != null) saveConditionModel(pt.getId(), labCat != null ? labCat.getId() : null,
                Arrays.asList(">", "<", ">=", "<=", "=="), ValueSource.ADAPTER, NodeUsage.CONDITION);
        if (aptt != null) saveConditionModel(aptt.getId(), labCat != null ? labCat.getId() : null,
                Arrays.asList(">", "<", ">=", "<=", "=="), ValueSource.ADAPTER, NodeUsage.CONDITION);
        if (platelet != null) saveConditionModel(platelet.getId(), labCat != null ? labCat.getId() : null,
                Arrays.asList(">", "<", ">=", "<=", "=="), ValueSource.ADAPTER, NodeUsage.CONDITION);
        if (bun != null) saveConditionModel(bun.getId(), labCat != null ? labCat.getId() : null,
                Arrays.asList(">", "<", ">=", "<=", "=="), ValueSource.ADAPTER, NodeUsage.CONDITION);
        if (crea != null) saveConditionModel(crea.getId(), labCat != null ? labCat.getId() : null,
                Arrays.asList(">", "<", ">=", "<=", "=="), ValueSource.ADAPTER, NodeUsage.CONDITION);
        if (gfr != null) saveConditionModel(gfr.getId(), labCat != null ? labCat.getId() : null,
                Arrays.asList(">", "<", ">=", "<=", "=="), ValueSource.ADAPTER, NodeUsage.CONDITION);
        // 评估量表
        if (ecog != null) saveConditionModel(ecog.getId(), assessmentCat != null ? assessmentCat.getId() : null,
                Arrays.asList(">", "<", ">=", "<=", "=="), ValueSource.ADAPTER, NodeUsage.CONDITION);
        // 妊娠状态
        if (pregnancy != null) saveConditionModel(pregnancy.getId(), patientCat != null ? patientCat.getId() : null,
                Arrays.asList("contains", "=="), ValueSource.ADAPTER, NodeUsage.CONDITION);
        // 诊断：已有的diagnosis适配器字段，补充手术风险相关操作符
        if (diagnosis != null) saveConditionModel(diagnosis.getId(), diagnosisCat != null ? diagnosisCat.getId() : null,
                Arrays.asList("regex_match", "dictMatch", "isBlank", "contains"), ValueSource.ADAPTER, NodeUsage.CONDITION);
        // 病历文书：contains匹配（诊断描述等）
        if (emr != null) {
            // EMR_CONTENT 已在上面创建，这里不重复
        }
    }

    private void fixConditionModelCategories() {
        ConditionModelCategory patientCat = categoryRepository.findByCode("PATIENT_INFO").orElse(null);
        ConditionModelCategory ordersCat = categoryRepository.findByCode("ORDERS").orElse(null);
        ConditionModelCategory diagnosisCat = categoryRepository.findByCode("DIAGNOSIS").orElse(null);
        ConditionModelCategory emrCat = categoryRepository.findByCode("MEDICAL_RECORD").orElse(null);
        ConditionModelCategory vitalCat = categoryRepository.findByCode("VITAL_SIGNS").orElse(null);

        List<ConditionModel> models = conditionModelRepository.findAll();
        for (ConditionModel cm : models) {
            if (cm.getCategoryId() != null) continue;
            String code = cm.getCode();
            if (code == null) continue;
            if (code.equals("PATIENT_AGE") || code.equals("PATIENT_GENDER")) {
                cm.setCategoryId(patientCat != null ? patientCat.getId() : null);
            } else if (code.equals("DIAGNOSIS_CODE")) {
                cm.setCategoryId(diagnosisCat != null ? diagnosisCat.getId() : null);
            } else if (code.equals("DRUG_ORDER")) {
                cm.setCategoryId(ordersCat != null ? ordersCat.getId() : null);
            } else if (code.equals("EMR_CONTENT")) {
                cm.setCategoryId(emrCat != null ? emrCat.getId() : null);
            } else if (code.equals("POSITIVE_SYMPTOMS") || code.equals("NEGATIVE_SYMPTOMS") ||
                       code.equals("POSITIVE_SIGNS") || code.equals("NEGATIVE_SIGNS") ||
                       code.equals("POSITIVE_DRUGS") || code.equals("POSITIVE_EXAMS") ||
                       code.equals("POSITIVE_SURGERIES") || code.equals("POSITIVE_DISEASES")) {
                cm.setCategoryId(emrCat != null ? emrCat.getId() : null);
            } else if (code.equals("VITAL_BP") || code.equals("VITAL_TEMP")) {
                cm.setCategoryId(vitalCat != null ? vitalCat.getId() : null);
            }
            conditionModelRepository.save(cm);
            log.info("修复条件模型 [{}] 的分类为 {}", code, cm.getCategoryId());
        }
    }

    private DataElement findDe(String code) {
        return dataElementRepository.findByCode(code).orElse(null);
    }

    private void saveConditionModel(Long dataElementId, Long categoryId, java.util.List<String> operators,
                                     ValueSource valueSource, NodeUsage nodeUsage) {
        String code;
        String name;
        DataType dataType;

        if (dataElementId != null) {
            DataElement de = dataElementRepository.findById(dataElementId)
                    .orElseThrow(() -> new RuntimeException("数据元不存在: " + dataElementId));
            // 优先使用驼峰名作为运行时字段名，兼容导入的数据元
            code = (de.getCamelName() != null && !de.getCamelName().isEmpty())
                    ? de.getCamelName() : de.getCode();
            name = de.getName();
            dataType = de.getDataType();
        } else {
            // 结果节点，没有关联数据元，跳过（结果节点不需要条件模型）
            return;
        }

        // 幂等：按 code 检查是否已存在
        List<ConditionModel> allModels = conditionModelRepository.findAll();
        for (ConditionModel existing : allModels) {
            if (code.equals(existing.getCode())) {
                // 已存在，更新操作符和分类（如果变更）
                boolean changed = false;
                if (categoryId != null && !categoryId.equals(existing.getCategoryId())) {
                    existing.setCategoryId(categoryId);
                    changed = true;
                }
                if (operators != null && !operators.equals(existing.getOperators())) {
                    existing.setOperators(new ArrayList<>(operators));
                    changed = true;
                }
                if (valueSource != null && !valueSource.equals(existing.getValueSource())) {
                    existing.setValueSource(valueSource);
                    changed = true;
                }
                if (changed) {
                    conditionModelRepository.save(existing);
                    log.info("更新条件模型: {} (分类={}, 操作符={})", code, categoryId, operators);
                }
                return;
            }
        }

        ConditionModel model = new ConditionModel();
        model.setDataElementId(dataElementId);
        model.setCategoryId(categoryId);
        model.setOperators(operators);
        model.setValueSource(valueSource);
        model.setNodeUsage(nodeUsage);
        model.setCode(code);
        model.setName(name);
        model.setDataType(dataType);
        conditionModelRepository.save(model);
        log.info("创建条件模型: {} (分类={}, 操作符={})", code, categoryId, operators);
    }

    private void syncResultCategory() {
        categoryRepository.findByCode("RESULT_CONDITION").ifPresent(cat -> {
            boolean changed = false;
            if (!"结果类型".equals(cat.getName())) {
                cat.setName("结果类型");
                changed = true;
            }
            if (!"规则结果相关条件".equals(cat.getDescription())) {
                cat.setDescription("规则结果相关条件");
                changed = true;
            }
            if (changed) {
                categoryRepository.save(cat);
                log.info("更新条件分类 [{}] 为: 结果类型", cat.getCode());
            }
        });
    }

    private void initForbiddenTypeCondition() {
        DataSet generalSet = dataSetRepository.findByCode("GENERAL").orElse(null);
        if (generalSet == null) {
            generalSet = new DataSet();
            generalSet.setCode("GENERAL");
            generalSet.setName("通用数据集");
            generalSet.setDescription("默认通用数据集");
            dataSetRepository.save(generalSet);
            log.info("创建通用数据集");
        }

        DataElement de = dataElementRepository.findByCode("FORBIDDEN_TYPE").orElse(null);
        if (de == null) {
            de = new DataElement();
            de.setCode("FORBIDDEN_TYPE");
            de.setName("禁忌类别");
            de.setDataType(DataType.DICTIONARY);
            de.setDictCode("FORBIDDEN_TYPE");
            de.setDatasetId(generalSet.getId());
            dataElementRepository.save(de);
            log.info("创建数据元: FORBIDDEN_TYPE");
        }

        ConditionModelCategory resultCat = categoryRepository.findByCode("RESULT_CONDITION").orElse(null);
        if (resultCat == null) {
            log.warn("结果类型分类不存在，跳过禁忌类别条件初始化");
            return;
        }

        // 创建/获取“禁忌类别”二级分类
        ConditionModelCategory subCat = categoryRepository.findByCode("FORBIDDEN_TYPE_CAT").orElse(null);
        if (subCat == null) {
            subCat = new ConditionModelCategory();
            subCat.setCode("FORBIDDEN_TYPE_CAT");
            subCat.setName("禁忌类别");
            subCat.setDescription("禁忌类别二级分类");
            subCat.setParentId(resultCat.getId());
            subCat.setSortOrder(1);
            categoryRepository.save(subCat);
            log.info("创建二级分类: 禁忌类别 (parent={})", resultCat.getId());
        } else if (subCat.getParentId() == null) {
            subCat.setParentId(resultCat.getId());
            categoryRepository.save(subCat);
        }

        String fieldCode = (de.getCamelName() != null && !de.getCamelName().isEmpty())
                ? de.getCamelName() : de.getCode();

        // 查找或创建条件模型，categoryId 必须指向二级分类
        ConditionModel existingModel = null;
        List<ConditionModel> allModels = conditionModelRepository.findAll();
        for (ConditionModel m : allModels) {
            if (fieldCode.equals(m.getCode())) {
                existingModel = m;
                break;
            }
        }

        if (existingModel == null) {
            ConditionModel model = new ConditionModel();
            model.setDataElementId(de.getId());
            model.setCategoryId(subCat.getId());
            model.setOperators(Collections.singletonList("=="));
            model.setValueSource(ValueSource.PARAM);
            model.setNodeUsage(NodeUsage.CONDITION);
            model.setCode(fieldCode);
            model.setName(de.getName());
            model.setDataType(de.getDataType());
            conditionModelRepository.save(model);
            log.info("创建条件模型: {}", fieldCode);
        } else if (!subCat.getId().equals(existingModel.getCategoryId())) {
            existingModel.setCategoryId(subCat.getId());
            conditionModelRepository.save(existingModel);
            log.info("更新条件模型 {} 的分类为二级分类: {}", fieldCode, subCat.getId());
        }
    }

    private void initResultConfigs() {
        // 病历质控 - 缺陷提示（幂等创建）
        saveResultConfig("QC_DEFECT", "一般缺陷", "主诉缺少持续时间描述", 1,
                "主诉中未描述症状持续时间，请补充");
        saveResultConfig("QC_DEFECT", "一般缺陷", "缺现病史", 1,
                "现病史内容为空，请补充完整");
        saveResultConfig("QC_DEFECT", "一般缺陷", "体格检查脉搏与心率矛盾", 2,
                "体格检查中脉搏与心率数值不一致，请核对");
        saveResultConfig("QC_DEFECT", "一般缺陷", "病程记录雷同", 1,
                "两次以上病程记录相似度过高，请避免拷贝");
        saveResultConfig("QC_DEFECT", "一般缺陷", "入院时间与病史采集时间差>2小时", 2,
                "入院时间与病史采集时间差超过2小时，请及时完成病史采集");
        // 病历质控 - 一票否决
        saveResultConfig("QC_VETO", "一票否决", "缺诊断", 10,
                "诊断内容为空，为严重缺陷");
        // 推荐类型
        saveResultConfig("RECOMMEND", "推荐类型", "诊断推荐", 0,
                "建议完善相关检查以明确诊断");
        log.info("结果配置检查完成");
    }

    private void saveResultConfig(String resultType, String resultName, String content, int priority, String description) {
        // 幂等：按 content 作为唯一标识检查
        List<ResultConfig> all = resultConfigRepository.findAll();
        for (ResultConfig existing : all) {
            if (content.equals(existing.getContent())) {
                return; // 已存在，跳过
            }
        }
        ResultConfig rc = new ResultConfig();
        rc.setResultType(resultType);
        rc.setResultName(resultName);
        rc.setContent(content);
        rc.setPriority(priority);
        rc.setDescription(description);
        resultConfigRepository.save(rc);
        log.info("创建结果配置: {}", content);
    }
}
