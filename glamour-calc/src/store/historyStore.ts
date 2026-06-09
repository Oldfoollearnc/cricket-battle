/**
 * historyStore - 计算历史状态管理
 * 管理撤销/重做栈、分支切换、时间线导航
 * 基于 HistoryTree 模块的 DAG 历史结构
 * 支持：undo/redo、分支创建/切换、路径对比、自动快照
 */

import { create } from 'zustand';
import { HistoryNode, SerializedCanvas, PathDiffResult } from '../types';
import * as HistoryTree from '../history/HistoryTree';

/** 分支信息 */
export interface Branch {
  id: string;
  name: string;
  /** 分支的叶子节点 ID */
  leafNodeId: string;
  createdAt: number;
}

export interface HistoryState {
  /** 所有历史节点 */
  timeline: HistoryNode[];
  /** 当前所在的历史节点 */
  currentNodeId: string | null;
  /** 当前分支名 */
  currentBranch: string;
  /** 所有分支 */
  branches: Map<string, Branch>;
  /** 是否可以撤销 */
  canUndo: boolean;
  /** 是否可以重做 */
  canRedo: boolean;
  /** 路径对比结果 */
  diffResult: PathDiffResult | null;

  // 快照操作
  commit: (snapshot: SerializedCanvas, label?: string) => HistoryNode;
  checkout: (nodeId: string) => SerializedCanvas | null;

  // 撤销/重做
  undo: () => SerializedCanvas | null;
  redo: () => SerializedCanvas | null;

  // 分支管理
  createBranch: (name: string) => Branch | null;
  switchBranch: (branchId: string) => SerializedCanvas | null;
  deleteBranch: (branchId: string) => void;

  // 路径对比
  diffPaths: (nodeIdA: string, nodeIdB: string) => PathDiffResult | null;
  clearDiff: () => void;

  // 查询
  getCurrent: () => HistoryNode | null;
  getAllNodes: () => HistoryNode[];
  getBranches: () => Branch[];
  getSize: () => number;

  // 重置
  clearHistory: () => void;
  refreshTimeline: () => void;
}

/**
 * 计算 undo/redo 可用性
 * undo: 当前节点有父节点
 * redo: 当前节点有子节点（在同分支中）
 */
function computeUndoRedo(currentNodeId: string | null): { canUndo: boolean; canRedo: boolean } {
  if (!currentNodeId) return { canUndo: false, canRedo: false };

  const current = HistoryTree.getAllNodes().find((n) => n.id === currentNodeId);
  if (!current) return { canUndo: false, canRedo: false };

  const canUndo = current.parentId !== null;

  // redo: 当前节点是否有直接子节点
  const children = HistoryTree.getAllNodes().filter((n) => n.parentId === currentNodeId);
  const canRedo = children.length > 0;

  return { canUndo, canRedo };
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  timeline: [],
  currentNodeId: null,
  currentBranch: 'main',
  branches: new Map([
    ['main', { id: 'main', name: 'main', leafNodeId: '', createdAt: Date.now() }],
  ]),
  canUndo: false,
  canRedo: false,
  diffResult: null,

  commit: (snapshot: SerializedCanvas, label?: string) => {
    const node = HistoryTree.commit(snapshot, label);
    const { canUndo, canRedo } = computeUndoRedo(node.id);

    // 更新分支叶子节点
    set((state) => {
      const branches = new Map(state.branches);
      const current = branches.get(state.currentBranch);
      if (current) {
        branches.set(state.currentBranch, { ...current, leafNodeId: node.id });
      }

      return {
        timeline: HistoryTree.getAllNodes(),
        currentNodeId: node.id,
        branches,
        canUndo,
        canRedo,
      };
    });

    return node;
  },

  checkout: (nodeId: string) => {
    const snapshot = HistoryTree.checkout(nodeId);
    if (!snapshot) return null;

    const { canUndo, canRedo } = computeUndoRedo(nodeId);
    set({
      currentNodeId: nodeId,
      canUndo,
      canRedo,
    });

    return snapshot;
  },

  undo: () => {
    const { currentNodeId } = get();
    if (!currentNodeId) return null;

    const current = HistoryTree.getAllNodes().find((n) => n.id === currentNodeId);
    if (!current?.parentId) return null;

    return get().checkout(current.parentId);
  },

  redo: () => {
    const { currentNodeId } = get();
    if (!currentNodeId) return null;

    // 找到当前节点的直接子节点
    const children = HistoryTree.getAllNodes().filter((n) => n.parentId === currentNodeId);
    if (children.length === 0) return null;

    // 取最近的子节点（时间戳最大的）
    const latest = children.sort((a, b) => b.timestamp - a.timestamp)[0];
    return get().checkout(latest.id);
  },

  createBranch: (name: string) => {
    const { currentNodeId, branches } = get();
    if (!currentNodeId) return null;

    const branchId = `branch_${Date.now()}`;
    const branch: Branch = {
      id: branchId,
      name,
      leafNodeId: currentNodeId,
      createdAt: Date.now(),
    };

    const newBranches = new Map(branches);
    newBranches.set(branchId, branch);

    set({
      branches: newBranches,
      currentBranch: branchId,
    });

    return branch;
  },

  switchBranch: (branchId: string) => {
    const { branches } = get();
    const branch = branches.get(branchId);
    if (!branch) return null;

    const snapshot = HistoryTree.checkout(branch.leafNodeId);
    if (!snapshot) return null;

    const { canUndo, canRedo } = computeUndoRedo(branch.leafNodeId);
    set({
      currentBranch: branchId,
      currentNodeId: branch.leafNodeId,
      canUndo,
      canRedo,
    });

    return snapshot;
  },

  deleteBranch: (branchId: string) => {
    if (branchId === 'main') return; // 不能删除主分支

    set((state) => {
      const branches = new Map(state.branches);
      branches.delete(branchId);

      // 如果删除的是当前分支，切回 main
      const newCurrentBranch = state.currentBranch === branchId ? 'main' : state.currentBranch;

      return {
        branches,
        currentBranch: newCurrentBranch,
      };
    });
  },

  diffPaths: (nodeIdA: string, nodeIdB: string) => {
    const result = HistoryTree.diffPaths(nodeIdA, nodeIdB);
    set({ diffResult: result });
    return result;
  },

  clearDiff: () => set({ diffResult: null }),

  getCurrent: () => {
    const { currentNodeId } = get();
    if (!currentNodeId) return null;
    return HistoryTree.getAllNodes().find((n) => n.id === currentNodeId) ?? null;
  },

  getAllNodes: () => HistoryTree.getAllNodes(),

  getBranches: () => {
    return Array.from(get().branches.values());
  },

  getSize: () => HistoryTree.size(),

  clearHistory: () => {
    HistoryTree.clearHistory();
    set({
      timeline: [],
      currentNodeId: null,
      currentBranch: 'main',
      branches: new Map([
        ['main', { id: 'main', name: 'main', leafNodeId: '', createdAt: Date.now() }],
      ]),
      canUndo: false,
      canRedo: false,
      diffResult: null,
    });
  },

  refreshTimeline: () => {
    const { currentNodeId } = get();
    const { canUndo, canRedo } = computeUndoRedo(currentNodeId);
    set({
      timeline: HistoryTree.getAllNodes(),
      canUndo,
      canRedo,
    });
  },
}));
