/**
 * GraphExecutor - 计算图执行引擎
 * 接收节点和连线组成的 DAG，拓扑排序后依次执行
 * 处理循环检测、错误传播、状态更新
 * 支持 IComputeBackend 抽象，可切换 JS/WASM 后端
 * 支持增量执行：只重新计算受影响的下游节点
 */

import { CanvasNode, Connection, Value, SerializedCanvas, SerializedNode, IComputeBackend } from '../types';
import { getNodeDefinition } from './NodeRegistry';
import { getDefaultBackend } from './IComputeBackend';

export interface ExecutionResult {
  success: boolean;
  nodeErrors: Map<string, string>;
  nodeOutputs: Map<string, Map<string, Value>>;
}

/**
 * 拓扑排序：返回节点执行顺序
 * 使用 Kahn 算法，同时检测环
 */
export function topologicalSort(nodes: CanvasNode[], connections: Connection[]): string[] | null {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const conn of connections) {
    adjacency.get(conn.sourceNodeId)?.push(conn.targetNodeId);
    inDegree.set(conn.targetNodeId, (inDegree.get(conn.targetNodeId) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  // 如果结果数量不等于节点数，说明有环
  return result.length === nodes.length ? result : null;
}

/**
 * 执行整个计算图
 * 按拓扑顺序逐节点执行，将上游输出传递到下游输入
 */
export function executeGraph(
  nodes: CanvasNode[],
  connections: Connection[],
  backend?: IComputeBackend
): ExecutionResult {
  const computeBackend = backend ?? getDefaultBackend();
  const nodeMap = new Map<string, CanvasNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const order = topologicalSort(nodes, connections);
  if (!order) {
    return {
      success: false,
      nodeErrors: new Map([['_graph', '检测到循环依赖']]),
      nodeOutputs: new Map(),
    };
  }

  const nodeOutputs = new Map<string, Map<string, Value>>();
  const nodeErrors = new Map<string, string>();

  for (const nodeId of order) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const def = getNodeDefinition(node.type);
    if (!def) {
      nodeErrors.set(nodeId, `未知节点类型: ${node.type}`);
      // [R1-1] 即使出错也记录节点输出（空 Map），避免后续增量执行时输出丢失
      if (!nodeOutputs.has(nodeId)) {
        nodeOutputs.set(nodeId, new Map());
      }
      continue;
    }

    // 收集输入值：先用节点自身的默认值，再用连线传来的值
    const inputs = new Map<string, Value>();

    // 初始化默认输入
    for (const port of def.inputPorts) {
      const defaultVal = node.inputs.get(port.name);
      if (defaultVal !== undefined) {
        inputs.set(port.name, defaultVal);
      }
    }

    // 从连线获取上游输出覆盖
    for (const conn of connections) {
      if (conn.targetNodeId === nodeId) {
        const upstreamOutput = nodeOutputs.get(conn.sourceNodeId);
        if (upstreamOutput?.has(conn.sourcePort)) {
          inputs.set(conn.targetPort, upstreamOutput.get(conn.sourcePort)!);
        }
      }
    }

    // 检查必需输入是否都有值
    let missingInput = false;
    for (const port of def.inputPorts) {
      if (port.required && !inputs.has(port.name)) {
        nodeErrors.set(nodeId, `缺少必需输入: ${port.name}`);
        missingInput = true;
        break;
      }
    }
    if (missingInput) {
      // [R1-1] 缺少输入时也记录节点输出（空 Map），避免后续增量执行时输出丢失
      if (!nodeOutputs.has(nodeId)) {
        nodeOutputs.set(nodeId, new Map());
      }
      continue;
    }

    // 执行计算
    try {
      const outputs = computeBackend.computeNode(node.type, inputs);
      nodeOutputs.set(nodeId, outputs);

      // 检查输出中是否有 NaN
      for (const [key, val] of outputs) {
        if (typeof val === 'number' && isNaN(val)) {
          nodeErrors.set(nodeId, `计算结果为 NaN (${key})`);
        }
      }
    } catch (err) {
      nodeErrors.set(nodeId, `计算异常: ${(err as Error).message}`);
      // [R1-1] 计算异常时也记录节点输出（空 Map），避免后续增量执行时输出丢失
      if (!nodeOutputs.has(nodeId)) {
        nodeOutputs.set(nodeId, new Map());
      }
    }
  }

  return {
    success: nodeErrors.size === 0,
    nodeErrors,
    nodeOutputs,
  };
}

/**
 * 序列化画布状态（用于历史快照）
 */
export function serializeCanvas(
  nodes: CanvasNode[],
  connections: Connection[],
  viewport: { x: number; y: number; zoom: number }
): SerializedCanvas {
  const serializedNodes: SerializedNode[] = nodes.map((n) => ({
    id: n.id,
    type: n.type,
    label: n.label,
    position: { ...n.position },
    inputs: Object.fromEntries(n.inputs),
    outputs: Object.fromEntries(n.outputs),
  }));

  return {
    nodes: serializedNodes,
    connections: connections.map((c) => ({ ...c })),
    viewport: { ...viewport },
  };
}

/**
 * 反序列化画布状态
 */
export function deserializeCanvas(data: SerializedCanvas): {
  nodes: CanvasNode[];
  connections: Connection[];
  viewport: { x: number; y: number; zoom: number };
} {
  const nodes: CanvasNode[] = data.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    label: n.label,
    position: { ...n.position },
    inputs: new Map(Object.entries(n.inputs)),
    outputs: new Map(Object.entries(n.outputs)),
    status: 'idle' as const,
  }));

  return {
    nodes,
    connections: data.connections.map((c) => ({ ...c })),
    viewport: { ...data.viewport },
  };
}

