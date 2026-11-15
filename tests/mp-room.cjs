/* 온라인 방 규칙(server/src/room-core.js) — 자리 배정·잠금·재접속·전달 */
const assert = require('node:assert/strict');
(async () => {
  const { RoomCore } = await import('../server/src/room-core.js');
  const mk = () => { const c = { out: [], closed: null, send(s) { this.out.push(JSON.parse(s)); }, close(code) { this.closed = code; } }; return c; };
  const last = (c, t) => c.out.filter(m => m.t === t).pop();
  const r = new RoomCore('ABCD');
  const g0 = mk(); assert.equal(r.join(g0, { role: 'guest', name: 'x', tok: 'g0' }), null); assert.equal(g0.closed, 4000);   // 호스트 없는 방
  const h = mk(), hm = r.join(h, { role: 'host', name: '호스트', tok: 'h', lv: 'level3' });
  assert.equal(last(h, 'welcome').seat, 0); assert.equal(last(h, 'welcome').host, true);
  const h2 = mk(); assert.equal(r.join(h2, { role: 'host', name: 'y', tok: 'h2' }), null);                                  // 코드 중복
  const wrong = mk(); assert.equal(r.join(wrong, { role: 'guest', name: 'w', tok: 'w', lv: 'level1' }), null);             // 다른 레벨
  const gs = [1, 2, 3].map(i => { const c = mk(); const m = r.join(c, { role: 'guest', name: 'p' + i, tok: 't' + i, lv: 'level3' }); assert.equal(m.seat, i); return [c, m]; });
  const full = mk(); assert.equal(r.join(full, { role: 'guest', name: 'f', tok: 'f', lv: 'level3' }), null);              // 4명 초과
  assert.equal(last(h, 'roster').members.length, 4);
  r.message(hm, JSON.stringify({ t: 'start' })); assert.equal(r.started, true);
  r.message(hm, JSON.stringify({ t: 'state', d: '{"s":1}' }));
  gs.forEach(([c]) => assert.equal(last(c, 'state').d, '{"s":1}'));
  assert.equal(h.out.filter(m => m.t === 'state').length, 0);                                                             // 호스트에게는 안 돌려보냄
  r.message(gs[1][1], JSON.stringify({ t: 'act', d: { data: { ask: 'roll' } } }));
  assert.deepEqual(last(h, 'act'), { t: 'act', seat: 2, d: { data: { ask: 'roll' } } });
  r.message(hm, JSON.stringify({ t: 'act', d: {} })); assert.equal(h.out.filter(m => m.t === 'act').length, 1);           // 호스트의 act는 무시
  r.leave(gs[0][1], gs[0][0]); assert.equal(last(h, 'roster').members.find(m => m.seat === 1).online, false);
  const late = mk(); assert.equal(r.join(late, { role: 'guest', name: 'n', tok: 'new', lv: 'level3' }), null);            // 시작 후 새 사람 불가
  const back = mk(), bm = r.join(back, { role: 'guest', name: 'p1', tok: 't1', lv: 'level3' });                           // 같은 토큰 → 같은 자리
  assert.equal(bm.seat, 1); assert.equal(last(back, 'state').d, '{"s":1}');
  console.log('mp-room: seats, lock, level check, relay, reconnect PASS');
})().catch(e => { console.error(e); process.exit(1); });
