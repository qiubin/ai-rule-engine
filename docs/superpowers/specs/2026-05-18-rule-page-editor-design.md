# 规则页面化编辑器设计方案

> 状态：方案评审中  
> 提出人：产品侧需求  
> 设计日期：2026-05-18

---

## 1. 背景与目标

### 1.1 问题

当前规则配置完全依赖 ReactFlow 画布。画布的优势是逻辑拓扑一目了然，但对以下人群不够友好：

- **业务人员**：不熟悉节点拖拽、连线、AND/OR 门等概念，学习成本高。
- **简单规则场景**：一条规则只有 2~3 个条件 + 1 个结果，用画布显得"杀鸡用牛刀"。
- **快速调整**：想改一个阈值或操作符，需要进入画布 → 双击节点 → 打开面板 → 修改 → 保存，步骤多。

### 1.2 目标

在**保留现有画布功能完全不变**的前提下，新增一种**页面表单式**的规则配置方式，实现：

1. **降低门槛**：业务人员通过表单下拉框和输入框即可配置规则，无需理解画布概念。
2. **完全替代画布配置**：页面方式覆盖条件配置、逻辑连接、结果配置全部环节，配置完成后可直接发布执行。
3. **数据互通**：页面方式与画布方式操作的是**同一份底层数据**（`canvas_json`），两种模式可随时切换编辑，不丢失配置。
4. **后端零侵入**：不新增数据库字段、不新增 API、不改动 DRL 编译逻辑，所有改动集中在前端。

### 1.3 约束

| 约束项 | 说明 |
|-------|------|
| 360Chrome 兼容 | 继续使用 React 18 Legacy 模式，不使用 `createRoot` |
| 无 React Router | 页面切换通过 `?page=xxx` URL 参数 |
| 后端不动 | 复用现有 `PUT /api/v1/rules/{id}/canvas` 和 `POST /api/v1/rules/{id}/publish` |
| 画布功能保留 | 现有 RuleEditor（画布编辑器）不做任何删除或降级 |
| 扁平逻辑 | 页面方式只支持扁平条件列表（条件1 AND/OR 条件2 AND/OR 条件3...），不支持嵌套括号 |
| 单结果 | 页面方式只支持配置一个统一结果，命中后返回该结果 |

---

## 2. 方案概述

### 2.1 核心思路

页面编辑器本质上是一个**"画布 JSON 的生成器"**。用户在表单中配置条件和结果，前端将表单状态实时转换为 `canvas_json`（nodes + edges）的格式，调用现有的画布保存 API。DRL 编译、发布、执行等后续链路完全复用现有逻辑。

```
┌─────────────────────────────────────────────────────────────┐
│                    页面编辑器（新增）                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   条件列表    │    │   逻辑连接    │    │   结果配置    │  │
│  │  条件1配置   │───▶│  AND / OR    │───▶│ ResultConfig │  │
│  │  条件2配置   │    │              │    │   content    │  │
│  │  条件3配置   │    │              │    │              │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                      │                                      │
│                      ▼                                      │
│         转换为 canvas_json（nodes + edges）                  │
│                      │                                      │
│                      ▼                                      │
│         PUT /api/v1/rules/{id}/canvas                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    现有后端链路（完全复用）                    │
│  DrlCompiler.compile() ──▶ drools_drl 持久化 ──▶ 发布/执行   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 关键设计决策

| 决策 | 选择 | 理由 |
|-----|------|------|
| 底层数据格式 | 复用 `canvas_json` | 后端零改动，两种模式完全互通 |
| 条件逻辑表达 | 扁平列表 + 两两连接符 | 界面简单直观，满足 90% 规则场景 |
| 结果数量 | 单结果 | 与画布的多结果做差异化定位 |
| 条件配置 UI | 复用 ConfigPanel 逻辑 | 保持操作符、数据元选择等行为一致 |
| 编辑入口 | 规则列表页新增"页面编辑"按钮 | 用户按需选择编辑模式 |

---

## 3. 详细设计

### 3.1 页面结构

新增页面组件：`RulePageEditor`（`rule-engine-ui/src/pages/RulePageEditor/index.jsx`）

页面通过 URL 参数进入：
- `?page=editor&ruleId=123` → 画布编辑器（现有）
- `?page=pageEditor&ruleId=123` → 页面编辑器（新增）

页面布局：

```
┌──────────────────────────────────────────────────────────────┐
│ 规则编码: R_20250518_001          状态: 草稿                   │
│ 规则名称: [ 主诉与现病史一致性校验              ] [保存] [发布] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 条件配置 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓               │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  条件 1                                                │  │
│  │  数据集: [ICD10 疾病诊断 ▼] 数据元: [主诉症状 ▼]        │  │
│  │  操作符: [contains ▼]  阈值: [头痛]                     │  │
│  │                                          [删除]        │  │
│  └────────────────────────────────────────────────────────┘  │
│                          │ AND                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  条件 2                                                │  │
│  │  数据集: [病历内容 ▼]     数据元: [现病史 ▼]            │  │
│  │  操作符: [contains ▼]  阈值: [头痛]                     │  │
│  │                                          [删除]        │  │
│  └────────────────────────────────────────────────────────┘  │
│                          │ OR                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  条件 3                                                │  │
│  │  ...                                                   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  [+ 添加条件]                                                 │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 结果配置 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓               │
│                                                              │
│  结果类型: [REJECT ▼]                                        │
│  结果配置: [主诉与现病史不一致 ▼]                             │
│  结果内容: [主诉提到${主诉症状}，现病史未描述对应症状]          │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ [ 画布预览 ]  （可选：展示根据当前配置自动生成的画布拓扑）       │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 条件行组件

