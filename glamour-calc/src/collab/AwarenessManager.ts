/**
 * AwarenessManager - 用户感知管理器
 * 管理协作用户的在线状态、光标位置、选中节点
 * 使用 Yjs Awareness 协议实现
 */

import { WebsocketProvider } from 'y-websocket';
import { CollabUser } from '../types';

export interface AwarenessChange {
  added: number[];
  updated: number[];
  removed: number[];
}

export class AwarenessManager {
  private _wsProvider: WebsocketProvider | null = null;
  private _users: Map<number, CollabUser> = new Map();
  private _onUsersChanged: ((users: CollabUser[]) => void) | null = null;

  /** 绑定到 WebSocket Provider */
  bind(wsProvider: WebsocketProvider): void {
    this._wsProvider = wsProvider;
    const awareness = wsProvider.awareness;

    awareness.on('change', (changes: AwarenessChange) => {
      this.handleAwarenessChange(awareness, changes);
    });

    // 初始状态
    this.syncAllUsers(awareness);
  }

  /** 解绑 */
  unbind(): void {
    this._wsProvider = null;
    this._users.clear();
    this._onUsersChanged?.([]);
  }

  /** 设置用户变更回调 */
  onUsersChanged(callback: (users: CollabUser[]) => void): void {
    this._onUsersChanged = callback;
  }

  /** 获取当前在线用户列表 */
  getUsers(): CollabUser[] {
    return Array.from(this._users.values());
  }

  /** 更新本地用户的光标位置 */
  updateLocalCursor(x: number, y: number): void {
    if (!this._wsProvider) return;
    const awareness = this._wsProvider.awareness;
    awareness.setLocalStateField('cursor', { x, y });
  }

  /** 更新本地用户选中的节点 */
  updateLocalSelectedNode(nodeId: string | null): void {
    if (!this._wsProvider) return;
    const awareness = this._wsProvider.awareness;
    awareness.setLocalStateField('selectedNodeId', nodeId);
  }

  destroy(): void {
    this.unbind();
  }

  // ============================================
  // 私有方法
  // ============================================

  private handleAwarenessChange(awareness: { getStates: () => Map<number, unknown> }, changes: AwarenessChange): void {
    // 处理新增和更新
    for (const clientId of [...changes.added, ...changes.updated]) {
      const state = awareness.getStates().get(clientId) as Record<string, unknown> | undefined;
      if (state?.user) {
        const userData = state.user as Record<string, unknown>;
        this._users.set(clientId, {
          id: String(clientId),
          name: (userData.name as string) ?? '匿名',
          color: (userData.color as string) ?? '#6c5ce7',
          cursor: state.cursor as { x: number; y: number } | undefined,
          selectedNodeId: state.selectedNodeId as string | undefined,
        });
      }
    }

    // 处理离开的用户
    for (const clientId of changes.removed) {
      this._users.delete(clientId);
    }

    this._onUsersChanged?.(Array.from(this._users.values()));
  }

  private syncAllUsers(awareness: { getStates: () => Map<number, unknown> }): void {
    this._users.clear();
    for (const [clientId, state] of awareness.getStates()) {
      const typedState = state as Record<string, unknown>;
      if (typedState?.user) {
        const userData = typedState.user as Record<string, unknown>;
        this._users.set(clientId, {
          id: String(clientId),
          name: (userData.name as string) ?? '匿名',
          color: (userData.color as string) ?? '#6c5ce7',
          cursor: typedState.cursor as { x: number; y: number } | undefined,
          selectedNodeId: typedState.selectedNodeId as string | undefined,
        });
      }
    }
  }
}