/**
 * 计算受影响节点集合：dirtyNodeId 及其所有下游依赖
 */
function computeAffectedSet(
  dirtyNodeId: string,
  order: string[],
  connections: Connection[]
): Set<string> {
  const affected = new Set<string>();
  // 建立邻接表 source -> targets
  const adjacency = new Map<string, string[]>();
  for (const conn of connections) {
    if (!adjacency.has(conn.sourceNodeId)) {
      adjacency.set(conn.sourceNodeId, []);
    }
    adjacency.get(conn.sourceNodeId)!.push(conn.targetNodeId);
  }

  // BFS 从 dirtyNodeId 开始收集所有下游节点
  const queue = [dirtyNodeId];
  affected.add(dirtyNodeId);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!affected.has(neighbor)) {
        affected.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  // 只保留拓扑序中存在的节点
  const orderSet = new Set(order);
  for (const id of affected) {
    if (!orderSet.has(id)) affected.delete(id);
  }
  return affected;
}

/**
 * 增量执行：只重新计算 changedNodeId 及其下游节点
 * 返回受影响的节点 ID 集合和更新后的输出
 * @param dirtyNodeIds 可选，传入多个脏节点 ID（多节点同时变更时使用）
 */
export function executeIncremental(
  nodes: CanvasNode[],
  connections: Connection[],
  changedNodeId: string,
  previousOutputs: Map<string, Map<string, Value>>,
  backend?: IComputeBackend,
  dirtyNodeIds?: Set<string>
): ExecutionResult {
  const computeBackend = backend ?? getDefaultBackend();
  const nodeMap = new Map<string, CanvasNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const order = topologicalSort(nodes, connections);
  if (!order) {
    return {
      success: false,
      nodeErrors: new Map([['_graph', '检测到循环依赖']]),
      nodeOutputs: new Map(),
    };
  }

  // 计算受影响节点集合（脏节点 + 所有下游节点）
  const affected = new Set<string>();
  const dirtyIds = dirtyNodeIds ?? new Set([changedNodeId]);
  for (const dirtyId of dirtyIds) {
    for (const id of computeAffectedSet(dirtyId, order, connections)) {
      affected.add(id);
    }
  }

  // 深拷贝 previousOutputs，确保未受影响节点的旧输出完整保留
  const nodeOutputs = new Map<string, Map<string, Value>>();
  for (const [key, val] of previousOutputs) {
    nodeOutputs.set(key, new Map(val));
  }

  const nodeErrors = new Map<string, string>();

  // 只执行受影响且在拓扑序中的节点（按拓扑序保证上游先执行）
  for (const nodeId of order) {
    if (!affected.has(nodeId)) continue;

    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const def = getNodeDefinition(node.type);
    if (!def) {
      nodeErrors.set(nodeId, `未知节点类型: ${node.type}`);
      // [R1-1] 即使出错也保留节点已有输出，避免输出丢失
      if (!nodeOutputs.has(nodeId)) {
        nodeOutputs.set(nodeId, new Map());
      }
      continue;
    }

    const inputs = new Map<string, Value>();
    for (const port of def.inputPorts) {
      const defaultVal = node.inputs.get(port.name);
      if (defaultVal !== undefined) {
        inputs.set(port.name, defaultVal);
      }
    }

    for (const conn of connections) {
      if (conn.targetNodeId === nodeId) {
        const upstreamOutput = nodeOutputs.get(conn.sourceNodeId);
        if (upstreamOutput?.has(conn.sourcePort)) {
          inputs.set(conn.targetPort, upstreamOutput.get(conn.sourcePort)!);
        }
      }
    }

    let missingInput = false;
    for (const port of def.inputPorts) {
      if (port.required && !inputs.has(port.name)) {
        nodeErrors.set(nodeId, `缺少必需输入: ${port.name}`);
        missingInput = true;
        break;
      }
    }
    if (missingInput) {
      // [R1-1] 缺少输入时也保留节点已有输出
      if (!nodeOutputs.has(nodeId)) {
        nodeOutputs.set(nodeId, new Map());
      }
      continue;
    }

    try {
      const outputs = computeBackend.computeNode(node.type, inputs);
      nodeOutputs.set(nodeId, outputs);

      for (const [key, val] of outputs) {
        if (typeof val === 'number' && isNaN(val)) {
          nodeErrors.set(nodeId, `计算结果为 NaN (${key})`);
        }
      }
    } catch (err) {
      nodeErrors.set(nodeId, `计算异常: ${(err as Error).message}`);
      // [R1-1] 计算异常时也保留节点已有输出
      if (!nodeOutputs.has(nodeId)) {
        nodeOutputs.set(nodeId, new Map());
      }
    }
  }

  return {
    success: nodeErrors.size === 0,
    nodeErrors,
    nodeOutputs,
  };
}
