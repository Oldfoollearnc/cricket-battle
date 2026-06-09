/**
 * canvasStore - Zustand 全局状态管理
 * 管理画布状态：节点集合、连线集合、视口、选中状态
 * 所有对画布的修改都通过这个 store 进行
 */

import { create } from 'zustand';
import { CanvasNode, Connection, Value, Viewport, SerializedCanvas } from '../types';
import { executeGraph, serializeCanvas, deserializeCanvas } from '../engine/GraphExecutor';
import { getNodeDefinition } from '../engine/NodeRegistry';
import * as HistoryTree from '../history/HistoryTree';
import { v4 as uuidv4 } from 'uuid';

interface CanvasState {
  // 画布数据
  nodes: CanvasNode[];
  connections: Connection[];
  viewport: Viewport;

  // 选中状态
  selectedNodeId: string | null;

  // 节点操作
  addNode: (type: string, x: number, y: number) => string;
  removeNode: (nodeId: string) => void;
  updateNodePosition: (nodeId: string, x: number, y: number) => void;
  setNodeInput: (nodeId: string, portName: string, value: Value) => void;
  selectNode: (nodeId: string | null) => void;

  // 连线操作
  addConnection: (conn: Connection) => void;
  removeConnection: (connId: string) => void;

  // 执行
  executeAll: () => void;

  // 视口
  setViewport: (viewport: Viewport) => void;

  // 历史
  commitHistory: (label?: string) => void;
  checkoutHistory: (nodeId: string) => void;
  forkHistory: (nodeId: string, label?: string) => void;

  // 导入导出
  serialize: () => SerializedCanvas;
  deserialize: (data: SerializedCanvas) => void;

  // 清空
  clearAll: () => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  connections: [],
  viewport: { x: 400, y: 300, zoom: 1 },
  selectedNodeId: null,

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

    set((state) => ({ nodes: [...state.nodes, node] }));
    return node.id;
  },

  removeNode: (nodeId: string) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      connections: state.connections.filter(
        (c) => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId
      ),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
    }));
  },

  updateNodePosition: (nodeId: string, x: number, y: number) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, position: { x, y } } : n
      ),
    }));
  },

  setNodeInput: (nodeId: string, portName: string, value: Value) => {
    set((state) => ({
      nodes: state.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const newInputs = new Map(n.inputs);
        newInputs.set(portName, value);
        return { ...n, inputs: newInputs, status: 'idle' as const, outputs: new Map() };
      }),
    }));
    // 自动重新执行
    get().executeAll();
  },

  selectNode: (nodeId: string | null) => {
    set({ selectedNodeId: nodeId });
  },

  addConnection: (conn: Connection) => {
    // 防止重复连线到同一个输入端口
    const existing = get().connections.find(
      (c) => c.targetNodeId === conn.targetNodeId && c.targetPort === conn.targetPort
    );
    if (existing) {
      // 移除旧连线
      set((state) => ({
        connections: state.connections.filter((c) => c.id !== existing.id),
      }));
    }
    set((state) => ({ connections: [...state.connections, conn] }));
  },

  removeConnection: (connId: string) => {
    set((state) => ({
      connections: state.connections.filter((c) => c.id !== connId),
    }));
  },

  executeAll: () => {
    const { nodes, connections } = get();
    if (nodes.length === 0) return;

    const result = executeGraph(nodes, connections);

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

    set({ nodes: updatedNodes });
  },

  setViewport: (viewport: Viewport) => {
    set({ viewport });
  },

  commitHistory: (label?: string) => {
    const { nodes, connections, viewport } = get();
    const snapshot = serializeCanvas(nodes, connections, viewport);
    HistoryTree.commit(snapshot, label);
  },

  checkoutHistory: (nodeId: string) => {
    const snapshot = HistoryTree.checkout(nodeId);
    if (!snapshot) return;

    const { nodes, connections, viewport } = deserializeCanvas(snapshot);
    set({ nodes, connections, viewport });
  },

  forkHistory: (nodeId: string, label?: string) => {
    const node = HistoryTree.fork(nodeId, label);
    if (!node) return;

    const { nodes, connections, viewport } = deserializeCanvas(node.snapshot);
    set({ nodes, connections, viewport });
  },

  serialize: () => {
    const { nodes, connections, viewport } = get();
    return serializeCanvas(nodes, connections, viewport);
  },

  deserialize: (data: SerializedCanvas) => {
    const { nodes, connections, viewport } = deserializeCanvas(data);
    set({ nodes, connections, viewport });
  },

  clearAll: () => {
    set({
      nodes: [],
      connections: [],
      viewport: { x: 400, y: 300, zoom: 1 },
      selectedNodeId: null,
    });
    HistoryTree.clearHistory();
  },
}));
