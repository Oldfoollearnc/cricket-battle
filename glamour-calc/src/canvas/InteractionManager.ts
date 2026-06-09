/**
 * InteractionManager - 画布交互管理器
 * 处理：节点拖拽、连线创建、节点选择、画布右键菜单
 * 所有交互都在 PixiJS 世界坐标系中进行
 */

import * as PIXI from 'pixi.js';
import { CanvasNode, Connection, DragState, ConnectingState, Value } from '../types';
import { CanvasManager } from './CanvasManager';
import { RenderedNode } from './NodeRenderer';
import { renderTempConnection } from './ConnectionRenderer';
import { v4 as uuidv4 } from 'uuid';

export interface InteractionCallbacks {
  onNodeDragEnd: (nodeId: string, x: number, y: number) => void;
  onConnectionCreated: (conn: Connection) => void;
  onNodeSelected: (nodeId: string | null) => void;
  onNodeValueChange: (nodeId: string, portName: string, value: Value) => void;
  onRequestExecute: () => void;
}

export class InteractionManager {
  private _dragState: DragState | null = null;
  private _connectingState: ConnectingState | null = null;
  private _tempLine: PIXI.Graphics | null = null;
  private _selectedNodeId: string | null = null;

  private _canvasManager: CanvasManager;
  private _callbacks: InteractionCallbacks;
  private _renderedNodes: Map<string, RenderedNode> = new Map();

  constructor(canvasManager: CanvasManager, callbacks: InteractionCallbacks) {
    this._canvasManager = canvasManager;
    this._callbacks = callbacks;

    this.setupCanvasInteraction();
  }

  /** 更新渲染节点映射 */
  setRenderedNodes(nodes: Map<string, RenderedNode>): void {
    this._renderedNodes = nodes;
  }

  get selectedNodeId(): string | null {
    return this._selectedNodeId;
  }

