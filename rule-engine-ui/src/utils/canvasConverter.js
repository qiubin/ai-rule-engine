/**
 * 页面配置 与 画布 JSON 之间的双向转换工具
 */

const MAX_CONDITIONS = 20

/**
 * 将页面配置转换为画布 JSON (PageRuleConfig → canvas_json)
 */
export function pageToCanvas(pageConfig) {
  const { conditions, logicOperators, result } = pageConfig

  if (!conditions || conditions.length === 0) {
    const nodes = [
      { id: 'start', type: 'start', position: { x: 100, y: 200 }, data: { label: '开始' } },
      { id: 'end', type: 'end', position: { x: 500, y: 200 }, data: { label: '结束' } },
    ]
    if (result) {
      nodes.push({
        id: 'result_1',
        type: 'result',
        position: { x: 800, y: 200 },
        data: { label: result.resultValue || '结果', resultConfig: result }
      })
      nodes.push({ id: 'e_result_end', source: 'result_1', target: 'end' })
    }
    return { nodes, edges: [] }
  }

  const nodes = []
  const edges = []

  // 固定节点
  nodes.push({ id: 'start', type: 'start', position: { x: 100, y: 200 }, data: { label: '开始' } })
  nodes.push({ id: 'end', type: 'end', position: { x: 500, y: 200 + (conditions.length - 1) * 120 }, data: { label: '结束' } })

  // 结果节点
  const resultNode = {
    id: 'result_1',
    type: 'result',
    position: { x: 800, y: 200 + (conditions.length - 1) * 60 },
    data: {
      label: result?.resultValue || '结果',
      resultConfig: result || {}
    }
  }
  nodes.push(resultNode)

  // 创建条件节点
  const condNodes = conditions.map((cond, idx) => ({
    id: cond.id || `cond_${idx + 1}`,
    type: 'condition',
    position: { x: 350, y: 100 + idx * 140 },
    data: {
      label: cond.label || `条件${idx + 1}`,
      conditionConfig: buildConditionConfig(cond)
    }
  }))
  nodes.push(...condNodes)

  // 连接 start → 第一个条件
  edges.push({ id: 'e_start', source: 'start', target: condNodes[0].id })

  // 遍历条件，根据 AND/OR 连接符创建边
  for (let i = 0; i < condNodes.length; i++) {
    const curr = condNodes[i]
    const isLast = i === condNodes.length - 1

    if (isLast) {
      // 最后一个条件：是→result，否→end
      edges.push({ id: `e_${curr.id}_t`, source: curr.id, target: 'result_1', label: '是', sourceHandle: 'true' })
      edges.push({ id: `e_${curr.id}_f`, source: curr.id, target: 'end', label: '否', sourceHandle: 'false' })
    } else {
      const next = condNodes[i + 1]
      const op = logicOperators[i] || 'AND'

      if (op === 'AND') {
        // AND: 是→下一个条件，否→end
        edges.push({ id: `e_${curr.id}_t`, source: curr.id, target: next.id, label: '是', sourceHandle: 'true' })
        edges.push({ id: `e_${curr.id}_f`, source: curr.id, target: 'end', label: '否', sourceHandle: 'false' })
      } else {
        // OR: 是→result，否→下一个条件
        edges.push({ id: `e_${curr.id}_t`, source: curr.id, target: 'result_1', label: '是', sourceHandle: 'true' })
        edges.push({ id: `e_${curr.id}_f`, source: curr.id, target: next.id, label: '否', sourceHandle: 'false' })
      }
    }
  }

  // result → end
  edges.push({ id: 'e_result_end', source: 'result_1', target: 'end' })

  return { nodes, edges }
}

/**
 * 将画布 JSON 解析为页面配置 (canvas_json → PageRuleConfig)
 * 如果画布结构过于复杂，返回 parseable: false
 */
