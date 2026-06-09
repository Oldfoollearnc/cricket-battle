/**
 * store 模块统一导出
 * 提供所有 Zustand store 的便捷导入
 */

export { useCanvasStore } from './canvasStore';
export { useGraphStore } from './graphStore';
export { useHistoryStore } from './historyStore';
export { useCollabStore } from './collabStore';
export { useSettingsStore } from './settingsStore';

/**
 * [R1-8] resetApp - 同时清空 graphStore 和 historyStore
 * 解决 clearAll 不通知 HistoryTree 的问题
 *
 * 使用方式:
 *   import { resetApp } from './store';
 *   resetApp(useGraphStore, useHistoryStore);
 */
export function resetApp(
  graphStore: { getState: () => { clearAll: () => void } },
  historyStore: { getState: () => { clearHistory: () => void } }
): void {
  graphStore.getState().clearAll();
  historyStore.getState().clearHistory();
}
