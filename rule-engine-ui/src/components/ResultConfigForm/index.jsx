import React, { useState, useEffect } from 'react'
import { Form, Select, Input, Tag } from 'antd'

const { Option } = Select

export default function ResultConfigForm({
  value,
  onChange,
  resultConfigs,
  conditionFields,
  dictionaries,
}) {
  const [form] = Form.useForm()
  const [selectedRcDetail, setSelectedRcDetail] = useState(null)

  // 当外部 value 变化时回填表单
  useEffect(() => {
    if (value) {
      form.setFieldsValue({
        resultConfigId: value.resultConfigId,
        content: value.content,
      })
      const rc = resultConfigs.find(r => r.id === value.resultConfigId)
      setSelectedRcDetail(rc || null)
    }
  }, [value, form, resultConfigs])

  const parseMetadata = (str) => {
    if (!str) return null
    try {
      const meta = JSON.parse(str)
      if (!meta.hasExtension) return null
      return meta
    } catch (e) {
      return null
    }
  }

  const onResultConfigChange = (rcId) => {
    const rc = resultConfigs.find(r => r.id === rcId)
    setSelectedRcDetail(rc || null)
    const newValues = { resultConfigId: rcId }
    if (rc?.content) {
      newValues.content = rc.content
      form.setFieldsValue({ content: rc.content })
    }
    // 同步到父组件
    const allValues = form.getFieldsValue(true)
    if (onChange) {
      onChange({
        ...allValues,
        resultType: rc?.resultType,
        resultValue: rc?.resultName,
        priority: rc?.priority,
        metadata: rc?.metadata,
      })
    }
  }

  const handleValuesChange = (changedValues, allValues) => {
    if (onChange) {
      const rc = resultConfigs.find(r => r.id === allValues.resultConfigId)
      onChange({
        ...allValues,
        resultType: rc?.resultType,
        resultValue: rc?.resultName,
        priority: rc?.priority,
        metadata: rc?.metadata,
      })
    }
  }

  const renderRcDetailCard = () => {
    if (!selectedRcDetail) return null
    const meta = parseMetadata(selectedRcDetail.metadata)
    const dict = meta ? dictionaries.find(d => d.code === meta.dictCode) : null
    return (
      <div style={{
        background: '#f6ffed',
        border: '1px solid #b7eb8f',
        borderRadius: 4,
        padding: 12,
        marginBottom: 16,
        marginTop: -8
      }}>
        <div style={{ fontWeight: 'bold', color: '#52c41a', marginBottom: 8, fontSize: 13 }}>
          结果配置详情
        </div>
        <div style={{ fontSize: 12, marginBottom: 4 }}>
          <Tag color="blue">{selectedRcDetail.resultType}</Tag>
          <span style={{ marginLeft: 8 }}>{selectedRcDetail.resultName}</span>
          <span style={{ color: '#999', marginLeft: 8 }}>优先级:{selectedRcDetail.priority}</span>
        </div>
        {meta && meta.items && meta.items.length > 0 && (
          <div style={{ marginTop: 8, borderTop: '1px dashed #b7eb8f', paddingTop: 8 }}>
            <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>
              扩展属性 — {dict?.name || meta.dictCode} ({meta.items.length}项):
            </div>
            <div>
              {meta.items.map((item, idx) => (
                <Tag key={idx} color="green" style={{ marginBottom: 4, fontSize: 11 }}>
                  {item.code} - {item.name}
                </Tag>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <Form form={form} layout="vertical" onValuesChange={handleValuesChange}>
      <Form.Item name="resultConfigId" label="结果配置" rules={[{ required: true, message: '必须选择结果配置' }]}>
        <Select
          showSearch
          placeholder="搜索或选择结果配置"
          optionFilterProp="label"
          onChange={onResultConfigChange}
        >
          {resultConfigs.map(rc => {
            const meta = parseMetadata(rc.metadata)
            return (
              <Option key={rc.id} value={rc.id} label={`${rc.resultType} - ${rc.resultName}`}>
                <Tag color="blue" style={{ marginRight: 8 }}>{rc.resultType}</Tag>
                {rc.resultName}
                <span style={{ color: '#999', marginLeft: 8 }}>(优先级:{rc.priority})</span>
                {meta && meta.items && meta.items.length > 0 && (
                  <Tag color="green" style={{ marginLeft: 8, fontSize: 11 }}>
                    扩展{meta.items.length}项
                  </Tag>
                )}
              </Option>
            )
          })}
        </Select>
      </Form.Item>

      {renderRcDetailCard()}

      <Form.Item name="content" label="结果内容">
        <Input.TextArea placeholder="输入需要返回的结果信息。可用 ${fieldName} 引用条件字段的实际值" rows={3} />
      </Form.Item>
      {conditionFields && conditionFields.length > 0 && (
        <div style={{ marginBottom: 8, fontSize: 13 }}>
          <div style={{ color: '#888', marginBottom: 4 }}>可用变量（点击插入）：</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {conditionFields.map(f => (
              <Tag
                key={f.field}
                color="processing"
                style={{ cursor: 'pointer', fontSize: 12 }}
                onClick={() => {
                  const ta = form.getFieldValue('content') || ''
                  form.setFieldsValue({ content: ta + '${' + f.field + '}' })
                  // 同步到父组件
                  const allValues = form.getFieldsValue(true)
                  const rc = resultConfigs.find(r => r.id === allValues.resultConfigId)
                  if (onChange) {
                    onChange({
                      ...allValues,
                      resultType: rc?.resultType,
                      resultValue: rc?.resultName,
                      priority: rc?.priority,
                      metadata: rc?.metadata,
                    })
                  }
                }}
              >{`${f.field}`}</Tag>
            ))}
          </div>
        </div>
      )}
      <div style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
        提示：请前往系统菜单的"结果管理"中预先配置结果属性。在结果内容中使用 <Tag style={{ fontSize: 11, cursor: 'pointer' }} color="default">{'${fieldName}'}</Tag> 可在执行时动态插入字段值。
      </div>
    </Form>
  )
}
