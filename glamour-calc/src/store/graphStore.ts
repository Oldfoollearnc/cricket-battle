/**
 * graphStore - 计算图状态管理
 * 管理节点集合、连线集合、拓扑排序、增量执行
 * 支持脏节点标记：修改节点输入后自动标记下游节点为脏
 * 与 canvasStore 分离，专注于图计算逻辑
 */

import { create } from 'zustand';
import { CanvasNode, Connection, Value } from '../types';
import { executeGraph, executeIncremental, topologicalSort } from '../engine/GraphExecutor';
import { getNodeDefinition } from '../engine/NodeRegistry';
import { useHistoryStore } from './historyStore';
import { v4 as uuidv4 } from 'uuid';

export interface GraphState {
  /** 所有计算节点 */
  nodes: CanvasNode[];
  /** 所有连线 */
  edges: Connection[];
  /** 各节点的计算输出 */
  executionResults: Map<string, Map<string, Value>>;
  /** 脏节点集合（需要重新计算的节点） */
  dirtyNodeIds: Set<string>;
  /** 最近一次执行是否成功 */
  lastExecutionSuccess: boolean;
  /** 最近一次执行的错误信息 */
  lastExecutionErrors: Map<string, string>;

  // 节点操作
  addNode: (type: string, x: number, y: number) => string;
  removeNode: (nodeId: string) => void;
  updateNode: (nodeId: string, patch: Partial<Pick<CanvasNode, 'label' | 'position' | 'status' | 'error'>>) => void;
  setNodeInput: (nodeId: string, portName: string, value: Value) => void;

  // 连线操作
  connectNodes: (sourceId: string, sourcePort: string, targetId: string, targetPort: string) => string;
  disconnectNodes: (edgeId: string) => void;

  // 执行
  executeAll: () => void;
  executeDirty: () => void;
  markDirty: (nodeId: string) => void;

  // 查询
  getNodeById: (nodeId: string) => CanvasNode | undefined;
  getTopology: () => string[] | null;
  getDownstreamNodes: (nodeId: string) => string[];
  getUpstreamNodes: (nodeId: string) => string[];

  // 批量操作
  setNodes: (nodes: CanvasNode[]) => void;
  setEdges: (edges: Connection[]) => void;
  clearAll: () => void;
}

/**
 * [R1-5] 拆分脏标记传播语义：
 * - markSelfAndDownstream: 标记 startNodeId 及其所有下游节点为脏（用于 setNodeInput、connectNodes 等）
 * - markDownstream: 只标记 startNodeId 的下游节点（不标记自身），调用方按需选择
 */

/** 标记指定节点及其所有下游节点为脏 */
function markSelfAndDownstream(
  startNodeId: string,
  connections: Connection[],
  existing: Set<string>
): Set<string> {
  const dirty = new Set(existing);
  const visited = new Set<string>();
  const queue = [startNodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    dirty.add(current);

    for (const conn of connections) {
      if (conn.sourceNodeId === current) {
        queue.push(conn.targetNodeId);
      }
    }
  }

  return dirty;
}

/** 只标记下游节点（不包括 startNodeId 自身） */
function markDownstream(
  startNodeId: string,
  connections: Connection[],
  existing: Set<string>
): Set<string> {
  const dirty = new Set(existing);
  const visited = new Set<string>();
  const queue = [startNodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const conn of connections) {
      if (conn.sourceNodeId === current) {
        const targetId = conn.targetNodeId;
        dirty.add(targetId);
        queue.push(targetId);
      }
    }
  }

  return dirty;
}


