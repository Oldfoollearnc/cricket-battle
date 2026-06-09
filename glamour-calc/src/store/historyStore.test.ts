/**
 * historyStore 单元测试
 * 覆盖：commit、checkout、undo/redo、分支管理、路径对比
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useHistoryStore } from './historyStore';
import { SerializedCanvas } from '../types';

function makeSnapshot(label: string): SerializedCanvas {
  return {
    nodes: [{
      id: `node_${label}`,
      type: 'math.add',
      label,
      position: { x: 0, y: 0 },
      inputs: {},
      outputs: {},
    }],
    connections: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

describe('historyStore', () => {
  beforeEach(() => {
    useHistoryStore.getState().clearHistory();
  });

  describe('commit', () => {
    it('提交快照_时间线更新', () => {
      useHistoryStore.getState().commit(makeSnapshot('a'), 'v1');
      expect(useHistoryStore.getState().timeline.length).toBe(1);
    });

    it('提交快照_当前节点ID更新', () => {
      useHistoryStore.getState().commit(makeSnapshot('a'), 'v1');
      expect(useHistoryStore.getState().currentNodeId).toBeTruthy();
    });

    it('提交带标签_标签正确', () => {
      const node = useHistoryStore.getState().commit(makeSnapshot('a'), '初始');
      expect(node.label).toBe('初始');
    });

    it('多次提交_形成链_canUndo变true', () => {
      useHistoryStore.getState().commit(makeSnapshot('a'), 'v1');
      expect(useHistoryStore.getState().canUndo).toBe(false);

      useHistoryStore.getState().commit(makeSnapshot('b'), 'v2');
      expect(useHistoryStore.getState().canUndo).toBe(true);
    });
  });

  describe('checkout', () => {
    it('回溯到指定节点_返回快照', () => {
      const n1 = useHistoryStore.getState().commit(makeSnapshot('a'), 'v1');
      useHistoryStore.getState().commit(makeSnapshot('b'), 'v2');

      const snapshot = useHistoryStore.getState().checkout(n1.id);
      expect(snapshot).not.toBeNull();
      expect(snapshot!.nodes[0].label).toBe('a');
    });

    it('回溯后_当前节点ID更新', () => {
      const n1 = useHistoryStore.getState().commit(makeSnapshot('a'), 'v1');
      useHistoryStore.getState().commit(makeSnapshot('b'), 'v2');
      useHistoryStore.getState().checkout(n1.id);

      expect(useHistoryStore.getState().currentNodeId).toBe(n1.id);
    });

    it('不存在的ID_返回null', () => {
      expect(useHistoryStore.getState().checkout('nonexistent')).toBeNull();
    });
  });

  describe('undo', () => {
    it('有父节点_回退到父节点', () => {
      useHistoryStore.getState().commit(makeSnapshot('a'), 'v1');
      const n2 = useHistoryStore.getState().commit(makeSnapshot('b'), 'v2');

      const snapshot = useHistoryStore.getState().undo();
      expect(snapshot).not.toBeNull();
      expect(useHistoryStore.getState().currentNodeId).not.toBe(n2.id);
    });

    it('在根节点_undo返回null', () => {
      useHistoryStore.getState().commit(makeSnapshot('a'), 'v1');
      const snapshot = useHistoryStore.getState().undo();
      expect(snapshot).toBeNull();
    });

    it('无历史_undo返回null', () => {
      const snapshot = useHistoryStore.getState().undo();
      expect(snapshot).toBeNull();
    });
  });

  describe('redo', () => {
    it('有子节点_前进到子节点', () => {
      useHistoryStore.getState().commit(makeSnapshot('a'), 'v1');
      useHistoryStore.getState().commit(makeSnapshot('b'), 'v2');

      useHistoryStore.getState().undo();
      const snapshot = useHistoryStore.getState().redo();
      expect(snapshot).not.toBeNull();
    });

    it('在最新节点_redo返回null', () => {
      useHistoryStore.getState().commit(makeSnapshot('a'), 'v1');
      const snapshot = useHistoryStore.getState().redo();
      expect(snapshot).toBeNull();
    });
  });

  describe('分支管理', () => {
    it('创建分支_分支列表增加', () => {
      useHistoryStore.getState().commit(makeSnapshot('a'), 'v1');
      const branch = useHistoryStore.getState().createBranch('探索A');
      expect(branch).not.toBeNull();
      expect(branch!.name).toBe('探索A');
      expect(useHistoryStore.getState().branches.size).toBe(2); // main + 探索A
    });

    it('创建分支_当前分支切换', () => {
      useHistoryStore.getState().commit(makeSnapshot('a'), 'v1');
      const branch = useHistoryStore.getState().createBranch('探索A');
      expect(useHistoryStore.getState().currentBranch).toBe(branch!.id);
    });

    it('切换分支_返回该分支叶子节点的快照', () => {
      useHistoryStore.getState().commit(makeSnapshot('a'), 'v1');
      const branch = useHistoryStore.getState().createBranch('探索A');
      useHistoryStore.getState().commit(makeSnapshot('b'), 'v2-探索');

      // 切回 main
      const snapshot = useHistoryStore.getState().switchBranch('main');
      expect(snapshot).not.toBeNull();
      expect(useHistoryStore.getState().currentBranch).toBe('main');
    });

    it('删除非主分支_分支列表减少', () => {
      useHistoryStore.getState().commit(makeSnapshot('a'), 'v1');
      const branch = useHistoryStore.getState().createBranch('探索A');
      useHistoryStore.getState().deleteBranch(branch!.id);

      expect(useHistoryStore.getState().branches.has(branch!.id)).toBe(false);
    });

    it('删除主分支_不生效', () => {
      useHistoryStore.getState().commit(makeSnapshot('a'), 'v1');
      useHistoryStore.getState().deleteBranch('main');
      expect(useHistoryStore.getState().branches.has('main')).toBe(true);
    });
  });

  describe('clearHistory', () => {
    it('清空后_所有状态重置', () => {
      useHistoryStore.getState().commit(makeSnapshot('a'), 'v1');
      useHistoryStore.getState().commit(makeSnapshot('b'), 'v2');
      useHistoryStore.getState().clearHistory();

      expect(useHistoryStore.getState().timeline.length).toBe(0);
      expect(useHistoryStore.getState().currentNodeId).toBeNull();
      expect(useHistoryStore.getState().canUndo).toBe(false);
      expect(useHistoryStore.getState().canRedo).toBe(false);
    });
  });

  describe('getCurrent / getSize', () => {
    it('getCurrent_返回当前历史节点', () => {
      useHistoryStore.getState().commit(makeSnapshot('a'), 'v1');
      const current = useHistoryStore.getState().getCurrent();
      expect(current).not.toBeNull();
      expect(current!.label).toBe('v1');
    });

    it('getSize_返回历史节点数量', () => {
      useHistoryStore.getState().commit(makeSnapshot('a'), 'v1');
      useHistoryStore.getState().commit(makeSnapshot('b'), 'v2');
      expect(useHistoryStore.getState().getSize()).toBe(2);
    });
  });
});
