/* 보드 중앙 패널·칸 보정 모음(Level 3·4, Beginning 3·4)
   ① 동맹 제안의 '얻는 것/잃는 것' 칸이 좁은 열에 끼어 글자가 세로로 쪼개지던 문제 ② 큰 말(.v34pawn)이 칸 이름을 가리던 문제
   ③ 짧은 선택 메뉴(주식 매수·매도 등)의 버튼이 가로로 길게 늘어서지 않게 함
   - 선택지가 4개 이상이면 게임이 '목록형'(버튼 한 줄에 하나, 가로 100%)으로 그린다.
   - 설명 없이 이름만 있는 짧은 선택지는 글자 폭만큼의 알약 버튼으로 줄바꿈해 모아 보여 준다.
   - 정책처럼 설명·미리보기가 붙은 긴 목록은 그대로 둔다. */
(function () {
  'use strict';
  if (window.__quickActs) return;
  window.__quickActs = 1;
  var P = ':root:not(#qa1):not(#qa2):not(#qa3) body .board .center .amini.asking.quick ';
  var P0 = ':root:not(#qa1):not(#qa2):not(#qa3) body .board .center .amini ';
  var Q = ':root:not(#qa1):not(#qa2):not(#qa3) body .actbody ';
  var css = [
    P + '.acts{display:flex!important;grid-template-columns:none!important;flex-direction:row!important;flex-wrap:wrap!important;align-items:center!important;justify-content:flex-start!important;gap:6px!important}',
    P + '.acts .btn,' + P + '.acts .btn.ghost{display:inline-flex!important;flex:0 0 auto!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;width:auto!important;min-width:0!important;max-width:100%!important;align-self:auto!important;min-height:30px!important;height:auto!important;padding:4px 12px!important;border-radius:999px!important;text-align:center!important;white-space:nowrap!important}',
    P + '.acts .btn .bl{display:inline!important;white-space:nowrap!important;text-align:center!important;overflow:visible!important}',
    // Level 3: 선택 메뉴가 보드 중앙이 아니라 왼쪽 카드(.actbody)에 열린다
    Q + '.acts.qa-pills{display:flex!important;grid-template-columns:none!important;flex-direction:row!important;flex-wrap:wrap!important;align-items:center!important;justify-content:flex-start!important;gap:6px!important}',
    Q + '.acts.qa-pills .btn,' + Q + '.acts.qa-pills .btn.ghost{display:inline-flex!important;flex:0 0 auto!important;align-items:center!important;justify-content:center!important;width:auto!important;min-width:0!important;max-width:100%!important;min-height:30px!important;height:auto!important;padding:4px 12px!important;border-radius:999px!important;white-space:nowrap!important;text-align:center!important}',

    // ① 동맹 제안: 좁은 첫 열(주사위 열)이 아니라 패널 전체 폭을 쓰고 글자는 단어 단위로 줄바꿈
    P0 + '.v29ae{grid-column:1/-1!important;justify-self:stretch!important;width:auto!important;min-width:0!important;max-width:100%!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;box-sizing:border-box!important}',
    P0 + '.v29ae>div{min-width:0!important;overflow-wrap:break-word!important;word-break:keep-all!important;writing-mode:horizontal-tb!important;white-space:normal!important}',
    P0 + '.v29ae .net{grid-column:1/-1!important}',
    // '1/-1'이 첫 칸(46px)까지만 잡히는 격자가 있어, 열 수를 세어 span으로 지정(클래스는 mark()가 붙임)
    ':root:not(#qa1):not(#qa2):not(#qa3) body .board .center .amini.qa-span .v29ae{grid-column-start:1!important;grid-column-end:span var(--qa-cols)!important}'
  ].join('\n');
  var st = document.createElement('style');
  st.id = 'quickacts';
  st.textContent = css;
  document.head.appendChild(st);

  function mark() {
    var am = document.querySelector('#board .center > .amini');
    if (!am) return;
    var btns = am.querySelectorAll('.acts .btn');
    var ok = am.classList.contains('asking') && !am.classList.contains('v28roll') && btns.length >= 4;
    if (ok) {
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        if (b.querySelector('small') || b.textContent.trim().length > 16) { ok = false; break; }
      }
    }
    am.classList.toggle('quick', ok);
    var cols = am.querySelector('.v29ae') ? getComputedStyle(am).gridTemplateColumns.split(/\s+/).filter(Boolean).length : 0;
    am.classList.toggle('qa-span', cols > 1);
    if (cols > 1) am.style.setProperty('--qa-cols', cols);
  }
  function markCard() {
    var list = document.querySelectorAll('.actbody .acts');
    for (var j = 0; j < list.length; j++) {
      var bs = list[j].querySelectorAll('.btn'), ok = bs.length >= 4;
      for (var i = 0; ok && i < bs.length; i++) if (bs[i].querySelector('small') || bs[i].textContent.trim().length > 16) ok = false;
      list[j].classList.toggle('qa-pills', ok);
    }
  }

  // ② 큰 말(.v34pawn)은 칸 이름(.nm) 위쪽 빈자리(국기·아이콘 자리)에 맞춰 크기·위치를 정해 이름을 가리지 않게 한다
  function nudgePawns() {
    if (typeof S === 'undefined' || !S || typeof v34Cell !== 'function') return;
    var stage = document.getElementById('stage');
    if (!stage) return;
    var sr = stage.getBoundingClientRect();
    var els = stage.querySelectorAll('.v34pawn');
    var groups = {};
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.style.display === 'none' || el.classList.contains('dead')) continue;
      var p = null;
      for (var j = 0; j < S.players.length; j++) if (String(S.players[j].id) === el.dataset.p) { p = S.players[j]; break; }
      if (!p || p.bankrupt) continue;
      (groups[p.pos] = groups[p.pos] || []).push({ el: el, p: p });
    }
    Object.keys(groups).forEach(function (pos) {
      var C = v34Cell(+pos);
      var cellEl = document.querySelector('#board [data-cell="' + pos + '"]');
      if (!C || !cellEl) return;
      var nm = cellEl.querySelector('.nm');
      var g = groups[pos], n = g.length;
      var nr = nm ? nm.getBoundingClientRect() : null;
      // 이름 위쪽 빈 높이(이름이 없거나 위에 자리가 없으면 칸 위쪽 38%만 사용)
      var above = nr && nr.height ? (nr.top - sr.top) - C.t - 2 : C.h * .55;
      var cornerOnly = above < 15;
      var area = cornerOnly ? Math.min(C.h * .4, 18) : above;
      var size = Math.max(14, Math.min(26, area - 1, (C.w - 4) / (n > 1 ? 1.5 : 1)));
      var step = n > 1 ? Math.min(size * .7, (C.w - 4 - size) / (n - 1)) : 0;
      for (var k = 0; k < n; k++) {
        var el = g[k].el, now = el.classList.contains('now');
        var sz = Math.min(now ? size * 1.15 : size, Math.max(14, area));
        el.style.setProperty('--ps', sz.toFixed(0) + 'px');
        var cx = C.x + (n > 1 ? (k - (n - 1) / 2) * step : 0);
        if (cornerOnly) cx = C.l + C.w - sz / 2 - 2 - k * step;
        var cy = cornerOnly ? C.t + sz / 2 + 1 : C.t + Math.max(sz / 2 + 1, area / 2 + 1);
        el.style.left = cx + 'px';
        el.style.top = cy + 'px';
      }
    });
  }
  if (typeof v34Pawns === 'function') {
    var vp0 = v34Pawns;
    v34Pawns = function () {
      var r = vp0.apply(this, arguments);
      try { nudgePawns(); } catch (e) { if (window.console) console.error('quick-acts pawns', e); }
      return r;
    };
  }
  if (typeof renderBoard === 'function') {
    var r0 = renderBoard;
    renderBoard = function () {
      var r = r0.apply(this, arguments);
      try { mark(); markCard(); } catch (e) { if (window.console) console.error('quick-acts', e); }
      return r;
    };
  }
  new MutationObserver(function () { try { mark(); markCard(); } catch (e) {} })
    .observe(document.body, { childList: true, subtree: true });
})();
