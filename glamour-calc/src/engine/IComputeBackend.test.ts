/**
 * IComputeBackend 单元测试
 * 覆盖：JSBackend 计算、增量执行、后端切换
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { JSBackend, getDefaultBackend, setDefaultBackend } from './IComputeBackend';
import { executeGraph, executeIncremental, topologicalSort } from './GraphExecutor';
import { registerBuiltinNodes, clearRegistry } from './NodeRegistry';
import { CanvasNode, Connection, Value } from '../types';

function makeNode(id: string, type: string, inputs?: Record<string, Value>): CanvasNode {
  return {
    id,
    type,
    label: id,
    position: { x: 0, y: 0 },
    inputs: new Map(Object.entries(inputs ?? {})),
    outputs: new Map(),
    status: 'idle',
  };
}

function makeConn(id: string, src: string, srcPort: string, tgt: string, tgtPort: string): Connection {
  return { id, sourceNodeId: src, sourcePort: srcPort, targetNodeId: tgt, targetPort: tgtPort };
}

describe('JSBackend', () => {
  beforeEach(() => {
    clearRegistry();
    registerBuiltinNodes();
  });

  it('name属性返回js', () => {
    const backend = new JSBackend();
    expect(backend.name).toBe('js');
  });

  it('computeNode_正确执行math.add', () => {
    const backend = new JSBackend();
    const result = backend.computeNode('math.add', new Map([['a', 3], ['b', 5]]));
    expect(result.get('result')).toBe(8);
  });

  it('computeNode_未知类型返回空Map', () => {
    const backend = new JSBackend();
    const result = backend.computeNode('unknown.type', new Map());
    expect(result.size).toBe(0);
  });

  it('computeBatch_批量执行', () => {
    const backend = new JSBackend();
    const results = backend.computeBatch([
      { type: 'math.add', inputs: new Map([['a', 1], ['b', 2]]) },
      { type: 'math.multiply', inputs: new Map([['a', 3], ['b', 4]]) },
    ]);
    expect(results.length).toBe(2);
    expect(results[0].get('result')).toBe(3);
    expect(results[1].get('result')).toBe(12);
  });
});

describe('getDefaultBackend / setDefaultBackend', () => {
  it('默认返回JSBackend', () => {
    const backend = getDefaultBackend();
    expect(backend.name).toBe('js');
  });

  it('可替换为自定义后端', () => {
    const customBackend = {
      name: 'custom',
      computeNode: () => new Map([['result', 999]]),
      destroy: () => {},
    };
    setDefaultBackend(customBackend);
    expect(getDefaultBackend().name).toBe('custom');
    // 恢复
    setDefaultBackend(new JSBackend());
  });
});

describe('executeGraph with backend', () => {
  beforeEach(() => {
    clearRegistry();
    registerBuiltinNodes();
  });

  it('传入backend参数_使用该backend计算', () => {
    const customBackend = {
      name: 'test',
      computeNode: (_type: string, _inputs: Map<string, Value>) => new Map([['result', 42]]),
      destroy: () => {},
    };
    const nodes = [makeNode('n1', 'math.add', { a: 1, b: 2 })];
    const result = executeGraph(nodes, [], customBackend);
    expect(result.nodeOutputs.get('n1')?.get('result')).toBe(42);
  });
});

describe('executeIncremental', () => {
  beforeEach(() => {
    clearRegistry();
    registerBuiltinNodes();
  });

  it('只重新计算受影响的节点', () => {
    // a -> b -> c
    // a: math.add(1, 2) = 3
    // b: math.sqrt(a) = sqrt(3)
    // c: math.add(b, 10) = sqrt(3) + 10
    const nodes = [
      makeNode('a', 'math.add', { a: 1, b: 2 }),
      makeNode('b', 'math.sqrt'),
      makeNode('c', 'math.add', { b: 10 }),
    ];
    const conns = [
      makeConn('c1', 'a', 'result', 'b', 'x'),
      makeConn('c2', 'b', 'result', 'c', 'a'),
    ];

    // 先全量执行一次
    const fullResult = executeGraph(nodes, conns);
    expect(fullResult.success).toBe(true);
    expect(fullResult.nodeOutputs.get('a')?.get('result')).toBe(3);
    expect(fullResult.nodeOutputs.get('b')?.get('result')).toBeCloseTo(Math.sqrt(3));

    // 增量执行：只改 a 的输入
    const nodesWithChange = [
      makeNode('a', 'math.add', { a: 5, b: 2 }), // 改为 5+2=7
      makeNode('b', 'math.sqrt'),
      makeNode('c', 'math.add', { b: 10 }),
    ];

    const incrementalResult = executeIncremental(
      nodesWithChange,
      conns,
      'a',
      fullResult.nodeOutputs
    );

    expect(incrementalResult.success).toBe(true);
    expect(incrementalResult.nodeOutputs.get('a')?.get('result')).toBe(7);
    expect(incrementalResult.nodeOutputs.get('b')?.get('result')).toBeCloseTo(Math.sqrt(7));
    expect(incrementalResult.nodeOutputs.get('c')?.get('result')).toBeCloseTo(Math.sqrt(7) + 10);
  });

  it('循环依赖_返回失败', () => {
    const nodes = [makeNode('a', 'math.add'), makeNode('b', 'math.add')];
    const conns = [
      makeConn('c1', 'a', 'result', 'b', 'a'),
      makeConn('c2', 'b', 'result', 'a', 'a'),
    ];
    const result = executeIncremental(nodes, conns, 'a', new Map());
    expect(result.success).toBe(false);
  });
});