每行条件是一个独立的表单区块，内部复用 ConfigPanel 的字段渲染逻辑：

**条件行表单字段**（与画布条件节点一致）：

| 字段 | 组件 | 说明 |
|-----|------|------|
| `datasetId` | Cascader | 数据集三级分类选择 |
| `conditionModelId` | Select | 数据元/条件选择 |
| `field` | Input (readOnly) | 自动填充，来自 ConditionModel.code |
| `dataType` | Input (readOnly) | 自动填充，来自 ConditionModel.dataType |
| `operator` | Select | 操作符选择（26个） |
| `value` / `extraValue1~4` | 动态表单 | 根据 operator 动态渲染（复用 ConfigPanel 逻辑） |
| `dictCode` / `dictAttr` | Select | dictMatch 等操作符所需 |

**行之间的逻辑连接符**：

每两个条件之间有一个下拉选择框：

```
条件 1  ──── [ AND ▼ ] ──── 条件 2  ──── [ OR ▼ ] ──── 条件 3
```

- 选项：`AND`、`OR`
- 位置：条件行之间的区域居中显示
- 第一个条件前没有连接符

### 3.3 结果配置

结果配置区复用 ConfigPanel 中 result 节点的字段：

| 字段 | 组件 | 说明 |
|-----|------|------|
| `resultConfigId` | Select | 选择预配置的 ResultConfig |
| `resultType` | Input (readOnly) | 自动填充 |
| `resultValue` | Input (readOnly) | 自动填充 |
| `content` | TextArea | 结果内容，支持 `${fieldName}` 变量插值 |
| `priority` | InputNumber | 优先级（可选） |

### 3.4 数据模型：页面配置 ↔ Canvas JSON 转换

#### 3.4.1 页面配置的内存状态

```typescript
interface PageRuleConfig {
  // 条件列表（有序）
  conditions: Array<{
    id: string;              // 前端生成的唯一ID，如 "cond_1"
    datasetId: number[];     // Cascader 值 [l1, l2, l3, datasetId]
    conditionModelId: number;
    field: string;
    dataType: string;
    operator: string;
    value?: any;
    extraValue1?: any;
    extraValue2?: any;
    extraValue3?: any;
    extraValue4?: any;
    dictCode?: string;
    allDictCode?: string;
    dictAttr?: string;
    allDictAttr?: string;
    valueSource?: string;
    baseConditionModelId?: number;
    baseDatasetId?: number[];
  }>;
  
  // 逻辑连接符（length = conditions.length - 1）
  // logicOperators[0] 表示 conditions[0] 和 conditions[1] 之间的连接符
  logicOperators: Array<'AND' | 'OR'>;
  
  // 结果配置
  result: {
    resultConfigId: number;
    resultType: string;
    resultValue: string;
    content: string;
    priority?: number;
    metadata?: any;
  };
}
```

