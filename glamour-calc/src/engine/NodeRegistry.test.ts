/**
 * NodeRegistry 单元测试
 * 覆盖：节点注册、查询、内置节点注册
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerNode,
  getNodeDefinition,
  getAllNodeDefinitions,
  getNodeDefinitionsByCategory,
  getCategories,
  clearRegistry,
  registerBuiltinNodes,
} from './NodeRegistry';
import { NodeDefinition } from '../types';

const mockNode: NodeDefinition = {
  type: 'test.add',
  label: '测试加法',
  category: '测试',
  color: '#ff0000',
  inputPorts: [
    { name: 'a', dataType: 'number', required: true },
    { name: 'b', dataType: 'number', required: true },
  ],
  outputPorts: [
    { name: 'result', dataType: 'number', required: false },
  ],
  compute: (inputs) => {
    const a = (inputs.get('a') as number) ?? 0;
    const b = (inputs.get('b') as number) ?? 0;
    return new Map([['result', a + b]]);
  },
};

describe('NodeRegistry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  describe('registerNode', () => {
    it('注册后可通过type查询', () => {
      registerNode(mockNode);
      const def = getNodeDefinition('test.add');
      expect(def).toBeDefined();
      expect(def!.label).toBe('测试加法');
    });
  });

  describe('getNodeDefinition', () => {
    it('不存在的type返回undefined', () => {
      expect(getNodeDefinition('nonexistent')).toBeUndefined();
    });
  });

  describe('getAllNodeDefinitions', () => {
    it('返回所有已注册节点', () => {
      registerNode(mockNode);
      registerNode({ ...mockNode, type: 'test.mul', label: '测试乘法' });
      const all = getAllNodeDefinitions();
      expect(all.length).toBe(2);
    });

    it('空注册表返回空数组', () => {
      expect(getAllNodeDefinitions()).toEqual([]);
    });
  });

  describe('getNodeDefinitionsByCategory', () => {
    it('按分类过滤', () => {
      registerNode(mockNode);
      registerNode({ ...mockNode, type: 'other.node', category: '其他' });
      const testNodes = getNodeDefinitionsByCategory('测试');
      expect(testNodes.length).toBe(1);
      expect(testNodes[0].type).toBe('test.add');
    });
  });

  describe('getCategories', () => {
    it('返回去重分类列表', () => {
      registerNode(mockNode);
      registerNode({ ...mockNode, type: 'test.mul' });
      registerNode({ ...mockNode, type: 'other.node', category: '其他' });
      const cats = getCategories();
      expect(cats).toContain('测试');
      expect(cats).toContain('其他');
      expect(cats.length).toBe(2);
    });
  });

  describe('registerBuiltinNodes', () => {
    it('注册后有内置节点', () => {
      registerBuiltinNodes();
      const all = getAllNodeDefinitions();
      expect(all.length).toBeGreaterThan(0);
    });

    it('包含基础运算节点', () => {
      registerBuiltinNodes();
      expect(getNodeDefinition('math.add')).toBeDefined();
      expect(getNodeDefinition('math.subtract')).toBeDefined();
      expect(getNodeDefinition('math.multiply')).toBeDefined();
      expect(getNodeDefinition('math.divide')).toBeDefined();
    });

    it('包含数学函数节点', () => {
      registerBuiltinNodes();
      expect(getNodeDefinition('math.sin')).toBeDefined();
      expect(getNodeDefinition('math.cos')).toBeDefined();
      expect(getNodeDefinition('math.sqrt')).toBeDefined();
    });

    it('包含输入输出节点', () => {
      registerBuiltinNodes();
      expect(getNodeDefinition('input.number')).toBeDefined();
      expect(getNodeDefinition('output.display')).toBeDefined();
    });

    it('包含常量节点', () => {
      registerBuiltinNodes();
      expect(getNodeDefinition('const.pi')).toBeDefined();
      expect(getNodeDefinition('const.e')).toBeDefined();
    });

    it('内置节点compute函数可正常执行', () => {
      registerBuiltinNodes();
      const addDef = getNodeDefinition('math.add')!;
      const result = addDef.compute(new Map([['a', 3], ['b', 5]]));
      expect(result.get('result')).toBe(8);
    });

    it('除法除零返回NaN', () => {
      registerBuiltinNodes();
      const divDef = getNodeDefinition('math.divide')!;
      const result = divDef.compute(new Map([['a', 10], ['b', 0]]));
      expect(isNaN(result.get('result') as number)).toBe(true);
    });

    it('pi常量节点返回Math.PI', () => {
      registerBuiltinNodes();
      const piDef = getNodeDefinition('const.pi')!;
      const result = piDef.compute(new Map());
      expect(result.get('value')).toBeCloseTo(Math.PI);
    });
  });

  describe('data.map 安全表达式求值', () => {
    beforeEach(() => {
      registerBuiltinNodes();
    });

    it('支持基本算术表达式', () => {
      const mapDef = getNodeDefinition('data.map')!;
      const result = mapDef.compute(new Map([
        ['array', [1, 2, 3]],
        ['operation', 'x * 2'],
      ]));
      expect(result.get('result')).toEqual([2, 4, 6]);
    });

    it('支持幂运算', () => {
      const mapDef = getNodeDefinition('data.map')!;
      const result = mapDef.compute(new Map([
        ['array', [2, 3, 4]],
        ['operation', 'x ^ 2'],
      ]));
      expect(result.get('result')).toEqual([4, 9, 16]);
    });

    it('支持括号表达式', () => {
      const mapDef = getNodeDefinition('data.map')!;
      const result = mapDef.compute(new Map([
        ['array', [1, 2, 3]],
        ['operation', '(x + 1) * 2'],
      ]));
      expect(result.get('result')).toEqual([4, 6, 8]);
    });

    it('支持白名单数学函数', () => {
      const mapDef = getNodeDefinition('data.map')!;
      const result = mapDef.compute(new Map([
        ['array', [0, Math.PI / 2]],
        ['operation', 'sin(x)'],
      ]));
      const values = result.get('result') as number[];
      expect(values[0]).toBeCloseTo(0, 2);
      expect(values[1]).toBeCloseTo(1, 2);
    });

    it('支持 sqrt, abs, log 等函数', () => {
      const mapDef = getNodeDefinition('data.map')!;
      const result = mapDef.compute(new Map([
        ['array', [4, -3, 1]],
        ['operation', 'sqrt(abs(x))'],
      ]));
      expect(result.get('result')).toEqual([2, Math.round(Math.sqrt(3) * 1000) / 1000, 1]);
    });

    it('空数组返回空结果', () => {
      const mapDef = getNodeDefinition('data.map')!;
      const result = mapDef.compute(new Map([
        ['array', []],
        ['operation', 'x * 2'],
      ]));
      expect(result.get('result')).toEqual([]);
    });

    it('默认表达式为 x（恒等）', () => {
      const mapDef = getNodeDefinition('data.map')!;
      const result = mapDef.compute(new Map([
        ['array', [1, 2, 3]],
      ]));
      expect(result.get('result')).toEqual([1, 2, 3]);
    });

    describe('安全测试 - 拒绝恶意输入', () => {
      it('拒绝 alert() 调用', () => {
        const mapDef = getNodeDefinition('data.map')!;
        const result = mapDef.compute(new Map([
          ['array', [1, 2, 3]],
          ['operation', 'alert(1)'],
        ]));
        const values = result.get('result') as number[];
        expect(values).toEqual([0, 0, 0]);
      });

      it('拒绝 document.querySelector', () => {
        const mapDef = getNodeDefinition('data.map')!;
        const result = mapDef.compute(new Map([
          ['array', [1]],
          ['operation', 'document.querySelector("body")'],
        ]));
        const values = result.get('result') as number[];
        expect(values).toEqual([0]);
      });

      it('拒绝 window.location', () => {
        const mapDef = getNodeDefinition('data.map')!;
        const result = mapDef.compute(new Map([
          ['array', [1]],
          ['operation', 'window.location'],
        ]));
        const values = result.get('result') as number[];
        expect(values).toEqual([0]);
      });

      it('拒绝 eval() 调用', () => {
        const mapDef = getNodeDefinition('data.map')!;
        const result = mapDef.compute(new Map([
          ['array', [1]],
          ['operation', 'eval("alert(1)")'],
        ]));
        const values = result.get('result') as number[];
        expect(values).toEqual([0]);
      });

      it('拒绝 fetch() 调用', () => {
        const mapDef = getNodeDefinition('data.map')!;
        const result = mapDef.compute(new Map([
          ['array', [1]],
          ['operation', 'fetch("http://evil.com")'],
        ]));
        const values = result.get('result') as number[];
        expect(values).toEqual([0]);
      });

      it('拒绝 process.exit', () => {
        const mapDef = getNodeDefinition('data.map')!;
        const result = mapDef.compute(new Map([
          ['array', [1]],
          ['operation', 'process.exit()'],
        ]));
        const values = result.get('result') as number[];
        expect(values).toEqual([0]);
      });

      it('拒绝 require() 调用', () => {
        const mapDef = getNodeDefinition('data.map')!;
        const result = mapDef.compute(new Map([
          ['array', [1]],
          ['operation', 'require("fs")'],
        ]));
        const values = result.get('result') as number[];
        expect(values).toEqual([0]);
      });

      it('拒绝 __proto__ 访问', () => {
        const mapDef = getNodeDefinition('data.map')!;
        const result = mapDef.compute(new Map([
          ['array', [1]],
          ['operation', '__proto__'],
        ]));
        const values = result.get('result') as number[];
        expect(values).toEqual([0]);
      });

      it('拒绝构造函数链', () => {
        const mapDef = getNodeDefinition('data.map')!;
        const result = mapDef.compute(new Map([
          ['array', [1]],
          ['operation', 'constructor.constructor("return this")()'],
        ]));
        const values = result.get('result') as number[];
        expect(values).toEqual([0]);
      });

      it('拒绝箭头函数语法', () => {
        const mapDef = getNodeDefinition('data.map')!;
        const result = mapDef.compute(new Map([
          ['array', [1]],
          ['operation', '()=>alert(1)'],
        ]));
        const values = result.get('result') as number[];
        expect(values).toEqual([0]);
      });

      it('拒绝分号注入', () => {
        const mapDef = getNodeDefinition('data.map')!;
        const result = mapDef.compute(new Map([
          ['array', [1]],
          ['operation', 'x;alert(1)'],
        ]));
        const values = result.get('result') as number[];
        expect(values).toEqual([0]);
      });

      it('拒绝模板字符串', () => {
        const mapDef = getNodeDefinition('data.map')!;
        const result = mapDef.compute(new Map([
          ['array', [1]],
          ['operation', '`alert(1)`'],
        ]));
        const values = result.get('result') as number[];
        expect(values).toEqual([0]);
      });

      it('拒绝大写函数名绕过', () => {
        const mapDef = getNodeDefinition('data.map')!;
        const result = mapDef.compute(new Map([
          ['array', [1]],
          ['operation', 'ALERT(1)'],
        ]));
        const values = result.get('result') as number[];
        expect(values).toEqual([0]);
      });

      it('拒绝特殊字符注入', () => {
        const mapDef = getNodeDefinition('data.map')!;
        const result = mapDef.compute(new Map([
          ['array', [1]],
          ['operation', 'x + "\\""'],
        ]));
        const values = result.get('result') as number[];
        expect(values).toEqual([0]);
      });

      it('拒绝 this 关键字', () => {
        const mapDef = getNodeDefinition('data.map')!;
        const result = mapDef.compute(new Map([
          ['array', [1]],
          ['operation', 'this'],
        ]));
        const values = result.get('result') as number[];
        expect(values).toEqual([0]);
      });

      it('拒绝 var/let/const 声明', () => {
        const mapDef = getNodeDefinition('data.map')!;
        const result = mapDef.compute(new Map([
          ['array', [1]],
          ['operation', 'var a = 1'],
        ]));
        const values = result.get('result') as number[];
        expect(values).toEqual([0]);
      });
    });
  });
});
