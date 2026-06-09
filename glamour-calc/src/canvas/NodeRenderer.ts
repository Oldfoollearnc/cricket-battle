/**
 * NodeRenderer - 计算节点渲染器
 * 在 PixiJS 世界坐标系中绘制计算节点：
 *   - 圆角矩形背景
 *   - 节点标题
 *   - 输入/输出端口（带连接点）
 *   - 状态指示（idle/computing/error/done）
 */

import * as PIXI from 'pixi.js';
import { CanvasNode, NodeDefinition, Value } from '../types';
import { getNodeDefinition } from '../engine/NodeRegistry';

const NODE_WIDTH = 180;
const NODE_HEADER_HEIGHT = 32;
const PORT_HEIGHT = 24;
const PORT_RADIUS = 6;
const PORT_GAP = 8;

/** 状态对应的颜色 */
const STATUS_COLORS: Record<string, number> = {
  idle: 0x3a3a4e,
  computing: 0x6c5ce7,
  error: 0xd63031,
  done: 0x00b894,
};

export interface RenderedNode {
  container: PIXI.Container;
  node: CanvasNode;
  /** 输入端口的世界坐标 {portName: {x, y}} */
  inputPortPositions: Map<string, { x: number; y: number }>;
  /** 输出端口的世界坐标 */
  outputPortPositions: Map<string, { x: number; y: number }>;
  /** 更新节点数据后重新渲染 */
  update: (node: CanvasNode) => void;
}

/**
 * 渲染单个计算节点，返回容器和端口坐标
 */
export function renderNode(node: CanvasNode): RenderedNode {
  const def = getNodeDefinition(node.type);
  const container = new PIXI.Container();
  container.name = `node_${node.id}`;
  container.position.set(node.position.x, node.position.y);

  const inputPortPositions = new Map<string, { x: number; y: number }>();
  const outputPortPositions = new Map<string, { x: number; y: number }>();

  function draw(n: CanvasNode) {
    container.removeChildren();

    const inputCount = def?.inputPorts.length ?? 0;
    const outputCount = def?.outputPorts.length ?? 0;
    const bodyHeight = Math.max(inputCount, outputCount) * PORT_HEIGHT + PORT_GAP;
    const totalHeight = NODE_HEADER_HEIGHT + bodyHeight;

    // 背景
    const bg = new PIXI.Graphics();
    bg.beginFill(0x1a1a2e);
    bg.lineStyle(2, STATUS_COLORS[n.status] ?? 0x3a3a4e, 1);
    bg.drawRoundedRect(0, 0, NODE_WIDTH, totalHeight, 8);
    bg.endFill();
    container.addChild(bg);

    // 标题栏
    const header = new PIXI.Graphics();
    header.beginFill(def?.color ? parseInt(def.color.replace('#', ''), 16) : 0x6c5ce7, 0.3);
    header.drawRoundedRect(0, 0, NODE_WIDTH, NODE_HEADER_HEIGHT, 8);
    // 补齐底部圆角
    header.drawRect(0, NODE_HEADER_HEIGHT - 8, NODE_WIDTH, 8);
    header.endFill();
    container.addChild(header);

    // 标题文字
    const title = new PIXI.Text(n.label || def?.label || n.type, {
      fontFamily: 'Arial',
      fontSize: 13,
      fontWeight: 'bold',
      fill: 0xffffff,
    });
    title.anchor.set(0, 0.5);
    title.position.set(10, NODE_HEADER_HEIGHT / 2);
    container.addChild(title);

    // 输入端口
    inputPortPositions.clear();
    const ports = def?.inputPorts ?? [];
    for (let i = 0; i < ports.length; i++) {
      const port = ports[i];
      const y = NODE_HEADER_HEIGHT + PORT_GAP + i * PORT_HEIGHT + PORT_HEIGHT / 2;
      const x = 0;

      // 端口圆点
      const dot = new PIXI.Graphics();
      const hasValue = n.inputs.has(port.name);
      dot.beginFill(hasValue ? 0x00cec9 : 0x555577);
      dot.drawCircle(x, y, PORT_RADIUS);
      dot.endFill();
      container.addChild(dot);

      // 端口名
      const label = new PIXI.Text(port.name, {
        fontFamily: 'Arial',
        fontSize: 11,
        fill: 0xaaaaaa,
      });
      label.anchor.set(0, 0.5);
      label.position.set(PORT_RADIUS + 4, y);
      container.addChild(label);

      // 显示输入值
      const val = n.inputs.get(port.name);
      if (val !== undefined) {
        const valText = new PIXI.Text(String(val), {
          fontFamily: 'Arial',
          fontSize: 11,
          fill: 0x00cec9,
        });
        valText.anchor.set(1, 0.5);
        valText.position.set(NODE_WIDTH - 10, y);
        container.addChild(valText);
      }

      inputPortPositions.set(port.name, { x: node.position.x + x, y: node.position.y + y });
    }

    // 输出端口
    outputPortPositions.clear();
    const outPorts = def?.outputPorts ?? [];
    for (let i = 0; i < outPorts.length; i++) {
      const port = outPorts[i];
      const y = NODE_HEADER_HEIGHT + PORT_GAP + i * PORT_HEIGHT + PORT_HEIGHT / 2;
      const x = NODE_WIDTH;

      const dot = new PIXI.Graphics();
      const hasValue = n.outputs.has(port.name);
      dot.beginFill(hasValue ? 0x00b894 : 0x555577);
      dot.drawCircle(x, y, PORT_RADIUS);
      dot.endFill();
      container.addChild(dot);

      // 端口名
      const label = new PIXI.Text(port.name, {
        fontFamily: 'Arial',
        fontSize: 11,
        fill: 0xaaaaaa,
      });
      label.anchor.set(1, 0.5);
      label.position.set(x - PORT_RADIUS - 4, y);
      container.addChild(label);

      // 显示输出值
      const val = n.outputs.get(port.name);
      if (val !== undefined) {
        const valText = new PIXI.Text(formatValue(val), {
          fontFamily: 'Arial',
          fontSize: 11,
          fill: 0x00b894,
        });
        valText.anchor.set(0, 0.5);
        valText.position.set(10, y);
        // 输出值显示在右半部分
        container.addChild(valText);
      }

      outputPortPositions.set(port.name, { x: node.position.x + x, y: node.position.y + y });
    }

    // 状态指示小圆点
    if (n.status !== 'idle') {
      const indicator = new PIXI.Graphics();
      indicator.beginFill(STATUS_COLORS[n.status]);
      indicator.drawCircle(NODE_WIDTH - 12, NODE_HEADER_HEIGHT / 2, 4);
      indicator.endFill();
      container.addChild(indicator);
    }
  }

  draw(node);

  return {
    container,
    node,
    inputPortPositions,
    outputPortPositions,
    update: (n: CanvasNode) => {
      container.position.set(n.position.x, n.position.y);
      draw(n);
    },
  };
}

function formatValue(v: Value): string {
  if (typeof v === 'number') {
    return Number.isInteger(v) ? String(v) : v.toFixed(4);
  }
  return String(v);
}
