/**
 * 颠覆计算器 - 全局类型定义
 * 所有模块共享的类型接口
 */

// ============================================
// 端口与数据类型
// ============================================

/** 数据类型枚举 */
export type DataType = 'number' | 'string' | 'array' | 'table';

/** 端口定义 */
export interface PortDefinition {
  name: string;
  dataType: DataType;
  required: boolean;
}

/** 端口值 */
export type Value = number | string | number[] | Record<string, unknown>;

// ============================================
// 计算节点定义（注册用）
// ============================================

/** 节点计算函数 */
export type ComputeFunction = (inputs: Map<string, Value>) => Map<string, Value>;

/** 节点类型定义 */
export interface NodeDefinition {
  type: string;
  label: string;
  category: string;
  color: string;
  inputPorts: PortDefinition[];
  outputPorts: PortDefinition[];
  compute: ComputeFunction;
}

// ============================================
// 画布节点实例
// ============================================

export type NodeStatus = 'idle' | 'computing' | 'error' | 'done';

/** 画布上的计算节点实例 */
export interface CanvasNode {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  inputs: Map<string, Value>;
  outputs: Map<string, Value>;
  status: NodeStatus;
  error?: string;
}

// ============================================
// 连线
// ============================================

/** 连线（有向边） */
export interface Connection {
  id: string;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
}

// ============================================
// 计算结果
// ============================================

export interface ComputeError {
  type: 'DIVISION_BY_ZERO' | 'OVERFLOW' | 'UNDEFINED_FUNCTION' | 'UNDEFINED_VARIABLE' | 'DOMAIN_ERROR' | 'OTHER';
  message: string;
}

export type ComputeResult =
  | { success: true; value: number; formatted: string }
  | { success: false; error: ComputeError };

// ============================================
// 历史 DAG
// ============================================

/** 历史节点 */
export interface HistoryNode {
  id: string;
  parentId: string | null;
  snapshot: SerializedCanvas;
  timestamp: number;
  label?: string;
}

/** 画布序列化格式 */
export interface SerializedCanvas {
  nodes: SerializedNode[];
  connections: Connection[];
  viewport: { x: number; y: number; zoom: number };
}

/** 节点序列化格式 */
export interface SerializedNode {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  inputs: Record<string, Value>;
  outputs: Record<string, Value>;
}

// ============================================
// 画布交互
// ============================================

export interface DragState {
  nodeId: string;
  offsetX: number;
  offsetY: number;
}

export interface ConnectingState {
  sourceNodeId: string;
  sourcePort: string;
  mousePos: { x: number; y: number };
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

// ============================================
// 单位换算
// ============================================

export interface UnitConversion {
  from: string;
  to: string;
  factor: number;
  offset?: number;
}

export interface UnitCategory {
  name: string;
  units: string[];
  conversions: UnitConversion[];
}
