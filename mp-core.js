/* 22세기 브르마블 · 다중 플레이 공통 모듈 (mp-core.js) — Level 1~4 공용
 *
 * 사람 최대 4명이 각자 폰으로 함께 합니다. 한 기기 돌려하기는 없습니다.
 * 팝업 창은 쓰지 않습니다 — 각 게임 첫 화면(설정 화면)의 '게임 시작' 버튼 위에 멀티플레이 패널이 들어가고,
 * 매칭 대기·친구 방 화면도 모두 그 패널 안에서 바뀝니다. (2026-11-24, 팝업이 기기마다 눌리지 않던 문제로 전면 교체)
 *  · ⚡ 빠른 매칭: 같은 게임에 접속한 모르는 사람끼리 자동으로 모여 바로 시작(4명이면 3초, 2~3명이면 15초 뒤, 빈 자리 AI)
 *  · 👥 친구와 하기: 방을 만들어 코드/링크로 친구를 부르고 호스트가 시작
 *  호스트 기기가 게임을 실제로 돌리고(판정·주사위·AI 모두 호스트),
 *  참가자 기기는 게임 상태를 받아 같은 화면을 그리며, 자기 차례의 선택만 호스트로 보냅니다.
 *     서버는 Cloudflare Workers + Durable Object(방 1개 = 객체 1개) — server/ 폴더 참고.
 *
 * 각 레벨은 파일 끝에서 MP.bind({...}) 로 어댑터를 등록합니다(레벨마다 변수 이름이 달라서).
 * 게임 코드에서 '나'를 뜻하던 S.players[0] 은 ME() 로 바뀌었습니다.
 */
