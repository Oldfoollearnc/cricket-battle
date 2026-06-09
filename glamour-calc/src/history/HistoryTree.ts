/**
 * HistoryTree - 计算历史 DAG 管理
 * 支持提交快照、回溯到任意历史节点、从历史节点分叉新路径
 * 使用树形结构存储，每个节点持有其时刻的画布完整快照
 * 支持路径对比：比较两条分叉路径上同一节点的输出差异
 *
 * HistoryTreeClass 封装为可实例化类，避免全局单例共享状态
 */

import { HistoryNode, SerializedCanvas, PathDiffResult, NodeDiff, Value } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class HistoryTreeClass {
  private historyNodes: HistoryNode[] = [];
  private currentId: string | null = null;

  /** 获取当前历史节点 */
  getCurrent(): HistoryNode | null {
    if (!this.currentId) return null;
    return this.historyNodes.find((n) => n.id === this.currentId) ?? null;
  }

  /** 获取所有历史节点 */
  getAllNodes(): HistoryNode[] {
    return [...this.historyNodes];
  }

  /** 提交一个新的快照节点 */
  commit(snapshot: SerializedCanvas, label?: string): HistoryNode {
    const node: HistoryNode = {
      id: uuidv4(),
      parentId: this.currentId,
      snapshot,
      timestamp: Date.now(),
      label,
    };
    this.historyNodes.push(node);
    this.currentId = node.id;
    return node;
  }

  /** 回溯到指定历史节点，返回其快照 */
  checkout(nodeId: string): SerializedCanvas | null {
    const node = this.historyNodes.find((n) => n.id === nodeId);
    if (!node) return null;
    this.currentId = nodeId;
    return node.snapshot;
  }

  /** 从指定历史节点分叉出新路径 */
  fork(nodeId: string, label?: string): HistoryNode | null {
    const sourceNode = this.historyNodes.find((n) => n.id === nodeId);
    if (!sourceNode) return null;

    const newNode: HistoryNode = {
      id: uuidv4(),
      parentId: nodeId,
      snapshot: sourceNode.snapshot,
      timestamp: Date.now(),
      label: label ?? `分叉自 ${sourceNode.label ?? nodeId.slice(0, 8)}`,
    };
    this.historyNodes.push(newNode);
    this.currentId = newNode.id;
    return newNode;
  }

  /** 获取两个节点之间的路径（从 fromId 到 toId 的祖先链） */
  getPath(fromId: string, toId: string): HistoryNode[] {
    // 构建从 fromId 到根的路径集合
    const ancestors = new Set<string>();
    let current = this.historyNodes.find((n) => n.id === fromId);
    while (current) {
      ancestors.add(current.id);
      current = current.parentId
        ? this.historyNodes.find((n) => n.id === current!.parentId)
        : undefined;
    }

    // 从 toId 向上走，直到碰到 ancestors 中的节点
    const path: HistoryNode[] = [];
    let target = this.historyNodes.find((n) => n.id === toId);
    while (target) {
      path.push(target);
      if (ancestors.has(target.id)) break;
      target = target.parentId
        ? this.historyNodes.find((n) => n.id === target!.parentId)
        : undefined;
    }

    path.reverse();
    return path;
  }

  /** 清空历史 */
  clearHistory(): void {
    this.historyNodes = [];
    this.currentId = null;
  }

  /** 获取历史节点数量 */
  size(): number {
    return this.historyNodes.length;
  }

  /**
   * 对比两条路径上同一节点的输出差异
   * pathA 和 pathB 是历史节点 ID，从它们向上找到公共祖先，然后对比
   */
  diffPaths(pathAId: string, pathBId: string): PathDiffResult | null {
    const pathA = this.historyNodes.find((n) => n.id === pathAId);
    const pathB = this.historyNodes.find((n) => n.id === pathBId);
    if (!pathA || !pathB) return null;

    // 收集路径 A 上所有节点的输出（沿祖先链）
    const outputsA = this.collectPathOutputs(pathAId);
    const outputsB = this.collectPathOutputs(pathBId);

    // 找出两条路径上共有的节点 ID，对比输出
    const allNodeIds = new Set([...outputsA.keys(), ...outputsB.keys()]);
    const nodeDiffs: NodeDiff[] = [];

    for (const nodeId of allNodeIds) {
      const outA = outputsA.get(nodeId);
      const outB = outputsB.get(nodeId);

      if (!outA || !outB) {
        // 只在一条路径上存在的节点
        nodeDiffs.push({
          nodeId,
          nodeType: 'unknown',
          outputsA: outA ?? new Map(),
          outputsB: outB ?? new Map(),
          hasDifference: true,
        });
        continue;
      }

      // 对比输出值
      let hasDifference = false;
      const allKeys = new Set([...outA.keys(), ...outB.keys()]);
      for (const key of allKeys) {
        const valA = outA.get(key);
        const valB = outB.get(key);
        if (JSON.stringify(valA) !== JSON.stringify(valB)) {
          hasDifference = true;
          break;
        }
      }

      nodeDiffs.push({
        nodeId,
        nodeType: 'unknown',
        outputsA: outA,
        outputsB: outB,
        hasDifference,
      });
    }

    return {
      pathA: [pathAId],
      pathB: [pathBId],
      nodeDiffs,
    };
  }

  /**
   * 收集从指定历史节点向上到根的所有节点输出
   * 返回 nodeId -> outputs 的映射
   */
  private collectPathOutputs(historyNodeId: string): Map<string, Map<string, Value>> {
    const result = new Map<string, Map<string, Value>>();
    let current = this.historyNodes.find((n) => n.id === historyNodeId);

    while (current) {
      // 从快照中提取节点输出
      for (const node of current.snapshot.nodes) {
        if (!result.has(node.id)) {
          result.set(node.id, new Map(Object.entries(node.outputs)));
        }
      }
      current = current.parentId
        ? this.historyNodes.find((n) => n.id === current!.parentId)
        : undefined;
    }

    return result;
  }

  /**
   * 获取历史 DAG 的分支信息
   * 返回每个分支的端点（叶子节点）列表
   */
  getBranches(): HistoryNode[] {
    // 找出所有没有子节点的历史节点（叶子节点）
    const childIds = new Set<string>();
    for (const node of this.historyNodes) {
      if (node.parentId) {
        childIds.add(node.parentId);
      }
    }
    return this.historyNodes.filter((n) => !childIds.has(n.id));
  }
}

/** 工厂函数：创建全新的 HistoryTree 实例 */
export function createHistoryTree(): HistoryTreeClass {
  return new HistoryTreeClass();
}
