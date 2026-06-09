/**
 * OverlayManager - HTML Overlay 层管理器
 * 负责将 PixiJS 世界坐标映射到 HTML 屏幕坐标
 * 用于在画布上方叠加图表(ECharts)、公式(KaTeX)、文本等 HTML 渲染
 */

import { CanvasManager } from './CanvasManager';
import { CanvasNode } from '../types';
import { isOutputNode } from '../output/OutputRenderer';

export interface OverlayPosition {
  nodeId: string;
  screenX: number;
  screenY: number;
  visible: boolean;
}

export class OverlayManager {
  private _canvasManager: CanvasManager;
  private _positions: Map<string, OverlayPosition> = new Map();

  constructor(canvasManager: CanvasManager) {
    this._canvasManager = canvasManager;
  }

  /** 获取所有输出节点的屏幕坐标 */
  getPositions(): Map<string, OverlayPosition> {
    return new Map(this._positions);
  }

  /** 获取单个节点的屏幕坐标 */
  getPosition(nodeId: string): OverlayPosition | undefined {
    return this._positions.get(nodeId);
  }

  /**
   * 更新所有输出节点的屏幕坐标
   * 在每帧渲染循环中调用，同步 HTML 层与 PixiJS 层
   */
  updatePositions(nodes: CanvasNode[]): void {
    const canvas = this._canvasManager.app.view as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;

    for (const node of nodes) {
      if (!isOutputNode(node.type)) continue;

      const screenPos = this._canvasManager.worldToScreen(
        node.position.x,
        node.position.y
      );

      // 节点在屏幕上的可见性判断
      // 一个节点大约 180x80 像素（世界坐标），需要乘以缩放
      const nodeScreenW = 180 * this._canvasManager.viewport.zoom;
      const nodeScreenH = 200 * this._canvasManager.viewport.zoom; // 输出区域更大

      const isVisible =
        screenPos.x + nodeScreenW > 0 &&
        screenPos.x < canvasWidth &&
        screenPos.y + nodeScreenH > 0 &&
        screenPos.y < canvasHeight;

      this._positions.set(node.id, {
        nodeId: node.id,
        screenX: screenPos.x,
        screenY: screenPos.y,
        visible: isVisible,
      });
    }

    // 清理已不存在的节点
    const nodeIds = new Set(nodes.map((n) => n.id));
    for (const [id] of this._positions) {
      if (!nodeIds.has(id)) {
        this._positions.delete(id);
      }
    }
  }

  destroy(): void {
    this._positions.clear();
  }
}
