/* 방 1개의 규칙 + 빠른 매칭 — Cloudflare Durable Object(worker.js)와 로컬 시험 서버(dev-relay.mjs)가 함께 씀.
 * 연결(conn)은 { send(str), close(code, reason) } 만 있으면 됩니다.
 *
 * 방은 두 종류
 *  · 친구 방(비공개): 호스트가 코드를 만들고 친구가 코드로 들어옴. 호스트가 게임 시작.
 *  · 매칭 방(공개)  : 빠른 매칭으로 모르는 사람끼리 모임. 호스트 없이 대기 →
 *                     4명이면 3초 뒤, 2~3명이면 둘째가 들어온 뒤 15초 뒤 자동 시작(누구나 '지금 시작' 가능).
 *                     시작 순간 접속 중인 사람만 남기고 자리를 0,1,2…로 정리, 0번이 호스트(게임을 돌리는 기기).
 *
 * 메시지(JSON)
 *  서버→모두   {t:'roster', members:[{seat,name,online,host}], started, pub, startIn}
 *  서버→본인   {t:'welcome', seat, host, code, pub, go}
 *  호스트→서버 {t:'state', d:'<게임 상태 JSON 문자열>'}  → 참가자 모두에게 전달, 마지막 상태 보관
 *  참가자→서버 {t:'act', d:{id,data,cls}}               → 호스트에게 {t:'act', seat, d}
 *  호스트→서버 {t:'start'}  → 친구 방 자리 잠금
 *  매칭 방     {t:'go'}     → 2명 이상이면 지금 시작
 *  누구나      {t:'bye'}    → 시작 전이면 자리 반납
 */
export const MAX_SEATS = 4;
export const MAX_STATE = 900 * 1024;     // 상태 1건 최대 크기(바이트, 대략)
export const MATCH_WAIT = 15000;         // 매칭 방: 둘째가 들어오면 이만큼 뒤 자동 시작
export const MATCH_FULL = 3000;          // 매칭 방: 4명이 차면 이만큼 뒤 시작
export const MATCH_WINDOW = 30000;       // 매칭 대기열: 방 하나에 새 사람을 넣어 주는 시간

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function genCode() { let s = ''; for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; return s; }

/* 레벨별 대기열: 지금 사람을 모으고 있는 매칭 방 코드를 하나 들고 있다가 나눠 줌 */
export class MatchCore {
  constructor() { this.open = null; }
  ticket(skip, now = Date.now()) {
    const o = this.open;
    if (o && skip && o.code === skip) this.open = null;          // 그 방은 이미 시작/가득 → 새 방
    else if (o && o.n < MAX_SEATS && now - o.at < MATCH_WINDOW) { o.n++; return o.code; }
    this.open = { code: genCode(), at: now, n: 1 };
    return this.open.code;
  }
}

export class RoomCore {
  constructor(code, timers) {
    this.code = code;
    this.members = new Map();   // tok -> {tok, seat, name, host, conn}
    this.state = null;
    this.started = false;
    this.pub = false;
    this.level = '';
    this.goAt = 0; this.goT = null;
    this.timers = timers || { set: (f, ms) => setTimeout(f, ms), clear: t => clearTimeout(t) };
    this.touched = Date.now();
  }

  online() { return [...this.members.values()].filter(m => m.conn); }
  roster() {
    return [...this.members.values()].sort((a, b) => a.seat - b.seat)
      .map(m => ({ seat: m.seat, name: m.name, online: !!m.conn, host: m.host }));
  }
  broadcast(obj, except) {
    const s = JSON.stringify(obj);
    for (const m of this.members.values()) if (m.conn && m !== except) { try { m.conn.send(s); } catch (e) { /* 끊긴 연결 */ } }
  }
  pushRoster() {
    this.broadcast({ t: 'roster', members: this.roster(), started: this.started, pub: this.pub, startIn: this.goAt && !this.started ? Math.max(0, this.goAt - Date.now()) : null });
  }
  host() { for (const m of this.members.values()) if (m.host) return m; return null; }
  freeSeat() { const used = new Set([...this.members.values()].map(m => m.seat)); for (let s = 0; s < MAX_SEATS; s++) if (!used.has(s)) return s; return -1; }
  reject(conn, msg) { try { conn.send(JSON.stringify({ t: 'err', m: msg, fatal: true })); conn.close(4000, 'rejected'); } catch (e) { } }
  welcome(m, go) { try { m.conn && m.conn.send(JSON.stringify({ t: 'welcome', seat: m.seat, host: m.host, code: this.code, pub: this.pub, go: !!go })); } catch (e) { } }

