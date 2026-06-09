/**
 * HistoryTree 单元测试
 * 覆盖：提交、回溯、分叉、路径查找
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryTreeClass, createHistoryTree } from './HistoryTree';
import { SerializedCanvas } from '../types';

function makeSnapshot(label: string): SerializedCanvas {
  return {
    nodes: [{ id: `node_${label}`, type: 'math.add', label, position: { x: 0, y: 0 }, inputs: {}, outputs: {} }],
    connections: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

describe('HistoryTree', () => {
  let tree: HistoryTreeClass;

  beforeEach(() => {
    tree = createHistoryTree();
  });

  describe('commit', () => {
    it('提交后_current指向新节点', () => {
      tree.commit(makeSnapshot('a'));
      const cur = tree.getCurrent();
      expect(cur).not.toBeNull();
      expect(cur!.label).toBeUndefined(); // 未传label
    });

    it('提交带标签的快照', () => {
      tree.commit(makeSnapshot('a'), '初始状态');
      const cur = tree.getCurrent();
      expect(cur!.label).toBe('初始状态');
    });

    it('多次提交_形成链', () => {
      tree.commit(makeSnapshot('a'), 'v1');
      tree.commit(makeSnapshot('b'), 'v2');
      const cur = tree.getCurrent();
      expect(cur!.label).toBe('v2');
      expect(tree.size()).toBe(2);
    });

    it('parentId指向父节点', () => {
      const n1 = tree.commit(makeSnapshot('a'), 'v1');
      const n2 = tree.commit(makeSnapshot('b'), 'v2');
      expect(n2.parentId).toBe(n1.id);
    });
  });

  describe('checkout', () => {
    it('回溯到指定节点_返回快照', () => {
      const n1 = tree.commit(makeSnapshot('a'), 'v1');
      tree.commit(makeSnapshot('b'), 'v2');
      const snapshot = tree.checkout(n1.id);
      expect(snapshot).not.toBeNull();
      expect(snapshot!.nodes[0].label).toBe('a');
    });

    it('回溯后_current指向目标节点', () => {
      const n1 = tree.commit(makeSnapshot('a'), 'v1');
      tree.commit(makeSnapshot('b'), 'v2');
      tree.checkout(n1.id);
      expect(tree.getCurrent()!.id).toBe(n1.id);
    });

    it('不存在的id返回null', () => {
      expect(tree.checkout('nonexistent')).toBeNull();
    });
  });

  describe('fork', () => {
    it('从指定节点分叉_创建新节点', () => {
      const n1 = tree.commit(makeSnapshot('a'), 'v1');
      tree.commit(makeSnapshot('b'), 'v2');
      const forked = tree.fork(n1.id, '分叉A');
      expect(forked).not.toBeNull();
      expect(forked!.label).toBe('分叉A');
      expect(forked!.parentId).toBe(n1.id);
    });

    it('分叉节点的快照与源节点相同', () => {
      const n1 = tree.commit(makeSnapshot('a'), 'v1');
      const forked = tree.fork(n1.id);
      expect(forked!.snapshot.nodes[0].label).toBe('a');
    });

    it('分叉后_current指向分叉节点', () => {
      const n1 = tree.commit(makeSnapshot('a'), 'v1');
      tree.fork(n1.id, '分叉');
      expect(tree.getCurrent()!.label).toBe('分叉');
    });

    it('不存在的id返回null', () => {
      expect(tree.fork('nonexistent')).toBeNull();
    });
  });

  describe('getPath', () => {
    it('同一直链上的两个节点_返回路径', () => {
      const n1 = tree.commit(makeSnapshot('a'), 'v1');
      const n2 = tree.commit(makeSnapshot('b'), 'v2');
      const n3 = tree.commit(makeSnapshot('c'), 'v3');
      const path = tree.getPath(n1.id, n3.id);
      expect(path.length).toBe(3);
      expect(path[0].id).toBe(n1.id);
      expect(path[2].id).toBe(n3.id);
    });

    it('同节点_返回单元素', () => {
      const n1 = tree.commit(makeSnapshot('a'), 'v1');
      const path = tree.getPath(n1.id, n1.id);
      expect(path.length).toBe(1);
    });

    it('分叉路径_找到公共祖先', () => {
      const n1 = tree.commit(makeSnapshot('a'), 'v1');
      const n2 = tree.commit(makeSnapshot('b'), 'v2');
      // 从 n1 分叉
      tree.checkout(n1.id);
      const n3 = tree.fork(n1.id, '分叉');
      // n2 -> n1 -> n3 的路径
      const path = tree.getPath(n2.id, n3!.id);
      expect(path.length).toBeGreaterThan(0);
    });
  });

  describe('getAllNodes', () => {
    it('返回所有历史节点', () => {
      tree.commit(makeSnapshot('a'));
      tree.commit(makeSnapshot('b'));
      tree.commit(makeSnapshot('c'));
      expect(tree.getAllNodes().length).toBe(3);
    });
  });

  describe('clearHistory', () => {
    it('清空后_无节点', () => {
      tree.commit(makeSnapshot('a'));
      tree.commit(makeSnapshot('b'));
      tree.clearHistory();
      expect(tree.size()).toBe(0);
      expect(tree.getCurrent()).toBeNull();
    });
  });

  describe('实例隔离', () => {
    it('不同实例之间互不影响', () => {
      const treeA = createHistoryTree();
      const treeB = createHistoryTree();

      treeA.commit(makeSnapshot('a'), 'only-in-A');

      expect(treeA.size()).toBe(1);
      expect(treeB.size()).toBe(0);
    });
  });
});
