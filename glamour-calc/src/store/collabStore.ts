/**
 * collabStore - 协作状态管理
 * 管理协作连接状态、在线用户、协作事件
 * 与 YjsProvider 配合工作
 */

import { create } from 'zustand';
import { CollabUser, CollabChangeEvent, CanvasNode, Connection, Value } from '../types';
import { YjsProvider, ConnectionState } from '../collab/YjsProvider';
import { AwarenessManager } from '../collab/AwarenessManager';

interface CollabState {
  // 连接状态
  roomId: string | null;
  connectionState: ConnectionState;
  isConnected: boolean;

  // 在线用户
  users: CollabUser[];

  // 协作事件日志
  changes: CollabChangeEvent[];

  // 提供者实例（不在 state 中触发 re-render）
  provider: YjsProvider | null;
  awarenessManager: AwarenessManager | null;

  // 操作
  connect: (roomId: string, serverUrl?: string) => void;
  disconnect: () => void;
  syncNodes: (nodes: CanvasNode[]) => void;
  syncConnections: (connections: Connection[]) => void;
  setLocalSelectedNode: (nodeId: string | null) => void;

  // 回调注册（由外部模块设置）
  onNodesChanged: ((nodes: CanvasNode[]) => void) | null;
  onConnectionsChanged: ((connections: Connection[]) => void) | null;
  setOnNodesChanged: (cb: (nodes: CanvasNode[]) => void) => void;
  setOnConnectionsChanged: (cb: (connections: Connection[]) => void) => void;
}

export const useCollabStore = create<CollabState>((set, get) => ({
  roomId: null,
  connectionState: 'disconnected',
  isConnected: false,
  users: [],
  changes: [],
  provider: null,
  awarenessManager: null,
  onNodesChanged: null,
  onConnectionsChanged: null,

  setOnNodesChanged: (cb) => set({ onNodesChanged: cb }),
  setOnConnectionsChanged: (cb) => set({ onConnectionsChanged: cb }),

  connect: (roomId: string, serverUrl?: string) => {
    const state = get();
    if (state.provider) {
      state.provider.disconnect();
    }

    const awarenessManager = new AwarenessManager();

    const provider = new YjsProvider({
      onNodesChanged: (nodes) => {
        get().onNodesChanged?.(nodes);
      },
      onConnectionsChanged: (connections) => {
        get().onConnectionsChanged?.(connections);
      },
      onUserJoined: (user) => {
        set((s) => ({
          changes: [...s.changes.slice(-49), {
            type: 'user:join' as const,
            userId: user.id,
            timestamp: Date.now(),
            payload: user,
          }],
        }));
      },
      onUserLeft: (userId) => {
        set((s) => ({
          changes: [...s.changes.slice(-49), {
            type: 'user:leave' as const,
            userId,
            timestamp: Date.now(),
            payload: null,
          }],
        }));
      },
      onConnectionStateChanged: (connectionState) => {
        set({
          connectionState,
          isConnected: connectionState === 'connected',
        });
      },
    });

    awarenessManager.onUsersChanged((users) => set({ users }));

    provider.connect(roomId, serverUrl);
    if (provider.wsProvider) {
      awarenessManager.bind(provider.wsProvider);
    }

    set({
      roomId,
      provider,
      awarenessManager,
      connectionState: 'connecting',
    });
  },

  disconnect: () => {
    const state = get();
    state.provider?.disconnect();
    state.awarenessManager?.destroy();
    set({
      roomId: null,
      provider: null,
      awarenessManager: null,
      connectionState: 'disconnected',
      isConnected: false,
      users: [],
    });
  },

  syncNodes: (nodes) => {
    get().provider?.syncNodes(nodes);
  },

  syncConnections: (connections) => {
    get().provider?.syncConnections(connections);
  },

  setLocalSelectedNode: (nodeId) => {
    get().provider?.setLocalSelectedNode(nodeId);
  },
}));
