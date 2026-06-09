/**
 * HistoryTree - 计算历史 DAG 管理
 * 支持提交快照、回溯到任意历史节点、从历史节点分叉新路径
 * 使用树形结构存储，每个节点持有其时刻的画布完整快照
 */

import { HistoryNode, SerializedCanvas } from '../types';
import { v4 as uuidv4 } from 'uuid';

let historyNodes: HistoryNode[] = [];
let currentId: string | null = null;

/** 获取当前历史节点 */
export function getCurrent(): HistoryNode | null {
  if (!currentId) return null;
  return historyNodes.find((n) => n.id === currentId) ?? null;
}

/** 获取所有历史节点 */
export function getAllNodes(): HistoryNode[] {
  return [...historyNodes];
}

/** 提交一个新的快照节点 */
export function commit(snapshot: SerializedCanvas, label?: string): HistoryNode {
  const node: HistoryNode = {
    id: uuidv4(),
    parentId: currentId,
    snapshot,
    timestamp: Date.now(),
    label,
  };
  historyNodes.push(node);
  currentId = node.id;
  return node;
}

/** 回溯到指定历史节点，返回其快照 */
export function checkout(nodeId: string): SerializedCanvas | null {
  const node = historyNodes.find((n) => n.id === nodeId);
  if (!node) return null;
  currentId = nodeId;
  return node.snapshot;
}

/** 从指定历史节点分叉出新路径 */
export function fork(nodeId: string, label?: string): HistoryNode | null {
  const sourceNode = historyNodes.find((n) => n.id === nodeId);
  if (!sourceNode) return null;

  const newNode: HistoryNode = {
    id: uuidv4(),
    parentId: nodeId,
    snapshot: sourceNode.snapshot,
    timestamp: Date.now(),
    label: label ?? `分叉自 ${sourceNode.label ?? nodeId.slice(0, 8)}`,
  };
  historyNodes.push(newNode);
  currentId = newNode.id;
  return newNode;
}

/** 获取两个节点之间的路径（从 fromId 到 toId 的祖先链） */
export function getPath(fromId: string, toId: string): HistoryNode[] {
  // 构建从 fromId 到根的路径集合
  const ancestors = new Set<string>();
  let current = historyNodes.find((n) => n.id === fromId);
  while (current) {
    ancestors.add(current.id);
    current = current.parentId
      ? historyNodes.find((n) => n.id === current!.parentId)
      : undefined;
  }

  // 从 toId 向上走，直到碰到 ancestors 中的节点
  const path: HistoryNode[] = [];
  let target = historyNodes.find((n) => n.id === toId);
  while (target) {
    path.push(target);
    if (ancestors.has(target.id)) break;
    target = target.parentId
      ? historyNodes.find((n) => n.id === target!.parentId)
      : undefined;
  }

  path.reverse();
  return path;
}

/** 清空历史（测试用） */
export function clearHistory(): void {
  historyNodes = [];
  currentId = null;
}

/** 获取历史节点数量 */
export function size(): number {
  return historyNodes.length;
}
