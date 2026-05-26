# 规则引擎系统 — 设计与开发规范

## 设计目标

1. **可视化编排**：业务专家通过 ReactFlow 画布拖拽节点（条件 + 结果 + 逻辑 + 流程控制）即可完成规则编排，无需手写 DRL
2. **配置标准化**：数据元、条件模型、字典、结果配置均为可复用的标准化资产，规则之间通过组合复用而非复制
3. **运行时解耦**：通过数据适配层（DataAdapter）屏蔽业务系统差异；规则编译产物（DRL + KieContainer）与配置分离
4. **执行可观测**：每次执行落地 `RuleExecutionLog`，画布提供试运行 / 路径回放 / 节点级结果查看
5. **从单规则到决策路径**：在原子规则之上叠加「流程引擎」与「临床路径引擎」，支持多规则编排成 DAG / 阶段化决策流
6. **多场景支持**：合理性质控、病历内涵质控、医保稽核、护理决策、VTE 防治、临床路径推荐 等

---

## 1. 项目概述

基于 **Drools 7** 的可视化规则引擎，前端用 ReactFlow 编排，后端将画布编译为 DRL 文本并动态执行。系统目前覆盖三层执行能力：

- **L1 单规则执行**：一个规则 = 一张画布 → 一段 DRL → 一次 `KieSession.fireAllRules()`
- **L2 流程引擎执行**：多个规则节点 + 服务调用 + 人工节点 + 延时节点组成 DAG，由 `ProcessExecutionEngine` 编排
- **L3 决策路径执行**：临床路径阶段化（Stage → Task），由 `DecisionPathEngine` 按阶段顺序触发，并支持阶段退出条件

**运行环境：**

- Java 8（OpenJDK 1.8）/ Spring Boot 2.7.18 / Drools 7.74.1.Final
- Node.js 18+ / Vite 5 / React 18（Legacy `ReactDOM.render` 模式，兼容 360Chrome）
- MySQL 8 (`ddl-auto: update` + `DataInitializer` 兜底建表)
- 默认服务端口：后端 **8082**、前端 dev **3001**、前端预览 **5173**

---

## 2. 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 后端框架 | Spring Boot 2.7 | RESTful API + JPA |
| 规则引擎 | Drools 7.74 | DRL 动态编译，按 `rule.id` 缓存 KieContainer |
| ORM | Spring Data JPA + Hibernate 5.6 | `ddl-auto: update`；`canvas_json`/`drl_text` 为 LONGTEXT |
| 数据库 | MySQL 8 | 仅支持 MySQL，环境变量配置 |
| HTTP / 文件 | Apache POI / OkHttp / Jackson | Excel 导入导出、HIS 接口、JSON 序列化 |
| 前端框架 | React 18 (Legacy) | `ReactDOM.render`，兼容 360Chrome |
| 前端构建 | Vite 5.4 | dev `:3001`，预览 `:5173` |
| UI 组件 | Ant Design 5 | 禁用 Menu 组件 |
| 画布引擎 | ReactFlow 11 | 节点类型 ≥ 10 种 |
| HTTP 请求 | axios | 统一封装 baseURL + 拦截器 |

**关键兼容性约束**：必须支持 360Chrome —— React 强制 Legacy 模式、不用 AntD Menu、生产构建用 `vite preview`、`index.html` 内嵌 MutationObserver 防注入。

---

## 3. 架构总览

### 3.1 三层执行能力

