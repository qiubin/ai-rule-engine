import React, { useState } from 'react'
import axios from 'axios'
import ConditionModelMgr from '../ConditionModelMgr'
import ResultModelMgr from '../ResultModelMgr'
import DictionaryMgr from '../DictionaryMgr'
import DataElementMgr from '../DataElementMgr'
import AdapterConfigPage from '../AdapterConfigPage'
import DbConfigPage from '../DbConfigPage'
import AccessLogMgr from '../AccessLogMgr'
import RecycleBin from '../RecycleBin'
import SystemHelp from '../SystemHelp'

const TABS = [
  { key: 'models', label: '条件管理' },
  { key: 'results', label: '结果管理' },
  { key: 'dictionaries', label: '字典管理' },
  { key: 'dataElements', label: '数据元管理' },
  { key: 'adapter', label: '适配器配置' },
  { key: 'db', label: '数据库配置' },
  { key: 'accessLogs', label: '访问日志' },
  { key: 'recycle', label: '回收站' },
  { key: 'help', label: '架构说明' },
]

function recordAccess(pageName) {
  if (!pageName) return
  axios.post('/api/v1/access-logs', { pageName }).catch(() => {})
}

export default function SystemMenu() {
  const [activeTab, setActiveTab] = useState('models')

  const handleTabClick = (key) => {
    setActiveTab(key)
    const tab = TABS.find(t => t.key === key)
    if (tab) {
      recordAccess(`系统管理 - ${tab.label}`)
    }
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'models': return <ConditionModelMgr />
      case 'results': return <ResultModelMgr />
      case 'dictionaries': return <DictionaryMgr />
      case 'dataElements': return <DataElementMgr />
      case 'adapter': return <AdapterConfigPage />
      case 'db': return <DbConfigPage />
      case 'accessLogs': return <AccessLogMgr />
      case 'recycle': return <RecycleBin />
      case 'help': return <SystemHelp />
      default: return <ConditionModelMgr />
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', background: '#fafafa', padding: '0 16px' }}>
        {TABS.map(tab => (
          <div
            key={tab.key}
            onClick={() => handleTabClick(tab.key)}
            style={{
              padding: '12px 24px',
              cursor: 'pointer',
              borderBottom: activeTab === tab.key ? '2px solid #1890ff' : '2px solid transparent',
              color: activeTab === tab.key ? '#1890ff' : '#666',
              fontSize: 14,
              fontWeight: activeTab === tab.key ? 'bold' : 'normal',
              transition: 'all 0.3s',
            }}
          >
            {tab.label}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {renderContent()}
      </div>
    </div>
  )
}
