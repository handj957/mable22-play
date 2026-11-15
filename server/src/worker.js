/* 22세기 브르마블 · 온라인 방 서버 (Cloudflare Workers + Durable Objects)
 *   wss://<worker 주소>/room/ABCD?role=host|guest&name=..&tok=..&lv=level1
 *   방 코드 1개 = Durable Object 1개 (같은 코드로 들어온 사람은 항상 같은 객체로 연결됨)
 */
import { RoomCore } from './room-core.js';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS' };

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (url.pathname === '/' || url.pathname === '/health') return new Response('mable22-mp ok', { headers: CORS });
    const m = url.pathname.match(/^\/room\/([A-Za-z0-9]{4})$/);
    if (!m) return new Response('not found', { status: 404, headers: CORS });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426, headers: CORS });
    const origin = req.headers.get('Origin') || '';
    const allow = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (allow.length && !allow.includes(origin)) return new Response('origin not allowed', { status: 403 });
    const code = m[1].toUpperCase();
    const id = env.ROOMS.idFromName(code);
    return env.ROOMS.get(id).fetch(new Request(url.toString().replace(/\/room\/[^/?]+/, '/room/' + code), req));
  }
};

export class Room {
  constructor(state, env) { this.ctx = state; this.env = env; this.core = null; }

  async fetch(req) {
    const url = new URL(req.url);
    const code = url.pathname.split('/').pop();
    if (!this.core) this.core = new RoomCore(code);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const conn = { send: s => server.send(s), close: (c, r) => server.close(c, r) };
    const q = Object.fromEntries(url.searchParams);
    const member = this.core.join(conn, q);
    server.addEventListener('message', ev => this.core.message(member, typeof ev.data === 'string' ? ev.data : ''));
    const bye = () => { this.core.leave(member, conn); this.sweep(); };
    server.addEventListener('close', bye);
    server.addEventListener('error', bye);
    return new Response(null, { status: 101, webSocket: client });
  }

  /* 모두 나간 방은 30분 뒤 비움(같은 코드 재사용 가능) */
  sweep() {
    if (!this.core || !this.core.empty()) return;
    this.ctx.storage.setAlarm(Date.now() + 30 * 60 * 1000).catch(() => { });
  }
  async alarm() { if (this.core && this.core.empty()) this.core = null; }
}
