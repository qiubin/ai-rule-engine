import React, { useState, useEffect } from 'react'
import { Layout, Table, Button, Modal, Form, Input, Empty, Card, Drawer, Tag, Space, Descriptions, message, Select } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, PartitionOutlined, HistoryOutlined, FileTextOutlined, EyeOutlined, RollbackOutlined, CaretRightOutlined, CaretDownOutlined } from '@ant-design/icons'
import FlowCanvasViewer from '../../components/Canvas/FlowCanvasViewer'
import axios from 'axios'

const { Sider, Content } = Layout
const RT_API = '/api/v1/rule-types'
const RULE_API = '/api/v1/rules'

export default function RuleTypeMgr() {
  const [ruleTypes, setRuleTypes] = useState([])
  const [subTypes, setSubTypes] = useState({})
  const [rules, setRules] = useState([])
  const [selectedTypeId, setSelectedTypeId] = useState(null)
  const [selectedType, setSelectedType] = useState(null)
  const [loading, setLoading] = useState(false)
  const [typeModalOpen, setTypeModalOpen] = useState(false)
  const [editingType, setEditingType] = useState(null)
  const [typeForm] = Form.useForm()
  const [errorMsg, setErrorMsg] = useState('')
  const [expandedIds, setExpandedIds] = useState(new Set())

  // 执行日志
  const [logDrawerOpen, setLogDrawerOpen] = useState(false)
  const [logList, setLogList] = useState([])
  const [logLoading, setLogLoading] = useState(false)
  const [currentLogRule, setCurrentLogRule] = useState(null)
  const [logDetailModalOpen, setLogDetailModalOpen] = useState(false)
  const [currentLog, setCurrentLog] = useState(null)

  // 历史版本
  const [versionModalOpen, setVersionModalOpen] = useState(false)
  const [versionList, setVersionList] = useState([])
  const [versionLoading, setVersionLoading] = useState(false)
  const [currentVersionRule, setCurrentVersionRule] = useState(null)
  const [versionPreviewModalOpen, setVersionPreviewModalOpen] = useState(false)
  const [currentVersion, setCurrentVersion] = useState(null)

  const fetchRuleTypes = async () => {
    try {
      setErrorMsg('')
      const res = await axios.get(RT_API)
      const list = res.data || []
      setRuleTypes(list)
      // 自动选中第一个
      if (list.length > 0 && !selectedTypeId) {
        setSelectedTypeId(list[0].id)
        setSelectedType(list[0])
      }
    } catch (e) {
      setErrorMsg('加载规则类型失败: ' + (e.message || '未知错误'))
    }
  }

  const fetchRules = async (typeId, extraIds) => {
    if (!typeId) return
    setLoading(true)
    try {
      const ids = [typeId, ...(extraIds || [])]
      const res = await axios.get(`${RULE_API}?ruleTypeIds=${ids.join(',')}`)
      setRules(res.data || [])
    } catch (e) {
      setErrorMsg('加载规则失败')
    }
    setLoading(false)
  }

  const fetchSubTypes = async (parentId) => {
    try {
      const res = await axios.get(`${RT_API}?parentId=${parentId}`)
      const children = res.data || []
      setSubTypes(prev => ({ ...prev, [parentId]: children }))
      // 子类型加载完后自动拉取规则
      if (selectedTypeId === parentId) {
        fetchRules(parentId, children.map(c => c.id))
      }
    } catch (e) {}
  }

  useEffect(() => { fetchRuleTypes() }, [])
  useEffect(() => {
    if (!selectedTypeId) return
    const children = subTypes[selectedTypeId]
    if (children !== undefined) {
      // 已缓存子类型数据，直接拉规则
      fetchRules(selectedTypeId, children.map(c => c.id))
    } else {
      // 子类型还没加载，先加载
      fetchSubTypes(selectedTypeId)
    }
  }, [selectedTypeId])
  // 预加载所有类型，供迁移弹窗使用
  useEffect(() => {
    axios.get(`${RT_API}?flat=true`).then(res => setAllTypes(res.data || [])).catch(() => {})
  }, [])

  const handleToggleExpand = (typeId) => {
    const next = new Set(expandedIds)
    if (next.has(typeId)) {
      next.delete(typeId)
    } else {
      next.add(typeId)
      if (!subTypes[typeId]) {
        fetchSubTypes(typeId)
      }
    }
    setExpandedIds(next)
  }

  const handleSelectType = (type) => {
    setSelectedTypeId(type.id)
    setSelectedType(type)
  }

  const handleSaveType = async () => {
    const values = await typeForm.validateFields()
    try {
      if (editingType) {
        await axios.put(`${RT_API}/${editingType.id}`, { ...editingType, ...values })
      } else {
        await axios.post(RT_API, values)
      }
      setTypeModalOpen(false)
      fetchRuleTypes()
      // 如果有 parentId，刷新父类型的子类型列表
      if (values.parentId) {
        fetchSubTypes(values.parentId)
      }
    } catch (e) {
      setErrorMsg('保存失败: ' + (e.response?.data?.message || e.message))
    }
  }

  const handleDeleteType = async (id) => {
    try {
      await axios.delete(`${RT_API}/${id}`)
      if (selectedTypeId === id) {
        setSelectedTypeId(null)
        setSelectedType(null)
        setRules([])
      }
      fetchRuleTypes()
    } catch (e) {
      setErrorMsg('删除失败: ' + (e.response?.data?.message || e.message))
    }
  }

  const handleDeleteRule = async (id) => {
    try {
      await axios.delete(`${RULE_API}/${id}`)
      fetchRules(selectedTypeId)
    } catch (e) {
      setErrorMsg('删除失败')
    }
  }

  const handleCreateRule = () => {
    if (!selectedTypeId) {
      setErrorMsg('请先选择规则类型')
      return
    }
    window.location.href = `/?type=${selectedTypeId}&page=editor`
  }

  const handleEditRule = (rule) => {
    window.location.href = `/?type=${rule.ruleTypeId}&ruleId=${rule.id}&page=editor`
  }

  const handlePageEditRule = (rule) => {
    window.location.href = `/?type=${rule.ruleTypeId}&ruleId=${rule.id}&page=pageEditor`
  }

  // 执行日志
  const openLogDrawer = async (rule) => {
    setCurrentLogRule(rule)
    setLogDrawerOpen(true)
    setLogLoading(true)
    try {
      const res = await axios.get(`${RULE_API}/${rule.id}/logs`)
      setLogList(res.data || [])
    } catch (e) {
      setErrorMsg('加载执行日志失败')
    }
    setLogLoading(false)
  }

  const openLogDetail = (log) => {
    setCurrentLog(log)
    setLogDetailModalOpen(true)
  }

  const parseHitNodeIds = (log) => {
    try {
      return JSON.parse(log.hitNodeIds || '[]')
    } catch (e) {
      return []
    }
  }

  // 历史版本
  const openVersionModal = async (rule) => {
    setCurrentVersionRule(rule)
    setVersionModalOpen(true)
    setVersionLoading(true)
    try {
      const res = await axios.get(`${RULE_API}/${rule.id}/versions`)
      setVersionList(res.data || [])
    } catch (e) {
      setErrorMsg('加载历史版本失败')
    }
    setVersionLoading(false)
  }

  const openVersionPreview = (version) => {
    setCurrentVersion(version)
    setVersionPreviewModalOpen(true)
  }

  const handleRollback = async (version) => {
    if (!window.confirm(`确认回滚到版本 ${version.version}？回滚后规则将变为草稿状态，需要重新发布。`)) {
      return
    }
    try {
      await axios.post(`${RULE_API}/${currentVersionRule.id}/rollback/${version.id}`)
      message.success('回滚成功')
      setVersionModalOpen(false)
      fetchRules(selectedTypeId)
    } catch (e) {
      setErrorMsg('回滚失败: ' + (e.response?.data?.message || e.message))
    }
  }

  // 规则迁移
  const [moveModalOpen, setMoveModalOpen] = useState(false)
  const [moveTargetRule, setMoveTargetRule] = useState(null)
  const [allTypes, setAllTypes] = useState([])
  const [moveTypeId, setMoveTypeId] = useState(null)

  const openMoveModal = (rule) => {
    setMoveTargetRule(rule)
    setMoveTypeId(rule.ruleTypeId)
    setMoveModalOpen(true)
  }

  const handleMoveRule = async () => {
    if (!moveTargetRule || !moveTypeId) return
    try {
      await axios.put(`${RULE_API}/${moveTargetRule.id}`, { ...moveTargetRule, ruleTypeId: moveTypeId })
      message.success('规则已迁移')
      setMoveModalOpen(false)
      fetchRules(selectedTypeId)
    } catch (e) {
      message.error('迁移失败: ' + (e.response?.data?.message || e.message))
    }
  }

  const typeMap = {}
  allTypes.forEach(t => { typeMap[t.id] = t })

  const ruleColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '编码', dataIndex: 'code', width: 160 },
    { title: '名称', dataIndex: 'name', width: 160, ellipsis: true },
    { title: '备注', dataIndex: 'remark', width: 220, ellipsis: true, render: v => v || '-' },
    { title: '版本', dataIndex: 'version', width: 70 },
    { title: '状态', dataIndex: 'status', width: 80 },
    {
      title: '操作', width: 340,
      render: (_, record) => (
        <Space size={0} key={'ops-' + record.id}>
          <Button type="link" size="small" icon={<PartitionOutlined />} onClick={() => handleEditRule(record)}>编辑画布</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handlePageEditRule(record)}>页面编辑</Button>
          <Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => openLogDrawer(record)}>日志</Button>
          <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => openVersionModal(record)}>历史</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openMoveModal(record)}>移动</Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => {
            if (window.confirm('确认将规则「' + record.name + '」移入回收站？')) {
              handleDeleteRule(record.id)
            }
          }}>删除</Button>
        </Space>
      )
    }
  ]

  const renderTypeItem = (type, depth = 0) => {
    const children = subTypes[type.id] || []
    const isExpanded = expandedIds.has(type.id)
    const hasChildren = children.length > 0
    const isSelected = selectedTypeId === type.id

    return (
      <React.Fragment key={type.id}>
        <Card
          size="small"
          style={{
            marginBottom: 4,
            marginLeft: depth * 16,
            cursor: 'pointer',
            border: isSelected ? '1px solid #1890ff' : '1px solid #f0f0f0',
            background: isSelected ? '#e6f7ff' : '#fff'
          }}
          bodyStyle={{ padding: '6px 10px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            onClick={() => handleSelectType(type)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}
              onClick={e => { e.stopPropagation(); handleToggleExpand(type.id) }}
            >
              {hasChildren ? (
                isExpanded ? <CaretDownOutlined style={{ fontSize: 12, color: '#999' }} />
                  : <CaretRightOutlined style={{ fontSize: 12, color: '#999' }} />
              ) : (
                <span style={{ width: 12, display: 'inline-block' }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }} onClick={() => handleSelectType(type)}>
                <span style={{ fontWeight: depth === 0 ? 'bold' : 'normal', fontSize: depth === 0 ? 14 : 13 }}>
                  {type.name}
                </span>
                <span style={{ fontSize: 11, color: '#999', marginLeft: 6 }}>{type.code}</span>
                {type.sortOrder != null && (
                  <span style={{ fontSize: 11, color: '#1890ff', marginLeft: 6, background: '#e6f7ff', padding: '0 6px', borderRadius: 4 }}>
                    排序:{type.sortOrder}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
              <Button type="text" size="small" icon={<PlusOutlined />}
                onClick={() => {
                  setEditingType(null)
                  typeForm.resetFields()
                  typeForm.setFieldsValue({ parentId: type.id })
                  setTypeModalOpen(true)
                }}
                title="添加子类"
              />
              <Button type="text" size="small" icon={<EditOutlined />}
                onClick={() => {
                  setEditingType(type)
                  typeForm.setFieldsValue(type)
                  setTypeModalOpen(true)
                }}
              />
              <Button type="text" size="small" danger icon={<DeleteOutlined />}
                onClick={() => {
                  if (window.confirm('确认删除规则类型 "' + type.name + '"?\n（若该类型下存在规则将无法删除）')) {
                    handleDeleteType(type.id)
                  }
                }}
              />
            </div>
          </div>
        </Card>
        {hasChildren && isExpanded && children.map(child => renderTypeItem(child, depth + 1))}
      </React.Fragment>
    )
  }

  return (
    <Layout style={{ height: '100%', background: '#fff' }}>
      <Sider width={280} style={{ background: '#fff', borderRight: '1px solid #f0f0f0', overflow: 'auto' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>规则类型</h3>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => {
            setEditingType(null)
            typeForm.resetFields()
            setTypeModalOpen(true)
          }} />
        </div>
        <div style={{ padding: '8px 8px' }}>
          {ruleTypes.map(rt => renderTypeItem(rt, 0))}
          {ruleTypes.length === 0 && !errorMsg && (
            <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>暂无规则类型</div>
          )}
        </div>
      </Sider>
      <Content style={{ padding: 24, background: '#fff', overflow: 'auto' }}>
        {errorMsg && (
          <div style={{ padding: '8px 16px', background: '#fff2f0', border: '1px solid #ffccc7', color: '#cf1322', marginBottom: 16, borderRadius: 4 }}>
            {errorMsg}
          </div>
        )}
        <div>
          {selectedType ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: 0 }}>{selectedType.name}</h2>
                  <div style={{ color: '#999', fontSize: 13 }}>{selectedType.description || '无描述'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button icon={<EditOutlined />} onClick={() => {
                    setEditingType(selectedType)
                    typeForm.setFieldsValue(selectedType)
                    setTypeModalOpen(true)
                  }}>编辑类型</Button>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateRule}>新建规则</Button>
                </div>
              </div>
              <Table rowKey="id" columns={ruleColumns} dataSource={rules} loading={loading} bordered />
            </div>
          ) : (
            <Empty description="请选择左侧规则类型" />
          )}
        </div>
      </Content>

      <Modal title={editingType ? '编辑规则类型' : '新增规则类型'} open={typeModalOpen} onOk={handleSaveType} onCancel={() => setTypeModalOpen(false)}>
        <Form form={typeForm} layout="vertical">
          <Form.Item name="code" label="类型编码" rules={[{ required: true }]}>
            <Input disabled={!!editingType} />
          </Form.Item>
          <Form.Item name="name" label="类型名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序号" rules={[{ required: true }]} initialValue={0}>
            <Input type="number" placeholder="数字越小越靠前" />
          </Form.Item>
          <Form.Item name="parentId" label="父级类型">
            <Select allowClear placeholder="不选则为顶级类型" style={{ width: '100%' }}>
              {ruleTypes.map(rt => (
                <Select.Option key={rt.id} value={rt.id}>{rt.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 规则迁移 Modal */}
      <Modal title="移动规则" open={moveModalOpen} onOk={handleMoveRule} onCancel={() => setMoveModalOpen(false)}>
        {moveTargetRule && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: '#999' }}>规则：</span>
                <strong>{moveTargetRule.name}</strong>
                <span style={{ marginLeft: 8, fontSize: 12, color: '#999' }}>({moveTargetRule.code})</span>
              </div>
              <div style={{ background: '#fafafa', padding: '8px 12px', borderRadius: 4, border: '1px solid #f0f0f0' }}>
                <span style={{ color: '#999' }}>当前类型：</span>
                <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{typeMap[moveTargetRule.ruleTypeId]?.name || '-'}</span>
                <span style={{ marginLeft: 8, fontSize: 12, color: '#999' }}>
                  ({typeMap[moveTargetRule.ruleTypeId]?.code || '-'})
                </span>
              </div>
            </div>
            <div>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>移动到目标类型：</div>
              <Select
                style={{ width: '100%' }}
                value={moveTypeId}
                onChange={setMoveTypeId}
                placeholder="选择目标规则类型"
                notFoundContent={allTypes.length === 0 ? '正在加载类型数据...' : '无匹配类型'}
              >
                {allTypes.map(t => {
                  const parent = typeMap[t.parentId]
                  return (
                    <Select.Option key={t.id} value={t.id}>
                      {parent ? `└ ${parent.name} / ` : ''}{t.name}
                    </Select.Option>
                  )
                })}
              </Select>
            </div>
          </div>
        )}
      </Modal>

      {/* 执行日志 Drawer */}
      <Drawer
        title={`规则执行日志 - ${currentLogRule?.name || ''}`}
        width={720}
        open={logDrawerOpen}
        onClose={() => setLogDrawerOpen(false)}
      >
        <Table
          rowKey="id"
          loading={logLoading}
          dataSource={logList}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: '执行时间', dataIndex: 'executedAt', width: 160 },
            { title: '状态', render: (_, r) => (
              <Tag color={r.status === 'SUCCESS' ? 'green' : r.status === 'NO_HIT' ? 'orange' : 'red'}>
                {r.status === 'SUCCESS' ? '成功' : r.status === 'NO_HIT' ? '未命中' : '失败'}
              </Tag>
            ), width: 80 },
            { title: '命中数', dataIndex: 'firedCount', width: 70 },
            { title: '耗时(ms)', dataIndex: 'durationMs', width: 90 },
            { title: '操作', width: 90, render: (_, r) => (
              <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openLogDetail(r)}>查看</Button>
            ) }
          ]}
        />
      </Drawer>

      {/* 日志详情 Modal */}
      <Modal
        title="执行详情"
        width={900}
        open={logDetailModalOpen}
        onCancel={() => setLogDetailModalOpen(false)}
        footer={null}
      >
        {currentLog && (
          <div>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="规则编码">{currentLog.ruleCode}</Descriptions.Item>
              <Descriptions.Item label="规则版本">{currentLog.ruleVersion}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={currentLog.status === 'SUCCESS' ? 'green' : currentLog.status === 'NO_HIT' ? 'orange' : 'red'}>
                  {currentLog.status === 'SUCCESS' ? '成功' : currentLog.status === 'NO_HIT' ? '未命中' : '失败'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="耗时">{currentLog.durationMs} ms</Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>输入参数</div>
              <pre style={{ background: '#f6ffed', padding: 8, borderRadius: 4, fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                {JSON.stringify(JSON.parse(currentLog.paramsJson || '{}'), null, 2)}
              </pre>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>输出结果</div>
              <pre style={{ background: '#e6f7ff', padding: 8, borderRadius: 4, fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                {JSON.stringify(JSON.parse(currentLog.outputJson || '{}'), null, 2)}
              </pre>
            </div>
            <div style={{ marginTop: 12, height: 400, border: '1px solid #f0f0f0', borderRadius: 4 }}>
              <FlowCanvasViewer
                nodes={currentLogRule?.canvasData ? JSON.parse(currentLogRule.canvasData).nodes : []}
                edges={currentLogRule?.canvasData ? JSON.parse(currentLogRule.canvasData).edges : []}
                highlightedNodeIds={parseHitNodeIds(currentLog)}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* 历史版本 Modal */}
      <Modal
        title={`历史版本 - ${currentVersionRule?.name || ''}`}
        open={versionModalOpen}
        onCancel={() => setVersionModalOpen(false)}
        footer={null}
        width={700}
      >
        <Table
          rowKey="id"
          loading={versionLoading}
          dataSource={versionList}
          pagination={false}
          columns={[
            { title: '版本号', dataIndex: 'version', width: 80 },
            { title: '保存时间', dataIndex: 'createdAt', width: 160 },
            { title: '备注', dataIndex: 'changeNote', render: v => v || '-' },
            { title: '操作', width: 160, render: (_, v) => (
              <Space>
                <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openVersionPreview(v)}>查看</Button>
                <Button type="link" size="small" icon={<RollbackOutlined />} onClick={() => handleRollback(v)}>回滚</Button>
              </Space>
            ) }
          ]}
        />
      </Modal>

      {/* 版本预览 Modal */}
      <Modal
        title={`版本预览 - 版本 ${currentVersion?.version || ''}`}
        open={versionPreviewModalOpen}
        onCancel={() => setVersionPreviewModalOpen(false)}
        footer={null}
        width={900}
      >
        <div style={{ height: 500, border: '1px solid #f0f0f0', borderRadius: 4 }}>
          <FlowCanvasViewer
            nodes={currentVersion?.canvasData ? JSON.parse(currentVersion.canvasData).nodes : []}
            edges={currentVersion?.canvasData ? JSON.parse(currentVersion.canvasData).edges : []}
          />
        </div>
      </Modal>
    </Layout>
  )
}
