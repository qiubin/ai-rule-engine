import React, { useState, useEffect } from 'react'
import { Card, Form, Input, Select, Button, Table, Tag, Divider, Steps, Modal, Space, InputNumber, message, Tabs, Collapse, Row, Col, Empty } from 'antd'
import { PlayCircleOutlined, PlusOutlined, DeleteOutlined, ExperimentOutlined, CheckCircleOutlined, CloseCircleOutlined, MinusCircleOutlined } from '@ant-design/icons'
import axios from 'axios'

const PW_API = '/api/v1/pathways'
const RULE_API = '/api/v1/rules'

export default function DecisionTest() {
  const [pathways, setPathways] = useState([])
  const [selectedPathway, setSelectedPathway] = useState(null)
  const [executing, setExecuting] = useState(false)
  const [response, setResponse] = useState(null)
  const [activeTab, setActiveTab] = useState('input')
  const [contextForm] = Form.useForm()

  useEffect(() => {
    fetchPathways()
  }, [])

  const fetchPathways = async () => {
    try {
      const res = await axios.get(`${PW_API}/published`)
      setPathways(res.data || [])
    } catch (e) {
      message.error('加载决策路径失败: ' + (e.message || ''))
    }
  }

  const buildContext = () => {
    const values = contextForm.getFieldsValue()
    const context = {
      patient: {
        age: values.age ? Number(values.age) : null,
        gender: values.gender || null,
        weightKg: values.weightKg ? Number(values.weightKg) : null,
      },
      scores: [],
      medications: [],
      labs: [],
      vitals: {},
      extensions: {},
    }

    // scores
    if (values.scores) {
      context.scores = values.scores
        .filter(s => s.name && s.value !== undefined && s.value !== null)
        .map(s => ({ name: s.name, value: Number(s.value), description: s.desc || '' }))
    }

    // medications
    if (values.medications) {
      context.medications = values.medications
        .filter(m => m.drugCode)
        .map(m => ({
          drugCode: m.drugCode,
          drugName: m.drugName,
          dose: m.dose,
          frequency: m.freq,
        }))
    }

    // labs
    if (values.labs) {
      context.labs = values.labs
        .filter(l => l.code && l.value)
        .map(l => ({
          code: l.code,
          name: l.name,
          value: l.value,
          unit: l.unit || '',
        }))
    }

    // vitals
    if (values.systolicBp || values.diastolicBp || values.heartRate) {
      context.vitals.systolicBp = values.systolicBp ? Number(values.systolicBp) : null
      context.vitals.diastolicBp = values.diastolicBp ? Number(values.diastolicBp) : null
      context.vitals.heartRate = values.heartRate ? Number(values.heartRate) : null
    }

    // extensions
    if (values.extKey && values.extValue) {
      const extObj = {}
      for (let i = 0; i < values.extKey.length; i++) {
        if (values.extKey[i]) extObj[values.extKey[i]] = values.extValue[i]
      }
      context.extensions = extObj
    }

    return context
  }

  const handleExecute = async () => {
    if (!selectedPathway) {
      message.warning('请先选择一个决策路径')
      return
    }
    setExecuting(true)
    setResponse(null)
    try {
      const context = buildContext()
      const res = await axios.post(`${PW_API}/${selectedPathway}/execute`, context)
      setResponse(res.data)
      setActiveTab('result')
    } catch (e) {
      message.error('执行失败: ' + (e.response?.data?.message || e.message || ''))
    }
    setExecuting(false)
  }

  const stageStatusIcon = (status) => {
    switch (status) {
      case 'SUCCESS': return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'SKIPPED': return <MinusCircleOutlined style={{ color: '#faad14' }} />
      case 'ERROR': return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      case 'NO_MATCH': return <MinusCircleOutlined style={{ color: '#d9d9d9' }} />
      default: return null
    }
  }

  const priorityTag = (p) => {
    const colors = { MANDATORY: 'red', RECOMMENDED: 'blue', OPTIONAL: 'default' }
    return <Tag color={colors[p] || 'default'}>{p}</Tag>
  }

  const evidenceTag = (item) => {
    if (!item.evidenceLevel && !item.evidenceGrade) return null
    return <Tag color="purple">{item.evidenceLevel || ''}{item.evidenceGrade ? `-${item.evidenceGrade}` : ''}</Tag>
  }

  const traceColumns = [
    { title: '顺序', dataIndex: 'sortOrder', width: 60 },
    {
      title: '', dataIndex: 'status', width: 40,
      render: (v) => stageStatusIcon(v),
    },
    { title: '阶段名称', dataIndex: 'stageName', width: 160 },
    { title: '状态', dataIndex: 'status', width: 100,
      render: (v) => {
        const colors = { SUCCESS: 'green', SKIPPED: 'gold', ERROR: 'red', NO_MATCH: 'default' }
        return <Tag color={colors[v]}>{v}</Tag>
      }
    },
    { title: '匹配数', dataIndex: 'firedCount', width: 70 },
    { title: '详情', dataIndex: 'result', render: (v) => {
      if (!v) return '-'
      if (typeof v === 'string') return v
      if (Array.isArray(v)) return v.map((d, i) => (
        <div key={i} style={{ marginBottom: 4 }}>• {d.action || d.resultValue}</div>
      ))
      return '-'
    }},
  ]

  const decisionColumns = [
    { title: '类型', dataIndex: 'type', width: 120,
      render: (v) => <Tag>{v || 'GENERAL'}</Tag>
    },
    { title: '建议', dataIndex: 'action', width: 200 },
    { title: '说明', dataIndex: 'detail', width: 200 },
    { title: '证据', key: 'evidence', width: 100, render: (_, r) => evidenceTag(r) },
    { title: '指南', dataIndex: 'guideline', width: 180 },
    { title: '优先级', dataIndex: 'priority', width: 100, render: (v) => priorityTag(v) },
    { title: '药品', dataIndex: 'drugName', width: 120 },
    { title: '起始剂量', dataIndex: 'startDose', width: 80 },
    { title: '目标剂量', dataIndex: 'targetDose', width: 80 },
  ]

  const { Panel } = Collapse

  return (
    <div style={{ padding: 24 }}>
      <Card title={
        <Space>
          <ExperimentOutlined />
          <span>决策路径测试台</span>
        </Space>
      } style={{ marginBottom: 16 }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab="1. 输入就诊上下文" key="input">
            <Row gutter={16}>
              <Col span={12}>
                <Form form={contextForm} layout="vertical" initialValues={{ scores: [], medications: [], labs: [] }}>
                  <Card title="患者信息" size="small" style={{ marginBottom: 12 }}>
                    <Row gutter={8}>
                      <Col span={8}>
                        <Form.Item name="age" label="年龄">
                          <InputNumber style={{ width: '100%' }} min={0} max={150} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name="gender" label="性别">
                          <Select allowClear placeholder="选择">
                            <Select.Option value="M">男</Select.Option>
                            <Select.Option value="F">女</Select.Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name="weightKg" label="体重(kg)">
                          <InputNumber style={{ width: '100%' }} min={0} />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>

                  <Card title="评分（外部已计算）" size="small" style={{ marginBottom: 12 }}
                    extra={
                      <Button type="link" size="small" icon={<PlusOutlined />}
                        onClick={() => {
                          const scores = contextForm.getFieldValue('scores') || []
                          contextForm.setFieldsValue({ scores: [...scores, { name: '', value: undefined }] })
                        }}>添加评分</Button>
                    }>
                    <Form.List name="scores">
                      {(fields, { add, remove }) => (
                        <div>
                          {fields.map((field, idx) => (
                            <Row key={field.key} gutter={8} style={{ marginBottom: 8 }}>
                              <Col span={8}>
                                <Form.Item {...field} name={[field.name, 'name']} noStyle>
                                  <Select placeholder="评分名称" allowClear
                                    onSelect={(val) => {
                                      const descMap = { 'CHA2DS2-VA': '房颤卒中风险', 'HAS-BLED': '出血风险', 'NIHSS': '卒中严重程度' }
                                      const scores = contextForm.getFieldValue('scores') || []
                                      if (scores[idx]) scores[idx].desc = descMap[val] || ''
                                      contextForm.setFieldsValue({ scores })
                                    }}
                                  >
                                    <Select.Option value="CHA2DS2-VA">CHA2DS2-VA</Select.Option>
                                    <Select.Option value="HAS-BLED">HAS-BLED</Select.Option>
                                    <Select.Option value="NIHSS">NIHSS</Select.Option>
                                    <Select.Option value="NYHA">NYHA</Select.Option>
                                  </Select>
                                </Form.Item>
                              </Col>
                              <Col span={6}>
                                <Form.Item {...field} name={[field.name, 'value']} noStyle>
                                  <InputNumber placeholder="分值" style={{ width: '100%' }} />
                                </Form.Item>
                              </Col>
                              <Col span={8}>
                                <Form.Item {...field} name={[field.name, 'desc']} noStyle>
                                  <Input placeholder="说明" />
                                </Form.Item>
                              </Col>
                              <Col span={2}>
                                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                              </Col>
                            </Row>
                          ))}
                        </div>
                      )}
                    </Form.List>
                  </Card>

                  <Card title="生命体征" size="small" style={{ marginBottom: 12 }}>
                    <Row gutter={8}>
                      <Col span={8}>
                        <Form.Item name="systolicBp" label="收缩压(mmHg)">
                          <InputNumber style={{ width: '100%' }} min={0} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name="diastolicBp" label="舒张压(mmHg)">
                          <InputNumber style={{ width: '100%' }} min={0} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name="heartRate" label="心率(bpm)">
                          <InputNumber style={{ width: '100%' }} min={0} />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                </Form>
              </Col>

              <Col span={12}>
                <Form form={contextForm} layout="vertical">
                  <Card title="当前用药" size="small" style={{ marginBottom: 12 }}
                    extra={
                      <Button type="link" size="small" icon={<PlusOutlined />}
                        onClick={() => {
                          const meds = contextForm.getFieldValue('medications') || []
                          contextForm.setFieldsValue({ medications: [...meds, { drugCode: '', drugName: '', dose: '', freq: '' }] })
                        }}>添加用药</Button>
                    }>
                    <Form.List name="medications">
                      {(fields, { remove }) => (
                        <div>
                          {fields.map((field) => (
                            <Row key={field.key} gutter={8} style={{ marginBottom: 8 }}>
                              <Col span={6}>
                                <Form.Item {...field} name={[field.name, 'drugCode']} noStyle>
                                  <Input placeholder="药品编码" />
                                </Form.Item>
                              </Col>
                              <Col span={6}>
                                <Form.Item {...field} name={[field.name, 'drugName']} noStyle>
                                  <Input placeholder="药品名称" />
                                </Form.Item>
                              </Col>
                              <Col span={4}>
                                <Form.Item {...field} name={[field.name, 'dose']} noStyle>
                                  <Input placeholder="剂量" />
                                </Form.Item>
                              </Col>
                              <Col span={4}>
                                <Form.Item {...field} name={[field.name, 'freq']} noStyle>
                                  <Input placeholder="频次" />
                                </Form.Item>
                              </Col>
                              <Col span={2}>
                                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                              </Col>
                            </Row>
                          ))}
                        </div>
                      )}
                    </Form.List>
                  </Card>

                  <Card title="检验结果" size="small" style={{ marginBottom: 12 }}
                    extra={
                      <Button type="link" size="small" icon={<PlusOutlined />}
                        onClick={() => {
                          const labs = contextForm.getFieldValue('labs') || []
                          contextForm.setFieldsValue({ labs: [...labs, { code: '', name: '', value: '', unit: '' }] })
                        }}>添加检验</Button>
                    }>
                    <Form.List name="labs">
                      {(fields, { remove }) => (
                        <div>
                          {fields.map((field) => (
                            <Row key={field.key} gutter={8} style={{ marginBottom: 8 }}>
                              <Col span={6}>
                                <Form.Item {...field} name={[field.name, 'code']} noStyle>
                                  <Input placeholder="检验编码" />
                                </Form.Item>
                              </Col>
                              <Col span={6}>
                                <Form.Item {...field} name={[field.name, 'name']} noStyle>
                                  <Input placeholder="名称" />
                                </Form.Item>
                              </Col>
                              <Col span={4}>
                                <Form.Item {...field} name={[field.name, 'value']} noStyle>
                                  <Input placeholder="值" />
                                </Form.Item>
                              </Col>
                              <Col span={4}>
                                <Form.Item {...field} name={[field.name, 'unit']} noStyle>
                                  <Input placeholder="单位" />
                                </Form.Item>
                              </Col>
                              <Col span={2}>
                                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                              </Col>
                            </Row>
                          ))}
                        </div>
                      )}
                    </Form.List>
                  </Card>

                  <Card title="扩展字段" size="small" style={{ marginBottom: 12 }}>
                    <Form.Item name="extKey" label="字段名">
                      <Input placeholder="如: diagnosisCodes" />
                    </Form.Item>
                    <Form.Item name="extValue" label="值">
                      <Input placeholder="如: I48" />
                    </Form.Item>
                  </Card>
                </Form>
              </Col>
            </Row>

            <Divider />
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 280 }}>
                <Select
                  placeholder="选择决策路径"
                  style={{ width: '100%' }}
                  value={selectedPathway}
                  onChange={setSelectedPathway}
                  notFoundContent="没有已发布的路径"
                >
                  {pathways.map(p => (
                    <Select.Option key={p.id} value={p.id}>
                      {p.name} (v{p.version})
                    </Select.Option>
                  ))}
                </Select>
              </div>
              <Button type="primary" icon={<PlayCircleOutlined />} size="large"
                loading={executing} onClick={handleExecute}>
                执行决策路径
              </Button>
            </div>
          </Tabs.TabPane>

          <Tabs.TabPane tab="2. 决策结果" key="result">
            {!response ? (
              <Empty description="尚未执行决策路径" />
            ) : (
              <>
                <Card size="small" style={{ marginBottom: 12 }}>
                  <Space>
                    <Tag color="blue">{response.pathwayCode}</Tag>
                    <strong>{response.pathwayName}</strong>
                    <Tag color={response.status === 'COMPLETED' ? 'green' : 'orange'}>{response.status}</Tag>
                    <span>共 {response.decisions?.length || 0} 条决策建议</span>
                  </Space>
                </Card>

                <Collapse defaultActiveKey={['trace', 'decisions']}>
                  <Panel header={`执行轨迹 (${response.executionTrace?.length || 0} 个阶段)`} key="trace">
                    <Table
                      dataSource={response.executionTrace || []}
                      columns={traceColumns}
                      rowKey={(_, i) => i}
                      pagination={false}
                      size="small"
                    />
                  </Panel>

                  <Panel header={`决策建议 (${response.decisions?.length || 0} 条)`} key="decisions">
                    <Table
                      dataSource={response.decisions || []}
                      columns={decisionColumns}
                      rowKey={(_, i) => i}
                      pagination={false}
                      size="small"
                    />
                  </Panel>

                  <Panel header="原始上下文快照" key="snapshot">
                    <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 12, maxHeight: 400, overflow: 'auto' }}>
                      {JSON.stringify(response.context, null, 2)}
                    </pre>
                  </Panel>

                  <Panel header="原始响应" key="raw">
                    <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 12, maxHeight: 400, overflow: 'auto' }}>
                      {JSON.stringify(response, null, 2)}
                    </pre>
                  </Panel>
                </Collapse>
              </>
            )}
          </Tabs.TabPane>
        </Tabs>
      </Card>
    </div>
  )
}
