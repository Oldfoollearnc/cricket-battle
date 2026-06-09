/**
 * RecommendationEngine - 上下文智能联想引擎
 * 基于当前选中节点的类型和端口数据类型，推荐相关的计算节点
 * 使用规则引擎 + 使用频率统计实现
 */

import { NodeRecommendation, GraphContext, CanvasNode } from '../types';
import { getNodeDefinition, getAllNodeDefinitions } from '../engine/NodeRegistry';
import { NodeDefinition } from '../types';

// 节点使用频率统计（内存中，会话级别）
const usageStats = new Map<string, number>();

/** 记录一次节点使用 */
export function recordNodeUsage(nodeType: string): void {
  usageStats.set(nodeType, (usageStats.get(nodeType) ?? 0) + 1);
}

/** 获取使用频率 */
export function getUsageStats(): Map<string, number> {
  return new Map(usageStats);
}

// 规则：节点类型之间的推荐关系
const RECOMMENDATION_RULES: Record<string, { target: string; reason: string; score: number }[]> = {
  // 数学函数 -> 相关函数和输出
  'math.sin': [
    { target: 'math.cos', reason: '三角函数常用组合', score: 0.9 },
    { target: 'const.pi', reason: 'pi 是三角函数常用输入', score: 0.85 },
    { target: 'output.chart', reason: '可视化波形', score: 0.7 },
    { target: 'output.formula', reason: '显示公式结果', score: 0.6 },
  ],
  'math.cos': [
    { target: 'math.sin', reason: '三角函数常用组合', score: 0.9 },
    { target: 'const.pi', reason: 'pi 是三角函数常用输入', score: 0.85 },
    { target: 'output.chart', reason: '可视化波形', score: 0.7 },
  ],
  'math.sqrt': [
    { target: 'math.power', reason: '平方根和幂运算互逆', score: 0.8 },
    { target: 'math.abs', reason: '确保非负输入', score: 0.6 },
    { target: 'output.display', reason: '显示计算结果', score: 0.5 },
  ],
  'math.log': [
    { target: 'math.power', reason: '对数和指数互逆', score: 0.8 },
    { target: 'const.e', reason: '自然对数的底数', score: 0.85 },
    { target: 'output.formula', reason: '显示对数公式', score: 0.6 },
  ],
  // 基础运算 -> 下一步操作
  'math.add': [
    { target: 'output.display', reason: '显示计算结果', score: 0.7 },
    { target: 'math.multiply', reason: '常用连续运算', score: 0.5 },
    { target: 'stats.mean', reason: '求和后求平均', score: 0.6 },
  ],
  'math.subtract': [
    { target: 'math.abs', reason: '取绝对值', score: 0.6 },
    { target: 'output.display', reason: '显示结果', score: 0.7 },
  ],
  'math.multiply': [
    { target: 'math.add', reason: '乘法后常接加法', score: 0.5 },
    { target: 'output.display', reason: '显示结果', score: 0.7 },
  ],
  'math.divide': [
    { target: 'output.display', reason: '显示结果', score: 0.7 },
    { target: 'math.abs', reason: '取绝对值', score: 0.4 },
  ],
  'math.power': [
    { target: 'math.sqrt', reason: '幂运算和平方根互逆', score: 0.8 },
    { target: 'output.display', reason: '显示结果', score: 0.7 },
  ],
  // 常量 -> 常用搭配
  'const.pi': [
    { target: 'math.sin', reason: 'pi 常用于三角函数', score: 0.9 },
    { target: 'math.cos', reason: 'pi 常用于三角函数', score: 0.85 },
    { target: 'math.multiply', reason: 'pi 常参与乘法运算', score: 0.6 },
  ],
  'const.e': [
    { target: 'math.log', reason: '自然对数', score: 0.9 },
    { target: 'math.power', reason: '指数运算', score: 0.7 },
  ],
  // 统计
  'stats.mean': [
    { target: 'output.display', reason: '显示平均值', score: 0.7 },
    { target: 'output.chart', reason: '可视化数据', score: 0.6 },
  ],
  // 输入
  'input.number': [
    { target: 'math.add', reason: '输入值常参与运算', score: 0.7 },
    { target: 'math.multiply', reason: '输入值常参与运算', score: 0.6 },
    { target: 'output.display', reason: '直接显示输入值', score: 0.5 },
  ],
  // 数据节点
  'data.array': [
    { target: 'output.chart', reason: '数组数据可视化', score: 0.9 },
    { target: 'output.table', reason: '数组数据表格展示', score: 0.8 },
    { target: 'data.map', reason: '对数组元素映射变换', score: 0.7 },
  ],
  'data.sequence': [
    { target: 'output.chart', reason: '序列数据可视化', score: 0.9 },
    { target: 'data.map', reason: '对序列元素映射变换', score: 0.7 },
    { target: 'math.sin', reason: '生成三角函数输入', score: 0.6 },
  ],
  'data.map': [
    { target: 'output.chart', reason: '映射结果可视化', score: 0.85 },
    { target: 'output.table', reason: '映射结果表格展示', score: 0.7 },
  ],
  // 输出节点 -> 无进一步推荐
  'output.display': [],
  'output.chart': [],
  'output.formula': [],
  'output.text': [],
  'output.table': [],
};

