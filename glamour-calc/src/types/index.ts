/**
 * 颠覆计算器 - 全局类型定义
 * 所有模块共享的类型接口
 */

// ============================================
// 端口与数据类型
// ============================================

/** 数据类型枚举 */
export type DataType = 'number' | 'string' | 'array' | 'table' | 'chart';

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

// ============================================
// 计算后端抽象 (Module 2)
// ============================================

/** 计算后端接口 -- 支持 JS/WASM 双实现 */
export interface IComputeBackend {
  /** 后端标识 */
  readonly name: string;
  /** 执行单个节点的计算 */
  computeNode(
    type: string,
    inputs: Map<string, Value>
  ): Map<string, Value>;
  /** 批量执行（WASM 后端可利用 SIMD 加速） */
  computeBatch?(
    tasks: Array<{ type: string; inputs: Map<string, Value> }>
  ): Array<Map<string, Value>>;
  /** 释放资源 */
  destroy(): void;
}

// ============================================
// 协作层接口 (Module 3)
// ============================================

/** 协作用户信息 */
export interface CollabUser {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selectedNodeId?: string;
}

/** 协作状态变更事件 */
export interface CollabChangeEvent {
  type: 'node:add' | 'node:remove' | 'node:update' |
        'connection:add' | 'connection:remove' |
        'user:join' | 'user:leave';
  userId: string;
  timestamp: number;
  payload: unknown;
}

// ============================================
// 历史对比接口 (Module 4)
// ============================================

/** 单节点差异 */
export interface NodeDiff {
  nodeId: string;
  nodeType: string;
  outputsA: Map<string, Value>;
  outputsB: Map<string, Value>;
  hasDifference: boolean;
}

/** 路径对比结果 */
export interface PathDiffResult {
  pathA: string[];
  pathB: string[];
  nodeDiffs: NodeDiff[];
}

// ============================================
// 多模态输出接口 (Module 5)
// ============================================

/** 图表配置 */
export interface ChartConfig {
  chartType: 'line' | 'bar' | 'scatter' | 'pie';
  xAxis?: string;
  yAxis?: string;
  title?: string;
}

/** 公式配置 */
export interface FormulaConfig {
  template?: string;
  precision?: number;
}

/** 文本配置 */
export interface TextConfig {
  template?: string;
  fontSize?: number;
}

/** 输出节点类型定义 */
export interface OutputNodeDefinition {
  outputFormat: 'number' | 'chart' | 'formula' | 'text' | 'table';
  renderConfig?: ChartConfig | FormulaConfig | TextConfig;
}

// ============================================
// 智能联想接口 (Module 6)
// ============================================

/** 节点推荐 */
export interface NodeRecommendation {
  nodeType: string;
  reason: string;
  score: number;
  suggestedConnection?: {
    sourcePort: string;
    targetPort: string;
  };
}

/** 图上下文（推荐引擎用） */
export interface GraphContext {
  nodes: CanvasNode[];
  connections: Connection[];
  nodeUsageStats: Map<string, number>;
}

// ============================================
// 设置 Store
// ============================================

export interface SettingsState {
  autoSnapshot: boolean;
  snapshotInterval: number;
  computeBackend: 'js' | 'wasm';
  showRecommendations: boolean;
  theme: 'dark' | 'light';
}

// ============================================
// 服务端 WebSocket 协议
// ============================================

export type WsMessage =
  | { type: 'join'; roomId: string; user: CollabUser }
  | { type: 'leave'; roomId: string; userId: string }
  | { type: 'sync'; roomId: string; update: Uint8Array }
  | { type: 'awareness'; roomId: string; update: Uint8Array }
  | { type: 'snapshot'; roomId: string; snapshot: SerializedCanvas };
