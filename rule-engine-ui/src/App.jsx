import React, { useState, useEffect } from 'react'
import axios from 'axios'
import RuleEditor from './pages/RuleEditor'
import RulePageEditor from './pages/RulePageEditor'
import RuleTypeMgr from './pages/RuleTypeMgr'
import DataElementMgr from './pages/DataElementMgr'
import DictionaryMgr from './pages/DictionaryMgr'
import ConditionModelMgr from './pages/ConditionModelMgr'
import ResultModelMgr from './pages/ResultModelMgr'
import RuleExecute from './pages/RuleExecute'
import SystemMenu from './pages/SystemMenu'
import RecycleBin from './pages/RecycleBin'

const NAV_ITEMS = [
  { key: 'types', label: '规则类型' },
  { key: 'execute', label: '规则执行' },
  { key: 'recycle', label: '回收站' },
  { key: 'system', label: '系统管理' },
]

const PAGE_NAME_MAP = {
  'types': '规则类型',
  'execute': '规则执行',
  'recycle': '回收站',
  'system': '系统管理',
  'editor': '规则编辑器',
}

function recordAccess(pageName) {
  if (!pageName) return
  axios.post('/api/v1/access-logs', { pageName }).catch(() => {})
}

function App() {
  const [currentPage, setCurrentPage] = useState('types')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const page = params.get('page')
    if (page) {
      const pageMap = {
        'editor': 'editor',
        'pageEditor': 'pageEditor',
        'types': 'types',
        'system': 'system',
        'execute': 'execute',
        'recycle': 'recycle',
      }
      if (pageMap[page]) {
        setCurrentPage(pageMap[page])
        recordAccess(PAGE_NAME_MAP[pageMap[page]])
      }
    }
  }, [])

  const handleNavClick = (key) => {
    setCurrentPage(key)
    window.history.replaceState({}, '', '/')
    recordAccess(PAGE_NAME_MAP[key])
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'editor': return <RuleEditor />
      case 'pageEditor': return <RulePageEditor />
      case 'types': return <RuleTypeMgr />
      case 'dataElements': return <DataElementMgr />
      case 'dictionaries': return <DictionaryMgr />
      case 'models': return <ConditionModelMgr />
      case 'results': return <ResultModelMgr />
      case 'execute': return <RuleExecute />
      case 'recycle': return <RecycleBin />
      case 'system': return <SystemMenu />
      default: return <RuleTypeMgr />
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', background: '#001529', padding: '0 24px', height: 64 }}>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginRight: 40, whiteSpace: 'nowrap' }}>规则引擎</div>
        <div style={{ display: 'flex', flex: 1, gap: 4 }}>
          {NAV_ITEMS.map(item => (
            <div
              key={item.key}
              onClick={() => handleNavClick(item.key)}
              style={{
                padding: '0 16px', height: 64, lineHeight: '64px',
                color: currentPage === item.key ? '#fff' : 'rgba(255,255,255,0.65)',
                background: currentPage === item.key ? '#1890ff' : 'transparent',
                cursor: 'pointer', fontSize: 14, transition: 'all 0.3s',
              }}
            >
              {item.label}
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {renderPage()}
      </div>
    </div>
  )
}

export default App
