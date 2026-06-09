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

  // ============================================
  // 多模态输出节点
  // ============================================

  // 图表输出：接收数组/表格数据，用 ECharts 渲染
  registerNode({
    type: 'output.chart',
    label: '图表',
    category: '多模态输出',
    color: '#e17055',
    inputPorts: [
      { name: 'data', dataType: 'array', required: true },
      { name: 'xLabel', dataType: 'string', required: false },
      { name: 'yLabel', dataType: 'string', required: false },
    ],
    outputPorts: [],
    compute: (inputs) => {
      // 图表节点只透传数据，渲染由 Overlay 层处理
      const data = inputs.get('data');
      return new Map([['data', data ?? []]]);
    },
  });

  // 公式输出：接收数值/表达式，用 KaTeX 渲染 LaTeX
  registerNode({
    type: 'output.formula',
    label: '公式',
    category: '多模态输出',
    color: '#e17055',
    inputPorts: [
      { name: 'value', dataType: 'number', required: true },
      { name: 'template', dataType: 'string', required: false },
    ],
    outputPorts: [],
    compute: (inputs) => {
      const value = inputs.get('value');
      const template = inputs.get('template');
      // 如果有模板，用模板渲染；否则直接显示数值
      return new Map([
        ['value', value ?? 0],
        ['template', template ?? ''],
      ]);
    },
  });

  // 文本输出：接收任意值，富文本格式化
  registerNode({
    type: 'output.text',
    label: '文本',
    category: '多模态输出',
    color: '#e17055',
    inputPorts: [
      { name: 'value', dataType: 'string', required: true },
      { name: 'format', dataType: 'string', required: false },
    ],
    outputPorts: [],
    compute: (inputs) => {
      return new Map([
        ['value', inputs.get('value') ?? ''],
        ['format', inputs.get('format') ?? 'plain'],
      ]);
    },
  });

  // 表格输出：接收表格数据，HTML 表格渲染
  registerNode({
    type: 'output.table',
    label: '表格',
    category: '多模态输出',
    color: '#e17055',
    inputPorts: [
      { name: 'data', dataType: 'table', required: true },
      { name: 'columns', dataType: 'string', required: false },
    ],
    outputPorts: [],
    compute: (inputs) => {
      return new Map([
        ['data', inputs.get('data') ?? {}],
        ['columns', inputs.get('columns') ?? ''],
      ]);
    },
  });

  // 数组生成器：生成测试数据数组
  registerNode({
    type: 'data.array',
    label: '数组',
    category: '数据',
    color: '#00b894',
    inputPorts: [
      { name: 'values', dataType: 'string', required: true },
    ],
    outputPorts: [
      { name: 'array', dataType: 'array', required: false },
    ],
    compute: (inputs) => {
      const raw = String(inputs.get('values') ?? '');
      const arr = raw.split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
      return new Map([['array', arr]]);
    },
  });

  // 序列生成器：生成等差数列
  registerNode({
    type: 'data.sequence',
    label: '序列',
    category: '数据',
    color: '#00b894',
    inputPorts: [
      { name: 'start', dataType: 'number', required: true },
      { name: 'end', dataType: 'number', required: true },
      { name: 'step', dataType: 'number', required: false },
    ],
    outputPorts: [
      { name: 'array', dataType: 'array', required: false },
    ],
    compute: (inputs) => {
      const start = numInput(inputs, 'start');
      const end = numInput(inputs, 'end');
      const step = numInput(inputs, 'step') || 1;
      const arr: number[] = [];
      for (let i = start; i <= end; i += step) {
        arr.push(Math.round(i * 1000) / 1000);
      }
      return new Map([['array', arr]]);
    },
  });

  // [R1-9] 安全表达式求值：递归下降解析器，禁止代码注入
  // 不使用 eval / new Function，通过解析器直接计算数值表达式
  const SAFE_FUNCTIONS: Record<string, (v: number) => number> = {
    'sin': Math.sin,
    'cos': Math.cos,
    'tan': Math.tan,
    'sqrt': Math.sqrt,
    'log': Math.log,
    'abs': Math.abs,
    'ceil': Math.ceil,
    'floor': Math.floor,
    'round': Math.round,
  };

  /**
   * 安全表达式求值器（递归下降）
   * 支持：数字、变量 x、+ - * / ^、括号、白名单函数调用
   * 禁止：任何其他标识符或语法结构
   */
  function safeEvaluate(expr: string, x: number): number {
    const src = expr.trim();
    let pos = 0;

    function peek(): string {
      skipSpaces();
      return pos < src.length ? src[pos] : '';
    }

    function skipSpaces(): void {
      while (pos < src.length && src[pos] === ' ') pos++;
    }

    function consume(expected?: string): string {
      skipSpaces();
      if (expected && src.slice(pos, pos + expected.length) !== expected) {
        throw new Error(`期望 "${expected}" 但在位置 ${pos} 遇到 "${src[pos] ?? 'EOF'}"`);
      }
      if (expected) {
        pos += expected.length;
        return expected;
      }
      const ch = src[pos];
      pos++;
      return ch;
    }

    // 解析表达式: expr = term (('+' | '-') term)*
    function parseExpr(): number {
      let result = parseTerm();
      while (true) {
        const ch = peek();
        if (ch === '+') { consume('+'); result += parseTerm(); }
        else if (ch === '-') { consume('-'); result -= parseTerm(); }
        else break;
      }
      return result;
    }

    // 解析项: term = power (('*' | '/') power)*
    function parseTerm(): number {
      let result = parsePower();
      while (true) {
        const ch = peek();
        if (ch === '*') { consume('*'); result *= parsePower(); }
        else if (ch === '/') { consume('/'); const d = parsePower(); result = d === 0 ? NaN : result / d; }
        else break;
      }
      return result;
    }

    // 解析幂: power = unary ('^' unary)*
    function parsePower(): number {
      let result = parseUnary();
      while (peek() === '^') {
        consume('^');
        result = Math.pow(result, parseUnary());
      }
      return result;
    }

    // 解析一元: unary = ('+' | '-')? atom
    function parseUnary(): number {
      const ch = peek();
      if (ch === '+') { consume('+'); return parseAtom(); }
      if (ch === '-') { consume('-'); return -parseAtom(); }
      return parseAtom();
    }

    // 解析原子: number | 'x' | '(' expr ')' | func '(' expr ')'
    function parseAtom(): number {
      skipSpaces();
      const ch = peek();

      // 数字
      if (ch >= '0' && ch <= '9' || ch === '.') {
        return parseNumber();
      }

      // 变量 x
      if (ch === 'x') {
        consume('x');
        return x;
      }

      // 括号或函数调用
      if (ch === '(') {
        consume('(');
        const val = parseExpr();
        consume(')');
        return val;
      }

      // 标识符（函数名）
      if (ch >= 'a' && ch <= 'z') {
        const name = parseIdentifier();
        if (!(name in SAFE_FUNCTIONS)) {
          throw new Error(`不允许的函数: ${name}`);
        }
        consume('(');
        const arg = parseExpr();
        consume(')');
        return SAFE_FUNCTIONS[name](arg);
      }

      throw new Error(`无法解析的字符 "${ch}" 在位置 ${pos}`);
    }

    function parseNumber(): number {
      skipSpaces();
      let numStr = '';
      while (pos < src.length && ((src[pos] >= '0' && src[pos] <= '9') || src[pos] === '.')) {
        numStr += src[pos];
        pos++;
      }
      const val = parseFloat(numStr);
      if (isNaN(val)) throw new Error(`无效数字: ${numStr}`);
      return val;
    }

    function parseIdentifier(): string {
      skipSpaces();
      let name = '';
      while (pos < src.length && src[pos] >= 'a' && src[pos] <= 'z') {
        name += src[pos];
        pos++;
      }
      if (!name) throw new Error(`期望标识符但在位置 ${pos}`);
      return name;
    }

    const result = parseExpr();
    skipSpaces();
    if (pos < src.length) {
      throw new Error(`表达式末尾有多余字符: "${src.slice(pos)}"`);
    }
    return result;
  }

  // 映射节点：对数组每个元素执行运算
  registerNode({
    type: 'data.map',
    label: '映射',
    category: '数据',
    color: '#00b894',
    inputPorts: [
      { name: 'array', dataType: 'array', required: true },
      { name: 'operation', dataType: 'string', required: true },
    ],
    outputPorts: [
      { name: 'result', dataType: 'array', required: false },
    ],
    compute: (inputs) => {
      const raw = inputs.get('array');
      const arr = Array.isArray(raw) ? raw as number[] : [];
      const op = String(inputs.get('operation') ?? 'x');
      // 支持简单表达式: x*2, x+1, x^2, sin(x), sqrt(x)
      const result = arr.map((x) => {
        try {
          const val = safeEvaluate(op, x);
          return typeof val === 'number' ? Math.round(val * 1000) / 1000 : 0;
        } catch {
          return 0;
        }
      });
      return new Map([['result', result]]);
    },
  });
}
