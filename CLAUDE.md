# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 文档关系

本仓库已存在两份详尽文档，**先读它们再动手**：
- [AGENTS.md](AGENTS.md) — 给 Agent 的完整操作手册（架构、流程、常见任务、踩坑记录）
- [DESIGN.md](DESIGN.md) — 设计与开发规范（数据库、API、关键决策）

CLAUDE.md 仅记录两份文档没覆盖、但每次接手必须知道的事项。

## 启动命令

后端（端口 8082）和前端（端口 3001）必须分别启动：

```bash
# 后端
cd rule-engine-server && ./mvnw spring-boot:run

# 前端（开发模式）
cd rule-engine-ui && npm install && npm run dev

# 一键启动两端（脚本里 mvn clean install 较慢）
./start.sh all
```

构建/打包：
```bash
cd rule-engine-server && ./mvnw clean package -DskipTests
cd rule-engine-ui && npm run build && npx vite preview --port 5173 --host  # 360Chrome 兼容模式
```

## 测试

**当前没有测试。** `rule-engine-server/src/test/java` 目录为空，`mvnw` 命令始终带 `-DskipTests`。新增改动以人工跑通画布保存→发布→执行链路为准；不要假装运行 `mvn test` 或 `npm test`。

## 数据库

- MySQL 8，默认连接：`192.168.2.166:3306/ruleengine`，账号 `root` / `zoeddc@2017`（在 [application.yml](rule-engine-server/src/main/resources/application.yml) 中以环境变量覆写，如 `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_PASSWORD`）
- `ddl-auto: update` 自动建表，但 [DataInitializer.java](rule-engine-server/src/main/java/com/ruleengine/config/DataInitializer.java) 会在启动时手动 `CREATE TABLE rule`，因为 JPA 给 `canvas_json` / `drl_text` 字段映射成了 MySQL 不支持的 `CLOB`。改这两个字段类型时必须同步改 DataInitializer 里的 DDL。
- 启动时按 `code` 幂等地补齐字典/数据集/数据元/规则类型/条件分类/条件，已存在则跳过。

## 架构关键点

规则执行链路（理解这个就理解了 80%）：

```
ReactFlow 画布 (nodes + edges JSON)
        │ PUT /api/v1/rules/{id}/canvas
        ▼
DrlCompiler.compile()         ← 把节点配置翻译成 DRL 文本（when/then 子句）
        │
        ▼
rule.drl_text 持久化
        │ POST /api/v1/rules/{id}/publish
        ▼
RuleExecutor.publish()        ← KieHelper 编译 → 缓存 KieContainer（按 rule.id）
        │ POST /api/v1/rules/{id}/execute  body = { 参数Map }
        ▼
KieSession.fireAllRules()     ← 全局变量: result (Map), dictUtils (DictScriptService)
        │
        ▼
返回匹配结果列表
```

- **`dictUtils` 是规则脚本能直接调用字典工具的入口**。新增字典脚本（如 `whitelistMatch`、`existenceConflict`、`dictMatch`）就是在 [DictScriptService.java](rule-engine-server/src/main/java/com/ruleengine/script/DictScriptService.java) 加方法 + 在 [DrlCompiler.java](rule-engine-server/src/main/java/com/ruleengine/drools/compiler/DrlCompiler.java) 的 `buildConditionExpression` 加 operator 分支生成 `dictUtils.xxx(...)` 调用 + 在 [ConfigPanel/index.jsx](rule-engine-ui/src/components/ConfigPanel/index.jsx) 加 UI。三处缺一不可。
- **字典属性 `dictAttr`**：匹配时可指定走字典项的 `itemName`（默认）/`itemCode`/`itemValue`。注意 ICD10 等字典里 code 与 name 是异构的（A00 vs 霍乱），跨属性 `contains` 会匹配不到——这是数据问题不是代码 bug。
- **删除保护**：RuleType / DataSet / ConditionModelCategory 在 Service 层 `deleteById` 时检查子记录数，有则 `throw new RuntimeException(...)`，由 [GlobalExceptionHandler](rule-engine-server/src/main/java/com/ruleengine/config/GlobalExceptionHandler.java) 转成 HTTP 400，前端读 `e.response.data.message`。

## 前端约束（必读，否则白干）

- **必须用 React 18 Legacy 模式（`ReactDOM.render`）**，不能用 `createRoot`。原因：360Chrome 注入脚本会改 DOM，`createRoot` 的 reconciler 在 `removeChild` 时崩溃。见 [main.jsx](rule-engine-ui/src/main.jsx)。
- **不要用 Ant Design `Menu` 组件**做导航，360Chrome 下会异常。用原生 `<div>` + 点击事件 + URL `?page=xxx` 切页面（[App.jsx](rule-engine-ui/src/App.jsx)）。**没有用 React Router**。
- 生产环境用 `vite preview` 而不是 `vite dev`，dev server 在 360Chrome 下白屏。
- 画布页（`?page=editor`）不在导航栏，仅从规则类型页"新建/编辑"按钮带参数跳转。

## 调试小贴士

- 后端日志 `com.ruleengine` 默认 DEBUG，看 DRL 生成与 Drools 编译错误最直接。
- 规则执行报 `unable to resolve method using strict-mode` → 检查 DrlCompiler 拼出来的表达式是不是把全局变量名写错了（`dictUtils` 而不是 `DictUtils`）。
- 改 `canvas_json` / `drl_text` 的 schema 后，老规则要么删库重启，要么手工 `UPDATE rule SET canvas_json = ...`，DataInitializer 不会迁移已存在的规则。

## 自动生成规则 Skill

项目已内置病历内涵质控规则自动生成能力，相关文件：
- `.claude/skills/generate-qc-rules.json` — Skill 定义（Prompt 模板）
- `docs/generate_qc_rules_skill.py` — 可独立运行的 Python 脚本
- `docs/generate_mr_qc_rules.py` — 原始生成脚本（供参考）

### 用法

```bash
# 默认读取 uploads/病历内涵质控.xlsx，生成10条规则
python3 docs/generate_qc_rules_skill.py

# 指定Excel路径和规则数量
python3 docs/generate_qc_rules_skill.py ./uploads/病历内涵质控.xlsx 15

# 导入数据库
mysql -h 192.168.2.166 -u root -pzoeddc@2017 ruleengine < docs/medical_record_qc_rules.sql
```

### 规则模板映射

脚本内置了30+条常用质控规则的模板映射，覆盖：
- **空值检查**：现病史、体格检查、诊断依据、诊疗计划、输血记录等（`isBlank`）
- **正则匹配**：主诉持续时间、辅助检查时间、现病史一般情况、症状性质/程度等（`regex_match`）
- **集合长度**：阴性体征数量不足（`arrayLength`）
- **集合交集**：主诉与现病史症状不一致（`arrayIntersect`）
- **相似度比对**：病程记录雷同、交班接班记录雷同（`similarity`）
- **长度校验**：疑难病例主持人小结、病情摘要（`lengthCheck`）

### 扩展规则模板

如需新增映射，编辑 `docs/generate_qc_rules_skill.py` 中的 `rule_templates` 列表，每条模板格式：
```python
("关键词1|关键词2", "字段名", "操作符", "值", "extra1", "extra2", "规则名称")
```

### 注意事项

1. 导入后规则状态为 `DRAFT`，需在前端**逐个发布**
2. 不要在发布前用 ConfigPanel 重新选择条件模型，否则 `field` 会被覆盖为数据元编码（如 `EMR_CONTENT`）
3. 如需修改规则字段名，直接编辑 `docs/medical_record_qc_rules.sql` 中的 `canvas_data` JSON
