import React, { useState, useEffect } from 'react'
import { Table, Button, Tag, Space, message, Modal } from 'antd'
import { RollbackOutlined, DeleteOutlined, RestOutlined } from '@ant-design/icons'
import axios from 'axios'

const RULE_API = '/api/v1/rules'
const RT_API = '/api/v1/rule-types'

export default function RecycleBin() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(false)
  const [ruleTypes, setRuleTypes] = useState([])

  useEffect(() => {
    fetchDeletedRules()
    fetchRuleTypes()
  }, [])

  const fetchRuleTypes = async () => {
    try {
      const res = await axios.get(`${RT_API}?flat=true`)
      setRuleTypes(res.data || [])
    } catch (e) {}
  }

  const fetchDeletedRules = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${RULE_API}/deleted`)
      setRules(res.data || [])
    } catch (e) {
      message.error('加载回收站失败')
    }
    setLoading(false)
  }

  const handleRestore = async (rule) => {
    try {
      await axios.post(`${RULE_API}/${rule.id}/restore`)
      message.success('规则已恢复')
      fetchDeletedRules()
    } catch (err) {
      message.error('恢复失败: ' + (err.response?.data?.message || err.message))
    }
  }

  const handlePermanentDelete = async (rule) => {
    Modal.confirm({
      title: '彻底删除确认',
      content: `规则「${rule.name}」将被永久删除，无法恢复。确定继续吗？`,
      okText: '彻底删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await axios.delete(`${RULE_API}/${rule.id}/permanent`)
          message.success('规则已彻底删除')
          fetchDeletedRules()
        } catch (err) {
          message.error('删除失败: ' + (err.response?.data?.message || err.message))
        }
      }
    })
  }

  const getTypeName = (typeId) => {
    const rt = ruleTypes.find(t => t.id === typeId)
    return rt ? rt.name : '-'
  }

  const statusMap = {
    DRAFT: { text: '草稿', color: 'processing' },
    PUBLISHED: { text: '已发布', color: 'success' },
    DISABLED: { text: '已停用', color: 'error' },
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '编码', dataIndex: 'code', width: 160 },
    { title: '名称', dataIndex: 'name', width: 180, ellipsis: true },
    { title: '规则类型', width: 140, render: (_, r) => getTypeName(r.ruleTypeId) },
    { title: '版本', dataIndex: 'version', width: 70 },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (s) => {
        const cfg = statusMap[s] || { text: s, color: 'default' }
        return <Tag color={cfg.color}>{cfg.text}</Tag>
      }
    },
    {
      title: '删除时间', dataIndex: 'deletedAt', width: 160,
      render: (v) => v ? new Date(v).toLocaleString() : '-'
    },
    {
      title: '操作', width: 180,
      render: (_, record) => (
        <Space size={0}>
          <Button type="link" size="small" icon={<RollbackOutlined />} onClick={() => handleRestore(record)}>
            恢复
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handlePermanentDelete(record)}>
            彻底删除
          </Button>
        </Space>
      )
    }
  ]

  return (
    <div style={{ padding: 24, background: '#fff', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}><RestOutlined style={{ marginRight: 8 }} />回收站</h2>
        <Button onClick={fetchDeletedRules} loading={loading}>刷新</Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={rules}
        loading={loading}
        bordered
        locale={{ emptyText: '回收站为空' }}
      />
    </div>
  )
}
