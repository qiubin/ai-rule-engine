import React, { useEffect, useState, useMemo } from 'react'
import { Drawer, Form, Input, Select, Button, Radio, Tag, Cascader, Spin, Modal, Checkbox, message } from 'antd'
import { SaveOutlined, SearchOutlined } from '@ant-design/icons'
import axios from 'axios'

const { Option, OptGroup } = Select

export default function ConfigPanel({ open, onClose, node, onUpdate, conditionFields }) {
  const [form] = Form.useForm()
  const [categories, setCategories] = useState([])
  const [conditions, setConditions] = useState([])
  const [dictionaries, setDictionaries] = useState([])
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [selectedOperator, setSelectedOperator] = useState(null)
  const [resultConfigs, setResultConfigs] = useState([])
  const [selectedRcDetail, setSelectedRcDetail] = useState(null)

  // 数据集分类相关
  const [dataSets, setDataSets] = useState([])
  const [dataElements, setDataElements] = useState([])
  const [allConditions, setAllConditions] = useState([])
  const [selectedDatasetId, setSelectedDatasetId] = useState(null)
  // 来自数据元的字典编码（用于条件值自动加载字典项）
  const [elementDictCode, setElementDictCode] = useState(null)
  // timeCheck 基准时间字段相关的数据集
  const [selectedBaseDatasetId, setSelectedBaseDatasetId] = useState(null)
  // fieldCompare 字段B的数据集
  const [selectedFieldBDataSetId, setSelectedFieldBDataSetId] = useState(null)
  // fieldCompare 的比较类型（用于动态切换比较符/阈值），必须在组件顶层 watch 避免条件 hook
  const fieldCompareType = Form.useWatch('extraValue2', form)
  // 顶层 watch operator 与 field，用于 fieldCompare 时强制保持字段A === 条件字段
  const watchedOperator = Form.useWatch('operator', form)
  const watchedField = Form.useWatch('field', form)
  useEffect(() => {
    if (watchedOperator === 'fieldCompare') {
      const cur = form.getFieldValue('value')
      if (cur !== watchedField) {
        form.setFieldsValue({ value: watchedField })
      }
    }
  }, [watchedOperator, watchedField, form])

  useEffect(() => {
    if (node && open) {
      const cc = node.data?.conditionConfig
      // 字典匹配的 extraValue1 是逗号字符串，需转数组供 mode="multiple" 使用
      const initialExtra1 = cc?.operator === 'dictMatch' && typeof cc?.extraValue1 === 'string'
        ? cc.extraValue1.split(',').filter(Boolean)
        : cc?.extraValue1
      form.setFieldsValue({
        label: node.data?.label || '',
        ...cc,
        extraValue1: initialExtra1,
        ...node.data?.resultConfig,
      })
      setSelectedOperator(node.data?.conditionConfig?.operator || null)
      if (node.type === 'condition') {
        fetchCategories()
        fetchDictionaries()
        fetchDataSets()
        fetchDataElements()
        fetchAllConditions()
        // 尝试反推旧节点的数据集ID
        const savedCmId = node.data?.conditionConfig?.conditionModelId
        if (savedCmId) {
          // 等数据加载完成后再反推，见下方的 useEffect
          setSelectedCategoryId(null)
          setSelectedDatasetId(null)
        }
        // 尝试反推旧节点的基准时间数据集ID
        const savedBaseCmId = node.data?.conditionConfig?.baseConditionModelId
        if (savedBaseCmId) {
          setSelectedBaseDatasetId(null)
        }
      } else if (node.type === 'result') {
        fetchAllResultConfigs()
        fetchDictionaries()
        const savedRcId = node.data?.resultConfig?.resultConfigId
        if (savedRcId) {
          const rc = resultConfigs.find(r => r.id === savedRcId)
          setSelectedRcDetail(rc || null)
        } else {
          setSelectedRcDetail(null)
        }
      }
    }
  }, [node, open, form])

  // resultConfigs 加载完成后，回填已保存的选中项详情
  useEffect(() => {
    if (node?.type === 'result' && resultConfigs.length > 0) {
      const savedRcId = node.data?.resultConfig?.resultConfigId
      if (savedRcId) {
        const rc = resultConfigs.find(r => r.id === savedRcId)
        setSelectedRcDetail(rc || null)
      }
    }
  }, [resultConfigs, node])

  // 条件节点：数据加载完成后，反推旧节点的数据集ID
  useEffect(() => {
    if (node?.type === 'condition' && allConditions.length > 0 && dataElements.length > 0 && dataSets.length > 0) {
      const savedCmId = node.data?.conditionConfig?.conditionModelId
      if (savedCmId) {
        const cm = allConditions.find(c => c.id === savedCmId)
        if (cm?.dataElementId) {
          const de = dataElements.find(d => d.id === cm.dataElementId)
          if (de?.datasetId) {
            const ds = dataSets.find(s => s.id === de.datasetId)
            if (ds) {
              setSelectedDatasetId(de.datasetId)
              setElementDictCode(de.dictCode || null)
              form.setFieldsValue({
                datasetId: [ds.catL1Code, ds.catL2Code, ds.catL3Code, ds.id]
              })
            }
          }
        }
      }
      // 反推基准时间数据集ID
      const savedBaseCmId = node.data?.conditionConfig?.baseConditionModelId
      if (savedBaseCmId) {
        const cm = allConditions.find(c => c.id === savedBaseCmId)
        if (cm?.dataElementId) {
          const de = dataElements.find(d => d.id === cm.dataElementId)
          if (de?.datasetId) {
            const ds = dataSets.find(s => s.id === de.datasetId)
            if (ds) {
              setSelectedBaseDatasetId(de.datasetId)
              form.setFieldsValue({
                baseDatasetId: [ds.catL1Code, ds.catL2Code, ds.catL3Code, ds.id]
              })
            }
          }
        }
      }
      // 反推 fieldCompare 字段B 的数据集ID（根据 extraValue1 中存储的数据元code）
      const cc = node.data?.conditionConfig
      if (cc?.operator === 'fieldCompare' && cc?.extraValue1) {
        const fieldBCode = cc.extraValue1
        const cm = allConditions.find(c => c.code === fieldBCode)
        if (cm?.dataElementId) {
          const de = dataElements.find(d => d.id === cm.dataElementId)
          if (de?.datasetId) {
            const ds = dataSets.find(s => s.id === de.datasetId)
            if (ds) {
              setSelectedFieldBDataSetId(de.datasetId)
              form.setFieldsValue({
                fieldBDatasetId: [ds.catL1Code, ds.catL2Code, ds.catL3Code, ds.id]
              })
            }
          }
        }
      }
    }
  }, [allConditions, dataElements, dataSets, node, form])

  const fetchCategories = async () => {
    try {
      const res = await axios.get('/api/v1/condition-model-categories')
      setCategories(res.data)
    } catch (e) {}
  }

  const fetchConditionsByCategory = async (categoryId) => {
    try {
      const res = await axios.get(`/api/v1/condition-models/by-category/${categoryId}`)
      const nodeUsage = node?.type === 'condition' ? 'CONDITION' : 'RESULT'
      const filtered = res.data.filter(m =>
        m.nodeUsage === nodeUsage || m.nodeUsage === 'BOTH'
      )
      setConditions(filtered)
    } catch (e) {}
  }

  const fetchDictionaries = async () => {
    try {
      const res = await axios.get('/api/v1/dictionaries')
      setDictionaries(res.data)
    } catch (e) {}
  }

  const fetchAllResultConfigs = async () => {
    try {
      const res = await axios.get('/api/v1/result-configs')
      setResultConfigs(res.data)
    } catch (e) {}
  }

  const fetchDataSets = async () => {
    try {
      const res = await axios.get('/api/v1/data-sets')
      setDataSets(res.data)
    } catch (e) {}
  }

  const fetchDataElements = async () => {
    try {
      const res = await axios.get('/api/v1/data-elements')
      setDataElements(res.data)
    } catch (e) {}
  }

  const fetchAllConditions = async () => {
    try {
      const res = await axios.get('/api/v1/condition-models')
      setAllConditions(res.data.filter(m => m.nodeUsage === 'CONDITION' || m.nodeUsage === 'BOTH'))
    } catch (e) {}
  }

  const onCategoryChange = (categoryId) => {
    setSelectedCategoryId(categoryId)
    form.setFieldsValue({ conditionModelId: undefined, field: undefined, dataType: undefined })
    fetchConditionsByCategory(categoryId)
  }

  const onConditionChange = async (modelId) => {
    const model = conditions.find(m => m.id === modelId)
    if (node?.type === 'condition' && model && model.dataElementId) {
      const isFieldCompare = form.getFieldValue('operator') === 'fieldCompare'
      form.setFieldsValue({
        field: model.code,
        dataType: model.dataType,
        value: isFieldCompare ? model.code : form.getFieldValue('value'),
      })
    }
    if (node?.type === 'result') {
      try {
        const res = await axios.get(`/api/v1/result-configs/by-condition/${modelId}`)
        setResultConfigs(res.data)
        form.setFieldsValue({ resultConfigId: undefined })
      } catch (e) {}
    }
  }

  const buildCascaderOptions = (dataSets) => {
    const tree = []
    for (const ds of dataSets) {
      const l1Key = ds.catL1Code || '未分类'
      const l1Name = ds.catL1Name || '未分类'
      const l2Key = ds.catL2Code || '未分类'
      const l2Name = ds.catL2Name || '未分类'
      const l3Key = ds.catL3Code || '未分类'
      const l3Name = ds.catL3Name || '未分类'

      let l1Node = tree.find(n => n.value === l1Key)
      if (!l1Node) {
        l1Node = { value: l1Key, label: l1Name, children: [] }
        tree.push(l1Node)
      }

      let l2Node = l1Node.children.find(n => n.value === l2Key)
      if (!l2Node) {
        l2Node = { value: l2Key, label: l2Name, children: [] }
        l1Node.children.push(l2Node)
      }

      let l3Node = l2Node.children.find(n => n.value === l3Key)
      if (!l3Node) {
        l3Node = { value: l3Key, label: l3Name, children: [] }
        l2Node.children.push(l3Node)
      }

      l3Node.children.push({ value: ds.id, label: ds.name })
    }
    return tree
  }

  const cascaderOptions = useMemo(() => buildCascaderOptions(dataSets), [dataSets])

  const filteredConditions = useMemo(() => {
    if (!selectedDatasetId) return []
    const deIds = dataElements.filter(de => de.datasetId === selectedDatasetId).map(de => de.id)
    return allConditions.filter(cm => deIds.includes(cm.dataElementId))
  }, [selectedDatasetId, dataElements, allConditions])

  const filteredBaseConditions = useMemo(() => {
    if (!selectedBaseDatasetId) return []
    const deIds = dataElements.filter(de => de.datasetId === selectedBaseDatasetId).map(de => de.id)
    return allConditions.filter(cm => deIds.includes(cm.dataElementId))
  }, [selectedBaseDatasetId, dataElements, allConditions])

  const filteredFieldBConditions = useMemo(() => {
    if (!selectedFieldBDataSetId) return []
    const deIds = dataElements.filter(de => de.datasetId === selectedFieldBDataSetId).map(de => de.id)
    return allConditions.filter(cm => deIds.includes(cm.dataElementId))
  }, [selectedFieldBDataSetId, dataElements, allConditions])

  const handleSave = () => {
    const values = form.getFieldsValue()
    if (!node) return

    const newData = { label: values.label }

    if (node.type === 'condition') {
      // 处理多选字典值：Ant Design Select mode="multiple" 返回数组，需转成逗号分隔字符串
      const extra1 = values.operator === 'dictMatch' && Array.isArray(values.extraValue1)
        ? values.extraValue1.join(',') : values.extraValue1
      newData.conditionConfig = {
        field: values.field,
        operator: values.operator,
        value: values.value,
        extraValue1: extra1,
        extraValue2: values.extraValue2,
        extraValue3: values.extraValue3,
        extraValue4: values.extraValue4,
        dictCode: values.dictCode,
        allDictCode: values.allDictCode,
        dictAttr: values.dictAttr,
        allDictAttr: values.allDictAttr,
        valueSource: 'ADAPTER',
        conditionModelId: values.conditionModelId,
        datasetId: Array.isArray(values.datasetId) ? values.datasetId[values.datasetId.length - 1] : values.datasetId,
        baseConditionModelId: values.baseConditionModelId,
        baseDatasetId: Array.isArray(values.baseDatasetId) ? values.baseDatasetId[values.baseDatasetId.length - 1] : values.baseDatasetId,
      }
    } else if (node.type === 'result') {
      const selectedRc = resultConfigs.find(r => r.id === values.resultConfigId)
      newData.resultConfig = {
        resultConfigId: values.resultConfigId,
        resultType: selectedRc ? selectedRc.resultType : (node.data?.resultConfig?.resultType || 'DEFAULT'),
        resultValue: selectedRc ? selectedRc.resultName : (node.data?.resultConfig?.resultValue || values.label),
        priority: selectedRc ? selectedRc.priority : (node.data?.resultConfig?.priority || 0),
        content: values.content || selectedRc?.content || '',
        metadata: selectedRc ? selectedRc.metadata : null,
      }
    }

    onUpdate(node.id, newData)
  }

  const DictSelect = ({ name, label }) => (
    <Form.Item name={name} label={label} style={{ marginTop: -8 }}>
      <Select placeholder="选择字典" allowClear showSearch optionFilterProp="children">
        {dictionaries.map(dict => (
          <Option key={dict.code} value={dict.code}>
            {dict.name} ({dict.itemCount || 0}项)
          </Option>
        ))}
      </Select>
    </Form.Item>
  )

  const DictAttrSelect = ({ name }) => (
    <Form.Item name={name} label="匹配属性" style={{ marginTop: -8 }}>
      <Select placeholder="默认名称" allowClear>
        <Option value="itemName">名称</Option>
        <Option value="itemCode">编码</Option>
        <Option value="itemValue">值</Option>
      </Select>
    </Form.Item>
  )

  const DictItemPicker = () => {
    const dictCode = Form.useWatch('dictCode', form)
    const dictAttr = Form.useWatch('dictAttr', form)
    const [modalOpen, setModalOpen] = useState(false)
    const [searchKeyword, setSearchKeyword] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [searchLoading, setSearchLoading] = useState(false)
    const [selectedSet, setSelectedSet] = useState(new Set())
    const [selectedLabels, setSelectedLabels] = useState({})

    const currentVal = Form.useWatch('extraValue1', form) || []

    const openSearch = async () => {
      setSearchKeyword('')
      setSearchResults([])
      // 初始化已选集合
      const vals = Array.isArray(currentVal) ? currentVal : (currentVal ? currentVal.split(',').filter(Boolean) : [])
      setSelectedSet(new Set(vals))
      setModalOpen(true)
      // 加载第一页
      setSearchLoading(true)
      try {
        const res = await axios.get('/api/v1/dictionary-items/search', {
          params: { dictCode, keyword: '', attr: dictAttr || '', page: 0, size: 50 }
        })
        setSearchResults(res.data?.content || [])
      } finally {
        setSearchLoading(false)
      }
    }

    const doSearch = async (keyword) => {
      setSearchKeyword(keyword)
      setSearchLoading(true)
      try {
        const res = await axios.get('/api/v1/dictionary-items/search', {
          params: { dictCode, keyword, attr: dictAttr || '', page: 0, size: 50 }
        })
        setSearchResults(res.data?.content || [])
      } finally {
        setSearchLoading(false)
      }
    }

    const toggleItem = (item) => {
      const val = extractValue(item)
      setSelectedSet(prev => {
        const next = new Set(prev)
        if (next.has(val)) {
          next.delete(val)
        } else {
          next.add(val)
        }
        return new Set(next)
      })
      setSelectedLabels(prev => ({ ...prev, [val]: `${item.itemCode} ${item.itemName}` }))
    }

    const extractValue = (item) => {
      if (dictAttr === 'itemCode') return item.itemCode
      if (dictAttr === 'itemValue') return item.itemValue || item.itemName
      return item.itemName
    }

    const confirmSelection = () => {
      const arr = Array.from(selectedSet)
      form.setFieldsValue({ extraValue1: arr })
      setModalOpen(false)
    }

    return (
      <>
        <Form.Item name="extraValue1" label="选择匹配值（留空则匹配字典全部项）" style={{ marginTop: -8 }}>
          <Select
            mode="multiple"
            placeholder={dictCode ? '点击右侧按钮搜索' : '请先在上方选择字典'}
            disabled={!dictCode}
            open={false}
            onClick={() => dictCode && openSearch()}
            tagRender={({ label, value, closable, onClose }) => (
              <Tag closable={closable} onClose={onClose} style={{ marginBottom: 2 }}>
                {label}
              </Tag>
            )}
            dropdownStyle={{ display: 'none' }}
            maxTagCount={10}
          />
        </Form.Item>
        <Modal
          title={`选择字典值 — ${dictionaries.find(d => d.code === dictCode)?.name || dictCode || ''}`}
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          onOk={confirmSelection}
          okText="确认选择"
          cancelText="取消"
          width={640}
        >
          <Input.Search
            placeholder="输入编码或名称搜索..."
            allowClear
            onSearch={doSearch}
            enterButton={<><SearchOutlined /> 搜索</>}
            style={{ marginBottom: 12 }}
          />
          {searchKeyword && (
            <div style={{ marginBottom: 8, color: '#999', fontSize: 12 }}>
              搜索："{searchKeyword}"，找到 {searchResults.length} 条结果
            </div>
          )}
          <Spin spinning={searchLoading}>
            <div style={{ maxHeight: 400, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 4 }}>
              {searchResults.length === 0 && !searchLoading ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>输入关键词搜索字典项</div>
              ) : searchResults.map(item => {
                const val = extractValue(item)
                const checked = selectedSet.has(val)
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleItem(item)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f5f5f5',
                      background: checked ? '#e6f7ff' : undefined,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Checkbox checked={checked} />
                    <span style={{ fontWeight: 500, minWidth: 100 }}>{item.itemCode}</span>
                    <span>{item.itemName}</span>
                    {item.itemValue ? <span style={{ color: '#999', marginLeft: 'auto' }}>({item.itemValue})</span> : null}
                  </div>
                )
              })}
            </div>
          </Spin>
          <div style={{ marginTop: 8, color: '#666' }}>
            已选 <Tag color="blue">{selectedSet.size}</Tag> 项
          </div>
        </Modal>
      </>
    )
  }

  const DictValuePicker = ({ dictCode: propDictCode }) => {
    const dictCode = propDictCode || Form.useWatch('dictCode', form)
    const dictAttr = Form.useWatch('dictAttr', form)
    const [searchVal, setSearchVal] = useState('')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)

    const doSearch = async (keyword) => {
      if (!dictCode) return
      setSearchVal(keyword)
      setLoading(true)
      try {
        const res = await axios.get('/api/v1/dictionary-items/search', {
          params: { dictCode, keyword, attr: dictAttr || '', page: 0, size: 30 }
        })
        setResults(res.data?.content || [])
      } finally {
        setLoading(false)
      }
    }

    return (
      <Form.Item name="value" label="条件值（字典项）" rules={[{ required: true }]} style={{ marginTop: -8 }}>
        <Select
          showSearch
          placeholder="搜索并选择字典值"
          filterOption={false}
          onSearch={doSearch}
          onFocus={() => doSearch('')}
          notFoundContent={loading ? <Spin size="small" /> : (searchVal ? '无匹配项' : '输入关键词搜索')}
          allowClear
        >
          {results.map(item => {
            const val = dictAttr === 'itemCode' ? item.itemCode
                      : dictAttr === 'itemValue' ? (item.itemValue || item.itemName)
                      : item.itemName
            return (
              <Option key={item.id} value={val} title={`${item.itemCode} ${item.itemName}`}>
                <span style={{ fontWeight: 500 }}>{item.itemCode}</span>
                <span style={{ marginLeft: 8 }}>{item.itemName}</span>
              </Option>
            )
          })}
        </Select>
      </Form.Item>
    )
  }

  const renderConditionForm = () => (
    <>
      <Form.Item name="datasetId" label="数据集分类" rules={[{ required: true, message: '必须选择数据集分类' }]}>
        <Cascader
          options={cascaderOptions}
          placeholder="选择数据集分类"
          onChange={(value) => {
            const dsId = value?.[value.length - 1]
            setSelectedDatasetId(dsId || null)
            setElementDictCode(null)
            const patch = { conditionModelId: undefined, field: undefined, dataType: undefined }
            // fieldCompare 场景下，字段A 跟随条件模型，数据集变化也要清掉
            if (form.getFieldValue('operator') === 'fieldCompare') {
              patch.value = undefined
            }
            form.setFieldsValue(patch)
          }}
        />
      </Form.Item>
      <Form.Item name="conditionModelId" label="数据元/条件" rules={[{ required: true, message: '必须选择数据元' }]}>
        <Select
          placeholder={selectedDatasetId ? '选择该数据集下的数据元' : '请先选择数据集分类'}
          disabled={!selectedDatasetId}
          onChange={(modelId) => {
            const model = allConditions.find(m => m.id === modelId)
            if (model) {
              const de = dataElements.find(d => d.id === model.dataElementId)
              const dictCode = de?.dictCode || null
              setElementDictCode(dictCode)
              const patch = {
                field: model.code,
                dataType: model.dataType,
                dictCode: dictCode || undefined,
              }
              // fieldCompare 场景下，字段A 跟随当前条件模型同步
              if (form.getFieldValue('operator') === 'fieldCompare') {
                patch.value = model.code
              }
              form.setFieldsValue(patch)
            }
          }}
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
        <Select
          placeholder="选择计算符"
          onChange={(val) => {
            setSelectedOperator(val)
            // 切换到 fieldCompare 时，自动把当前条件模型的编码填到 value（字段A）
            if (val === 'fieldCompare') {
              const cmId = form.getFieldValue('conditionModelId')
              const cm = allConditions.find(m => m.id === cmId)
              if (cm) {
                form.setFieldsValue({ value: cm.code })
              }
            } else {
              // 切走 fieldCompare 时清空字段B数据集状态，避免残留
              setSelectedFieldBDataSetId(null)
              form.setFieldsValue({ fieldBDatasetId: undefined })
            }
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
      {selectedOperator === 'multiRegexMatch' ? (
        <>
          <Form.Item name="value" label="抗菌药物集合">
            <Input placeholder="手工输入，如: 青霉素,头孢" />
          </Form.Item>
          <DictSelect name="dictCode" label="或选择字典" />
          <DictAttrSelect name="dictAttr" />
          <Form.Item name="extraValue1" label="病程记录字段名" rules={[{ required: true }]}>
            <Input placeholder="如: courseRecord" />
          </Form.Item>
        </>
      ) : selectedOperator === 'contradictionCheck' ? (
        <>
          <Form.Item name="value" label="否定词库">
            <Input placeholder="手工输入，如: 否认,无" />
          </Form.Item>
          <DictSelect name="dictCode" label="或选择否定词字典" />
          <DictAttrSelect name="dictAttr" />
          <Form.Item name="extraValue1" label="关键字库">
            <Input placeholder="手工输入，如: 发热,头痛" />
          </Form.Item>
          <DictSelect name="allDictCode" label="或选择关键字字典" />
          <DictAttrSelect name="allDictAttr" />
          <Form.Item name="extraValue2" label="对比字段名" rules={[{ required: true }]}>
            <Input placeholder="如: 入院主诉" />
          </Form.Item>
        </>
      ) : selectedOperator === 'existenceConflict' ? (
        <>
          <Form.Item name="value" label="冲突关键词列表">
            <Input placeholder="手工输入，如: 糖尿病,高血压,发热" />
          </Form.Item>
          <DictSelect name="dictCode" label="或选择关键词字典" />
          <DictAttrSelect name="dictAttr" />
          <Form.Item name="extraValue1" label="对比字段名" rules={[{ required: true }]}>
            <Input placeholder="如: 入院主诉" />
          </Form.Item>
        </>
      ) : selectedOperator === 'whitelistMatch' ? (
        <>
          <Form.Item name="value" label="允许的关键词列表">
            <Input placeholder="手工输入，如: 头痛,发热" />
          </Form.Item>
          <Form.Item name="extraValue1" label="全部关键词列表">
            <Input placeholder="手工输入，如: 头痛,发热,咳嗽,流涕；留空则只做正向包含检查" />
          </Form.Item>
        </>
      ) : selectedOperator === 'dictMatch' ? (
        <>
          <DictSelect name="dictCode" label="匹配字典" />
          <DictAttrSelect name="dictAttr" />
          <DictItemPicker />
        </>
      ) : selectedOperator === 'dataCheck' ? (
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
      ) : selectedOperator === 'timeCheck' ? (
        <>
          <Form.Item name="baseDatasetId" label="基准时间数据集" rules={[{ required: true, message: '必须选择基准时间数据集' }]}>
            <Cascader
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
                const model = allConditions.find(m => m.id === modelId)
                if (model) {
                  form.setFieldsValue({
                    value: model.code,
                  })
                }
              }}
            >
              {filteredBaseConditions.map(cm => {
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
      ) : selectedOperator === 'lengthCheck' ? (
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
      ) : selectedOperator === 'isBlank' || selectedOperator === 'isNotBlank' ? (
        <></>
      ) : selectedOperator === 'similarity' ? (
        <>
          <Form.Item name="value" label="对比字段名" rules={[{ required: true }]}>
            <Input placeholder="如: otherCourseRecord" />
          </Form.Item>
          <Form.Item name="extraValue1" label="相似度阈值" rules={[{ required: true }]}>
            <Input placeholder="如: 0.995" />
          </Form.Item>
        </>
      ) : selectedOperator === 'arrayLength' ? (
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
      ) : selectedOperator === 'arrayIntersect' ? (
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
      ) : selectedOperator === 'regexMatch' ? (
        <>
          <Form.Item name="value" label="正则表达式">
            <Input placeholder="如: ^[a-z]+$" />
          </Form.Item>
          <DictSelect name="dictCode" label="或选择正则字典" />
          <DictAttrSelect name="dictAttr" />
        </>
      ) : selectedOperator === 'medicalNer' ? (
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
      ) : selectedOperator === 'negationCheck' ? (
        <>
          <Form.Item name="value" label="实体名称" rules={[{ required: true }]}>
            <Input placeholder="如: 发热" />
          </Form.Item>
        </>
      ) : selectedOperator === 'tokenSimilarity' ? (
        <>
          <Form.Item name="value" label="对比字段名" rules={[{ required: true }]}>
            <Input placeholder="如: otherCourseRecord" />
          </Form.Item>
          <Form.Item name="extraValue1" label="相似度阈值" rules={[{ required: true }]}>
            <Input placeholder="如: 0.95" />
          </Form.Item>
        </>
      ) : selectedOperator === 'allNegated' ? (
        <>
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
        </>
      ) : selectedOperator === 'fieldCompare' ? (
        <>
          <Form.Item name="value" label="字段A（当前条件模型）">
            <Input disabled placeholder="自动来自当前条件模型的编码" />
          </Form.Item>
          <Form.Item name="fieldBDatasetId" label="字段B 数据集" rules={[{ required: true, message: '必须选择字段B数据集' }]}>
            <Cascader
              options={cascaderOptions}
              placeholder="选择字段B数据集分类"
              onChange={(value) => {
                const dsId = value?.[value.length - 1]
                setSelectedFieldBDataSetId(dsId || null)
                form.setFieldsValue({ extraValue1: undefined })
              }}
            />
          </Form.Item>
          <Form.Item name="extraValue1" label="字段B 数据元" rules={[{ required: true, message: '必须选择字段B数据元' }]}>
            <Select
              placeholder={selectedFieldBDataSetId ? '选择该数据集下的数据元' : '请先选择字段B数据集'}
              disabled={!selectedFieldBDataSetId}
              showSearch
              optionFilterProp="children"
            >
              {filteredFieldBConditions.map(cm => {
                const de = dataElements.find(d => d.id === cm.dataElementId)
                return (
                  <Option key={cm.id} value={cm.code}>
                    {de?.name || cm.name}
                    <Tag color="blue" style={{ marginLeft: 8 }}>{cm.dataType}</Tag>
                  </Option>
                )
              })}
            </Select>
          </Form.Item>
          <Form.Item name="extraValue2" label="比较类型" rules={[{ required: true }]}>
            <Select
              placeholder="选择比较类型"
              onChange={(v) => {
                if (v === 'STRING_EQ') {
                  // 字符串相等场景：阈值无意义；比较符强制为 ==
                  form.setFieldsValue({ extraValue4: '0', extraValue3: '==' })
                }
              }}>
              <Option value="STRING_EQ">字符串相等 STRING_EQ</Option>
              <Option value="TIME_DIFF_HOUR">时间差（小时） TIME_DIFF_HOUR</Option>
              <Option value="TIME_DIFF_MINUTE">时间差（分钟） TIME_DIFF_MINUTE</Option>
              <Option value="TIME_DIFF_DAY">时间差（天） TIME_DIFF_DAY</Option>
              <Option value="NUMERIC_DIFF">数值差 NUMERIC_DIFF</Option>
            </Select>
          </Form.Item>
          {fieldCompareType === 'STRING_EQ' ? (
            <>
              <Form.Item name="extraValue3" label="比较符" rules={[{ required: true }]}>
                <Select placeholder="选择比较符">
                  <Option value="==">相等 ==（A 与 B 一致）</Option>
                  <Option value="!=">不等 !=（A 与 B 不一致）</Option>
                </Select>
              </Form.Item>
              <Form.Item name="extraValue4" initialValue="0" hidden>
                <Input />
              </Form.Item>
            </>
          ) : (
            <>
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
                <Input placeholder="时间差/数值差的阈值，如: 12 表示12小时" />
              </Form.Item>
            </>
          )}
        </>
      ) : selectedOperator === 'between' ? (
        <>
          <Form.Item name="value" label="最小值" rules={[{ required: true }]}>
            <Input placeholder="如: 0" type="number" />
          </Form.Item>
          <Form.Item name="extraValue1" label="最大值" rules={[{ required: true }]}>
            <Input placeholder="如: 250" type="number" />
          </Form.Item>
        </>
      ) : elementDictCode ? (
        <>
          <Form.Item name="dictAttr" label="匹配属性" style={{ marginTop: -8 }}>
            <Select placeholder="默认名称" allowClear>
              <Option value="itemName">名称</Option>
              <Option value="itemCode">编码</Option>
              <Option value="itemValue">值</Option>
            </Select>
          </Form.Item>
          <DictValuePicker dictCode={elementDictCode} />
        </>
      ) : (
        <Form.Item name="value" label="条件值" rules={[{ required: true }]}>
          <Input placeholder="如: 65" />
        </Form.Item>
      )}
    </>
  )

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
    if (rc?.content) {
      form.setFieldsValue({ content: rc.content })
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
          <>
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
          </>
        )}
      </div>
    )
  }

  const renderResultForm = () => (
    <>
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
                }}
              >{`${f.field}`}</Tag>
            ))}
          </div>
        </div>
      )}
      <div style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
        提示：请前往系统菜单的"结果管理"中预先配置结果属性。在结果内容中使用 <Tag style={{ fontSize: 11, cursor: 'pointer' }} color="default">{'${fieldName}'}</Tag> 可在执行时动态插入字段值。
      </div>
    </>
  )

  const titleMap = {
    condition: '配置条件节点',
    result: '配置结果节点',
    and: '配置AND节点',
    or: '配置OR节点',
  }

  if (!node) return null

  return (
    <Drawer
      title={titleMap[node.type] || '节点配置'}
      width={420}
      open={open}
      onClose={onClose}
      footer={
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} block>
          保存配置
        </Button>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item name="label" label="节点名称" rules={[{ required: true }]}>
          <Input placeholder="输入节点名称" />
        </Form.Item>

        {node.type === 'condition' && renderConditionForm()}
        {node.type === 'result' && renderResultForm()}
        {(node.type === 'and' || node.type === 'or') && (
          <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>
            逻辑节点无需额外配置
          </div>
        )}
      </Form>
    </Drawer>
  )
}
