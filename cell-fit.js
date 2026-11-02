/* Level 1·2 (및 Beginning 1·2) 보드 칸 글자·이모지 맞춤
   - 칸 이름은 먼저 한 줄로 맞추고, 너무 좁으면 띄어쓰기 자리에서만 두 줄로 나눈다(글자 중간 끊김·… 말줄임 없음).
   - 화면 회전·크기 변경·칸 다시 그리기 때마다 실제 칸 크기를 재서 다시 계산한다(PC·패드·폰 공통). */
(function () {
  'use strict';
  var board = document.getElementById('board'); // 게임이 시작·다시 그릴 때 #board 자체가 바뀔 수 있어 매번 다시 찾는다
  var MIN = 6.5;
  var cache = Object.create(null);
  var frame = 0;
  var busy = false;

  function kids(cell) {
    var nm = null, ic = null, pr = null, lv = null;
    for (var i = 0; i < cell.children.length; i++) {
      var c = cell.children[i], k = c.classList;
      if (k.contains('nm')) nm = c;
      else if (k.contains('em') || k.contains('ic')) ic = c;
      else if (k.contains('pr')) pr = c;
      else if (k.contains('lv')) lv = c;
    }
    return { nm: nm, ic: ic, pr: pr, lv: lv };
  }
  function imp(el, p, v) { el.style.setProperty(p, v, 'important'); }
  function clear(el) {
    if (!el) return;
    ['font-size', 'white-space', 'word-break', 'overflow-wrap', 'text-overflow', 'overflow',
      'max-width', 'max-height', 'line-height', 'letter-spacing', 'text-align', 'height', 'margin', 'display', 'text-wrap'].forEach(function (p) { el.style.removeProperty(p); });
  }
  var PADS = ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'];
  function padForStripe(cell) { // 색 띠(.stripe/.band)가 가린 쪽만큼 안쪽 여백을 줘서 글자가 띠 위로 겹치지 않게
    PADS.forEach(function (p) { cell.style.removeProperty(p); });
    var st = cell.querySelector(':scope > .stripe, :scope > .band');
    if (!st || getComputedStyle(st).position !== 'absolute') return;
    var r = st.getBoundingClientRect(), c = cell.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    var pad = null;
    if (r.width < c.width * .6) pad = (r.left - c.left < 2) ? 'padding-left' : 'padding-right';
    else if (r.height < c.height * .6) pad = (r.top - c.top < 2) ? 'padding-top' : 'padding-bottom';
    if (pad) imp(cell, pad, Math.ceil(pad.match(/left|right/) ? r.width : r.height) + 1 + 'px');
  }
  function used(cell, k) { // 칸 안 요소 높이 합(세로 배치)
    var s = 0;
    [k.ic, k.nm, k.pr, k.lv].forEach(function (e) { if (e && e.offsetParent !== null) s += e.getBoundingClientRect().height; });
    return s;
  }

  function fitCell(cell) {
    var k = kids(cell);
    var nm = k.nm;
    if (!nm) return;
    var w = cell.clientWidth, h = cell.clientHeight;
    if (w < 8 || h < 8) return;
    padForStripe(cell);
    var key = w + 'x' + h + '|' + nm.textContent + '|' + (k.pr ? k.pr.textContent.length : 0);
    var hit = cache[key];
    if (hit) { apply(k, hit); return; }

    clear(nm); if (k.ic) clear(k.ic); if (k.pr) clear(k.pr); if (k.lv) clear(k.lv);
    var base = parseFloat(getComputedStyle(nm).fontSize) || 10;
    var cs0 = getComputedStyle(cell);
    var availH = Math.max(4, h - (parseFloat(cs0.paddingTop) || 0) - (parseFloat(cs0.paddingBottom) || 0) - 3);
    var res = { nm: base, ic: 0, pr: 0, wrap: false };

    imp(nm, 'text-overflow', 'clip'); imp(nm, 'overflow', 'visible'); imp(nm, 'max-width', '100%');
    imp(nm, 'max-height', 'none'); imp(nm, 'height', 'auto'); imp(nm, 'line-height', '1.12');
    imp(nm, 'letter-spacing', '-.03em'); imp(nm, 'text-align', 'center'); imp(nm, 'margin', '0');
    imp(nm, 'word-break', 'keep-all'); imp(nm, 'overflow-wrap', 'normal'); imp(nm, 'text-wrap', 'balance');

    var icBase = k.ic ? (parseFloat(getComputedStyle(k.ic).fontSize) || 12) : 0;
    var prBase = k.pr ? (parseFloat(getComputedStyle(k.pr).fontSize) || 8) : 0;
    res.ic = icBase; res.pr = prBase;

    function set(fs, wrap) {
      imp(nm, 'font-size', fs.toFixed(2) + 'px');
      imp(nm, 'white-space', wrap ? 'normal' : 'nowrap');
      if (wrap) imp(nm, 'overflow-wrap', 'normal');
      if (k.ic) imp(k.ic, 'font-size', res.ic.toFixed(2) + 'px');
      if (k.pr) imp(k.pr, 'font-size', res.pr.toFixed(2) + 'px');
    }
    function fitsW() { return nm.scrollWidth <= nm.clientWidth + .5; }
    function fitsH() { return used(cell, k) <= availH; }

    // 1) 한 줄: 글자 크기만 줄여 맞춤. 띄어쓰기가 있는 이름은 8px 아래로 내려가기 전에 두 줄로 바꾼다
    var hasSpace = /\s/.test(nm.textContent.trim());
    var oneMin = hasSpace ? 8 : MIN;
    var fs = base; set(fs, false);
    var guard = 0;
    while (!fitsW() && fs > oneMin && guard++ < 40) { fs = Math.max(oneMin, fs - .5); set(fs, false); }
    if (!fitsW()) {
      // 2) 띄어쓰기 자리에서 두 줄로(원래 글자 크기부터 다시)
      fs = base; res.wrap = true; set(fs, true); guard = 0;
      while ((!fitsW() || !fitsH()) && fs > MIN && guard++ < 40) { fs = Math.max(MIN, fs - .5); set(fs, true); }
      if (!fitsW()) { // 3) 띄어쓰기가 없는 긴 이름: 마지막 수단으로 글자 단위 줄바꿈
        imp(nm, 'word-break', 'break-all'); imp(nm, 'overflow-wrap', 'anywhere');
      }
    }
    // 4) 세로가 모자라면 이모지·가격 글자를 먼저 줄이고, 그래도 안 되면 이모지를 숨김(이름·가격이 우선)
    guard = 0;
    while (!fitsH() && guard++ < 30) {
      var changed = false;
      if (k.ic && res.ic > 8) { res.ic -= .8; changed = true; }
      else if (k.pr && res.pr > 6) { res.pr -= .4; changed = true; }
      else if (fs > MIN) { fs = Math.max(MIN, fs - .4); changed = true; }
      else if (k.ic && k.ic.style.display !== 'none') { imp(k.ic, 'display', 'none'); changed = true; }
      if (!changed) break;
      set(fs, res.wrap);
    }
    res.nm = fs;
    res.hideIc = !!(k.ic && k.ic.style.display === 'none');
    res.brk = nm.style.getPropertyValue('word-break');
    cache[key] = res;
  }

  function apply(k, r) {
    var nm = k.nm;
    imp(nm, 'text-overflow', 'clip'); imp(nm, 'overflow', 'visible'); imp(nm, 'max-width', '100%');
    imp(nm, 'max-height', 'none'); imp(nm, 'height', 'auto'); imp(nm, 'line-height', '1.12');
    imp(nm, 'letter-spacing', '-.03em'); imp(nm, 'text-align', 'center'); imp(nm, 'margin', '0');
    imp(nm, 'text-wrap', 'balance'); imp(nm, 'word-break', r.brk || 'keep-all'); imp(nm, 'overflow-wrap', r.brk === 'break-all' ? 'anywhere' : 'normal');
    imp(nm, 'font-size', r.nm.toFixed(2) + 'px');
    imp(nm, 'white-space', r.wrap ? 'normal' : 'nowrap');
    if (k.ic) { imp(k.ic, 'font-size', r.ic.toFixed(2) + 'px'); if (r.hideIc) imp(k.ic, 'display', 'none'); else k.ic.style.removeProperty('display'); }
    if (k.pr) imp(k.pr, 'font-size', r.pr.toFixed(2) + 'px');
  }

  function run() {
    frame = 0;
    if (busy) return;
    busy = true;
    try {
      var nb = document.getElementById('board');
      if (!nb) { busy = false; return; }
      if (nb !== board) { board = nb; if (ro) { ro.disconnect(); ro.observe(board); } cache = Object.create(null); }
      var cells = board.querySelectorAll(':scope > .cell');
      for (var i = 0; i < cells.length; i++) fitCell(cells[i]);
    } catch (e) { if (window.console) console.error('cell-fit', e); }
    busy = false;
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(run); }
  function invalidate() { cache = Object.create(null); schedule(); }

  var ro = null;
  addEventListener('resize', invalidate);
  addEventListener('orientationchange', function () { setTimeout(invalidate, 250); });
  if (window.visualViewport) visualViewport.addEventListener('resize', invalidate);
  if (window.ResizeObserver) { ro = new ResizeObserver(invalidate); if (board) ro.observe(board); }
  // 칸을 다시 그릴 때(시작·이동·구매·건설)만 재계산. 속성 변경은 보지 않아 무한 반복이 생기지 않는다.
  new MutationObserver(function (ml) {
    var b = document.getElementById('board');
    if (!b) return;
    for (var i = 0; i < ml.length; i++) {
      var t = ml[i].target;
      if (b.contains(t) || t.contains(b)) { schedule(); return; }
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(invalidate);
  addEventListener('load', invalidate);
  schedule();
  setTimeout(invalidate, 400); setTimeout(invalidate, 1500);
})();
