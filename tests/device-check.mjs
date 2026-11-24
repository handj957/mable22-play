/* 기종별 실제 브라우저 엔진 점검 (GitHub Actions에서 실행)
 *   WebKit = iPhone·iPad·Mac Safari 엔진, Chromium = Android·PC Chrome, Firefox = PC
 *   node tests/device-check.mjs [base=http://localhost:8000] [mp=ws://localhost:8787]
 * 게임 8개 × 기종별: 첫 화면 → (멀티플레이 패널) → 1인 게임 시작 → 차례 진행, 오류 수집
 * 마지막에 서로 다른 기종 2대(iPad Safari + Android Chrome)로 빠른 매칭 실제 시험
 */
import { webkit, chromium, firefox, devices } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:8000';
const MP = process.argv[3] || 'ws://localhost:8787';
const GAMES = (process.env.GAMES || 'level1,level2,level3,level4,beginning-level1,beginning-level2,beginning-level3,beginning-level4').split(',');
const D = devices;
const KINDS = [
  ['iPhone Safari', webkit, D['iPhone 15 Pro Max']],
  ['iPad Safari 세로', webkit, D['iPad Pro 11']],
  ['iPad Safari 가로', webkit, D['iPad Pro 11 landscape']],
  ['Mac Safari', webkit, D['Desktop Safari']],
  ['Android 폰 Chrome', chromium, D['Pixel 7']],
  ['Galaxy Tab Chrome', chromium, D['Galaxy Tab S4']],
  ['PC Chrome', chromium, D['Desktop Chrome']],
  ['PC Firefox', firefox, D['Desktop Firefox']],
].filter(k => !process.env.KINDS || process.env.KINDS.split(',').some(s => k[0].includes(s)));

const sleep = ms => new Promise(r => setTimeout(r, ms));
const is2 = g => g.endsWith('2');
const ST = g => is2(g) ? 'G' : 'S';
const ACT = g => is2(g) ? '#roll,#center .btns .btn[data-i]' : '[data-ask]:not([disabled])';

/* 누르기: 먼저 정상 방식(도구가 '누를 수 있는 상태'인지 확인) → 실패하면 이유를 기록하고 손가락처럼 좌표로 누름 */
let ISSUES = null;
async function press(pg, el, touch, label) {
  try { if (touch) await el.tap({ timeout: 3000 }); else await el.click({ timeout: 3000 }); return 'ok'; }
  catch (e) {
    const why = String(e.message).split('\n').filter(l => /waiting|element is|not |intercept|outside|stable|visible|enabled|retrying/.test(l)).slice(-2).join(' / ').slice(0, 220);
    const info = await el.evaluate(n => { const r = n.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const top = document.elementFromPoint(x, y);
      const anim = []; for (let a = n; a; a = a.parentElement) { try { const L = a.getAnimations ? a.getAnimations() : []; if (L.length) anim.push(a.tagName + '.' + String(a.className).split(' ')[0] + ':' + L.length); } catch (x) {} }
      return { box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], vw: innerWidth, vh: innerHeight, top: top ? top.tagName + '.' + String(top.className).split(' ')[0] + (top === n || n.contains(top) ? '(자기자신)' : '(가림)') : 'null', anim: anim.slice(0, 3), vis: getComputedStyle(n).visibility, op: getComputedStyle(n).opacity };
    }).catch(() => ({}));
    if (ISSUES) ISSUES.push({ step: label, why, ...info });
    const b = await el.boundingBox().catch(() => null);
    if (!b) throw e;
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    if (touch) await pg.touchscreen.tap(x, y); else await pg.mouse.click(x, y);
    return 'coord';
  }
}

const setupShown = pg => pg.evaluate(() => { const p = document.querySelector('[data-mp-panel]'); if (!p) return false; const r = p.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(p).visibility !== 'hidden'; }).catch(() => false);
async function firstScreen(pg, g) {
  /* Level 3·4는 인트로 뒤에 설정창 — 인트로의 시작/설정 버튼이 있으면 누르고, 없으면 설정창을 엶 */
  if (/[34]$/.test(g)) {
    const hidden = await pg.evaluate(() => { const s = document.getElementById('setup'); return !s || s.hidden; });
    if (hidden) await pg.evaluate(() => { const s = document.getElementById('setup'); if (s) s.hidden = false; });
    await sleep(500);
  }
}

