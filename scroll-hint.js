/* 세로 화면에서 보드 중앙 내용이 길 때 아래로 더 있음을 알리는 반투명 화살표 표시.
   중앙 패널은 안쪽 스크롤이지만 스크롤바가 숨겨져 있어, 아래쪽 표·정세 줄이 잘린 것처럼 보이던 문제 보완. */
(function () {
  'use strict';
  if (window.__scrollHint) return;
  window.__scrollHint = 1;
  var chip = null, raf = 0;
  function mk() {
    var st = document.createElement('style');
    st.textContent = '@keyframes shBob{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,4px)}}' +
      '.sh-arrow{position:fixed;z-index:40;display:none;width:26px;height:26px;padding:0;margin:0;border:0;border-radius:50%;' +
      'background:transparent;color:#6d4fd6;opacity:.42;cursor:pointer;-webkit-tap-highlight-color:transparent;' +
      'animation:shBob 1.6s ease-in-out infinite;transition:opacity .2s}' +
      '.sh-arrow:hover,.sh-arrow:active{opacity:.85}' +
      '.sh-arrow svg{display:block;width:26px;height:26px;filter:drop-shadow(0 0 2px rgba(255,255,255,.9))}' +
      '@media (prefers-reduced-motion:reduce){.sh-arrow{animation:none;transform:translateX(-50%)}}';
    document.head.appendChild(st);
    chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'sh-arrow';
    chip.setAttribute('aria-label', '아래로 더 보기');
    chip.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8l6 6 6-6"/><path d="M6 13l6 6 6-6" opacity=".5"/></svg>';
    chip.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var c = document.querySelector('#board .center');
      if (c) c.scrollBy({ top: Math.max(120, c.clientHeight * 0.7), behavior: 'smooth' });
    });
    document.body.appendChild(chip);
  }
  function update() {
    raf = 0;
    if (!document.body) return;          /* Firefox는 큰 페이지를 읽는 도중에도 화면 갱신을 실행 — body가 생기기 전이면 다음 차례에 */
    if (!chip) mk();
    var c = document.querySelector('#board .center'), show = false;
    if (c) {
      var oy = getComputedStyle(c).overflowY, left = c.scrollHeight - c.scrollTop - c.clientHeight;
      var modal = document.querySelector('#modal:not([hidden]), .modal.open');
      if ((oy === 'auto' || oy === 'scroll') && left > 14 && c.clientHeight > 80 && !modal) {
        var r = c.getBoundingClientRect(), t = c.querySelector('.ticker'), tr = t ? t.getBoundingClientRect() : null;
        var bottom = tr && tr.height > 0 && tr.top > r.top ? tr.top : r.bottom;
        chip.style.left = Math.round(r.right - 22) + 'px';
        chip.style.top = Math.round(bottom - 30) + 'px';
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
