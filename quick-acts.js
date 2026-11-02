/* 짧은 선택 메뉴(주식 매수·매도 등)의 버튼이 가로로 길게 늘어서지 않게 함
   - 선택지가 4개 이상이면 게임이 '목록형'(버튼 한 줄에 하나, 가로 100%)으로 그린다.
   - 설명 없이 이름만 있는 짧은 선택지는 글자 폭만큼의 알약 버튼으로 줄바꿈해 모아 보여 준다.
   - 정책처럼 설명·미리보기가 붙은 긴 목록은 그대로 둔다. */
(function () {
  'use strict';
  if (window.__quickActs) return;
  window.__quickActs = 1;
  var P = ':root:not(#qa1):not(#qa2):not(#qa3) body .board .center .amini.asking.quick ';
  var Q = ':root:not(#qa1):not(#qa2):not(#qa3) body .actbody ';
  var css = [
    P + '.acts{display:flex!important;grid-template-columns:none!important;flex-direction:row!important;flex-wrap:wrap!important;align-items:center!important;justify-content:flex-start!important;gap:6px!important}',
    P + '.acts .btn,' + P + '.acts .btn.ghost{display:inline-flex!important;flex:0 0 auto!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;width:auto!important;min-width:0!important;max-width:100%!important;align-self:auto!important;min-height:30px!important;height:auto!important;padding:4px 12px!important;border-radius:999px!important;text-align:center!important;white-space:nowrap!important}',
    P + '.acts .btn .bl{display:inline!important;white-space:nowrap!important;text-align:center!important;overflow:visible!important}',
    // Level 3: 선택 메뉴가 보드 중앙이 아니라 왼쪽 카드(.actbody)에 열린다
    Q + '.acts.qa-pills{display:flex!important;grid-template-columns:none!important;flex-direction:row!important;flex-wrap:wrap!important;align-items:center!important;justify-content:flex-start!important;gap:6px!important}',
    Q + '.acts.qa-pills .btn,' + Q + '.acts.qa-pills .btn.ghost{display:inline-flex!important;flex:0 0 auto!important;align-items:center!important;justify-content:center!important;width:auto!important;min-width:0!important;max-width:100%!important;min-height:30px!important;height:auto!important;padding:4px 12px!important;border-radius:999px!important;white-space:nowrap!important;text-align:center!important}'
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
  }
  function markCard() {
    var list = document.querySelectorAll('.actbody .acts');
    for (var j = 0; j < list.length; j++) {
      var bs = list[j].querySelectorAll('.btn'), ok = bs.length >= 4;
      for (var i = 0; ok && i < bs.length; i++) if (bs[i].querySelector('small') || bs[i].textContent.trim().length > 16) ok = false;
      list[j].classList.toggle('qa-pills', ok);
    }
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
