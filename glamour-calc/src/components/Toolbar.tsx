/**
 * Toolbar - 顶部工具栏
 * 包含：节点添加菜单、执行按钮、历史操作、清空画布
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { getAllNodeDefinitions, getCategories } from '../engine/NodeRegistry';
import { useHistoryStore } from '../store/historyStore';

const Toolbar: React.FC = () => {
  const [showNodeMenu, setShowNodeMenu] = useState(false);
  const [showHistoryMenu, setShowHistoryMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { addNode, executeAll, commitHistory, clearAll, viewport } = useCanvasStore();
  const { getAllNodes } = useHistoryStore();

  const handleAddNode = useCallback(
    (type: string) => {
      // 在视口中心添加节点
      const x = (400 - viewport.x) / viewport.zoom;
      const y = (300 - viewport.y) / viewport.zoom;
      addNode(type, x, y);
      setShowNodeMenu(false);
      executeAll();
    },
    [addNode, executeAll, viewport]
  );

  const handleExecute = useCallback(() => {
    executeAll();
  }, [executeAll]);

  const handleCommit = useCallback(() => {
    commitHistory();
  }, [commitHistory]);

  const handleClear = useCallback(() => {
    clearAll();
  }, [clearAll]);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowNodeMenu(false);
        setShowHistoryMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const categories = getCategories();
  const historyNodes = getAllNodes();

  return (
    <div style={styles.toolbar} ref={menuRef}>
      <div style={styles.left}>
        <span style={styles.title}>颠覆计算器</span>
      </div>

      <div style={styles.center}>
        {/* 添加节点 */}
        <div style={{ position: 'relative' }}>
          <button
            style={styles.btn}
            onClick={() => { setShowNodeMenu(!showNodeMenu); setShowHistoryMenu(false); }}
          >
            + 添加节点
          </button>
          {showNodeMenu && (
            <div style={styles.dropdown}>
              {categories.map((cat) => (
                <div key={cat}>
                  <div style={styles.catTitle}>{cat}</div>
                  {getAllNodeDefinitions()
                    .filter((d) => d.category === cat)
                    .map((d) => (
                      <button
                        key={d.type}
                        style={styles.menuItem}
                        onClick={() => handleAddNode(d.type)}
                      >
                        <span style={{ color: d.color }}>{d.label}</span>
                        <span style={styles.menuItemDesc}>{d.type}</span>
                      </button>
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <button style={styles.btnPrimary} onClick={handleExecute}>
          执行
        </button>

        <button style={styles.btn} onClick={handleCommit}>
          保存快照
        </button>

        {/* 历史 */}
        <div style={{ position: 'relative' }}>
          <button
            style={styles.btn}
            onClick={() => { setShowHistoryMenu(!showHistoryMenu); setShowNodeMenu(false); }}
          >
            历史 ({historyNodes.length})
          </button>
          {showHistoryMenu && (
            <div style={styles.dropdown}>
              {historyNodes.length === 0 ? (
                <div style={styles.emptyText}>暂无历史快照</div>
              ) : (
                historyNodes
                  .slice()
                  .reverse()
                  .map((hn) => (
                    <button
                      key={hn.id}
                      style={styles.menuItem}
                      onClick={() => {
                        useCanvasStore.getState().checkoutHistory(hn.id);
                        setShowHistoryMenu(false);
                      }}
                    >
                      <span>{hn.label ?? '快照'}</span>
                      <span style={styles.menuItemDesc}>
                        {new Date(hn.timestamp).toLocaleTimeString()}
                      </span>
                    </button>
                  ))
              )}
            </div>
          )}
        </div>

        <button style={styles.btnDanger} onClick={handleClear}>
          清空
        </button>
      </div>

      <div style={styles.right}>
        <span style={styles.zoomText}>
          {Math.round(viewport.zoom * 100)}%
        </span>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    background: '#0f0f1a',
    borderBottom: '1px solid #2a2a3e',
    height: 48,
    flexShrink: 0,
    zIndex: 100,
  },
  left: {},
  title: {
    color: '#6c5ce7',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 2,
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  right: {},
  btn: {
    background: '#1a1a2e',
    border: '1px solid #3a3a4e',
    borderRadius: 6,
    color: '#fff',
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: 13,
    transition: 'background 0.2s',
  },
  btnPrimary: {
    background: '#6c5ce7',
    border: 'none',
    borderRadius: 6,
    color: '#fff',
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 'bold',
  },
  btnDanger: {
    background: '#d63031',
    border: 'none',
    borderRadius: 6,
    color: '#fff',
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: 13,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 4,
    background: '#1a1a2e',
    border: '1px solid #3a3a4e',
    borderRadius: 8,
    padding: 8,
    minWidth: 200,
    maxHeight: 400,
    overflowY: 'auto',
    zIndex: 200,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  catTitle: {
    color: '#6c5ce7',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    padding: '6px 8px 2px',
  },
  menuItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderRadius: 4,
    color: '#fff',
    padding: '6px 8px',
    cursor: 'pointer',
    fontSize: 13,
    textAlign: 'left' as const,
  },
  menuItemDesc: {
    color: '#666',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    padding: 16,
    fontSize: 12,
  },
  zoomText: {
    color: '#666',
    fontSize: 12,
    fontFamily: 'monospace',
  },
};

export default Toolbar;