```
                     ┌─────────────────────────────┐
                     │  前端画布 / 标准化页面       │
                     │  ReactFlow + ConfigPanel    │
                     └─────────────┬───────────────┘
                                   │
                                   ▼
                     ┌─────────────────────────────┐
                     │  Controller（REST API）      │
                     └──────┬───────────┬──────────┘
                            │           │
                ┌───────────▼─┐    ┌───▼──────────────┐
                │  RuleService │    │ ProcessService   │
                │              │    │ ClinicalPathway  │
                └──┬─────┬─────┘    └────┬─────────────┘
                   │     │               │
        ┌──────────▼┐   ┌▼──────────┐    │
        │DrlCompiler│   │RuleExecutor│   │
        │画布→DRL    │   │KieSession  │   │
        └────────────┘   └────┬───────┘   │
                              │           │
              ┌───────────────▼───────────▼────────────┐
              │  ProcessExecutionEngine                │  ← L2 流程
              │  DecisionPathEngine                    │  ← L3 临床路径
              └─────────────┬──────────────────────────┘
                            │
         ┌──────────────────▼─────────────────────────┐
         │  DataAdapter（ParamAdapter/SqlAdapter/Emr）│  ← 数据接入层
         │  DictScriptService / NlpScriptService      │  ← 全局脚本工具
         │  RuleScriptUtils                            │  ← 计算符工具方法
         └────────────────────────────────────────────┘
```

### 3.2 规则生命周期

```
画布编排 ──保存──▶ canvas_json
                     │
                  DrlCompiler
                     │
                  drl_text 持久化
                     │
                ┌────publish───┐
                │              ▼
                │     KieContainer 缓存
                │        (按 rule.id)
                │              │
            execute()          ▼
            test-execute    fireAllRules
            batch-test          │
                                ▼
                  RuleExecutionLog 落地 + 返回结果
```

每次发布同时落地 `RuleVersion`（版本快照），支持回滚到任意历史版本。

---

## 4. 数据库设计

### 4.1 实体关系总览

```
RuleType ──1:n──▶ Rule ──1:n──▶ RuleVersion
                   │
                   ├─canvas_json (ReactFlow JSON)
                   └─drl_text    (Drools DRL)

DataSet  ──1:n──▶ DataElement ──┐
                                 │
ConditionModelCategory ──1:n──▶ ConditionModel ──1:n──▶ ResultConfig
                                                          (结果节点关联多种结果配置)

Dictionary ──1:n──▶ DictionaryItem    (脚本/规则中按 dict_code 引用)

ClinicalPathway ──1:n──▶ PathwayStage ──1:n──▶ PathwayTask
        │                       │                  │
        │                       │                  └─task_type: RULE/SERVICE/HUMAN/CHECKLIST/AGENT
        │                       └─exit_rule_code   (阶段退出规则)
        └─PathwayInstance       (路径执行实例)

ProcessDefinition (canvas_data + node_configs) ──1:n──▶ ProcessInstance

AdapterConfig / DbConfig            (HIS / 外部库 接入配置)
AccessLog / RuleExecutionLog        (访问日志 / 规则执行日志)
```

### 4.2 核心表清单

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `rule_type` | 规则类型（合理性、病历质控、医保等）| `code`, `name`, `description`, `status` |
| `rule` | 规则主体 | `code`, `name`, `rule_type_id`, `version`, `canvas_json`, `drl_text`, `status`, `deleted` |
| `rule_version` | 规则版本快照 | `rule_id`, `version`, `canvas_snapshot`, `drl_snapshot`, `created_by` |
| `rule_execution_log` | 规则执行日志 | `rule_id`, `input_params`, `result_json`, `matched`, `duration_ms` |
| `dataset` | 数据集 | `code`, `name`, `description` |
| `data_element` | 数据元 | `code`, `name`, `data_type`, `dataset_id`, `dict_code` |
| `condition_model_category` | 条件分类 | `code`, `name`, `sort_order` |
| `condition_model` | 条件模型 | `code`, `name`, `data_type`, `operators`, `node_usage`(CONDITION/RESULT), `data_element_id`, `category_id` |
| `result_config` | 结果配置 | `condition_model_id`, `key`, `value_type`, `default_value` |
| `dictionary` / `dictionary_item` | 标准字典 | `code`, `dict_code`, `item_value`, `item_name` |
| `clinical_pathway` / `pathway_stage` / `pathway_task` / `pathway_instance` | 临床路径 | 见 §7 |
| `process_definition` / `process_instance` | 流程引擎 | `canvas_data`, `node_configs`, `variables`, `current_node_ids` |
| `adapter_config` | HIS / 外部数据源接入 | `type`, `base_url`, `auth_type`, `auth_token` |
| `db_config` | 外部 DB 数据源 | `host`, `port`, `username`, `encrypted_password` |
| `access_log` | 系统访问日志 | `user`, `module`, `action`, `payload` |

