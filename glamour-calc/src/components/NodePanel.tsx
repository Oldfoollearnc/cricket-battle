/**
 * NodePanel - 节点属性面板
 * 选中节点后显示在右侧，可编辑输入端口的值
 * 显示节点信息、输入/输出端口、当前值
 */

import React, { useCallback } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { getNodeDefinition } from '../engine/NodeRegistry';

const NodePanel: React.FC = () => {
  const { nodes, selectedNodeId, setNodeInput, removeNode } = useCanvasStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const def = selectedNode ? getNodeDefinition(selectedNode.type) : undefined;

  const handleInputChange = useCallback(
    (portName: string, value: string) => {
      if (!selectedNodeId) return;
      const numVal = parseFloat(value);
      setNodeInput(selectedNodeId, portName, isNaN(numVal) ? value : numVal);
    },
    [selectedNodeId, setNodeInput]
  );

  const handleDelete = useCallback(() => {
    if (selectedNodeId) removeNode(selectedNodeId);
  }, [selectedNodeId, removeNode]);

  if (!selectedNode || !def) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>点击节点查看属性</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={{ color: def.color, fontWeight: 'bold' }}>{def.label}</span>
        <span style={styles.type}>{def.type}</span>
      </div>

      {/* 输入端口 */}
      {def.inputPorts.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>输入</div>
          {def.inputPorts.map((port) => (
            <div key={port.name} style={styles.portRow}>
              <label style={styles.portLabel}>{port.name}</label>
              <input
                style={styles.input}
                type="text"
                value={String(selectedNode.inputs.get(port.name) ?? '')}
                onChange={(e) => handleInputChange(port.name, e.target.value)}
                placeholder={port.required ? '必填' : '可选'}
              />
            </div>
          ))}
        </div>
      )}

      {/* 输出端口 */}
      {def.outputPorts.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>输出</div>
          {def.outputPorts.map((port) => (
            <div key={port.name} style={styles.portRow}>
              <span style={styles.portLabel}>{port.name}</span>
              <span style={styles.portValue}>
                {selectedNode.outputs.has(port.name)
                  ? String(selectedNode.outputs.get(port.name))
                  : '-'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 状态 */}
      {selectedNode.status !== 'idle' && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>状态</div>
          <div style={{ ...styles.statusBadge, ...statusStyle(selectedNode.status) }}>
            {selectedNode.status}
          </div>
          {selectedNode.error && (
            <div style={styles.errorText}>{selectedNode.error}</div>
          )}
        </div>
      )}

      {/* 删除按钮 */}
      <button style={styles.deleteBtn} onClick={handleDelete}>
        删除节点
      </button>
    </div>
  );
};

function statusStyle(status: string): React.CSSProperties {
  switch (status) {
    case 'computing': return { background: '#6c5ce7' };
    case 'error': return { background: '#d63031' };
    case 'done': return { background: '#00b894' };
    default: return { background: '#3a3a4e' };
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 240,
    background: '#1a1a2e',
    borderLeft: '1px solid #2a2a3e',
    padding: '16px',
    overflowY: 'auto',
    color: '#fff',
    fontSize: 13,
  },
  empty: {
    color: '#666',
    textAlign: 'center',
    marginTop: 40,
  },
  header: {
    marginBottom: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  type: {
    color: '#666',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 8,
  },
  portRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  portLabel: {
    color: '#aaa',
    fontSize: 12,
    flex: '0 0 60px',
  },
  portValue: {
    color: '#00cec9',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  input: {
    flex: 1,
    background: '#0f0f1a',
    border: '1px solid #3a3a4e',
    borderRadius: 4,
    color: '#fff',
    padding: '4px 8px',
    fontSize: 12,
    outline: 'none',
    marginLeft: 8,
  },
  statusBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    color: '#fff',
  },
  errorText: {
    color: '#d63031',
    fontSize: 11,
    marginTop: 4,
  },
  deleteBtn: {
    width: '100%',
    padding: '8px',
    background: '#d63031',
    border: 'none',
    borderRadius: 6,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    marginTop: 8,
  },
};

export default NodePanel;
