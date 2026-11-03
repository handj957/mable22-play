/* 세로 화면에서 보드 중앙 내용이 길 때 "아래에 더 있음" 표시.
   중앙 패널은 안쪽 스크롤이지만 스크롤바가 숨겨져 있어, 아래쪽 표·정세 줄이 잘린 것처럼 보이던 문제 보완. */
(function () {
  'use strict';
  if (window.__scrollHint) return;
  window.__scrollHint = 1;
  var chip = null, raf = 0;
  function mk() {
    chip = document.createElement('button');
    chip.type = 'button';
    chip.setAttribute('aria-label', '아래로 더 보기');
    chip.textContent = '▼ 아래에 더 있음';
    chip.style.cssText = 'position:fixed;z-index:40;display:none;transform:translateX(-50%);border:1px solid rgba(202,168,90,.9);border-radius:999px;padding:4px 12px;font:700 11.5px/1.2 system-ui,sans-serif;color:#fff6dc;background:rgba(12,17,32,.88);box-shadow:0 3px 10px rgba(0,0,0,.4);cursor:pointer;-webkit-tap-highlight-color:transparent';
    chip.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var c = document.querySelector('#board .center');
      if (c) c.scrollBy({ top: Math.max(120, c.clientHeight * 0.7), behavior: 'smooth' });
    });
    document.body.appendChild(chip);
  }
  function update() {
    raf = 0;
    if (!chip) mk();
    var c = document.querySelector('#board .center'), show = false;
    if (c) {
      var oy = getComputedStyle(c).overflowY, left = c.scrollHeight - c.scrollTop - c.clientHeight;
      var modal = document.querySelector('#modal:not([hidden]), .modal.open');
      if ((oy === 'auto' || oy === 'scroll') && left > 14 && c.clientHeight > 80 && !modal) {
        var r = c.getBoundingClientRect(), t = c.querySelector('.ticker'), tr = t ? t.getBoundingClientRect() : null;
        var bottom = tr && tr.height > 0 && tr.top > r.top ? tr.top : r.bottom;
        chip.style.left = Math.round(r.left + r.width / 2) + 'px';
        chip.style.top = Math.round(bottom - 32) + 'px';
        show = true;
      }
    }
    chip.style.display = show ? 'block' : 'none';
  }
  function req() { if (!raf) raf = requestAnimationFrame(update); }
  document.addEventListener('scroll', req, true);
  window.addEventListener('resize', req);
  setInterval(req, 500);
  req();
})();