### 4.3 关键约束

- `data_element.dataset_id` NOT NULL：数据元必须属于数据集
- `condition_model.data_element_id`：可为 NULL（结果节点可不选数据元）
- `condition_model.category_id`：必须关联条件分类
- **删除保护**（Service 层 `deleteById` 检查并抛 `RuntimeException` → 由 `GlobalExceptionHandler` 转 HTTP 400）：
  - 规则类型下有规则 → 禁止删除
  - 数据集下有数据元 → 禁止删除
  - 条件分类下有条件 → 禁止删除
  - 字典下有字典项 → 禁止删除
- **软删除**：`rule.deleted` 标记，回收站可恢复或彻底删除

### 4.4 自动建表与初始化

- JPA `ddl-auto: update` 自动建表
- `Rule.canvas_json` / `drl_text` 字段 JPA 默认映射为 `CLOB`，MySQL 不识别 → `DataInitializer` 启动时手动 `CREATE TABLE rule (... LONGTEXT)`
- `DataInitializer` 按 `code` 幂等地补齐：字典 → 数据集 → 数据元 → 规则类型 → 条件分类 → 条件模型 → 结果配置；已存在则跳过

---

## 5. 后端设计

### 5.1 包结构

```
com.ruleengine
├── controller/    REST API 入口（18 个 Controller）
├── service/       业务逻辑层（含删除保护、导入导出、版本管理）
├── repository/    Spring Data JPA 接口
├── domain/        JPA 实体 + enums
├── dto/           ApiResponse、ClinicalContext、DecisionItem 等
├── drools/
│   ├── compiler/  DrlCompiler：画布 JSON → DRL
│   ├── runtime/   RuleExecutor + DecisionPathEngine
│   ├── adapter/   DataAdapter / EmrAdapter / SqlAdapter / ParamAdapter / HisClient
│   └── config/    DroolsConfig (KieServices Bean)
├── process/
│   └── engine/    ProcessExecutionEngine + StepExecutor (Rule/Service/Human/Delay/Script/Agent)
├── script/        DictScriptService / NlpScriptService / RuleScriptUtils
├── nlp/           NlpService + MedicalDictionaryExporter
└── config/        DataInitializer + GlobalExceptionHandler
```

### 5.2 核心组件

#### DrlCompiler（rule-engine-server/.../drools/compiler/DrlCompiler.java）

- 输入：ReactFlow `nodes[]` + `edges[]`
- 输出：标准 Drools DRL 文本（含 `package` / `import` / `global` / `rule "X" when ... then ... end`）
- 节点处理：
  - 条件节点 → `when` 子句的 LHS 表达式，由 `buildConditionExpression()` 翻译为 24 种计算符
  - 结果节点 → `then` 子句中向全局 `result` Map 写入结构化结果
  - AND / OR 节点 → 多前驱条件的逻辑组合
- 全局变量：`result` (Map)、`dictUtils` (DictScriptService)、`nlpUtils` (NlpScriptService)

**24 种计算符**（详见代码 `buildConditionExpression`）：

| 分类 | 计算符 |
|------|--------|
| 比较 | `==` `!=` `>` `<` `>=` `<=` |
| 区间 / 集合 | `between` `IN_SET` `contains` `arrayContains` |
| 正则 | `regex_match` `regex_not_match` `regexMatch` `multiRegexMatch` |
| 空值 | `isBlank` `isNotBlank` |
| 字典工具 | `dictMatch` `whitelistMatch` `existenceConflict` |
| 语义 | `contradictionCheck` `similarity` |
| 数组 | `arrayLength` `arrayIntersect` |
| 专项 | `dataCheck` `timeCheck` `lengthCheck` `fieldCompare` |

