/**
 * settingsStore - 全局设置状态管理
 * 管理用户偏好设置：自动快照、计算后端、推荐面板、主题
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  autoSnapshot: boolean;
  snapshotInterval: number;
  computeBackend: 'js' | 'wasm';
  showRecommendations: boolean;
  theme: 'dark' | 'light';

  // 操作
  setAutoSnapshot: (enabled: boolean) => void;
  setSnapshotInterval: (ms: number) => void;
  setComputeBackend: (backend: 'js' | 'wasm') => void;
  setShowRecommendations: (show: boolean) => void;
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      autoSnapshot: false,
      snapshotInterval: 30000,
      computeBackend: 'js',
      showRecommendations: true,
      theme: 'dark',

      setAutoSnapshot: (autoSnapshot) => set({ autoSnapshot }),
      setSnapshotInterval: (snapshotInterval) => set({ snapshotInterval }),
      setComputeBackend: (computeBackend) => set({ computeBackend }),
      setShowRecommendations: (showRecommendations) => set({ showRecommendations }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'disruptor-calc-settings',
    }
  )
);