async function one(browserType, name, dev, g, results) {
  const touch = !!dev.hasTouch;
  const b = await browserType.launch();
  const ctx = await b.newContext({ ...dev });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e.message || e).slice(0, 160)));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::|ERR_/.test(m.text())) errs.push('console: ' + m.text().slice(0, 140)); });
  const r = { kind: name, game: g, issues: [] }; ISSUES = r.issues;
  try {
    await pg.goto(`${BASE}/${g}.html?mp=${encodeURIComponent(MP)}`, { waitUntil: 'load' });
    await sleep(2000);
    r.popupAtEntry = await pg.evaluate(() => !!document.querySelector('#mp-mode, .mp-ov'));
    // 옛 방식(입장 팝업)이면 1인 플레이 버튼을 눌러 봄
    if (r.popupAtEntry) {
      const solo = await pg.$('[data-mp-solo]');
      if (solo) { try { await press(pg, solo, touch); } catch (e) { r.soloErr = String(e.message).slice(0, 120); } }
      await sleep(800);
      r.popupClosed = await pg.evaluate(() => !document.querySelector('#mp-mode, .mp-ov'));
      if (!r.popupClosed) {
        r.blocker = await pg.evaluate(() => { const b = document.querySelector('[data-mp-solo]'); if (!b) return 'no button'; const q = b.getBoundingClientRect(); const e = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return e ? (e.tagName + '#' + e.id + '.' + String(e.className).slice(0, 40)) : 'null'; });
        await pg.evaluate(() => document.querySelectorAll('.mp-ov').forEach(x => x.remove()));
      }
    }
    await firstScreen(pg, g);
    // 첫 화면 안 멀티플레이 패널
    r.panel = await pg.evaluate(() => !!document.querySelector('[data-mp-panel]'));
    if (r.panel) {
      const q = pg.locator('[data-mp-panel] [data-mp-quick]').first();
      if (await q.count()) {
        await q.scrollIntoViewIfNeeded(); r.quickPress = await press(pg, q, touch, '빠른 매칭'); await sleep(1500);
        r.quickWaiting = await pg.evaluate(() => (window.MP && MP.mode) || '');
        const c = pg.locator('[data-mp-panel] [data-mp-leave]').first();
        if (await c.count()) { await c.scrollIntoViewIfNeeded(); r.cancelPress = await press(pg, c, touch, '취소'); await sleep(900); }
        r.quickCanceled = await pg.evaluate(() => window.MP && MP.mode === 'local');
        r.setupAfterCancel = await setupShown(pg);          // 취소했는데 게임이 저절로 시작되면 안 됨
      }
    }
    const sel = /level1$|[34]$/.test(g) ? '#setupForm button[type=submit]' : '#start';
    const btn = pg.locator(sel).first();
    if (!(await btn.count())) r.start = 'no start button';
    else { await btn.scrollIntoViewIfNeeded().catch(() => { }); try { r.startPress = await press(pg, btn, touch, '게임 시작'); r.start = 'ok'; } catch (e) { r.start = 'FAIL ' + String(e.message).split('\n')[0].slice(0, 120); } }
    await sleep(1800);
    r.firstScreenClosed = !(await setupShown(pg));          // 게임 시작 뒤 첫 화면이 실제로 닫혔는지
    let taps = 0;
    for (let i = 0; i < 12; i++) {
      const loc = pg.locator(ACT(g)); const n = await loc.count();
      for (let k = 0; k < n; k++) { const e = loc.nth(k); if (await e.isVisible().catch(() => false)) { try { await press(pg, e, touch, '게임 버튼'); taps++; } catch (x) { } break; } }
      await sleep(450);
    }
    r.running = await pg.evaluate(st => { const s = window[st] || eval(st); return !!(s && s.players && s.players.length); }, ST(g)).catch(() => false);
    r.taps = taps;
    r.errBar = await pg.evaluate(() => [...document.querySelectorAll('.mp-err')].map(x => x.textContent.slice(0, 120)));
  } catch (e) { r.fatal = String(e.message).split('\n')[0].slice(0, 160); }
  r.errors = errs.slice(0, 3);
  r.ok = !r.fatal && !r.popupAtEntry && r.start === 'ok' && r.firstScreenClosed && r.running && r.taps > 0 && r.setupAfterCancel !== false && !errs.length && !(r.errBar || []).length && (!r.panel || (r.quickWaiting === 'queue' && r.quickCanceled));
  if (!r.ok) { try { await pg.screenshot({ path: `shots/${name.replace(/\s+/g, '_')}-${g}.png` }); } catch (e) { } }
  results.push(r);
  const brief = { ...r, issues: r.issues.map(i => i.step + (i.top && /가림/.test(i.top) ? '·가림:' + i.top : '') + (i.box && i.box[2] === 0 ? '·크기0' : '')) };
  console.log((r.ok ? 'OK   ' : 'FAIL ') + name.padEnd(18) + g.padEnd(18) + JSON.stringify(brief));
  await b.close();
}

