import React, { useState, useCallback, useRef, useEffect } from 'react'
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Panel,
} from 'reactflow'
import { Button, message, Modal, Input, Select, Form, Tag } from 'antd'
import { SaveOutlined, PlayCircleOutlined, PlusOutlined, DeleteOutlined, ArrowLeftOutlined, ColumnWidthOutlined } from '@ant-design/icons'
import dagre from '@dagrejs/dagre'
import { nodeTypes } from '../../components/Nodes'
import ConfigPanel from '../../components/ConfigPanel'
import ToolBar from '../../components/ToolBar'
import axios from 'axios'
import './style.css'

const API_BASE = '/api/v1'

let id = 1
const getId = () => `node_${id++}`

function FlowCanvas() {
  const reactFlowWrapper = useRef(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [reactFlowInstance, setReactFlowInstance] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [ruleForm] = Form.useForm()
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [currentRule, setCurrentRule] = useState(null)
  const [ruleTypes, setRuleTypes] = useState([])
  const [urlRuleTypeId, setUrlRuleTypeId] = useState(null)
  const [urlRuleId, setUrlRuleId] = useState(null)
  const [execModalOpen, setExecModalOpen] = useState(false)
  const [execForm] = Form.useForm()
  const [execFields, setExecFields] = useState([])
  const [executing, setExecuting] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const typeId = params.get('type')
    const rId = params.get('ruleId')
    setUrlRuleTypeId(typeId ? Number(typeId) : null)
    setUrlRuleId(rId ? Number(rId) : null)

    if (nodes.length === 0) {
      setNodes([
        { id: 'start', type: 'start', position: { x: 100, y: 200 }, data: { label: '开始' } },
        { id: 'end', type: 'end', position: { x: 800, y: 200 }, data: { label: '结束' } },
      ])
    }
    fetchRuleTypes()

    // 如果有 ruleId，加载已有规则
    if (rId) {
      loadRule(Number(rId))
    }
  }, [])

  const fetchRuleTypes = async () => {
    try {
      const res = await axios.get(`${API_BASE}/rule-types`)
      setRuleTypes(res.data)
    } catch (e) {}
  }

  const loadRule = async (ruleId) => {
    try {
      const res = await axios.get(`${API_BASE}/rules/${ruleId}`)
      const rule = res.data
      setCurrentRule(rule)
      let loadedNodes = []
      let loadedEdges = []
      if (rule.canvasData) {
        const canvas = JSON.parse(rule.canvasData)
        if (canvas.nodes) loadedNodes = canvas.nodes
        if (canvas.edges) loadedEdges = canvas.edges
      }
      // 标准化已有 start/end 节点的 id（如 start-1 → start），并同步更新 edges
      const normalizeNodeId = (oldId, newId) => {
        loadedNodes.forEach(n => {
          if (n.id === oldId) n.id = newId
        })
        loadedEdges.forEach(e => {
          if (e.source === oldId) e.source = newId
          if (e.target === oldId) e.target = newId
        })
      }
      loadedNodes.forEach(n => {
        if (n.type === 'start' && n.id !== 'start') {
          normalizeNodeId(n.id, 'start')
        }
        if (n.type === 'end' && n.id !== 'end') {
          normalizeNodeId(n.id, 'end')
        }
      })
      // 确保画布始终有开始和结束节点
      const hasStart = loadedNodes.some(n => n.id === 'start')
      const hasEnd = loadedNodes.some(n => n.id === 'end')
      if (!hasStart) {
        loadedNodes.unshift({ id: 'start', type: 'start', position: { x: 100, y: 200 }, data: { label: '开始' } })
      }
      if (!hasEnd) {
        loadedNodes.push({ id: 'end', type: 'end', position: { x: 800, y: 200 }, data: { label: '结束' } })
      }
      // 自动添加缺失的默认连线：start → 第一个条件节点，结果节点 → end
      const conditionNodes = loadedNodes.filter(n => n.type === 'condition')
      const resultNodes = loadedNodes.filter(n => n.type === 'result')
      if (conditionNodes.length > 0 && !loadedEdges.some(e => e.source === 'start')) {
        loadedEdges.push({
          id: 'e_start_first', source: 'start', target: conditionNodes[0].id,
          type: 'smoothstep', animated: true
        })
      }
      resultNodes.forEach((rn, idx) => {
        if (!loadedEdges.some(e => e.source === rn.id)) {
          loadedEdges.push({
            id: `e_result_${rn.id}_end`, source: rn.id, target: 'end',
            type: 'smoothstep', animated: true
          })
        }
      })
      // 修正 id 计数器，避免新拖入的节点与已有节点 ID 冲突
      let maxNum = 0
      loadedNodes.forEach(n => {
        const m = n.id && n.id.match(/^node_(\d+)$/)
        if (m) {
          const num = parseInt(m[1], 10)
          if (num > maxNum) maxNum = num
        }
      })
      id = maxNum + 1

      setNodes(loadedNodes)
      setEdges(loadedEdges)
    } catch (e) {
      message.error('加载规则失败')
    }
  }

  const onConnect = useCallback(
    (params) => {
      // condition 节点的 false handle 自动标记为 "否"
      let label = params.label || ''
      const sourceNode = nodes.find(n => n.id === params.source)
      if (sourceNode && sourceNode.type === 'condition') {
        if (params.sourceHandle === 'false') {
          label = '否'
        } else if (params.sourceHandle === 'true' || !params.sourceHandle) {
          label = '是'
        }
      }
      setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: true, label }, eds))
    },
    [setEdges, nodes]
  )

  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event) => {
      event.preventDefault()
      const type = event.dataTransfer.getData('application/reactflow')
      if (typeof type === 'undefined' || !type) return
      const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const newNode = { id: getId(), type, position, data: { label: getNodeLabel(type) } }
      setNodes((nds) => nds.concat(newNode))
    },
    [reactFlowInstance]
  )

  const getNodeLabel = (type) => {
    const labels = { start: '开始', condition: '条件', result: '结果', and: 'AND', or: 'OR', end: '结束' }
    return labels[type] || '节点'
  }

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node)
    setIsConfigOpen(true)
  }, [])

  const onNodeConfigUpdate = (nodeId, newData) => {
    setNodes((nds) => nds.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node)))
    setIsConfigOpen(false)
    message.success('节点配置已更新')
  }

  const handleSaveCanvas = async () => {
    if (!currentRule) {
      setSaveModalOpen(true)
      return
    }
    await doSaveCanvas(currentRule.id)
  }

  const doSaveCanvas = async (ruleId, silent = false) => {
    try {
      const canvasData = {
        nodes: nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
        edges: edges.map(e => ({
          id: e.id, source: e.source, target: e.target, label: e.label,
          sourceHandle: e.sourceHandle, targetHandle: e.targetHandle
        }))
      }
      await axios.put(`${API_BASE}/rules/${ruleId}/canvas`, canvasData)
      if (!silent) message.success('画布保存成功')
    } catch (err) {
      message.error('保存失败: ' + (err.response?.data?.message || err.message))
    }
  }

  const handleCreateRule = async (values) => {
    try {
      const res = await axios.post(`${API_BASE}/rules`, {
        code: values.code,
        name: values.name,
        ruleTypeId: values.ruleTypeId
      })
      setCurrentRule(res.data)
      setSaveModalOpen(false)
      message.success('规则创建成功')
      await doSaveCanvas(res.data.id)
    } catch (err) {
      message.error('创建失败: ' + (err.response?.data?.message || err.message))
    }
  }

  // 解析画布中的条件字段
  const parseConditionFields = () => {
    const fieldMap = new Map() // field -> { field, dataType, label, operators: Set }
    const upsert = (field, dataType, label, operator) => {
      if (!field) return
      if (!fieldMap.has(field)) {
        fieldMap.set(field, { field, dataType, label, operators: new Set() })
      }
      if (operator) fieldMap.get(field).operators.add(operator)
    }
    nodes.forEach(node => {
      if (node.type === 'condition' && node.data?.conditionConfig) {
        const cfg = node.data.conditionConfig
        upsert(cfg.field, cfg.dataType, node.data.label || cfg.field, cfg.operator)
        // fieldCompare 需要额外输入字段A和字段B
        if (cfg.operator === 'fieldCompare') {
          upsert(cfg.value, cfg.dataType, cfg.value + ' (字段A)', cfg.operator)
          upsert(cfg.extraValue1, cfg.dataType, cfg.extraValue1 + ' (字段B)', cfg.operator)
        }
      }
    })
    // 仅当字段所有用到的操作符都是空值/非空校验时，才允许留空
    const BLANK_OPS = new Set(['isBlank', 'isNotBlank'])
    return Array.from(fieldMap.values()).map(f => ({
      field: f.field,
      dataType: f.dataType,
      label: f.label,
      optional: f.operators.size > 0 && Array.from(f.operators).every(op => BLANK_OPS.has(op)),
    }))
  }

  const handleExecute = async () => {
    if (!currentRule) { message.warning('请先保存规则'); return }
    const fields = parseConditionFields()
    setExecFields(fields)
    const initialValues = {}
    fields.forEach(f => { initialValues[f.field] = '' })
    execForm.setFieldsValue(initialValues)
    setExecModalOpen(true)
  }

  const doExecute = async () => {
    const values = await execForm.validateFields().catch(() => null)
    if (!values) return
    setExecuting(true)
    try {
      // 先保存画布，确保后端拿到最新数据（静默保存，不弹提示）
      await doSaveCanvas(currentRule.id, true)
      // 调用 test-execute（无需发布）
      const res = await axios.post(`${API_BASE}/rules/${currentRule.id}/test-execute`, values)
      // 渲染高亮动态值的结果内容
      const renderHighlightedContent = (template, params) => {
        if (!template) return null
        const regex = /\$\{(\w+)\}/g
        const parts = []
        let lastIndex = 0
        let match
        while ((match = regex.exec(template)) !== null) {
          if (match.index > lastIndex) {
            parts.push(<span key={`t${lastIndex}`}>{template.slice(lastIndex, match.index)}</span>)
          }
          const fieldName = match[1]
          const value = params?.[fieldName]
          parts.push(
            <span key={`v${match.index}`} style={{
              color: '#cf1322', fontWeight: 'bold',
              background: '#fff1f0', padding: '1px 4px', borderRadius: 3,
              borderBottom: '2px solid #ff4d4f'
            }}>
              {value !== undefined && value !== null ? String(value) : match[0]}
            </span>
          )
          lastIndex = match.index + match[0].length
        }
        if (lastIndex < template.length) {
          parts.push(<span key={`t${lastIndex}`}>{template.slice(lastIndex)}</span>)
        }
        return parts.length > 0 ? parts : template
      }

      const resultColors = {
        REJECT: { border: '#ff4d4f', bg: '#fff2f0', icon: '✗', label: '拦截' },
        WARNING: { border: '#faad14', bg: '#fffbe6', icon: '⚠', label: '警告' },
        REMINDER: { border: '#1890ff', bg: '#e6f7ff', icon: 'ℹ', label: '提醒' },
        CONTRAINDICATION: { border: '#ff4d4f', bg: '#fff2f0', icon: '✗', label: '禁忌' },
        INTERACTION: { border: '#faad14', bg: '#fffbe6', icon: '⚠', label: '相互作用' },
      }
      Modal.success({
        title: '规则执行结果',
        width: 680,
        content: (
          <div>
            <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fafafa', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 24 }}>
              <div>
                <span style={{ fontWeight: 'bold', color: '#666', fontSize: 13 }}>触发规则</span>
                <div style={{ color: res.data.firedRules > 0 ? '#52c41a' : '#999', fontSize: 28, fontWeight: 'bold' }}>{res.data.firedRules}</div>
              </div>
              <div>
                <span style={{ fontWeight: 'bold', color: '#666', fontSize: 13 }}>匹配结果</span>
                <div style={{ color: res.data.matched ? '#52c41a' : '#ff4d4f', fontSize: 16, fontWeight: 'bold' }}>{res.data.matched ? '已匹配' : '未匹配'}</div>
              </div>
            </div>
            {res.data.results && Array.isArray(res.data.results) && res.data.results.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#333' }}>匹配详情:</div>
                {res.data.results.map((r, idx) => {
                  const rc = resultColors[r.resultType] || { border: '#52c41a', bg: '#f6ffed', icon: '✓', label: '通过' }
                  return (
                    <div key={idx} style={{
                      border: `1px solid ${rc.border}`,
                      background: rc.bg,
                      padding: 12,
                      marginBottom: 8,
                      borderRadius: 6,
                      fontSize: 13
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{
                          display: 'inline-block',
                          background: rc.border,
                          color: '#fff',
                          borderRadius: 3,
                          padding: '0 6px',
                          fontSize: 12,
                          lineHeight: '20px'
                        }}>{rc.icon} {rc.label}</span>
                        <span style={{ fontWeight: 'bold', color: '#333' }}>{r.nodeLabel}</span>
                        <Tag style={{ marginLeft: 'auto', fontSize: 11 }} color="default">{r.resultType}</Tag>
                      </div>
                      {r.content && (
                        <div style={{
                          background: '#fff',
                          border: `1px dashed ${rc.border}`,
                          borderRadius: 4,
                          padding: '8px 10px',
                          marginTop: 4,
                          color: '#333',
                          fontSize: 13,
                          lineHeight: 1.6
                        }}>
                          {renderHighlightedContent(r.content, res.data.parameters)}
                        </div>
                      )}
                      <div style={{ marginTop: 6, color: '#888', fontSize: 12 }}>
                        结果值: {r.resultValue}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <details>
              <summary style={{ cursor: 'pointer', color: '#1890ff', fontSize: 13 }}>原始响应</summary>
              <pre style={{ maxHeight: 300, overflow: 'auto', fontSize: 12, background: '#f6ffed', padding: 8, borderRadius: 4, marginTop: 4 }}>
                {JSON.stringify(res.data, null, 2)}
              </pre>
            </details>
          </div>
        )
      })
      setExecModalOpen(false)
    } catch (err) {
      message.error('执行失败: ' + (err.response?.data?.message || err.message))
    }
    setExecuting(false)
  }

  const handleDeleteNode = () => {
    if (!selectedNode) return
    if (selectedNode.type === 'start' || selectedNode.type === 'end') { message.warning('开始和结束节点不能删除'); return }
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id))
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id))
    setSelectedNode(null)
    setIsConfigOpen(false)
  }

  const handleAutoLayout = useCallback(() => {
    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 100 })

    const nodeWidth = 172
    const nodeHeight = 60
    nodes.forEach(n => g.setNode(n.id, { width: nodeWidth, height: nodeHeight }))
    edges.forEach(e => g.setEdge(e.source, e.target))

    dagre.layout(g)

    setNodes(nds => nds.map(n => {
      const node = g.node(n.id)
      if (!node) return n
      return {
        ...n,
        position: { x: node.x - nodeWidth / 2, y: node.y - nodeHeight / 2 }
      }
    }))
    message.success('节点已自动排列')
  }, [nodes, edges, setNodes])

  const goBack = () => {
    window.location.href = '/?page=types'
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ width: 200, borderRight: '1px solid #ddd', background: '#fafafa' }}>
        <ToolBar />
      </div>
      <div style={{ flex: 1, position: 'relative' }} ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect} onInit={setReactFlowInstance}
          onDrop={onDrop} onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes} fitView
        >
          <Controls /><MiniMap /><Background variant="dots" gap={12} size={1} />
          <Panel position="top-right">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button icon={<ArrowLeftOutlined />} onClick={goBack}>返回</Button>
              {currentRule && <span style={{ background: '#f0f0f0', padding: '4px 12px', borderRadius: 4, fontSize: 13 }}>
                当前规则: {currentRule.name} ({currentRule.code})
              </span>}
              <Button icon={<ColumnWidthOutlined />} onClick={handleAutoLayout}>一键排列</Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveCanvas}>保存画布</Button>
              <Button icon={<PlayCircleOutlined />} onClick={handleExecute}>测试执行</Button>
              {selectedNode && (
                <Button danger icon={<DeleteOutlined />} onClick={handleDeleteNode}>删除节点</Button>
              )}
            </div>
          </Panel>
        </ReactFlow>
      </div>
      <ConfigPanel
        open={isConfigOpen} onClose={() => setIsConfigOpen(false)}
        node={selectedNode} onUpdate={onNodeConfigUpdate}
        conditionFields={parseConditionFields()}
      />
      <Modal title="测试执行参数" open={execModalOpen} onCancel={() => setExecModalOpen(false)} onOk={doExecute} confirmLoading={executing}>
        <Form form={execForm} layout="vertical">
          {execFields.length === 0 ? (
            <div style={{ color: '#999', padding: 20, textAlign: 'center' }}>该画布中未配置条件节点，无需输入参数</div>
          ) : (
            <>
              {execFields.some(f => f.optional) && (
                <div style={{ color: '#999', fontSize: 12, marginBottom: 12 }}>
                  提示：标记为「可空」的字段对应「空值校验/非空校验」操作符，留空即测试空值场景
                </div>
              )}
              {execFields.map(f => (
                <Form.Item
                  key={f.field}
                  name={f.field}
                  label={
                    <span>
                      {f.label} ({f.dataType || 'STRING'})
                      {f.optional && <Tag color="blue" style={{ marginLeft: 8 }}>可空</Tag>}
                    </span>
                  }
                  rules={f.optional ? [] : [{ required: true, message: `请输入 ${f.label}` }]}
                >
                  <Input placeholder={f.optional ? `请输入 ${f.label}（留空表示空值）` : `请输入 ${f.label}`} allowClear={f.optional} />
                </Form.Item>
              ))}
            </>
          )}
        </Form>
      </Modal>

      <Modal title="创建规则" open={saveModalOpen} onCancel={() => setSaveModalOpen(false)} onOk={() => ruleForm.submit()}>
        <Form form={ruleForm} onFinish={handleCreateRule} layout="vertical"
          initialValues={{ ruleTypeId: urlRuleTypeId || undefined }}>
          <Form.Item name="code" label="规则编码" rules={[{ required: true }]}>
            <Input placeholder="如：AGE_CHECK_001" />
          </Form.Item>
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}>
            <Input placeholder="如：主诉持续时间" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input placeholder="实现方法关键词 + 对应计算符 + 配置要点" />
          </Form.Item>
          <Form.Item name="ruleTypeId" label="规则类型" rules={[{ required: true, message: '必须选择规则类型' }]}>
            <Select placeholder="选择规则类型">
              {ruleTypes.map(rt => (
                <Select.Option key={rt.id} value={rt.id}>{rt.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default function RuleEditor() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  )
}
