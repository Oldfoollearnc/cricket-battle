/**
 * RecommendationPanel - 智能联想推荐面板
 * 根据当前选中节点，显示推荐的计算节点列表
 * 点击推荐项可快速添加节点并自动连线
 */

import React, { useMemo, useCallback } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { recommend, recordNodeUsage } from './RecommendationEngine';
import { getNodeDefinition } from '../engine/NodeRegistry';
import { NodeRecommendation, GraphContext } from '../types';
import { v4 as uuidv4 } from 'uuid';

const RecommendationPanel: React.FC = () => {
  const { nodes, connections, selectedNodeId, addNode, addConnection, executeAll } = useCanvasStore();

  const recommendations = useMemo((): NodeRecommendation[] => {
    if (!selectedNodeId) return [];

    const graphContext: GraphContext = {
      nodes,
      connections,
      nodeUsageStats: new Map(),
    };

    return recommend(selectedNodeId, graphContext);
  }, [selectedNodeId, nodes, connections]);

  const handleAddRecommended = useCallback(
    (rec: NodeRecommendation) => {
      if (!selectedNodeId) return;

      // 在选中节点附近添加新节点
      const selectedNode = nodes.find((n) => n.id === selectedNodeId);
      if (!selectedNode) return;

      const newX = selectedNode.position.x + 220;
      const newY = selectedNode.position.y + Math.random() * 40 - 20;

      const newNodeId = addNode(rec.nodeType, newX, newY);
      if (!newNodeId) return;

      // 自动连线
      if (rec.suggestedConnection) {
        const conn = {
          id: uuidv4(),
          sourceNodeId: selectedNodeId,
          sourcePort: rec.suggestedConnection.sourcePort,
          targetNodeId: newNodeId,
          targetPort: rec.suggestedConnection.targetPort,
        };
        addConnection(conn);
      }

      // 记录使用
      recordNodeUsage(rec.nodeType);

      // 重新执行
      executeAll();
    },
    [selectedNodeId, nodes, addNode, addConnection, executeAll]
  );

  if (!selectedNodeId || recommendations.length === 0) {
    return null;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>智能推荐</span>
      </div>
      <div style={styles.list}>
        {recommendations.map((rec) => {
          const def = getNodeDefinition(rec.nodeType);
          return (
            <button
              key={rec.nodeType}
              style={styles.item}
              onClick={() => handleAddRecommended(rec)}
              title={rec.reason}
            >
              <div style={styles.itemLeft}>
                <span
                  style={{
                    ...styles.nodeType,
                    color: def?.color ?? '#fff',
                  }}
                >
                  {def?.label ?? rec.nodeType}
                </span>
                <span style={styles.reason}>{rec.reason}</span>
              </div>
              <div style={styles.score}>
                {Math.round(rec.score * 100)}%
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    right: 256,
    top: 56,
    width: 200,
    background: '#1a1a2e',
    border: '1px solid #2a2a3e',
    borderRadius: 8,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    zIndex: 50,
    overflow: 'hidden',
  },
  header: {
    padding: '8px 12px',
    borderBottom: '1px solid #2a2a3e',
  },
  title: {
    color: '#6c5ce7',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  list: {
    maxHeight: 240,
    overflowY: 'auto',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '6px 12px',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid #0f0f1a',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.15s',
  },
  itemLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
    minWidth: 0,
  },
  nodeType: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  reason: {
    fontSize: 10,
    color: '#666',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  score: {
    color: '#00cec9',
    fontSize: 10,
    fontFamily: 'monospace',
    flexShrink: 0,
    marginLeft: 8,
  },
};

export default RecommendationPanel;
