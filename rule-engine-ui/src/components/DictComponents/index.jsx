import React, { useState } from 'react'
import { Form, Select, Input, Checkbox, Tag, Modal, Spin } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import axios from 'axios'

const { Option } = Select

export const DictSelect = ({ form, name, label, dictionaries }) => (
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

export const DictAttrSelect = ({ name }) => (
  <Form.Item name={name} label="匹配属性" style={{ marginTop: -8 }}>
    <Select placeholder="默认名称" allowClear>
      <Option value="itemName">名称</Option>
      <Option value="itemCode">编码</Option>
      <Option value="itemValue">值</Option>
    </Select>
  </Form.Item>
)

export const DictItemPicker = ({ form, dictionaries }) => {
  const dictCode = Form.useWatch('dictCode', form)
  const dictAttr = Form.useWatch('dictAttr', form)
  const [modalOpen, setModalOpen] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedSet, setSelectedSet] = useState(new Set())

  const currentVal = Form.useWatch('extraValue1', form) || []

  const openSearch = async () => {
    setSearchKeyword('')
    setSearchResults([])
    const vals = Array.isArray(currentVal) ? currentVal : (currentVal ? currentVal.split(',').filter(Boolean) : [])
    setSelectedSet(new Set(vals))
    setModalOpen(true)
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

  const extractValue = (item) => {
    if (dictAttr === 'itemCode') return item.itemCode
    if (dictAttr === 'itemValue') return item.itemValue || item.itemName
    return item.itemName
  }

  const toggleItem = (item) => {
    const val = extractValue(item)
    setSelectedSet(prev => {
      const next = new Set(prev)
      if (next.has(val)) next.delete(val)
      else next.add(val)
      return new Set(next)
    })
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
          tagRender={({ label, closable, onClose }) => (
            <Tag closable={closable} onClose={onClose} style={{ marginBottom: 2 }}>{label}</Tag>
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
                    padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5',
                    background: checked ? '#e6f7ff' : undefined, display: 'flex', alignItems: 'center', gap: 8,
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

export const DictValuePicker = ({ form, dictCode: propDictCode, dictionaries }) => {
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
