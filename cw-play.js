/* Crazy World 본편 엔진 (W1·W2 공용). 저장은 모두 try/catch. 자동 맞춤(JS로 글자 줄임) 없음. */
(function () {
  'use strict';
  var C = window.CWP, K = C.key;
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function $(s) { return document.querySelector(s); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function setAppH() { var h = Math.min(innerHeight, (window.visualViewport && visualViewport.height) || 1e5, document.documentElement.clientHeight || 1e5); document.documentElement.style.setProperty('--app-h', Math.round(h) + 'px'); }
  setAppH(); addEventListener('resize', setAppH); addEventListener('orientationchange', function () { setTimeout(setAppH, 250); });
  if (window.visualViewport) visualViewport.addEventListener('resize', setAppH);
  document.documentElement.setAttribute('data-game', C.theme);

  var setup = {}; try { setup = JSON.parse(lsGet(K + '_setup') || '{}'); } catch (e) {}
  var diff = setup.diff || 'std', speed = setup.speed || 'normal', humans = Math.max(1, Math.min(4, setup.humans || 1));
  var opts = setup.opts || {};
  var DELAY = { slow: 1100, normal: 650, fast: 250 }[speed] || 650;
  var COLORS = ['#e5484d', '#2f80ed', '#16a34a', '#d97706'];
  var NAMES = ['빨강', '파랑', '초록', '주황'];
  var CELLS = C.cells;
  var CAT = C.cat; // {카테고리:{ico,base}}
  var BUY = ['도시·주거'];

  function pos(i) { var r, c; if (i <= 10) { r = 10; c = 10 - i; } else if (i <= 20) { r = 10 - (i - 10); c = 0; } else if (i <= 30) { r = 0; c = i - 20; } else { r = i - 30; c = 10; } return [r, c]; }

  var G; // game state
  function fresh() {
    var ps = []; for (var i = 0; i < 4; i++) ps.push({ id: i, name: (i < humans ? '플레이어 ' : 'AI ') + NAMES[i], human: i < humans, cash: C.startCash, pos: 0, alive: true });
    var g = { players: ps, owner: {}, level: {}, turn: 0, round: 1, gauge: C.initGauge(), pending: null, phase: 'roll', log: [], busy: false, countdown: 0, over: false };
    return g;
  }
  function save() { if (G.over) { lsSet(K + '_save', ''); return; } lsSet(K + '_save', JSON.stringify({ round: G.round, G: G })); }
  function logp(t, h) { G.log.push({ t: t, h: !!h }); if (G.log.length > 80) G.log.shift(); }
  function cur() { return G.players[G.turn]; }
  function price(c) { var b = CAT[c.type]; var p = b.base + Math.round(c.no * 1.5); return Math.round(p * C.priceMul(G, c)); }
  function owned(pid, type) { var n = 0; CELLS.forEach(function (c) { if (G.owner[c.no] === pid && (!type || c.type === type)) n++; }); return n; }
  function rent(c) { var o = G.owner[c.no]; var p = CAT[c.type].base + Math.round(c.no * 1.5); var r = p * 0.22 * (1 + 0.8 * (G.level[c.no] || 0)); if (owned(o, c.type) >= 3) r *= 1.5; r *= C.rentMul(G, c); return Math.max(5, Math.round(r)); }
  function worth(p) { var w = p.cash; CELLS.forEach(function (c) { if (G.owner[c.no] === p.id) w += Math.round((CAT[c.type].base + c.no * 1.5) * (1 + 0.6 * (G.level[c.no] || 0))); }); return w; }
  function canBuy(c) { return CAT[c.type] && !CAT[c.type].noBuy && c.type !== '이벤트' && c.type !== 'corner'; }

  function pay(from, to, amt, why) {
    var a = Math.min(amt, Math.max(from.cash, 0) + 0); // 현금 부족 시 자산 매각
    while (from.cash < amt) { var mine = CELLS.filter(function (c) { return G.owner[c.no] === from.id; }); if (!mine.length) break; var c = mine[0]; from.cash += Math.round(price(c) * 0.5); delete G.owner[c.no]; delete G.level[c.no]; logp('💸 ' + from.name + ': ' + c.name + ' 매각(자금 부족)'); }
    var paid = Math.min(from.cash, amt); from.cash -= paid; if (to) to.cash += paid;
    if (paid < amt) { from.alive = false; from.cash = 0; CELLS.forEach(function (c) { if (G.owner[c.no] === from.id) { delete G.owner[c.no]; delete G.level[c.no]; } }); logp('☠️ ' + from.name + ' 파산!', true); }
    return paid;
  }

  function alive() { return G.players.filter(function (p) { return p.alive; }); }
  function checkEnd() {
    var al = alive(); var win = null;
    if (al.length <= 1) win = al[0] || G.players[0];
    else { al.forEach(function (p) { if (worth(p) >= C.winWorth) win = win && worth(win) > worth(p) ? win : p; }); }
    if (win) { G.over = true; save(); showModal('🏆 ' + win.name + ' 승리!', '<p>총 자산 ' + worth(win) + '으로 ' + (al.length <= 1 ? '마지막까지 살아남았어요.' : '목표 자산 ' + C.winWorth + '에 도달했어요.') + '</p>', [{ t: '다시 하기', f: function () { lsSet(K + '_save', ''); location.href = C.intro; } }]); return true; }
    return false;
  }

  function drawCard(p) {
    var d = C.cards[rnd(C.cards.length)];
    logp('🃏 ' + d.t);
    if (d.cash) { if (d.cash > 0) p.cash += d.cash; else pay(p, null, -d.cash); }
    if (d.all) G.players.forEach(function (q) { if (q.alive) { if (d.all > 0) q.cash += d.all; else pay(q, null, -d.all); } });
    if (d.g) C.applyGauge(G, d.g, logp);
    if (d.move != null) { var np = (p.pos + d.move + 40) % 40; if (d.move > 0 && np < p.pos) { p.cash += C.salary; logp('💰 출발 통과 +' + C.salary); } p.pos = np; return 'move'; }
    return null;
  }

  function landed(p, chain) {
    var c = CELLS[p.pos]; logp('📍 ' + p.name + ' → ' + c.name, true);
    if (c.type === 'corner') {
      if (c.no === 0) { p.cash += C.salary; logp('💰 출발 칸 +' + C.salary); }
      else { var r = drawCard(p); if (r === 'move' && !chain) { return landed(p, true); } }
    } else if (c.type === '이벤트') {
      var r2 = drawCard(p); if (r2 === 'move' && !chain) return landed(p, true);
    } else if (G.owner[c.no] == null) {
      var pr = price(c);
      if (p.cash >= pr) { G.pending = { kind: 'buy', no: c.no, price: pr }; return; }
      logp('(자금 부족으로 구매 불가)');
    } else if (G.owner[c.no] === p.id) {
      var lv = G.level[c.no] || 0, cost = Math.round(price(c) * 0.6);
      if (lv < 3 && p.cash >= cost) { G.pending = { kind: 'up', no: c.no, price: cost }; return; }
    } else {
      var o = G.players[G.owner[c.no]], rt = rent(c); var paid = pay(p, o, rt); logp('💸 ' + p.name + ' → ' + o.name + ' 사용료 ' + paid);
    }
    C.onLand && C.onLand(G, p, c, logp);
  }

  function roll() {
    var p = cur(); var d1 = 1 + rnd(6), d2 = 1 + rnd(6); var steps = d1 + d2;
    if (C.diceChoice) steps = C.diceChoice(G, p, d1, d2, logp);
    G.dice = [d1, d2]; logp('🎲 ' + p.name + ' ' + d1 + '+' + d2 + (steps !== d1 + d2 ? ' → ' + steps : ''));
    var np = p.pos + steps; if (np >= 40) { p.cash += C.salary; logp('💰 출발 통과 +' + C.salary); } p.pos = np % 40;
    G.phase = 'landed'; landed(p, false);
  }
  function endTurn() {
    if (checkEnd()) return;
    var n = G.turn; do { n = (n + 1) % 4; if (n === 0) G.round++; } while (!G.players[n].alive);
    G.turn = n; G.phase = 'roll'; G.pending = null; C.onTurn && C.onTurn(G, logp, function () { return checkEnd(); });
    save(); render(); schedule();
  }
  function decide(yes) {
    var p = cur(), pd = G.pending; G.pending = null; if (!pd) return;
    if (yes) { p.cash -= pd.price; if (pd.kind === 'buy') { G.owner[pd.no] = p.id; G.level[pd.no] = 0; logp('🏷 ' + p.name + ' 구매: ' + CELLS[pd.no].name + ' (' + pd.price + ')'); } else { G.level[pd.no] = (G.level[pd.no] || 0) + 1; logp('⬆️ ' + CELLS[pd.no].name + ' 강화 Lv' + G.level[pd.no]); } }
    C.onLand && C.onLand(G, p, CELLS[p.pos], logp, yes && pd.kind === 'buy');
    render(); save(); schedule();
  }
  function ai() {
    var p = cur(); if (!p.alive || p.human || G.over) return;
    if (G.phase === 'roll') { roll(); render(); setTimeout(ai, DELAY); return; }
    if (G.pending) { var pd = G.pending; var reserve = pd.kind === 'buy' ? 90 : 160; decide(p.cash - pd.price >= reserve); setTimeout(ai, DELAY); return; }
    endTurn();
  }
  function schedule() { var p = cur(); if (!G.over && p.alive && !p.human) setTimeout(ai, DELAY); }

  /* ── 화면 ── */
  function build() {
    $('#app').innerHTML = '<div class="game"><div class="board" id="board"></div></div><div class="modal" id="modal" hidden></div>';
    var bd = $('#board'), h = '';
    for (var r = 0; r < 11; r++) for (var c = 0; c < 11; c++) {
      var idx = -1; for (var i = 0; i < 40; i++) { var q = pos(i); if (q[0] === r && q[1] === c) { idx = i; break; } }
      if (idx >= 0) h += '<div class="cell" data-i="' + idx + '" style="grid-row:' + (r + 1) + ';grid-column:' + (c + 1) + '"></div>';
    }
    h += '<div class="center" id="center"><div class="ctop"><span class="ttl">' + esc(C.title) + '</span><span class="rd" id="rd"></span><span class="sp"></span><button class="pill" id="home">⌂ 처음</button></div><div class="pls" id="pls"></div><div class="cmid" id="cmid"></div><div class="log" id="log"></div><div class="acts" id="acts"></div></div>';
    bd.innerHTML = h;
    $('#home').onclick = function () { save(); location.href = C.intro; };
  }
  function render() {
    $('#rd').textContent = 'R' + G.round;
    CELLS.forEach(function (c) {
      var el = document.querySelector('.cell[data-i="' + c.no + '"]'); if (!el) return;
      var o = G.owner[c.no], cat = CAT[c.type] || { ico: '★' };
      el.className = 'cell' + (c.type === 'corner' ? ' corner' : '') + (cur().pos === c.no ? ' cur' : '');
      el.style.borderTopColor = o != null ? COLORS[o] : 'transparent';
      var tk = G.players.filter(function (p) { return p.alive && p.pos === c.no; }).map(function (p) { return '<span class="tok" style="background:' + COLORS[p.id] + '">' + (p.id + 1) + '</span>'; }).join('');
      var lv = G.level[c.no] ? '★'.repeat(G.level[c.no]) : '';
      el.innerHTML = '<span class="tk">' + tk + '</span><span class="ic">' + (c.type === 'corner' ? '🚩' : cat.ico) + '</span><span class="nm">' + esc(c.name) + '</span>' + (canBuy(c) && o == null && c.type !== 'corner' ? '<span class="pr">' + price(c) + '</span>' : '') + '<span class="lv">' + lv + '</span>';
    });
    $('#cmid').innerHTML = '<div class="dice">🎲 ' + (G.dice ? G.dice[0] + '·' + G.dice[1] : '') + '</div><div><div class="who">' + esc(cur().name) + ' 차례</div>' + C.gaugeHtml(G) + '</div>';
    $('#pls').innerHTML = G.players.map(function (p) { return '<div class="pc' + (p.id === G.turn ? ' act' : '') + (p.alive ? '' : ' out') + '" style="border-left:6px solid ' + COLORS[p.id] + '"><b>' + esc(p.name.replace('플레이어 ', '').replace('AI ', 'AI·')) + '</b><span class="cash">💵' + p.cash + '</span><small>자산 ' + worth(p) + '</small></div>'; }).join('');
    var lg = $('#log'); lg.innerHTML = G.log.slice(-14).map(function (l) { return '<p' + (l.h ? ' class="h"' : '') + '>' + esc(l.t) + '</p>'; }).join(''); lg.scrollTop = lg.scrollHeight;
    var a = $('#acts'), p = cur(), me = p.human && p.alive && !G.over;
    if (!me) a.innerHTML = '<button class="btn wide" disabled>' + (p.human ? '' : 'AI 진행 중…') + '</button>';
    else if (G.pending) { var pd = G.pending; a.innerHTML = '<button class="btn" data-a="yes">' + (pd.kind === 'buy' ? '🏷 구매 ' : '⬆️ 강화 ') + pd.price + '</button><button class="btn sub" data-a="no">건너뛰기</button><div class="note">' + esc(CELLS[pd.no].name) + '</div>'; }
    else if (G.phase === 'roll') a.innerHTML = '<button class="btn wide" data-a="roll">🎲 주사위 굴리기</button>';
    else a.innerHTML = '<button class="btn wide" data-a="end">턴 종료 ▶</button>';
    a.querySelectorAll('button').forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-a'); if (k === 'roll') { roll(); render(); } else if (k === 'yes') decide(true); else if (k === 'no') decide(false); else if (k === 'end') endTurn(); }; });
  }
  function showModal(t, body, btns) {
    var m = $('#modal'); m.innerHTML = '<div class="dlg"><h3>' + t + '</h3>' + body + '<div class="acts">' + btns.map(function (b, i) { return '<button class="btn wide" data-i="' + i + '">' + b.t + '</button>'; }).join('') + '</div></div>'; m.hidden = false;
    m.querySelectorAll('button').forEach(function (b) { b.onclick = function () { m.hidden = true; btns[+b.getAttribute('data-i')].f(); }; });
  }

  function start() {
    var resume = /resume=1/.test(location.search), loaded = false;
    if (resume) { try { var s = JSON.parse(lsGet(K + '_save') || 'null'); if (s && s.G) { G = s.G; loaded = true; } } catch (e) {} }
    if (!loaded) { G = fresh(); logp('게임 시작! 목표 총 자산 ' + C.winWorth, true); C.start && C.start(G, logp, diff); }
    build(); render(); save(); schedule();
  }
  window.__cwp = { get G() { return G; }, roll: roll, endTurn: endTurn };
  start();
})();
