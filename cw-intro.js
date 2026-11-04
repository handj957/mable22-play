/* Crazy World · 초기 접속(시작) 화면 공용 스크립트 — 설정은 각 html의 window.CW 에서 받음
   규칙: 모든 localStorage 접근은 try/catch · 글자 줄임/아이콘 숨김 같은 JS 자동 맞춤 없음 ·
   BGM은 이 화면에서만 · 본편 파일이 있을 때만 이동(없으면 안내창) */
(function () {
  'use strict';
  var CW = window.CW;
  if (!CW) return;
  var root = document.documentElement;
  root.setAttribute('data-game', CW.theme);

  /* ───────── 저장소 헬퍼 ───────── */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function jget(k) { try { var s = lsGet(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ───────── 공용 문구 ───────── */
  var COMMON = {
    ko: {
      sound_on: '소리 ON', sound_off: '소리 OFF', sound_title: '배경음악·효과음 (화면을 한 번 터치하면 시작)',
      sec_diff: '난이도', sec_diff_hint: '규칙 모듈을 켜고 끕니다',
      sec_mood: '분위기 프리셋', custom: '맞춤',
      sec_humans: '사람 플레이어', ai_fill: 'AI {n}명 자동 참가', ai_none: '전원 사람',
      sec_speed: '진행 속도', speed_hint: '원인→결과 연출',
      slow: '느림', normal: '보통', fast: '빠름',
      more: '세부 옵션', start: '게임 시작', resume: '이어하기', resume_sub: '{r}라운드 저장됨',
      spec: 'PC · 패드 · 폰 지원 — 가로·세로 모두', now: '현재 화면',
      phone: '폰', tablet: '패드', pc: 'PC', port: '세로', land: '가로',
      o_scenario: '시나리오', o_win: '승리 조건', o_cycle: '경기 사이클', o_intensity: '이벤트 강도', o_comeback: '역전 장치',
      o_gamble: '도박 옵션', o_secret: '비밀 임무', o_concept: '개념 라벨(학습 설명)',
      cycle_fixed: '고정', cycle_random: '랜덤', cycle_off: '끔',
      int_calm: '잔잔', int_normal: '보통', int_wild: '격동',
      cb_weak: '약', cb_mid: '보통', cb_strong: '강',
      m_title: '본편 연결 준비 중', m_body: '선택한 설정이 이 기기에 저장되었습니다. 게임 본편 파일이 올라오면 이 버튼에서 바로 시작됩니다.', m_ok: '확인',
      people: '사람', ai: 'AI', mood: '분위기'
    },
    en: {
      sound_on: 'Sound ON', sound_off: 'Sound OFF', sound_title: 'Music & effects (tap the screen once to start)',
      sec_diff: 'Difficulty', sec_diff_hint: 'Toggles rule modules',
      sec_mood: 'Mood preset', custom: 'Custom',
      sec_humans: 'Human players', ai_fill: '{n} AI join automatically', ai_none: 'All human',
      sec_speed: 'Game speed', speed_hint: 'Cause → effect animation',
      slow: 'Slow', normal: 'Normal', fast: 'Fast',
      more: 'Advanced options', start: 'Start Game', resume: 'Continue', resume_sub: 'Round {r} saved',
      spec: 'PC · Tablet · Phone — portrait & landscape', now: 'Now',
      phone: 'Phone', tablet: 'Tablet', pc: 'PC', port: 'Portrait', land: 'Landscape',
      o_scenario: 'Scenario', o_win: 'Win condition', o_cycle: 'Economic cycle', o_intensity: 'Event intensity', o_comeback: 'Comeback aid',
      o_gamble: 'Gamble option', o_secret: 'Secret missions', o_concept: 'Concept labels (learning notes)',
      cycle_fixed: 'Fixed', cycle_random: 'Random', cycle_off: 'Off',
      int_calm: 'Calm', int_normal: 'Normal', int_wild: 'Wild',
      cb_weak: 'Weak', cb_mid: 'Normal', cb_strong: 'Strong',
      m_title: 'Game not connected yet', m_body: 'Your settings were saved on this device. Once the main game file is uploaded, this button will launch it directly.', m_ok: 'OK',
      people: 'Humans', ai: 'AI', mood: 'Mood'
    }
  };
  var LANG = (function () {
    var s = lsGet('cw_lang');
    if (s === 'ko' || s === 'en') return s;
    try { return /^ko/i.test(navigator.language || '') ? 'ko' : 'en'; } catch (e) { return 'ko'; }
  })();
  function T(k, vars) {
    var s = (CW.text && CW.text[LANG] && CW.text[LANG][k]);
    if (s == null) s = COMMON[LANG][k];
    if (s == null) s = k;
    if (vars) for (var v in vars) s = s.replace('{' + v + '}', vars[v]);
    return s;
  }
  function L(o) { return o && (o[LANG] != null ? o[LANG] : o.ko); }

  /* ───────── 공용 옵션 정의 (게임 설정이 scenario·win 선택지를 덧붙임) ───────── */
  var SPEEDS = ['slow', 'normal', 'fast'];
  function selects() {
    return [
      { id: 'scenario', label: 'o_scenario', choices: CW.scenarios },
      { id: 'win', label: 'o_win', choices: CW.wins },
      { id: 'cycle', label: 'o_cycle', choices: [{ v: 'fixed', k: 'cycle_fixed' }, { v: 'random', k: 'cycle_random' }, { v: 'off', k: 'cycle_off' }] },
      { id: 'intensity', label: 'o_intensity', choices: [{ v: 'calm', k: 'int_calm' }, { v: 'normal', k: 'int_normal' }, { v: 'wild', k: 'int_wild' }] },
      { id: 'comeback', label: 'o_comeback', choices: [{ v: 'weak', k: 'cb_weak' }, { v: 'mid', k: 'cb_mid' }, { v: 'strong', k: 'cb_strong' }] }
    ];
  }
  var TOGGLES = [{ id: 'gamble', label: 'o_gamble' }, { id: 'secret', label: 'o_secret' }, { id: 'concept', label: 'o_concept' }];

  /* ───────── 상태 ───────── */
  var SK = CW.key + '_setup', RK = CW.key + '_save';
  var S = { diff: 'std', mood: 'classic', humans: 1, speed: 'normal', opts: {}, moreOpen: false };
  (function init() {
    var m = CW.moods[0];
    for (var k in m.opts) S.opts[k] = m.opts[k];
    var sv = jget(SK);
    if (sv && typeof sv === 'object') {
      if (CW.diffs.some(function (d) { return d.id === sv.diff; })) S.diff = sv.diff;
      if (sv.mood === 'custom' || CW.moods.some(function (x) { return x.id === sv.mood; })) S.mood = sv.mood;
      if (sv.humans >= 1 && sv.humans <= 4) S.humans = sv.humans | 0;
      if (SPEEDS.indexOf(sv.speed) >= 0) S.speed = sv.speed;
      if (sv.opts && typeof sv.opts === 'object') for (var k2 in S.opts) if (k2 in sv.opts) S.opts[k2] = sv.opts[k2];
    }
  })();
  function persist() { lsSet(SK, JSON.stringify({ diff: S.diff, mood: S.mood, humans: S.humans, speed: S.speed, opts: S.opts, lang: LANG })); }

  /* ───────── 화면 높이·기기 판별 ───────── */
  function setAppH() {
    var h = innerHeight, vv = window.visualViewport, ch = root.clientHeight;
    if (vv && vv.height) h = Math.min(h, vv.height);
    if (ch) h = Math.min(h, ch);
    if (h > 100) root.style.setProperty('--app-h', Math.round(h) + 'px');
  }
  function device() {
    var w = innerWidth, h = innerHeight, touch = false;
    try { touch = (navigator.maxTouchPoints > 0) || matchMedia('(pointer:coarse)').matches; } catch (e) {}
    var k = touch ? (Math.min(w, h) < 600 ? 'phone' : 'tablet') : 'pc';
    var land = (typeof window.__landscape === 'function') ? window.__landscape() : (w > h);
    return { k: k, o: land ? 'land' : 'port', w: w, h: h };
  }
  function nowText() { var d = device(); return T(d.k) + ' · ' + T(d.o) + ' (' + d.w + '×' + d.h + ')'; }
  function updateNow() { var e = document.getElementById('cwnow'); if (e) e.textContent = nowText(); }

  /* ───────── 렌더 ───────── */
  var app = document.getElementById('app');
  function optBtn(act, v, ico, name, sub, sel, cls) {
    return '<button type="button" class="opt ' + (cls || '') + '" role="radio" aria-checked="' + sel + '" data-act="' + act + '" data-v="' + esc(v) + '">' +
      (ico ? '<span class="ico" aria-hidden="true">' + ico + '</span>' : '') +
      '<span class="nm">' + esc(name) + '</span>' + (sub ? '<span class="sb">' + esc(sub) + '</span>' : '') + '</button>';
  }
  function seatsHTML() {
    var s = '';
    for (var i = 0; i < 4; i++) s += '<span class="seat ' + (i < S.humans ? 'h' : '') + '" aria-hidden="true">' + (i < S.humans ? '👤' : '🤖') + '</span>';
    return s;
  }
  var firstRender = true;
  function render() {
    /* 다시 그려도 패널 스크롤 위치와 키보드 포커스를 유지 (옵션을 누를 때마다 맨 위로 튀지 않게) */
    var pbOld = document.querySelector('.panel-body'), keepTop = pbOld ? pbOld.scrollTop : 0, fk = null;
    var ae = document.activeElement;
    if (ae && ae !== document.body && ae.getAttribute && app.contains(ae)) {
      fk = ['data-act', 'data-v', 'data-id', 'id'].map(function (a) { return [a, ae.getAttribute(a)]; }).filter(function (p) { return p[1] != null; });
    }
    document.documentElement.lang = LANG;
    document.title = CW.brand + ' · ' + L(CW.title);
    var saved = jget(RK);
    var hasResume = !!(saved && typeof saved === 'object');
    var h = '';
    h += '<header class="top"><div class="brand"><div class="logo" aria-hidden="true">' + esc(CW.logo) + '</div><div class="brand-name">' + esc(CW.brand) + '</div></div>' +
      '<div class="ctl"><div class="lang" role="group" aria-label="Language">' +
      '<button type="button" data-act="lang" data-v="ko" aria-pressed="' + (LANG === 'ko') + '">KO</button>' +
      '<button type="button" data-act="lang" data-v="en" aria-pressed="' + (LANG === 'en') + '">EN</button></div>' +
      '<button type="button" class="pill" id="cwsnd" data-act="snd" title="' + esc(T('sound_title')) + '"></button></div></header>';

    h += '<main class="main"><section class="hero"><span class="badge">' + esc(CW.brand) + '</span>' +
      '<h1 class="title">' + esc(L(CW.title)) + '</h1><p class="tagline">' + esc(L(CW.tagline)) + '</p>' +
      '<div class="meta">' + CW.meta.map(function (m) { return '<span class="chip">' + esc(L(m)) + '</span>'; }).join('') + '</div>' +
      '<ul class="feat">' + CW.feats.map(function (f) { return '<li><span class="fi" aria-hidden="true">' + f.ico + '</span><span>' + esc(L(f)) + '</span></li>'; }).join('') + '</ul></section>';

    h += '<section class="panel' + (firstRender ? ' enter' : '') + '" aria-label="' + esc(T('sec_diff')) + '"><div class="panel-body">';
    h += '<div class="sec"><div class="lab"><span>' + esc(T('sec_diff')) + '</span><small>' + esc(T('sec_diff_hint')) + '</small></div>' +
      '<div class="opts d3" role="radiogroup" aria-label="' + esc(T('sec_diff')) + '">' +
      CW.diffs.map(function (d) { return optBtn('diff', d.id, d.ico, L(d.name), L(d.sub), S.diff === d.id); }).join('') + '</div></div>';

    h += '<div class="sec"><div class="lab"><span>' + esc(T('sec_mood')) + '</span><small>' + (S.mood === 'custom' ? esc(T('custom')) : '') + '</small></div>' +
      '<div class="opts m4" role="radiogroup" aria-label="' + esc(T('sec_mood')) + '">' +
      CW.moods.map(function (m) { return optBtn('mood', m.id, m.ico, L(m.name), '', S.mood === m.id, 'mini'); }).join('') + '</div></div>';

    var ai = 4 - S.humans;
    h += '<div class="pair"><div class="sec"><div class="lab"><span>' + esc(T('sec_humans')) + '</span></div>' +
      '<div class="row"><div class="step" role="group" aria-label="' + esc(T('sec_humans')) + '">' +
      '<button type="button" data-act="hm" data-v="-1" aria-label="-"' + (S.humans <= 1 ? ' disabled' : '') + '>−</button>' +
      '<output id="cwhm" aria-live="polite">' + S.humans + '</output>' +
      '<button type="button" data-act="hm" data-v="1" aria-label="+"' + (S.humans >= 4 ? ' disabled' : '') + '>+</button></div>' +
      '<div class="seats" id="cwseats">' + seatsHTML() + '</div></div>' +
      '<div class="hint" id="cwai">' + esc(ai > 0 ? T('ai_fill', { n: ai }) : T('ai_none')) + '</div></div>' +
      '<div class="sec"><div class="lab"><span>' + esc(T('sec_speed')) + '</span></div>' +
      '<div class="opts s3" role="radiogroup" aria-label="' + esc(T('sec_speed')) + '">' +
      SPEEDS.map(function (s) { return optBtn('speed', s, '', T(s), '', S.speed === s, 'seg'); }).join('') + '</div>' +
      '<div class="hint">' + esc(T('speed_hint')) + '</div></div></div>';

    h += '<details class="more" id="cwmore"' + (S.moreOpen ? ' open' : '') + '><summary><span>' + esc(T('more')) + '</span><span class="arrow" aria-hidden="true">▼</span></summary><div class="more-grid">';
    selects().forEach(function (f) {
      h += '<div class="fld"><label for="cw_' + f.id + '">' + esc(T(f.label)) + '</label><select id="cw_' + f.id + '" data-act="sel" data-id="' + f.id + '">' +
        f.choices.map(function (c) { return '<option value="' + esc(c.v) + '"' + (S.opts[f.id] === c.v ? ' selected' : '') + '>' + esc(c.k ? T(c.k) : L(c)) + '</option>'; }).join('') + '</select></div>';
    });
    TOGGLES.forEach(function (t) {
      var on = !!S.opts[t.id];
      h += '<div class="fld"><button type="button" class="tog" role="switch" aria-checked="' + on + '" data-act="tog" data-id="' + t.id + '"><span class="t">' + esc(T(t.label)) + '</span><span class="sw" aria-hidden="true"></span></button></div>';
    });
    h += '</div></details></div></section></main>';

    h += '<footer class="foot' + (hasResume ? ' has-resume' : '') + '">' +
      (hasResume ? '<button type="button" class="btn btn-sub" data-act="resume"><span>' + esc(T('resume')) + '</span><small>' + esc(T('resume_sub', { r: (saved.round != null ? saved.round : '?') })) + '</small></button>' : '') +
      '<button type="button" class="btn btn-go" data-act="start" id="cwgo"><span aria-hidden="true">▶</span><span>' + esc(T('start')) + '</span></button>' +
      '<div class="spec"><span class="full">' + esc(T('spec')) + '</span><span>' + esc(T('now')) + ': <b id="cwnow">' + esc(nowText()) + '</b></span></div></footer>';
    app.innerHTML = h;
    firstRender = false;
    var pb = document.querySelector('.panel-body'); if (pb && keepTop) pb.scrollTop = keepTop;
    if (fk && fk.length) {
      try {
        var sel = fk.map(function (p) { return '[' + p[0] + '="' + String(p[1]).replace(/"/g, '\\"') + '"]'; }).join('');
        var again = app.querySelector(sel);
        if (again && again.focus) again.focus({ preventScroll: true });
      } catch (er) {}
    }
    paintSound();
  }

  /* ───────── 사운드 (BGM은 이 화면에서만, 모두 코드로 합성) ───────── */
  var SND = (function () {
    var ctx = null, master, musicBus, sfxBus, delayIn, noiseBuf, timer = null, nextT = 0, step = 0;
    var unlocked = false, musicOn = false, muted = lsGet('m22_mute') === '1';
    var Q = { maj: [0, 4, 7], min: [0, 3, 7], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom: [0, 4, 7, 10] };
    function F(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    function init() {
      if (ctx) return true;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try {
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = muted ? 0 : 0.6;
        var comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
        musicBus = ctx.createGain(); musicBus.gain.value = 0.0001; musicBus.connect(master);
        sfxBus = ctx.createGain(); sfxBus.connect(master);
        var d = ctx.createDelay(1); d.delayTime.value = 0.32;
        var fb = ctx.createGain(); fb.gain.value = 0.28;
        var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
        d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(musicBus);
        delayIn = ctx.createGain(); delayIn.gain.value = 1; delayIn.connect(d);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        var ch = noiseBuf.getChannelData(0);
        for (var i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
        return true;
      } catch (e) { ctx = null; return false; }
    }
    function tone(t, f, dur, o) {
      o = o || {};
      var bus = o.bus || musicBus, gain = o.gain || 0.1;
      var osc = ctx.createOscillator(); osc.type = o.type || 'sine'; osc.frequency.value = f;
      if (o.det) osc.detune.value = o.det;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      if (o.pluck) {
        g.gain.linearRampToValueAtTime(gain, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      } else {
        var att = o.att || 0.01, rel = o.rel || 0.1;
        g.gain.linearRampToValueAtTime(gain, t + att);
        g.gain.setValueAtTime(gain, t + Math.max(att, dur - rel));
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
      }
      var n = osc;
      if (o.lp) { var fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; osc.connect(fl); n = fl; }
      n.connect(g); g.connect(bus);
      if (o.send && bus === musicBus) { var sd = ctx.createGain(); sd.gain.value = o.send; g.connect(sd); sd.connect(delayIn); }
      osc.start(t); osc.stop(t + dur + 0.05);
    }
    function hat(t, g) {
      var s = ctx.createBufferSource(); s.buffer = noiseBuf;
      var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      var e = ctx.createGain(); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      s.connect(f); f.connect(e); e.connect(musicBus); s.start(t); s.stop(t + 0.06);
    }
    function kick(t) {
      var o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      var e = ctx.createGain(); e.gain.setValueAtTime(0.32, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(e); e.connect(musicBus); o.start(t); o.stop(t + 0.25);
    }
    function playStep(n, t) {
      var c = CW.bgm, s = n % 16, bar = Math.floor(n / 16) % c.prog.length;
      var ch = c.prog[bar], q = Q[ch[1]], root = c.key + ch[0], sd = 60 / c.bpm / 4;
      if (s === 0) q.forEach(function (x) { tone(t, F(root + x), sd * 16 * 1.02, { type: c.pad.type, gain: c.pad.gain, att: sd * 5, rel: sd * 5, lp: c.pad.lp, send: 0.25, det: (Math.random() - 0.5) * 8 }); });
      if (c.bass.pat.charAt(s) === '1') tone(t, F(root - 12), sd * 1.9, { type: c.bass.type, gain: c.bass.gain, pluck: true, lp: c.bass.lp });
      if (c.arp.pat.charAt(s) === '1') tone(t, F(root + q[(s * 3 + bar) % q.length] + 12 * c.arp.oct), sd * 1.7, { type: c.arp.type, gain: c.arp.gain, pluck: true, lp: c.arp.lp, send: 0.35 });
      if (c.kick.charAt(s) === '1') kick(t);
      if (c.hat.charAt(s) === '1') hat(t, 0.05);
    }
    function tick() {
      if (!ctx || !musicOn) return;
      var c = CW.bgm, sd = 60 / c.bpm / 4;
      while (nextT < ctx.currentTime + 0.2) {
        playStep(step, nextT + ((step % 2) ? c.swing * sd : 0));
        nextT += sd; step++;
      }
    }
    function startMusic() {
      if (!ctx || muted || musicOn) return;
      try { if (ctx.state === 'suspended') ctx.resume(); } catch (e) {}
      musicOn = true; step = 0; nextT = ctx.currentTime + 0.1;
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setValueAtTime(0.0001, ctx.currentTime);
      musicBus.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.4);
      timer = setInterval(tick, 40);
    }
    function stopMusic(fade) {
      if (!musicOn) return;
      musicOn = false;
      if (timer) { clearInterval(timer); timer = null; }
      if (ctx) {
        try {
          musicBus.gain.cancelScheduledValues(ctx.currentTime);
          musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime);
          musicBus.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + (fade || 0.4));
        } catch (e) {}
      }
    }
    function sfx(kind) {
      if (!ctx || muted || !unlocked) return;
      var t = ctx.currentTime + 0.005, o = { bus: sfxBus, pluck: true };
      if (kind === 'tick') tone(t, 880, 0.07, { bus: sfxBus, type: 'triangle', gain: 0.07, pluck: true });
      else if (kind === 'sel') { tone(t, 660, 0.09, { bus: sfxBus, type: 'triangle', gain: 0.08, pluck: true }); tone(t + 0.06, 990, 0.12, { bus: sfxBus, type: 'triangle', gain: 0.07, pluck: true }); }
      else if (kind === 'start') [523, 659, 784, 1047].forEach(function (f, i) { tone(t + i * 0.07, f, 0.22, { bus: sfxBus, type: 'triangle', gain: 0.09, pluck: true }); });
    }
    function unlock() {
      if (unlocked) return;
      if (!init()) return;
      unlocked = true;
      try { if (ctx.state === 'suspended') ctx.resume(); } catch (e) {}
      startMusic();
    }
    function setMuted(m) {
      muted = !!m; lsSet('m22_mute', muted ? '1' : '0');
      if (ctx) {
        try { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(muted ? 0 : 0.6, ctx.currentTime, 0.05); } catch (e) {}
        if (muted) stopMusic(0.2); else if (unlocked && introActive) startMusic();
      }
    }
    function pause() { if (ctx && unlocked) { try { ctx.suspend(); } catch (e) {} } }
    function resume() { if (ctx && unlocked && introActive) { try { ctx.resume(); } catch (e) {} } }
    return { unlock: unlock, startMusic: startMusic, stopMusic: stopMusic, sfx: sfx, setMuted: setMuted, isMuted: function () { return muted; }, pause: pause, resume: resume };
  })();
  var introActive = true;
  function paintSound() {
    var b = document.getElementById('cwsnd'); if (!b) return;
    var m = SND.isMuted();
    b.textContent = (m ? '🔇 ' : '🔊 ') + T(m ? 'sound_off' : 'sound_on');
    b.setAttribute('aria-pressed', String(!m));
    b.setAttribute('title', T('sound_title'));
  }

  /* ───────── 동작 ───────── */
  function applyMood(id) {
    var m = CW.moods.filter(function (x) { return x.id === id; })[0];
    if (!m) return;
    S.mood = id;
    for (var k in m.opts) S.opts[k] = m.opts[k];
  }
  function summary() {
    var diff = CW.diffs.filter(function (d) { return d.id === S.diff; })[0];
    var mood = CW.moods.filter(function (d) { return d.id === S.mood; })[0];
    var rows = [[T('sec_diff'), diff ? L(diff.name) : S.diff], [T('mood'), mood ? L(mood.name) : T('custom')],
      [T('people'), S.humans + ' + AI ' + (4 - S.humans)], [T('sec_speed'), T(S.speed)]];
    selects().forEach(function (f) {
      var c = f.choices.filter(function (x) { return x.v === S.opts[f.id]; })[0];
      rows.push([T(f.label), c ? (c.k ? T(c.k) : L(c)) : String(S.opts[f.id])]);
    });
    TOGGLES.forEach(function (t) { rows.push([T(t.label), S.opts[t.id] ? 'ON' : 'OFF']); });
    return rows;
  }
  function showModal() {
    var m = document.getElementById('modal');
    m.innerHTML = '<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="cwmt"><h2 id="cwmt">' + esc(T('m_title')) + '</h2><p>' + esc(T('m_body')) + '</p><dl>' +
      summary().map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>' +
      '<button type="button" class="btn" data-act="mclose">' + esc(T('m_ok')) + '</button></div>';
    m.hidden = false;
    var b = m.querySelector('button'); if (b) { try { b.focus(); } catch (e) {} }
  }
  function closeModal() {
    var m = document.getElementById('modal'); m.hidden = true; m.innerHTML = '';
    introActive = true; SND.resume(); SND.startMusic();
    var g = document.getElementById('cwgo'); if (g) { try { g.focus(); } catch (e) {} }
  }
  function probe(url) {
    if (!url) return Promise.resolve(false);
    try { return fetch(url, { method: 'HEAD', cache: 'no-store' }).then(function (r) { return !!r.ok; }, function () { return false; }); }
    catch (e) { return Promise.resolve(false); }
  }
  var starting = false;
  function go(resume) {
    if (starting) return;
    starting = true; persist();
    SND.sfx('start'); introActive = false; SND.stopMusic(0.5);
    probe(CW.next).then(function (ok) {
      if (ok) { setTimeout(function () { location.href = CW.next + (resume ? '?resume=1' : ''); }, 360); }
      else { starting = false; showModal(); }
    });
  }

  app.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el || el.tagName === 'SELECT') return;
    var act = el.getAttribute('data-act'), v = el.getAttribute('data-v'), id = el.getAttribute('data-id');
    if (act === 'lang') { if (v !== LANG) { LANG = v; lsSet('cw_lang', v); render(); } SND.sfx('tick'); return; }
    if (act === 'snd') { SND.unlock(); SND.setMuted(!SND.isMuted()); paintSound(); SND.sfx('tick'); return; }
    if (act === 'diff') { S.diff = v; persist(); render(); SND.sfx('sel'); return; }
    if (act === 'mood') { applyMood(v); persist(); render(); SND.sfx('sel'); return; }
    if (act === 'speed') { S.speed = v; persist(); render(); SND.sfx('tick'); return; }
    if (act === 'hm') {
      var n = Math.max(1, Math.min(4, S.humans + parseInt(v, 10)));
      if (n !== S.humans) { S.humans = n; persist(); render(); SND.sfx('tick'); }
      return;
    }
    if (act === 'tog') { S.opts[id] = !S.opts[id]; S.mood = 'custom'; persist(); render(); SND.sfx('tick'); return; }
    if (act === 'start') { go(false); return; }
    if (act === 'resume') { go(true); return; }
  });
  app.addEventListener('change', function (e) {
    var el = e.target;
    if (el && el.getAttribute && el.getAttribute('data-act') === 'sel') {
      S.opts[el.getAttribute('data-id')] = el.value; S.mood = 'custom'; persist(); render(); SND.sfx('tick');
    }
  });
  app.addEventListener('toggle', function (e) {
    var d = e.target; if (d && d.id === 'cwmore') S.moreOpen = d.open;
  }, true);
  document.getElementById('modal').addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-act="mclose"]') : null;
    if (el || e.target.id === 'modal') closeModal();
  });
  document.addEventListener('keydown', function (e) {
    SND.unlock();
    if (e.key === 'Escape' && !document.getElementById('modal').hidden) closeModal();
  });
  document.addEventListener('pointerdown', function () { SND.unlock(); paintSound(); }, true);
  document.addEventListener('visibilitychange', function () { if (document.hidden) SND.pause(); else SND.resume(); });

  /* 터치 기기(패드): 첫 터치 때 전체화면 — 브라우저 탭·주소창을 숨겨 화면을 꽉 채움 */
  (function () {
    try {
      var de = root, rq = de.requestFullscreen || de.webkitRequestFullscreen;
      var sa = (navigator.standalone === true) || (window.matchMedia && matchMedia('(display-mode: standalone),(display-mode: fullscreen)').matches);
      if (!rq || sa || !(navigator.maxTouchPoints > 0)) return;
      function enter() {
        try { if (document.fullscreenElement || document.webkitFullscreenElement) return; var p = rq.call(de, { navigationUI: 'hide' }); if (p && p.catch) p.catch(function () {}); } catch (e) {}
      }
      function once() { document.removeEventListener('pointerup', once, true); enter(); }
      document.addEventListener('pointerup', once, true);
      function fit() { try { dispatchEvent(new Event('resize')); } catch (e) {} }
      document.addEventListener('fullscreenchange', function () { setTimeout(fit, 150); });
      document.addEventListener('webkitfullscreenchange', function () { setTimeout(fit, 150); });
    } catch (e) {}
  })();

  var raf = 0;
  function onResize() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; setAppH(); updateNow(); }); }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

  setAppH();
  render();
  window.__cw = { state: S, render: render, setLang: function (l) { LANG = l; lsSet('cw_lang', l); render(); } };
})();
