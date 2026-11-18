/* 22세기 브르마블 · 온라인 방 서버 (Cloudflare Workers + Durable Objects)
 *   GET  https://<worker 주소>/match?lv=level1[&skip=ABCD]   → {code}  빠른 매칭: 지금 사람을 모으는 방 코드
 *   wss://<worker 주소>/room/ABCD?role=host|guest&name=..&tok=..&lv=level1[&pub=1]
 *   방 코드 1개 = Durable Object(Room) 1개, 게임(레벨)마다 대기열 1개 = Durable Object(Matchmaker) 1개
 */
import { RoomCore, MatchCore } from './room-core.js';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS' };

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (url.pathname === '/' || url.pathname === '/health') return new Response('mable22-mp ok', { headers: CORS });
    const origin = req.headers.get('Origin') || '';
    const allow = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (allow.length && !allow.includes(origin)) return new Response('origin not allowed', { status: 403, headers: CORS });
    if (url.pathname === '/match') {
      const lv = (url.searchParams.get('lv') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 24);
      if (!lv) return new Response('lv required', { status: 400, headers: CORS });
      const mm = env.MATCH.get(env.MATCH.idFromName('mm:' + lv));
      const r = await mm.fetch(new Request('https://mm/ticket?skip=' + encodeURIComponent(url.searchParams.get('skip') || '')));
      return new Response(await r.text(), { headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }
    const m = url.pathname.match(/^\/room\/([A-Za-z0-9]{4})$/);
    if (!m) return new Response('not found', { status: 404, headers: CORS });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426, headers: CORS });
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
    if (this.core.empty() && !this.core.started && this.core.members.size === 0) this.core = new RoomCore(code);   // 비어 있던 코드 재사용
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

/* 게임(레벨)별 빠른 매칭 대기열 */
export class Matchmaker {
  constructor(state, env) { this.core = new MatchCore(); }
  async fetch(req) {
    const skip = new URL(req.url).searchParams.get('skip') || '';
    return new Response(JSON.stringify({ code: this.core.ticket(skip) }));
  }
}
