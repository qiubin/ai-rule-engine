# 规则类型统一执行接口

以规则类型为归集，对外提供该类型下所有规则的统一执行入口。调用方无需关心类型下具体有哪些规则编码，只需传入规则类型和患者数据即可。

## 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/rule-types/{id}/execute` | 按规则类型 ID 执行 |
| POST | `/api/v1/rule-types/execute?typeCode={code}` | 按规则类型编码执行 |

## 请求示例

### 按类型编码执行（推荐）

```bash
curl -X POST "http://localhost:8082/api/v1/rule-types/execute?typeCode=MR_QC" \
  -H "Content-Type: application/json" \
  -d '{
    "parameters": {
      "patientId": "P20240521001",
      "age": 65,
      "gender": "男",
      "diagName": "高血压"
    },
    "options": {
      "stopOnFirstMatch": false,
      "onlyPublished": true,
      "failFast": false
    }
  }'
```

### 按类型 ID 执行

```bash
curl -X POST "http://localhost:8082/api/v1/rule-types/1/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "parameters": {
      "patientId": "P20240521001",
      "age": 65
    },
    "options": {
      "stopOnFirstMatch": false
    }
  }'
```

## 请求参数

### parameters（执行入参）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| patientId | string | 否 | 患者 ID，传入时自动从 HIS 补充患者数据 |
| admissionId | string | 否 | 就诊 ID，配合 patientId 使用 |
| 其他字段 | any | 否 | 各规则所需的业务参数（如 age、gender、diagName 等） |

### options（执行选项）

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| stopOnFirstMatch | boolean | false | 命中一条后是否停止执行后续规则 |
| onlyPublished | boolean | true | 是否只执行已发布（PUBLISHED）状态的规则 |
| failFast | boolean | false | 单条规则执行失败时是否中断整体执行 |

## 响应示例

```json
{
  "ruleTypeId": 1,
  "ruleTypeCode": "MR_QC",
  "ruleTypeName": "病历内涵质控",
  "summary": {
    "total": 5,
    "matched": 2,
    "unmatched": 3,
    "failed": 0,
    "executed": 5
  },
  "results": [
    {
      "ruleId": 10,
      "ruleCode": "QC_001",
      "ruleName": "主诉不能为空",
      "matched": true,
      "firedRules": 1,
      "details": {
        "ruleCode": "QC_001",
        "firedRules": 1,
        "matched": true,
        "results": [
          {
            "resultType": "ALERT",
            "resultValue": "主诉字段缺失",
            "content": "主诉内容为空，请补充"
          }
        ],
        "parameters": { "patientId": "P20240521001", "age": 65 }
      },
      "durationMs": 45,
      "status": "SUCCESS",
      "errorMessage": null
    },
    {
      "ruleId": 11,
      "ruleCode": "QC_002",
      "ruleName": "现病史字数不足",
      "matched": false,
      "firedRules": 0,
      "details": {
        "ruleCode": "QC_002",
        "firedRules": 0,
        "matched": false,
        "results": [],
        "parameters": { "patientId": "P20240521001", "age": 65 }
      },
      "durationMs": 32,
      "status": "NO_HIT",
      "errorMessage": null
    }
  ]
}
```

## 响应字段说明

### 顶层字段

| 字段 | 类型 | 说明 |
|------|------|------|
| ruleTypeId | long | 规则类型 ID |
| ruleTypeCode | string | 规则类型编码 |
| ruleTypeName | string | 规则类型名称 |
| summary | object | 执行汇总 |
| results | array | 每条规则的执行明细 |

### summary（汇总）

| 字段 | 类型 | 说明 |
|------|------|------|
| total | int | 该类型下符合条件的规则总数 |
| matched | int | 命中规则数（firedRules > 0） |
| unmatched | int | 未命中规则数 |
| failed | int | 执行失败的规则数 |
| executed | int | 实际执行的规则数 |

### results[].details（单条规则原始结果）

| 字段 | 类型 | 说明 |
|------|------|------|
| ruleCode | string | 规则编码 |
| firedRules | int | 触发的规则数 |
| matched | boolean | 是否命中 |
| results | array | 命中的结果列表 |
| parameters | object | 实际传入的参数（含 HIS 补充数据） |

## 执行策略说明

### 1. 只执行已发布规则（默认）

`onlyPublished: true` 时，仅执行 `status = PUBLISHED` 的规则。草稿状态的规则会被跳过。

### 2. 短路策略

`stopOnFirstMatch: true` 时，任意一条规则命中后立即停止执行，适合**互斥规则**场景（如多种诊断只需命中一种）。

### 3. 失败处理

`failFast: true` 时，单条规则执行异常会立即中断整个批次，抛出异常。`false` 时（默认），异常规则会被标记为 `status: ERROR`，其他规则继续执行。

### 4. 数据补充

传入 `patientId` 时，系统会自动从 HIS 系统获取患者数据（诊断、检验、病历等）并与传入参数合并。传入参数的优先级高于 HIS 数据，方便测试时覆盖。

## 与单条规则执行的对比

| 场景 | 单条执行 | 类型级执行 |
|------|---------|-----------|
| 调用方知道规则编码 | ✅ 直接调用 `/rules/{id}/execute` | 不需要 |
| 按业务场景批量执行 | 需手动遍历规则编码 | ✅ 只需传类型编码 |
| 需要汇总报告 | 需自行聚合 | ✅ 内置 summary |
| 短路/互斥控制 | 自行实现 | ✅ stopOnFirstMatch |
| 日志记录 | 逐条记录 | ✅ 逐条记录，额外生成类型级汇总 |

## 错误码

| HTTP 状态 | 说明 |
|-----------|------|
| 200 | 执行完成（含部分失败时仍返回 200，通过 summary.failed 判断） |
| 400 | 规则类型不存在 / 该类型下无规则 |
| 500 | 系统异常 |

## 相关接口

- [规则管理 API](API_SPEC.md#规则管理) — 单条规则的 CRUD 与执行
- [流程编排 API](API_SPEC.md#流程编排) — DAG 工作流执行
