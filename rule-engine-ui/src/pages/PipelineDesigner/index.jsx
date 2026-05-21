import React, { useState, useCallback, useEffect, memo } from 'react';
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls, 
  applyEdgeChanges, 
  applyNodeChanges,
  Handle,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button, Input, Modal, message, Layout, Space, Typography, Popconfirm, Drawer, Tag, Empty, Card, Form, InputNumber, Alert, Divider, Select, Radio, Table, Tooltip } from 'antd';
import { PlusOutlined, SaveOutlined, DeleteOutlined, FolderOpenOutlined, PlayCircleOutlined, BranchesOutlined, PlaySquareOutlined, StopOutlined, ColumnWidthOutlined, EditOutlined, CopyOutlined, ReloadOutlined, ToolOutlined, CodeOutlined, ClockCircleOutlined, RobotOutlined, BulbOutlined, UserOutlined } from '@ant-design/icons';
import dagre from '@dagrejs/dagre';
import axios from 'axios';

const { Sider, Content } = Layout;
const { Text } = Typography;
const { Option } = Select;

// --- 自定义节点组件 ---

const StartNode = memo(() => (
  <div style={{ padding: '10px 20px', borderRadius: '20px', background: '#52c41a', color: '#fff', textAlign: 'center', border: '2px solid #389e0d', minWidth: 100 }}>
    <PlaySquareOutlined /> <b>开始</b>
    <Handle type="source" position={Position.Bottom} />
  </div>
));

const EndNode = memo(() => (
  <div style={{ padding: '10px 20px', borderRadius: '20px', background: '#ff4d4f', color: '#fff', textAlign: 'center', border: '2px solid #cf1322', minWidth: 100 }}>
    <Handle type="target" position={Position.Top} />
    <StopOutlined /> <b>结束</b>
  </div>
));

