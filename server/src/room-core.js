/* 방 1개의 규칙 — Cloudflare Durable Object(worker.js)와 로컬 시험 서버(dev-relay.mjs)가 함께 씀.
 * 연결(conn)은 { send(str), close(code, reason) } 만 있으면 됩니다.
 *
 * 메시지(JSON)
 *  서버→모두   {t:'roster', members:[{seat,name,online,host}], started}
 *  서버→본인   {t:'welcome', seat, host, code}
 *  호스트→서버 {t:'state', d:'<게임 상태 JSON 문자열>'}  → 참가자 모두에게 그대로 전달, 마지막 상태는 보관(늦게/다시 들어온 사람용)
 *  참가자→서버 {t:'act', d:{id,data,cls}}               → 호스트에게 {t:'act', seat, d}
 *  호스트→서버 {t:'start'}  → 자리 잠금(새 사람은 못 들어오고, 원래 사람만 다시 접속 가능)
 *  누구나      {t:'bye'}    → 자리 반납(시작 전) / 연결 끊김 처리(시작 후)
 */
export const MAX_SEATS = 4;
export const MAX_STATE = 900 * 1024;     // 상태 1건 최대 크기(바이트, 대략)

export class RoomCore {
  constructor(code) {
    this.code = code;
    this.members = new Map();   // tok -> {tok, seat, name, host, conn}
    this.state = null;
    this.started = false;
    this.level = '';
    this.touched = Date.now();
  }

  roster() {
    return [...this.members.values()].sort((a, b) => a.seat - b.seat)
      .map(m => ({ seat: m.seat, name: m.name, online: !!m.conn, host: m.host }));
  }
  broadcast(obj, except) {
    const s = JSON.stringify(obj);
    for (const m of this.members.values()) if (m.conn && m !== except) { try { m.conn.send(s); } catch (e) { /* 끊긴 연결 */ } }
  }
  pushRoster() { this.broadcast({ t: 'roster', members: this.roster(), started: this.started }); }
  host() { for (const m of this.members.values()) if (m.host) return m; return null; }
  freeSeat() { const used = new Set([...this.members.values()].map(m => m.seat)); for (let s = 0; s < MAX_SEATS; s++) if (!used.has(s)) return s; return -1; }
  reject(conn, msg) { try { conn.send(JSON.stringify({ t: 'err', m: msg, fatal: true })); conn.close(4000, 'rejected'); } catch (e) { } }

  /* 접속: q = {role:'host'|'guest', name, tok, lv} */
  join(conn, q) {
    this.touched = Date.now();
    const name = String(q.name || '').trim().slice(0, 10) || '플레이어';
    const tok = String(q.tok || '').slice(0, 64);
    if (!tok) return this.reject(conn, '잘못된 접속입니다'), null;
    let m = this.members.get(tok);
    if (m) {                                         // 같은 사람이 다시 접속 → 원래 자리로
      if (m.conn && m.conn !== conn) { try { m.conn.close(4001, 'replaced'); } catch (e) { } }
      m.conn = conn; m.name = name || m.name;
    } else {
      const h = this.host();
      if (q.role === 'host') {
        if (h) return this.reject(conn, '이미 있는 방 코드입니다. 다시 만들어 주세요'), null;
        if (q.lv) this.level = String(q.lv).slice(0, 24);
        m = { tok, seat: 0, name, host: true, conn };
      } else {
        if (!h) return this.reject(conn, '없는 방입니다. 코드를 확인해 주세요'), null;
        if (this.started) return this.reject(conn, '이미 시작한 방입니다'), null;
        if (q.lv && this.level && q.lv !== this.level) return this.reject(conn, `다른 레벨의 방입니다 (${this.level}). 같은 레벨 화면에서 참여해 주세요`), null;
        const seat = this.freeSeat();
        if (seat < 0) return this.reject(conn, '방이 가득 찼습니다 (최대 4명)'), null;
        m = { tok, seat, name, host: false, conn };
      }
      this.members.set(tok, m);
      this.broadcast({ t: 'note', m: `${m.name}님이 들어왔습니다` }, m);
    }
    conn.send(JSON.stringify({ t: 'welcome', seat: m.seat, host: m.host, code: this.code }));
    this.pushRoster();
    if (!m.host && this.state) conn.send(JSON.stringify({ t: 'state', d: this.state }));
    return m;
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
    } else if (o.t === 'act' && !m.host && o.d && typeof o.d === 'object') {
      const h = this.host();
      if (h && h.conn) h.conn.send(JSON.stringify({ t: 'act', seat: m.seat, d: o.d }));
    } else if (o.t === 'start' && m.host) {
      this.started = true; this.pushRoster();
    } else if (o.t === 'bye') {
      if (!this.started && !m.host) { this.members.delete(m.tok); this.broadcast({ t: 'note', m: `${m.name}님이 나갔습니다` }); }
      else if (m.host && !this.started) { this.broadcast({ t: 'err', m: '호스트가 방을 닫았습니다', fatal: true }); this.members.clear(); this.state = null; }
      if (m.conn) { try { m.conn.close(1000, 'bye'); } catch (e) { } m.conn = null; }
      this.pushRoster();
    } else if (o.t === 'ping') {
      m.conn && m.conn.send('{"t":"pong"}');
    }
  }

  leave(m, conn) {
    if (!m || m.conn !== conn) return;
    m.conn = null; this.touched = Date.now();
    this.pushRoster();
  }

  empty() { for (const m of this.members.values()) if (m.conn) return false; return true; }
}
