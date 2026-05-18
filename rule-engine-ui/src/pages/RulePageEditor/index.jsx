import React, { useState, useEffect } from 'react'
import { Button, Card, Select, message, Space, Tag, Tooltip } from 'antd'
import {
  PlusOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  CloudUploadOutlined,
  RollbackOutlined,
  PartitionOutlined,
} from '@ant-design/icons'
import axios from 'axios'
import { useConditionData } from '../../hooks/useConditionData'
import ConditionRow from '../../components/ConditionRow'
import ResultConfigForm from '../../components/ResultConfigForm'
import { pageToCanvas, canvasToPage, generateConditionId, checkConditionLimit } from '../../utils/canvasConverter'
import FlowCanvasViewer from '../../components/Canvas/FlowCanvasViewer'
import './style.css'

const API_BASE = '/api/v1'
const MAX_CONDITIONS = 20

export default function RulePageEditor() {
  const {
    cascaderOptions,
    dataElements,
    allConditions,
    dictionaries,
    resultConfigs,
    loading: dataLoading,
    loadAll,
  } = useConditionData()

  const [ruleId, setRuleId] = useState(null)
  const [currentRule, setCurrentRule] = useState(null)
  const [conditions, setConditions] = useState([])
  const [logicOperators, setLogicOperators] = useState([])
  const [result, setResult] = useState(null)
  const [canvasData, setCanvasData] = useState({ nodes: [], edges: [] })
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')

  // 加载规则数据和字典数据
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const rId = params.get('ruleId')
    loadAll()
    if (rId) {
      setRuleId(Number(rId))
      loadRule(Number(rId))
    }
  }, [loadAll])

  const loadRule = async (id) => {
    try {
      const res = await axios.get(`${API_BASE}/rules/${id}`)
      const rule = res.data
      setCurrentRule(rule)
      if (rule.canvasData) {
        const canvas = JSON.parse(rule.canvasData)
        parseCanvas(canvas)
      }
    } catch (err) {
      message.error('加载规则失败: ' + (err.response?.data?.message || err.message))
    }
  }

  const parseCanvas = (canvas) => {
    setParsing(true)
    setParseError('')
    const parsed = canvasToPage(canvas)
    if (parsed.parseable) {
      setConditions(parsed.conditions.map(c => ({ ...c, id: c.id || generateConditionId() })))
      setLogicOperators(parsed.logicOperators || [])
      setResult(parsed.result)
    } else {
      setParseError(parsed.reason || '此规则结构过于复杂，无法在页面编辑器中展示')
      // 使用默认空状态
      setConditions([])
      setLogicOperators([])
      setResult(null)
    }
    setParsing(false)
  }

  // 当 conditions 或 logicOperators 或 result 变化时，更新画布预览
  useEffect(() => {
    const pageConfig = { conditions, logicOperators, result }
    const canvas = pageToCanvas(pageConfig)
    setCanvasData(canvas)
  }, [conditions, logicOperators, result])

  const handleAddCondition = () => {
    if (!checkConditionLimit(conditions.length + 1)) {
      message.warning(`最多支持 ${MAX_CONDITIONS} 个条件`)
      return
    }
    const newCond = {
      id: generateConditionId(),
      field: '',
      operator: '',
      value: '',
    }
    setConditions(prev => [...prev, newCond])
    // 新添加的条件与前一个条件之间默认使用 AND
    if (conditions.length > 0) {
      setLogicOperators(prev => [...prev, 'AND'])
    }
  }

  const handleDeleteCondition = (index) => {
    setConditions(prev => {
      const next = [...prev]
      next.splice(index, 1)
      return next
    })
    // 同步删除对应的 logicOperator
    setLogicOperators(prev => {
      const next = [...prev]
      // 删除第 index 个条件时，需要删除它前面的连接符（如果 index > 0）
      // 或者后面的连接符（如果 index === 0）
      if (index === 0) {
        next.splice(0, 1)
      } else {
        next.splice(index - 1, 1)
      }
      return next
    })
  }

  const handleConditionChange = (index, newValues) => {
    setConditions(prev => {
      const next = [...prev]
      next[index] = { ...next[index], ...newValues }
      return next
    })
  }

  const handleLogicOperatorChange = (index, value) => {
    setLogicOperators(prev => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const handleResultChange = (newValues) => {
    setResult(prev => ({ ...prev, ...newValues }))
  }

  const doSaveCanvas = async (silent = false) => {
    if (!ruleId) {
      if (!silent) message.warning('规则ID缺失，无法保存')
      return
    }
    if (parseError) {
      if (!silent) message.warning(parseError + '，请切换到画布编辑器编辑')
      return
    }
    if (conditions.length === 0) {
      if (!silent) message.warning('请至少添加一个条件')
      return
    }
    if (!result || !result.resultConfigId) {
      if (!silent) message.warning('请配置结果')
      return
    }
    // 检查每个条件是否完整
    for (let i = 0; i < conditions.length; i++) {
      const c = conditions[i]
      if (!c.field || !c.operator) {
        if (!silent) message.warning(`条件 ${i + 1} 配置不完整，请选择数据元和计算符`)
        return
      }
    }
    const pageConfig = { conditions, logicOperators, result }
    const canvasData = pageToCanvas(pageConfig)
    try {
      await axios.put(`${API_BASE}/rules/${ruleId}/canvas`, canvasData)
      if (!silent) message.success('保存成功')
    } catch (err) {
      if (!silent) message.error('保存失败: ' + (err.response?.data?.message || err.message))
      throw err
    }
  }

  const handlePublish = async () => {
    if (!ruleId) { message.warning('请先保存规则'); return }
    try {
      await doSaveCanvas(true)
      const res = await axios.post(`${API_BASE}/rules/${ruleId}/publish`)
      setCurrentRule(res.data)
      message.success('规则发布成功')
    } catch (err) {
      message.error('发布失败: ' + (err.response?.data?.message || err.message))
    }
  }

  const handleWithdraw = async () => {
    if (!ruleId) return
    try {
      const res = await axios.post(`${API_BASE}/rules/${ruleId}/withdraw`)
      setCurrentRule(res.data)
      message.success('规则已撤回为草稿')
    } catch (err) {
      message.error('撤回失败: ' + (err.response?.data?.message || err.message))
    }
  }

  const switchToCanvasEditor = () => {
    if (ruleId) {
      window.location.href = `/?page=editor&ruleId=${ruleId}`
    }
  }

  const handleBack = () => {
    window.location.href = '/'
  }

  // 计算条件字段（用于结果内容的变量提示）
  const conditionFields = React.useMemo(() => {
    return conditions
      .filter(c => c.field)
      .map(c => ({
        field: c.field,
        dataType: c.dataType,
        label: c.field,
      }))
  }, [conditions])

  return (
    <div className="rule-page-editor">
      {/* 顶部操作栏 */}
      <div className="editor-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回
          </Button>
          <h2 style={{ margin: 0, fontSize: 18 }}>
            规则页面编辑
            {currentRule && (
              <span style={{ marginLeft: 12, fontSize: 14, color: '#666', fontWeight: 'normal' }}>
                {currentRule.code} · {currentRule.name}
                <Tag color={currentRule.status === 'PUBLISHED' ? 'green' : currentRule.status === 'DRAFT' ? 'orange' : 'default'} style={{ marginLeft: 8 }}>
                  {currentRule.status === 'PUBLISHED' ? '已发布' : currentRule.status === 'DRAFT' ? '草稿' : '已停用'}
                </Tag>
              </span>
            )}
          </h2>
        </Space>
        <Space>
          <Button icon={<PartitionOutlined />} onClick={switchToCanvasEditor}>
            画布编辑
          </Button>
          <Button icon={<SaveOutlined />} type="primary" onClick={() => doSaveCanvas()}>
            保存
          </Button>
          {currentRule?.status === 'DRAFT' && (
            <Button icon={<CloudUploadOutlined />} onClick={handlePublish}>
              发布
            </Button>
          )}
          {currentRule?.status === 'PUBLISHED' && (
            <Button icon={<RollbackOutlined />} onClick={handleWithdraw}>
              撤回
            </Button>
          )}
        </Space>
      </div>

      <div className="editor-body">
        <div className="editor-main">
          {/* 解析错误提示 */}
          {parseError && (
            <Card style={{ marginBottom: 16, borderColor: '#ff4d4f' }}>
              <div style={{ color: '#ff4d4f' }}>
                <strong>提示：</strong>{parseError}
              </div>
            </Card>
          )}

          {/* 条件配置区 */}
          <Card
            title="条件配置"
            extra={
              <Tooltip title={`已配置 ${conditions.length} / ${MAX_CONDITIONS} 个条件`}>
                <Tag color={conditions.length >= MAX_CONDITIONS ? 'red' : 'blue'}>
                  {conditions.length} / {MAX_CONDITIONS}
                </Tag>
              </Tooltip>
            }
            style={{ marginBottom: 16 }}
          >
            {conditions.map((cond, index) => (
              <div key={cond.id}>
                <ConditionRow
                  index={index}
                  value={cond}
                  onChange={(newValues) => handleConditionChange(index, newValues)}
                  onDelete={() => handleDeleteCondition(index)}
                  cascaderOptions={cascaderOptions}
                  dataElements={dataElements}
                  allConditions={allConditions}
                  dictionaries={dictionaries}
                  canDelete={conditions.length > 1}
                />
                {index < conditions.length - 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                    <Tooltip title={logicOperators[index] === 'AND' ? '当前条件满足后，继续检查下一个条件' : '当前条件满足后，直接命中结果'}>
                      <Select
                        value={logicOperators[index] || 'AND'}
                        onChange={(val) => handleLogicOperatorChange(index, val)}
                        style={{ width: 120 }}
                        options={[
                          { value: 'AND', label: 'AND（并且）' },
                          { value: 'OR', label: 'OR（或者）' },
                        ]}
                      />
                    </Tooltip>
                  </div>
                )}
              </div>
            ))}

            {conditions.length === 0 && !parseError && (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                暂无条件，点击下方按钮添加
              </div>
            )}

            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={handleAddCondition}
              disabled={conditions.length >= MAX_CONDITIONS}
              block
              style={{ marginTop: 8 }}
            >
              {conditions.length >= MAX_CONDITIONS ? `最多 ${MAX_CONDITIONS} 个条件` : '添加条件'}
            </Button>
          </Card>

          {/* 结果配置区 */}
          <Card title="结果配置" style={{ marginBottom: 16 }}>
            <ResultConfigForm
              value={result}
              onChange={handleResultChange}
              resultConfigs={resultConfigs}
              conditionFields={conditionFields}
              dictionaries={dictionaries}
            />
          </Card>
        </div>

        {/* 右侧画布预览 */}
        <div className="editor-preview">
          <Card title="画布预览" size="small" style={{ height: '100%' }}>
            <div style={{ height: 400, border: '1px solid #f0f0f0', borderRadius: 4 }}>
              <FlowCanvasViewer nodes={canvasData.nodes} edges={canvasData.edges} />
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              预览展示当前配置对应的画布拓扑
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
