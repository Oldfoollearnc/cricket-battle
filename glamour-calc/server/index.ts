/**
 * 协作服务端 - y-websocket + LevelDB 持久化
 * 提供多用户实时协作的 WebSocket 服务
 *
 * 启动方式: npx tsx server/index.ts
 * 默认端口: 1234
 */

const { setupWSConnection } = require('y-websocket/bin/utils');
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.env.PORT ?? '1234', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

// HTTP 服务（健康检查 + 静态文件）
const server = http.createServer((req: { url: string }, res: { end: (body: string) => void }) => {
  if (req.url === '/health') {
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
  } else {
    res.end('Disruptor Calculator - Collaboration Server');
  }
});

// WebSocket 服务
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: unknown, req: { url: string }) => {
  // 从 URL 中提取房间名: ws://localhost:1234/room-name
  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);
  const roomName = url.pathname.slice(1) || 'default';

  console.log(`[连接] 房间: ${roomName}, 来源: ${req.url}`);

  setupWSConnection(ws, req, {
    docName: roomName,
    gc: true, // 启用垃圾回收
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[协作服务端] 已启动: http://${HOST}:${PORT}`);
  console.log(`[协作服务端] WebSocket: ws://${HOST}:${PORT}`);
  console.log(`[协作服务端] 健康检查: http://${HOST}:${PORT}/health`);
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n[协作服务端] 正在关闭...');
  wss.close(() => {
    server.close(() => {
      console.log('[协作服务端] 已关闭');
      process.exit(0);
    });
  });
});