(function () {
  'use strict';
  var A = null;                                  // 레벨 어댑터
  var MP = window.MP = {
    v: 1, mode: 'local', seat: null, code: null, roster: [], started: false,
    hint: null, replaySeat: null, replaying: false, lastHuman: null,
    remote: { asker: null, turn: null }, ws: null, closing: false
  };

  /* ───────── 공통 도우미 ───────── */
  /* 어댑터가 붙기 전(설정 화면 예시판 등)에는 게임의 전역 S/G를 직접 봄 */
  function raw() { try { if (typeof S !== 'undefined' && S) return S; } catch (e) {} try { if (typeof G !== 'undefined' && G) return G; } catch (e) {} return null; }
  function ps() { try { if (A) return A.players() || []; var r = raw(); return (r && r.players) || []; } catch (e) { return []; } }
  function live(p) { return !!p && !p.bankrupt && !p.out; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pcol(p) { return (p && (p.color || p.col)) || '#6d5dfc'; }
  function pemo(p) { return (p && (p.emoji || p.sym)) || '🙂'; }
  function el(tag, cls, html) { var d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; }
  function store(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }
  MP.isOnline = function () { return MP.mode === 'host' || MP.mode === 'client' || MP.mode === 'queue'; };

  /* 지금 '결정해야 하는 사람' — 레벨이 MP.who(p)로 힌트를 주면 그 사람, 아니면 차례인 사람 */
  MP.turnPlayer = function () { if (MP.mode === 'client') return ps()[MP.remote.turn] || null; try { return ps()[A ? A.turn() : ((raw() || {}).turn || 0)] || null; } catch (e) { return null; } };
  MP.asker = function () {
    var L = ps();
    if (MP.mode === 'client') return L[MP.remote.asker] || MP.turnPlayer();
    if (MP.hint != null && L[MP.hint]) return L[MP.hint];
    if (A && A.asker) { try { var a = A.asker(); if (a) return a; } catch (e) {} }
    return MP.turnPlayer();
  };
  MP.who = function (p) { MP.hint = p ? p.id : null; };
  MP.clearWho = function () { MP.hint = null; };

  /* 화면의 '나' — 온라인이면 내 자리, 혼자 할 때는 사람 플레이어 */
  window.ME = MP.me = function () {
    var L = ps(); if (!L.length) return null;
    if (MP.replaySeat != null && L[MP.replaySeat]) return L[MP.replaySeat];
    if (MP.isOnline() && MP.seat != null && L[MP.seat]) return L[MP.seat];
    var t = MP.turnPlayer();
    if (t && t.human && live(t)) { MP.lastHuman = t.id; return t; }
    if (MP.lastHuman != null && L[MP.lastHuman]) return L[MP.lastHuman];
    for (var i = 0; i < L.length; i++) if (L[i].human) return L[i];
    return L[0];
  };
  MP.humans = function () { return ps().filter(function (p) { return p.human && live(p); }); };

  /* ───────── 스타일 ───────── */
  var CSS = '' +
    /* 첫 화면 패널 — 게임 화면 흐름 안에 들어감(겹치는 창 없음) */
    '.mp-panel{display:block;box-sizing:border-box;width:100%;margin:12px 0;padding:12px;border:2px solid #c9c2ff;border-radius:14px;background:#f7f6ff;color:#1d2433;font-size:14px;line-height:1.4;text-align:left;position:relative;z-index:1;pointer-events:auto}' +
    '.mp-panel *{box-sizing:border-box}' +
    '.mp-ph{font-weight:900;font-size:15px;margin:0 0 6px;color:#3b2fb8}.mp-ph small{font-weight:600;color:#667085;font-size:12px;margin-left:4px}' +
    '.mp-btn{display:inline-flex;flex:1 1 0;align-items:center;justify-content:center;gap:6px;border:0;border-radius:11px;padding:10px 12px;min-height:44px;font:inherit;font-weight:800;cursor:pointer;background:#6d5dfc;color:#fff;touch-action:manipulation;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}' +
    '.mp-btn.hot{background:#f59e0b;color:#1d1300}.mp-btn.sec{background:#e9e7fb;color:#3b2fb8}.mp-btn.sm{flex:0 0 auto;min-height:34px;padding:6px 10px;font-size:12.5px}.mp-btn:disabled{opacity:.45;cursor:not-allowed}' +
    '.mp-row{display:flex;gap:8px;align-items:center;margin:8px 0}.mp-row input{flex:1 1 0;min-width:0;border:1.5px solid #c9c2ff;border-radius:10px;padding:9px 10px;font:inherit;font-size:16px;background:#fff;color:#1d2433}' +
    '.mp-row input[data-mp-code]{text-transform:uppercase;letter-spacing:.2em}' +
    '.mp-name label{display:flex;gap:8px;align-items:center;flex:1;font-size:12.5px;color:#475467;font-weight:700}.mp-name input{font-size:14px;padding:6px 9px}' +
    '.mp-room{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-weight:700;color:#475467}.mp-code{font-size:26px;font-weight:900;letter-spacing:.16em;color:#4b3fd1}' +
    '.mp-seats{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0}.mp-seat{border:1.5px solid #e4e7ec;border-radius:10px;padding:7px 9px;font-size:13px;display:flex;gap:6px;align-items:center;min-height:38px;background:#fff}.mp-seat b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mp-seat.empty{color:#98a2b3;border-style:dashed}.mp-seat .dot{width:9px;height:9px;border-radius:50%;background:#12b76a;flex:none}.mp-seat .dot.off{background:#f04438}' +
    '.mp-note{background:#eef0ff;border-radius:10px;padding:8px 10px;font-size:12.5px;color:#475467;margin:8px 0}.mp-note.warn{background:#fff6ed;color:#9c4a0a}' +
    '.mp-qhead{font-size:18px;font-weight:900;text-align:center;margin:6px 0 2px}.mp-qcount{text-align:center;color:#4b3fd1;font-weight:800;min-height:20px}' +
    /* 게임 중 상태 알약·알림·오류 — 작은 띠만, 화면을 덮지 않음 */
    '.mp-pill{position:fixed;left:50%;transform:translateX(-50%);bottom:max(6px,env(safe-area-inset-bottom));z-index:2147482000;background:rgba(20,24,40,.88);color:#fff;border-radius:999px;padding:5px 12px;font-size:12px;font-weight:700;max-width:92vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;touch-action:manipulation}' +
    '.mp-pill.mine{background:#12b76a;animation:mpPulse 1.2s ease-in-out infinite}@keyframes mpPulse{50%{transform:translateX(-50%) scale(1.06)}}' +
    '.mp-toast{position:fixed;left:50%;top:max(14px,env(safe-area-inset-top));transform:translateX(-50%);z-index:2147483100;background:#1d2433;color:#fff;border-radius:12px;padding:9px 14px;font-size:13.5px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.3);max-width:92vw;text-align:center;transition:opacity .3s;pointer-events:none}' +
    '.mp-err{position:fixed;left:8px;right:8px;bottom:max(8px,env(safe-area-inset-bottom));z-index:2147483200;background:#b42318;color:#fff;border-radius:10px;padding:8px 10px;font-size:13px;font-weight:700;box-shadow:0 6px 18px rgba(0,0,0,.3)}.mp-err small{opacity:.8;font-weight:600}.mp-err button{float:right;border:0;border-radius:8px;background:#fff;color:#b42318;font:inherit;font-weight:800;padding:3px 9px;margin-left:8px}' +
    '.mp-sent{outline:3px solid #12b76a!important;outline-offset:2px}' +
    '@media (prefers-reduced-motion:reduce){.mp-pill.mine{animation:none}}';
  function css() { if (document.getElementById('mp-css')) return; var s = el('style'); s.id = 'mp-css'; s.textContent = CSS; (document.head || document.documentElement).appendChild(s); }

  /* 화면 오류 표시 — 실제 기기(아이패드 등)에서 무엇이 멈췄는지 바로 보이게: 화면 아래 빨간 줄 + 최근 5건 기록(localStorage m22_errlog) */
  var errShown = 0;
  function showErr(msg, src, line) {
    try {
      if (!msg || /^Script error\.?$/.test(msg) || /ResizeObserver loop/.test(msg)) return;
      if (src && src.indexOf(location.origin) !== 0 && src.indexOf('http') === 0) return;   // 다른 사이트(확장 프로그램 등) 오류 제외
      var file = (src || '').split('/').pop().split('?')[0], rec = { t: new Date().toISOString(), m: String(msg).slice(0, 200), f: file, l: line || 0, ua: navigator.userAgent.slice(0, 160), w: innerWidth + 'x' + innerHeight };
      try { var L = JSON.parse(localStorage.getItem('m22_errlog') || '[]'); L.push(rec); localStorage.setItem('m22_errlog', JSON.stringify(L.slice(-5))); } catch (e) {}
      if (errShown >= 3) return; errShown++; css();
      var d = el('div', 'mp-err'); d.setAttribute('role', 'alert');
      d.innerHTML = '⚠️ 오류: ' + esc(rec.m) + ' <small>(' + esc(file) + ':' + rec.l + ')</small> <button type="button">닫기</button>';
      d.querySelector('button').onclick = function () { d.remove(); };
      document.body.appendChild(d);
    } catch (e) {}
  }
  window.addEventListener('error', function (e) { showErr(e.message, e.filename, e.lineno); });
  window.addEventListener('unhandledrejection', function (e) { var r = e.reason; showErr(r && (r.message || String(r)), r && r.stack && (r.stack.match(/(https?:[^\s)]+?):(\d+):\d+/) || [])[1], 0); });
  MP.errors = function () { try { return JSON.parse(localStorage.getItem('m22_errlog') || '[]'); } catch (e) { return []; } };

  var toastT = null;
  MP.toast = function (msg, ms) {
    css(); var t = document.getElementById('mp-toast');
    if (!t) { t = el('div', 'mp-toast'); t.id = 'mp-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.innerHTML = msg; t.style.opacity = '1'; clearTimeout(toastT);
    toastT = setTimeout(function () { t.style.opacity = '0'; }, ms || 2200);
  };

  MP.newGame = function () { MP.lastHuman = null; MP.hint = null; };

  /* ───────── 온라인 방 ───────── */
  MP.server = function () {
    var q = null; try { q = new URLSearchParams(location.search).get('mp'); } catch (e) {}
    var s = q || window.MP_SERVER || ''; return s.replace(/\/+$/, '');
  };
  function genCode() { var C = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = ''; for (var i = 0; i < 4; i++) s += C[Math.floor(Math.random() * C.length)]; return s; }
  function token(code) { var k = 'm22_mp_tok_' + code, t = store(k); if (!t) { t = Math.random().toString(36).slice(2) + Date.now().toString(36); store(k, t); } return t; }
  function send(o) { try { if (MP.ws && MP.ws.readyState === 1) MP.ws.send(JSON.stringify(o)); } catch (e) {} }
  MP.memberOnline = function (seat) { for (var i = 0; i < MP.roster.length; i++) if (MP.roster[i].seat === seat) return !!MP.roster[i].online; return false; };
  function isRemoteSeat(seat) { return MP.mode === 'host' && seat !== MP.seat && MP.memberOnline(seat); }

  var retry = 0, retryT = null;
  function connect(role, code, name, pub) {
    var base = MP.server(); if (!base) { MP.toast('온라인 서버 주소가 아직 설정되지 않았습니다 (mp-config.js)'); return; }
    MP.closing = false; MP.code = code; MP.role = role; MP.name = name; MP.pubJoin = !!pub;
    var url = base.replace(/^http/, 'ws') + '/room/' + encodeURIComponent(code) + '?role=' + role + '&name=' + encodeURIComponent(name) +
      '&tok=' + encodeURIComponent(token(code)) + '&lv=' + encodeURIComponent((A && A.level) || '') + (pub ? '&pub=1' : '');
    var ws; try { ws = new WebSocket(url); } catch (e) { MP.toast('연결 실패: ' + esc(e.message)); return; }
    MP.ws = ws;
    ws.onopen = function () { retry = 0; };
    ws.onmessage = function (ev) { var m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); };
    ws.onclose = function (ev) {
      if (MP.ws !== ws) return; MP.ws = null; pill();
      if (MP.closing) return;
      if (ev && ev.code === 4000) return;               // 서버가 거절(방 없음·가득 참 등) — 메시지로 이미 안내
      if (retry < 8) { retry++; clearTimeout(retryT); retryT = setTimeout(function () { connect(MP.role, MP.code, MP.name, MP.pubJoin); }, Math.min(8000, 600 * retry)); MP.toast('연결이 끊겨 다시 잇는 중… (' + retry + ')'); }
    };
  }
  MP.leave = function () {
    if (!MP.started && MP.mode === 'host' && A && A.prepareForm) { try { A.prepareForm(1, []); } catch (e) {} }
    MP.closing = true; send({ t: 'bye' }); try { MP.ws && MP.ws.close(); } catch (e) {}
    MP.ws = null; MP.mode = 'local'; MP.seat = null; MP.code = null; MP.roster = []; MP.started = false; MP.matching = false; MP.startAt = 0;
    try { var mq = new URLSearchParams(location.search).get('mp'); history.replaceState(null, '', location.pathname + (mq ? '?mp=' + encodeURIComponent(mq) : '')); } catch (e) {}
    pill(); panelRender();
  };

  /* ⚡ 빠른 매칭: 서버에서 '지금 사람을 모으는 방' 코드를 받아 들어감 */
  function autoName() { var n = store('m22_mp_name'); if (!n) { n = '플레이어' + (1000 + Math.floor(Math.random() * 9000)); store('m22_mp_name', n); } return n; }
  MP.quick = function (skip, tries) {
    var base = MP.server();
    if (!base) { MP.toast('온라인 서버가 아직 연결되지 않았습니다'); return; }
    MP.matching = true; MP.qTries = tries || 0; MP.startAt = 0; panelRender();
    var http = base.replace(/^ws/, 'http');
    fetch(http + '/match?lv=' + encodeURIComponent((A && A.level) || '') + (skip ? '&skip=' + encodeURIComponent(skip) : ''), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (o) { if (MP.matching && o && o.code) connect('guest', o.code, autoName(), true); })
      .catch(function () { MP.matching = false; MP.toast('매칭 서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요', 3000); panelRender(); });
  };
  /* 매칭 방이 시작되면 0번(호스트) 기기가 설정을 채우고 자동으로 게임 시작 */
  function autoStartHost() {
    var n = Math.max(1, MP.roster.length), names = [];
    for (var s = 0; s < n; s++) { var m = null; MP.roster.forEach(function (r) { if (r.seat === s) m = r; }); names.push(m ? m.name : ''); }
    try { A.prepareForm(n, names); } catch (e) { console.warn('[MP] prepare', e); }
    setTimeout(function () { try { A.autoStart(); } catch (e) { console.warn('[MP] autostart', e); MP.toast('자동 시작에 실패했습니다. 게임 시작을 눌러 주세요'); } }, 80);
  }

  var lastMineAsk = false;
  function onMsg(m) {
    if (m.t === 'welcome') {
      var wasQueue = MP.mode === 'queue';
      MP.seat = m.seat; MP.code = m.code; MP.pub = !!m.pub;
      MP.mode = (m.pub && !m.go) ? 'queue' : (m.host ? 'host' : 'client');
      if (m.go && m.pub) { MP.matching = false; if (m.host && wasQueue) MP.autoGo = true; }
      try { history.replaceState(null, '', location.pathname + '?room=' + m.code + (new URLSearchParams(location.search).get('mp') ? '&mp=' + encodeURIComponent(MP.server()) : '')); } catch (e) {}
      if (MP.mode === 'client' && A && A.clientMode) { try { A.clientMode(); } catch (e) {} }
      panelRender(); pill();
    } else if (m.t === 'roster') {
      var before = MP.roster.length;
      MP.roster = m.members || [];
      MP.startAt = m.startIn != null ? Date.now() + m.startIn : 0;
      if (MP.autoGo && m.started) { MP.autoGo = false; autoStartHost(); }
      else if (m.started && MP.mode === 'host' && !MP.pub) MP.started = true;
      if (MP.mode === 'queue' && MP.roster.length > before && before > 0) { try { navigator.vibrate && navigator.vibrate(60); } catch (e) {} }
      if (MP.mode === 'host' && !MP.pub && !MP.started) fillForm();      // 친구 방: 들어온 인원을 바로 설정에 반영
      panelRender(); pill();
    } else if (m.t === 'state') {
      if (MP.mode !== 'client') return; applyState(m.d);
    } else if (m.t === 'act') {
      if (MP.mode !== 'host') return; replay(m.seat, m.d);
    } else if (m.t === 'note') {
      MP.toast(esc(m.m));
    } else if (m.t === 'err') {
      if (m.fatal && MP.matching && MP.qTries < 3) { var c = MP.code; MP.closing = true; MP.mode = 'local'; MP.seat = null; MP.quick(c, MP.qTries + 1); return; }   // 그새 시작·가득 → 다른 방
      MP.toast('⚠️ ' + esc(m.m), 3500);
      if (m.fatal) { MP.closing = true; MP.mode = 'local'; MP.seat = null; MP.matching = false; panelRender(); pill(); }
    }
  }

  /* 참가자: 상태를 받아 그대로 그림 */
  function applyState(j) {
    var o; try { o = JSON.parse(j); } catch (e) { return; }
    MP.remote = { asker: o.a, turn: o.t };
    try {
      A.setState(o.s);
      if (!MP.started) { MP.started = true; if (A.enterGame) A.enterGame(); }
      A.render();
    } catch (e) { console.warn('[MP] render', e); }
    var mine = o.open && o.a === MP.seat;
    if (mine && !lastMineAsk) { MP.toast('🔔 내 차례입니다!', 1800); try { navigator.vibrate && navigator.vibrate(180); } catch (e) {} }
    lastMineAsk = !!mine; MP.remote.open = !!o.open; pill();
  }

  /* 호스트: 상태가 바뀔 때마다 방에 보냄 */
  var lastSent = '', bcT = null;
  function broadcast() {
    if (MP.mode !== 'host' || !MP.started || !MP.ws || MP.ws.readyState !== 1) return;
    var s; try { s = A.state(); } catch (e) { return; } if (!s) return;
    var a = MP.asker(), j;
    try { j = JSON.stringify({ s: s, a: a ? a.id : null, t: A.turn(), open: !!(A.askOpen && A.askOpen()) }); } catch (e) { return; }
    if (j === lastSent) return; lastSent = j; send({ t: 'state', d: j }); pill();
  }
  MP.flush = function () { clearTimeout(bcT); bcT = setTimeout(broadcast, 30); };
  setInterval(broadcast, 300);

  /* 클릭을 '어떤 버튼인지' 설명으로 바꿔 보내고, 호스트에서 같은 버튼을 찾아 눌러 줌 */
  function desc(e) { var d = {}; for (var k in e.dataset) if (k.indexOf('mp') !== 0) d[k] = e.dataset[k]; return { id: e.id || '', data: d, cls: (e.classList && e.classList[0]) || '' }; }
  function kebab(k) { return k.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }); }
  function findEl(d) {
    if (d.id) return document.getElementById(d.id);
    var sel = Object.keys(d.data || {}).map(function (k) { return '[data-' + kebab(k) + '="' + String(d.data[k]).replace(/["\\]/g, '\\$&') + '"]'; }).join('');
    if (!sel) return null; var list = document.querySelectorAll(sel);
    for (var i = 0; i < list.length; i++) if (!list[i].disabled && A.actionEl(list[i]) === list[i]) return list[i];
    return list[0] || null;
  }
  function replay(seat, d) {
    var a = MP.asker();
    var ok = A.canAct ? A.canAct(seat, d) : (a && a.id === seat);
    if (!ok) return;
    MP.replaySeat = seat; MP.replaying = true;
    try { A.render(); var t = findEl(d); if (t && !t.disabled) t.click(); }
    catch (e) { console.warn('[MP] replay', e); }
    finally { MP.replaying = false; MP.replaySeat = null; }
    setTimeout(function () { try { A.render(); } catch (e) {} MP.flush(); }, 0);
  }

  /* 클릭 가드 — 참가자는 자기 차례 버튼만 보냄 / 호스트는 원격 참가자 차례에 대신 누르지 못함 */
  document.addEventListener('click', function (e) {
    if (!A || !MP.started || !MP.isOnline() || MP.replaying) return;
    var t = e.target && e.target.closest ? A.actionEl(e.target) : null; if (!t) return;
    var a = MP.asker();
    if (MP.mode === 'client') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (!a || a.id !== MP.seat) { MP.toast('⏳ ' + esc(a ? a.name : '다른 사람') + '님 차례입니다'); return; }
      if (t.disabled) return;
      send({ t: 'act', d: desc(t) }); t.classList.add('mp-sent');
    } else if (MP.mode === 'host' && a && isRemoteSeat(a.id)) {
      e.preventDefault(); e.stopImmediatePropagation();
      MP.toast('📡 ' + esc(a.name) + '님(온라인)이 선택하는 중입니다');
    }
  }, true);

  /* 상태 알약(화면 아래) */
  function pill() {
    var p = document.getElementById('mp-pill');
    if (!MP.isOnline()) { if (p) p.remove(); return; }
    css(); if (!p) { p = el('div', 'mp-pill'); p.id = 'mp-pill'; p.onclick = pillTap; document.body.appendChild(p); }
    var a = MP.started ? MP.asker() : null, mine = a && a.id === MP.seat, on = MP.ws && MP.ws.readyState === 1;
    var txt = '🌐 ' + MP.code + ' · ' + MP.roster.filter(function (r) { return r.online; }).length + '명 접속';
    if (!on) txt = '⚠️ 연결 끊김 · ' + MP.code;
    else if (a && MP.started) {
      txt += ' · ' + (mine ? '🔔 내 차례' : esc(a.name) + (a.human ? '님 차례' : ' (AI)'));
      if (MP.mode === 'host' && a.human && a.id !== MP.seat && !MP.memberOnline(a.id)) txt += ' · 연결 끊김 → 대신 선택 가능';
    } else if (MP.mode === 'queue') { txt = '⚡ 매칭 중 · ' + MP.roster.length + '/4명' + (MP.startAt ? ' · ' + Math.max(0, Math.ceil((MP.startAt - Date.now()) / 1000)) + '초 뒤 시작' : ' · 상대 찾는 중'); }
    else if (!MP.started) txt += MP.mode === 'host' ? ' · 설정 후 게임 시작' : (MP.pub ? ' · 게임 준비 중' : ' · 호스트 시작 대기');
    p.className = 'mp-pill' + (mine && (MP.mode === 'host' || MP.remote.open) ? ' mine' : '');
    p.innerHTML = txt;
  }
  setInterval(function () { if (MP.isOnline()) pill(); }, 1000);

  /* ───────── 첫 화면 안 멀티플레이 패널 (팝업 없음) ───────── */
  function seatsHTML() {
    var h = '';
    for (var s = 0; s < 4; s++) {
      var m = null; for (var i = 0; i < MP.roster.length; i++) if (MP.roster[i].seat === s) m = MP.roster[i];
      h += m ? '<div class="mp-seat"><span class="dot' + (m.online ? '' : ' off') + '"></span><b>' + (s + 1) + '. ' + esc(m.name) + '</b>' + (m.host ? '👑' : '') + (s === MP.seat ? '<small>나</small>' : '') + '</div>'
             : '<div class="mp-seat empty">' + (s + 1) + '. 빈 자리 (AI)</div>';
    }
    return h;
  }
  function secLeft() { return MP.startAt ? Math.max(0, Math.ceil((MP.startAt - Date.now()) / 1000)) : 0; }
  function countText() { var s = secLeft(); return s ? s + '초 뒤 시작' : (MP.roster.length >= 2 ? '곧 시작합니다' : '같은 게임에 들어온 사람을 기다리는 중'); }
  function panelHTML() {
    var srv = MP.server(), h = '<div class="mp-ph">👥 멀티플레이 <small>최대 4명 · 각자 폰·패드·PC로</small></div>';
    var queue = MP.mode === 'queue' || MP.matching || (MP.pub && MP.isOnline() && !MP.started);
    if (queue) {
      var n = MP.roster.length;
      var head = MP.mode !== 'queue' ? (MP.pub ? '🎲 게임을 여는 중…' : '🔎 서버에 연결하는 중…') : (n < 2 ? '🔎 상대를 찾는 중…' : (n >= 4 ? '🎉 4명 모두 모였습니다!' : '👀 ' + n + '명 모였습니다'));
      h += '<div class="mp-qhead">⚡ ' + head + '</div><div class="mp-qcount" data-mp-count>' + (MP.mode === 'queue' ? countText() : '') + '</div>';
      if (MP.mode === 'queue') h += '<div class="mp-seats">' + seatsHTML() + '</div>';
      h += '<div class="mp-note">4명이면 바로, 2~3명이면 15초 뒤 자동 시작 · 빈 자리는 AI</div>';
      h += '<div class="mp-row">' + (MP.mode === 'queue' ? '<button class="mp-btn" type="button" data-mp-act="go"' + (n >= 2 ? '' : ' disabled') + '>▶ 지금 시작</button>' : '') +
           '<button class="mp-btn sec" type="button" data-mp-act="leave" data-mp-leave>취소</button></div>';
    } else if (MP.isOnline()) {
      h += '<div class="mp-room">방 코드 <b class="mp-code">' + esc(MP.code) + '</b> <button class="mp-btn sec sm" type="button" data-mp-act="copy">🔗 초대 링크 복사</button></div>';
      h += '<div class="mp-seats">' + seatsHTML() + '</div>';
      h += MP.mode === 'host' ? '<div class="mp-note">친구가 다 들어오면 아래 <b>▶ 게임 시작</b>을 누르세요. 이 방 인원이 자동으로 자리에 앉습니다.</div>'
                              : '<div class="mp-note">내 자리 ' + (MP.seat + 1) + '번 · 방장이 시작하면 화면이 자동으로 열립니다.</div>';
      h += '<div class="mp-row"><button class="mp-btn sec" type="button" data-mp-act="leave" data-mp-leave>방 나가기</button></div>';
    } else {
      if (!srv) h += '<div class="mp-note warn">온라인 서버가 연결되지 않아 지금은 1인 플레이만 됩니다.</div>';
      h += '<div class="mp-row"><button class="mp-btn hot" type="button" data-mp-act="quick" data-mp-quick' + (srv ? '' : ' disabled') + '>⚡ 빠른 매칭</button>' +
           '<button class="mp-btn" type="button" data-mp-act="create"' + (srv ? '' : ' disabled') + '>🏠 방 만들기</button></div>';
      h += '<div class="mp-row"><input data-mp-code maxlength="4" inputmode="text" autocapitalize="characters" autocomplete="off" placeholder="방 코드 4자리" aria-label="방 코드"><button class="mp-btn sec" type="button" data-mp-act="join"' + (srv ? '' : ' disabled') + '>🚪 참여</button></div>';
      h += '<div class="mp-row mp-name"><label>내 이름 <input data-mp-name maxlength="10" autocomplete="off" value="' + esc(store('m22_mp_name') || '') + '" placeholder="자동"></label></div>';
      h += '<div class="mp-note">혼자 하려면 아래 <b>▶ 게임 시작</b>을 누르세요.</div>';
    }
    return h;
  }
  var lastPanelKey = '';
  function panelRender(force) {
    var p = document.querySelector('[data-mp-panel]'); if (!p) return;
    var key = [MP.mode, MP.matching, MP.pub, MP.started, MP.code, MP.seat, !!MP.server(), JSON.stringify(MP.roster), MP.roster.length >= 2].join('|');
    if (!force && key === lastPanelKey && p.innerHTML) return;      // 같은 상태면 다시 그리지 않음(입력 중인 글자 보존)
    lastPanelKey = key; p.innerHTML = panelHTML();
  }
  MP.panelRender = function () { panelRender(true); };
  /* 설정 화면이 보일 때 '게임 시작' 버튼 위에 패널을 넣음 — 게임이 설정 화면을 다시 그려도 0.4초 안에 다시 붙음 */
  function ensurePanel() {
    if (!A) return;
    var vis = false; try { vis = !MP.started && A.setupVisible(); } catch (e) {}
    var p = document.querySelector('[data-mp-panel]');
    if (!vis) return;
    if (p && p.isConnected) return;
    var at = null; try { at = A.panelAt && A.panelAt(); } catch (e) {}
    if (!at) return;
    try { var pe = at.parentElement; if (pe && pe.tagName !== 'FORM' && /flex|grid/.test(getComputedStyle(pe).display)) at = pe; } catch (e) {}   // 버튼이 가로줄(flex) 안이면 그 줄 위에
    css(); p = el('section', 'mp-panel'); p.setAttribute('data-mp-panel', ''); p.setAttribute('aria-label', '멀티플레이');
    at.parentNode.insertBefore(p, at); lastPanelKey = ''; panelRender(true);
  }
  setInterval(ensurePanel, 400);
  setInterval(function () { var c = document.querySelector('[data-mp-panel] [data-mp-count]'); if (c && MP.mode === 'queue') c.textContent = countText(); }, 250);

  function panelName() { var i = document.querySelector('[data-mp-panel] [data-mp-name]'); var v = ((i && i.value) || '').trim().slice(0, 10); if (v) store('m22_mp_name', v); return v || autoName(); }
  function joinCode() {
    var i = document.querySelector('[data-mp-panel] [data-mp-code]'); var c = ((i && i.value) || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(c)) { MP.toast('방 코드 4자리를 확인해 주세요'); return; }
    connect('guest', c, panelName());
  }
  function inviteUrl() { return location.origin + location.pathname + '?room=' + MP.code + (new URLSearchParams(location.search).get('mp') ? '&mp=' + encodeURIComponent(MP.server()) : ''); }
  /* 패널 버튼은 한 곳(문서)에서 받음 — 게임이 화면을 다시 그려도 버튼이 '죽지' 않음 */
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-mp-panel] [data-mp-act]') : null;
    if (!b || b.disabled) return;
    e.preventDefault(); e.stopPropagation();
    var act = b.getAttribute('data-mp-act');
    if (act === 'quick') { panelName(); MP.quick(); }
    else if (act === 'create') connect('host', genCode(), panelName());
    else if (act === 'join') joinCode();
    else if (act === 'go') send({ t: 'go' });
    else if (act === 'leave') MP.leave();
    else if (act === 'copy') { var u = inviteUrl(); try { navigator.clipboard.writeText(u).then(function () { MP.toast('초대 링크를 복사했습니다'); }, function () { prompt('초대 링크', u); }); } catch (x) { prompt('초대 링크', u); } }
  });
  /* 매칭 대기·참가자 대기 중에는 '게임 시작'(혼자 하기)을 막음 — 실수로 혼자 시작해 방이 꼬이지 않게 */
  document.addEventListener('click', function (e) {
    if (!A || !A.panelAt || !(MP.mode === 'queue' || MP.matching || (MP.mode === 'client' && !MP.started))) return;
    var s = null; try { s = A.panelAt(); } catch (x) {}
    if (s && e.target && (e.target === s || (s.contains && s.contains(e.target)))) { e.preventDefault(); e.stopImmediatePropagation(); MP.toast(MP.mode === 'client' ? '방장이 시작하면 자동으로 열립니다' : '매칭 중입니다. 혼자 하려면 먼저 ‘취소’를 누르세요'); }
  }, true);
  /* 패널 안 입력칸에서 Enter → 게임 설정 폼이 제출되지 않게 (코드 칸이면 참여) */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !e.target || !e.target.closest || !e.target.closest('[data-mp-panel]')) return;
    e.preventDefault(); e.stopPropagation(); if (e.target.hasAttribute('data-mp-code')) joinCode();
  }, true);
  /* 게임 중 아래 알약을 누르면 방 나가기 */
  function pillTap() {
    if (!MP.started) { var p = document.querySelector('[data-mp-panel]'); if (p) try { p.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { } return; }
    if (confirm('방 ' + MP.code + '에서 나갈까요?')) MP.leave();
  }
  /* 친구 방 방장: 들어온 인원을 설정 화면(사람 수·이름)에 바로 반영 */
  function fillForm() {
    var n = Math.max(1, MP.roster.length), names = [];
    for (var s = 0; s < n; s++) { var m = null; MP.roster.forEach(function (r) { if (r.seat === s) m = r; }); names.push(m ? m.name : ''); }
    try { A.prepareForm(n, names); } catch (e) { console.warn('[MP] form', e); }
    setTimeout(ensurePanel, 0);
  }
  MP.openLobby = pillTap;

  /* 호스트가 새 게임을 만들 때 — 방 인원을 자리에 앉힘 */
  MP.onNewState = function (s) {
    MP.newGame();
    if (MP.mode !== 'host') return s;
    try { A.applySeats(s, MP.roster.slice()); } catch (e) { console.warn('[MP] seats', e); }
    var L = (A.playersOf ? A.playersOf(s) : s.players) || [];
    var miss = MP.roster.filter(function (r) { return !L[r.seat]; });
    if (miss.length) MP.toast('⚠️ 자리가 모자라 ' + miss.map(function (r) { return esc(r.name); }).join(', ') + '님이 빠졌습니다. 사람 수를 늘려 다시 시작하세요', 4500);
    MP.started = true; lastSent = ''; if (!MP.pub) send({ t: 'start' }); setTimeout(MP.flush, 50); setTimeout(pill, 60);
    return s;
  };

  /* ───────── 어댑터 등록 ───────── */
  MP.bind = function (adapter) {
    A = adapter; css(); ensurePanel();
    var room = null; try { room = new URLSearchParams(location.search).get('room'); } catch (e) {}
    if (room && /^[A-Za-z0-9]{4}$/.test(room)) setTimeout(function () { connect('guest', room.toUpperCase(), store('m22_mp_name') || autoName()); }, 300);   // 초대 링크 → 바로 참여(새로고침이면 같은 자리로)
  };
})();
