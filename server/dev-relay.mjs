/* 로컬 시험용 방 서버 — Cloudflare에 올리기 전에 내 PC에서 4인 온라인을 시험할 때 씀.
 *   cd server && npm install && npm run relay
 *   게임 주소 뒤에 ?mp=ws://localhost:8787 을 붙여 열기 (예: http://localhost:8000/level1.html?mp=ws://localhost:8787)
 * 방 규칙은 Cloudflare 서버와 똑같은 room-core.js를 씁니다.
 */
import { WebSocketServer } from 'ws';
import { RoomCore } from './src/room-core.js';

const PORT = +(process.env.PORT || 8787);
const rooms = new Map();
const wss = new WebSocketServer({ port: PORT, maxPayload: 2 * 1024 * 1024 });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const m = url.pathname.match(/^\/room\/([A-Za-z0-9]{4})$/);
  if (!m) { ws.close(4000, 'bad path'); return; }
  const code = m[1].toUpperCase();
  if (!rooms.has(code)) rooms.set(code, new RoomCore(code));
  const room = rooms.get(code);
  const conn = { send: s => ws.readyState === 1 && ws.send(s), close: (c, r) => ws.close(c, r) };
  const member = room.join(conn, Object.fromEntries(url.searchParams));
  ws.on('message', d => room.message(member, d.toString()));
  ws.on('close', () => { room.leave(member, conn); if (room.empty()) setTimeout(() => { if (room.empty()) rooms.delete(code); }, 60000); });
});
console.log(`[mable22-mp] 로컬 방 서버 ws://localhost:${PORT}`);
