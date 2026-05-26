import React, { useState, useEffect, useCallback } from 'react'
import {
  Layout, Table, Button, Modal, Form, Input, Select, Tag, message, Space, Drawer, Popconfirm, Switch, Alert
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SettingOutlined, CheckCircleOutlined, UnorderedListOutlined
} from '@ant-design/icons'
import axios from 'axios'

const API = '/api/v1/pathways'

const STATUS_MAP = {
  DRAFT: { color: 'default', text: '草稿' },
  PUBLISHED: { color: 'green', text: '已发布' },
  DISABLED: { color: 'red', text: '已禁用' },
}

const TASK_TYPE_MAP = {
  RULE: { text: '规则任务', color: 'blue', nodeType: 'rule' },
  SERVICE: { text: '服务任务', color: 'cyan', nodeType: 'service_task' },
  AGENT: { text: '智能体任务', color: 'purple', nodeType: 'agent_task' },
  HUMAN: { text: '人工任务', color: 'magenta', nodeType: 'human_task' },
  CHECKLIST: { text: '检查清单', color: 'orange', nodeType: null },
}

const TASK_TYPE_OPTIONS = Object.entries(TASK_TYPE_MAP).map(([key, val]) => ({
  value: key,
  label: val.text,
  nodeType: val.nodeType,
}))

