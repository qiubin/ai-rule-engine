import { useState, useEffect, useMemo, useCallback } from 'react'
import axios from 'axios'

export function useConditionData() {
  const [categories, setCategories] = useState([])
  const [conditions, setConditions] = useState([])
  const [allConditions, setAllConditions] = useState([])
  const [dictionaries, setDictionaries] = useState([])
  const [dataSets, setDataSets] = useState([])
  const [dataElements, setDataElements] = useState([])
  const [resultConfigs, setResultConfigs] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchCategories = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/condition-model-categories')
      setCategories(res.data)
    } catch (e) {}
  }, [])

  const fetchConditionsByCategory = useCallback(async (categoryId) => {
    try {
      const res = await axios.get(`/api/v1/condition-models/by-category/${categoryId}`)
      const filtered = res.data.filter(m =>
        m.nodeUsage === 'CONDITION' || m.nodeUsage === 'BOTH'
      )
      setConditions(filtered)
    } catch (e) {}
  }, [])

  const fetchDictionaries = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/dictionaries')
      setDictionaries(res.data)
    } catch (e) {}
  }, [])

  const fetchAllResultConfigs = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/result-configs')
      setResultConfigs(res.data)
    } catch (e) {}
  }, [])

  const fetchDataSets = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/data-sets')
      setDataSets(res.data)
    } catch (e) {}
  }, [])

  const fetchDataElements = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/data-elements')
      setDataElements(res.data)
    } catch (e) {}
  }, [])

  const fetchAllConditions = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/condition-models')
      setAllConditions(res.data.filter(m => m.nodeUsage === 'CONDITION' || m.nodeUsage === 'BOTH'))
    } catch (e) {}
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([
      fetchCategories(),
      fetchDictionaries(),
      fetchDataSets(),
      fetchDataElements(),
      fetchAllConditions(),
      fetchAllResultConfigs(),
    ])
    setLoading(false)
  }, [fetchCategories, fetchDictionaries, fetchDataSets, fetchDataElements, fetchAllConditions, fetchAllResultConfigs])

  const buildCascaderOptions = useCallback((dataSets) => {
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
  }, [])

  const cascaderOptions = useMemo(() => buildCascaderOptions(dataSets), [buildCascaderOptions, dataSets])

  const getFilteredConditions = useCallback((datasetId) => {
    if (!datasetId) return []
    const deIds = dataElements.filter(de => de.datasetId === datasetId).map(de => de.id)
    return allConditions.filter(cm => deIds.includes(cm.dataElementId))
  }, [dataElements, allConditions])

  const getConditionModel = useCallback((modelId) => {
    return allConditions.find(m => m.id === modelId)
  }, [allConditions])

  const getDataElement = useCallback((elementId) => {
    return dataElements.find(d => d.id === elementId)
  }, [dataElements])

  const getResultConfig = useCallback((rcId) => {
    return resultConfigs.find(r => r.id === rcId)
  }, [resultConfigs])

  return {
    categories,
    conditions,
    allConditions,
    dictionaries,
    dataSets,
    dataElements,
    resultConfigs,
    loading,
    cascaderOptions,
    loadAll,
    fetchCategories,
    fetchConditionsByCategory,
    fetchDictionaries,
    fetchAllResultConfigs,
    fetchDataSets,
    fetchDataElements,
    fetchAllConditions,
    getFilteredConditions,
    getConditionModel,
    getDataElement,
    getResultConfig,
  }
}
