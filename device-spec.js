/* 기기 점검 · 최소사양 안내 (모든 레벨 시작 화면 공용)
   - 현재 기기(PC/태블릿/폰), OS, 브라우저·버전, 화면 크기, 필요한 기능 지원 여부를 판정해 ✅/⚠️/❌ 표시
   - "최소사양·화면 크기 기준" 표를 펼쳐 볼 수 있음
   - 넣는 위치: .dspec-slot(있으면) → .panel.setup(Level 1) → #setupForm(Level 3·4) → #setup(Level 2·5)
   - 화면 크기·보드 계산에는 관여하지 않음(표시만) */
(function () {
  'use strict';
  if (window.DeviceSpec) return;

  var MIN = { ios: 16.2, chrome: 111, edge: 111, firefox: 126, samsung: 22, safari: 16.2 };

  function num(s) { var v = parseFloat(String(s || '').replace('_', '.')); return isNaN(v) ? 0 : v; }
  function sup(p, v) { try { return CSS.supports(p, v); } catch (e) { return false; } }
  function supSel(s) { try { return CSS.supports('selector(' + s + ')'); } catch (e) { return false; } }

  function detect() {
    var ua = navigator.userAgent || '', tp = navigator.maxTouchPoints || 0;
    var w = Math.round(window.innerWidth), h = Math.round(window.innerHeight);
    var sh = Math.min(w, h), lg = Math.max(w, h);
    var coarse = false;
    try { coarse = matchMedia('(pointer:coarse)').matches; } catch (e) {}
    var touch = tp > 0 || coarse;

    var os = '기타', osv = 0, m;
    var ipadDesk = /Macintosh/.test(ua) && tp > 0;
    if ((m = ua.match(/(iPhone|iPod).*? OS (\d+[_.]\d+)/))) { os = 'iOS'; osv = num(m[2]); }
    else if ((m = ua.match(/iPad.*? OS (\d+[_.]\d+)/))) { os = 'iPadOS'; osv = num(m[1]); }
    else if (ipadDesk) { os = 'iPadOS'; osv = num((ua.match(/Version\/(\d+(\.\d+)?)/) || [])[1]); }
    else if ((m = ua.match(/Android (\d+(\.\d+)?)/))) { os = 'Android'; osv = num(m[1]); }
    else if (/Windows/.test(ua)) os = 'Windows';
    else if (/Mac OS X/.test(ua)) os = 'macOS';
    else if (/CrOS/.test(ua)) os = 'ChromeOS';
    else if (/Linux/.test(ua)) os = 'Linux';
    var apple = os === 'iOS' || os === 'iPadOS';

    var br = '기타 브라우저', bkey = '', bv = 0;
    if ((m = ua.match(/SamsungBrowser\/(\d+(\.\d+)?)/))) { br = '삼성 인터넷'; bkey = 'samsung'; bv = num(m[1]); }
    else if ((m = ua.match(/Whale\/(\d+)/))) { br = '네이버 웨일'; bkey = 'chrome'; bv = num((ua.match(/Chrome\/(\d+)/) || [])[1]); }
    else if ((m = ua.match(/(Edg|EdgA|EdgiOS)\/(\d+)/))) { br = 'Edge'; bkey = 'edge'; bv = num(m[2]); }
    else if ((m = ua.match(/(Firefox|FxiOS)\/(\d+)/))) { br = 'Firefox'; bkey = 'firefox'; bv = num(m[2]); }
    else if ((m = ua.match(/CriOS\/(\d+)/))) { br = 'Chrome'; bkey = 'chrome'; bv = num(m[1]); }
    else if ((m = ua.match(/Chrome\/(\d+)/))) { br = 'Chrome'; bkey = 'chrome'; bv = num(m[1]); }
    else if ((m = ua.match(/Version\/(\d+(\.\d+)?).*Safari/))) { br = 'Safari'; bkey = 'safari'; bv = num(m[1]); }

    var kind;
    if (!touch) kind = 'PC';
    else if (sh >= 600) kind = '태블릿';
    else kind = '폰';
    var ori = w >= h ? '가로' : '세로';

    // 필요한 기능 (실제 게임 코드가 쓰는 것)
    var feats = [
      ['화면 높이(dvh)', sup('height', '100dvh')],
      ['칸 글자 맞춤(컨테이너 쿼리)', sup('container-type', 'size')],
      ['색 섞기(color-mix)', sup('color', 'color-mix(in srgb, red 50%, blue)')],
      [':has 선택자', supSel(':has(a)')],
      ['확대(zoom)', sup('zoom', '1.2')],
      ['저장(이어하기)', (function () { try { localStorage.setItem('_ds', '1'); localStorage.removeItem('_ds'); return true; } catch (e) { return false; } })()]
    ];
    var miss = feats.filter(function (f) { return !f[1]; }).map(function (f) { return f[0]; });

    // 버전 판정 (애플 기기는 모든 브라우저가 Safari 엔진 → OS 버전으로 판정)
    var old = false, needTxt = '';
    if (apple) { if (osv && osv < MIN.ios) { old = true; needTxt = os + ' ' + MIN.ios + ' 이상'; } }
    else if (bkey && bv && MIN[bkey] && bv < MIN[bkey]) { old = true; needTxt = br + ' ' + MIN[bkey] + ' 이상'; }

    // 화면 크기 판정
    var lv = 'ok', msg = '이 기기에서 잘 동작합니다.', tips = [];
    var sizeBad = false, sizeWarn = false;
    if (kind === 'PC') {
      if (w < 800 || h < 500) sizeBad = true;
      else if (w < 1024 || h < 600) sizeWarn = true;
    } else if (kind === '폰') {
      if (ori === '세로') { if (w < 320) sizeBad = true; else if (w < 360) sizeWarn = true; }
      else { if (h < 300) sizeBad = true; else if (h < 360) sizeWarn = true; }
    }

    if (sizeBad) { lv = 'bad'; msg = '화면(창)이 너무 작아 일부가 잘릴 수 있어요.'; }
    else if (old || miss.length >= 2) { lv = 'bad'; msg = '브라우저가 오래되어 화면이 어긋날 수 있어요.'; }
    else if (miss.length || sizeWarn) { lv = 'warn'; msg = sizeWarn ? '작은 화면입니다. 글자가 작게 보일 수 있어요.' : '일부 기능이 지원되지 않아 모양이 조금 다를 수 있어요.'; }

    if (old) tips.push(needTxt + '으로 업데이트하세요.');
    if (miss.length) tips.push('미지원: ' + miss.join(', '));
    if (kind === 'PC' && (sizeBad || sizeWarn)) tips.push('브라우저 창을 키우거나 전체화면(F11)으로 하세요. 권장 1280×720 이상.');
    if (kind === '폰' && ori === '세로' && (sizeBad || sizeWarn)) tips.push('가로로 돌리면 더 크게 볼 수 있어요.');
    if (os === 'iOS' && br === 'Safari') tips.push('주소창 없이 꽉 찬 화면: 공유 버튼 → "홈 화면에 추가"로 실행하세요.');
    if (apple && br !== 'Safari') tips.push('iPhone·iPad의 ' + br + '도 Safari 엔진을 씁니다. 화면이 어긋나면 Safari로 열어 보세요.');
    if (lv !== 'ok') tips.push('화면이 어긋나면 새로고침하거나 기기를 한 번 돌렸다 되돌려 보세요.');

    return { w: w, h: h, kind: kind, ori: ori, os: os, osv: osv, br: br, bv: bv, lv: lv, msg: msg, tips: tips, miss: miss };
  }

  var CSSTXT =
    '.dspec{margin:0 0 12px;border-radius:12px;border:1px solid rgba(0,0,0,.12);background:#fffdf7;color:#2b2b2b;font:13px/1.45 system-ui,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;text-align:left;overflow:hidden}' +
    '.dspec.ok{border-color:#9fd3a8}.dspec.warn{border-color:#f0c36b;background:#fffaf0}.dspec.bad{border-color:#ef9a9a;background:#fff6f6}' +
    '.dspec-now{display:flex;gap:8px;align-items:flex-start;padding:9px 12px}' +
    '.dspec-ic{font-size:18px;line-height:1.2}' +
    '.dspec-now b{font-weight:800}.dspec-now small{display:block;color:#555;font-size:12px;margin-top:1px}' +
    '.dspec-tips{margin:0;padding:0 12px 8px 38px;font-size:12px;color:#444}.dspec-tips li{margin:2px 0}' +
    '.dspec details{border-top:1px solid rgba(0,0,0,.08)}' +
    '.dspec summary{cursor:pointer;padding:8px 12px;font-weight:700;color:#3b4a6b;list-style:revert;min-height:24px}' +
    '.dspec-body{padding:0 12px 10px;overflow-x:auto}' +
    '.dspec h4{margin:10px 0 4px;font-size:12.5px;color:#333}' +
    '.dspec table{width:100%;border-collapse:collapse;font-size:12px}' +
    '.dspec th,.dspec td{border:1px solid rgba(0,0,0,.1);padding:4px 6px;vertical-align:top;text-align:left;white-space:normal}' +
    '.dspec th{background:#f3efe4;font-weight:700}' +
    '.dspec td:first-child{width:28%;font-weight:700;word-break:keep-all}' +
    '.dspec .dspec-me{background:#e8f4ff}' +
    '.dspec p.dspec-note{margin:8px 0 0;font-size:11.5px;color:#666}';

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function html() {
    var d = detect();
    var ic = { ok: '✅', warn: '⚠️', bad: '❌' }[d.lv];
    var brTxt = d.br + (d.bv ? ' ' + d.bv : '');
    var osTxt = d.os + (d.osv ? ' ' + d.osv : '');
    function me(k) { return k === d.kind ? ' class="dspec-me"' : ''; }
    var meScreen = d.kind === 'PC' ? 'pc' : d.kind === '태블릿' ? 'tab' : (d.ori === '세로' ? 'pp' : 'pl');
    function ms(k) { return k === meScreen ? ' class="dspec-me"' : ''; }
    var apple = d.os === 'iOS' || d.os === 'iPadOS';
    return '<div class="dspec ' + d.lv + '" role="note" data-dspec="1">' +
      '<div class="dspec-now"><span class="dspec-ic">' + ic + '</span><span><b>현재 기기</b> ' + esc(d.kind + ' · ' + d.ori + ' · ' + d.w + '×' + d.h) +
      '<small>' + esc(osTxt + ' · ' + brTxt) + ' — ' + esc(d.msg) + '</small></span></div>' +
      (d.tips.length ? '<ul class="dspec-tips">' + d.tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '') +
      '<details><summary>최소사양 · 화면 크기 기준 보기</summary><div class="dspec-body">' +
      '<h4>① 기기 · 브라우저</h4><table><tr><th>기기</th><th>최소</th><th>권장</th></tr>' +
      '<tr' + (d.os === 'iOS' ? ' class="dspec-me"' : '') + '><td>📱 iPhone</td><td>iOS 16.2 이상 · Safari (iPhone의 Chrome·Firefox도 Safari 엔진)</td><td>iOS 17 이상 · Safari "홈 화면에 추가"로 전체화면</td></tr>' +
      '<tr' + (d.os === 'Android' && d.kind === '폰' ? ' class="dspec-me"' : '') + '><td>📱 Galaxy·Android 폰</td><td>Android 9 이상 · Chrome 111 / 삼성 인터넷 22 이상</td><td>최신 Chrome 또는 삼성 인터넷</td></tr>' +
      '<tr' + (d.os === 'iPadOS' ? ' class="dspec-me"' : '') + '><td>📲 iPad</td><td>iPadOS 16.2 이상 · Safari</td><td>iPadOS 17 이상 · 세로·가로 모두 지원</td></tr>' +
      '<tr' + (d.os === 'Android' && d.kind === '태블릿' ? ' class="dspec-me"' : '') + '><td>📲 Galaxy Tab·Android 태블릿</td><td>Chrome 111 / 삼성 인터넷 22 이상</td><td>최신 버전 · 세로·가로 모두 지원</td></tr>' +
      '<tr' + me('PC') + '><td>💻 PC (Windows·Mac)</td><td>Chrome·Edge 111 · Firefox 126 · Safari 16.2 이상</td><td>최신 버전</td></tr>' +
      '</table>' +
      '<h4>② 화면 크기 (게임이 보이는 영역 기준)</h4><table><tr><th>화면</th><th>최소</th><th>권장</th></tr>' +
      '<tr' + ms('pp') + '><td>폰 세로</td><td>폭 320</td><td>폭 360 이상 (iPhone SE 375 · Galaxy S 360~412 · iPhone Pro Max 440)</td></tr>' +
      '<tr' + ms('pl') + '><td>폰 가로</td><td>높이 300</td><td>높이 360 이상</td></tr>' +
      '<tr' + ms('tab') + '><td>태블릿</td><td>짧은 변 600</td><td>짧은 변 768 이상 (iPad 820·1024 · Galaxy Tab 800)</td></tr>' +
      '<tr' + ms('pc') + '><td>PC 창</td><td>1024×600</td><td>1280×720 이상 (작으면 창을 키우거나 F11 전체화면)</td></tr>' +
      '</table>' +
      '<h4>③ 공통</h4><table><tr><td>설정</td><td>JavaScript 켜짐 · 사이트 데이터(저장소) 허용 · 인터넷 연결(글꼴·효과음)</td></tr>' +
      '<tr><td>화면이 어긋나면</td><td>새로고침 → 기기를 한 번 돌렸다 되돌리기 → 최신 버전 업데이트' + (apple ? ' → Safari로 열기' : '') + '</td></tr></table>' +
      '<p class="dspec-note">※ 기준은 게임이 사용하는 화면 기능(dvh·컨테이너 쿼리·color-mix·zoom)이 지원되는 첫 버전입니다. 숫자는 CSS 픽셀(브라우저가 알려주는 크기)입니다.</p>' +
      '</div></details></div>';
  }

  function ensureCss() {
    if (document.getElementById('dspec-css')) return;
    var st = document.createElement('style'); st.id = 'dspec-css'; st.textContent = CSSTXT;
    (document.head || document.documentElement).appendChild(st);
  }

  function target() {
    var slot = document.querySelector('.dspec-slot');
    if (slot) return { el: slot, mode: 'fill' };
    var c = document.querySelector('.panel.setup') || document.querySelector('#setupForm') ||
      document.querySelector('#setup .su') || document.querySelector('#setup');
    if (!c) return null;
    if (document.body.classList.contains('playing')) return null;
    var r = c.getBoundingClientRect();
    if (!r.width) return null;
    return { el: c, mode: 'insert' };
  }

  function mount() {
    var t = target();
    if (!t || t.el.querySelector('[data-dspec]')) return;
    ensureCss();
    var wrap = document.createElement('div');
    wrap.innerHTML = html();
    var box = wrap.firstChild;
    if (t.mode === 'fill') { t.el.innerHTML = ''; t.el.appendChild(box); return; }
    // 제목·배너 바로 아래, 첫 입력 항목 위에 넣기
    var kids = t.el.children, anchor = null;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (/^(H1|H2|H3)$/.test(k.tagName) || k.classList.contains('skin-banner') || k.classList.contains('hint') || k.classList.contains('skin-hide')) anchor = k;
      else break;
    }
    if (anchor && anchor.nextSibling) t.el.insertBefore(box, anchor.nextSibling);
    else if (anchor) t.el.appendChild(box);
    else t.el.insertBefore(box, t.el.firstChild);
  }

  var timer = 0;
  function later(ms) { clearTimeout(timer); timer = setTimeout(mount, ms || 60); }

  window.DeviceSpec = { detect: detect, html: function () { ensureCss(); return html(); }, mount: mount };

  function start() {
    // 화면 변화 감시(MutationObserver)는 게임 중 부담이 커서 쓰지 않음:
    // 처음 몇 번 재시도 + 화면을 누른 뒤(새 게임·처음 화면 복귀) 한 번 확인
    [0, 300, 1000, 2500].forEach(function (t) { setTimeout(mount, t); });
    addEventListener('pageshow', function () { later(100); });
    document.addEventListener('click', function () { later(400); }, true);
    addEventListener('orientationchange', function () {
      setTimeout(function () { var b = document.querySelector('[data-dspec]'); if (b && !b.querySelector('details[open]')) { b.remove(); mount(); } }, 500);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