  /** 为节点容器绑定拖拽和连线交互 */
  bindNodeInteraction(renderedNode: RenderedNode): void {
    const { container, node } = renderedNode;
    container.eventMode = 'static';
    container.cursor = 'pointer';

    container.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      if (e.button === 0) {
        // 检查是否点击了输出端口（开始连线）
        const portHit = this.hitTestOutputPort(renderedNode, e.global);
        if (portHit) {
          this._connectingState = {
            sourceNodeId: node.id,
            sourcePort: portHit,
            mousePos: { x: e.global.x, y: e.global.y },
          };
          return;
        }

        // 开始拖拽
        const worldPos = this._canvasManager.screenToWorld(e.global.x, e.global.y);
        this._dragState = {
          nodeId: node.id,
          offsetX: worldPos.x - node.position.x,
          offsetY: worldPos.y - node.position.y,
        };
        this._callbacks.onNodeSelected(node.id);
        this._selectedNodeId = node.id;
      }
    });
  }

  /** 每帧更新（处理拖拽和连线绘制） */
  update(): void {
    // 更新临时连线
    if (this._connectingState) {
      if (this._tempLine) {
        this._canvasManager.worldContainer.removeChild(this._tempLine);
        this._tempLine.destroy();
      }

      const sourceNode = this._renderedNodes.get(this._connectingState.sourceNodeId);
      if (sourceNode) {
        const fromPos = sourceNode.outputPortPositions.get(this._connectingState.sourcePort);
        if (fromPos) {
          const toWorld = this._canvasManager.screenToWorld(
            this._connectingState.mousePos.x,
            this._connectingState.mousePos.y
          );
          this._tempLine = renderTempConnection(fromPos.x, fromPos.y, toWorld.x, toWorld.y);
          this._canvasManager.worldContainer.addChild(this._tempLine);
        }
      }
    }
  }

  /** 处理全局 pointermove */
  handlePointerMove(globalX: number, globalY: number): void {
    // 拖拽节点
    if (this._dragState) {
      const worldPos = this._canvasManager.screenToWorld(globalX, globalY);
      const newX = worldPos.x - this._dragState.offsetX;
      const newY = worldPos.y - this._dragState.offsetY;

      const rendered = this._renderedNodes.get(this._dragState.nodeId);
      if (rendered) {
        rendered.container.position.set(newX, newY);
        // 更新端口位置
        rendered.node.position.x = newX;
        rendered.node.position.y = newY;
      }
    }

    // 连线拖拽
    if (this._connectingState) {
      this._connectingState.mousePos = { x: globalX, y: globalY };
    }
  }

  /** 处理全局 pointerup */
  handlePointerUp(globalX: number, globalY: number): void {
    // 拖拽结束
    if (this._dragState) {
      this._callbacks.onNodeDragEnd(this._dragState.nodeId,
        this._renderedNodes.get(this._dragState.nodeId)?.node.position.x ?? 0,
        this._renderedNodes.get(this._dragState.nodeId)?.node.position.y ?? 0
      );
      this._dragState = null;
    }

    // 连线结束
    if (this._connectingState) {
      // 检查是否释放到了某个输入端口上
      const target = this.hitTestInputPort(globalX, globalY);
      if (target && target.nodeId !== this._connectingState.sourceNodeId) {
        const conn: Connection = {
          id: uuidv4(),
          sourceNodeId: this._connectingState.sourceNodeId,
          sourcePort: this._connectingState.sourcePort,
          targetNodeId: target.nodeId,
          targetPort: target.portName,
        };
        this._callbacks.onConnectionCreated(conn);
        this._callbacks.onRequestExecute();
      }

      if (this._tempLine) {
        this._canvasManager.worldContainer.removeChild(this._tempLine);
        this._tempLine.destroy();
        this._tempLine = null;
      }
      this._connectingState = null;
    }
  }

  /** 处理键盘输入（用于输入节点的值修改） */
  handleKeyDown(key: string): void {
    if (key === 'Escape') {
      this._selectedNodeId = null;
      this._callbacks.onNodeSelected(null);
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  private setupCanvasInteraction(): void {
    const canvas = this._canvasManager.app.view as HTMLCanvasElement;

    canvas.addEventListener('pointermove', (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.handlePointerMove(e.clientX - rect.left, e.clientY - rect.top);
    });

    canvas.addEventListener('pointerup', (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.handlePointerUp(e.clientX - rect.left, e.clientY - rect.top);
    });

    canvas.addEventListener('click', (e: MouseEvent) => {
      // 如果点击了空白区域，取消选择
      if (this._dragState === null && this._connectingState === null) {
        const rect = canvas.getBoundingClientRect();
        const worldPos = this._canvasManager.screenToWorld(
          e.clientX - rect.left,
          e.clientY - rect.top
        );
        let hitNode = false;
        for (const [, rendered] of this._renderedNodes) {
          const n = rendered.node;
          if (
            worldPos.x >= n.position.x &&
            worldPos.x <= n.position.x + 180 &&
            worldPos.y >= n.position.y &&
            worldPos.y <= n.position.y + 100
          ) {
            hitNode = true;
            break;
          }
        }
        if (!hitNode) {
          this._selectedNodeId = null;
          this._callbacks.onNodeSelected(null);
        }
      }
    });
  }

  /** 检测点击是否命中了输出端口 */
  private hitTestOutputPort(rendered: RenderedNode, global: { x: number; y: number }): string | null {
    const worldPos = this._canvasManager.screenToWorld(global.x, global.y);
    for (const [portName, pos] of rendered.outputPortPositions) {
      const dx = worldPos.x - pos.x;
      const dy = worldPos.y - pos.y;
      if (dx * dx + dy * dy < 100) return portName; // 10px 半径
    }
    return null;
  }

  /** 检测释放位置是否命中了某个输入端口 */
  private hitTestInputPort(globalX: number, globalY: number): { nodeId: string; portName: string } | null {
    const worldPos = this._canvasManager.screenToWorld(globalX, globalY);
    for (const [nodeId, rendered] of this._renderedNodes) {
      for (const [portName, pos] of rendered.inputPortPositions) {
        const dx = worldPos.x - pos.x;
        const dy = worldPos.y - pos.y;
        if (dx * dx + dy * dy < 100) return { nodeId, portName };
      }
    }
    return null;
  }
}
