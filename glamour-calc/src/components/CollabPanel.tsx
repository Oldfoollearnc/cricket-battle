/**
 * CollabPanel - 协作控制面板
 * 显示在右侧属性面板下方
 * 提供：连接/断开协作、在线用户列表、房间管理
 */

import React, { useState, useCallback } from 'react';
import { useCollabStore } from '../store/collabStore';

const CollabPanel: React.FC = () => {
  const {
    roomId,
    connectionState,
    isConnected,
    users,
    connect,
    disconnect,
  } = useCollabStore();

  const [inputRoomId, setInputRoomId] = useState('');
  const [serverUrl, setServerUrl] = useState('ws://localhost:1234');

  const handleConnect = useCallback(() => {
    const room = inputRoomId.trim() || 'default';
    connect(room, serverUrl);
  }, [inputRoomId, serverUrl, connect]);

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>实时协作</span>
        <span style={{
          ...styles.status,
          color: isConnected ? '#00b894' : connectionState === 'connecting' ? '#ffeaa7' : '#666',
        }}>
          {connectionState === 'connected' ? '已连接' :
           connectionState === 'connecting' ? '连接中...' : '未连接'}
        </span>
      </div>

      {!isConnected ? (
        <div style={styles.connectForm}>
          <input
            style={styles.input}
            placeholder="房间名 (默认: default)"
            value={inputRoomId}
            onChange={(e) => setInputRoomId(e.target.value)}
          />
          <input
            style={styles.input}
            placeholder="服务端地址"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
          />
          <button style={styles.connectBtn} onClick={handleConnect}>
            加入协作
          </button>
        </div>
      ) : (
        <div style={styles.connectedSection}>
          <div style={styles.roomInfo}>
            <span style={styles.roomLabel}>房间:</span>
            <span style={styles.roomValue}>{roomId}</span>
          </div>

          <div style={styles.usersSection}>
            <span style={styles.sectionTitle}>在线用户 ({users.length})</span>
            {users.map((user) => (
              <div key={user.id} style={styles.userItem}>
                <span style={{ ...styles.userDot, background: user.color }} />
                <span style={styles.userName}>{user.name}</span>
                {user.selectedNodeId && (
                  <span style={styles.userActivity}>编辑中</span>
                )}
              </div>
            ))}
          </div>

          <button style={styles.disconnectBtn} onClick={handleDisconnect}>
            断开连接
          </button>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    background: '#0f0f1a',
    borderTop: '1px solid #2a2a3e',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#6c5ce7',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  status: {
    fontSize: 10,
  },
  connectForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  input: {
    background: '#1a1a2e',
    border: '1px solid #3a3a4e',
    borderRadius: 4,
    color: '#fff',
    padding: '5px 8px',
    fontSize: 11,
    outline: 'none',
  },
  connectBtn: {
    background: '#6c5ce7',
    border: 'none',
    borderRadius: 4,
    color: '#fff',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 'bold',
  },
  connectedSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  roomInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  roomLabel: {
    color: '#888',
    fontSize: 11,
  },
  roomValue: {
    color: '#00cec9',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  usersSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  userItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 0',
  },
  userDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
  },
  userName: {
    fontSize: 11,
    color: '#ccc',
    flex: 1,
  },
  userActivity: {
    fontSize: 9,
    color: '#ffeaa7',
    background: 'rgba(255, 234, 167, 0.1)',
    padding: '1px 4px',
    borderRadius: 3,
  },
  disconnectBtn: {
    background: '#d63031',
    border: 'none',
    borderRadius: 4,
    color: '#fff',
    padding: '5px 12px',
    cursor: 'pointer',
    fontSize: 11,
  },
};

export default CollabPanel;
