(function () {
  'use strict';
  const root = document.documentElement;
  const board = document.getElementById('board');
  if (!board) return;
  root.setAttribute('data-board-fit', '1');
  let frame = 0;
  let cache = new Map();
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function fitCell(cell) {
    const name = cell.querySelector('.nm');
    const icon = cell.querySelector('.ic');
    if (!name) return;
    const w = cell.clientWidth, h = cell.clientHeight;
    if (w < 4 || h < 4) return;
    const signature = [w, h, name.textContent, root.classList.contains('land')].join('|');
    const saved = cache.get(signature);
    if (saved) {
      cell.toggleAttribute('data-fit-row', saved.row);
      cell.style.setProperty('--fit-icon', saved.icon + 'px');
      cell.style.setProperty('--fit-name', saved.font + 'px');
      return;
    }
    cell.toggleAttribute('data-fit-row', w > 64 && w > h * 2.2);
    const row = cell.hasAttribute('data-fit-row');
    const availableW = Math.max(4, w - 6);
    const availableH = Math.max(4, h - 8);
    let iconSize = clamp(row ? availableH * .65 : availableH * .48, 9, 30);
    let fontSize = clamp(row ? availableH * .36 : availableH * .29, 7, 17);
    cell.style.setProperty('--fit-icon', iconSize.toFixed(2) + 'px');
    const setFont = () => cell.style.setProperty('--fit-name', fontSize.toFixed(2) + 'px');
    // Reset the previous fit on every size/content change, so rotation can grow text again.
    name.style.removeProperty('font-size');
    name.style.removeProperty('letter-spacing');
    name.removeAttribute('data-fit');
    setFont();
    const overflows = () => {
      const nr = name.getBoundingClientRect(), cr = cell.getBoundingClientRect();
      const scale = cr.width / w || 1;
      const iw = icon ? icon.getBoundingClientRect().width / scale : 0;
      const ih = icon ? icon.getBoundingClientRect().height / scale : 0;
      const nw = nr.width / scale, nh = nr.height / scale;
      return name.scrollWidth > name.clientWidth + 1 ||
        (row ? nw + iw + 1 > availableW || Math.max(nh, ih) > availableH : nw > availableW || nh + ih + 1 > availableH);
    };
    for (let i = 0; i < 14 && overflows(); i++) {
      fontSize = Math.max(6, fontSize - .5);
      iconSize = Math.max(8, iconSize - .6);
      cell.style.setProperty('--fit-icon', iconSize.toFixed(2) + 'px');
      setFont();
    }
    if (cache.size > 2000) cache.clear();
    cache.set(signature, {row, icon:iconSize.toFixed(2), font:fontSize.toFixed(2)});
  }

  function fit() {
    frame = 0;
    const app = document.querySelector('.app');
    if (app) {
      const viewHeight = window.visualViewport ? visualViewport.height : innerHeight;
      const height = Math.max(100, Math.floor(viewHeight - Math.max(0, app.getBoundingClientRect().top)));
      const value = height + 'px';
      if (root.style.getPropertyValue('--frame-height') !== value) root.style.setProperty('--frame-height', value);
    }
    board.querySelectorAll(':scope > .cell').forEach(fitCell);
    const boardWidth = board.offsetWidth + 'px';
    if (root.style.getPropertyValue('--bw') !== boardWidth) root.style.setProperty('--bw', boardWidth);
    root.dataset.fitViewport = innerWidth + 'x' + innerHeight;
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(fit); }
  function invalidate() { root.removeAttribute('data-fit-viewport'); schedule(); }
  addEventListener('resize', invalidate);
  addEventListener('orientationchange', invalidate);
  if (window.visualViewport) visualViewport.addEventListener('resize', invalidate);
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(invalidate);
    observer.observe(board);
    const header = document.querySelector('.hdr');
    if (header) observer.observe(header);
  }
  new MutationObserver(invalidate).observe(board, {childList:true, subtree:true, characterData:true});
  new MutationObserver(invalidate).observe(root, {attributes:true, attributeFilter:['class']});
  if (document.fonts) document.fonts.ready.then(() => {cache = new Map(); schedule();});
  schedule();
})();
