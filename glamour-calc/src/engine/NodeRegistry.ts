/**
 * NodeRegistry - 节点类型注册中心
 * 管理所有可用的计算节点类型，支持动态注册和查询
 */

import { NodeDefinition, Value } from '../types';

const registry = new Map<string, NodeDefinition>();

/** 注册一个节点类型 */
export function registerNode(def: NodeDefinition): void {
  registry.set(def.type, def);
}

/** 获取节点类型定义 */
export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return registry.get(type);
}

/** 获取所有已注册的节点类型 */
export function getAllNodeDefinitions(): NodeDefinition[] {
  return Array.from(registry.values());
}

/** 按分类获取节点类型 */
export function getNodeDefinitionsByCategory(category: string): NodeDefinition[] {
  return Array.from(registry.values()).filter((d) => d.category === category);
}

/** 获取所有分类 */
export function getCategories(): string[] {
  const cats = new Set<string>();
  for (const def of registry.values()) {
    cats.add(def.category);
  }
  return Array.from(cats);
}

/** 清空注册表（测试用） */
export function clearRegistry(): void {
  registry.clear();
}

// ============================================
// 内置节点注册
// ============================================

function numInput(inputs: Map<string, Value>, name: string): number {
  const v = inputs.get(name);
  return typeof v === 'number' ? v : 0;
}

