/**
 * App - 颠覆计算器主应用组件
 * 布局：顶部工具栏 + 左侧画布 + 右侧属性面板
 */

import React, { useEffect } from 'react';
import Canvas from './Canvas';
import NodePanel from './NodePanel';
import Toolbar from './Toolbar';
import { registerBuiltinNodes } from '../engine/NodeRegistry';

const App: React.FC = () => {
  // 初始化内置节点类型
  useEffect(() => {
    registerBuiltinNodes();
  }, []);

  return (
    <div style={styles.app}>
      <Toolbar />
      <div style={styles.main}>
        <div style={styles.canvasArea}>
          <Canvas />
        </div>
        <NodePanel />
      </div>
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
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  canvasArea: {
    flex: 1,
    overflow: 'hidden',
  },
};

export default App;
