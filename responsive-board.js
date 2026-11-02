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


  /* ───── 줄(상·하 / 좌·우 / 모서리)마다 글자 크기를 하나로 맞춤 ─────
     - 3글자·4글자 이름이 칸마다 다른 크기로 보이던 문제 해결: 한 줄에 놓인 칸은 모두 같은 글자 크기
     - 3글자 이하는 반드시 한 줄, 4글자 이상은 필요하면 두 줄(2+2)로 나눠 글자를 키움
     - 세로(포트레이트)에서 좌·우 칸 글자가 작아지던 문제: 칸 높이 기준 대신 실제 들어가는 최대 크기를 찾음
     - 가로형/세로형 배치는 줄 전체가 함께 결정 → 경계(1px 차이)에서 칸마다 뒤집히지 않음 */
  const EN = () => document.documentElement.lang === 'en';
  const FMAX = {tb: 18, lr: 18, c: 21};
  const FMIN = 7;
  let gcache = new Map();
  function groupKey(cell) {
    const c = cell.classList;
    if (c.contains('corner')) return 'c';
    if (c.contains('side-t') || c.contains('side-b')) return 'tb';
    if (c.contains('side-l') || c.contains('side-r')) return 'lr';
    return null;
  }
  const plainLen = (name) => name.textContent.replace(/\s+/g, '').length;
  const oneLineLen = () => (EN() ? 7 : 3);      // 이 길이 이하 이름은 반드시 한 줄
  const iconFor = (f) => clamp(f * 1.0, 10, 20);   // 크기 계산용 최소 아이콘. 남는 높이는 뒤에서 아이콘에 돌려줌
  function boxOf(cell) {
    const cs = getComputedStyle(cell);
    const w = cell.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    const h = cell.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
    const scale = cell.getBoundingClientRect().width / (cell.clientWidth || 1) || 1;
    return {w: Math.max(4, w - 1), h: Math.max(4, h - 1), scale};
  }
  function put(cell, f, row, icon) {
    cell.toggleAttribute('data-fit-row', row);
    cell.style.setProperty('--fit-name', f.toFixed(2) + 'px');
    cell.style.setProperty('--fit-icon', (icon == null ? iconFor(f) : icon).toFixed(2) + 'px');
  }
  /* 지금 적용된 크기에서 이 칸이 칸 안에 들어가는가 */
  function fitsNow(cell, f, row, strict) {
    const name = cell.querySelector('.nm'), icon = cell.querySelector('.ic');
    if (!name) return true;
    const b = boxOf(cell);
    const nr = name.getBoundingClientRect();
    const nw = nr.width / b.scale, nh = nr.height / b.scale;
    const ir = icon ? icon.getBoundingClientRect() : null;
    const iw = ir ? ir.width / b.scale : 0, ih = ir ? ir.height / b.scale : 0;
    const pr = cell.querySelector(':scope > .pr');
    const ph = pr && pr.offsetParent !== null ? pr.getBoundingClientRect().height / b.scale : 0;
    const lines = Math.max(1, Math.round(nh / (f * 1.2)));
    if (strict && lines > 1) return false;       // 짧은 이름은 한 줄
    if (lines > 2) return false;                 // 길어도 두 줄까지
    if (name.scrollWidth > name.clientWidth + 1) return false;
    return row ? (nw + iw + 3 <= b.w && Math.max(nh, ih) + ph <= b.h)
               : (nw <= b.w && nh + ih + ph + 2 <= b.h);
  }
  function groupFits(cells, f, row) {
    const lim = oneLineLen();
    cells.forEach((c) => put(c, f, row));
    for (const c of cells) {
      const name = c.querySelector('.nm');
      if (!name) continue;
      if (!fitsNow(c, f, row, plainLen(name) <= lim)) return false;
    }
    return true;
  }
  function bestSize(cells, row, fmax) {
    let lo = FMIN, hi = fmax, best = 0;
    if (!groupFits(cells, lo, row)) return 0;
    best = lo;
    while (hi - lo > .5) {
      const mid = Math.round((lo + hi) / 2 * 2) / 2;
      if (mid === lo) break;
      if (groupFits(cells, mid, row)) { best = lo = mid; } else { hi = mid; }
    }
    if (groupFits(cells, hi, row)) best = Math.max(best, hi);
    return best;
  }
  function fitGroup(key, cells) {
    const sig = key + '|' + root.classList.contains('land') + '|' + EN() + '|' +
      cells.map((c) => c.clientWidth + 'x' + c.clientHeight + ':' + (c.querySelector('.nm') || {textContent: ''}).textContent).join(',');
    const hit = gcache.get(sig);
    if (hit) {
      cells.forEach((c, i) => put(c, hit.f, hit.row, hit.icons[i]));
      return;
    }
    const fmax = FMAX[key] || 18;
    const fc = bestSize(cells, false, fmax), fr = bestSize(cells, true, fmax);
    const row = fr > fc + 1.5;                    // 세로 쌓기(위 아이콘·아래 글자)를 기본으로
    const f = Math.max(FMIN - 1, row ? fr : fc) || FMIN - 1;
    cells.forEach((c) => put(c, f, row));
    /* 그래도 넘치는 칸(아주 긴 이름)만 그 칸의 글자를 조금씩 줄임 */
    const icons = [];
    cells.forEach((c) => {
      let ff = f;
      for (let i = 0; i < 12 && !fitsNow(c, ff, row, false); i++) { ff = Math.max(6, ff - .5); put(c, ff, row); }
      /* 이름이 쓰고 남은 높이만큼 아이콘을 키움 */
      const name = c.querySelector('.nm'), b = boxOf(c);
      let ic = iconFor(ff);
      if (name && !row) {
        const nh = name.getBoundingClientRect().height / b.scale;
        const pe = c.querySelector(':scope > .pr');
        const ph = pe && pe.offsetParent !== null ? pe.getBoundingClientRect().height / b.scale : 0;
        ic = clamp(Math.min(b.h - nh - ph - 2, b.w, 30), ff, 30);
      } else if (name) {
        ic = clamp(Math.min(b.h, 30), ff, 30);
      }
      put(c, ff, row, ic);
      if (!fitsNow(c, ff, row, false)) put(c, ff, row, iconFor(ff));
      icons.push(parseFloat(c.style.getPropertyValue('--fit-icon')));
    });
    if (gcache.size > 400) gcache.clear();
    gcache.set(sig, {f, row, icons});
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
    const groups = {};
    const loose = [];
    board.querySelectorAll(':scope > .cell').forEach((cell) => {
      const k = cell.querySelector('.nm') ? groupKey(cell) : null;
      if (k) (groups[k] = groups[k] || []).push(cell); else if (cell.querySelector('.nm')) loose.push(cell);
    });
    Object.keys(groups).forEach((k) => fitGroup(k, groups[k]));
    loose.forEach(fitCell);
    const boardWidth = board.offsetWidth + 'px';
    if (root.style.getPropertyValue('--bw') !== boardWidth) root.style.setProperty('--bw', boardWidth);
    root.dataset.fitViewport = innerWidth + 'x' + innerHeight;
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(fit); }
  function invalidate() { root.removeAttribute('data-fit-viewport'); gcache = new Map(); schedule(); }
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
  if (document.fonts) document.fonts.ready.then(() => {cache = new Map(); gcache = new Map(); schedule();});
  schedule();
})();