新增计算符的标准流程：`RuleScriptUtils` / `DictScriptService` 加方法 → `DrlCompiler.buildConditionExpression` 加 operator 分支 → 前端 `ConfigPanel` 加 UI（缺一不可）。

#### RuleExecutor（drools/runtime/RuleExecutor.java）

- `publish(rule)`：解析 `drl_text` → `KieHelper` 编译 → 缓存 `KieContainer`（按 `rule.id`）→ 更新 `RuleVersion`
- `execute(rule, params)`：取出缓存 KieContainer → `newKieSession()` → 注入全局 `result` / `dictUtils` / `nlpUtils` → 插入 `$param`（Map）→ `fireAllRules()` → 收集 result Map 列表
- `withdraw(rule)`：清除 KieContainer 缓存
- 异常处理：编译失败抛 `RuntimeException(发布异常: ...)`，前端提示 + 保留草稿

#### DecisionPathEngine（drools/runtime/DecisionPathEngine.java）

- 入口：`execute(pathwayId, ClinicalContext)` → 返回 `DecisionResponse`（含 `decisions[]` + `executionTrace[]`）
- 阶段循环：
  1. `shouldSkipStage()` —— 用 `exit_rule_code` 调用 RuleService 判断是否退出
  2. `executeTask()` —— 按 `task_type` 分发到 Rule / Service / Human / Checklist / Agent 处理
- 结果聚合：所有阶段命中的 `DecisionItem` 合并；执行轨迹 `StageExecution` 含状态（SUCCESS / NO_MATCH / SKIPPED / ERROR）

#### ProcessExecutionEngine（process/engine/ProcessExecutionEngine.java）

- DAG 调度：基于画布 `nodes` + `edges`，BFS 遍历，最大步数 500（防循环）
- 6 类 StepExecutor：`RuleStepExecutor` / `ServiceStepExecutor` / `HumanStepExecutor` / `DelayStepExecutor` / `ScriptStepExecutor` / `AgentStepExecutor`
- 同步执行（试运行）：`executeSync()` 返回 `node_results`（每个节点的输入输出）
- 异步执行（生产）：`startProcess()` 落地 `ProcessInstance`，状态 RUNNING / SUSPENDED / COMPLETED / FAILED / TERMINATED
- 挂起恢复：人工节点 / 延时节点设置 `suspended=true` → `resumeInstance()` 唤醒

#### DataAdapter（drools/adapter/）

- `ParamAdapter`：直接消费请求 Map（默认）
- `SqlAdapter`：根据 `DbConfig` 动态查询业务库，回填到执行参数
- `EmrAdapter`：调用 HIS 接口（HisClient + AdapterConfig），按数据元 `code` 拉取病历内容
- `AdapterFactory.choose(rule)`：按规则配置自动选适配器

#### DictScriptService（script/DictScriptService.java）

为规则脚本提供字典操作：

- `whitelistMatch(value, dictCode, allDictCode, dictAttr)`
- `dictMatchWithSelected(value, dictCode, selectedItems, dictAttr)`
- `existenceConflict(str1, str2, dictCode, dictAttr)`
- `contradictionCheck(...)` / `regexMatch(...)` / `multiConditionRegexMatch(...)`
- 支持 `dictAttr` 取 `itemName` / `itemCode` / `itemValue`

#### RuleScriptUtils（script/RuleScriptUtils.java）

提供与字典无关的通用计算工具：`isBetween / isBlank / arrayContains / arrayLength / arrayIntersect / dataCheck / timeCheck / lengthCheck / similarity / fieldCompare / regexMatch / multiConditionRegexMatch / inSet / whitelistMatch / existenceConflict / contradictionCheck`。

