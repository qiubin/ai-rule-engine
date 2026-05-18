import React, { useState, useEffect } from 'react'
import { Form, Select, Input, Cascader, Tag, Button } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import OperatorValueForm from '../OperatorValueForm'

const { Option, OptGroup } = Select

export default function ConditionRow({
  index,
  value,
  onChange,
  onDelete,
  cascaderOptions,
  dataElements,
  allConditions,
  dictionaries,
  canDelete,
}) {
  const [form] = Form.useForm()
  const [selectedDatasetId, setSelectedDatasetId] = useState(null)
  const [selectedBaseDatasetId, setSelectedBaseDatasetId] = useState(null)
  const [selectedOperator, setSelectedOperator] = useState(null)
  const [elementDictCode, setElementDictCode] = useState(null)

  // 当外部 value 变化时，回填表单
  useEffect(() => {
    if (value) {
      form.setFieldsValue({
        ...value,
        // datasetId 如果是数字，需要转成数组给 Cascader
        datasetId: value.datasetId ? [value.datasetId] : undefined,
        baseDatasetId: value.baseDatasetId ? [value.baseDatasetId] : undefined,
      })
      setSelectedOperator(value.operator || null)
      if (value.operator) {
        // 尝试恢复数据集ID以加载条件列表
        const dsId = value.datasetId
        if (dsId) setSelectedDatasetId(dsId)
        const baseDsId = value.baseDatasetId
        if (baseDsId) setSelectedBaseDatasetId(baseDsId)
      }
    }
  }, [value, form])

  const filteredConditions = React.useMemo(() => {
    if (!selectedDatasetId) return []
    const deIds = dataElements.filter(de => de.datasetId === selectedDatasetId).map(de => de.id)
    return allConditions.filter(cm => deIds.includes(cm.dataElementId))
  }, [selectedDatasetId, dataElements, allConditions])

  const filteredBaseConditions = React.useMemo(() => {
    if (!selectedBaseDatasetId) return []
    const deIds = dataElements.filter(de => de.datasetId === selectedBaseDatasetId).map(de => de.id)
    return allConditions.filter(cm => deIds.includes(cm.dataElementId))
  }, [selectedBaseDatasetId, dataElements, allConditions])

  const handleValuesChange = (changedValues, allValues) => {
    onChange(allValues)
  }

  const handleDatasetChange = (value) => {
    const dsId = value?.[value.length - 1]
    setSelectedDatasetId(dsId || null)
    setElementDictCode(null)
    form.setFieldsValue({
      conditionModelId: undefined,
      field: undefined,
      dataType: undefined,
    })
  }

  const handleConditionModelChange = (modelId) => {
    const model = allConditions.find(m => m.id === modelId)
    if (model) {
      const de = dataElements.find(d => d.id === model.dataElementId)
      const dictCode = de?.dictCode || null
      setElementDictCode(dictCode)
      form.setFieldsValue({
        field: model.code,
        dataType: model.dataType,
        dictCode: dictCode || undefined,
      })
      // 触发 onChange 同步最新值
      const allValues = form.getFieldsValue(true)
      onChange(allValues)
    }
  }

  return (
    <div style={{
      border: '1px solid #d9d9d9',
      borderRadius: 8,
      padding: 16,
      marginBottom: 8,
      background: '#fafafa',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>条件 {index + 1}</span>
        {canDelete && (
          <Button type="text" danger icon={<DeleteOutlined />} onClick={onDelete} size="small">
            删除
          </Button>
        )}
      </div>

      <Form form={form} layout="vertical" onValuesChange={handleValuesChange}>
        <Form.Item
          name="datasetId"
          label="数据集分类"
          rules={[{ required: true, message: '必须选择数据集分类' }]}
        >
          <Cascader
            options={cascaderOptions}
            placeholder="选择数据集分类"
            onChange={handleDatasetChange}
          />
        </Form.Item>

        <Form.Item
          name="conditionModelId"
          label="数据元/条件"
          rules={[{ required: true, message: '必须选择数据元' }]}
        >
          <Select
            placeholder={selectedDatasetId ? '选择该数据集下的数据元' : '请先选择数据集分类'}
            disabled={!selectedDatasetId}
            onChange={handleConditionModelChange}
          >
            {filteredConditions.map(cm => {
              const de = dataElements.find(d => d.id === cm.dataElementId)
              return (
                <Option key={cm.id} value={cm.id}>
                  {de?.name || cm.name}
                  <Tag color="blue" style={{ marginLeft: 8 }}>{cm.dataType}</Tag>
                </Option>
              )
            })}
          </Select>
        </Form.Item>

        <Form.Item name="field" label="条件字段">
          <Input disabled placeholder="自动来自条件关联的数据元编码" />
        </Form.Item>

        <Form.Item name="dataType" label="数据类型">
          <Input disabled placeholder="自动来自条件" />
        </Form.Item>

        <Form.Item name="operator" label="计算符" rules={[{ required: true }]}>
          <Select placeholder="选择计算符" onChange={(val) => {
            setSelectedOperator(val)
            const allValues = form.getFieldsValue(true)
            onChange(allValues)
          }}>
            <OptGroup label="通用计算符">
              <Option value="==">等于 ==</Option>
              <Option value="!=">不等于 !=</Option>
              <Option value=">">大于 &gt;</Option>
              <Option value="<">小于 &lt;</Option>
              <Option value=">=">大于等于 &gt;=</Option>
              <Option value="<=">小于等于 &lt;=</Option>
              <Option value="between">在范围内 between</Option>
              <Option value="contains">包含 contains</Option>
              <Option value="arrayContains">集合包含 arrayContains</Option>
              <Option value="regex_match">原生正则 regex_match</Option>
              <Option value="regex_not_match">原生正则不匹配 regex_not_match</Option>
              <Option value="IN_SET">在集合中 IN_SET</Option>
            </OptGroup>
            <OptGroup label="脚本计算符">
              <Option value="regexMatch">单正则匹配 regexMatch</Option>
              <Option value="multiRegexMatch">多条件正则 multiRegexMatch</Option>
              <Option value="contradictionCheck">矛盾判断 contradictionCheck</Option>
              <Option value="existenceConflict">存在性冲突 existenceConflict</Option>
              <Option value="whitelistMatch">白名单匹配 whitelistMatch</Option>
              <Option value="dictMatch">字典匹配 dictMatch</Option>
              <Option value="dataCheck">数据判断 dataCheck</Option>
              <Option value="timeCheck">时间判断 timeCheck</Option>
              <Option value="fieldCompare">字段比对 fieldCompare</Option>
            </OptGroup>
            <OptGroup label="质控计算符">
              <Option value="lengthCheck">长度校验 lengthCheck</Option>
              <Option value="isBlank">空值校验 isBlank</Option>
              <Option value="isNotBlank">非空校验 isNotBlank</Option>
              <Option value="similarity">相似度比对 similarity</Option>
              <Option value="arrayLength">集合长度 arrayLength</Option>
              <Option value="arrayIntersect">集合交集 arrayIntersect</Option>
            </OptGroup>
            <OptGroup label="NLP计算符">
              <Option value="medicalNer">医学实体提取 medicalNer</Option>
              <Option value="negationCheck">否定检测 negationCheck</Option>
              <Option value="tokenSimilarity">分词相似度 tokenSimilarity</Option>
              <Option value="allNegated">全否定检测 allNegated</Option>
            </OptGroup>
          </Select>
        </Form.Item>

        {selectedOperator && (
          <OperatorValueForm
            form={form}
            operator={selectedOperator}
            elementDictCode={elementDictCode}
            dictionaries={dictionaries}
            filteredBaseConditions={filteredBaseConditions}
            dataElements={dataElements}
            cascaderOptions={cascaderOptions}
            selectedBaseDatasetId={selectedBaseDatasetId}
            setSelectedBaseDatasetId={setSelectedBaseDatasetId}
          />
        )}
      </Form>
    </div>
  )
}