/**
 * 根据选中节点推荐相关节点
 */
export function recommend(selectedNodeId: string, graph: GraphContext): NodeRecommendation[] {
  const selectedNode = graph.nodes.find((n) => n.id === selectedNodeId);
  if (!selectedNode) return [];

  const def = getNodeDefinition(selectedNode.type);
  if (!def) return [];

  const recommendations: NodeRecommendation[] = [];

  // 1. 规则引擎推荐
  const rules = RECOMMENDATION_RULES[selectedNode.type] ?? [];
  for (const rule of rules) {
    const targetDef = getNodeDefinition(rule.target);
    if (!targetDef) continue;

    // 检查是否已经在图中存在该类型节点（避免重复推荐）
    const existingCount = graph.nodes.filter((n) => n.type === rule.target).length;
    const adjustedScore = existingCount > 0 ? rule.score * 0.5 : rule.score;

    // 找到可能的连接端口
    const suggestedConnection = findConnectionPort(def, targetDef);

    recommendations.push({
      nodeType: rule.target,
      reason: rule.reason,
      score: adjustedScore,
      suggestedConnection,
    });
  }

  // 2. 基于输出数据类型匹配推荐
  for (const outPort of def.outputPorts) {
    const compatibleNodes = findCompatibleNodes(outPort.dataType, selectedNode.type);
    for (const { nodeType, inputPort, score } of compatibleNodes) {
      // 避免重复
      if (recommendations.some((r) => r.nodeType === nodeType)) continue;

      const targetDef = getNodeDefinition(nodeType);
      if (!targetDef) continue;

      recommendations.push({
        nodeType,
        reason: `输出类型 ${outPort.dataType} 可连接到 ${inputPort}`,
        score,
        suggestedConnection: {
          sourcePort: outPort.name,
          targetPort: inputPort,
        },
      });
    }
  }

  // 3. 使用频率加成
  for (const rec of recommendations) {
    const usageCount = usageStats.get(rec.nodeType) ?? 0;
    rec.score = Math.min(1, rec.score + usageCount * 0.02);
  }

  // 按分数排序，取前 6 个
  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

/**
 * 根据悬停的端口推荐可连接的节点
 */
export function recommendForPort(
  nodeId: string,
  portName: string,
  isOutput: boolean,
  graph: GraphContext
): NodeRecommendation[] {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return [];

  const def = getNodeDefinition(node.type);
  if (!def) return [];

  const port = isOutput
    ? def.outputPorts.find((p) => p.name === portName)
    : def.inputPorts.find((p) => p.name === portName);

  if (!port) return [];

  const compatibleNodes = findCompatibleNodes(port.dataType, node.type);

  return compatibleNodes
    .map(({ nodeType, inputPort, score }) => {
      const targetDef = getNodeDefinition(nodeType);
      return {
        nodeType,
        reason: `端口 ${portName} (${port.dataType}) 可连接`,
        score,
        suggestedConnection: isOutput
          ? { sourcePort: portName, targetPort: inputPort }
          : { sourcePort: inputPort, targetPort: portName },
      };
    })
    .filter((r) => !!getNodeDefinition(r.nodeType))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

// ============================================
// 内部辅助函数
// ============================================

/** 查找输出端口和输入端口之间的最佳连接 */
function findConnectionPort(
  sourceDef: NodeDefinition,
  targetDef: NodeDefinition
): { sourcePort: string; targetPort: string } | undefined {
  for (const outPort of sourceDef.outputPorts) {
    for (const inPort of targetDef.inputPorts) {
      if (outPort.dataType === inPort.dataType || inPort.dataType === 'string') {
        return { sourcePort: outPort.name, targetPort: inPort.name };
      }
    }
  }
  return undefined;
}

/** 查找接受指定数据类型的节点 */
function findCompatibleNodes(
  dataType: string,
  excludeType: string
): Array<{ nodeType: string; inputPort: string; score: number }> {
  const results: Array<{ nodeType: string; inputPort: string; score: number }> = [];

  for (const def of getAllNodeDefinitions()) {
    if (def.type === excludeType) continue;
    if (def.type.startsWith('output.')) continue; // 输出节点不自动推荐

    for (const inPort of def.inputPorts) {
      if (inPort.dataType === dataType || dataType === 'string') {
        // 精确匹配得分更高
        const score = inPort.dataType === dataType ? 0.6 : 0.3;
        results.push({
          nodeType: def.type,
          inputPort: inPort.name,
          score,
        });
        break; // 只取第一个匹配端口
      }
    }
  }

  return results;
}
