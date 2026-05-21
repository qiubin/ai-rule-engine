import React, { useState, useEffect, useCallback } from 'react'
import {
  Layout, Table, Button, Modal, Form, Input, Select, Tag, message, Space, Drawer, Popconfirm
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SettingOutlined, CheckCircleOutlined
} from '@ant-design/icons'
import axios from 'axios'

const API = '/api/v1/pathways'

const STATUS_MAP = {
  DRAFT: { color: 'default', text: '草稿' },
  PUBLISHED: { color: 'green', text: '已发布' },
  DISABLED: { color: 'red', text: '已禁用' },
}

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
      // 后端重新创建阶段记录，去掉临时 ID 避免 Long 反序列化失败
      const data = stages.map(({ id, createdAt, updatedAt, ...rest }) => rest)
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
      setStages(prev => [...prev, { ...values, id: 'tmp_' + Date.now() }])
    }
    setStageModalOpen(false)
  }

  const handleDeleteStage = (id) => {
    setStages(prev => prev.filter(s => s.id !== id))
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
      width: 280,
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
      title: '操作',
      width: 140,
      render: (_, record) => (
        <Space size={0}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openStageModal(record)}>编辑</Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteStage(record.id)}>删除</Button>
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
        width={720}
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
    </Layout>
  )
}
