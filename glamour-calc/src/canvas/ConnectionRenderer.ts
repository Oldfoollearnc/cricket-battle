/**
 * ConnectionRenderer - 连线渲染器
 * 在 PixiJS 世界坐标系中绘制节点间的连线（贝塞尔曲线）
 * 支持绘制已完成连线和正在拖拽中的临时连线
 */

import * as PIXI from 'pixi.js';
import { Connection } from '../types';

const LINE_COLOR = 0x6c5ce7;
const LINE_WIDTH = 2;
const TEMP_LINE_COLOR = 0xfd79a8;

/**
 * 渲染所有已有连线
 */
export function renderConnections(
  connections: Connection[],
  portPositionGetter: (nodeId: string, portName: string, isOutput: boolean) => { x: number; y: number } | null
): PIXI.Graphics {
  const gfx = new PIXI.Graphics();
  gfx.name = '__connections__';

  for (const conn of connections) {
    const from = portPositionGetter(conn.sourceNodeId, conn.sourcePort, true);
    const to = portPositionGetter(conn.targetNodeId, conn.targetPort, false);
    if (!from || !to) continue;

    drawBezierCurve(gfx, from.x, from.y, to.x, to.y, LINE_COLOR, LINE_WIDTH);
  }

  return gfx;
}

/**
 * 渲染临时连线（拖拽中）
 */
export function renderTempConnection(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): PIXI.Graphics {
  const gfx = new PIXI.Graphics();
  drawBezierCurve(gfx, fromX, fromY, toX, toY, TEMP_LINE_COLOR, LINE_WIDTH);
  return gfx;
}

/**
 * 绘制贝塞尔曲线连线
 * 控制点偏移量基于水平距离，产生自然的曲线弧度
 */
function drawBezierCurve(
  gfx: PIXI.Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: number,
  width: number
): void {
  const dx = Math.abs(x2 - x1);
  const cpOffset = Math.max(50, dx * 0.4);

  gfx.lineStyle(width, color, 0.8);
  gfx.moveTo(x1, y1);
  gfx.bezierCurveTo(
    x1 + cpOffset, y1,
    x2 - cpOffset, y2,
    x2, y2
  );
}