### 5.3 全局异常处理

`GlobalExceptionHandler`：

- `RuntimeException` → HTTP 400 `{ message }`
- 其他 → HTTP 500 + 详细堆栈（仅 DEBUG 日志）

前端通过 `e.response.data.message` 读取错误信息并 `Modal.error` 提示。

---

## 6. 前端设计

### 6.1 页面清单

| 模块 | 路由（`?page=`） | 说明 |
|------|------------------|------|
| 规则类型 | `RuleTypeMgr`（默认） | 左侧类型卡片 + 右侧规则表格 |
| 规则画布 | `RuleEditor` | **不在导航栏**，由规则类型页 / 列表跳转，URL 含 `type` + `ruleId` |
| 规则页面式编辑 | `RulePageEditor` | 标准化表单式规则配置（替代画布的简化版） |
| 流程编排 | `PipelineDesigner` | 流程定义画布（多规则编排成 DAG） |
| 临床路径 | `ClinicalPathwayMgr` | 路径 → 阶段 → 任务三级管理 + 阶段退出条件配置 |
| 规则执行测试 | `RuleExecute` | 单规则参数测试 |
| 决策测试 | `DecisionTest` | 临床路径 / 流程的执行测试 |
| 场景测试 | `ScenarioTest` | 一组业务场景批量回归 |
| 数据元管理 | `DataElementMgr` | 数据集 + 数据元（合并页） |
| 标准字典 | `DictionaryMgr` | 字典 + 字典项 |
| 条件管理 | `ConditionModelMgr` | 条件分类 + 条件（合并页） |
| 结果配置 | `ResultModelMgr` | 结果节点的 key/value 配置 |
| 数据源接入 | `DbConfigPage` / `AdapterConfigPage` | 业务库 / HIS 接口配置 |
| 访问日志 | `AccessLogMgr` | 操作审计 |
| 回收站 | `RecycleBin` | 已删除规则恢复 / 彻底删除 |
| 系统帮助 | `SystemHelp` | 操作手册 |

### 6.2 导航与兼容性

- 顶部原生 `<div>` 导航（**禁用 AntD Menu**）+ URL `?page=xxx` 切换 + `App.jsx` 监听
- 默认首页：规则类型管理
- React 18 强制 Legacy 模式（`ReactDOM.render`）
- 生产构建 + `vite preview --port 5173 --host` 提供给 360Chrome

### 6.3 画布编辑器

节点类型（>10 种）：
- 通用：开始 / 结束 / AND / OR
- 规则画布：条件 / 结果 / 子规则引用
- 流程画布：规则任务 / 服务任务 / 人工任务 / 延时 / 脚本 / 智能体
- 临床路径阶段：阶段节点（含退出条件）

ConfigPanel 流程：

1. 选条件分类（CategoryId）
2. 选条件模型（ConditionModel）→ 自动带出关联数据元 → 自动设置 `field`
3. 选计算符（24 种之一）→ 根据计算符类型动态显示输入框（值 / 字典 / 上下界 / 阈值 / 单位 等）
4. （可选）选字典 + 字典属性（itemName/itemCode/itemValue）

保存：提交 `nodes` + `edges` → 后端 `PUT /api/v1/rules/{id}/canvas` → 自动生成 DRL 草稿 → 用户点击「发布」才进入 KieContainer。

### 6.4 试运行 / 路径回放

- 单规则：`POST /api/v1/rules/{id}/test-execute` 传入参数 Map → 返回命中规则列表 + DRL 文本
- 批量：`POST /api/v1/rules/batch-test-execute` 传入参数数组 → 返回每条参数的命中详情
- 流程：`POST /api/v1/processes/{id}/execute` 同步执行 → 返回每个节点的输入输出
- 临床路径：`POST /api/v1/pathways/{id}/execute` → 返回 `executionTrace[]`，前端渲染阶段进度条 + 命中决策项

---

## 7. 临床路径与流程编排

