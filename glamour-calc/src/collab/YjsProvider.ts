/**
 * YjsProvider - Yjs CRDT 协作提供者
 * 管理 Yjs 文档与 WebSocket 服务端的连接
 * 将画布状态（节点、连线）映射到 Yjs 共享数据结构
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { CanvasNode, Connection, Value, CollabUser } from '../types';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export interface YjsProviderCallbacks {
  onNodesChanged: (nodes: CanvasNode[]) => void;
  onConnectionsChanged: (connections: Connection[]) => void;
  onUserJoined: (user: CollabUser) => void;
  onUserLeft: (userId: string) => void;
  onConnectionStateChanged: (state: ConnectionState) => void;
}

export class YjsProvider {
  private _doc: Y.Doc;
  private _wsProvider: WebsocketProvider | null = null;
  private _yNodes: Y.Array<Y.Map<unknown>>;
  private _yConnections: Y.Array<Y.Map<unknown>>;
  private _callbacks: YjsProviderCallbacks;
  private _isRemoteUpdate = false;

  constructor(callbacks: YjsProviderCallbacks) {
    this._doc = new Y.Doc();
    this._yNodes = this._doc.getArray('nodes');
    this._yConnections = this._doc.getArray('connections');
    this._callbacks = callbacks;

    this.setupObservers();
  }

  get doc(): Y.Doc {
    return this._doc;
  }

  get wsProvider(): WebsocketProvider | null {
    return this._wsProvider;
  }

  /** 连接到协作服务端 */
  connect(roomId: string, serverUrl = 'ws://localhost:1234'): void {
    if (this._wsProvider) {
      this.disconnect();
    }

    this._callbacks.onConnectionStateChanged('connecting');

    this._wsProvider = new WebsocketProvider(serverUrl, roomId, this._doc);

    this._wsProvider.on('status', (event: { status: string }) => {
      const state: ConnectionState =
        event.status === 'connected' ? 'connected' :
        event.status === 'connecting' ? 'connecting' : 'disconnected';
      this._callbacks.onConnectionStateChanged(state);
    });

    this._wsProvider.on('sync', () => {
      // 初始同步完成，通知 UI
      this._callbacks.onConnectionStateChanged('connected');
    });

    // Awareness（用户感知）
    const awareness = this._wsProvider.awareness;
    awareness.setLocalStateField('user', {
      name: `用户${Math.floor(Math.random() * 1000)}`,
      color: `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`,
    });
  }

  /** 断开连接 */
  disconnect(): void {
    if (this._wsProvider) {
      this._wsProvider.destroy();
      this._wsProvider = null;
    }
    this._callbacks.onConnectionStateChanged('disconnected');
  }

  /** 将本地节点变更同步到 Yjs */
  syncNodes(nodes: CanvasNode[]): void {
    if (this._isRemoteUpdate) return;

    this._doc.transact(() => {
      // 清空并重建
      this._yNodes.delete(0, this._yNodes.length);
      for (const node of nodes) {
        const yNode = new Y.Map();
        yNode.set('id', node.id);
        yNode.set('type', node.type);
        yNode.set('label', node.label);
        yNode.set('x', node.position.x);
        yNode.set('y', node.position.y);
        yNode.set('inputs', Object.fromEntries(node.inputs));
        yNode.set('outputs', Object.fromEntries(node.outputs));
        this._yNodes.push([yNode]);
      }
    });
  }

  /** 将本地连线变更同步到 Yjs */
  syncConnections(connections: Connection[]): void {
    if (this._isRemoteUpdate) return;

    this._doc.transact(() => {
      this._yConnections.delete(0, this._yConnections.length);
      for (const conn of connections) {
        const yConn = new Y.Map();
        yConn.set('id', conn.id);
        yConn.set('sourceNodeId', conn.sourceNodeId);
        yConn.set('sourcePort', conn.sourcePort);
        yConn.set('targetNodeId', conn.targetNodeId);
        yConn.set('targetPort', conn.targetPort);
        this._yConnections.push([yConn]);
      }
    });
  }

  /** 设置本地用户信息 */
  setLocalUser(user: Partial<CollabUser>): void {
    if (!this._wsProvider) return;
    const awareness = this._wsProvider.awareness;
    awareness.setLocalStateField('user', {
      name: user.name ?? '匿名用户',
      color: user.color ?? '#6c5ce7',
      selectedNodeId: user.selectedNodeId,
    });
  }

  /** 设置本地用户选中的节点 */
  setLocalSelectedNode(nodeId: string | null): void {
    if (!this._wsProvider) return;
    const awareness = this._wsProvider.awareness;
    awareness.setLocalStateField('selectedNodeId', nodeId);
  }

  destroy(): void {
    this.disconnect();
    this._doc.destroy();
  }

  // ============================================
  // 私有方法
  // ============================================

  private setupObservers(): void {
    // 监听节点变更
    this._yNodes.observe(() => {
      this._isRemoteUpdate = true;
      const nodes: CanvasNode[] = this._yNodes.toArray().map((yNode) => ({
        id: yNode.get('id') as string,
        type: yNode.get('type') as string,
        label: yNode.get('label') as string,
        position: {
          x: yNode.get('x') as number,
          y: yNode.get('y') as number,
        },
        inputs: new Map(Object.entries((yNode.get('inputs') as Record<string, Value>) ?? {})),
        outputs: new Map(Object.entries((yNode.get('outputs') as Record<string, Value>) ?? {})),
        status: 'idle' as const,
      }));
      this._callbacks.onNodesChanged(nodes);
      this._isRemoteUpdate = false;
    });

    // 监听连线变更
    this._yConnections.observe(() => {
      this._isRemoteUpdate = true;
      const connections: Connection[] = this._yConnections.toArray().map((yConn) => ({
        id: yConn.get('id') as string,
        sourceNodeId: yConn.get('sourceNodeId') as string,
        sourcePort: yConn.get('sourcePort') as string,
        targetNodeId: yConn.get('targetNodeId') as string,
        targetPort: yConn.get('targetPort') as string,
      }));
      this._callbacks.onConnectionsChanged(connections);
      this._isRemoteUpdate = false;
    });
  }
}
