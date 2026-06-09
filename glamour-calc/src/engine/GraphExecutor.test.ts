/**
 * GraphExecutor 单元测试
 * 覆盖：拓扑排序、图执行、循环检测、序列化/反序列化
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  topologicalSort,
  executeGraph,
  serializeCanvas,
  deserializeCanvas,
} from './GraphExecutor';
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

describe('GraphExecutor', () => {
  beforeEach(() => {
    clearRegistry();
    registerBuiltinNodes();
  });

  describe('topologicalSort', () => {
    it('无连线_返回所有节点', () => {
      const nodes = [makeNode('a', 'math.add'), makeNode('b', 'math.add')];
      const result = topologicalSort(nodes, []);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(2);
    });

    it('单连线_a在b前', () => {
      const nodes = [makeNode('a', 'math.add'), makeNode('b', 'math.add')];
      const conns = [makeConn('c1', 'a', 'result', 'b', 'a')];
      const result = topologicalSort(nodes, conns);
      expect(result).not.toBeNull();
      expect(result!.indexOf('a')).toBeLessThan(result!.indexOf('b'));
    });

    it('链式依赖_a->b->c', () => {
      const nodes = [
        makeNode('a', 'const.pi'),
        makeNode('b', 'math.sin'),
        makeNode('c', 'math.abs'),
      ];
      const conns = [
        makeConn('c1', 'a', 'value', 'b', 'x'),
        makeConn('c2', 'b', 'result', 'c', 'x'),
      ];
      const result = topologicalSort(nodes, conns);
      expect(result).not.toBeNull();
      expect(result!.indexOf('a')).toBeLessThan(result!.indexOf('b'));
      expect(result!.indexOf('b')).toBeLessThan(result!.indexOf('c'));
    });

    it('环形依赖_返回null', () => {
      const nodes = [makeNode('a', 'math.add'), makeNode('b', 'math.add')];
      const conns = [
        makeConn('c1', 'a', 'result', 'b', 'a'),
        makeConn('c2', 'b', 'result', 'a', 'a'),
      ];
      const result = topologicalSort(nodes, conns);
      expect(result).toBeNull();
    });
  });

  describe('executeGraph', () => {
    it('单节点_带默认输入_执行成功', () => {
      const nodes = [makeNode('n1', 'math.add', { a: 3, b: 5 })];
      const result = executeGraph(nodes, []);
      expect(result.success).toBe(true);
      expect(result.nodeOutputs.get('n1')?.get('result')).toBe(8);
    });

    it('两节点连线_数据传递', () => {
      // const.pi -> math.sin
      const nodes = [makeNode('pi', 'const.pi'), makeNode('sin', 'math.sin')];
      const conns = [makeConn('c1', 'pi', 'value', 'sin', 'x')];
      const result = executeGraph(nodes, conns);
      expect(result.success).toBe(true);
      expect(result.nodeOutputs.get('sin')?.get('result')).toBeCloseTo(Math.sin(Math.PI));
    });

    it('三节点链_2+3=5然后sqrt(5)', () => {
      const nodes = [
        makeNode('add', 'math.add', { a: 2, b: 3 }),
        makeNode('sqrt', 'math.sqrt'),
      ];
      const conns = [makeConn('c1', 'add', 'result', 'sqrt', 'x')];
      const result = executeGraph(nodes, conns);
      expect(result.success).toBe(true);
      expect(result.nodeOutputs.get('sqrt')?.get('result')).toBeCloseTo(Math.sqrt(5));
    });

    it('缺失必需输入_记录错误', () => {
      const nodes = [makeNode('sin', 'math.sin')]; // 缺少 x
      const result = executeGraph(nodes, []);
      expect(result.success).toBe(false);
      expect(result.nodeErrors.has('sin')).toBe(true);
    });

    it('循环依赖_返回失败', () => {
      const nodes = [makeNode('a', 'math.add'), makeNode('b', 'math.add')];
      const conns = [
        makeConn('c1', 'a', 'result', 'b', 'a'),
        makeConn('c2', 'b', 'result', 'a', 'a'),
      ];
      const result = executeGraph(nodes, conns);
      expect(result.success).toBe(false);
    });

    it('空图_返回成功', () => {
      const result = executeGraph([], []);
      expect(result.success).toBe(true);
    });

    it('并行节点_独立执行', () => {
      const nodes = [
        makeNode('a', 'math.add', { a: 1, b: 2 }),
        makeNode('b', 'math.multiply', { a: 3, b: 4 }),
      ];
      const result = executeGraph(nodes, []);
      expect(result.success).toBe(true);
      expect(result.nodeOutputs.get('a')?.get('result')).toBe(3);
      expect(result.nodeOutputs.get('b')?.get('result')).toBe(12);
    });
  });

  describe('serializeCanvas / deserializeCanvas', () => {
    it('序列化后反序列化_数据一致', () => {
      const nodes: CanvasNode[] = [
        {
          id: 'n1',
          type: 'math.add',
          label: '加法',
          position: { x: 100, y: 200 },
          inputs: new Map([['a', 1], ['b', 2]]),
          outputs: new Map([['result', 3]]),
          status: 'done',
        },
      ];
      const conns: Connection[] = [
        { id: 'c1', sourceNodeId: 'n1', sourcePort: 'result', targetNodeId: 'n2', targetPort: 'a' },
      ];
      const viewport = { x: 50, y: 60, zoom: 1.5 };

      const serialized = serializeCanvas(nodes, conns, viewport);
      const deserialized = deserializeCanvas(serialized);

      expect(deserialized.nodes.length).toBe(1);
      expect(deserialized.nodes[0].id).toBe('n1');
      expect(deserialized.nodes[0].inputs.get('a')).toBe(1);
      expect(deserialized.nodes[0].outputs.get('result')).toBe(3);
      expect(deserialized.connections.length).toBe(1);
      expect(deserialized.viewport.zoom).toBe(1.5);
    });

    it('Map转Object再转Map_值不丢失', () => {
      const nodes: CanvasNode[] = [
        {
          id: 'n1',
          type: 'input.number',
          label: '输入',
          position: { x: 0, y: 0 },
          inputs: new Map<string, Value>([['_value', 42]]),
          outputs: new Map<string, Value>(),
          status: 'idle',
        },
      ];
      const serialized = serializeCanvas(nodes, [], { x: 0, y: 0, zoom: 1 });
      const deserialized = deserializeCanvas(serialized);
      expect(deserialized.nodes[0].inputs.get('_value')).toBe(42);
    });
  });
});