export default function ClinicalPathwayMgr() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()
  const [processList, setProcessList] = useState([])

  const [stageDrawerOpen, setStageDrawerOpen] = useState(false)
  const [currentPathway, setCurrentPathway] = useState(null)
  const [stages, setStages] = useState([])
  const [stageModalOpen, setStageModalOpen] = useState(false)
  const [editingStage, setEditingStage] = useState(null)
  const [stageForm] = Form.useForm()

  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false)
  const [currentStage, setCurrentStage] = useState(null)
  const [tasks, setTasks] = useState([])
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [taskForm] = Form.useForm()
  const [processNodes, setProcessNodes] = useState([])

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axios.get(API)
      setList(res.data || [])
    } catch (e) {
      message.error('加载临床大路径失败: ' + (e.response?.data?.message || e.message))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchList()
    axios.get('/api/v1/processes').then(res => {
      setProcessList(Array.isArray(res.data) ? res.data : [])
    }).catch(() => {})
  }, [fetchList])

  const handleSave = async () => {
    const values = await form.validateFields()
    try {
      if (editing) {
        await axios.put(`${API}/${editing.id}`, { ...editing, ...values })
        message.success('更新成功')
      } else {
        await axios.post(API, values)
        message.success('创建成功')
      }
      setModalOpen(false)
      fetchList()
    } catch (e) {
      message.error('保存失败: ' + (e.response?.data?.message || e.message))
    }
  }

  const handlePublish = async (id) => {
    try {
      await axios.post(`${API}/${id}/publish`)
      message.success('发布成功')
      fetchList()
    } catch (e) {
      message.error('发布失败: ' + (e.response?.data?.message || e.message))
    }
  }

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/${id}`)
      message.success('删除成功')
      fetchList()
    } catch (e) {
      message.error('删除失败: ' + (e.response?.data?.message || e.message))
    }
  }

  const openEdit = (record) => {
    setEditing(record)
    form.setFieldsValue(record)
    setModalOpen(true)
  }

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openStageDrawer = async (record) => {
    setCurrentPathway(record)
    setStageDrawerOpen(true)
    try {
      const res = await axios.get(`${API}/${record.id}/full`)
      const data = res.data || {}
      setStages((data.stages || []).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)))
    } catch (e) {
      message.error('加载路径详情失败: ' + (e.response?.data?.message || e.message))
      setStages([])
    }
  }

  const handleSaveStages = async () => {
    if (!currentPathway) return
    try {
      const data = stages.map(({ id, createdAt, updatedAt, tasks, ...rest }) => rest)
      await axios.post(`${API}/${currentPathway.id}/stages`, data)
      message.success('阶段配置保存成功')
      setStageDrawerOpen(false)
    } catch (e) {
      message.error('保存阶段失败: ' + (e.response?.data?.message || e.message))
    }
  }

  const openStageModal = (stage) => {
    if (stage) {
      setEditingStage(stage)
      stageForm.setFieldsValue(stage)
    } else {
      setEditingStage(null)
      stageForm.resetFields()
      const nextOrder = stages.length > 0
        ? Math.max(...stages.map(s => s.sortOrder || 0)) + 1
        : 1
      stageForm.setFieldsValue({ sortOrder: nextOrder })
    }
    setStageModalOpen(true)
  }

  const handleSaveStage = async () => {
    const values = await stageForm.validateFields()
    if (editingStage) {
      setStages(prev => prev.map(s => (s.id === editingStage.id ? { ...s, ...values } : s)))
    } else {
      setStages(prev => [...prev, { ...values, id: 'tmp_' + Date.now(), tasks: [] }])
    }
    setStageModalOpen(false)
  }

  const handleDeleteStage = (id) => {
    setStages(prev => prev.filter(s => s.id !== id))
  }

  // --- 任务配置 ---

  const isTmpId = (id) => typeof id === 'string' && id.startsWith('tmp_')

  const fetchProcessNodes = useCallback(async (processDefId) => {
    if (!processDefId) {
      setProcessNodes([])
      return
    }
    try {
      const res = await axios.get(`/api/v1/processes/${processDefId}`)
      const data = res.data || {}
      let nodes = []
      if (data.canvasData) {
        try {
          const parsed = JSON.parse(data.canvasData)
          nodes = (parsed.nodes || []).filter(n => n.type && n.type !== 'start' && n.type !== 'end' && n.type !== 'condition')
        } catch (e) {
          console.warn('解析流程画布失败', e)
        }
      }
      setProcessNodes(nodes)
    } catch (e) {
      message.warning('加载流程节点失败')
      setProcessNodes([])
    }
  }, [])

  const openTaskDrawer = (stage) => {
    setCurrentStage(stage)
    setTasks((stage.tasks || []).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)))
    setTaskDrawerOpen(true)
    if (currentPathway?.processDefId) {
      fetchProcessNodes(currentPathway.processDefId)
    } else {
      setProcessNodes([])
    }
  }

  const handleSaveTasks = async () => {
    if (!currentStage || isTmpId(currentStage.id)) {
      message.warning('请先保存阶段配置，再保存任务')
      return
    }
    try {
      const data = tasks.map(({ id, createdAt, updatedAt, ...rest }) => rest)
      await axios.post(`${API}/${currentStage.id}/tasks`, data)
      message.success('任务配置保存成功')
      setTaskDrawerOpen(false)
      // 刷新 stages 中的任务数据
      setStages(prev => prev.map(s => s.id === currentStage.id ? { ...s, tasks: [...tasks] } : s))
    } catch (e) {
      message.error('保存任务失败: ' + (e.response?.data?.message || e.message))
    }
  }

  const openTaskModal = (task) => {
    if (task) {
      setEditingTask(task)
      taskForm.setFieldsValue(task)
    } else {
      setEditingTask(null)
      taskForm.resetFields()
      const nextOrder = tasks.length > 0
        ? Math.max(...tasks.map(t => t.sortOrder || 0)) + 1
        : 1
      taskForm.setFieldsValue({ sortOrder: nextOrder, required: true })
    }
    setTaskModalOpen(true)
  }

  const handleSaveTask = async () => {
    const values = await taskForm.validateFields()
    if (editingTask) {
      setTasks(prev => prev.map(t => (t.id === editingTask.id ? { ...t, ...values } : t)))
    } else {
      setTasks(prev => [...prev, { ...values, id: 'tmp_' + Date.now() }])
    }
    setTaskModalOpen(false)
  }

  const handleDeleteTask = (id) => {
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const getFilteredNodes = (taskType) => {
    const cfg = TASK_TYPE_MAP[taskType]
    if (!cfg || !cfg.nodeType) return []
    return processNodes.filter(n => n.type === cfg.nodeType)
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '编码', dataIndex: 'code', width: 140 },
    { title: '名称', dataIndex: 'name', width: 180, ellipsis: true },
    { title: '描述', dataIndex: 'description', ellipsis: true, render: v => v || '-' },
    { title: '版本', dataIndex: 'version', width: 80 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: v => {
        const cfg = STATUS_MAP[v] || { color: 'default', text: v }
        return <Tag color={cfg.color}>{cfg.text}</Tag>
      }
    },
    {
      title: '关联流程',
      dataIndex: 'processDefId',
      width: 140,
      ellipsis: true,
      render: v => {
        if (!v) return '-'
        const p = processList.find(p => p.id === v)
        return p ? (p.name || p.code) : `ID:${v}`
      }
    },
    {
      title: '操作',
      width: 320,
      render: (_, record) => (
        <Space size={0}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          <Button type="link" size="small" icon={<SettingOutlined />} onClick={() => openStageDrawer(record)}>配置阶段</Button>
          {record.status !== 'PUBLISHED' && (
            <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handlePublish(record.id)}>发布</Button>
          )}
          <Popconfirm
            title="确认删除？"
            description={`将临床大路径「${record.name}」移入回收站`}
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  const stageColumns = [
    { title: '阶段编码', dataIndex: 'code', width: 140 },
    { title: '阶段名称', dataIndex: 'name', width: 160 },
    { title: '排序', dataIndex: 'sortOrder', width: 70 },
    { title: '描述', dataIndex: 'description', ellipsis: true, render: v => v || '-' },
    { title: '退出规则', dataIndex: 'exitRuleCode', width: 140, render: v => v || '-' },
    {
      title: '任务数',
      width: 80,
      render: (_, record) => (record.tasks || []).length
    },
    {
      title: '操作',
      width: 220,
      render: (_, record) => (
        <Space size={0}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openStageModal(record)}>编辑</Button>
          <Button type="link" size="small" icon={<UnorderedListOutlined />} onClick={() => openTaskDrawer(record)}>配置任务</Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteStage(record.id)}>删除</Button>
        </Space>
      )
    }
  ]

  const taskColumns = [
    { title: '任务编码', dataIndex: 'code', width: 140 },
    { title: '任务名称', dataIndex: 'name', width: 160 },
    {
      title: '任务类型',
      dataIndex: 'taskType',
      width: 110,
      render: v => {
        const cfg = TASK_TYPE_MAP[v] || { text: v, color: 'default' }
        return <Tag color={cfg.color}>{cfg.text}</Tag>
      }
    },
    {
      title: '关联流程节点',
      dataIndex: 'processNodeId',
      width: 160,
      ellipsis: true,
      render: v => {
        if (!v) return '-'
        const node = processNodes.find(n => n.id === v)
        return node ? (node.data?.label || v) : v
      }
    },
    {
      title: '必填',
      dataIndex: 'required',
      width: 70,
      render: v => v ? <Tag color="red">是</Tag> : <Tag>否</Tag>
    },
    { title: '排序', dataIndex: 'sortOrder', width: 70 },
    {
      title: '操作',
      width: 140,
      render: (_, record) => (
        <Space size={0}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openTaskModal(record)}>编辑</Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteTask(record.id)}>删除</Button>
        </Space>
      )
    }
  ]

  return (
    <Layout style={{ height: '100%', background: '#fff', padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>临床大路径管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建路径</Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={list}
        loading={loading}
        bordered
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editing ? '编辑临床大路径' : '新建临床大路径'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="路径编码" rules={[{ required: true, message: '请输入路径编码' }]}>
            <Input disabled={!!editing} placeholder="如 CP-001" />
          </Form.Item>
          <Form.Item name="name" label="路径名称" rules={[{ required: true, message: '请输入路径名称' }]}>
            <Input placeholder="如 急性心肌梗死临床大路径" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="路径描述" />
          </Form.Item>
          <Form.Item name="indication" label="适应症">
            <Input.TextArea rows={2} placeholder="适应症描述" />
          </Form.Item>
          <Form.Item name="admissionRuleCode" label="准入规则编码">
            <Input placeholder="关联的准入规则编码" />
          </Form.Item>
          <Form.Item name="processDefId" label="关联流程定义">
            <Select allowClear placeholder="选择流程编排定义（可选）">
              {processList.map(p => (
                <Select.Option key={p.id} value={p.id}>
                  {p.name || p.code}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={`阶段配置 - ${currentPathway?.name || ''}`}
        width={800}
        open={stageDrawerOpen}
        onClose={() => setStageDrawerOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setStageDrawerOpen(false)}>取消</Button>
            <Button type="primary" onClick={handleSaveStages}>保存阶段</Button>
          </div>
        }
      >
        <div style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openStageModal(null)}>添加阶段</Button>
        </div>
        <Table
          rowKey="id"
          columns={stageColumns}
          dataSource={stages}
          bordered
          pagination={false}
        />
      </Drawer>

      <Modal
        title={editingStage ? '编辑阶段' : '添加阶段'}
        open={stageModalOpen}
        onOk={handleSaveStage}
        onCancel={() => setStageModalOpen(false)}
        destroyOnClose
      >
        <Form form={stageForm} layout="vertical">
          <Form.Item name="code" label="阶段编码" rules={[{ required: true, message: '请输入阶段编码' }]}>
            <Input placeholder="如 STAGE-01" />
          </Form.Item>
          <Form.Item name="name" label="阶段名称" rules={[{ required: true, message: '请输入阶段名称' }]}>
            <Input placeholder="如 急性期" />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序号" rules={[{ required: true, message: '请输入排序号' }]}>
            <Input type="number" placeholder="数字越小越靠前" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="阶段描述" />
          </Form.Item>
          <Form.Item name="exitRuleCode" label="退出规则编码">
            <Input placeholder="退出该阶段需满足的规则编码" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={`任务配置 - ${currentStage?.name || ''}`}
        width={800}
        open={taskDrawerOpen}
        onClose={() => setTaskDrawerOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setTaskDrawerOpen(false)}>取消</Button>
            <Button type="primary" onClick={handleSaveTasks}>保存任务</Button>
          </div>
        }
      >
        {isTmpId(currentStage?.id) && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="当前阶段尚未保存"
            description="请先保存阶段配置，再保存任务。关闭阶段抽屉前记得点击「保存阶段」。"
          />
        )}
        {currentPathway?.processDefId ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="已关联流程编排"
            description="任务可通过「关联流程节点」引用流程编排中已配置的节点，复用其执行参数。"
          />
        ) : (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="未关联流程编排"
            description="当前路径未关联流程定义，任务将独立配置。如需引用流程节点，请先在路径编辑中选择「关联流程定义」。"
          />
        )}
        <div style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openTaskModal(null)}>添加任务</Button>
        </div>
        <Table
          rowKey="id"
          columns={taskColumns}
          dataSource={tasks}
          bordered
          pagination={false}
        />
      </Drawer>

      <Modal
        title={editingTask ? '编辑任务' : '添加任务'}
        open={taskModalOpen}
        onOk={handleSaveTask}
        onCancel={() => setTaskModalOpen(false)}
        destroyOnClose
      >
        <Form form={taskForm} layout="vertical">
          <Form.Item name="code" label="任务编码" rules={[{ required: true, message: '请输入任务编码' }]}>
            <Input placeholder="如 TASK-01" />
          </Form.Item>
          <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
            <Input placeholder="如 血常规检查" />
          </Form.Item>
          <Form.Item name="taskType" label="任务类型" rules={[{ required: true, message: '请选择任务类型' }]}>
            <Select placeholder="选择任务类型">
              {TASK_TYPE_OPTIONS.map(opt => (
                <Select.Option key={opt.value} value={opt.value}>{opt.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.taskType !== cur.taskType}>
            {({ getFieldValue }) => {
              const taskType = getFieldValue('taskType')
              const filtered = getFilteredNodes(taskType)
              const cfg = TASK_TYPE_MAP[taskType]
              return cfg?.nodeType ? (
                <Form.Item name="processNodeId" label="关联流程节点">
                  <Select allowClear placeholder={`选择${cfg.text}对应的流程节点`}>
                    {filtered.map(node => (
                      <Select.Option key={node.id} value={node.id}>
                        {node.data?.label || node.id} ({node.id})
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              ) : null
            }}
          </Form.Item>
          <Form.Item name="required" label="是否必填" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序号" rules={[{ required: true, message: '请输入排序号' }]}>
            <Input type="number" placeholder="数字越小越靠前" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="任务描述" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}
