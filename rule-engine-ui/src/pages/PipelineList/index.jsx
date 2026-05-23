import React, { useState, useCallback, useEffect } from 'react';
import { Button, Input, Modal, message, Space, Typography, Popconfirm, Form, Table, Tooltip, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, CopyOutlined, ReloadOutlined, FolderOpenOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Text } = Typography;

const PipelineList = () => {
  const [pipelineList, setPipelineList] = useState([]);
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameForm] = Form.useForm();
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateSourceId, setDuplicateSourceId] = useState('');
  const [duplicateForm] = Form.useForm();

  const fetchInitialData = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/processes');
      const raw = Array.isArray(res.data) ? res.data : (res.data.pipelines || []);
      const normalized = raw.map((p) =>
        typeof p === 'string'
          ? { id: p, name: p, nodeCount: 0, edgeCount: 0, updatedAt: 0, status: 'DRAFT' }
          : { ...p, id: p.id, name: p.name || p.id, status: p.status || 'DRAFT' }
      );
      setPipelineList(normalized);
    } catch (err) {
      message.error('加载流程列表失败');
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

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
      fetchInitialData();
    } catch (err) {
      if (err?.errorFields) return;
      const d = err?.response?.data?.detail;
      message.error(typeof d === 'string' ? d : '复制失败');
    }
  };

  const formatUpdated = (ms) => {
    if (!ms) return '—';
    try {
      const d = new Date(ms);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return '—';
    }
  };

  const getStatusTag = (status) => {
    const map = {
      DRAFT: { color: 'default', text: '草稿' },
      PUBLISHED: { color: 'success', text: '已发布' },
      DISABLED: { color: 'error', text: '已停用' },
    };
    const s = map[status] || { color: 'default', text: status };
    return <Tag color={s.color}>{s.text}</Tag>;
  };

  const filteredPipelines = pipelineList.filter((row) => {
    const q = pipelineSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (row.name || '').toLowerCase().includes(q) ||
      (row.id || '').toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: 'calc(100vh - 64px)' }}>
      <div style={{ background: '#fff', padding: 24, borderRadius: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>流程编排</h2>
            <Text type="secondary" style={{ fontSize: 12 }}>管理业务流程定义</Text>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => window.location.href = '/?page=pipelineEditor'}>
            新建流程
          </Button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <Input
            allowClear
            placeholder="按名称或编码筛选"
            value={pipelineSearch}
            onChange={(e) => setPipelineSearch(e.target.value)}
            style={{ width: 300 }}
          />
          <Tooltip title="刷新列表">
            <Button icon={<ReloadOutlined />} onClick={() => fetchInitialData()} />
          </Tooltip>
        </div>

        <Table
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          rowKey="id"
          dataSource={filteredPipelines}
          locale={{ emptyText: '暂无已存流程' }}
          columns={[
            {
              title: '流程名称',
              key: 'name',
              ellipsis: true,
              render: (_, row) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{row.name}</div>
                  <Text type="secondary" style={{ fontSize: 11 }}>{row.id}</Text>
                </div>
              ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 90,
              align: 'center',
              render: (status) => getStatusTag(status),
            },
            {
              title: '节点数',
              dataIndex: 'nodeCount',
              width: 70,
              align: 'center',
              render: (n) => (n != null ? n : '—'),
            },
            {
              title: '版本',
              dataIndex: 'version',
              width: 80,
              align: 'center',
              render: (v) => v || '1.0.0',
            },
            {
              title: '更新时间',
              dataIndex: 'updatedAt',
              width: 130,
              render: (ms) => <span style={{ fontSize: 12 }}>{formatUpdated(ms)}</span>,
            },
            {
              title: '操作',
              key: 'actions',
              width: 180,
              render: (_, row) => (
                <Space size={4}>
                  <Tooltip title="编辑">
                    <Button
                      type="text"
                      size="small"
                      icon={<FolderOpenOutlined />}
                      onClick={() => window.location.href = `/?page=pipelineEditor&id=${row.id}`}
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
    </div>
  );
};

export default PipelineList;
