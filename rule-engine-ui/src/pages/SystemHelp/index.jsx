import React from 'react'

const styles = {
  container: {
    height: '100%', overflow: 'auto', background: '#f5f5f5', padding: 24,
  },
  paper: {
    maxWidth: 900, margin: '0 auto', background: '#fff',
    borderRadius: 6, padding: 32, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  h1: { fontSize: 24, fontWeight: 'bold', marginBottom: 8, color: '#1a1a1a' },
  h2: { fontSize: 18, fontWeight: 'bold', marginTop: 32, marginBottom: 12, color: '#1a1a1a', paddingBottom: 6, borderBottom: '1px solid #f0f0f0' },
  h3: { fontSize: 15, fontWeight: 'bold', marginTop: 24, marginBottom: 8, color: '#333' },
  p: { fontSize: 14, lineHeight: 1.8, color: '#444', marginBottom: 12 },
  code: { background: '#f6f8fa', padding: '2px 6px', borderRadius: 3, fontSize: 13, color: '#d63384', fontFamily: 'Menlo, monospace' },
  pre: { background: '#f6f8fa', padding: 16, borderRadius: 4, fontSize: 13, lineHeight: 1.6, overflow: 'auto', marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 14 },
  th: { border: '1px solid #e8e8e8', padding: '10px 14px', background: '#fafafa', fontWeight: 'bold', textAlign: 'left' },
  td: { border: '1px solid #e8e8e8', padding: '10px 14px' },
  box: { background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 4, padding: 16, marginBottom: 16 },
  arrowBox: { textAlign: 'center', padding: '8px 0', color: '#999', fontSize: 20 },
  layer: { textAlign: 'center', padding: 16, borderRadius: 6, fontWeight: 'bold', fontSize: 15 },
}

const layers = [
  { label: '临床大路径（Clinical Pathway）', desc: '业务管理层 — 阶段 + 任务', color: '#e6f7ff', border: '#91d5ff' },
  { label: '流程编排（Process DAG）', desc: '可执行工作流层 — 画布节点 + 连线', color: '#f6ffed', border: '#b7eb8f' },
  { label: '规则引擎（Drools DRL）', desc: '原子能力层 — 条件 + 动作', color: '#fff7e6', border: '#ffd591' },
]

export default function SystemHelp() {
  return (
    <div style={styles.container}>
      <div style={styles.paper}>
        <h1 style={styles.h1}>系统架构说明</h1>
        <p style={{ ...styles.p, color: '#888', marginBottom: 24 }}>规则引擎 · 流程编排 · 临床大路径 — 三层架构关系</p>

        <h2 style={styles.h2}>三层架构总览</h2>
        <p style={styles.p}>
          系统从底至上分为三个层次，底层为上层提供能力，上层通过配置引用调用下层：
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
          {layers.map((l, i) => (
            <React.Fragment key={l.label}>
              <div style={{ ...styles.layer, background: l.color, border: `1px solid ${l.border}` }}>
                <div>{l.label}</div>
                <div style={{ fontWeight: 'normal', fontSize: 13, marginTop: 4, color: '#666' }}>{l.desc}</div>
              </div>
              {i < layers.length - 1 && <div style={styles.arrowBox}>⬇ 引用调用 ⬇</div>}
            </React.Fragment>
          ))}
        </div>

        <h2 style={styles.h2}>各层职责</h2>

        <h3 style={styles.h3}>规则引擎（Drools DRL）</h3>
        <p style={styles.p}>
          执行单个规则，输入患者数据，输出匹配/不匹配结果。规则在 ReactFlow 画布上编排条件和动作，
          编译为 DRL 文本后由 <code style={styles.code}>KieContainer</code> 加载执行。
          是系统最底层的原子能力。
        </p>

        <h3 style={styles.h3}>流程编排（Process DAG）</h3>
        <p style={styles.p}>
          把规则节点、AI 调用（LLM/Dify）、外部服务调用、人工审批编排成一个<strong>有向无环图（DAG）工作流</strong>。
          在 ReactFlow 画布上拖拽连线，支持开始/结束、条件分支、并行汇聚。
          由 <code style={styles.code}>ProcessExecutionEngine</code> 驱动，按 BFS 遍历节点，
          每种节点类型有对应的 <code style={styles.code}>StepExecutor</code>：
        </p>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>执行器</th>
              <th style={styles.th}>节点类型</th>
              <th style={styles.th}>作用</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['RuleStepExecutor', 'RULE_TASK', '调用规则引擎执行规则'],
              ['ServiceStepExecutor', 'SERVICE_TASK', 'HTTP 调用或 Spring Bean 调用'],
              ['ScriptStepExecutor', 'SCRIPT_TASK', '执行 Groovy/SpEL 脚本'],
              ['DelayStepExecutor', 'DELAY_TASK', '等待指定时间'],
              ['AgentStepExecutor', 'AGENT_TASK', '调用智能体（Dify / 大模型）'],
              ['HumanStepExecutor', 'HUMAN_TASK', '挂起等待人工审批'],
            ].map(row => (
              <tr key={row[0]}>
                <td style={styles.td}><code style={styles.code}>{row[0]}</code></td>
                <td style={styles.td}>{row[1]}</td>
                <td style={styles.td}>{row[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 style={styles.h3}>临床大路径（Clinical Pathway）</h3>
        <p style={styles.p}>
          面向临床业务的管理模型。一个路径（如"急性心梗"）包含多个<strong>阶段</strong>（急诊→住院→康复→出院），
          每个阶段下有多个<strong>任务</strong>。路径本身不执行逻辑，而是通过引用关联到流程定义和规则，
          起到"编排调度"的作用。
        </p>

        <div style={styles.box}>
          <strong>💡 关键理解：</strong>
          临床大路径是<strong>业务视图</strong>（阶段+任务），流程编排是<strong>执行视图</strong>（DAG 节点+连线）。
          路径决定"什么时候做什么"，流程决定"具体怎么做"。
        </div>

        <h2 style={styles.h2}>实体关系与字段映射</h2>
        <p style={styles.p}>三个层次通过外键和字段引用串联：</p>

        <pre style={styles.pre}>{`ClinicalPathway
  ├── id (PK)
  ├── processDefId ────────────── FK ──→ ProcessDefinition.id
  ├── admissionRuleCode ───────── FK ──→ Rule.code（准入规则）
  │
  └── PathwayStage
        ├── id (PK)
        ├── pathwayId ─────────── FK ──→ ClinicalPathway.id
        ├── exitRuleCode ──────── FK ──→ Rule.code（阶段退出规则）
        │
        └── PathwayTask
              ├── id (PK)
              ├── stageId ─────── FK ──→ PathwayStage.id
              ├── processNodeId ──→ ProcessDefinition 画布中 node.id
              └── taskType ───────→ RULE / AGENT / HUMAN / ...`}</pre>

        <h2 style={styles.h2}>典型流转场景</h2>
        <p style={styles.p}>以"STEMI 急性心梗临床大路径"为例：</p>

        <ol style={{ ...styles.p, paddingLeft: 24 }}>
          <li style={{ marginBottom: 8 }}>
            <strong>定义路径</strong>：管理员创建"STEMI 临床大路径"，设置 4 个阶段（急诊→住院→康复→出院）
            和准入规则 <code style={styles.code}>admission_rule_stemi</code>
          </li>
          <li style={{ marginBottom: 8 }}>
            <strong>关联流程</strong>：路径引用一个"STEMI 诊疗流程"流程定义（ID），
            该流程在画布上编排了：执行胸痛评估规则 → 条件分支 → 调用 AI 解读心电图 → 并发执行药物治疗规则 → 人工心脏科会诊 → 结束
          </li>
          <li style={{ marginBottom: 8 }}>
            <strong>患者入径</strong>：患者入院，系统通过 <code style={styles.code}>admissionRuleCode</code> 评估准入规则，
            匹配后创建 <code style={styles.code}>PathwayInstance</code>
          </li>
          <li style={{ marginBottom: 8 }}>
            <strong>启动流程</strong>：进入某个阶段时，通过 <code style={styles.code}>processDefId</code>
            调用 <code style={styles.code}>ProcessInstanceService.start()</code> 启动流程
          </li>
          <li style={{ marginBottom: 8 }}>
            <strong>引擎执行</strong>：<code style={styles.code}>ProcessExecutionEngine</code> 遍历 DAG：
            RULE_TASK 调 Drools、CONDITION 判断分支、AGENT_TASK 调智能体、HUMAN_TASK 挂起等人
          </li>
          <li style={{ marginBottom: 8 }}>
            <strong>阶段切换</strong>：当前阶段的 <code style={styles.code}>exitRuleCode</code> 匹配时，
            路径转入下一阶段，重复步骤 4-5
          </li>
          <li style={{ marginBottom: 8 }}>
            <strong>路径结束</strong>：所有阶段完成后，路径标记为 COMPLETED
          </li>
        </ol>

        <h2 style={styles.h2}>快速入口</h2>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>功能</th>
              <th style={styles.th}>导航入口</th>
              <th style={styles.th}>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.td}>规则编辑器</td>
              <td style={styles.td}><code style={styles.code}>规则类型 → 新建/编辑</code></td>
              <td style={styles.td}>编排规则条件和动作，编译为 DRL</td>
            </tr>
            <tr>
              <td style={styles.td}>流程编排</td>
              <td style={styles.td}><code style={styles.code}>流程编排</code></td>
              <td style={styles.td}>拖拽 DAG 工作流，支持规则/AI/人工等节点</td>
            </tr>
            <tr>
              <td style={styles.td}>临床大路径</td>
              <td style={styles.td}><code style={styles.code}>临床大路径</code></td>
              <td style={styles.td}>管理路径、阶段、任务，关联流程定义</td>
            </tr>
            <tr>
              <td style={styles.td}>规则执行测试</td>
              <td style={styles.td}><code style={styles.code}>规则执行</code></td>
              <td style={styles.td}>单条规则的手动执行测试</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 32, padding: 16, background: '#f6f8fa', borderRadius: 4, fontSize: 13, color: '#888', textAlign: 'center' }}>
          本文档描述系统当前架构，随功能迭代可能更新
        </div>
      </div>
    </div>
  )
}