export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],
  executionResults: new Map(),
  dirtyNodeIds: new Set(),
  lastExecutionSuccess: true,
  lastExecutionErrors: new Map(),

  addNode: (type: string, x: number, y: number) => {
    const def = getNodeDefinition(type);
    if (!def) return '';

    const defaultInputs = new Map<string, Value>();
    for (const port of def.inputPorts) {
      defaultInputs.set(port.name, 0);
    }

    const node: CanvasNode = {
      id: uuidv4(),
      type,
      label: def.label,
      position: { x, y },
      inputs: defaultInputs,
      outputs: new Map(),
      status: 'idle',
    };

    set((state) => ({
      nodes: [...state.nodes, node],
      dirtyNodeIds: new Set([...state.dirtyNodeIds, node.id]),
    }));

    return node.id;
  },

  removeNode: (nodeId: string) => {
    set((state) => {
      const newDirty = new Set(state.dirtyNodeIds);
      newDirty.delete(nodeId);

      // [R1-11] 收集被断开连线的目标节点，标记它们及其下游为脏
      const disconnectedTargets = new Set<string>();
      for (const edge of state.edges) {
        if (edge.sourceNodeId === nodeId) {
          disconnectedTargets.add(edge.targetNodeId);
        }
      }

      const newEdges = state.edges.filter(
        (e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId
      );

      // 对每个被断开的目标节点传播脏标记
      let propagatedDirty = newDirty;
      for (const targetId of disconnectedTargets) {
        propagatedDirty = markSelfAndDownstream(targetId, newEdges, propagatedDirty);
      }

      return {
        nodes: state.nodes.filter((n) => n.id !== nodeId),
        edges: newEdges,
        dirtyNodeIds: propagatedDirty,
      };
    });
  },

  updateNode: (nodeId: string, patch) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, ...patch } : n
      ),
    }));
  },

  setNodeInput: (nodeId: string, portName: string, value: Value) => {
    const { edges } = get();

    set((state) => {
      const newNodes = state.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const newInputs = new Map(n.inputs);
        newInputs.set(portName, value);
        return { ...n, inputs: newInputs, status: 'idle' as const };
      });

      // [R1-5] 传播脏标记到自身及下游。
      // 虽然 setNodeInput 已修改该节点，但节点仍需进入 dirtySet 供 executeDirty 拾取。
      // 调用方如只需标记下游（不标记自身），应直接使用 markDownstream。
      const dirty = markSelfAndDownstream(nodeId, edges, state.dirtyNodeIds);

      return {
        nodes: newNodes,
        dirtyNodeIds: dirty,
      };
    });
  },

  connectNodes: (sourceId: string, sourcePort: string, targetId: string, targetPort: string) => {
    const edgeId = uuidv4();

    set((state) => {
      // 移除已有连线到同一输入端口
      const filtered = state.edges.filter(
        (e) => !(e.targetNodeId === targetId && e.targetPort === targetPort)
      );

      const newEdge: Connection = {
        id: edgeId,
        sourceNodeId: sourceId,
        sourcePort,
        targetNodeId: targetId,
        targetPort,
      };

      // [R1-7] 为什么用 [...filtered, newEdge] 而不是 state.edges？
      // 因为脏标记传播应基于即将生效的新拓扑：新连线已确定要加入，
      // 用旧 edges 会漏掉通过新连线可达的下游节点。
      const dirty = markSelfAndDownstream(targetId, [...filtered, newEdge], state.dirtyNodeIds);

      return {
        edges: [...filtered, newEdge],
        dirtyNodeIds: dirty,
      };
    });

    return edgeId;
  },

  disconnectNodes: (edgeId: string) => {
    set((state) => {
      const edge = state.edges.find((e) => e.id === edgeId);
      if (!edge) return state;

      const newEdges = state.edges.filter((e) => e.id !== edgeId);

      // 断开连线后，目标节点及其下游需要重算
      const dirty = markSelfAndDownstream(edge.targetNodeId, newEdges, state.dirtyNodeIds);

      return {
        edges: newEdges,
        dirtyNodeIds: dirty,
      };
    });
  },

  executeAll: () => {
    const { nodes, edges } = get();
    if (nodes.length === 0) {
      set({ lastExecutionSuccess: true, lastExecutionErrors: new Map(), executionResults: new Map() });
      return;
    }

    const result = executeGraph(nodes, edges);

    const updatedNodes = nodes.map((n) => {
      const outputs = result.nodeOutputs.get(n.id);
      const error = result.nodeErrors.get(n.id);
      return {
        ...n,
        outputs: outputs ?? n.outputs,
        status: error ? ('error' as const) : outputs ? ('done' as const) : ('idle' as const),
        error,
      };
    });

    set({
      nodes: updatedNodes,
      executionResults: result.nodeOutputs,
      dirtyNodeIds: new Set(),
      lastExecutionSuccess: result.success,
      lastExecutionErrors: result.nodeErrors,
    });
  },

  executeDirty: () => {
    const { nodes, edges, executionResults, dirtyNodeIds } = get();

    if (dirtyNodeIds.size === 0) return;
    if (nodes.length === 0) {
      set({ dirtyNodeIds: new Set() });
      return;
    }

    // 找到所有脏节点中在拓扑序最靠前的那个，从那里开始增量执行
    const order = topologicalSort(nodes, edges);
    if (!order) {
      // 有环，回退到全量执行
      get().executeAll();
      return;
    }

    // 找到拓扑序中最靠前的脏节点
    let earliestIdx = order.length;
    for (const dirtyId of dirtyNodeIds) {
      const idx = order.indexOf(dirtyId);
      if (idx !== -1 && idx < earliestIdx) {
        earliestIdx = idx;
      }
    }

    if (earliestIdx >= order.length) {
      set({ dirtyNodeIds: new Set() });
      return;
    }

    const startNodeId = order[earliestIdx];
    // [R1-1] 传入完整 dirtyNodeIds，让 executeIncremental 计算正确的受影响节点集合
    const result = executeIncremental(nodes, edges, startNodeId, executionResults, undefined, dirtyNodeIds);

    // [R1-1] 合并非受影响节点的旧输出，避免丢失（双保险）
    const mergedOutputs = new Map(executionResults);
    for (const [key, val] of result.nodeOutputs) {
      mergedOutputs.set(key, val);
    }

    const updatedNodes = nodes.map((n) => {
      const outputs = result.nodeOutputs.get(n.id);
      const error = result.nodeErrors.get(n.id);
      // 只更新被增量执行影响到的节点
      if (result.nodeOutputs.has(n.id)) {
        return {
          ...n,
          outputs: outputs ?? n.outputs,
          status: error ? ('error' as const) : ('done' as const),
          error,
        };
      }
      return n;
    });

    set({
      nodes: updatedNodes,
      executionResults: mergedOutputs,
      dirtyNodeIds: new Set(),
      lastExecutionSuccess: result.success,
      lastExecutionErrors: result.nodeErrors,
    });
  },

  markDirty: (nodeId: string) => {
    const { edges } = get();
    set((state) => ({
      dirtyNodeIds: markSelfAndDownstream(nodeId, edges, state.dirtyNodeIds),
    }));
  },

  getNodeById: (nodeId: string) => {
    return get().nodes.find((n) => n.id === nodeId);
  },

  getTopology: () => {
    const { nodes, edges } = get();
    return topologicalSort(nodes, edges);
  },

  getDownstreamNodes: (nodeId: string) => {
    const { edges } = get();
    const result: string[] = [];
    const visited = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      if (current !== nodeId) result.push(current);

      for (const edge of edges) {
        if (edge.sourceNodeId === current) {
          queue.push(edge.targetNodeId);
        }
      }
    }

    return result;
  },

  getUpstreamNodes: (nodeId: string) => {
    const { edges } = get();
    const result: string[] = [];
    const visited = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      if (current !== nodeId) result.push(current);

      for (const edge of edges) {
        if (edge.targetNodeId === current) {
          queue.push(edge.sourceNodeId);
        }
      }
    }

    return result;
  },

  // [R1-6] 批量设置节点/连线后清空执行结果，强制下次重新计算
  setNodes: (nodes: CanvasNode[]) => set((state) => ({
    nodes,
    executionResults: new Map(),
    dirtyNodeIds: new Set(nodes.map((n) => n.id)),
  })),
  setEdges: (edges: Connection[]) => set((state) => ({
    edges,
    executionResults: new Map(),
    // 连线变更后，所有节点都可能受影响，标记全部为脏
    dirtyNodeIds: new Set(state.nodes.map((n) => n.id)),
  })),

  clearAll: () => {
    set({
      nodes: [],
      edges: [],
      executionResults: new Map(),
      dirtyNodeIds: new Set(),
      lastExecutionSuccess: true,
      lastExecutionErrors: new Map(),
    });
  },
}));

/**
 * [R1-8] resetApp - 同时清空 graphStore 和 historyStore
 * 提供应用级别的重置入口，确保两个 store 状态一致
 */
export function resetApp(): void {
  useGraphStore.getState().clearAll();
  useHistoryStore.getState().clearHistory();
}