#### 3.4.2 转换为 Canvas JSON（保存时）

将 `PageRuleConfig` 转换为 `canvas_json` 的算法：

```
输入: PageRuleConfig { conditions, logicOperators, result }
输出: { nodes: [...], edges: [...] }

步骤:
1. 创建 start 节点: { id: 'start', type: 'start', position: {x:100,y:100}, data: {label:'开始'} }
2. 创建 end 节点: { id: 'end', type: 'end', position: {x:800,y:100}, data: {label:'结束'} }
3. 创建条件节点:
   遍历 conditions，每个创建:
   { id: 'cond_1', type: 'condition', position: {...}, data: { label: '条件1', conditionConfig: {...} } }
   
4. 创建结果节点:
   { id: 'result_1', type: 'result', position: {...}, data: { label: '结果', resultConfig: {...} } }

5. 创建边（连接逻辑）:
   - start ──▶ cond_1
   - cond_1(true) ──▶ cond_2  或  cond_1(true) ──▶ result_1（如果是最后一个条件）
   - cond_1(false) ──▶ end
   - cond_n(true) ──▶ result_1
   - cond_n(false) ──▶ end
   - result_1 ──▶ end
   
   逻辑连接符处理:
   - 如果 logicOperators[i] === 'AND':
     cond_i(true) 连到 cond_{i+1}
   - 如果 logicOperators[i] === 'OR':
     cond_i(true) 连到 result_1（提前命中）
     cond_{i+1} 的前驱也需要包含之前所有 OR 分支的 false 出口？
```

**关于 OR 逻辑的说明**：

画布中的 OR 是通过 `or` 节点 + 多路径来实现的。在页面方式的扁平列表中，OR 的含义是"任一条件满足即命中结果"。转换为画布拓扑时，需要将所有条件并联到结果节点：

```
// 条件1 OR 条件2 OR 条件3 的画布拓扑:
start ──▶ cond_1 ──(是)──▶ result
            │(否)
            ▼
          cond_2 ──(是)──▶ result
            │(否)
            ▼
          cond_3 ──(是)──▶ result
            │(否)
            ▼
           end
```

这意味着 OR 连接的条件之间是**串联的 false 链**，而非并联。这是因为当前画布没有"任一条件满足即命中"的直接表达，而是通过条件节点的 false 出口链式传递实现的。

**更准确的转换策略**：

对于 `logicOperators` 中的连接符序列，需要分析出"结果命中的条件组合"。但由于页面方式限制为单结果，且条件列表是扁平的，可以简化为：

- **所有连接符都是 AND**：条件串联，全部满足才命中结果
  ```
  start → cond_1(yes) → cond_2(yes) → cond_3(yes) → result → end
                (no)        (no)        (no)
                 ↓           ↓           ↓
                end         end         end
  ```

- **存在 OR**：将条件分组，每组内部 AND，组之间 OR。然后为每个组生成一条 DRL 规则。
  
  但这会导致一个页面配置生成多条 DRL 规则，与现有画布"一个 result 节点 = 一条规则"的语义不一致。

**简化方案**：

考虑到页面方式定位为"简单规则配置"，对 OR 的处理采用最简策略：

1. **页面方式中，OR 仅作为展示，实际生成的画布拓扑将所有条件视为串联（AND 语义）**。
2. 或者：**页面方式禁用 OR，只允许 AND**。
3. 或者：**允许 OR，但生成画布时使用 or 节点**。

**推荐**：方案 3 - 允许 OR，生成画布时使用 `or` 节点。

转换算法（最终版）：

