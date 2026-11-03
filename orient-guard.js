/* 화면 방향(가로/세로) 판별 보호 — 아이폰 회전 직후 innerWidth/innerHeight가 이전 값으로 남아
   세로 레이아웃이 가로 화면에 끼는 문제(중앙 패널 찌그러짐) 방지.
   1) window.__landscape(): CSS 미디어쿼리(orientation) 기준 → 회전 직후에도 값이 맞음
   2) 회전·리사이즈·복귀 직후 여러 번 다시 확인하고, 크기가 바뀌었는데 resize 이벤트가 없었으면 직접 발생시킴
   3) 0.4초 감시: 이벤트가 누락돼도 크기 변화를 감지해 모든 화면 맞춤 로직을 다시 실행 */
(function () {
  'use strict';
  if (window.__orientGuard) return;
  window.__orientGuard = 1;
  var mq = null;
  try { mq = window.matchMedia('(orientation: landscape)'); } catch (e) {}
  window.__landscape = function () {
    try { if (mq) return !!mq.matches; } catch (e) {}
    try { return innerWidth > innerHeight; } catch (e) { return false; }
  };
  function sig() {
    var v = window.visualViewport, d = document.documentElement;
    try {
      return [innerWidth, innerHeight, d.clientWidth, d.clientHeight,
        v ? Math.round(v.width) : 0, v ? Math.round(v.height) : 0, window.__landscape() ? 1 : 0].join('|');
    } catch (e) { return ''; }
  }
  var handled = sig(), firing = false, timers = [];
  function fire() {
    firing = true;
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    firing = false;
  }
  function check() {
    var s = sig();
    if (s !== handled) { handled = s; fire(); }
  }
  function burst() {
    if (firing) return;
    timers.forEach(clearTimeout); timers = [];
    [60, 180, 400, 800, 1500].forEach(function (ms) { timers.push(setTimeout(check, ms)); });
  }
  ['resize', 'orientationchange', 'pageshow', 'focus'].forEach(function (n) { window.addEventListener(n, burst); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) burst(); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', burst);
  if (mq && mq.addEventListener) mq.addEventListener('change', burst);
  try { if (screen.orientation) screen.orientation.addEventListener('change', burst); } catch (e) {}
  setInterval(check, 400);
})();
