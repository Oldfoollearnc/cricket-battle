/**
 * IComputeBackend - 计算后端抽象接口
 * 定义节点计算的标准接口，支持 JS 和 WASM 双实现
 * 当前默认使用 JSBackend，后续热点节点可用 Rust WASM 替换
 */

import { Value, IComputeBackend } from '../types';
import { getNodeDefinition } from './NodeRegistry';

/**
 * JSBackend - 默认 JavaScript 计算后端
 * 通过 NodeRegistry 查找节点定义并执行 compute 函数
 */
export class JSBackend implements IComputeBackend {
  readonly name = 'js';

  computeNode(type: string, inputs: Map<string, Value>): Map<string, Value> {
    const def = getNodeDefinition(type);
    if (!def) {
      return new Map();
    }
    return def.compute(inputs);
  }

  computeBatch(
    tasks: Array<{ type: string; inputs: Map<string, Value> }>
  ): Array<Map<string, Value>> {
    return tasks.map((task) => this.computeNode(task.type, task.inputs));
  }

  destroy(): void {
    // JS 后端无需释放资源
  }
}

/** 全局默认后端实例 */
let _defaultBackend: IComputeBackend = new JSBackend();

/** 获取当前默认计算后端 */
export function getDefaultBackend(): IComputeBackend {
  return _defaultBackend;
}

/** 替换默认计算后端（用于 WASM 迁移） */
export function setDefaultBackend(backend: IComputeBackend): void {
  _defaultBackend = backend;
}