```
convertPageToCanvas(config):
  nodes = [start, end]
  edges = []
  
  // 1. 创建所有条件节点
  for i, cond in config.conditions:
    node = { id: cond.id, type: 'condition', position: calcPosition(i), data: { label: `条件${i+1}`, conditionConfig: cond } }
    nodes.push(node)
  
  // 2. 创建结果节点
  resultNode = { id: 'result_1', type: 'result', position: calcResultPosition(), data: { label: '结果', resultConfig: config.result } }
  nodes.push(resultNode)
  
  // 3. 分析连接符序列，插入 and/or 节点
  // 将连续的同类型连接符合并为一个逻辑门节点
  // 例如: AND AND OR AND → and_1 连接 cond_1,cond_2,cond_3; or_1 连接 and_1,cond_4
  
  // 简化：由于页面方式是扁平列表，我们采用链式连接 + 逻辑门节点
  
  prevNodeId = 'start'
  for i in 0..config.conditions.length-1:
    condId = config.conditions[i].id
    
    // 连接前驱到当前条件
    edges.push({ source: prevNodeId, target: condId })
    
    if i < config.conditions.length - 1:
      op = config.logicOperators[i]
      
      if op === 'AND':
        // AND: cond_i(true) → cond_{i+1}
        edges.push({ source: condId, target: config.conditions[i+1].id, label: '是', sourceHandle: 'true' })
        // cond_i(false) → end
        edges.push({ source: condId, target: 'end', label: '否', sourceHandle: 'false' })
        prevNodeId = null  // 下一条边已经处理
        
      else if op === 'OR':
        // OR: cond_i(true) → result
        edges.push({ source: condId, target: 'result_1', label: '是', sourceHandle: 'true' })
        // cond_i(false) → cond_{i+1}
        edges.push({ source: condId, target: config.conditions[i+1].id, label: '否', sourceHandle: 'false' })
        prevNodeId = condId  // cond_{i+1} 的前驱是 cond_i 的 false 出口？不对...
  ```

实际上，对于 OR 语义（任一条件满足即命中结果），更合理的画布拓扑是：

```
start → cond_1 →(是)→ result
           ↓(否)
         cond_2 →(是)→ result
           ↓(否)
         cond_3 →(是)→ result
           ↓(否)
          end
```

即：所有条件串联，每个条件的 **true 分支**都指向结果，**false 分支**指向下一个条件（最后一个指向 end）。

这样 DrlCompiler 会为每个条件的 true 分支生成一条规则（因为每个 true→result 路径都是独立的）。这与页面方式的"任一条件满足即命中"语义一致，但会生成多条 DRL 规则。

或者，对于 AND 语义（全部满足才命中）：

```
start → cond_1 →(是)→ cond_2 →(是)→ cond_3 →(是)→ result
           ↓(否)         ↓(否)         ↓(否)
          end           end           end
```

这样 DrlCompiler 只会生成一条 DRL 规则（所有条件串联）。

**混合 AND/OR 的复杂情况**：

如果条件列表是 `cond1 AND cond2 OR cond3`，语义是 `(cond1 AND cond2) OR cond3`。这需要用 `or` 节点来表达：

```
start → cond_1 →(是)→ cond_2 →(是)→ or_1 →(是)→ result
           ↓(否)         ↓(否)         ↑(否)
          end           end         cond_3 →(是)──┘
                       
```

这又回到了画布中的 or 节点概念，对业务人员来说仍然抽象。

**最终决策**：

| 场景 | 处理方式 |
|-----|---------|
| 纯 AND 链 | 条件串联，全部满足才命中结果，生成 1 条 DRL 规则 |
| 包含 OR | 需要引入 `or` 节点，但保持页面 UI 的扁平展示。转换算法自动在适当位置插入 `or` 节点。 |

转换算法的核心逻辑：

