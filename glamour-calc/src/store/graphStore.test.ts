/**
 * graphStore 单元测试
 * 覆盖：节点操作、连线操作、执行、脏节点传播、增量执行
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useGraphStore } from './graphStore';
import { registerBuiltinNodes, clearRegistry } from '../engine/NodeRegistry';

describe('graphStore', () => {
  beforeEach(() => {
    clearRegistry();
    registerBuiltinNodes();
    useGraphStore.getState().clearAll();
  });

  describe('addNode', () => {
    it('添加节点_返回有效ID', () => {
      const id = useGraphStore.getState().addNode('math.add', 100, 200);
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('添加节点_节点列表包含该节点', () => {
      const id = useGraphStore.getState().addNode('math.add', 100, 200);
      const node = useGraphStore.getState().nodes.find((n) => n.id === id);
      expect(node).toBeDefined();
      expect(node!.type).toBe('math.add');
      expect(node!.position).toEqual({ x: 100, y: 200 });
    });

    it('添加节点_自动标记为脏', () => {
      const id = useGraphStore.getState().addNode('math.add', 0, 0);
      expect(useGraphStore.getState().dirtyNodeIds.has(id)).toBe(true);
    });

    it('未知节点类型_返回空字符串', () => {
      const id = useGraphStore.getState().addNode('nonexistent', 0, 0);
      expect(id).toBe('');
    });
  });

  describe('removeNode', () => {
    it('删除节点_节点列表不再包含', () => {
      const id = useGraphStore.getState().addNode('math.add', 0, 0);
      useGraphStore.getState().removeNode(id);
      expect(useGraphStore.getState().nodes.length).toBe(0);
    });

    it('删除节点_相关连线被移除', () => {
      const id1 = useGraphStore.getState().addNode('math.add', 0, 0);
      const id2 = useGraphStore.getState().addNode('math.sqrt', 200, 0);
      useGraphStore.getState().connectNodes(id1, 'result', id2, 'x');
      expect(useGraphStore.getState().edges.length).toBe(1);

      useGraphStore.getState().removeNode(id1);
      expect(useGraphStore.getState().edges.length).toBe(0);
    });
  });

  describe('setNodeInput', () => {
    it('设置输入值_节点输入更新', () => {
      const id = useGraphStore.getState().addNode('math.add', 0, 0);
      useGraphStore.getState().setNodeInput(id, 'a', 42);
      const node = useGraphStore.getState().getNodeById(id);
      expect(node!.inputs.get('a')).toBe(42);
    });

    it('设置输入值_下游节点被标记为脏', () => {
      const id1 = useGraphStore.getState().addNode('math.add', 0, 0);
      const id2 = useGraphStore.getState().addNode('math.sqrt', 200, 0);
      useGraphStore.getState().connectNodes(id1, 'result', id2, 'x');

      // 清除脏标记
      useGraphStore.getState().executeAll();
      expect(useGraphStore.getState().dirtyNodeIds.size).toBe(0);

      // 修改上游输入
      useGraphStore.getState().setNodeInput(id1, 'a', 5);
      expect(useGraphStore.getState().dirtyNodeIds.has(id1)).toBe(true);
      expect(useGraphStore.getState().dirtyNodeIds.has(id2)).toBe(true);
    });
  });

  describe('connectNodes', () => {
    it('创建连线_连线列表增加', () => {
      const id1 = useGraphStore.getState().addNode('math.add', 0, 0);
      const id2 = useGraphStore.getState().addNode('math.sqrt', 200, 0);
      const edgeId = useGraphStore.getState().connectNodes(id1, 'result', id2, 'x');
      expect(edgeId).toBeTruthy();
      expect(useGraphStore.getState().edges.length).toBe(1);
    });

    it('重复连线到同一输入端口_替换旧连线', () => {
      const id1 = useGraphStore.getState().addNode('math.add', 0, 0);
      const id2 = useGraphStore.getState().addNode('math.add', 0, 200);
      const id3 = useGraphStore.getState().addNode('math.sqrt', 400, 100);

      useGraphStore.getState().connectNodes(id1, 'result', id3, 'x');
      useGraphStore.getState().connectNodes(id2, 'result', id3, 'x');

      // 应该只有 1 条连线到 sqrt 的 x 端口
      const edgesToX = useGraphStore.getState().edges.filter(
        (e) => e.targetNodeId === id3 && e.targetPort === 'x'
      );
      expect(edgesToX.length).toBe(1);
      expect(edgesToX[0].sourceNodeId).toBe(id2);
    });

    it('连线后_目标节点被标记为脏', () => {
      const id1 = useGraphStore.getState().addNode('math.add', 0, 0);
      const id2 = useGraphStore.getState().addNode('math.sqrt', 200, 0);

      useGraphStore.getState().executeAll();
      expect(useGraphStore.getState().dirtyNodeIds.size).toBe(0); // 确认清空

      useGraphStore.getState().connectNodes(id1, 'result', id2, 'x');
      expect(useGraphStore.getState().dirtyNodeIds.has(id2)).toBe(true);
    });
  });

  describe('disconnectNodes', () => {
    it('断开连线_连线列表减少', () => {
      const id1 = useGraphStore.getState().addNode('math.add', 0, 0);
      const id2 = useGraphStore.getState().addNode('math.sqrt', 200, 0);
      const edgeId = useGraphStore.getState().connectNodes(id1, 'result', id2, 'x');
      expect(useGraphStore.getState().edges.length).toBe(1);

      useGraphStore.getState().disconnectNodes(edgeId);
      expect(useGraphStore.getState().edges.length).toBe(0);
    });

    it('断开连线_目标节点被标记为脏', () => {
      const id1 = useGraphStore.getState().addNode('math.add', 0, 0);
      const id2 = useGraphStore.getState().addNode('math.sqrt', 200, 0);
      const edgeId = useGraphStore.getState().connectNodes(id1, 'result', id2, 'x');
      useGraphStore.getState().executeAll();

      useGraphStore.getState().disconnectNodes(edgeId);
      expect(useGraphStore.getState().dirtyNodeIds.has(id2)).toBe(true);
    });
  });

  describe('executeAll', () => {
    it('单节点_执行成功', () => {
      useGraphStore.getState().addNode('math.add', 0, 0);
      const id = useGraphStore.getState().nodes[0].id;
      useGraphStore.getState().setNodeInput(id, 'a', 3);
      useGraphStore.getState().setNodeInput(id, 'b', 5);
      useGraphStore.getState().executeAll();

      const node = useGraphStore.getState().getNodeById(id);
      expect(node!.outputs.get('result')).toBe(8);
      expect(node!.status).toBe('done');
    });

    it('连线节点_数据传递正确', () => {
      const id1 = useGraphStore.getState().addNode('const.pi', 0, 0);
      const id2 = useGraphStore.getState().addNode('math.sin', 200, 0);
      useGraphStore.getState().connectNodes(id1, 'value', id2, 'x');
      useGraphStore.getState().executeAll();

      const sinNode = useGraphStore.getState().getNodeById(id2);
      expect(sinNode!.outputs.get('result')).toBeCloseTo(Math.sin(Math.PI));
    });

    it('执行后_脏节点集合清空', () => {
      useGraphStore.getState().addNode('math.add', 0, 0);
      useGraphStore.getState().executeAll();
      expect(useGraphStore.getState().dirtyNodeIds.size).toBe(0);
    });

    it('循环依赖_标记为失败', () => {
      const id1 = useGraphStore.getState().addNode('math.add', 0, 0);
      const id2 = useGraphStore.getState().addNode('math.add', 200, 0);
      useGraphStore.getState().connectNodes(id1, 'result', id2, 'a');
      useGraphStore.getState().connectNodes(id2, 'result', id1, 'a');
      useGraphStore.getState().executeAll();

      expect(useGraphStore.getState().lastExecutionSuccess).toBe(false);
    });
  });

  describe('executeDirty', () => {
    it('无脏节点_不执行', () => {
      useGraphStore.getState().addNode('math.add', 0, 0);
      useGraphStore.getState().setNodeInput(useGraphStore.getState().nodes[0].id, 'a', 3);
      useGraphStore.getState().setNodeInput(useGraphStore.getState().nodes[0].id, 'b', 5);
      useGraphStore.getState().executeAll();

      const outputsBefore = new Map(useGraphStore.getState().executionResults);
      useGraphStore.getState().executeDirty();
      // 节点输出不应改变
      expect(useGraphStore.getState().executionResults).toEqual(outputsBefore);
      expect(useGraphStore.getState().dirtyNodeIds.size).toBe(0);
    });

    it('修改输入后_只重算受影响节点', () => {
      const id1 = useGraphStore.getState().addNode('math.add', 0, 0);
      const id2 = useGraphStore.getState().addNode('math.sqrt', 200, 0);
      useGraphStore.getState().setNodeInput(id1, 'a', 4);
      useGraphStore.getState().setNodeInput(id1, 'b', 5);
      useGraphStore.getState().connectNodes(id1, 'result', id2, 'x');
      useGraphStore.getState().executeAll();

      expect(useGraphStore.getState().getNodeById(id1)!.outputs.get('result')).toBe(9);
      expect(useGraphStore.getState().getNodeById(id2)!.outputs.get('result')).toBeCloseTo(3);

      // 修改 id1 的输入
      useGraphStore.getState().setNodeInput(id1, 'a', 16);
      useGraphStore.getState().executeDirty();

      expect(useGraphStore.getState().getNodeById(id1)!.outputs.get('result')).toBe(21);
      expect(useGraphStore.getState().getNodeById(id2)!.outputs.get('result')).toBeCloseTo(Math.sqrt(21));
    });
  });

  describe('查询方法', () => {
    it('getNodeById_返回正确节点', () => {
      const id = useGraphStore.getState().addNode('math.add', 100, 200);
      const node = useGraphStore.getState().getNodeById(id);
      expect(node).toBeDefined();
      expect(node!.position).toEqual({ x: 100, y: 200 });
    });

    it('getNodeById_不存在返回undefined', () => {
      expect(useGraphStore.getState().getNodeById('nonexistent')).toBeUndefined();
    });

    it('getTopology_返回拓扑序', () => {
      const id1 = useGraphStore.getState().addNode('math.add', 0, 0);
      const id2 = useGraphStore.getState().addNode('math.sqrt', 200, 0);
      useGraphStore.getState().connectNodes(id1, 'result', id2, 'x');

      const order = useGraphStore.getState().getTopology();
      expect(order).not.toBeNull();
      expect(order!.indexOf(id1)).toBeLessThan(order!.indexOf(id2));
    });

    it('getDownstreamNodes_返回下游节点', () => {
      const id1 = useGraphStore.getState().addNode('math.add', 0, 0);
      const id2 = useGraphStore.getState().addNode('math.sqrt', 200, 0);
      const id3 = useGraphStore.getState().addNode('math.abs', 400, 0);
      useGraphStore.getState().connectNodes(id1, 'result', id2, 'x');
      useGraphStore.getState().connectNodes(id2, 'result', id3, 'x');

      const downstream = useGraphStore.getState().getDownstreamNodes(id1);
      expect(downstream).toContain(id2);
      expect(downstream).toContain(id3);
      expect(downstream).not.toContain(id1);
    });

    it('getUpstreamNodes_返回上游节点', () => {
      const id1 = useGraphStore.getState().addNode('math.add', 0, 0);
      const id2 = useGraphStore.getState().addNode('math.sqrt', 200, 0);
      const id3 = useGraphStore.getState().addNode('math.abs', 400, 0);
      useGraphStore.getState().connectNodes(id1, 'result', id2, 'x');
      useGraphStore.getState().connectNodes(id2, 'result', id3, 'x');

      const upstream = useGraphStore.getState().getUpstreamNodes(id3);
      expect(upstream).toContain(id1);
      expect(upstream).toContain(id2);
      expect(upstream).not.toContain(id3);
    });
  });

  describe('clearAll', () => {
    it('清空后_所有状态重置', () => {
      useGraphStore.getState().addNode('math.add', 0, 0);
      useGraphStore.getState().addNode('math.sqrt', 200, 0);
      useGraphStore.getState().executeAll();

      useGraphStore.getState().clearAll();

      expect(useGraphStore.getState().nodes.length).toBe(0);
      expect(useGraphStore.getState().edges.length).toBe(0);
      expect(useGraphStore.getState().executionResults.size).toBe(0);
      expect(useGraphStore.getState().dirtyNodeIds.size).toBe(0);
      expect(useGraphStore.getState().lastExecutionSuccess).toBe(true);
    });
  });
});