/* 서로 다른 기종끼리 빠른 매칭 */
async function crossMatch(g) {
  const pairs = [['iPad Safari', webkit, D['iPad Pro 11']], ['Android Chrome', chromium, D['Pixel 7']], ['PC Firefox', firefox, D['Desktop Firefox']]];
  const opened = [];
  for (const [n, bt, dev] of pairs) {
    const b = await bt.launch(); const ctx = await b.newContext({ ...dev }); const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
    await pg.goto(`${BASE}/${g}.html?mp=${encodeURIComponent(MP)}`); await sleep(2000); await firstScreen(pg, g);
    const q = pg.locator('[data-mp-panel] [data-mp-quick]').first();
    if (!(await q.count())) { console.log('FAIL 빠른 매칭 버튼 없음', n); await b.close(); return false; }
    await q.scrollIntoViewIfNeeded(); await press(pg, q, !!dev.hasTouch);
    opened.push({ n, b, pg, errs, touch: !!dev.hasTouch }); await sleep(800);
  }
  await sleep(1500);
  const go = opened[0].pg.locator('[data-mp-panel] [data-mp-act=go]').first();
  if (await go.count()) await press(opened[0].pg, go, opened[0].touch, '지금 시작');
  let started = false;
  for (let i = 0; i < 40 && !started; i++) { await sleep(500); started = (await Promise.all(opened.map(o => o.pg.evaluate(st => !!(window.MP && MP.started && eval(st)), ST(g)).catch(() => false)))).every(Boolean); }
  for (let it = 0; it < 30; it++) {
    for (const o of opened) {
      const mine = await o.pg.evaluate(() => { const a = MP.asker(); return !!a && a.id === MP.seat; }).catch(() => false);
      if (!mine) continue;
      const loc = o.pg.locator(ACT(g)); const n = await loc.count();
      for (let k = 0; k < n; k++) { const e = loc.nth(k); if (await e.isVisible().catch(() => false)) { try { await press(o.pg, e, o.touch, '게임 버튼'); } catch (x) { } break; } }
    }
    await sleep(400);
  }
  const states = await Promise.all(opened.map(o => o.pg.evaluate(st => { const s = eval(st); return JSON.stringify([s.round, s.turn, s.players.map(p => p.cash)]); }, ST(g)).catch(e => 'ERR')));
  const same = new Set(states).size === 1 && states[0] !== 'ERR';
  const errs = opened.flatMap(o => o.errs);
  console.log(`${started && same && !errs.length ? 'OK  ' : 'FAIL'} 빠른 매칭(iPad Safari + Android Chrome + PC Firefox) ${g}: 시작=${started} 동기화=${same} ${states[0]} 오류=${JSON.stringify(errs.slice(0, 2))}`);
  for (const o of opened) await o.b.close();
  return started && same && !errs.length;
}

import fs from 'node:fs'; try { fs.mkdirSync('shots', { recursive: true }); } catch (e) { }
const results = [];
for (const [name, bt, dev] of KINDS) for (const g of GAMES) await one(bt, name, dev, g, results);
const ok = results.filter(r => r.ok).length;
console.log(`\n== 기종 점검 ${ok}/${results.length} 통과`);
let cross = true;
if (!process.env.NO_CROSS) for (const g of (process.env.CROSS || 'level1,beginning-level3').split(',')) cross = (await crossMatch(g)) && cross;
process.exit(ok === results.length && cross ? 0 : 1);