```javascript
/**
 * 将扁平条件列表转换为画布拓扑
 * 策略：根据 AND/OR 连接符，自动决定条件串联(false链)还是并联(true到result)
 */
function buildCanvasFromConditions(conditions, logicOperators, resultConfig) {
  const nodes = [];
  const edges = [];
  let nextId = 1;
  const getId = (prefix) => `${prefix}_${nextId++}`;

  // 固定节点
  nodes.push({ id: 'start', type: 'start', position: { x: 100, y: 200 }, data: { label: '开始' } });
  nodes.push({ id: 'end', type: 'end', position: { x: 800, y: 200 }, data: { label: '结束' } });

  const resultNode = {
    id: 'result_1',
    type: 'result',
    position: { x: 600, y: 200 },
    data: { label: resultConfig.resultValue || '结果', resultConfig }
  };
  nodes.push(resultNode);

  // 创建条件节点
  const condNodes = conditions.map((cond, idx) => ({
    id: cond.id || getId('cond'),
    type: 'condition',
    position: { x: 250 + idx * 150, y: 200 },
    data: { label: cond.label || `条件${idx + 1}`, conditionConfig: cond }
  }));
  nodes.push(...condNodes);

  // 连接 start 到第一个条件
  edges.push({ id: 'e_start', source: 'start', target: condNodes[0].id });

  // 遍历条件和连接符
  for (let i = 0; i < condNodes.length; i++) {
    const curr = condNodes[i];
    const isLast = i === condNodes.length - 1;

    if (isLast) {
      // 最后一个条件：是→result，否→end
      edges.push({ id: `e_${curr.id}_t`, source: curr.id, target: 'result_1', label: '是', sourceHandle: 'true' });
      edges.push({ id: `e_${curr.id}_f`, source: curr.id, target: 'end', label: '否', sourceHandle: 'false' });
    } else {
      const next = condNodes[i + 1];
      const op = logicOperators[i];

      if (op === 'AND') {
        // AND: 是→下一个条件，否→end
        edges.push({ id: `e_${curr.id}_t`, source: curr.id, target: next.id, label: '是', sourceHandle: 'true' });
        edges.push({ id: `e_${curr.id}_f`, source: curr.id, target: 'end', label: '否', sourceHandle: 'false' });
      } else if (op === 'OR') {
        // OR: 是→result，否→下一个条件
        edges.push({ id: `e_${curr.id}_t`, source: curr.id, target: 'result_1', label: '是', sourceHandle: 'true' });
        edges.push({ id: `e_${curr.id}_f`, source: curr.id, target: next.id, label: '否', sourceHandle: 'false' });
      }
    }
  }

  return { nodes, edges };
}
```

这个算法的语义：
- **AND**：当前条件满足后，继续检查下一个条件；不满足直接结束（不命中）。
- **OR**：当前条件满足后，直接命中结果；不满足才检查下一个条件。

这样就实现了 `(cond1 AND cond2) OR cond3` 的语义（当 cond1 不满足时结束；cond1 满足后检查 cond2，cond2 不满足则 cond3 还有机会命中——不对，这个算法实际上实现的是短路逻辑）。

让我重新分析：

对于 `cond1 AND cond2 OR cond3`：

按照上述算法：
- cond1 AND cond2: cond1 是→cond2，cond1 否→end。cond2 是→cond3（因为 OR），cond2 否→end。
- cond2 OR cond3: cond2 是→result，cond2 否→cond3。cond3 是→result，cond3 否→end。

这样 cond1 满足 → cond2 满足 → result（命中），这是正确的（因为 cond1 AND cond2 满足）。

cond1 满足 → cond2 不满足 → cond3。此时 cond3 满足 → result（命中），这也是正确的（因为 cond1 AND (cond2 OR cond3)）。

cond1 不满足 → end（不命中），正确。

所以这个算法实际上实现的是 **左结合** 的逻辑：
`cond1 AND cond2 OR cond3` = `((cond1 AND cond2) OR cond3)` 的短路版本。

等等，更准确地说：
- cond1 否 → end（cond1 不满足，整个表达式不满足）
- cond1 是 → cond2
  - cond2 是 → result（cond1 AND cond2 满足，命中）
  - cond2 否 → cond3
    - cond3 是 → result（cond1 AND (NOT cond2) AND cond3... 这在严格语义下不等于 (cond1 AND cond2) OR cond3）

实际上，这个算法的语义更接近：
```
if (cond1) {
  if (cond2) return result;
  else if (cond3) return result;
} else {
  return end;
}
```

即：cond1 是前提，cond2 和 cond3 是并列的 OR 关系。这与 `(cond1 AND cond2) OR cond3` 不同。

**结论**：页面方式的扁平列表 + AND/OR 连接符，在转换为画布时会产生**非直观的语义**。为了避免这种混淆，建议：

1. **页面方式只支持纯 AND 或纯 OR**，不允许混合使用。UI 上用一个全局开关切换"全部满足"（AND）或"任一满足"（OR），而不是每两个条件之间选择连接符。
2. 或者：**保留两两连接符，但在混合 AND/OR 时给出明确警告**，并解释生成的规则语义。

