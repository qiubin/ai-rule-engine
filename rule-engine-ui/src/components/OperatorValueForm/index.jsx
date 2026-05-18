import React from 'react'
import { Form, Select, Input } from 'antd'
import { DictSelect, DictAttrSelect, DictItemPicker, DictValuePicker } from '../DictComponents'

const { Option } = Select

export default function OperatorValueForm({ form, operator, elementDictCode, dictionaries, filteredBaseConditions, dataElements, cascaderOptions, selectedBaseDatasetId, setSelectedBaseDatasetId }) {
  if (!operator) return null

  switch (operator) {
    case 'multiRegexMatch':
      return (
        <>
          <Form.Item name="value" label="抗菌药物集合">
            <Input placeholder="手工输入，如: 青霉素,头孢" />
          </Form.Item>
          <DictSelect form={form} name="dictCode" label="或选择字典" dictionaries={dictionaries} />
          <DictAttrSelect name="dictAttr" />
          <Form.Item name="extraValue1" label="病程记录字段名" rules={[{ required: true }]}>
            <Input placeholder="如: courseRecord" />
          </Form.Item>
        </>
      )
    case 'contradictionCheck':
      return (
        <>
          <Form.Item name="value" label="否定词库">
            <Input placeholder="手工输入，如: 否认,无" />
          </Form.Item>
          <DictSelect form={form} name="dictCode" label="或选择否定词字典" dictionaries={dictionaries} />
          <DictAttrSelect name="dictAttr" />
          <Form.Item name="extraValue1" label="关键字库">
            <Input placeholder="手工输入，如: 发热,头痛" />
          </Form.Item>
          <DictSelect form={form} name="allDictCode" label="或选择关键字字典" dictionaries={dictionaries} />
          <DictAttrSelect name="allDictAttr" />
          <Form.Item name="extraValue2" label="对比字段名" rules={[{ required: true }]}>
            <Input placeholder="如: 入院主诉" />
          </Form.Item>
        </>
      )
    case 'existenceConflict':
      return (
        <>
          <Form.Item name="value" label="冲突关键词列表">
            <Input placeholder="手工输入，如: 糖尿病,高血压,发热" />
          </Form.Item>
          <DictSelect form={form} name="dictCode" label="或选择关键词字典" dictionaries={dictionaries} />
          <DictAttrSelect name="dictAttr" />
          <Form.Item name="extraValue1" label="对比字段名" rules={[{ required: true }]}>
            <Input placeholder="如: 入院主诉" />
          </Form.Item>
        </>
      )
    case 'whitelistMatch':
      return (
        <>
          <Form.Item name="value" label="允许的关键词列表">
            <Input placeholder="手工输入，如: 头痛,发热" />
          </Form.Item>
          <Form.Item name="extraValue1" label="全部关键词列表">
            <Input placeholder="手工输入，如: 头痛,发热,咳嗽,流涕；留空则只做正向包含检查" />
          </Form.Item>
        </>
      )
    case 'dictMatch':
      return (
        <>
          <DictSelect form={form} name="dictCode" label="匹配字典" dictionaries={dictionaries} />
          <DictAttrSelect name="dictAttr" />
          <DictItemPicker form={form} dictionaries={dictionaries} />
        </>
      )
    case 'dataCheck':
      return (
        <>
          <Form.Item name="value" label="操作符" rules={[{ required: true }]}>
            <Select placeholder="如: >">
              <Option value="==">等于 ==</Option>
              <Option value="!=">不等于 !=</Option>
              <Option value=">">大于 &gt;</Option>
              <Option value="<">小于 &lt;</Option>
              <Option value=">=">大于等于 &gt;=</Option>
              <Option value="<=">小于等于 &lt;=</Option>
            </Select>
          </Form.Item>
          <Form.Item name="extraValue1" label="阈值" rules={[{ required: true }]}>
            <Input placeholder="如: 50" />
          </Form.Item>
        </>
      )
    case 'timeCheck':
      return (
        <>
          <Form.Item name="baseDatasetId" label="基准时间数据集" rules={[{ required: true, message: '必须选择基准时间数据集' }]}>
            <Select
              options={cascaderOptions}
              placeholder="选择基准时间数据集分类"
              onChange={(value) => {
                const dsId = value?.[value.length - 1]
                setSelectedBaseDatasetId(dsId || null)
                form.setFieldsValue({ baseConditionModelId: undefined, value: undefined })
              }}
            />
          </Form.Item>
          <Form.Item name="baseConditionModelId" label="基准时间数据元/条件" rules={[{ required: true, message: '必须选择基准时间数据元' }]}>
            <Select
              placeholder={selectedBaseDatasetId ? '选择该数据集下的数据元' : '请先选择基准时间数据集'}
              disabled={!selectedBaseDatasetId}
              onChange={(modelId) => {
                const model = filteredBaseConditions.find(m => m.id === modelId)
                if (model) {
                  form.setFieldsValue({ value: model.code })
                }
              }}
            >
              {filteredBaseConditions.map(cm => {
                const de = dataElements.find(d => d.id === cm.dataElementId)
                return (
                  <Option key={cm.id} value={cm.id}>
                    {de?.name || cm.name}
                  </Option>
                )
              })}
            </Select>
          </Form.Item>
          <Form.Item name="value" label="基准时间字段">
            <Input disabled placeholder="自动来自基准时间数据元编码" />
          </Form.Item>
          <Form.Item name="extraValue1" label="最小相差小时数">
            <Input placeholder="留空则不限制" />
          </Form.Item>
          <Form.Item name="extraValue2" label="最大相差小时数">
            <Input placeholder="留空则不限制" />
          </Form.Item>
          <Form.Item name="extraValue3" label="时间单位" initialValue="HOUR">
            <Select placeholder="选择时间单位">
              <Option value="HOUR">小时</Option>
              <Option value="MINUTE">分钟</Option>
              <Option value="DAY">天</Option>
            </Select>
          </Form.Item>
        </>
      )
    case 'lengthCheck':
      return (
        <>
          <Form.Item name="value" label="比较符" rules={[{ required: true }]}>
            <Select placeholder="如: >">
              <Option value=">">大于 &gt;</Option>
              <Option value="<">小于 &lt;</Option>
              <Option value=">=">大于等于 &gt;=</Option>
              <Option value="<=">小于等于 &lt;=</Option>
              <Option value="==">等于 ==</Option>
              <Option value="!=">不等于 !=</Option>
            </Select>
          </Form.Item>
          <Form.Item name="extraValue1" label="长度阈值" rules={[{ required: true }]}>
            <Input placeholder="如: 10" type="number" />
          </Form.Item>
        </>
      )
    case 'isBlank':
    case 'isNotBlank':
      return null
    case 'similarity':
      return (
        <>
          <Form.Item name="value" label="对比字段名" rules={[{ required: true }]}>
            <Input placeholder="如: otherCourseRecord" />
          </Form.Item>
          <Form.Item name="extraValue1" label="相似度阈值" rules={[{ required: true }]}>
            <Input placeholder="如: 0.995" />
          </Form.Item>
        </>
      )
    case 'arrayLength':
      return (
        <>
          <Form.Item name="value" label="比较符" rules={[{ required: true }]}>
            <Select placeholder="如: >">
              <Option value=">">大于 &gt;</Option>
              <Option value="<">小于 &lt;</Option>
              <Option value=">=">大于等于 &gt;=</Option>
              <Option value="<=">小于等于 &lt;=</Option>
              <Option value="==">等于 ==</Option>
              <Option value="!=">不等于 !=</Option>
            </Select>
          </Form.Item>
          <Form.Item name="extraValue1" label="元素个数阈值" rules={[{ required: true }]}>
            <Input placeholder="如: 5" type="number" />
          </Form.Item>
        </>
      )
    case 'arrayIntersect':
      return (
        <>
          <Form.Item name="value" label="对比集合字段名" rules={[{ required: true }]}>
            <Input placeholder="如: otherSymptoms" />
          </Form.Item>
          <Form.Item name="extraValue1" label="比较符" rules={[{ required: true }]}>
            <Select placeholder="如: ==">
              <Option value=">">大于 &gt;</Option>
              <Option value="<">小于 &lt;</Option>
              <Option value=">=">大于等于 &gt;=</Option>
              <Option value="<=">小于等于 &lt;=</Option>
              <Option value="==">等于 ==</Option>
              <Option value="!=">不等于 !=</Option>
            </Select>
          </Form.Item>
          <Form.Item name="extraValue2" label="交集个数阈值" rules={[{ required: true }]}>
            <Input placeholder="如: 0" type="number" />
          </Form.Item>
        </>
      )
    case 'regexMatch':
      return (
        <>
          <Form.Item name="value" label="正则表达式">
            <Input placeholder="如: ^[a-z]+$" />
          </Form.Item>
          <DictSelect form={form} name="dictCode" label="或选择正则字典" dictionaries={dictionaries} />
          <DictAttrSelect name="dictAttr" />
        </>
      )
    case 'medicalNer':
      return (
        <>
          <Form.Item name="value" label="实体类型" rules={[{ required: true }]}>
            <Select placeholder="选择要提取的医学实体类型">
              <Option value="symptoms">症状</Option>
              <Option value="signs">体征</Option>
              <Option value="drugs">药品</Option>
              <Option value="exams">检查</Option>
              <Option value="surgeries">手术</Option>
              <Option value="diseases">疾病</Option>
            </Select>
          </Form.Item>
          <Form.Item name="extraValue1" label="特定实体（可选）">
            <Input placeholder="如: 发热；留空则检测该类任意实体" />
          </Form.Item>
        </>
      )
    case 'negationCheck':
      return (
        <Form.Item name="value" label="实体名称" rules={[{ required: true }]}>
          <Input placeholder="如: 发热" />
        </Form.Item>
      )
    case 'tokenSimilarity':
      return (
        <>
          <Form.Item name="value" label="对比字段名" rules={[{ required: true }]}>
            <Input placeholder="如: otherCourseRecord" />
          </Form.Item>
          <Form.Item name="extraValue1" label="相似度阈值" rules={[{ required: true }]}>
            <Input placeholder="如: 0.95" />
          </Form.Item>
        </>
      )
    case 'allNegated':
      return (
        <Form.Item name="value" label="实体类型" rules={[{ required: true }]}>
          <Select placeholder="选择要检测的医学实体类型">
            <Option value="symptoms">症状</Option>
            <Option value="signs">体征</Option>
            <Option value="drugs">药品</Option>
            <Option value="exams">检查</Option>
            <Option value="surgeries">手术</Option>
            <Option value="diseases">疾病</Option>
          </Select>
        </Form.Item>
      )
    case 'fieldCompare':
      return (
        <>
          <Form.Item name="value" label="字段A" rules={[{ required: true }]}>
            <Input placeholder="如: admissionTime" />
          </Form.Item>
          <Form.Item name="extraValue1" label="字段B" rules={[{ required: true }]}>
            <Input placeholder="如: historyCollectionTime" />
          </Form.Item>
          <Form.Item name="extraValue2" label="比较类型" rules={[{ required: true }]}>
            <Select placeholder="选择比较类型">
              <Option value="TIME_DIFF_HOUR">时间差（小时）</Option>
              <Option value="TIME_DIFF_MINUTE">时间差（分钟）</Option>
              <Option value="TIME_DIFF_DAY">时间差（天）</Option>
              <Option value="NUMERIC_DIFF">数值差</Option>
              <Option value="STRING_EQ">字符串相等</Option>
            </Select>
          </Form.Item>
          <Form.Item name="extraValue3" label="比较符" rules={[{ required: true }]}>
            <Select placeholder="选择比较符">
              <Option value="==">等于 ==</Option>
              <Option value="!=">不等于 !=</Option>
              <Option value=">">大于 &gt;</Option>
              <Option value="<">小于 &lt;</Option>
              <Option value=">=">大于等于 &gt;=</Option>
              <Option value="<=">小于等于 &lt;=</Option>
            </Select>
          </Form.Item>
          <Form.Item name="extraValue4" label="阈值" rules={[{ required: true }]}>
            <Input placeholder="如: 2" />
          </Form.Item>
        </>
      )
    case 'between':
      return (
        <>
          <Form.Item name="value" label="最小值" rules={[{ required: true }]}>
            <Input placeholder="如: 0" type="number" />
          </Form.Item>
          <Form.Item name="extraValue1" label="最大值" rules={[{ required: true }]}>
            <Input placeholder="如: 250" type="number" />
          </Form.Item>
        </>
      )
    default:
      if (elementDictCode) {
        return (
          <>
            <Form.Item name="dictAttr" label="匹配属性" style={{ marginTop: -8 }}>
              <Select placeholder="默认名称" allowClear>
                <Option value="itemName">名称</Option>
                <Option value="itemCode">编码</Option>
                <Option value="itemValue">值</Option>
              </Select>
            </Form.Item>
            <DictValuePicker form={form} dictCode={elementDictCode} dictionaries={dictionaries} />
          </>
        )
      }
      return (
        <Form.Item name="value" label="条件值" rules={[{ required: true }]}>
          <Input placeholder="如: 65" />
        </Form.Item>
      )
  }
}
