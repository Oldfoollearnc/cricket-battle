/**
 * CanvasManager - PixiJS 画布管理器
 * 负责：应用初始化、视口变换（平移/缩放）、世界坐标系管理
 */

import * as PIXI from 'pixi.js';
import { Viewport } from '../types';

export class CanvasManager {
  readonly app: PIXI.Application;
  readonly worldContainer: PIXI.Container;

  private _viewport: Viewport = { x: 0, y: 0, zoom: 1 };
  private _isPanning = false;
  private _panStart = { x: 0, y: 0 };
  private _canvasWidth = 0;
  private _canvasHeight = 0;

  constructor(container: HTMLElement) {
    const rect = container.getBoundingClientRect();
    this._canvasWidth = rect.width;
    this._canvasHeight = rect.height;

    this.app = new PIXI.Application({
      width: this._canvasWidth,
      height: this._canvasHeight,
      backgroundColor: 0x0f0f1a,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    container.appendChild(this.app.view as HTMLCanvasElement);

    // 世界容器：所有节点和连线都在这个容器里
    this.worldContainer = new PIXI.Container();
    this.app.stage.addChild(this.worldContainer);

    this.setupInteraction();
    this.drawGrid();
    this.updateWorldTransform();
  }

  get viewport(): Viewport {
    return { ...this._viewport };
  }

  set viewport(v: Viewport) {
    this._viewport = { ...v };
    this.updateWorldTransform();
  }

  /** 屏幕坐标转世界坐标 */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this._viewport.x) / this._viewport.zoom,
      y: (screenY - this._viewport.y) / this._viewport.zoom,
    };
  }

  /** 世界坐标转屏幕坐标 */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX * this._viewport.zoom + this._viewport.x,
      y: worldY * this._viewport.zoom + this._viewport.y,
    };
  }

  /** 调整画布大小 */
  resize(width: number, height: number): void {
    this._canvasWidth = width;
    this._canvasHeight = height;
    this.app.renderer.resize(width, height);
    this.drawGrid();
  }

  /** 设置平移 */
  pan(dx: number, dy: number): void {
    this._viewport.x += dx;
    this._viewport.y += dy;
    this.updateWorldTransform();
  }

  /** 设置缩放（以 screenX, screenY 为中心） */
  zoomAt(screenX: number, screenY: number, delta: number): void {
    const worldBefore = this.screenToWorld(screenX, screenY);
    const factor = delta > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, this._viewport.zoom * factor));
    this._viewport.zoom = newZoom;

    // 保持鼠标位置下的世界坐标不变
    this._viewport.x = screenX - worldBefore.x * newZoom;
    this._viewport.y = screenY - worldBefore.y * newZoom;

    this.updateWorldTransform();
  }

  /** 居中显示 */
  centerOn(worldX: number, worldY: number): void {
    this._viewport.x = this._canvasWidth / 2 - worldX * this._viewport.zoom;
    this._viewport.y = this._canvasHeight / 2 - worldY * this._viewport.zoom;
    this.updateWorldTransform();
  }

  destroy(): void {
    this.app.destroy(true, { children: true, texture: true, baseTexture: true });
  }

  // ============================================
  // 私有方法
  // ============================================

  private updateWorldTransform(): void {
    this.worldContainer.x = this._viewport.x;
    this.worldContainer.y = this._viewport.y;
    this.worldContainer.scale.set(this._viewport.zoom);
  }

  private setupInteraction(): void {
    const canvas = this.app.view as HTMLCanvasElement;

    // 鼠标滚轮缩放
    canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      this.zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY);
    }, { passive: false });

    // 中键或空格+左键平移
    canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.button === 1) {
        // 中键平移
        this._isPanning = true;
        this._panStart = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
      }
    });

    canvas.addEventListener('pointermove', (e: PointerEvent) => {
      if (this._isPanning) {
        const dx = e.clientX - this._panStart.x;
        const dy = e.clientY - this._panStart.y;
        this._panStart = { x: e.clientX, y: e.clientY };
        this.pan(dx, dy);
      }
    });

    canvas.addEventListener('pointerup', () => {
      if (this._isPanning) {
        this._isPanning = false;
        canvas.style.cursor = 'default';
      }
    });

    canvas.addEventListener('pointerleave', () => {
      this._isPanning = false;
      canvas.style.cursor = 'default';
    });
  }

  /** 绘制背景网格 */
  private drawGrid(): void {
    // 网格在 worldContainer 中，跟随缩放
    // 用简单的 dot grid 模式
    const gridContainer = new PIXI.Container();
    gridContainer.name = '__grid__';

    // 移除旧网格
    const oldGrid = this.worldContainer.getChildByName('__grid__');
    if (oldGrid) {
      this.worldContainer.removeChild(oldGrid);
      oldGrid.destroy({ children: true });
    }

    // 在世界坐标系中画网格点
    const dotSpacing = 50;
    const viewRect = {
      left: -this._viewport.x / this._viewport.zoom,
      top: -this._viewport.y / this._viewport.zoom,
      right: (this._canvasWidth - this._viewport.x) / this._viewport.zoom,
      bottom: (this._canvasHeight - this._viewport.y) / this._viewport.zoom,
    };

    const startX = Math.floor(viewRect.left / dotSpacing) * dotSpacing;
    const startY = Math.floor(viewRect.top / dotSpacing) * dotSpacing;

    const gfx = new PIXI.Graphics();
    gfx.beginFill(0x2a2a3e, 0.5);

    for (let x = startX; x <= viewRect.right; x += dotSpacing) {
      for (let y = startY; y <= viewRect.bottom; y += dotSpacing) {
        gfx.drawCircle(x, y, 1.5);
      }
    }

    gfx.endFill();
    gridContainer.addChild(gfx);
    this.worldContainer.addChildAt(gridContainer, 0);
  }
}
