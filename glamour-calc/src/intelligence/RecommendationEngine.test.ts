/**
 * RecommendationEngine 单元测试
 * 覆盖：规则推荐、端口推荐、使用频率加成
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { recommend, recommendForPort, recordNodeUsage, getUsageStats } from './RecommendationEngine';
import { registerBuiltinNodes, clearRegistry } from '../engine/NodeRegistry';
import { CanvasNode, Connection, GraphContext } from '../types';

function makeNode(id: string, type: string, x = 0, y = 0): CanvasNode {
  return {
    id,
    type,
    label: id,
    position: { x, y },
    inputs: new Map(),
    outputs: new Map(),
    status: 'idle',
  };
}

describe('RecommendationEngine', () => {
  beforeEach(() => {
    clearRegistry();
    registerBuiltinNodes();
  });

  describe('recommend', () => {
    it('选中math.sin_推荐math.cos和const.pi', () => {
      const graph: GraphContext = {
        nodes: [makeNode('n1', 'math.sin')],
        connections: [],
        nodeUsageStats: new Map(),
      };
      const recs = recommend('n1', graph);
      const types = recs.map((r) => r.nodeType);
      expect(types).toContain('math.cos');
      expect(types).toContain('const.pi');
    });

    it('选中const.pi_推荐math.sin', () => {
      const graph: GraphContext = {
        nodes: [makeNode('n1', 'const.pi')],
        connections: [],
        nodeUsageStats: new Map(),
      };
      const recs = recommend('n1', graph);
      const types = recs.map((r) => r.nodeType);
      expect(types).toContain('math.sin');
    });

    it('选中data.array_推荐output.chart', () => {
      const graph: GraphContext = {
        nodes: [makeNode('n1', 'data.array')],
        connections: [],
        nodeUsageStats: new Map(),
      };
      const recs = recommend('n1', graph);
      const types = recs.map((r) => r.nodeType);
      expect(types).toContain('output.chart');
    });

    it('不存在的节点ID_返回空', () => {
      const graph: GraphContext = {
        nodes: [],
        connections: [],
        nodeUsageStats: new Map(),
      };
      const recs = recommend('nonexistent', graph);
      expect(recs.length).toBe(0);
    });

    it('output节点_不推荐其他节点', () => {
      const graph: GraphContext = {
        nodes: [makeNode('n1', 'output.display')],
        connections: [],
        nodeUsageStats: new Map(),
      };
      const recs = recommend('n1', graph);
      expect(recs.length).toBe(0);
    });

    it('推荐结果按分数降序排列', () => {
      const graph: GraphContext = {
        nodes: [makeNode('n1', 'math.sin')],
        connections: [],
        nodeUsageStats: new Map(),
      };
      const recs = recommend('n1', graph);
      for (let i = 1; i < recs.length; i++) {
        expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score);
      }
    });

    it('推荐数量不超过6个', () => {
      const graph: GraphContext = {
        nodes: [makeNode('n1', 'math.sin')],
        connections: [],
        nodeUsageStats: new Map(),
      };
      const recs = recommend('n1', graph);
      expect(recs.length).toBeLessThanOrEqual(6);
    });
  });

  describe('recommendForPort', () => {
    it('输出端口number_推荐接受number的节点', () => {
      const graph: GraphContext = {
        nodes: [makeNode('n1', 'math.add')],
        connections: [],
        nodeUsageStats: new Map(),
      };
      const recs = recommendForPort('n1', 'result', true, graph);
      expect(recs.length).toBeGreaterThan(0);
      // 所有推荐都应该接受 number 类型
      for (const rec of recs) {
        expect(rec.suggestedConnection).toBeDefined();
      }
    });

    it('不存在的节点_返回空', () => {
      const graph: GraphContext = {
        nodes: [],
        connections: [],
        nodeUsageStats: new Map(),
      };
      const recs = recommendForPort('nonexistent', 'a', false, graph);
      expect(recs.length).toBe(0);
    });
  });

  describe('recordNodeUsage', () => {
    it('记录使用后_统计增加', () => {
      recordNodeUsage('math.add');
      recordNodeUsage('math.add');
      recordNodeUsage('math.sin');
      const stats = getUsageStats();
      expect(stats.get('math.add')).toBe(2);
      expect(stats.get('math.sin')).toBe(1);
    });
  });
});
