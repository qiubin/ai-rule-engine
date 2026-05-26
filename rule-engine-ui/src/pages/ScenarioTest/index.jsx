import React, { useState, useEffect } from 'react'
import { Card, Form, Input, Select, Button, Tag, Table, Alert, Checkbox, Divider, Radio } from 'antd'
import { PlayCircleOutlined } from '@ant-design/icons'
import axios from 'axios'

const RT_API = '/api/v1/rule-types'

const PRESET_PARAMS = [
  { field: 'patientId', label: '患者ID', placeholder: 'P20240521001', dataType: 'STRING' },
  { field: 'admissionId', label: '就诊ID', placeholder: 'V20240521001', dataType: 'STRING' },
  { field: 'age', label: '年龄', placeholder: '65', dataType: 'INTEGER' },
  { field: 'gender', label: '性别', placeholder: '男 / 女', dataType: 'STRING' },
  { field: 'diagName', label: '诊断名称', placeholder: '高血压', dataType: 'STRING' },
  { field: 'opOperName', label: '手术名称', placeholder: '阑尾切除术', dataType: 'STRING' },
  { field: 'bleeding_history', label: '出血史', placeholder: 'true / false', dataType: 'BOOLEAN' },
  { field: 'liver_dysfunction', label: '肝功能异常', placeholder: 'true / false', dataType: 'BOOLEAN' },
  { field: 'kidney_dysfunction', label: '肾功能异常', placeholder: 'true / false', dataType: 'BOOLEAN' },
  { field: 'pregnancy', label: '妊娠', placeholder: 'true / false', dataType: 'BOOLEAN' },
]

