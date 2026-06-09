/**
 * historyStore - 计算历史状态管理
 * 管理撤销/重做栈、分支切换、时间线导航
 * 基于 HistoryTree 模块的 DAG 历史结构
 * 支持：undo/redo、分支创建/切换、路径对比、自动快照
 */

import { create } from 'zustand';
import { HistoryNode, SerializedCanvas, PathDiffResult } from '../types';
import { HistoryTreeClass, createHistoryTree } from '../history/HistoryTree';

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
  /** 替换内部 HistoryTree 实例 */
  setHistoryTree: (tree: HistoryTreeClass) => void;

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
function computeUndoRedo(tree: HistoryTreeClass, currentNodeId: string | null): { canUndo: boolean; canRedo: boolean } {
  if (!currentNodeId) return { canUndo: false, canRedo: false };

  const current = tree.getAllNodes().find((n) => n.id === currentNodeId);
  if (!current) return { canUndo: false, canRedo: false };

  const canUndo = current.parentId !== null;

  // redo: 当前节点是否有直接子节点
  const children = tree.getAllNodes().filter((n) => n.parentId === currentNodeId);
  const canRedo = children.length > 0;

  return { canUndo, canRedo };
}

export const useHistoryStore = create<HistoryState>((set, get) => {
  // 内部 HistoryTree 实例，默认使用模块级默认实例
  let _tree: HistoryTreeClass = createHistoryTree();

  return {
    timeline: [],
    currentNodeId: null,
    currentBranch: 'main',
    branches: new Map([
      ['main', { id: 'main', name: 'main', leafNodeId: '', createdAt: Date.now() }],
    ]),
    canUndo: false,
    canRedo: false,
    diffResult: null,

    setHistoryTree: (tree: HistoryTreeClass) => {
      _tree = tree;
    },

    // [R1-12] 预期行为说明：undo 后在中间节点 commit 时，
    // HistoryTree.commit 会将新节点作为该中间节点的子节点追加。
    // 如果该中间节点已有其他子节点（来自之前的 redo 路径），
    // redo 树不会被显式截断——旧子节点仍然存在于 timeline 中，
    // 但分支叶子节点 (leafNodeId) 已更新为新 commit 的节点，
    // 因此 redo 会沿新路径前进，旧路径自然被"遗忘"。
    // canRedo 通过 computeUndoRedo 实时计算，始终反映当前节点的实际子节点状态。
    commit: (snapshot: SerializedCanvas, label?: string) => {
      const node = _tree.commit(snapshot, label);
      const { canUndo, canRedo } = computeUndoRedo(_tree, node.id);

      // 更新分支叶子节点
      set((state) => {
        const branches = new Map(state.branches);
        const current = branches.get(state.currentBranch);
        if (current) {
          branches.set(state.currentBranch, { ...current, leafNodeId: node.id });
        }

        return {
          timeline: _tree.getAllNodes(),
          currentNodeId: node.id,
          branches,
          canUndo,
          canRedo,
        };
      });

      return node;
    },

    checkout: (nodeId: string) => {
      const snapshot = _tree.checkout(nodeId);
      if (!snapshot) return null;

      const { canUndo, canRedo } = computeUndoRedo(_tree, nodeId);
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

      const current = _tree.getAllNodes().find((n) => n.id === currentNodeId);
      if (!current?.parentId) return null;

      return get().checkout(current.parentId);
    },

    redo: () => {
      const { currentNodeId } = get();
      if (!currentNodeId) return null;

      // [R1-3] 根据currentBranch确定正确的子节点路径：
      // 在分支场景下，优先选择属于当前分支叶子路径上的子节点
      const children = _tree.getAllNodes().filter((n) => n.parentId === currentNodeId);
      if (children.length === 0) return null;

      const { branches, currentBranch } = get();
      const branchLeaf = branches.get(currentBranch)?.leafNodeId;

      // 如果当前分支有叶子节点，优先选择在从叶子到根路径上的子节点
      if (branchLeaf) {
        const pathToRoot = new Set<string>();
        let cursor = _tree.getAllNodes().find((n) => n.id === branchLeaf);
        while (cursor) {
          pathToRoot.add(cursor.id);
          cursor = cursor.parentId
            ? _tree.getAllNodes().find((n) => n.id === cursor!.parentId)
            : undefined;
        }

        // 选择在分支路径上的子节点
        const branchChild = children.find((c) => pathToRoot.has(c.id));
        if (branchChild) {
          return get().checkout(branchChild.id);
        }
      }

      // 当前分支路径上没有匹配的子节点，不前进（避免跨分支跳转）
      return null;
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

      const snapshot = _tree.checkout(branch.leafNodeId);
      if (!snapshot) return null;

      const { canUndo, canRedo } = computeUndoRedo(_tree, branch.leafNodeId);
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

      const { currentBranch, branches } = get();
      const isDeletingCurrentBranch = currentBranch === branchId;

      const newBranches = new Map(branches);
      newBranches.delete(branchId);

      // 先更新分支列表
      set({ branches: newBranches });

      // [R1-4] 删除当前分支时，切回 main 并恢复 main 分支叶子节点的快照
      if (isDeletingCurrentBranch) {
        get().switchBranch('main');
      }
    },

    diffPaths: (nodeIdA: string, nodeIdB: string) => {
      const result = _tree.diffPaths(nodeIdA, nodeIdB);
      set({ diffResult: result });
      return result;
    },

    clearDiff: () => set({ diffResult: null }),

    getCurrent: () => {
      const { currentNodeId } = get();
      if (!currentNodeId) return null;
      return _tree.getAllNodes().find((n) => n.id === currentNodeId) ?? null;
    },

    getAllNodes: () => _tree.getAllNodes(),

    getBranches: () => {
      return Array.from(get().branches.values());
    },

    getSize: () => _tree.size(),

    clearHistory: () => {
      _tree.clearHistory();
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
      const { canUndo, canRedo } = computeUndoRedo(_tree, currentNodeId);
      set({
        timeline: _tree.getAllNodes(),
        canUndo,
        canRedo,
      });
    },
  };
});