const RuleNode = memo(({ data }) => (
  <div style={{ padding: '10px', borderRadius: '8px', background: '#fff', border: '2px solid #1890ff', textAlign: 'center', minWidth: 150, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
    <Handle type="target" position={Position.Top} />
    <div style={{ fontSize: '12px', color: '#1890ff', marginBottom: '4px' }}>业务规则</div>
    <div style={{ fontWeight: 'bold' }}>{data.label}</div>
    <Handle type="source" position={Position.Bottom} />
  </div>
));

const ConditionNode = memo(({ data }) => (
  <div style={{
    padding: '20px 10px',
    width: '120px',
    height: '80px',
    background: '#fff',
    border: '2px solid #faad14',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    transform: 'rotate(0deg)',
    position: 'relative',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  }}>
    <Handle type="target" position={Position.Top} />
    <div style={{ fontSize: '10px', color: '#faad14' }}>逻辑分支</div>
    <div style={{ fontWeight: 'bold', fontSize: '12px', textAlign: 'center' }}>{data.label || '未配置'}</div>

    <Handle type="source" position={Position.Left} id="true" style={{ background: '#52c41a', top: '70%' }} />
    <div style={{ position: 'absolute', left: '-25px', top: '60%', fontSize: '10px', color: '#52c41a' }}>YES</div>

    <Handle type="source" position={Position.Right} id="false" style={{ background: '#ff4d4f', top: '70%' }} />
    <div style={{ position: 'absolute', right: '-20px', top: '60%', fontSize: '10px', color: '#ff4d4f' }}>NO</div>
  </div>
));

const ServiceTaskNode = memo(({ data }) => (
  <div style={{ padding: '10px', borderRadius: '8px', background: '#fff', border: '2px solid #1890ff', textAlign: 'center', minWidth: 150, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
    <Handle type="target" position={Position.Top} />
    <div style={{ fontSize: '12px', color: '#1890ff', marginBottom: '4px' }}><ToolOutlined /> 服务任务</div>
    <div style={{ fontWeight: 'bold' }}>{data.label}</div>
    <Handle type="source" position={Position.Bottom} />
  </div>
));

const ScriptTaskNode = memo(({ data }) => (
  <div style={{ padding: '10px', borderRadius: '8px', background: '#fff', border: '2px solid #722ed1', textAlign: 'center', minWidth: 150, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
    <Handle type="target" position={Position.Top} />
    <div style={{ fontSize: '12px', color: '#722ed1', marginBottom: '4px' }}><CodeOutlined /> 脚本任务</div>
    <div style={{ fontWeight: 'bold' }}>{data.label}</div>
    <Handle type="source" position={Position.Bottom} />
  </div>
));

const DelayTaskNode = memo(({ data }) => (
  <div style={{ padding: '10px', borderRadius: '8px', background: '#fff', border: '2px solid #fa8c16', textAlign: 'center', minWidth: 150, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
    <Handle type="target" position={Position.Top} />
    <div style={{ fontSize: '12px', color: '#fa8c16', marginBottom: '4px' }}><ClockCircleOutlined /> 延时任务</div>
    <div style={{ fontWeight: 'bold' }}>{data.label}</div>
    <Handle type="source" position={Position.Bottom} />
  </div>
));

const AgentTaskNode = memo(({ data }) => (
  <div style={{ padding: '10px', borderRadius: '8px', background: '#fff', border: '2px solid #722ed1', textAlign: 'center', minWidth: 150, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
    <Handle type="target" position={Position.Top} />
    <div style={{ fontSize: '12px', color: '#722ed1', marginBottom: '4px' }}><RobotOutlined /> 智能体任务</div>
    <div style={{ fontWeight: 'bold' }}>{data.label}</div>
    <Handle type="source" position={Position.Bottom} />
  </div>
));

const HumanTaskNode = memo(({ data }) => (
  <div style={{ padding: '10px', borderRadius: '8px', background: '#fff', border: '2px solid #eb2f96', textAlign: 'center', minWidth: 150, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
    <Handle type="target" position={Position.Top} />
    <div style={{ fontSize: '12px', color: '#eb2f96', marginBottom: '4px' }}><UserOutlined /> 人工任务</div>
    <div style={{ fontWeight: 'bold' }}>{data.label}</div>
    <Handle type="source" position={Position.Bottom} />
  </div>
));

const nodeTypes = {
  start: StartNode,
  end: EndNode,
  rule: RuleNode,
  condition: ConditionNode,
  service_task: ServiceTaskNode,
  script_task: ScriptTaskNode,
  delay_task: DelayTaskNode,
  agent_task: AgentTaskNode,
  human_task: HumanTaskNode,
};

// --- 主组件 ---

const PipelineDesigner = () => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [pipelineId, setPipelineId] = useState('');
  const [pipelineCode, setPipelineCode] = useState('');
  const [pipelineName, setPipelineName] = useState('未命名流水线');
  const [pipelineList, setPipelineList] = useState([]);
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameForm] = Form.useForm();
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateSourceId, setDuplicateSourceId] = useState('');
  const [duplicateForm] = Form.useForm();
  const [allRuleTypes, setAllRuleTypes] = useState([]);
  const [allRules, setAllRules] = useState([]);
  const [filteredRules, setFilteredRules] = useState([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentNode, setCurrentNode] = useState(null);
  
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [selectedRuleCode, setSelectedRuleCode] = useState('');
  const [conditionConfig, setConditionConfig] = useState({ refNodeId: '', expected: 'matched' });
  const [nodeConfig, setNodeConfig] = useState({});

  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState(null);
  
  const [testForm] = Form.useForm();

  const fetchInitialData = useCallback(async () => {
    try {
      const [resList, resTypes, resRules] = await Promise.all([
        axios.get('/api/v1/processes'),
        axios.get('/api/v1/rule-types'),
        axios.get('/api/v1/rules')
      ]);
      const raw = Array.isArray(resList.data) ? resList.data : (resList.data.pipelines || []);
      const normalized = raw.map((p) =>
        typeof p === 'string'
          ? { id: p, name: p, nodeCount: 0, edgeCount: 0, updatedAt: 0 }
          : { ...p, id: p.id, name: p.name || p.id }
      );
      setPipelineList(normalized);
      setAllRuleTypes(resTypes.data || []);
      setAllRules(resRules.data || []);
    } catch (err) {
      message.error('初始化数据失败');
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((params) => {
    let edgeParam = params;
    if (params.sourceHandle === 'true') edgeParam = { ...params, label: '是 (YES)', animated: true, style: { stroke: '#52c41a' } };
    if (params.sourceHandle === 'false') edgeParam = { ...params, label: '否 (NO)', animated: true, style: { stroke: '#ff4d4f' } };
    setEdges((eds) => addEdge(edgeParam, eds));
  }, []);

  const createNew = () => {
    setNodes([]);
    setEdges([]);
    setPipelineId('');
    setPipelineCode('');
    setPipelineName('新流水线_' + new Date().getTime().toString().slice(-4));
    message.info('已重置画布');
  };

  const addNode = (type) => {
    const id = `${type}_${new Date().getTime()}`;
    const labelMap = {
      start: '开始',
      end: '结束',
      rule: '待配置规则',
      condition: '分支判断',
      service_task: '服务任务',
      script_task: '脚本任务',
      delay_task: '延时任务',
      agent_task: '智能体任务',
      human_task: '人工任务',
    };
    const newNode = {
      id,
      type,
      data: { label: labelMap[type] || type, ruleCode: '', config: {} },
      position: { x: 150, y: 150 },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const onNodeClick = (_, node) => {
    if (node.type === 'start' || node.type === 'end') return;

    setCurrentNode(node);
    const isRuleNode = node.type === 'rule' || !node.type || node.type === 'default';

    if (isRuleNode) {
      const code = node.data.ruleCode || '';
      setSelectedRuleCode(code);
      const rule = allRules.find(r => r.code === code);
      if (rule) {
        setSelectedTypeId(rule.ruleTypeId);
        setFilteredRules(allRules.filter(r => r.ruleTypeId === rule.ruleTypeId));
      } else {
        setSelectedTypeId(null);
        setFilteredRules([]);
      }
    } else if (node.type === 'condition') {
      setConditionConfig(node.data.conditionConfig || { refNodeId: '', expected: 'matched' });
    } else {
      setNodeConfig(node.data.config || {});
    }
    setIsModalOpen(true);
  };

  const handleUpdateNode = () => {
    const isRuleNode = currentNode.type === 'rule' || !currentNode.type || currentNode.type === 'default';
    const isConditionNode = currentNode.type === 'condition';

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === currentNode.id) {
          if (isRuleNode) {
            const selectedRule = allRules.find(r => r.code === selectedRuleCode);
            return {
              ...node,
              data: { ...node.data, ruleCode: selectedRuleCode, label: selectedRule?.name || selectedRuleCode },
            };
          } else if (isConditionNode) {
            return {
              ...node,
              data: { ...node.data, conditionConfig, label: `判断: ${conditionConfig.refNodeId}` },
            };
          } else {
            return {
              ...node,
              data: { ...node.data, config: nodeConfig, label: nodeConfig.taskName || node.data.label },
            };
          }
        }
        return node;
      })
    );
    setIsModalOpen(false);
  };

  const deleteNode = () => {
    setNodes((nds) => nds.filter((n) => n.id !== currentNode.id));
    setIsModalOpen(false);
  };

  const getNodeSize = (node) => {
    switch (node.type) {
      case 'condition':
        return { width: 120, height: 80 };
      case 'rule':
        return { width: 170, height: 70 };
      default:
        return { width: 120, height: 44 };
    }
  };

  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) {
      message.warning('画布上没有节点');
      return;
    }

    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 });

    const sizeById = {};
    nodes.forEach((n) => {
      const size = getNodeSize(n);
      sizeById[n.id] = size;
      g.setNode(n.id, size);
    });
    edges.forEach((e) => g.setEdge(e.source, e.target));

    dagre.layout(g);

    setNodes((nds) =>
      nds.map((n) => {
        const node = g.node(n.id);
        if (!node) return n;
        const { width, height } = sizeById[n.id];
        return {
          ...n,
          position: { x: node.x - width / 2, y: node.y - height / 2 },
        };
      })
    );
    message.success('节点已自动排列');
  }, [nodes, edges]);

  const savePipeline = async () => {
    try {
      let id = pipelineId;
      // 1. 新建流程定义
      if (!id) {
        const code = pipelineName.toLowerCase().replace(/\s+/g, '_');
        const res = await axios.post('/api/v1/processes', { id: code, name: pipelineName });
        id = res.data.id;
        setPipelineId(id);
        setPipelineCode(res.data.code);
      }
      // 2. 保存画布 (nodes + edges → canvasData)
      const canvasData = JSON.stringify({ nodes, edges });
      await axios.put(`/api/v1/processes/${id}/canvas`, { canvasData });
      message.success('保存成功');
      fetchInitialData();
    } catch (err) {
      message.error(err?.response?.data?.message || '保存失败');
    }
  };

  const loadPipeline = async (id) => {
    try {
      const res = await axios.get(`/api/v1/processes/${id}`);
      const data = res.data;
      // 解析 canvasData JSON → { nodes, edges }
      let nodes = [], edges = [];
      if (data.canvasData) {
        try {
          const parsed = JSON.parse(data.canvasData);
          nodes = parsed.nodes || [];
          edges = parsed.edges || [];
        } catch (e) { /* canvasData 格式异常 */ }
      }
      setNodes(nodes);
      setEdges(edges);
      setPipelineId(data.id);
      setPipelineCode(data.code);
      setPipelineName(data.name || data.code);
    } catch (err) { message.error('加载失败'); }
  };

  const openRenameModal = (row) => {
    setRenameTarget(row);
    renameForm.setFieldsValue({ name: row.name });
    setRenameModalOpen(true);
  };

  const submitRename = async () => {
    try {
      const { name } = await renameForm.validateFields();
      await axios.post(`/api/v1/processes/${renameTarget.id}/rename`, { name });
      message.success('已更新名称');
      setRenameModalOpen(false);
      if (pipelineId === renameTarget.id) setPipelineName(name);
      fetchInitialData();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.detail || '重命名失败');
    }
  };

  const deletePipelineById = async (id) => {
    try {
      await axios.delete(`/api/v1/processes/${id}`);
      message.success('已删除流程');
      if (pipelineId === id) {
        setNodes([]);
        setEdges([]);
        setPipelineId('');
        setPipelineCode('');
        setPipelineName('新流水线_' + new Date().getTime().toString().slice(-4));
      }
      fetchInitialData();
    } catch (err) {
      message.error(err?.response?.data?.detail || '删除失败');
    }
  };

  const openDuplicateModal = (row) => {
    setDuplicateSourceId(row.id);
    duplicateForm.setFieldsValue({
      newId: `${row.id}_copy_${Date.now().toString().slice(-4)}`,
      newName: `${row.name || row.id}（副本）`,
    });
    setDuplicateModalOpen(true);
  };

  const submitDuplicate = async () => {
    try {
      const { newId, newName } = await duplicateForm.validateFields();
      const idNorm = String(newId).trim().replace(/\s+/g, '_');
      if (!/^[\w.-]+$/.test(idNorm)) {
        message.warning('流程编码仅允许字母、数字、下划线、点、横线');
        return;
      }
      await axios.post('/api/v1/processes/duplicate', {
        source_id: duplicateSourceId,
        target_id: idNorm,
        name: String(newName).trim() || idNorm,
      });
      message.success('已复制为新流程');
      setDuplicateModalOpen(false);
      await fetchInitialData();
      await loadPipeline(idNorm);
    } catch (err) {
      if (err?.errorFields) return;
      const d = err?.response?.data?.detail;
      message.error(typeof d === 'string' ? d : '复制失败');
    }
  };

  const filteredPipelines = pipelineList.filter((row) => {
    const q = pipelineSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (row.name || '').toLowerCase().includes(q) ||
      (row.id || '').toLowerCase().includes(q)
    );
  });

  const formatUpdated = (ms) => {
    if (!ms) return '—';
    try {
      const d = new Date(ms);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return '—';
    }
  };

  const handleRunTest = async (values) => {
    setIsTestModalOpen(false);
    setExecuting(true);
    setIsDrawerOpen(true);
    try {
      const code = pipelineCode || pipelineId;
      const res = await axios.post(`/api/v1/processes/${code}/execute`, values);
      setExecResult(res.data);
    } catch (err) { message.error('执行失败'); }
    finally { setExecuting(false); }
  };

  const isCurrentRuleNode = currentNode?.type === 'rule' || !currentNode?.type || currentNode?.type === 'default';
  const isCurrentConditionNode = currentNode?.type === 'condition';
  const isCurrentTaskNode = currentNode && !isCurrentRuleNode && !isCurrentConditionNode && currentNode.type !== 'start' && currentNode.type !== 'end';

  const getModalTitle = () => {
    if (isCurrentRuleNode) return '配置业务规则';
    if (isCurrentConditionNode) return '配置分支判断';
    const typeMap = {
      service_task: '配置服务任务',
      script_task: '配置脚本任务',
      delay_task: '配置延时任务',
      agent_task: '配置智能体任务',
      human_task: '配置人工任务',
    };
    return typeMap[currentNode?.type] || '配置节点';
  };

  return (
    <Layout style={{ height: 'calc(100vh - 64px)' }}>
      <Sider width={340} theme="light" style={{ borderRight: '1px solid #f0f0f0', overflow: 'auto' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
          <Button type="primary" block icon={<PlusOutlined />} onClick={createNew} style={{ marginBottom: 16 }}>新建流程</Button>
          <Divider orientation="left" plain style={{ fontSize: '12px', margin: '10px 0' }}>通用节点</Divider>
          <Space direction="vertical" style={{ width: '100%' }}>
             <Button block icon={<PlaySquareOutlined />} onClick={() => addNode('start')} style={{ color: '#52c41a' }}>添加开始节点</Button>
             <Button block icon={<StopOutlined />} onClick={() => addNode('end')} style={{ color: '#ff4d4f' }}>添加结束节点</Button>
          </Space>
          <Divider orientation="left" plain style={{ fontSize: '12px', margin: '10px 0' }}>业务节点</Divider>
          <Space direction="vertical" style={{ width: '100%' }}>
             <Button block icon={<PlusOutlined />} onClick={() => addNode('rule')}>添加业务规则</Button>
             <Button block icon={<BranchesOutlined />} onClick={() => addNode('condition')}>添加分支逻辑</Button>
          </Space>
          <Divider orientation="left" plain style={{ fontSize: '12px', margin: '10px 0' }}>AI/服务节点</Divider>
          <Space direction="vertical" style={{ width: '100%' }}>
             <Button block icon={<ToolOutlined />} onClick={() => addNode('service_task')} style={{ color: '#1890ff' }}>服务任务</Button>
             <Button block icon={<CodeOutlined />} onClick={() => addNode('script_task')} style={{ color: '#722ed1' }}>脚本任务</Button>
             <Button block icon={<ClockCircleOutlined />} onClick={() => addNode('delay_task')} style={{ color: '#fa8c16' }}>延时任务</Button>
             <Button block icon={<RobotOutlined />} onClick={() => addNode('agent_task')} style={{ color: '#722ed1' }}>智能体任务</Button>
             <Button block icon={<UserOutlined />} onClick={() => addNode('human_task')} style={{ color: '#eb2f96' }}>人工任务</Button>
          </Space>
        </div>
        <div style={{ padding: '12px 12px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text strong>已存流程</Text>
            <Tooltip title="刷新列表">
              <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => fetchInitialData()} />
            </Tooltip>
          </div>
          <Input
            allowClear
            placeholder="按名称或编码筛选"
            value={pipelineSearch}
            onChange={(e) => setPipelineSearch(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <Table
            size="small"
            pagination={false}
            scroll={{ y: 'calc(100vh - 420px)' }}
            rowKey="id"
            dataSource={filteredPipelines}
            locale={{ emptyText: '暂无已存流程' }}
            rowClassName={(record) => (record.id === pipelineId ? 'pipeline-row-active' : '')}
            columns={[
              {
                title: '流程',
                key: 'name',
                ellipsis: true,
                render: (_, row) => (
                  <div>
                    <div style={{ fontWeight: pipelineId === row.id ? 600 : 400 }}>{row.name}</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>{row.id}</Text>
                  </div>
                ),
              },
              {
                title: '节点',
                dataIndex: 'nodeCount',
                width: 44,
                align: 'center',
                render: (n) => (n != null ? n : '—'),
              },
              {
                title: '更新',
                dataIndex: 'updatedAt',
                width: 88,
                ellipsis: true,
                render: (ms) => <span style={{ fontSize: 11 }}>{formatUpdated(ms)}</span>,
              },
              {
                title: '',
                key: 'actions',
                width: 108,
                render: (_, row) => (
                  <Space size={0}>
                    <Tooltip title="打开">
                      <Button
                        type="text"
                        size="small"
                        icon={<FolderOpenOutlined />}
                        onClick={() => loadPipeline(row.id)}
                      />
                    </Tooltip>
                    <Tooltip title="重命名">
                      <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openRenameModal(row)} />
                    </Tooltip>
                    <Tooltip title="复制为新流程">
                      <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => openDuplicateModal(row)} />
                    </Tooltip>
                    <Popconfirm
                      title="确定删除该流程？"
                      description="删除后不可恢复"
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => deletePipelineById(row.id)}
                    >
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="删除" />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </div>
        <style>{`
          .pipeline-row-active td { background: #e6f7ff !important; }
        `}</style>
      </Sider>
      
      <Layout>
        <Content style={{ display: 'flex', flexDirection: 'column', background: '#fff' }}>
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space size="large">
              <Input value={pipelineName} onChange={(e) => setPipelineName(e.target.value)} variant="borderless" style={{ fontSize: 18, fontWeight: 'bold', width: 250 }} />
            </Space>
            <Space>
              <Button icon={<ColumnWidthOutlined />} onClick={handleAutoLayout} disabled={nodes.length === 0}>一键排列</Button>
              <Button icon={<PlayCircleOutlined />} onClick={() => setIsTestModalOpen(true)} disabled={!pipelineId} style={{ color: '#faad14', borderColor: '#faad14' }}>运行测试</Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={savePipeline}>保存发布</Button>
            </Space>
          </div>
          
          <div style={{ flex: 1, position: 'relative' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              deleteKeyCode={['Backspace', 'Delete']}
            >
              <Background color="#aaa" gap={20} />
              <Controls />
            </ReactFlow>
          </div>
        </Content>
      </Layout>

      <Modal
        title={getModalTitle()}
        open={isModalOpen}
        onOk={handleUpdateNode}
        onCancel={() => setIsModalOpen(false)}
        footer={[
          <Popconfirm key="delete" title="确定删除此节点吗？" onConfirm={deleteNode} okText="确定" cancelText="取消">
            <Button danger icon={<DeleteOutlined />} style={{ float: 'left' }}>删除节点</Button>
          </Popconfirm>,
          <Button key="back" onClick={() => setIsModalOpen(false)}>取消</Button>,
          <Button key="submit" type="primary" onClick={handleUpdateNode}>保存配置</Button>,
        ]}
      >
        {isCurrentRuleNode ? (
          <div style={{ padding: '10px 0' }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>规则类型:</label>
              <Select style={{ width: '100%' }} value={selectedTypeId} onChange={(v) => { setSelectedTypeId(v); setFilteredRules(allRules.filter(r => r.ruleTypeId === v)); }}>
                {allRuleTypes.map(t => <Option key={t.id} value={t.id}>{t.name}</Option>)}
              </Select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8 }}>具体规则:</label>
              <Select showSearch style={{ width: '100%' }} value={selectedRuleCode} onChange={setSelectedRuleCode}>
                {filteredRules.map(r => <Option key={r.id} value={r.code}>{r.name}</Option>)}
              </Select>
            </div>
          </div>
        ) : isCurrentConditionNode ? (
          <div style={{ padding: '10px 0' }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>依据哪个节点的执行结果?</label>
              <Select style={{ width: '100%' }} value={conditionConfig.refNodeId} onChange={(v) => setConditionConfig({...conditionConfig, refNodeId: v})}>
                {nodes.filter(n => n.type === 'rule').map(n => <Option key={n.id} value={n.id}>{n.data.label} ({n.id})</Option>)}
              </Select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8 }}>判断条件:</label>
              <Radio.Group value={conditionConfig.expected} onChange={(e) => setConditionConfig({...conditionConfig, expected: e.target.value})}>
                <Radio value="matched">如果该规则：命中 (Matched)</Radio>
                <Radio value="not_matched">如果该规则：未命中 (Not Matched)</Radio>
              </Radio.Group>
            </div>
          </div>
        ) : (
          <div style={{ padding: '10px 0' }}>
            {currentNode?.type === 'service_task' && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 8 }}>调用方式:</label>
                  <Radio.Group value={nodeConfig.callType || 'http'} onChange={(e) => setNodeConfig({ ...nodeConfig, callType: e.target.value })}>
                    <Radio value="http">HTTP 调用</Radio>
                    <Radio value="bean">Spring Bean</Radio>
                  </Radio.Group>
                </div>
                {nodeConfig.callType === 'bean' ? (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', marginBottom: 8 }}>Bean 名称:</label>
                      <Input value={nodeConfig.beanName || ''} onChange={(e) => setNodeConfig({ ...nodeConfig, beanName: e.target.value })} placeholder="例如: myService" />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', marginBottom: 8 }}>方法名:</label>
                      <Input value={nodeConfig.methodName || ''} onChange={(e) => setNodeConfig({ ...nodeConfig, methodName: e.target.value })} placeholder="例如: doSomething" />
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', marginBottom: 8 }}>URL:</label>
                      <Input value={nodeConfig.url || ''} onChange={(e) => setNodeConfig({ ...nodeConfig, url: e.target.value })} placeholder="http://..." />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', marginBottom: 8 }}>Method:</label>
                      <Select style={{ width: '100%' }} value={nodeConfig.method || 'POST'} onChange={(v) => setNodeConfig({ ...nodeConfig, method: v })}>
                        <Option value="GET">GET</Option>
                        <Option value="POST">POST</Option>
                        <Option value="PUT">PUT</Option>
                        <Option value="DELETE">DELETE</Option>
                      </Select>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', marginBottom: 8 }}>Headers (JSON):</label>
                      <Input.TextArea rows={3} value={nodeConfig.headers || ''} onChange={(e) => setNodeConfig({ ...nodeConfig, headers: e.target.value })} placeholder='{"Content-Type": "application/json"}' />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', marginBottom: 8 }}>Body:</label>
                      <Input.TextArea rows={4} value={nodeConfig.body || ''} onChange={(e) => setNodeConfig({ ...nodeConfig, body: e.target.value })} />
                    </div>
                  </>
                )}
              </>
            )}
            {currentNode?.type === 'script_task' && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 8 }}>脚本类型:</label>
                  <Radio.Group value={nodeConfig.scriptType || 'groovy'} onChange={(e) => setNodeConfig({ ...nodeConfig, scriptType: e.target.value })}>
                    <Radio value="groovy">Groovy</Radio>
                    <Radio value="spel">SpEL</Radio>
                  </Radio.Group>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 8 }}>脚本内容:</label>
                  <Input.TextArea rows={8} value={nodeConfig.script || ''} onChange={(e) => setNodeConfig({ ...nodeConfig, script: e.target.value })} placeholder="// 输入脚本..." />
                </div>
              </>
            )}
            {currentNode?.type === 'delay_task' && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 8 }}>延时秒数:</label>
                  <InputNumber style={{ width: '100%' }} min={0} value={nodeConfig.delaySeconds || 0} onChange={(v) => setNodeConfig({ ...nodeConfig, delaySeconds: v })} />
                </div>
              </>
            )}
            {currentNode?.type === 'agent_task' && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 8 }}>智能体类型:</label>
                  <Radio.Group value={nodeConfig.agentType || 'llm'} onChange={(e) => setNodeConfig({ ...nodeConfig, agentType: e.target.value })}>
                    <Radio value="llm">大模型 (LLM)</Radio>
                    <Radio value="dify">Dify 工作流</Radio>
                  </Radio.Group>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 8 }}>Base URL:</label>
                  <Input value={nodeConfig.baseUrl || ''} onChange={(e) => setNodeConfig({ ...nodeConfig, baseUrl: e.target.value })} placeholder={nodeConfig.agentType === 'dify' ? 'https://api.dify.ai/v1' : 'https://api.openai.com/v1'} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 8 }}>API Key:</label>
                  <Input.Password value={nodeConfig.apiKey || ''} onChange={(e) => setNodeConfig({ ...nodeConfig, apiKey: e.target.value })} />
                </div>
                {nodeConfig.agentType === 'dify' ? (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', marginBottom: 8 }}>Workflow ID:</label>
                      <Input value={nodeConfig.workflowId || ''} onChange={(e) => setNodeConfig({ ...nodeConfig, workflowId: e.target.value })} />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', marginBottom: 8 }}>Inputs (JSON):</label>
                      <Input.TextArea rows={4} value={nodeConfig.inputs || ''} onChange={(e) => setNodeConfig({ ...nodeConfig, inputs: e.target.value })} placeholder='{"key": "value"}' />
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', marginBottom: 8 }}>模型:</label>
                      <Input value={nodeConfig.model || ''} onChange={(e) => setNodeConfig({ ...nodeConfig, model: e.target.value })} placeholder="例如: gpt-4" />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', marginBottom: 8 }}>Prompt:</label>
                      <Input.TextArea rows={6} value={nodeConfig.prompt || ''} onChange={(e) => setNodeConfig({ ...nodeConfig, prompt: e.target.value })} />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', marginBottom: 8 }}>Temperature:</label>
                      <InputNumber style={{ width: '100%' }} min={0} max={2} step={0.1} value={nodeConfig.temperature || 0.7} onChange={(v) => setNodeConfig({ ...nodeConfig, temperature: v })} />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', marginBottom: 8 }}>Max Tokens:</label>
                      <InputNumber style={{ width: '100%' }} min={1} value={nodeConfig.maxTokens || 2048} onChange={(v) => setNodeConfig({ ...nodeConfig, maxTokens: v })} />
                    </div>
                  </>
                )}
              </>
            )}
            {currentNode?.type === 'human_task' && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 8 }}>任务名称:</label>
                  <Input value={nodeConfig.taskName || ''} onChange={(e) => setNodeConfig({ ...nodeConfig, taskName: e.target.value })} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 8 }}>描述:</label>
                  <Input.TextArea rows={3} value={nodeConfig.description || ''} onChange={(e) => setNodeConfig({ ...nodeConfig, description: e.target.value })} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 8 }}>处理人:</label>
                  <Input value={nodeConfig.assignee || ''} onChange={(e) => setNodeConfig({ ...nodeConfig, assignee: e.target.value })} placeholder="用户ID或角色" />
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal title="配置测试入参" open={isTestModalOpen} onOk={() => testForm.submit()} onCancel={() => setIsTestModalOpen(false)}>
        <Form form={testForm} layout="vertical" onFinish={handleRunTest}>
          <Form.Item label="诊断名称 (diagName)" name="diagName"><Input /></Form.Item>
          <Form.Item label="手术史 (opOperName)" name="opOperName"><Input /></Form.Item>
          <Form.Item label="年龄 (age)" name="age"><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="出血史 (bleeding_history)" name="bleeding_history"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title="重命名流程"
        open={renameModalOpen}
        onOk={submitRename}
        onCancel={() => setRenameModalOpen(false)}
        destroyOnClose
      >
        <Form form={renameForm} layout="vertical" preserve={false}>
          <Form.Item label="显示名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="流程在列表中的名称" maxLength={120} />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>流程编码（文件 id）不变：{renameTarget?.id}</Text>
        </Form>
      </Modal>

      <Modal
        title="复制为新流程"
        open={duplicateModalOpen}
        onOk={submitDuplicate}
        onCancel={() => setDuplicateModalOpen(false)}
        destroyOnClose
      >
        <Form form={duplicateForm} layout="vertical" preserve={false}>
          <Form.Item
            label="新流程编码"
            name="newId"
            rules={[{ required: true, message: '请输入编码' }]}
            extra="用于保存文件名，仅字母、数字、下划线、点、横线"
          >
            <Input placeholder="例如 my_pipeline_v2" maxLength={80} />
          </Form.Item>
          <Form.Item label="显示名称" name="newName" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="列表中显示的名称" maxLength={120} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer title="执行结果" open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} width={500}>
        {executing ? <Empty description="执行中..." /> : (
          <div>
             {execResult && (
               <Alert 
                 type={execResult.status === 'COMPLETED' ? 'success' : 'error'} 
                 message={execResult.status === 'COMPLETED' ? '流程执行完毕' : '流程执行中断'} 
                 style={{ marginBottom: 20 }}
               />
             )}
             {execResult && Object.entries(execResult.node_results).map(([id, res]) => (
               <Card key={id} size="small" style={{ marginBottom: 10 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <b>节点: {nodes.find(n => n.id === id)?.data?.label || id}</b>
                    <Tag color={res.error ? 'red' : res.matched ? 'green' : 'blue'}>
                      {res.error ? '报错' : res.matched ? '命中' : '未命中'}
                    </Tag>
                 </div>
                 {res.results && <div style={{ fontSize: '12px', marginTop: '5px', color: '#666' }}>结果: {JSON.stringify(res.results)}</div>}
               </Card>
             ))}
          </div>
        )}
      </Drawer>
    </Layout>
  );
};

export default PipelineDesigner;