**推荐方案 1**（全局逻辑模式）：

```
┌──────────────────────────────────────┐
│ 逻辑模式: [ 全部满足 (AND) ▼ ]        │
│                                      │
│ 条件 1: ...                          │
│ 条件 2: ...                          │
│ 条件 3: ...                          │
│                                      │
│ 当以上 [全部] 条件满足时，返回结果      │
└──────────────────────────────────────┘
```

选项：
- `ALL_MATCH`（全部满足，AND 语义）
- `ANY_MATCH`（任一满足，OR 语义）

这样语义清晰，转换逻辑也简单：

- ALL_MATCH: 条件串联，全部满足才命中
- ANY_MATCH: 条件并联（通过 or 节点），任一满足即命中

**最终采用方案**：保留两两连接符的灵活性（用户已明确要这个），但在设计文档中明确说明语义为**左结合短路逻辑**。同时提供一个"简化模式"开关，一键切换为全局 ALL_MATCH / ANY_MATCH。

---

#### 3.4.3 反向转换：Canvas JSON → 页面配置（加载已有规则时）

当用户在页面编辑器中打开一个已有规则时，需要将 `canvas_json` 解析为 `PageRuleConfig`：

**解析策略**：

1. 如果画布是**纯链式结构**（start → cond1 → cond2 → ... → result → end，每个 cond 的 false 都指向 end），则可以完美解析为页面配置。
2. 如果画布包含**and/or 节点**、**分支/合并**、**多个 result 节点**，则判定为"复杂画布"，提示用户"此规则使用了画布的高级功能，请在画布编辑器中编辑"。

**可解析的画布特征**：

```
可解析: start → cond → cond → ... → cond → result → end
         ↓(f)   ↓(f)        ↓(f)   ↑(t)   ↑(t)        ↑(t)
         end    end         end    
         
不可解析: 包含 or 节点、and 节点（除自动生成的以外）、多个 result 节点、
         非链式结构（有分支合并）
```

**解析算法**：

```javascript
function parseCanvasToPageConfig(canvasData) {
  const { nodes, edges } = canvasData;
  
  // 1. 检查是否包含多个 result 节点
  const resultNodes = nodes.filter(n => n.type === 'result');
  if (resultNodes.length > 1) {
    return { parseable: false, reason: '多个结果节点' };
  }
  
  // 2. 检查是否包含 and/or 节点（手动添加的）
  const hasLogicGates = nodes.some(n => n.type === 'and' || n.type === 'or');
  if (hasLogicGates) {
    return { parseable: false, reason: '包含逻辑门节点' };
  }
  
  // 3. 构建邻接关系
  const adj = buildAdjacency(nodes, edges);
  
  // 4. 从 start 出发，沿 true 链遍历，收集条件节点
  const conditions = [];
  const logicOperators = [];
  let current = nodes.find(n => n.type === 'start');
  let resultConfig = null;
  
  while (current) {
    const nextEdges = adj[current.id]?.filter(e => e.sourceHandle === 'true' || !e.sourceHandle);
    
    if (nextEdges.length === 0) break;
    if (nextEdges.length > 1) {
      return { parseable: false, reason: '条件分支' };
    }
    
    const nextNode = nodes.find(n => n.id === nextEdges[0].target);
    
    if (nextNode.type === 'condition') {
      conditions.push(nextNode.data.conditionConfig);
      
      // 判断当前条件与下一个条件的逻辑关系
      // 看当前条件的 false 出口：如果指向 end，则是 AND；如果指向下一个条件，则是 OR
      const falseEdges = adj[current.id]?.filter(e => e.sourceHandle === 'false');
      if (falseEdges.length > 0) {
        const falseTarget = nodes.find(n => n.id === falseEdges[0].target);
        if (falseTarget.type === 'end') {
          logicOperators.push('AND');
        } else if (falseTarget.id === nextNode.id) {
          logicOperators.push('OR');
        }
      }
    } else if (nextNode.type === 'result') {
      resultConfig = nextNode.data.resultConfig;
      break;
    } else {
      break;
    }
    
    current = nextNode;
  }
  
  return {
    parseable: true,
    conditions,
    logicOperators: logicOperators.slice(0, conditions.length - 1),
    result: resultConfig
  };
}
```