export default function ScenarioTest() {
  const [ruleTypes, setRuleTypes] = useState([])
  const [loadingTypes, setLoadingTypes] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [paramForm] = Form.useForm()
  const [optionsForm] = Form.useForm()

  useEffect(() => {
    fetchRuleTypes()
    // 默认展开常用参数
    paramForm.setFieldsValue({
      patientId: 'P20240521001',
      age: 65,
      gender: '男',
      diagName: '高血压',
    })
    optionsForm.setFieldsValue({
      stopOnFirstMatch: false,
      onlyPublished: true,
      failFast: false,
    })
  }, [])

  const fetchRuleTypes = async () => {
    setLoadingTypes(true)
    try {
      setErrorMsg('')
      const res = await axios.get(`${RT_API}?flat=true`)
      setRuleTypes(res.data || [])
    } catch (e) {
      setErrorMsg('加载规则类型失败: ' + (e.response?.data?.message || e.message))
    }
    setLoadingTypes(false)
  }

  const handleExecute = async () => {
    const typeCode = paramForm.getFieldValue('typeCode')
    if (!typeCode) {
      setErrorMsg('请选择规则类型')
      return
    }

    const paramValues = await paramForm.validateFields().catch(() => null)
    if (!paramValues) return

    const optionValues = optionsForm.getFieldsValue()

    // 过滤掉空值参数
    const parameters = {}
    PRESET_PARAMS.forEach(p => {
      const v = paramValues[p.field]
      if (v !== undefined && v !== null && v !== '') {
        if (p.dataType === 'INTEGER') {
          const n = parseInt(v, 10)
          if (!isNaN(n)) parameters[p.field] = n
        } else if (p.dataType === 'BOOLEAN') {
          parameters[p.field] = v === true || v === 'true'
        } else {
          parameters[p.field] = v
        }
      }
    })

    setExecuting(true)
    setErrorMsg('')
    setResult(null)

    try {
      const res = await axios.post(`${RT_API}/execute?typeCode=${typeCode}`, {
        parameters,
        options: optionValues,
      })
      setResult(res.data)
    } catch (e) {
      const msg = e.response?.data?.message || e.message
      setErrorMsg('执行失败: ' + msg)
    }
    setExecuting(false)
  }

  const renderParamInput = (param) => {
    if (param.dataType === 'BOOLEAN') {
      return (
        <Select placeholder="请选择">
          <Select.Option value="true">是</Select.Option>
          <Select.Option value="false">否</Select.Option>
        </Select>
      )
    }
    if (param.dataType === 'INTEGER') {
      return <Input type="number" placeholder={param.placeholder} />
    }
    return <Input placeholder={param.placeholder} />
  }

  const resultColumns = [
    { title: '规则编码', dataIndex: 'ruleCode', width: 120 },
    { title: '规则名称', dataIndex: 'ruleName' },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (v) => {
        const colorMap = { SUCCESS: 'green', NO_HIT: 'default', ERROR: 'red' }
        const labelMap = { SUCCESS: '成功', NO_HIT: '未命中', ERROR: '失败' }
        return <Tag color={colorMap[v] || 'default'}>{labelMap[v] || v}</Tag>
      }
    },
    {
      title: '是否命中', dataIndex: 'matched', width: 90,
      render: (v, record) => (
        record.status === 'ERROR'
          ? <Tag>-</Tag>
          : <Tag color={v ? '#52c41a' : '#ff4d4f'}>{v ? '是' : '否'}</Tag>
      )
    },
    { title: '触发数', dataIndex: 'firedRules', width: 80 },
    { title: '耗时(ms)', dataIndex: 'durationMs', width: 90 },
    {
      title: '结果值',
      render: (_, r) => {
        if (!r.details || !r.details.results || r.details.results.length === 0) return '-'
        return r.details.results.map((res, i) => (
          <Tag key={i} color="blue">{res.resultValue || res.content || '-'}</Tag>
        ))
      }
    },
    {
      title: '异常信息', dataIndex: 'errorMessage',
      render: (v) => v ? <span style={{ color: '#ff4d4f' }}>{v}</span> : '-'
    }
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {errorMsg && (
        <Alert message={errorMsg} type="error" showIcon style={{ marginBottom: 16 }} closable onClose={() => setErrorMsg('')} />
      )}

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* 左侧：参数与选项 */}
        <div style={{ flex: '0 0 420px' }}>
          <Card title="场景参数" size="small" style={{ marginBottom: 16 }}>
            <Form form={paramForm} layout="vertical">
              <Form.Item
                name="typeCode"
                label="规则类型（场景）"
                rules={[{ required: true, message: '请选择规则类型' }]}
              >
                <Select
                  placeholder="请选择规则类型"
                  loading={loadingTypes}
                  showSearch
                  optionFilterProp="children"
                >
                  {ruleTypes.map(rt => (
                    <Select.Option key={rt.code} value={rt.code}>
                      {rt.name} ({rt.code})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Divider style={{ margin: '12px 0' }} />

              {PRESET_PARAMS.map(param => (
                <Form.Item
                  key={param.field}
                  name={param.field}
                  label={
                    <span>
                      {param.label}
                      <Tag size="small" style={{ marginLeft: 4 }}>{param.dataType}</Tag>
                    </span>
                  }
                  style={{ marginBottom: 12 }}
                >
                  {renderParamInput(param)}
                </Form.Item>
              ))}
            </Form>
          </Card>

          <Card title="执行选项" size="small" style={{ marginBottom: 16 }}>
            <Form form={optionsForm} layout="vertical">
              <Form.Item name="stopOnFirstMatch" valuePropName="checked">
                <Checkbox>命中一条后停止（短路策略）</Checkbox>
              </Form.Item>
              <Form.Item name="onlyPublished" valuePropName="checked">
                <Checkbox>只执行已发布规则</Checkbox>
              </Form.Item>
              <Form.Item name="failFast" valuePropName="checked">
                <Checkbox>单条失败即中断（快速失败）</Checkbox>
              </Form.Item>
            </Form>
          </Card>

          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleExecute}
            loading={executing}
            block
            size="large"
          >
            执行场景测试
          </Button>
        </div>

        {/* 右侧：执行结果 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {result && (
            <>
              <Card title="执行汇总" size="small" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <Card size="small" title="规则总数" style={{ width: 130, textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 'bold' }}>{result.summary?.total}</div>
                  </Card>
                  <Card size="small" title="已执行" style={{ width: 130, textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 'bold', color: '#1890ff' }}>{result.summary?.executed}</div>
                  </Card>
                  <Card size="small" title="命中" style={{ width: 130, textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 'bold', color: result.summary?.matched > 0 ? '#52c41a' : '#999' }}>
                      {result.summary?.matched}
                    </div>
                  </Card>
                  <Card size="small" title="未命中" style={{ width: 130, textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 'bold' }}>{result.summary?.unmatched}</div>
                  </Card>
                  <Card size="small" title="失败" style={{ width: 130, textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 'bold', color: result.summary?.failed > 0 ? '#ff4d4f' : '#999' }}>
                      {result.summary?.failed}
                    </div>
                  </Card>
                </div>
              </Card>

              <Card title="执行明细" size="small">
                <Table
                  rowKey="ruleId"
                  columns={resultColumns}
                  dataSource={result.results || []}
                  size="small"
                  bordered
                  pagination={false}
                  scroll={{ x: 800 }}
                />

                <div style={{ marginTop: 12 }}>
                  <details>
                    <summary style={{ cursor: 'pointer', color: '#1890ff' }}>查看原始响应</summary>
                    <pre style={{ background: '#f6ffed', padding: 12, borderRadius: 4, marginTop: 8, fontSize: 12, overflow: 'auto' }}>
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </details>
                </div>
              </Card>
            </>
          )}

          {!result && (
            <div style={{ textAlign: 'center', paddingTop: 120, color: '#999' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🧪</div>
              <div>选择规则类型并设置参数后，点击「执行场景测试」</div>
              <div style={{ marginTop: 8, fontSize: 13 }}>系统会自动按规则类型批量执行其下所有规则</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
