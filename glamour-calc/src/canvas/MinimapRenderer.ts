/**
 * MinimapRenderer - 小地图渲染器
 * 在画布右下角显示缩略图，帮助用户在大画布上定位
 * 使用 PixiJS Graphics 绘制节点和连线的缩略表示
 */

import * as PIXI from 'pixi.js';
import { CanvasNode, Connection, Viewport } from '../types';

const MINIMAP_WIDTH = 160;
const MINIMAP_HEIGHT = 100;
const MINIMAP_PADDING = 8;
const NODE_DOT_SIZE = 3;

export class MinimapRenderer {
  private _container: PIXI.Container;
  private _bg: PIXI.Graphics;
  private _content: PIXI.Graphics;
  private _viewportIndicator: PIXI.Graphics;

  constructor(parentContainer: PIXI.Container, canvasWidth: number, canvasHeight: number) {
    this._container = new PIXI.Container();
    this._container.name = '__minimap__';
    this._container.zIndex = 999;

    // 背景
    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x0f0f1a, 0.85);
    this._bg.lineStyle(1, 0x3a3a4e, 0.8);
    this._bg.drawRoundedRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT, 4);
    this._bg.endFill();
    this._container.addChild(this._bg);

    // 内容层
    this._content = new PIXI.Graphics();
    this._container.addChild(this._content);

    // 视口指示器
    this._viewportIndicator = new PIXI.Graphics();
    this._container.addChild(this._viewportIndicator);

    parentContainer.addChild(this._container);

    // 初始定位到右下角
    this.reposition(canvasWidth, canvasHeight);
  }

  /** 重新定位小地图到右下角 */
  reposition(canvasWidth: number, canvasHeight: number): void {
    this._container.x = canvasWidth - MINIMAP_WIDTH - MINIMAP_PADDING;
    this._container.y = canvasHeight - MINIMAP_HEIGHT - MINIMAP_PADDING;
  }

  /**
   * 更新小地图内容
   * @param nodes 所有节点
   * @param connections 所有连线
   * @param viewport 当前视口
   * @param canvasWidth 画布宽度
   * @param canvasHeight 画布高度
   */
  update(
    nodes: CanvasNode[],
    connections: Connection[],
    viewport: Viewport,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    this._content.clear();

    if (nodes.length === 0) {
      this._viewportIndicator.clear();
      return;
    }

    // 计算节点的世界坐标包围盒
    const bounds = this.calculateBounds(nodes);
    const worldWidth = bounds.maxX - bounds.minX + 200; // 额外边距
    const worldHeight = bounds.maxY - bounds.minY + 100;

    // 缩放因子：将世界坐标映射到小地图尺寸
    const contentW = MINIMAP_WIDTH - 12;
    const contentH = MINIMAP_HEIGHT - 12;
    const scaleX = contentW / Math.max(worldWidth, 1);
    const scaleY = contentH / Math.max(worldHeight, 1);
    const scale = Math.min(scaleX, scaleY);

    const offsetX = 6;
    const offsetY = 6;

    // 绘制连线
    this._content.lineStyle(0.5, 0x6c5ce7, 0.3);
    for (const conn of connections) {
      const srcNode = nodes.find((n) => n.id === conn.sourceNodeId);
      const tgtNode = nodes.find((n) => n.id === conn.targetNodeId);
      if (!srcNode || !tgtNode) continue;

      const x1 = offsetX + (srcNode.position.x - bounds.minX + 90) * scale;
      const y1 = offsetY + (srcNode.position.y - bounds.minY + 20) * scale;
      const x2 = offsetX + (tgtNode.position.x - bounds.minX + 90) * scale;
      const y2 = offsetY + (tgtNode.position.y - bounds.minY + 20) * scale;

      this._content.moveTo(x1, y1);
      this._content.lineTo(x2, y2);
    }

    // 绘制节点
    for (const node of nodes) {
      const x = offsetX + (node.position.x - bounds.minX + 90) * scale;
      const y = offsetY + (node.position.y - bounds.minY + 20) * scale;

      let color = 0x555577;
      if (node.status === 'done') color = 0x00b894;
      else if (node.status === 'error') color = 0xd63031;
      else if (node.status === 'computing') color = 0x6c5ce7;

      this._content.beginFill(color, 0.8);
      this._content.drawCircle(x, y, NODE_DOT_SIZE);
      this._content.endFill();
    }

    // 绘制视口指示器
    this._viewportIndicator.clear();
    this._viewportIndicator.lineStyle(1, 0x6c5ce7, 0.6);

    // 将屏幕视口映射到世界坐标，再映射到小地图
    const vpWorldLeft = -viewport.x / viewport.zoom;
    const vpWorldTop = -viewport.y / viewport.zoom;
    const vpWorldRight = (canvasWidth - viewport.x) / viewport.zoom;
    const vpWorldBottom = (canvasHeight - viewport.y) / viewport.zoom;

    const vpX = offsetX + (vpWorldLeft - bounds.minX) * scale;
    const vpY = offsetY + (vpWorldTop - bounds.minY) * scale;
    const vpW = (vpWorldRight - vpWorldLeft) * scale;
    const vpH = (vpWorldBottom - vpWorldTop) * scale;

    this._viewportIndicator.drawRect(vpX, vpY, Math.max(vpW, 4), Math.max(vpH, 4));
  }

  destroy(): void {
    this._container.parent?.removeChild(this._container);
    this._container.destroy({ children: true });
  }

  private calculateBounds(nodes: CanvasNode[]): {
    minX: number; minY: number; maxX: number; maxY: number;
  } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + 180);
      maxY = Math.max(maxY, node.position.y + 80);
    }
    return { minX, minY, maxX, maxY };
  }
}