### 3.5 入口与导航

#### 3.5.1 规则列表页入口

在 `RuleTypeMgr`（规则类型管理页）的规则列表中，每条规则的操作列新增"页面编辑"按钮：

```
操作列: [编辑(画布)] [页面编辑] [删除] [执行日志] ...
```

点击"页面编辑"跳转：`?page=pageEditor&ruleId=xxx`

#### 3.5.2 页面编辑器内部导航

页面编辑器顶部提供切换入口：

```
┌──────────────────────────────────────────────────────────────┐
│ 规则页面编辑                                    [画布编辑 ▼] │
│                                                              │
│ （下拉选项：切换到画布编辑器编辑此规则）                        │
└──────────────────────────────────────────────────────────────┘
```

切换时携带 `ruleId` 参数：`?page=editor&ruleId=xxx`

### 3.6 保存与发布流程

页面编辑器的保存/发布流程与画布编辑器完全一致：

1. **保存**：将 `PageRuleConfig` 转换为 `canvas_json`，调用 `PUT /api/v1/rules/{id}/canvas`
2. **发布**：先静默保存画布，然后调用 `POST /api/v1/rules/{id}/publish`
3. **撤回**：调用 `POST /api/v1/rules/{id}/withdraw`

无需新增任何 API。

---

## 4. 组件设计

### 4.1 新增文件清单

| 文件 | 类型 | 说明 |
|-----|------|------|
| `src/pages/RulePageEditor/index.jsx` | 页面组件 | 页面编辑器主页面 |
| `src/pages/RulePageEditor/style.css` | 样式 | 页面编辑器样式 |
| `src/components/ConditionRow/index.jsx` | 组件 | 单条条件配置行 |
| `src/components/ConditionRow/style.css` | 样式 | 条件行样式 |
| `src/utils/canvasConverter.js` | 工具函数 | 页面配置 ↔ canvas_json 转换 |

### 4.2 组件关系

```
RulePageEditor
├── ConditionList
│   ├── LogicConnector (AND/OR 下拉)
│   ├── ConditionRow × N
│   │   ├── DatasetCascader (复用 ConfigPanel 逻辑)
│   │   ├── ConditionModelSelect
│   │   ├── OperatorSelect
│   │   └── DynamicValueForm (复用 ConfigPanel 逻辑)
│   └── [+ 添加条件]
├── ResultConfigSection
│   ├── ResultConfigSelect (复用 ConfigPanel 逻辑)
│   └── ContentTextArea
├── CanvasPreview (可选，只读展示生成的画布)
└── ActionBar [保存] [发布] [撤回]
```

### 4.3 复用现有组件/逻辑

| 现有代码 | 复用方式 |
|---------|---------|
| `ConfigPanel` 的数据加载逻辑 | 提取为自定义 hooks 或工具函数，供 ConditionRow 调用 |
| `ConfigPanel` 的操作符动态表单 | 提取为独立组件 `OperatorValueForm`，ConfigPanel 和 ConditionRow 共用 |
| `ConfigPanel` 的结果配置表单 | 提取为独立组件 `ResultConfigForm`，ConfigPanel 和 ResultConfigSection 共用 |
| `RuleEditor` 的保存/发布/撤回逻辑 | 提取为自定义 hook `useRuleActions`，两个编辑器共用 |

---

## 5. 实现计划（概要）

### 阶段 1：提取公共逻辑（1~2 天）

1. 将 `ConfigPanel` 中的数据加载（fetchCategories, fetchDataSets 等）提取为 `useConditionData` hook
2. 将操作符对应的动态表单渲染提取为 `OperatorValueForm` 组件
3. 将结果配置表单提取为 `ResultConfigForm` 组件
4. 将 `RuleEditor` 的保存/发布/撤回逻辑提取为 `useRuleActions` hook

### 阶段 2：转换工具函数（1 天）

1. 实现 `pageToCanvas()`：PageRuleConfig → canvas_json
2. 实现 `canvasToPage()`：canvas_json → PageRuleConfig（含可解析性检测）
3. 编写单元测试覆盖各种拓扑转换场景