### 7.1 临床路径数据模型

```
ClinicalPathway          路径定义（如：心衰诊疗路径）
  ├─ name / code / description
  └─ status: DRAFT / PUBLISHED / DISABLED

PathwayStage             阶段（按 sort_order 顺序执行）
  ├─ pathway_id, code, name, sort_order
  └─ exit_rule_code      阶段退出规则编码（命中则跳过本阶段）

PathwayTask              任务（同阶段内并列执行）
  ├─ stage_id, code, name, sort_order
  ├─ task_type: RULE / SERVICE / HUMAN / CHECKLIST / AGENT
  ├─ process_node_id     任务实际执行目标（规则编码 / 服务编码 / 人工任务模板）
  └─ config              JSON：动态参数

PathwayInstance          路径执行实例
  ├─ pathway_id, business_key
  ├─ status, started_at, ended_at
  └─ trace (JSON)        StageExecution 列表
```

### 7.2 决策响应结构（DecisionResponse）

```json
{
  "pathwayCode": "HF_PATH_001",
  "pathwayName": "心衰诊疗路径",
  "status": "COMPLETED",
  "context": { /* ClinicalContext */ },
  "decisions": [
    {
      "type": "MEDICATION",
      "action": "建议加用 SGLT2 抑制剂",
      "detail": "EF<40% 且 eGFR>30",
      "evidenceLevel": "I",
      "evidenceGrade": "A",
      "guideline": "ESC 2023 心衰指南"
    }
  ],
  "executionTrace": [
    {
      "stageCode": "STAGE_DIAGNOSIS",
      "stageName": "诊断阶段",
      "status": "SUCCESS",
      "matched": true,
      "firedCount": 3,
      "result": [...]
    }
  ]
}
```

### 7.3 流程引擎执行模型

- 画布 → ProcessDefinition.canvas_data + node_configs
- 启动 → ProcessInstance（异步线程池）
- DAG BFS：
  - AND 节点：等待所有前驱完成才向下
  - 条件节点：根据 refNodeId 的执行结果走 true / false 边
- 挂起：人工 / 延时节点设置 `suspended=true`，外部调用 `resumeInstance()` 唤醒
- 失败处理：节点异常 → `failInstance()` 标记 FAILED + errorMessage
- 步数上限：500（防死循环）

---

## 8. API 汇总

### 8.1 规则类型 / 规则
```
GET    /api/v1/rule-types                      列表
GET    /api/v1/rule-types/{id}
POST   /api/v1/rule-types
PUT    /api/v1/rule-types/{id}
DELETE /api/v1/rule-types/{id}                 有规则时返回 400
POST   /api/v1/rule-types/{id}/execute         按类型批量执行规则
POST   /api/v1/rule-types/execute              通过类型 code 执行

GET    /api/v1/rules?ruleTypeId={id}
GET    /api/v1/rules/{id}
POST   /api/v1/rules
PUT    /api/v1/rules/{id}
PUT    /api/v1/rules/{id}/canvas               保存画布 + 自动生成 DRL
POST   /api/v1/rules/{id}/publish              编译 + 缓存 KieContainer + 落版本
POST   /api/v1/rules/{id}/withdraw             撤回（清缓存）
POST   /api/v1/rules/{id}/disable
POST   /api/v1/rules/{id}/execute              生产执行
POST   /api/v1/rules/{id}/test-execute         试运行
POST   /api/v1/rules/batch-test-execute        批量试运行
POST   /api/v1/rules/execute                   通过 code 执行
DELETE /api/v1/rules/{id}                      软删除
GET    /api/v1/rules/deleted                   回收站列表
POST   /api/v1/rules/{id}/restore              恢复
DELETE /api/v1/rules/{id}/permanent            彻底删除

POST   /api/v1/rules/import                    导入 (Excel / JSON)
POST   /api/v1/rules/import-preview
POST   /api/v1/rules/import-confirm
GET    /api/v1/rules/export
POST   /api/v1/rules/export

GET    /api/v1/rules/{ruleId}/versions         版本历史
GET    /api/v1/rules/{ruleId}/versions/{id}
POST   /api/v1/rules/{ruleId}/rollback/{id}    回滚到指定版本

GET    /api/v1/rules/{ruleId}/logs             执行日志
GET    /api/v1/rule-logs/{id}
```

