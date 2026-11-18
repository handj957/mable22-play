/* 로컬 시험용 서버 — Cloudflare에 올리기 전에 내 PC에서 빠른 매칭·친구 방을 시험할 때 씀.
 *   cd server && npm install && npm run relay
 *   게임 주소 뒤에 ?mp=ws://localhost:8787 을 붙여 열기 (예: http://localhost:8000/level1.html?mp=ws://localhost:8787)
 * 방·매칭 규칙은 Cloudflare 서버와 똑같은 room-core.js를 씁니다.
 */
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { RoomCore, MatchCore } from './src/room-core.js';

const PORT = +(process.env.PORT || 8787);
const rooms = new Map(), queues = new Map();
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const cors = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  if (url.pathname === '/match') {
    const lv = (url.searchParams.get('lv') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 24);
    if (!lv) { res.writeHead(400, cors); return res.end('lv required'); }
    if (!queues.has(lv)) queues.set(lv, new MatchCore());
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ code: queues.get(lv).ticket(url.searchParams.get('skip') || '') }));
  }
  res.writeHead(url.pathname === '/health' ? 200 : 404, cors); res.end('mable22-mp ok (dev)');
});
const wss = new WebSocketServer({ server, maxPayload: 2 * 1024 * 1024 });
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const m = url.pathname.match(/^\/room\/([A-Za-z0-9]{4})$/);
  if (!m) { ws.close(4000, 'bad path'); return; }
  const code = m[1].toUpperCase();
  if (!rooms.has(code) || (rooms.get(code).members.size === 0 && !rooms.get(code).started)) rooms.set(code, new RoomCore(code));
  const room = rooms.get(code);
  const conn = { send: s => ws.readyState === 1 && ws.send(s), close: (c, r) => ws.close(c, r) };
  const member = room.join(conn, Object.fromEntries(url.searchParams));
  ws.on('message', d => room.message(member, d.toString()));
  ws.on('close', () => { room.leave(member, conn); if (room.empty()) setTimeout(() => { if (room.empty() && rooms.get(code) === room) rooms.delete(code); }, 60000); });
});
server.listen(PORT, () => console.log(`[mable22-mp] 로컬 서버 http/ws://localhost:${PORT}`));