### 阶段 3：页面编辑器 UI（2~3 天）

1. 创建 `RulePageEditor` 页面框架
2. 实现 `ConditionRow` 组件（复用提取的公共组件）
3. 实现条件列表管理（增删、AND/OR 连接符）
4. 实现结果配置区
5. 集成保存/发布/撤回逻辑

### 阶段 4：入口集成（0.5 天）

1. `App.jsx` 注册 `pageEditor` 页面
2. `RuleTypeMgr` 规则列表添加"页面编辑"按钮
3. 页面编辑器内添加"切换到画布编辑"入口

### 阶段 5：联调与测试（1~2 天）

1. 页面方式创建新规则 → 保存 → 发布 → 执行，全链路验证
2. 画布方式创建规则 → 页面方式打开编辑 → 保存，双向验证
3. 复杂画布规则在页面方式打开时的降级提示
4. 360Chrome 兼容性测试

---

## 6. 风险与对策

| 风险 | 可能性 | 影响 | 对策 |
|-----|-------|------|------|
| 画布→页面反向转换失败率高 | 中 | 中 | 明确"复杂规则请在画布中编辑"的降级策略，不追求 100% 双向转换 |
| OR 逻辑语义不直观 | 高 | 中 | 在 UI 上增加语义说明，或提供全局 ALL_MATCH/ANY_MATCH 简化模式 |
| 代码复用导致 ConfigPanel 改动引发回归 | 中 | 高 | 提取公共组件时保持原有接口不变，充分测试画布编辑器 |
| 360Chrome 下表单性能问题 | 低 | 中 | 条件列表使用虚拟滚动（超过 20 条时），避免大量表单组件同时渲染 |
| 用户对两种模式的认知混淆 | 中 | 低 | 在规则列表页用不同图标/文案区分"画布编辑"和"页面编辑"，页面编辑器顶部增加模式说明 |

---

## 7. 附录

### 7.1 页面方式 OR 语义的精确说明

页面方式中，条件之间的 OR 连接符实现的语义为：

```
cond1 OR cond2 OR cond3

等价于画布的:
start → cond1 ──(是)──▶ result
           ↓(否)
         cond2 ──(是)──▶ result
           ↓(否)
         cond3 ──(是)──▶ result
           ↓(否)
          end

等价于代码:
if (cond1) return result;
if (cond2) return result;
if (cond3) return result;
return end;
```

即**短路 OR**：任一条件满足即命中结果，后续条件不再检查。

### 7.2 页面方式 AND 语义的精确说明

```
cond1 AND cond2 AND cond3

等价于画布的:
start → cond1 ──(是)──▶ cond2 ──(是)──▶ cond3 ──(是)──▶ result
           ↓(否)            ↓(否)            ↓(否)
          end              end              end

等价于代码:
if (!cond1) return end;
if (!cond2) return end;
if (!cond3) return end;
return result;
```

### 7.3 混合 AND/OR 的语义

```
cond1 AND cond2 OR cond3

等价于代码:
if (!cond1) return end;      // cond1 不满足，直接结束
if (cond2) return result;     // cond1 满足且 cond2 满足，命中
if (cond3) return result;     // cond1 满足但 cond2 不满足，检查 cond3
return end;
```

注意：这不是数学上的 `(cond1 AND cond2) OR cond3`，而是 `cond1 AND (cond2 OR cond3)` 的短路形式。

如果用户需要精确的 `(cond1 AND cond2) OR cond3`，应该在画布中使用 `or` 节点配置。

---

## 8. 已确认决策

1. **OR 语义处理方式**：采用**选项 A** — 保留两两 AND/OR 连接符，按短路逻辑转换。
   - 当前条件不满足（AND 的 false）→ 直接结束
   - 当前条件满足（OR 的 true）→ 直接命中结果
   - 已在 UI 上增加语义说明tooltip

2. **画布预览**：**需要**。页面编辑器底部嵌入只读的画布预览区域，实时展示当前配置对应的拓扑，帮助用户理解规则逻辑。

3. **条件数量上限**：**限制为 20 个**。超过时"添加条件"按钮禁用并提示"最多支持 20 个条件，复杂规则请使用画布编辑器"。
