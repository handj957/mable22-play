/* 22세기 브르마블 · 도입부 공통 스킨 — 페이지 이름으로 레벨을 알아내 장면 배너를 끼워 넣습니다. 로직은 건드리지 않습니다. */
(function () {
  'use strict';
  var file = (location.pathname.split('/').pop() || '').replace('.html', '');
  var m = file.match(/level([1345])$/); if (!m) return;
  var lv = 'l' + m[1], beg = /^beginning/.test(file);
  var base = (document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/[^/]*$/, '') : './';
  var root = document.documentElement;
  root.classList.add('skin-' + lv);
  root.style.setProperty('--sk-scene', 'url("' + base + 'bg/skin-' + lv + '.svg")');
  root.style.setProperty('--sk-back', 'url("' + base + 'bg/skin-' + lv + '-back.svg")');
  var CFG = {
    l1: { chips: ['💰 재무관리', '🏢 기업가정신', '🏙 부자 되기'], stats: function () { var t = (document.body.textContent.match(/현금\s*₵\s*([\d,]+)/) || [])[1]; return [{ n: t ? '₵' + t : '₵', t: '시작 현금' }, { n: '3', t: '승리 방법' }, { n: '🏙', t: '부자 경영' }]; } },
    l3: { chips: ['🌐 동맹·전쟁·제재', '🏛 국가경영', '📈 순자산 대결'], stats: function () { return [{ n: '4', t: '경쟁 국가' }, { n: '3', t: '플레이 방식' }, { n: '🏆', t: '순자산 1위' }]; } },
    l4: { chips: ['🚀 우주 패권', '💰👑🎭🛰 승리 4종', '🌌 글로벌 전략'], stats: function () { return [{ n: '4', t: '승리 조건' }, { n: '4', t: '경쟁 지도자' }, { n: '3', t: '플레이 방식' }]; } },
    l5: { chips: ['🗺 11×19 전장', '🎯 주사위 = 사거리', '💰 골드 + AP'], stats: function () { return [{ n: '11×19', t: '전장' }, { n: '4', t: '사령관' }, { n: '2', t: '재화 · 골드/AP' }]; } }
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function banner(eyebrow, title, tag) {
    var c = CFG[lv], st = c.stats(), d = document.createElement('div');
    d.className = 'skin-banner'; d.setAttribute('data-skin', lv);
    d.innerHTML = '<div class="skin-in">' + (eyebrow ? '<div class="skin-eyebrow">' + esc(eyebrow) + '</div>' : '') + '<div class="skin-title" role="heading" aria-level="1">' + esc(title) + '</div>' +
      (tag ? '<p class="skin-tag">' + esc(tag) + '</p>' : '') + '<div class="skin-chips">' + c.chips.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</div></div>' +
      '<div class="skin-stats" style="--n:' + st.length + '">' + st.map(function (s) { return '<div><b>' + esc(s.n) + '</b><span>' + esc(s.t) + '</span></div>'; }).join('') + '</div>';
    return d;
  }
  function inject() {
    try {
      if (lv === 'l1') {
        var p = document.querySelector('#stage .panel.setup');
        if (p && !p.querySelector('.skin-banner')) {
          var h2 = p.querySelector('h2'); if (!h2) return;
          var sp = h2.querySelector('span'), sub = sp ? sp.textContent.trim() : '';
          var title = h2.childNodes[0] ? h2.childNodes[0].textContent.replace(/^[^\wㄱ-힣]+/, '').trim() : h2.textContent.trim();
          var b = banner('22세기 브르마블 · ' + (beg ? 'Beginning' : 'Level 1'), title, sub);
          h2.classList.add('skin-hide'); p.insertBefore(b, p.firstChild);
        }
      } else if (lv === 'l3' || lv === 'l4') {
        var f = document.querySelector('#setup .modal.sx');
        if (f && !f.querySelector(':scope>.skin-banner')) {
          var hd = f.querySelector('.sxhead'); if (!hd) return;
          var sm = hd.querySelector('small'), h = hd.querySelector('h2');
          var b2 = banner(sm ? sm.textContent.trim() : '', h ? h.textContent.trim() : '', '');
          hd.classList.add('skin-hide'); f.insertBefore(b2, f.firstChild);
        }
      } else if (lv === 'l5') {
        var s = document.getElementById('setup');
        if (s && !s.querySelector('.skin-card')) {
          var h1 = s.querySelector('h1'), small = h1 && h1.querySelector('small'), sb = s.querySelector('.sub');
          var title5 = h1 ? h1.childNodes[0].textContent.trim() : 'BLUEMARBLE TACTICS';
          var card = document.createElement('div'); card.className = 'skin-card';
          card.appendChild(banner(small ? small.textContent.trim() : 'LEVEL 5', title5, sb ? sb.innerHTML.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : ''));
          ['#pcfg', '#cmdinfo', '.btns'].forEach(function (q) { var e = s.querySelector(q); if (e) card.appendChild(e); });
          if (h1) h1.classList.add('skin-hide'); if (sb) sb.classList.add('skin-hide');
          s.appendChild(card);
        }
      }
    } catch (e) {}
  }
  var pend = false;
  function sched() { if (pend) return; pend = true; (window.requestAnimationFrame || setTimeout)(function () { pend = false; inject(); }); }
  function start() { inject(); try { new MutationObserver(sched).observe(document.body, { childList: true, subtree: true }); } catch (e) {} }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
