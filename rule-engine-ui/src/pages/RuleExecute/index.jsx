import React, { useState, useEffect } from 'react'
import { Layout, Table, Button, Card, Form, Input, Select, Empty, Tag, Divider, Alert, Checkbox } from 'antd'
import { PlayCircleOutlined, SwapOutlined } from '@ant-design/icons'
import axios from 'axios'

const { Sider, Content } = Layout
const RT_API = '/api/v1/rule-types'
const RULE_API = '/api/v1/rules'

export default function RuleExecute() {
  const [mode, setMode] = useState('single') // 'single' | 'batch'
  const [ruleTypes, setRuleTypes] = useState([])
  const [rules, setRules] = useState([])
  const [selectedTypeId, setSelectedTypeId] = useState(null)
  const [selectedRule, setSelectedRule] = useState(null)
  const [selectedRuleIds, setSelectedRuleIds] = useState([])
  const [loadingRules, setLoadingRules] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState(null)
  const [batchResult, setBatchResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [paramForm] = Form.useForm()
  const [paramFields, setParamFields] = useState([])

  const fetchRuleTypes = async () => {
    try {
      setErrorMsg('')
      const res = await axios.get(RT_API)
      const list = res.data || []
      setRuleTypes(list)
      if (list.length > 0 && !selectedTypeId) {
        setSelectedTypeId(list[0].id)
      }
    } catch (e) {
      setErrorMsg('加载规则类型失败: ' + (e.message || '未知错误'))
    }
  }

  const fetchRules = async (ruleTypeId) => {
    if (!ruleTypeId) return
    setLoadingRules(true)
    try {
      const res = await axios.get(`${RULE_API}?ruleTypeId=${ruleTypeId}`)
      const list = res.data || []
      setRules(list)
      // 批量模式默认勾选所有已配置画布的规则
      if (mode === 'batch') {
        setSelectedRuleIds(list.filter(r => r.canvasData).map(r => r.id))
      }
    } catch (e) {
      setErrorMsg('加载规则失败')
    }
    setLoadingRules(false)
  }

  useEffect(() => { fetchRuleTypes() }, [])
  useEffect(() => {
    fetchRules(selectedTypeId)
    setSelectedRule(null)
    setResult(null)
    setBatchResult(null)
    setParamFields([])
  }, [selectedTypeId, mode])

  // 解析画布中的条件字段
  const parseCanvasParams = (rule) => {
    if (!rule || !rule.canvasData) return []
    try {
      const canvas = JSON.parse(rule.canvasData)
      const nodes = canvas.nodes || []
      const fieldMap = new Map() // field -> { field, dataType, label, operators: Set, isTimeField }
      const upsert = (field, dataType, label, operator, isTimeField = false) => {
        if (!field) return
        if (!fieldMap.has(field)) {
          fieldMap.set(field, { field, dataType, label, operators: new Set(), isTimeField: false })
        }
        if (operator) fieldMap.get(field).operators.add(operator)
        if (isTimeField) fieldMap.get(field).isTimeField = true
      }
      nodes.forEach(node => {
        if (node.type === 'condition' && node.data?.conditionConfig) {
          const cfg = node.data.conditionConfig
          upsert(cfg.field, cfg.dataType, node.data.label || cfg.field, cfg.operator)
          if (cfg.operator === 'fieldCompare') {
            upsert(cfg.value, cfg.dataType, cfg.value + ' (字段A)', cfg.operator)
            upsert(cfg.extraValue1, cfg.dataType, cfg.extraValue1 + ' (字段B)', cfg.operator)
          }
          // timeCheck 需要额外录入基准时间字段
          if (cfg.operator === 'timeCheck' && cfg.value) {
            upsert(cfg.value, cfg.dataType, '基准时间: ' + cfg.value, cfg.operator, true)
            // 目标时间字段也标记为时间字段
            if (fieldMap.has(cfg.field)) {
              fieldMap.get(cfg.field).isTimeField = true
            }
          }
        }
      })
      const BLANK_OPS = new Set(['isBlank', 'isNotBlank'])
      return Array.from(fieldMap.values()).map(f => ({
        field: f.field,
        dataType: f.dataType,
        label: f.label,
        optional: f.operators.size > 0 && Array.from(f.operators).every(op => BLANK_OPS.has(op)),
        isTimeField: f.isTimeField,
      }))
    } catch (e) {
      return []
    }
  }

  // 合并所有选中规则的条件字段（去重）；任一规则将该字段当必填，则合并后也必填
  const computeBatchParamFields = (ruleIds) => {
    const merged = new Map()
    ruleIds.forEach(id => {
      const rule = rules.find(r => r.id === id)
      if (rule) {
        parseCanvasParams(rule).forEach(f => {
          if (!merged.has(f.field)) {
            merged.set(f.field, { ...f })
          } else if (!f.optional) {
            // 一旦有规则要求必填，整体就必填
            merged.get(f.field).optional = false
          }
        })
      }
    })
    return Array.from(merged.values())
  }

  useEffect(() => {
    if (mode === 'batch') {
      const fields = computeBatchParamFields(selectedRuleIds)
      setParamFields(fields)
      const initialValues = {}
      fields.forEach(f => { initialValues[f.field] = '' })
      paramForm.setFieldsValue(initialValues)
    }
  }, [selectedRuleIds, rules, mode])

  const handleSelectRule = (rule) => {
    setSelectedRule(rule)
    setResult(null)
    setErrorMsg('')
    const fields = parseCanvasParams(rule)
    setParamFields(fields)
    const initialValues = {}
    fields.forEach(f => { initialValues[f.field] = '' })
    paramForm.setFieldsValue(initialValues)
  }

  const handleExecute = async () => {
    if (!selectedRule) {
      setErrorMsg('请先选择一条规则')
      return
    }
    const values = await paramForm.validateFields().catch(() => null)
    if (!values) return
    setExecuting(true)
    setErrorMsg('')
    setResult(null)
    try {
      const res = await axios.post(`${RULE_API}/${selectedRule.id}/test-execute`, values)
      setResult(res.data)
    } catch (e) {
      setErrorMsg('执行失败: ' + (e.response?.data?.message || e.message))
    }
    setExecuting(false)
  }

  const handleBatchExecute = async () => {
    if (selectedRuleIds.length === 0) {
      setErrorMsg('请至少勾选一条规则')
      return
    }
    const values = await paramForm.validateFields().catch(() => null)
    if (!values) return
    setExecuting(true)
    setErrorMsg('')
    setBatchResult(null)
    try {
      const res = await axios.post(`${RULE_API}/batch-test-execute`, {
        ruleIds: selectedRuleIds,
        parameters: values
      })
      setBatchResult(res.data)
    } catch (e) {
      setErrorMsg('批量执行失败: ' + (e.response?.data?.message || e.message))
    }
    setExecuting(false)
  }

  const renderInputByType = (field) => {
    const { dataType, isTimeField } = field
    if (isTimeField) {
      return <Input placeholder="格式：2024-01-15 08:30:00" />
    }
    if (dataType === 'NUMERIC' || dataType === 'INTEGER') {
      return <Input type="number" placeholder={`请输入 ${field.label}`} />
    }
    if (dataType === 'BOOLEAN') {
      return (
        <Select placeholder="请选择">
          <Select.Option value="true">是</Select.Option>
          <Select.Option value="false">否</Select.Option>
        </Select>
      )
    }
    return <Input placeholder={`请输入 ${field.label}`} />
  }

  const ruleColumnsSingle = [
    { title: '编码', dataIndex: 'code', width: 120 },
    { title: '名称', dataIndex: 'name' },
    { title: '版本', dataIndex: 'version', width: 80 },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (v) => (
        <Tag color={v === 'PUBLISHED' ? 'green' : v === 'DRAFT' ? 'orange' : 'default'}>
          {v === 'PUBLISHED' ? '已发布' : v === 'DRAFT' ? '草稿' : v}
        </Tag>
      )
    },
    {
      title: '画布', width: 80,
      render: (_, r) => (
        <Tag color={r.canvasData ? 'blue' : 'default'}>{r.canvasData ? '已配置' : '未配置'}</Tag>
      )
    }
  ]

  const batchRuleColumns = [
    {
      title: <Checkbox
        checked={rules.length > 0 && selectedRuleIds.length === rules.filter(r => r.canvasData).length}
        indeterminate={selectedRuleIds.length > 0 && selectedRuleIds.length < rules.filter(r => r.canvasData).length}
        onChange={(e) => {
          setSelectedRuleIds(e.target.checked ? rules.filter(r => r.canvasData).map(r => r.id) : [])
        }}
      />,
      width: 50,
      render: (_, record) => (
        <Checkbox
          checked={selectedRuleIds.includes(record.id)}
          disabled={!record.canvasData}
          onChange={(e) => {
            setSelectedRuleIds(prev =>
              e.target.checked
                ? [...prev, record.id]
                : prev.filter(id => id !== record.id)
            )
          }}
        />
      )
    },
    { title: '编码', dataIndex: 'code', width: 120 },
    { title: '名称', dataIndex: 'name' },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (v) => (
        <Tag color={v === 'PUBLISHED' ? 'green' : v === 'DRAFT' ? 'orange' : 'default'}>
          {v === 'PUBLISHED' ? '已发布' : v === 'DRAFT' ? '草稿' : v}
        </Tag>
      )
    },
    {
      title: '画布', width: 80,
      render: (_, r) => (
        <Tag color={r.canvasData ? 'blue' : 'default'}>{r.canvasData ? '已配置' : '未配置'}</Tag>
      )
    }
  ]

  const batchDetailColumns = [
    { title: '规则编码', dataIndex: 'ruleCode', width: 120 },
    { title: '规则名称', dataIndex: 'ruleName' },
    {
      title: '是否匹配', dataIndex: 'matched', width: 100,
      render: (v) => (
        <Tag color={v ? '#52c41a' : '#ff4d4f'}>{v ? '是' : '否'}</Tag>
      )
    },
    { title: '触发数', dataIndex: 'firedRules', width: 80 },
    {
      title: '结果值',
      render: (_, r) => {
        if (!r.results || !Array.isArray(r.results) || r.results.length === 0) return '-'
        return r.results.map((res, i) => (
          <Tag key={i} color="blue">{res.resultValue || res.nodeLabel}</Tag>
        ))
      }
    },
    {
      title: '异常',
      dataIndex: 'error',
      render: (v) => v ? <span style={{ color: '#ff4d4f' }}>{v}</span> : '-'
    }
  ]

  return (
    <Layout style={{ height: '100%', background: '#fff' }}>
      <Sider width={240} style={{ background: '#fff', borderRight: '1px solid #f0f0f0', overflow: 'auto' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
          <h3 style={{ margin: 0 }}>规则类型</h3>
        </div>
        <div style={{ padding: 8 }}>
          {ruleTypes.map(rt => (
            <Card
              key={rt.id}
              size="small"
              style={{
                marginBottom: 8,
                cursor: 'pointer',
                border: selectedTypeId === rt.id ? '1px solid #1890ff' : '1px solid #f0f0f0',
                background: selectedTypeId === rt.id ? '#e6f7ff' : '#fff'
              }}
              onClick={() => setSelectedTypeId(rt.id)}
              bodyStyle={{ padding: '8px 12px' }}
            >
              <div style={{ fontWeight: 'bold', fontSize: 14 }}>{rt.name}</div>
              <div style={{ fontSize: 12, color: '#999' }}>{rt.code}</div>
            </Card>
          ))}
        </div>
      </Sider>

      <Content style={{ padding: 24, background: '#fff', overflow: 'auto' }}>
        {errorMsg && (
          <Alert message={errorMsg} type="error" showIcon style={{ marginBottom: 16 }} closable onClose={() => setErrorMsg('')} />
        )}

        {/* 模式切换 */}
        <div style={{ marginBottom: 16 }}>
          <Button
            type={mode === 'single' ? 'primary' : 'default'}
            onClick={() => setMode('single')}
            style={{ marginRight: 8 }}
          >单条测试</Button>
          <Button
            type={mode === 'batch' ? 'primary' : 'default'}
            onClick={() => setMode('batch')}
            icon={<SwapOutlined />}
          >批量测试</Button>
        </div>

        {mode === 'single' ? (
          <>
            {/* 单条模式 - 规则列表 */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ marginBottom: 12 }}>规则列表（点击选择）</h3>
              <Table
                rowKey="id"
                columns={ruleColumnsSingle}
                dataSource={rules}
                loading={loadingRules}
                size="small"
                bordered
                pagination={false}
                rowClassName={(record) => selectedRule?.id === record.id ? 'selected-row' : ''}
                onRow={(record) => ({
                  onClick: () => handleSelectRule(record),
                  style: { cursor: 'pointer' }
                })}
              />
              <style>{`
                .selected-row { background-color: #e6f7ff !important; }
                .selected-row:hover { background-color: #bae7ff !important; }
              `}</style>
            </div>

            {selectedRule && (
              <>
                <Divider />
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ marginBottom: 12 }}>
                    测试参数 — {selectedRule.name}
                    <Tag color="blue" style={{ marginLeft: 8 }}>{selectedRule.code}</Tag>
                  </h3>
                  {paramFields.length === 0 ? (
                    <Alert message="该规则画布中未配置条件节点，无需输入参数" type="info" showIcon />
                  ) : (
                    <Form form={paramForm} layout="inline">
                      {paramFields.map((f) => (
                        <Form.Item
                          key={f.field}
                          name={f.field}
                          label={
                            <span>
                              {f.label}
                              <Tag size="small" style={{ marginLeft: 4 }}>{f.dataType}</Tag>
                              {f.optional && <Tag color="blue" size="small">可空</Tag>}
                              {f.isTimeField && <Tag color="orange" size="small">时间</Tag>}
                            </span>
                          }
                          rules={f.optional ? [] : [{ required: true, message: `请输入 ${f.label}` }]}
                          style={{ marginRight: 24, marginBottom: 16, minWidth: 200 }}
                        >
                          {renderInputByType(f)}
                        </Form.Item>
                      ))}
                    </Form>
                  )}
                  <div style={{ marginTop: 16 }}>
                    <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleExecute} loading={executing} disabled={!selectedRule.canvasData}>
                      执行测试
                    </Button>
                    {!selectedRule.canvasData && <span style={{ color: '#999', marginLeft: 12 }}>该规则尚未配置画布</span>}
                  </div>
                </div>

                {result && (
                  <>
                    <Divider />
                    <div>
                      <h3 style={{ marginBottom: 12 }}>执行结果</h3>
                      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                        <Card size="small" title="触发规则数" style={{ width: 140, textAlign: 'center' }}>
                          <div style={{ fontSize: 28, fontWeight: 'bold', color: result.firedRules > 0 ? '#52c41a' : '#999' }}>{result.firedRules}</div>
                        </Card>
                        <Card size="small" title="是否匹配" style={{ width: 140, textAlign: 'center' }}>
                          <div style={{ fontSize: 28, fontWeight: 'bold', color: result.matched ? '#52c41a' : '#ff4d4f' }}>{result.matched ? '是' : '否'}</div>
                        </Card>
                      </div>
                      {result.results && Array.isArray(result.results) && result.results.length > 0 && (
                        <div>
                          <h4>匹配详情</h4>
                          {result.results.map((r, idx) => (
                            <Card key={idx} size="small" style={{ marginBottom: 8 }}>
                              <div><b>节点:</b> {r.nodeLabel}</div>
                              <div><b>结果类型:</b> <Tag color="blue">{r.resultType}</Tag></div>
                              <div><b>结果值:</b> {r.resultValue}</div>
                            </Card>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: 12 }}>
                        <details>
                          <summary style={{ cursor: 'pointer', color: '#1890ff' }}>查看原始响应</summary>
                          <pre style={{ background: '#f6ffed', padding: 12, borderRadius: 4, marginTop: 8, fontSize: 12, overflow: 'auto' }}>
                            {JSON.stringify(result, null, 2)}
                          </pre>
                        </details>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
            {!selectedRule && (
              <Empty description="请在上方规则列表中选择一条规则进行测试" style={{ marginTop: 40 }} />
            )}
          </>
        ) : (
          <>
            {/* 批量模式 */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ marginBottom: 12 }}>
                规则列表
                <span style={{ color: '#999', fontSize: 13, fontWeight: 'normal', marginLeft: 8 }}>
                  已勾选 {selectedRuleIds.length} 条规则
                </span>
              </h3>
              <Table
                rowKey="id"
                columns={batchRuleColumns}
                dataSource={rules}
                loading={loadingRules}
                size="small"
                bordered
                pagination={false}
              />
            </div>

            <Divider />

            {/* 批量参数输入 */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ marginBottom: 12 }}>测试参数</h3>
              {paramFields.length === 0 ? (
                <Alert message="请勾选至少一条已配置画布的规则，参数将自动合并" type="info" showIcon />
              ) : (
                <Form form={paramForm} layout="inline">
                  {paramFields.map((f) => (
                    <Form.Item
                      key={f.field}
                      name={f.field}
                      label={
                        <span>
                          {f.label}
                          <Tag size="small" style={{ marginLeft: 4 }}>{f.dataType}</Tag>
                          {f.optional && <Tag color="blue" size="small">可空</Tag>}
                        </span>
                      }
                      rules={f.optional ? [] : [{ required: true, message: `请输入 ${f.label}` }]}
                      style={{ marginRight: 24, marginBottom: 16, minWidth: 200 }}
                    >
                      {renderInputByType(f)}
                    </Form.Item>
                  ))}
                </Form>
              )}
              <div style={{ marginTop: 16 }}>
                <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleBatchExecute} loading={executing} disabled={selectedRuleIds.length === 0}>
                  批量执行测试
                </Button>
                {selectedRuleIds.length === 0 && <span style={{ color: '#999', marginLeft: 12 }}>请勾选要测试的规则</span>}
              </div>
            </div>

            {/* 批量结果 */}
            {batchResult && (
              <>
                <Divider />
                <div>
                  <h3 style={{ marginBottom: 12 }}>批量执行结果</h3>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                    <Card size="small" title="总规则数" style={{ width: 120, textAlign: 'center' }}>
                      <div style={{ fontSize: 28, fontWeight: 'bold' }}>{batchResult.total}</div>
                    </Card>
                    <Card size="small" title="已执行" style={{ width: 120, textAlign: 'center' }}>
                      <div style={{ fontSize: 28, fontWeight: 'bold', color: '#1890ff' }}>{batchResult.executed}</div>
                    </Card>
                    <Card size="small" title="匹配通过" style={{ width: 120, textAlign: 'center' }}>
                      <div style={{ fontSize: 28, fontWeight: 'bold', color: batchResult.matched > 0 ? '#52c41a' : '#999' }}>{batchResult.matched}</div>
                    </Card>
                    <Card size="small" title="未通过" style={{ width: 120, textAlign: 'center' }}>
                      <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ff4d4f' }}>{batchResult.executed - batchResult.matched}</div>
                    </Card>
                  </div>

                  <h4>执行明细</h4>
                  <Table
                    rowKey="ruleId"
                    columns={batchDetailColumns}
                    dataSource={batchResult.details || []}
                    size="small"
                    bordered
                    pagination={false}
                  />

                  <div style={{ marginTop: 12 }}>
                    <details>
                      <summary style={{ cursor: 'pointer', color: '#1890ff' }}>查看原始响应</summary>
                      <pre style={{ background: '#f6ffed', padding: 12, borderRadius: 4, marginTop: 8, fontSize: 12, overflow: 'auto' }}>
                        {JSON.stringify(batchResult, null, 2)}
                      </pre>
                    </details>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </Content>
    </Layout>
  )
}