### 8.2 数据元 / 数据集
```
GET    /api/v1/data-sets
POST   /api/v1/data-sets
PUT    /api/v1/data-sets/{id}
DELETE /api/v1/data-sets/{id}                  有数据元时返回 400

GET    /api/v1/data-elements?datasetId={id}
POST   /api/v1/data-elements
PUT    /api/v1/data-elements/{id}
DELETE /api/v1/data-elements/{id}
POST   /api/v1/data-elements/import            Excel 导入
GET    /api/v1/data-elements/import-template   下载模板
```

### 8.3 条件 / 结果配置
```
GET    /api/v1/condition-model-categories
POST   /api/v1/condition-model-categories
PUT    /api/v1/condition-model-categories/{id}
DELETE /api/v1/condition-model-categories/{id} 有条件时返回 400

GET    /api/v1/condition-models
GET    /api/v1/condition-models/by-category/{categoryId}
POST   /api/v1/condition-models
POST   /api/v1/condition-models/sync           批量同步
PUT    /api/v1/condition-models/{id}
DELETE /api/v1/condition-models/{id}

GET    /api/v1/result-configs
GET    /api/v1/result-configs/by-condition/{conditionModelId}
POST   /api/v1/result-configs
PUT    /api/v1/result-configs/{id}
DELETE /api/v1/result-configs/{id}
```

### 8.4 字典
```
GET    /api/v1/dictionaries
POST   /api/v1/dictionaries
PUT    /api/v1/dictionaries/{id}
DELETE /api/v1/dictionaries/{id}

GET    /api/v1/dictionary-items?dictionaryId={id}
GET    /api/v1/dictionary-items/by-dict-code/{dictCode}
GET    /api/v1/dictionary-items/search
POST   /api/v1/dictionary-items
PUT    /api/v1/dictionary-items/{id}
DELETE /api/v1/dictionary-items/{id}
```

### 8.5 临床路径
```
GET    /api/v1/pathways
GET    /api/v1/pathways/published
GET    /api/v1/pathways/{id}
GET    /api/v1/pathways/{id}/full              含阶段+任务
POST   /api/v1/pathways
PUT    /api/v1/pathways/{id}
POST   /api/v1/pathways/{id}/publish
POST   /api/v1/pathways/{id}/stages            新增/排序阶段
POST   /api/v1/pathways/{id}/tasks             新增/排序任务
POST   /api/v1/pathways/{id}/execute           执行（DecisionPathEngine）
DELETE /api/v1/pathways/{id}
```

### 8.6 流程引擎
```
GET    /api/v1/processes
POST   /api/v1/processes
PUT    /api/v1/processes/{id}
PUT    /api/v1/processes/{id}/canvas
POST   /api/v1/processes/{id}/publish
POST   /api/v1/processes/{id}/withdraw
POST   /api/v1/processes/{id}/disable
POST   /api/v1/processes/{id}/rename
POST   /api/v1/processes/duplicate
DELETE /api/v1/processes/{id}
```

### 8.7 数据源 / 适配器 / 日志
```
GET/POST       /api/v1/db-config
POST           /api/v1/db-config/test
GET/POST       /api/v1/adapter-config
GET/POST/DEL   /api/v1/access-logs
DELETE         /api/v1/access-logs/clear
```

---

## 9. 关键设计决策

