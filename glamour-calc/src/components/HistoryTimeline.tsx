/**
 * HistoryTimeline - 可视化历史时间线组件
 * 显示历史 DAG 的树形结构，支持：
 * - 拖拽回溯到任意历史节点
 * - 分支可视化
 * - 路径对比
 * - 当前位置指示
 */

import React, { useMemo, useCallback, useState } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { useHistoryStore } from '../store/historyStore';
import { HistoryNode } from '../types';

const TIMELINE_HEIGHT = 140;
const NODE_RADIUS = 8;
const BRANCH_GAP = 28;

const HistoryTimeline: React.FC = () => {
  const { checkoutHistory, forkHistory } = useCanvasStore();
  const { getAllNodes, getCurrent, diffPaths } = useHistoryStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedForDiff, setSelectedForDiff] = useState<string[]>([]);

  const allNodes = getAllNodes();
  const current = getCurrent();

  // 构建 DAG 布局：每个节点有 x（水平位置）和 y（分支层级）
  const layout = useMemo(() => {
    if (allNodes.length === 0) return { nodes: [], maxBranch: 0 };

    const nodeMap = new Map<string, HistoryNode & { x: number; y: number; branch: number }>();
    const childrenMap = new Map<string, string[]>();

    // 构建子节点映射
    for (const node of allNodes) {
      if (node.parentId) {
        if (!childrenMap.has(node.parentId)) {
          childrenMap.set(node.parentId, []);
        }
        childrenMap.get(node.parentId)!.push(node.id);
      }
    }

    // BFS 布局
    let currentBranch = 0;
    const branchMap = new Map<string, number>();

    // 找根节点（没有 parentId 的）
    const roots = allNodes.filter((n) => !n.parentId);
    if (roots.length === 0) return { nodes: [], maxBranch: 0 };

    const queue: string[] = [];
    let xIndex = 0;

    for (const root of roots) {
      queue.push(root.id);
      branchMap.set(root.id, currentBranch);
      currentBranch++;
    }

    while (queue.length > 0) {
      const id = queue.shift()!;
      const node = allNodes.find((n) => n.id === id);
      if (!node) continue;

      const branch = branchMap.get(id) ?? 0;
      nodeMap.set(id, { ...node, x: xIndex, y: branch, branch });
      xIndex++;

      const children = childrenMap.get(id) ?? [];
      for (let i = 0; i < children.length; i++) {
        const childId = children[i];
        if (i === 0) {
          // 第一个子节点继承父分支
          branchMap.set(childId, branch);
        } else {
          // 后续子节点是新分支
          branchMap.set(childId, currentBranch);
          currentBranch++;
        }
        queue.push(childId);
      }
    }

    return {
      nodes: Array.from(nodeMap.values()),
      maxBranch: currentBranch,
    };
  }, [allNodes]);

  const handleNodeClick = useCallback((nodeId: string) => {
    if (selectedForDiff.length === 1 && selectedForDiff[0] !== nodeId) {
      // 第二个选择 -> 执行对比
      const diff = diffPaths(selectedForDiff[0], nodeId);
      if (diff) {
        const changedCount = diff.nodeDiffs.filter((d) => d.hasDifference).length;
        alert(`路径对比：${changedCount} 个节点有差异`);
      }
      setSelectedForDiff([]);
    } else {
      // 单击回溯
      checkoutHistory(nodeId);
      setSelectedForDiff([]);
    }
  }, [checkoutHistory, selectedForDiff]);

  const handleFork = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    forkHistory(nodeId, `分叉 ${new Date().toLocaleTimeString()}`);
  }, [forkHistory]);

  const handleDiffSelect = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedForDiff((prev) => {
      if (prev.includes(nodeId)) return prev.filter((id) => id !== nodeId);
      if (prev.length >= 2) return [nodeId];
      return [...prev, nodeId];
    });
  }, []);

  if (allNodes.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>暂无历史快照，点击"保存快照"开始记录</div>
      </div>
    );
  }

  const { nodes: layoutNodes, maxBranch } = layout;
  const svgWidth = Math.max(400, layoutNodes.length * 60 + 80);
  const svgHeight = Math.max(80, (maxBranch + 1) * BRANCH_GAP + 40);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>计算历史</span>
        {selectedForDiff.length > 0 && (
          <span style={styles.diffHint}>
            已选 {selectedForDiff.length}/2 个节点进行对比
          </span>
        )}
      </div>
      <div style={styles.scrollArea}>
        <svg
          width={svgWidth}
          height={svgHeight}
          style={{ minWidth: svgWidth }}
        >
          {/* 绘制连线 */}
          {layoutNodes.map((node) => {
            if (!node.parentId) return null;
            const parent = layoutNodes.find((n) => n.id === node.parentId);
            if (!parent) return null;

            const x1 = 30 + parent.x * 60;
            const y1 = 20 + parent.y * BRANCH_GAP;
            const x2 = 30 + node.x * 60;
            const y2 = 20 + node.y * BRANCH_GAP;

            // 如果是分叉（分支不同），画曲线
            if (parent.branch !== node.branch) {
              const midX = (x1 + x2) / 2;
              return (
                <path
                  key={`edge-${node.id}`}
                  d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke="#3a3a4e"
                  strokeWidth={2}
                />
              );
            }

            return (
              <line
                key={`edge-${node.id}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#3a3a4e"
                strokeWidth={2}
              />
            );
          })}

          {/* 绘制节点 */}
          {layoutNodes.map((node) => {
            const cx = 30 + node.x * 60;
            const cy = 20 + node.y * BRANCH_GAP;
            const isCurrent = current?.id === node.id;
            const isHovered = hoveredId === node.id;
            const isSelectedForDiff = selectedForDiff.includes(node.id);

            let fillColor = '#3a3a4e';
            if (isCurrent) fillColor = '#6c5ce7';
            else if (isSelectedForDiff) fillColor = '#e17055';
            else if (isHovered) fillColor = '#555577';

            return (
              <g key={node.id}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isCurrent ? NODE_RADIUS + 2 : NODE_RADIUS}
                  fill={fillColor}
                  stroke={isCurrent ? '#a29bfe' : 'transparent'}
                  strokeWidth={2}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => handleNodeClick(node.id)}
                  onContextMenu={(e) => handleFork(node.id, e as unknown as React.MouseEvent)}
                />
                {/* 分叉按钮 */}
                {isHovered && !isCurrent && (
                  <text
                    x={cx}
                    y={cy - 14}
                    textAnchor="middle"
                    fill="#e17055"
                    fontSize={10}
                    style={{ cursor: 'pointer', pointerEvents: 'all' }}
                    onClick={(e) => handleFork(node.id, e as unknown as React.MouseEvent)}
                  >
                    分叉
                  </text>
                )}
                {/* 对比选择按钮 */}
                {isHovered && (
                  <text
                    x={cx}
                    y={cy + 20}
                    textAnchor="middle"
                    fill="#00cec9"
                    fontSize={9}
                    style={{ cursor: 'pointer', pointerEvents: 'all' }}
                    onClick={(e) => handleDiffSelect(node.id, e as unknown as React.MouseEvent)}
                  >
                    对比
                  </text>
                )}
                {/* 标签 */}
                {node.label && (
                  <text
                    x={cx}
                    y={cy + 16 + (isHovered ? 12 : 0)}
                    textAnchor="middle"
                    fill="#888"
                    fontSize={9}
                    style={{ pointerEvents: 'none' }}
                  >
                    {node.label.length > 8 ? node.label.slice(0, 8) + '...' : node.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: TIMELINE_HEIGHT,
    background: '#0f0f1a',
    borderTop: '1px solid #2a2a3e',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 16px',
    borderBottom: '1px solid #1a1a2e',
  },
  title: {
    color: '#6c5ce7',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  diffHint: {
    color: '#e17055',
    fontSize: 11,
  },
  scrollArea: {
    flex: 1,
    overflowX: 'auto',
    overflowY: 'hidden',
    padding: '8px 16px',
  },
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#555',
    fontSize: 12,
  },
};

export default HistoryTimeline;
