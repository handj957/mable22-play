/* 22세기 브르마블 · 다중 플레이 공통 모듈 (mp-core.js) — Level 1~4 공용
 *
 * 사람 최대 4명이 각자 폰으로 함께 합니다 (온라인 방). 한 기기 돌려하기는 없습니다.
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
  MP.isOnline = function () { return MP.mode === 'host' || MP.mode === 'client'; };

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
    '.mp-ov{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(10,14,30,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);padding:16px;font-family:inherit}' +
    '.mp-card{width:min(420px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:#fff;color:#1d2433;border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.35);padding:18px 18px 16px;font-size:14px;line-height:1.45}' +
    '.mp-card h3{margin:0 0 4px;font-size:18px}.mp-card .mp-sub{color:#667085;font-size:12.5px;margin:0 0 12px}' +
    '.mp-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;border-radius:11px;padding:11px 14px;min-height:44px;font:inherit;font-weight:800;cursor:pointer;background:#6d5dfc;color:#fff}.mp-btn.sec{background:#eef0f5;color:#344054}.mp-btn.w{width:100%}.mp-btn:disabled{opacity:.45;cursor:not-allowed}' +
    '.mp-row{display:flex;gap:8px;align-items:center;margin:8px 0}.mp-row input{flex:1;min-width:0;border:1.5px solid #d0d5dd;border-radius:10px;padding:10px 11px;font:inherit;font-size:16px}' +
    '.mp-code{font-size:34px;font-weight:900;letter-spacing:.18em;text-align:center;margin:6px 0 2px;color:#4b3fd1}' +
    '.mp-seats{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 0}.mp-seat{border:1.5px solid #e4e7ec;border-radius:10px;padding:8px 9px;font-size:13px;display:flex;gap:6px;align-items:center;min-height:40px}.mp-seat b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mp-seat.empty{color:#98a2b3;border-style:dashed}.mp-seat .dot{width:9px;height:9px;border-radius:50%;background:#12b76a;flex:none}.mp-seat .dot.off{background:#f04438}' +
    '.mp-note{background:#f5f7ff;border-radius:10px;padding:9px 11px;font-size:12.5px;color:#475467;margin:8px 0}.mp-note.warn{background:#fff6ed;color:#9c4a0a}' +
    '.mp-fab{position:fixed;right:max(10px,env(safe-area-inset-right));top:max(10px,env(safe-area-inset-top));z-index:2147482000;border:0;border-radius:999px;padding:9px 14px;min-height:40px;font:inherit;font-weight:800;font-size:13.5px;background:#6d5dfc;color:#fff;box-shadow:0 6px 18px rgba(77,61,209,.4);cursor:pointer}' +
    '.mp-pill{position:fixed;left:50%;transform:translateX(-50%);bottom:max(6px,env(safe-area-inset-bottom));z-index:2147482000;background:rgba(20,24,40,.88);color:#fff;border-radius:999px;padding:5px 12px;font-size:12px;font-weight:700;max-width:92vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:auto;cursor:pointer}' +
    '.mp-pill.mine{background:#12b76a;animation:mpPulse 1.2s ease-in-out infinite}@keyframes mpPulse{50%{transform:translateX(-50%) scale(1.06)}}' +
    '.mp-toast{position:fixed;left:50%;top:max(14px,env(safe-area-inset-top));transform:translateX(-50%);z-index:2147483100;background:#1d2433;color:#fff;border-radius:12px;padding:9px 14px;font-size:13.5px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.3);max-width:92vw;text-align:center;transition:opacity .3s}' +
    '.mp-sent{outline:3px solid #12b76a!important;outline-offset:2px}' +
    '@media (prefers-reduced-motion:reduce){.mp-pill.mine{animation:none}}';
  function css() { if (document.getElementById('mp-css')) return; var s = el('style'); s.id = 'mp-css'; s.textContent = CSS; (document.head || document.documentElement).appendChild(s); }

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
  function connect(role, code, name) {
    var base = MP.server(); if (!base) { MP.toast('온라인 서버 주소가 아직 설정되지 않았습니다 (mp-config.js)'); return; }
    MP.closing = false; MP.code = code; MP.role = role; MP.name = name;
    var url = base.replace(/^http/, 'ws') + '/room/' + encodeURIComponent(code) + '?role=' + role + '&name=' + encodeURIComponent(name) +
      '&tok=' + encodeURIComponent(token(code)) + '&lv=' + encodeURIComponent((A && A.level) || '');
    var ws; try { ws = new WebSocket(url); } catch (e) { MP.toast('연결 실패: ' + esc(e.message)); return; }
    MP.ws = ws;
    ws.onopen = function () { retry = 0; };
    ws.onmessage = function (ev) { var m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); };
    ws.onclose = function (ev) {
      if (MP.ws !== ws) return; MP.ws = null; pill();
      if (MP.closing) return;
      if (ev && ev.code === 4000) return;               // 서버가 거절(방 없음·가득 참 등) — 메시지로 이미 안내
      if (retry < 8) { retry++; clearTimeout(retryT); retryT = setTimeout(function () { connect(MP.role, MP.code, MP.name); }, Math.min(8000, 600 * retry)); MP.toast('연결이 끊겨 다시 잇는 중… (' + retry + ')'); }
    };
  }
  MP.leave = function () {
    if (!MP.started && MP.mode === 'host' && A && A.prepareForm) { try { A.prepareForm(1, []); } catch (e) {} }
    MP.closing = true; send({ t: 'bye' }); try { MP.ws && MP.ws.close(); } catch (e) {}
    MP.ws = null; MP.mode = 'local'; MP.seat = null; MP.code = null; MP.roster = []; MP.started = false;
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
    pill(); lobbyRender();
  };

  var lastMineAsk = false;
  function onMsg(m) {
    if (m.t === 'welcome') {
      MP.seat = m.seat; MP.mode = m.host ? 'host' : 'client'; MP.code = m.code;
      try { history.replaceState(null, '', location.pathname + '?room=' + m.code + (new URLSearchParams(location.search).get('mp') ? '&mp=' + encodeURIComponent(MP.server()) : '')); } catch (e) {}
      if (MP.mode === 'client' && A && A.clientMode) { try { A.clientMode(); } catch (e) {} }
      lobbyRender(); pill();
    } else if (m.t === 'roster') {
      MP.roster = m.members || []; if (m.started && MP.mode === 'host') MP.started = true;
      lobbyRender(); pill();
    } else if (m.t === 'state') {
      if (MP.mode !== 'client') return; applyState(m.d);
    } else if (m.t === 'act') {
      if (MP.mode !== 'host') return; replay(m.seat, m.d);
    } else if (m.t === 'note') {
      MP.toast(esc(m.m));
    } else if (m.t === 'err') {
      MP.toast('⚠️ ' + esc(m.m), 3500);
      if (m.fatal) { MP.closing = true; MP.mode = 'local'; MP.seat = null; lobbyRender(); pill(); }
    }
  }

  /* 참가자: 상태를 받아 그대로 그림 */
  function applyState(j) {
    var o; try { o = JSON.parse(j); } catch (e) { return; }
    MP.remote = { asker: o.a, turn: o.t };
    try {
      A.setState(o.s);
      if (!MP.started) { MP.started = true; closeLobby(); if (A.enterGame) A.enterGame(); }
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
    css(); if (!p) { p = el('div', 'mp-pill'); p.id = 'mp-pill'; p.onclick = openLobby; document.body.appendChild(p); }
    var a = MP.started ? MP.asker() : null, mine = a && a.id === MP.seat, on = MP.ws && MP.ws.readyState === 1;
    var txt = '🌐 ' + MP.code + ' · ' + MP.roster.filter(function (r) { return r.online; }).length + '명 접속';
    if (!on) txt = '⚠️ 연결 끊김 · ' + MP.code;
    else if (a && MP.started) {
      txt += ' · ' + (mine ? '🔔 내 차례' : esc(a.name) + (a.human ? '님 차례' : ' (AI)'));
      if (MP.mode === 'host' && a.human && a.id !== MP.seat && !MP.memberOnline(a.id)) txt += ' · 연결 끊김 → 대신 선택 가능';
    } else if (!MP.started) txt += MP.mode === 'host' ? ' · 설정 후 게임 시작' : ' · 호스트 시작 대기';
    p.className = 'mp-pill' + (mine && (MP.mode === 'host' || MP.remote.open) ? ' mine' : '');
    p.innerHTML = txt;
  }
  setInterval(function () { if (MP.isOnline()) pill(); }, 1000);

  /* ───────── 로비(함께 플레이) ───────── */
  var lob = null;
  function openLobby() { css(); if (lob) return; lob = el('div', 'mp-ov'); lob.setAttribute('role', 'dialog'); lob.setAttribute('aria-modal', 'true'); lob.addEventListener('click', function (e) { if (e.target === lob && !(MP.mode === 'client' && !MP.started)) closeLobby(); }); document.body.appendChild(lob); lobbyRender(); }
  function closeLobby() { if (lob) { lob.remove(); lob = null; } }
  MP.openLobby = openLobby;
  function seatsHTML() {
    var h = '';
    for (var s = 0; s < 4; s++) {
      var m = null; for (var i = 0; i < MP.roster.length; i++) if (MP.roster[i].seat === s) m = MP.roster[i];
      h += m ? '<div class="mp-seat"><span class="dot' + (m.online ? '' : ' off') + '"></span><b>' + (s + 1) + '. ' + esc(m.name) + '</b>' + (m.host ? '👑' : '') + (s === MP.seat ? '<small>나</small>' : '') + '</div>'
             : '<div class="mp-seat empty">' + (s + 1) + '. 빈 자리 (AI)</div>';
    }
    return h;
  }
  function lobbyRender() {
    if (!lob) return;
    var nm = store('m22_mp_name') || '', srv = MP.server(), h = '';
    h += '<h3>👥 온라인 방 <span style="font-size:12px;color:#98a2b3">최대 4명 · 각자 폰으로</span></h3>';
    h += '<p class="mp-sub">친구들이 각자 폰·패드로 같은 판을 합니다. 빈 자리는 AI가 채웁니다.</p>';
    if (!MP.isOnline()) {
      if (!srv) h += '<div class="mp-note warn">온라인 서버가 아직 연결되지 않았습니다. 관리자가 Cloudflare에 서버를 배포한 뒤 <b>mp-config.js</b>에 주소를 넣으면 열립니다.</div>';
      h += '<div class="mp-row"><input data-mp-name maxlength="10" placeholder="내 이름" value="' + esc(nm) + '" aria-label="내 이름"></div>';
      h += '<button class="mp-btn w" type="button" data-mp-create ' + (srv ? '' : 'disabled') + '>🏠 방 만들기 (호스트)</button>';
      h += '<div class="mp-row" style="margin-top:12px"><input data-mp-code maxlength="4" placeholder="방 코드 4자리" style="text-transform:uppercase;letter-spacing:.2em" value="' + esc(MP.pendingCode || '') + '" aria-label="방 코드"><button class="mp-btn" type="button" data-mp-join ' + (srv ? '' : 'disabled') + '>🚪 참여</button></div>';
      h += '<div class="mp-note">호스트 기기가 게임을 돌리고, 참가자는 각자 폰·패드에서 자기 차례에 선택합니다. 호스트 화면이 꺼지면 게임이 멈추니 호스트는 화면을 켜 두세요.</div>';
      h += '<button class="mp-btn sec w" type="button" data-mp-close>닫기</button>';
    } else {
      h += '<div style="text-align:center;color:#667085;font-size:12px">방 코드</div><div class="mp-code">' + esc(MP.code) + '</div>';
      h += '<div class="mp-row"><button class="mp-btn sec w" type="button" data-mp-copy>🔗 초대 링크 복사</button></div>';
      h += '<div class="mp-seats">' + seatsHTML() + '</div>';
      if (MP.mode === 'host') {
        h += MP.started ? '<div class="mp-note">게임 진행 중입니다. 연결이 끊긴 참가자는 같은 기기로 다시 들어오면 자리로 돌아옵니다.</div>'
          : '<div class="mp-note">참가자가 다 들어오면 아래 버튼을 누르세요. 설정 화면의 사람 수·이름이 이 방 인원으로 채워집니다. 그다음 평소처럼 <b>게임 시작</b>을 누르면 됩니다.</div><button class="mp-btn w" type="button" data-mp-fill>✅ 이 인원으로 설정 채우기</button>';
      } else {
        h += MP.started ? '<div class="mp-note">게임 진행 중 · 내 자리 ' + (MP.seat + 1) + '번</div>'
          : '<div class="mp-note">내 자리 ' + (MP.seat + 1) + '번 · 호스트가 게임을 시작하면 화면이 자동으로 열립니다.</div>';
      }
      h += '<div class="mp-row">' + (MP.started ? '<button class="mp-btn w" type="button" data-mp-close>게임으로</button>' : '') + '<button class="mp-btn sec w" type="button" data-mp-leave>방 나가기</button></div>';
    }
    lob.innerHTML = '<div class="mp-card">' + h + '</div>';
    var q = function (s) { return lob.querySelector(s); };
    if (q('[data-mp-close]')) q('[data-mp-close]').onclick = closeLobby;
    var getName = function () { var v = (q('[data-mp-name]') || {}).value; v = (v || '').trim().slice(0, 10); if (!v) { MP.toast('이름을 적어 주세요'); return null; } store('m22_mp_name', v); return v; };
    if (q('[data-mp-create]')) q('[data-mp-create]').onclick = function () { var n = getName(); if (n) connect('host', genCode(), n); };
    if (q('[data-mp-join]')) q('[data-mp-join]').onclick = function () { var n = getName(); if (!n) return; var c = ((q('[data-mp-code]') || {}).value || '').trim().toUpperCase(); if (!/^[A-Z0-9]{4}$/.test(c)) { MP.toast('방 코드 4자리를 확인해 주세요'); return; } connect('guest', c, n); };
    if (q('[data-mp-leave]')) q('[data-mp-leave]').onclick = function () { if (MP.started && !confirm('방에서 나갈까요?')) return; MP.leave(); };
    if (q('[data-mp-copy]')) q('[data-mp-copy]').onclick = function () { var u = location.origin + location.pathname + '?room=' + MP.code + (new URLSearchParams(location.search).get('mp') ? '&mp=' + encodeURIComponent(MP.server()) : ''); try { navigator.clipboard.writeText(u).then(function () { MP.toast('초대 링크를 복사했습니다'); }); } catch (e) { prompt('초대 링크', u); } };
    if (q('[data-mp-fill]')) q('[data-mp-fill]').onclick = function () {
      var n = Math.max(1, MP.roster.length), names = [];
      for (var s = 0; s < 4; s++) { var m = null; MP.roster.forEach(function (r) { if (r.seat === s) m = r; }); names.push(m ? m.name : ''); }
      try { A.prepareForm(n, names.slice(0, n)); MP.toast('설정을 ' + n + '명으로 채웠습니다. 게임 시작을 누르세요'); closeLobby(); } catch (e) { MP.toast('설정을 채우지 못했습니다: ' + esc(e.message)); }
    };
  }

  /* 설정 화면에서만 보이는 ‘온라인 방’ 버튼 */
  function fab() {
    var f = document.getElementById('mp-fab'), show = false;
    try { show = !!A && !MP.started && A.setupVisible(); } catch (e) {}
    if (show && !f) { css(); f = el('button', 'mp-fab', '👥 온라인 방'); f.id = 'mp-fab'; f.type = 'button'; f.onclick = openLobby; document.body.appendChild(f); }
    if (f) f.hidden = !show;
  }

  /* 호스트가 새 게임을 만들 때 — 방 인원을 자리에 앉힘 */
  MP.onNewState = function (s) {
    MP.newGame();
    if (MP.mode !== 'host') return s;
    try { A.applySeats(s, MP.roster.slice()); } catch (e) { console.warn('[MP] seats', e); }
    var L = (A.playersOf ? A.playersOf(s) : s.players) || [];
    var miss = MP.roster.filter(function (r) { return !L[r.seat]; });
    if (miss.length) MP.toast('⚠️ 자리가 모자라 ' + miss.map(function (r) { return esc(r.name); }).join(', ') + '님이 빠졌습니다. 사람 수를 늘려 다시 시작하세요', 4500);
    MP.started = true; lastSent = ''; send({ t: 'start' }); setTimeout(MP.flush, 50); setTimeout(pill, 60);
    return s;
  };

  /* ───────── 어댑터 등록 ───────── */
  MP.bind = function (adapter) {
    A = adapter; css();
    setInterval(fab, 500); fab();
    var room = null; try { room = new URLSearchParams(location.search).get('room'); } catch (e) {}
    if (room && /^[A-Za-z0-9]{4}$/.test(room)) { MP.pendingCode = room.toUpperCase(); setTimeout(function () {
      var nm = store('m22_mp_name'), tk = store('m22_mp_tok_' + MP.pendingCode);
      if (nm && tk) connect('guest', MP.pendingCode, nm);        // 새로고침 → 같은 자리로 자동 복귀
      else openLobby();
    }, 400); }
  };
})();