  /* 접속: q = {role:'host'|'guest', name, tok, lv, pub} */
  join(conn, q) {
    this.touched = Date.now();
    const name = String(q.name || '').trim().slice(0, 10) || '플레이어';
    const tok = String(q.tok || '').slice(0, 64);
    const lv = String(q.lv || '').slice(0, 24);
    if (!tok) return this.reject(conn, '잘못된 접속입니다'), null;
    let m = this.members.get(tok);
    if (m) {                                         // 같은 사람이 다시 접속 → 원래 자리로
      if (m.conn && m.conn !== conn) { try { m.conn.close(4001, 'replaced'); } catch (e) { } }
      m.conn = conn; m.name = name || m.name;
    } else {
      if (q.pub === '1' && !this.members.size && !this.started) { this.pub = true; this.level = lv; }   // 매칭 방의 첫 사람
      const h = this.host();
      if (lv && this.level && lv !== this.level) return this.reject(conn, `다른 게임의 방입니다 (${this.level}). 같은 게임 화면에서 참여해 주세요`), null;
      if (this.started) return this.reject(conn, '이미 시작한 방입니다'), null;
      if (this.pub) {
        if (q.role === 'host') return this.reject(conn, '이미 있는 방 코드입니다. 다시 만들어 주세요'), null;
        const seat = this.freeSeat();
        if (seat < 0) return this.reject(conn, '방이 가득 찼습니다 (최대 4명)'), null;
        m = { tok, seat, name, host: false, conn };
      } else if (q.role === 'host') {
        if (h || this.members.size) return this.reject(conn, '이미 있는 방 코드입니다. 다시 만들어 주세요'), null;
        this.level = lv;
        m = { tok, seat: 0, name, host: true, conn };
      } else {
        if (!h) return this.reject(conn, '없는 방입니다. 코드를 확인해 주세요'), null;
        const seat = this.freeSeat();
        if (seat < 0) return this.reject(conn, '방이 가득 찼습니다 (최대 4명)'), null;
        m = { tok, seat, name, host: false, conn };
      }
      this.members.set(tok, m);
      this.broadcast({ t: 'note', m: `${m.name}님이 들어왔습니다` }, m);
    }
    this.welcome(m, this.started);
    if (this.pub && !this.started) this.schedule();
    this.pushRoster();
    if (!m.host && this.state) conn.send(JSON.stringify({ t: 'state', d: this.state }));
    return m;
  }

  /* 매칭 방 자동 시작 시간 계산 */
  schedule() {
    if (!this.pub || this.started) return;
    const n = this.online().length, now = Date.now();
    let at = 0;
    if (n >= MAX_SEATS) at = Math.min(this.goAt || Infinity, now + MATCH_FULL);
    else if (n >= 2) at = this.goAt || now + MATCH_WAIT;
    if (at === this.goAt) return;
    this.goAt = at;
    if (this.goT) { this.timers.clear(this.goT); this.goT = null; }
    if (at) this.goT = this.timers.set(() => this.go(), Math.max(0, at - now));
  }

  /* 매칭 방 시작: 접속 중인 사람만 남기고 자리 정리, 0번이 호스트 */
  go() {
    if (!this.pub || this.started) return;
    if (this.goT) { this.timers.clear(this.goT); this.goT = null; }
    const on = this.online().sort((a, b) => a.seat - b.seat);
    if (on.length < 2) { this.goAt = 0; this.pushRoster(); return; }
    for (const m of [...this.members.values()]) if (!m.conn) this.members.delete(m.tok);
    on.forEach((m, i) => { m.seat = i; m.host = i === 0; });
    this.started = true; this.goAt = 0;
    on.forEach(m => this.welcome(m, true));
    this.pushRoster();
  }

  message(m, raw) {
    if (!m) return;
    this.touched = Date.now();
    if (typeof raw !== 'string' || raw.length > MAX_STATE + 1024) return;
    let o; try { o = JSON.parse(raw); } catch (e) { return; }
    if (o.t === 'state' && m.host && typeof o.d === 'string') {
      if (o.d.length > MAX_STATE) { m.conn && m.conn.send(JSON.stringify({ t: 'err', m: '게임 상태가 너무 커서 보내지 못했습니다' })); return; }
      this.state = o.d;
      const s = JSON.stringify({ t: 'state', d: o.d });
      for (const x of this.members.values()) if (x.conn && !x.host) { try { x.conn.send(s); } catch (e) { } }
    } else if (o.t === 'act' && !m.host && this.started && o.d && typeof o.d === 'object') {
      const h = this.host();
      if (h && h.conn) h.conn.send(JSON.stringify({ t: 'act', seat: m.seat, d: o.d }));
    } else if (o.t === 'start' && m.host) {
      if (!this.started) { this.started = true; this.pushRoster(); }
    } else if (o.t === 'go' && this.pub) {
      this.go();
    } else if (o.t === 'bye') {
      if (!this.started && !m.host) { this.members.delete(m.tok); this.broadcast({ t: 'note', m: `${m.name}님이 나갔습니다` }); }
      else if (m.host && !this.started) { this.broadcast({ t: 'err', m: '호스트가 방을 닫았습니다', fatal: true }); this.members.clear(); this.state = null; }
      if (m.conn) { try { m.conn.close(1000, 'bye'); } catch (e) { } m.conn = null; }
      this.schedule(); this.pushRoster();
    } else if (o.t === 'ping') {
      m.conn && m.conn.send('{"t":"pong"}');
    }
  }

  leave(m, conn) {
    if (!m || m.conn !== conn) return;
    m.conn = null; this.touched = Date.now();
    if (this.pub && !this.started) { this.members.delete(m.tok); if (this.online().length < 2) { this.goAt = 0; if (this.goT) { this.timers.clear(this.goT); this.goT = null; } } }
    this.pushRoster();
  }

  empty() { for (const m of this.members.values()) if (m.conn) return false; return true; }
}
