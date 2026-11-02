/* 22세기 브르마블 · KO/EN 표시 번역기
   - 게임 로직(한글 키·조건문)은 그대로 두고, 화면(DOM)에 보이는 글자만 영어로 바꿉니다.
   - 언어 선택: ?lang=en · ?lang=ko, 또는 시작 화면의 🌐 버튼. 선택은 localStorage('m22lang')에 저장됩니다.
   - 번역 사전은 레벨별 파일(i18n/levelN.en.js)에 있고, 이 파일이 <script data-dict="..."> 로 불러옵니다. */
(function () {
  'use strict';
  var KEY = 'm22lang';
  var lang = 'ko';
  try {
    var q = new URLSearchParams(location.search).get('lang');
    if (q === 'en' || q === 'ko') localStorage.setItem(KEY, q);
    lang = localStorage.getItem(KEY) || 'ko';
  } catch (e) {}
  if (lang !== 'en' && lang !== 'ko') lang = 'ko';

  var API = window.M22I18N = window.M22I18N || { dicts: [] };
  API.lang = lang;
  API.missing = {};
  API.setLang = function (l) {
    try { localStorage.setItem(KEY, l); } catch (e) {}
    try { var u = new URL(location.href); u.searchParams.delete('lang'); location.replace(u.toString()); } catch (e) { location.reload(); }
  };

  document.documentElement.setAttribute('lang', lang);
  var me = document.currentScript;
  var dictUrl = me && me.getAttribute('data-dict');
  if (lang === 'en' && dictUrl) dictUrl.split(',').forEach(function (u) { document.write('<script src="' + u.trim() + '"><\/script>'); });
  if (lang !== 'en') {   // 한국어 모드: 번역 없이 전환 버튼만 (시작 화면이 다시 그려질 때마다 넣음)
    new MutationObserver(installSwitch).observe(document.documentElement, { childList: true, subtree: true });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installSwitch); else installSwitch();
    return;
  }


  /* 영어는 한글보다 글자 폭이 넓어서, 영어일 때만 칩·타일·설명 줄이 프레임을 넘지 않게 보정 (PC·패드·폰 공통) */
  (function () {
    var st = document.createElement('style');
    st.id = 'm22-en-fit';
    st.textContent =
      'html[lang="en"] .sub{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;line-height:1.3}' +
      'html[lang="en"] .cbar{flex-wrap:wrap!important;row-gap:2px}' +
      'html[lang="en"] .cbar .chip{font-size:.74em;padding:1px 5px;letter-spacing:-.01em}' +
      'html[lang="en"] .who span b{font-size:.88em;letter-spacing:-.02em}' +
      '@media (max-width:420px){html[lang="en"] .who span b{font-size:.8em;letter-spacing:-.04em}}' +
      'html[lang="en"] .tile small,html[lang="en"] .tile i{font-size:8px;letter-spacing:-.02em}' +
      'html[lang="en"] .tile b{letter-spacing:-.02em}' +
      'html[lang="en"] .btn{letter-spacing:-.01em}';
    (document.head || document.documentElement).appendChild(st);
  })();

  var HAN = /[가-힣]/;
  var exact = null, tpl = null, segRe = null, segMap = null, forceRe = null, forceMap = null, cache = Object.create(null);

  function init() {
    exact = new Map(); tpl = []; var segKeys = [];
    segMap = new Map();
    for (var o = 0; o < API.dicts.length; o++) {   // over: 다른 사전보다 먼저 적용되는 짧은 표기(좁은 칸 전용)
      var OV = API.dicts[o].over || [];
      for (var oi = 0; oi < OV.length; oi++) exact.set(OV[oi][0], OV[oi][1]);
    }
    for (var d = 0; d < API.dicts.length; d++) {
      var D = API.dicts[d];
      for (var i = 0; i < D.exact.length; i++) {
        var k = D.exact[i][0], v = D.exact[i][1];
        if (!exact.has(k)) exact.set(k, v);
        if ((k.match(/[가-힣]/g) || []).length >= 2 && !segMap.has(k)) { segMap.set(k, v); segKeys.push(k); }
      }
      for (var j = 0; j < D.tmpl.length; j++) {
        tpl.push([D.tmpl[j][0], D.tmpl[j][1]]);
      }
    }
    segKeys.sort(function (a, b) { return b.length - a.length; });
    forceMap = new Map(); var fk = [];
    for (var f = 0; f < API.dicts.length; f++) {
      var P = API.dicts[f].force || [];
      for (var g = 0; g < P.length; g++) { if (!forceMap.has(P[g][0])) { forceMap.set(P[g][0], P[g][1]); fk.push(P[g][0]); } }
    }
    if (fk.length) forceRe = new RegExp('(^|[^가-힣])(' + fk.map(function (x) { return x.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }).join('|') + ')(?=$|[^가-힣]|[의은는이가을를과와도에])', 'g');
    if (segKeys.length) {
      segRe = new RegExp(segKeys.map(function (s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }).join('|'), 'g');
    }
  }

  function tr(s, depth) {
    if (!s || !HAN.test(s)) return s;
    var c = cache[s];
    if (c !== undefined) return c;
    if (exact === null) init();
    var r = core(s, depth || 0);
    if (HAN.test(r)) API.missing[s] = 1;
    if (Object.keys(cache).length > 20000) cache = Object.create(null);
    cache[s] = r;
    return r;
  }

  /* 정규식 대신 '고정 글자 조각 → 사이 값' 순서 탐색 (역추적이 없어 긴 문장에서도 안전).
     같은 조각이 여러 곳에 있으면(예: "{1} {2}" 사이의 띄어쓰기) 후보 위치를 몇 개 시험해, 캡처가 모두 번역되는 쪽을 고릅니다. */
  var BUDGET = 0;
  function matchTpl(parts, s, d) {
    var n = parts.length, p0 = parts[0], last = parts[n - 1];
    if (s.length < p0.length + last.length || s.lastIndexOf(p0, 0) !== 0) return null;
    var end = s.length - last.length;
    if (s.substring(end) !== last) return null;
    var first = null;
    function rec(i, pos, caps) {
      if (BUDGET-- <= 0) return null;
      if (i === n - 1) {
        if (pos > end) return null;
        var all = caps.concat([s.substring(pos, end)]);
        if (!first) first = all;
        for (var k = 0; k < all.length; k++) if (HAN.test(tr(all[k], d + 1))) return null;
        return all;
      }
      var lit = parts[i], from = pos, tries = 0;
      while (tries++ < 6) {
        var idx = lit === '' ? from : s.indexOf(lit, from);
        if (idx < 0 || idx + lit.length > end) return null;
        var r = rec(i + 1, idx + lit.length, caps.concat([s.substring(pos, idx)]));
        if (r) return r;
        if (lit === '') return null;
        from = idx + 1;
      }
      return null;
    }
    BUDGET = 400;
    var found = rec(1, p0.length, []);
    return found || first;
  }

  var CHUNK = /( · | — | \| | → | \/ |; |, |\n)/;
  var TAILNUM = /^([\s\S]*?\S)(\s+[+\-−±]?\d[\d.,]*(?:%p?|%)?)$/;
  function core(s, d) {
    if (d > 6) return s;
    var v = exact.get(s);
    if (v !== undefined) return v;
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), c = m[2];
    if (c !== s) { v = exact.get(c); if (v !== undefined) return m[1] + v + m[3]; }
    var cands = [];
    if (s.length <= 1500) {
      for (var i = 0; i < tpl.length; i++) {
        var mm = matchTpl(tpl[i][0], s, d), pre = '', post = '';
        if (!mm && c !== s) { mm = matchTpl(tpl[i][0], c, d); pre = m[1]; post = m[3]; }
        if (mm) {
          var out = pre + tpl[i][1].replace(/\{(\d+)\}/g, function (_, n) { return tr(mm[+n - 1] || '', d + 1); }) + post;
          if (!HAN.test(out)) return out;
          cands.push(out); continue;
        }
      }
      // 끝에 붙은 숫자(예: '공공시설 1곳 −1')는 떼어 두고 앞부분만 번역
      var tn = TAILNUM.exec(c);
      if (tn && HAN.test(tn[1]) && tn[1] !== c) {
        var o1 = m[1] + core(tn[1], d + 1) + tn[2] + m[3];
        if (o1 !== s) { if (!HAN.test(o1)) return o1; cands.push(o1); }
      }
      // 끝에 붙은 화살표·구분기호(예: '제재 결의 통과 →')는 떼어 두고 앞부분만 번역
      var ta = /^([\s\S]*?\S)(\s*[→·—]+)$/.exec(c);
      if (ta && HAN.test(ta[1]) && ta[1] !== c) {
        var o3 = m[1] + core(ta[1], d + 1) + ta[2] + m[3];
        if (o3 !== s) { if (!HAN.test(o3)) return o3; cands.push(o3); }
      }
      // '·', '—', '→' 등으로 이어 붙인 문장(join 결과)은 조각별로 번역
      var parts = s.split(CHUNK);
      if (parts.length > 1) {
        var o2 = '';
        for (var k = 0; k < parts.length; k++) o2 += (k % 2) ? parts[k] : (parts[k] ? core(parts[k], d + 1) : '');
        if (o2 !== s) { if (!HAN.test(o2)) return o2; cands.push(o2); }
      }
    }
    if (segRe) {
      segRe.lastIndex = 0;
      var r = s.replace(segRe, function (k) { return segMap.get(k); });
      if (forceRe) r = r.replace(forceRe, function (_, a, k) { return a + forceMap.get(k); });
      if (r !== s) cands.push(r);
    } else if (forceRe) {
      var r2 = s.replace(forceRe, function (_, a, k) { return a + forceMap.get(k); });
      if (r2 !== s) cands.push(r2);
    }
    if (!cands.length) return s.charCodeAt(s.length - 1) === 8230 ? truncFix(s, s) : s;
    var best = cands[0], bh = (best.match(/[가-힣]/g) || []).length;
    for (var q = 1; q < cands.length; q++) { var h = (cands[q].match(/[가-힣]/g) || []).length; if (h < bh) { best = cands[q]; bh = h; } }
    if (bh && s.charCodeAt(s.length - 1) === 8230) best = truncFix(s, best);
    return best;
  }

  /* 게임이 한글 문장을 '…'로 잘라 보여 주는 경우(예: 앞 14자만) — 잘린 한글은 사전에 없으므로
     ① 사전의 긴 문장 앞부분과 같으면 그 영어를 같은 비율로 잘라 쓰고, ② 아니면 번역 안 된 한글 직전까지만 남기고 '…'을 붙인다 */
  function truncFix(s, r) {
    if (!HAN.test(r)) return r;
    var stem = s.slice(0, -1).replace(/\s+$/, ''), bestK = null;
    exact.forEach(function (en, k) { if (k.length > stem.length + 1 && k.lastIndexOf(stem, 0) === 0 && (bestK === null || k.length < bestK.length)) bestK = k; });
    if (bestK !== null) {
      var en = exact.get(bestK), n = Math.max(8, Math.round(en.length * stem.length / bestK.length)), c = en.slice(0, n);
      if (n < en.length) { var sp = c.lastIndexOf(' '); if (sp > n * 0.5) c = c.slice(0, sp); }
      return c.replace(/[\s·,—\-:;(]+$/, '') + '…';
    }
    var i = r.search(HAN), head = r.slice(0, i).replace(/[\s·,(\[「—→\-:;]+$/, '');
    return head.length >= 3 ? head + '…' : r;
  }

  API.t = function (s) { return lang === 'en' ? tr(String(s)) : s; };

  var ATTRS = ['title', 'aria-label', 'placeholder', 'alt', 'value'];
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1 };

  function doAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (a === 'value' && !(el.tagName === 'INPUT' && /^(text|button|submit)$/.test(el.type || 'text') || el.tagName === 'OPTION')) continue;
      var v = el.getAttribute && el.getAttribute(a);
      if (v && HAN.test(v)) {
        var t = tr(v);
        if (t !== v) { el.setAttribute(a, t); if (a === 'value' && el.tagName === 'INPUT' && el.type === 'text' && el.value === v) el.value = t; }
      }
    }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { if (!(root.parentNode && SKIP[root.parentNode.tagName])) fixText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (SKIP[root.tagName]) return; doAttrs(root); }
    var w = document.createTreeWalker(root, 5, null), n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) {
        var p = n.parentNode; if (p && SKIP[p.tagName]) continue;
        fixText(n);
      } else if (!SKIP[n.tagName]) doAttrs(n);
    }
  }
  function fixText(n) {
    var s = n.data;
    if (!HAN.test(s)) return;
    var pp = n.parentNode;
    if (pp && pp.closest && pp.closest('[translate="no"]')) return;
    var t = tr(s);
    if (t !== s) n.data = t;
  }

  var mo = new MutationObserver(function (recs) {
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i];
      if (r.type === 'childList') { for (var j = 0; j < r.addedNodes.length; j++) walk(r.addedNodes[j]); }
      else if (r.type === 'characterData') { if (!(r.target.parentNode && SKIP[r.target.parentNode.tagName])) fixText(r.target); }
      else if (r.type === 'attributes') doAttrs(r.target);
    }
    installSwitch();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });

  function start() { walk(document.documentElement); installSwitch(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  ['alert', 'confirm', 'prompt'].forEach(function (fn) {
    var o = window[fn]; if (!o) return;
    window[fn] = function (m) { arguments[0] = tr(String(m)); return o.apply(this, arguments); };
  });

  /* ---- 🌐 언어 전환 (시작 화면 설정 양식 맨 위에 한 줄로 넣음 — 게임 중 화면에는 넣지 않아 레이아웃을 건드리지 않음) ---- */
  function installSwitch() {
    var f = document.getElementById('setupForm');
    if (!f) {
      var su = document.querySelector('#setup .su');
      if (!su) {   // 레벨 선택·Beginning 선택 같은 정적 안내 화면: .wrap 맨 위에 전환 버튼
        var wr = document.querySelector('.wrap');
        if (!wr || document.getElementById('setup') || document.getElementById('langField')) return;
        var bar = document.createElement('div');
        bar.id = 'langField'; bar.setAttribute('translate', 'no');
        bar.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;margin:0 0 10px';
        var mk = function (l, t) { return '<button type="button" data-l="' + l + '" aria-pressed="' + (lang === l) + '" style="min-height:36px;padding:0 14px;border-radius:18px;border:1px solid #b9c4d6;font-size:13px;font-weight:700;cursor:pointer;background:' + (lang === l ? '#3b6cf6;color:#fff' : '#fff;color:#1d2433') + '">' + t + '</button>'; };
        bar.innerHTML = '<span style="align-self:center;font-size:12px;color:#5b6577">🌐</span>' + mk('ko', '한국어') + mk('en', 'English');
        bar.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('button[data-l]'); if (b && b.getAttribute('data-l') !== lang) API.setLang(b.getAttribute('data-l')); });
        wr.insertBefore(bar, wr.firstChild);
        return;
      }
      if (su.querySelector('#langField')) return;
      var foot = su.querySelector('.foot') || su.querySelector('.cta');
      if (!foot) return;
      var sec = document.createElement('section');
      sec.id = 'langField'; sec.setAttribute('translate', 'no');
      sec.innerHTML = '<div class="sh"><h2>🌐 Language / 언어</h2></div>' +
        '<div class="seg"><button type="button" data-l="ko" class="' + (lang === 'ko' ? 'on' : '') + '">한국어</button>' +
        '<button type="button" data-l="en" class="' + (lang === 'en' ? 'on' : '') + '">English</button></div>';
      sec.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('button[data-l]'); if (b && b.getAttribute('data-l') !== lang) API.setLang(b.getAttribute('data-l')); });
      su.insertBefore(sec, foot);
      return;
    }
    if (f.querySelector('#langField')) return;
    var d = document.createElement('div');
    d.className = 'field'; d.id = 'langField';
    d.innerHTML = '<label>🌐 Language / 언어</label><div class="opts">' +
      '<label><input type="radio" name="m22lang" value="ko"' + (lang === 'ko' ? ' checked' : '') + '><span>한국어</span></label>' +
      '<label><input type="radio" name="m22lang" value="en"' + (lang === 'en' ? ' checked' : '') + '><span>English</span></label></div>';
    d.addEventListener('change', function (e) { if (e.target && e.target.name === 'm22lang') API.setLang(e.target.value); });
    f.insertBefore(d, f.firstChild);
  }
})();
