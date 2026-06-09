/**
 * App - 颠覆计算器主应用组件
 * 布局：顶部工具栏 + 左侧画布 + 右侧属性面板 + 底部历史时间线
 * 初始化所有模块：节点注册、协作连接
 */

import React, { useEffect } from 'react';
import Canvas from './Canvas';
import NodePanel from './NodePanel';
import Toolbar from './Toolbar';
import HistoryTimeline from './HistoryTimeline';
import CollabPanel from './CollabPanel';
import { registerBuiltinNodes } from '../engine/NodeRegistry';
import { useCollabStore } from '../store/collabStore';

const App: React.FC = () => {
  // 初始化内置节点类型
  useEffect(() => {
    registerBuiltinNodes();
  }, []);

  // 协作连接状态
  const { isConnected, users } = useCollabStore();

  return (
    <div style={styles.app}>
      <Toolbar />
      <div style={styles.main}>
        <div style={styles.canvasArea}>
          <Canvas />
        </div>
        <div style={styles.rightPanel}>
          <NodePanel />
          <CollabPanel />
        </div>
      </div>
      <HistoryTimeline />

      {/* 协作状态指示 */}
      {isConnected && (
        <div style={styles.collabIndicator}>
          <span style={styles.collabDot} />
          <span style={styles.collabText}>
            协作中 · {users.length} 人在线
          </span>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    background: '#0f0f1a',
    color: '#fff',
    fontFamily: "'SF Pro Display', 'Helvetica Neue', Arial, sans-serif",
    position: 'relative',
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  canvasArea: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  rightPanel: {
    display: 'flex',
    flexDirection: 'column',
    width: 240,
    flexShrink: 0,
    borderLeft: '1px solid #2a2a3e',
    overflow: 'hidden',
  },
  collabIndicator: {
    position: 'absolute',
    top: 56,
    left: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    background: 'rgba(26, 26, 46, 0.9)',
    borderRadius: 12,
    border: '1px solid #2a2a3e',
    zIndex: 20,
  },
  collabDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#00b894',
  },
  collabText: {
    fontSize: 11,
    color: '#888',
  },
};

export default App;