export function canvasToPage(canvasData) {
  try {
    const { nodes, edges } = canvasData
    if (!nodes || nodes.length === 0) {
      return { parseable: true, conditions: [], logicOperators: [], result: null }
    }

    // 1. 检查是否包含多个 result 节点
    const resultNodes = nodes.filter(n => n.type === 'result')
    if (resultNodes.length > 1) {
      return { parseable: false, reason: '此规则包含多个结果节点，请在画布编辑器中编辑' }
    }

    // 2. 检查是否包含手动添加的 and/or 节点
    const hasLogicGates = nodes.some(n => n.type === 'and' || n.type === 'or')
    if (hasLogicGates) {
      return { parseable: false, reason: '此规则包含逻辑门节点，请在画布编辑器中编辑' }
    }

    // 3. 构建邻接关系
    const adj = {}
    const reverseAdj = {}
    nodes.forEach(n => {
      adj[n.id] = []
      reverseAdj[n.id] = []
    })
    edges.forEach(e => {
      if (adj[e.source]) adj[e.source].push(e)
      if (reverseAdj[e.target]) reverseAdj[e.target].push(e)
    })

    // 4. 解析画布拓扑，提取条件和逻辑连接符
    const conditions = []
    const logicOperators = []
    let resultConfig = null

    const startNode = nodes.find(n => n.type === 'start')
    if (!startNode) {
      return { parseable: false, reason: '画布缺少开始节点' }
    }

    // 从 start 找到第一个条件
    const startOutgoing = adj[startNode.id] || []
    const firstCondEdge = startOutgoing.find(e => {
      const target = nodes.find(n => n.id === e.target)
      return target?.type === 'condition'
    })

    if (!firstCondEdge) {
      // start 没有直接连到条件，检查是否连到 result
      const resultEdge = startOutgoing.find(e => {
        const target = nodes.find(n => n.id === e.target)
        return target?.type === 'result'
      })
      if (resultEdge) {
        const resultNode = nodes.find(n => n.id === resultEdge.target)
        resultConfig = resultNode?.data?.resultConfig
      }
      return { parseable: true, conditions, logicOperators, result: resultConfig }
    }

    // 沿着条件链遍历
    let currentId = firstCondEdge.target
    const visited = new Set()

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId)
      const node = nodes.find(n => n.id === currentId)
      if (!node || node.type !== 'condition') break

      conditions.push({
        id: node.id,
        ...node.data?.conditionConfig
      })

      const outgoing = adj[currentId] || []
      const trueEdge = outgoing.find(e => e.sourceHandle === 'true' || e.label === '是')
      const falseEdge = outgoing.find(e => e.sourceHandle === 'false' || e.label === '否')

      const trueTarget = trueEdge ? nodes.find(n => n.id === trueEdge.target) : null
      const falseTarget = falseEdge ? nodes.find(n => n.id === falseEdge.target) : null

      if (trueTarget?.type === 'condition') {
        // true → next condition: AND 语义
        logicOperators.push('AND')
        currentId = trueTarget.id
      } else if (falseTarget?.type === 'condition') {
        // false → next condition: OR 语义
        logicOperators.push('OR')
        currentId = falseTarget.id
      } else {
        // 没有下一个条件，提取 result
        if (trueTarget?.type === 'result') {
          resultConfig = trueTarget.data?.resultConfig
        } else if (falseTarget?.type === 'result') {
          resultConfig = falseTarget.data?.resultConfig
        }
        break
      }
    }

    // 如果条件数超过上限
    if (conditions.length > MAX_CONDITIONS) {
      return { parseable: false, reason: `此规则包含 ${conditions.length} 个条件，超过页面编辑器的 ${MAX_CONDITIONS} 个上限` }
    }

    return {
      parseable: true,
      conditions,
      logicOperators: logicOperators.slice(0, conditions.length - 1),
      result: resultConfig
    }
  } catch (e) {
    return { parseable: false, reason: '画布解析失败: ' + e.message }
  }
}

/**
 * 构建条件配置对象，确保字段完整并做类型转换
 */
function buildConditionConfig(cond) {
  // 处理 datasetId：如果是数组，取最后一个元素
  let datasetId = cond.datasetId
  if (Array.isArray(datasetId)) {
    datasetId = datasetId[datasetId.length - 1]
  }
  // 处理 baseDatasetId
  let baseDatasetId = cond.baseDatasetId
  if (Array.isArray(baseDatasetId)) {
    baseDatasetId = baseDatasetId[baseDatasetId.length - 1]
  }
  // 处理 dictMatch 的 extraValue1：数组转逗号分隔字符串
  let extraValue1 = cond.extraValue1
  if (Array.isArray(extraValue1)) {
    extraValue1 = extraValue1.join(',')
  }

  const config = {
    field: cond.field,
    operator: cond.operator,
    value: cond.value,
    extraValue1,
    extraValue2: cond.extraValue2,
    extraValue3: cond.extraValue3,
    extraValue4: cond.extraValue4,
    dictCode: cond.dictCode,
    allDictCode: cond.allDictCode,
    dictAttr: cond.dictAttr,
    allDictAttr: cond.allDictAttr,
    valueSource: cond.valueSource || 'ADAPTER',
    conditionModelId: cond.conditionModelId,
    datasetId,
    baseConditionModelId: cond.baseConditionModelId,
    baseDatasetId,
  }

  // 过滤掉 undefined 和空字符串（保留 null 和 0）
  Object.keys(config).forEach(key => {
    if (config[key] === undefined || config[key] === '') {
      delete config[key]
    }
  })

  return config
}

/**
 * 检查条件数量是否超过上限
 */
export function checkConditionLimit(count) {
  return count <= MAX_CONDITIONS
}

/**
 * 生成默认的条件 ID
 */
let condIdCounter = 1
export function generateConditionId() {
  return `page_cond_${Date.now()}_${condIdCounter++}`
}

/**
 * 生成默认的页面配置
 */
export function createDefaultPageConfig() {
  return {
    conditions: [],
    logicOperators: [],
    result: null
  }
}