/** 注册所有内置计算节点 */
export function registerBuiltinNodes(): void {
  // 基础运算
  registerNode({
    type: 'math.add',
    label: '加法',
    category: '基础运算',
    color: '#6c5ce7',
    inputPorts: [
      { name: 'a', dataType: 'number', required: true },
      { name: 'b', dataType: 'number', required: true },
    ],
    outputPorts: [
      { name: 'result', dataType: 'number', required: false },
    ],
    compute: (inputs) => new Map([['result', numInput(inputs, 'a') + numInput(inputs, 'b')]]),
  });

  registerNode({
    type: 'math.subtract',
    label: '减法',
    category: '基础运算',
    color: '#6c5ce7',
    inputPorts: [
      { name: 'a', dataType: 'number', required: true },
      { name: 'b', dataType: 'number', required: true },
    ],
    outputPorts: [
      { name: 'result', dataType: 'number', required: false },
    ],
    compute: (inputs) => new Map([['result', numInput(inputs, 'a') - numInput(inputs, 'b')]]),
  });

  registerNode({
    type: 'math.multiply',
    label: '乘法',
    category: '基础运算',
    color: '#6c5ce7',
    inputPorts: [
      { name: 'a', dataType: 'number', required: true },
      { name: 'b', dataType: 'number', required: true },
    ],
    outputPorts: [
      { name: 'result', dataType: 'number', required: false },
    ],
    compute: (inputs) => new Map([['result', numInput(inputs, 'a') * numInput(inputs, 'b')]]),
  });

  registerNode({
    type: 'math.divide',
    label: '除法',
    category: '基础运算',
    color: '#6c5ce7',
    inputPorts: [
      { name: 'a', dataType: 'number', required: true },
      { name: 'b', dataType: 'number', required: true },
    ],
    outputPorts: [
      { name: 'result', dataType: 'number', required: false },
    ],
    compute: (inputs) => {
      const b = numInput(inputs, 'b');
      if (b === 0) return new Map([['result', NaN]]);
      return new Map([['result', numInput(inputs, 'a') / b]]);
    },
  });

  registerNode({
    type: 'math.power',
    label: '幂运算',
    category: '基础运算',
    color: '#6c5ce7',
    inputPorts: [
      { name: 'base', dataType: 'number', required: true },
      { name: 'exponent', dataType: 'number', required: true },
    ],
    outputPorts: [
      { name: 'result', dataType: 'number', required: false },
    ],
    compute: (inputs) => new Map([['result', Math.pow(numInput(inputs, 'base'), numInput(inputs, 'exponent'))]]),
  });

  // 数学函数
  registerNode({
    type: 'math.sin',
    label: 'sin',
    category: '数学函数',
    color: '#00cec9',
    inputPorts: [
      { name: 'x', dataType: 'number', required: true },
    ],
    outputPorts: [
      { name: 'result', dataType: 'number', required: false },
    ],
    compute: (inputs) => new Map([['result', Math.sin(numInput(inputs, 'x'))]]),
  });

  registerNode({
    type: 'math.cos',
    label: 'cos',
    category: '数学函数',
    color: '#00cec9',
    inputPorts: [
      { name: 'x', dataType: 'number', required: true },
    ],
    outputPorts: [
      { name: 'result', dataType: 'number', required: false },
    ],
    compute: (inputs) => new Map([['result', Math.cos(numInput(inputs, 'x'))]]),
  });

  registerNode({
    type: 'math.sqrt',
    label: 'sqrt',
    category: '数学函数',
    color: '#00cec9',
    inputPorts: [
      { name: 'x', dataType: 'number', required: true },
    ],
    outputPorts: [
      { name: 'result', dataType: 'number', required: false },
    ],
    compute: (inputs) => new Map([['result', Math.sqrt(numInput(inputs, 'x'))]]),
  });

  registerNode({
    type: 'math.log',
    label: 'log',
    category: '数学函数',
    color: '#00cec9',
    inputPorts: [
      { name: 'x', dataType: 'number', required: true },
    ],
    outputPorts: [
      { name: 'result', dataType: 'number', required: false },
    ],
    compute: (inputs) => new Map([['result', Math.log(numInput(inputs, 'x'))]]),
  });

  registerNode({
    type: 'math.abs',
    label: 'abs',
    category: '数学函数',
    color: '#00cec9',
    inputPorts: [
      { name: 'x', dataType: 'number', required: true },
    ],
    outputPorts: [
      { name: 'result', dataType: 'number', required: false },
    ],
    compute: (inputs) => new Map([['result', Math.abs(numInput(inputs, 'x'))]]),
  });

  // 输入/输出
  registerNode({
    type: 'input.number',
    label: '数值输入',
    category: '输入/输出',
    color: '#fd79a8',
    inputPorts: [],
    outputPorts: [
      { name: 'value', dataType: 'number', required: false },
    ],
    compute: (inputs) => new Map([['value', numInput(inputs, '_value')]]),
  });

  registerNode({
    type: 'output.display',
    label: '结果显示',
    category: '输入/输出',
    color: '#fd79a8',
    inputPorts: [
      { name: 'value', dataType: 'number', required: true },
    ],
    outputPorts: [],
    compute: () => new Map(),
  });

  // 统计
  registerNode({
    type: 'stats.mean',
    label: '平均值',
    category: '统计',
    color: '#ffeaa7',
    inputPorts: [
      { name: 'a', dataType: 'number', required: true },
      { name: 'b', dataType: 'number', required: true },
    ],
    outputPorts: [
      { name: 'result', dataType: 'number', required: false },
    ],
    compute: (inputs) => new Map([['result', (numInput(inputs, 'a') + numInput(inputs, 'b')) / 2]]),
  });

  registerNode({
    type: 'stats.min',
    label: '最小值',
    category: '统计',
    color: '#ffeaa7',
    inputPorts: [
      { name: 'a', dataType: 'number', required: true },
      { name: 'b', dataType: 'number', required: true },
    ],
    outputPorts: [
      { name: 'result', dataType: 'number', required: false },
    ],
    compute: (inputs) => new Map([['result', Math.min(numInput(inputs, 'a'), numInput(inputs, 'b'))]]),
  });

  registerNode({
    type: 'stats.max',
    label: '最大值',
    category: '统计',
    color: '#ffeaa7',
    inputPorts: [
      { name: 'a', dataType: 'number', required: true },
      { name: 'b', dataType: 'number', required: true },
    ],
    outputPorts: [
      { name: 'result', dataType: 'number', required: false },
    ],
    compute: (inputs) => new Map([['result', Math.max(numInput(inputs, 'a'), numInput(inputs, 'b'))]]),
  });

  // 常量
  registerNode({
    type: 'const.pi',
    label: 'π',
    category: '常量',
    color: '#a29bfe',
    inputPorts: [],
    outputPorts: [
      { name: 'value', dataType: 'number', required: false },
    ],
    compute: () => new Map([['value', Math.PI]]),
  });

  registerNode({
    type: 'const.e',
    label: 'e',
    category: '常量',
    color: '#a29bfe',
    inputPorts: [],
    outputPorts: [
      { name: 'value', dataType: 'number', required: false },
    ],
    compute: () => new Map([['value', Math.E]]),
  });
}