| 决策 | 说明 |
|------|------|
| MySQL only | 仅支持 MySQL，所有 DDL 用 `LONGTEXT` 而非 `CLOB`，`DataInitializer` 兜底建表 |
| `ddl-auto: update` + 兜底建表 | 大部分表交给 JPA；CLOB 字段表（rule）由 `DataInitializer` 手动建 |
| 数据初始化幂等 | 按 `code` 检查存在，已存在则跳过；不会覆盖用户修改 |
| 软删除 + 回收站 | `rule.deleted` 标记，`/deleted` + `/restore` + `/permanent` 三段式 |
| 规则版本快照 | 每次发布生成 RuleVersion；支持回滚到任意历史版本 |
| 计算符可扩展 | `RuleScriptUtils` / `DictScriptService` 加方法 + `DrlCompiler` 加分支 + `ConfigPanel` 加 UI |
| 条件 / 结果分离 | ConditionModel.node_usage = CONDITION/RESULT，结果节点不强制关联数据元 |
| 适配器模式 | DataAdapter 接口屏蔽数据来源（参数 / SQL / HIS），规则不感知 |
| L2 / L3 编排能力 | ProcessExecutionEngine（DAG）+ DecisionPathEngine（阶段化），共用底层 RuleService |
| 360Chrome 兼容 | React Legacy 模式 + 禁用 AntD Menu + 生产 vite preview + MutationObserver 防注入 |

---

## 10. 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MYSQL_HOST` | `192.168.2.166` | MySQL 主机 |
| `MYSQL_PORT` | `3306` | MySQL 端口 |
| `MYSQL_DB` | `ruleengine` | 数据库名 |
| `MYSQL_USER` | `root` | 用户名 |
| `MYSQL_PASSWORD` | `zoeddc@2017` | 密码（生产请覆写） |
| `USE_SOCAT` | 自动检测 | `true` 强制启用 socat 代理（VPN 直连失败时使用） |
| `SOCAT_PORT` | `13306` | 本地代理端口 |
| `MYSQL_REMOTE_HOST` | `192.168.2.166` | socat 转发目标 |
| `HIS_BASE_URL` | `""` | HIS 接口前缀（AdapterConfig 也可前端配置） |

---

## 11. 启动方式

### 后端

```bash
# 直接启动（机器与数据库网络畅通）
cd rule-engine-server && ./mvnw spring-boot:run

# 通过 socat 代理（VPN 链路 JDBC 握手失败的场景）
USE_SOCAT=true ./start.sh backend

# 打包
./mvnw clean package -DskipTests
java -jar rule-engine-server/target/rule-engine-server-1.0.0-SNAPSHOT.jar
```

服务端口：**8082**，健康检查：`http://localhost:8082/actuator/health`

### 前端

```bash
# 开发
cd rule-engine-ui && npm install && npm run dev   # :3001

# 生产 / 360Chrome
cd rule-engine-ui && npm run build && npx vite preview --port 5173 --host
```

### 一键

```bash
./start.sh all                     # 后端 + 前端
USE_SOCAT=true ./start.sh all      # 强制启用 socat
```

---

## 12. 测试

**当前没有自动化测试**：`rule-engine-server/src/test/java` 为空，所有 `mvnw` 都带 `-DskipTests`。

回归方式以**人工跑通画布全链路**为准：

1. 新建规则 → 画布编排 → 保存 → 检查 `rule.canvas_json` / `drl_text`
2. 发布 → 检查日志 `KieContainer` 创建无异常
3. 试运行 / 批量试运行 → 校对命中结果
4. 临床路径 / 流程编排执行 → 校对 `executionTrace`
5. 版本回滚 / 软删除恢复 / 导入导出闭环

**调试技巧**：

- `com.ruleengine` 日志默认 DEBUG，可看到生成的 DRL 文本
- DRL 编译报 `unable to resolve method using strict-mode` → 检查 `DrlCompiler.buildConditionExpression` 拼出的全局变量名是否正确（`dictUtils` / `nlpUtils`）
- `canvas_json` / `drl_text` schema 变更后旧规则**不会迁移**，需要删库重启或手工 UPDATE
