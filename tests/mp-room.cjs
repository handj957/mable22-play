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

  /* 빠른 매칭: 대기열 표 나눠 주기 */
  const { MatchCore, MATCH_WINDOW } = await import('../server/src/room-core.js');
  const q = new MatchCore(); const c1 = q.ticket('', 0);
  assert.equal(q.ticket('', 1000), c1); assert.equal(q.ticket('', 2000), c1); assert.equal(q.ticket('', 3000), c1);
  assert.notEqual(q.ticket('', 4000), c1);                                             // 5번째는 새 방
  const c3 = q.open.code; assert.notEqual(q.ticket('', 4000 + MATCH_WINDOW + 1), c3); // 시간이 지나면 새 방
  const c4 = q.open.code; assert.notEqual(q.ticket(c4, 4000 + MATCH_WINDOW + 2), c4); // 시작한 방은 건너뜀

  /* 매칭 방: 호스트 없이 대기 → 자동 시작 → 자리 정리 */
  let pending = []; const timers = { set: (f, ms) => { const x = { f, ms }; pending.push(x); return x; }, clear: x => { pending = pending.filter(y => y !== x); } };
  const pr = new RoomCore('PUBX', timers);
  const a1 = mk(), m1 = pr.join(a1, { role: 'guest', name: 'A', tok: 'a', lv: 'level2', pub: '1' });
  assert.equal(pr.pub, true); assert.equal(m1.host, false); assert.equal(pending.length, 0);           // 혼자면 대기
  const wrongLv = mk(); assert.equal(pr.join(wrongLv, { role: 'guest', name: 'W', tok: 'w', lv: 'level3', pub: '1' }), null);
  const a2 = mk(), m2 = pr.join(a2, { role: 'guest', name: 'B', tok: 'b', lv: 'level2', pub: '1' });
  assert.equal(pending.length, 1); assert.ok(last(a2, 'roster').startIn > 10000);                       // 2명 → 15초 카운트다운
  const a3 = mk(), m3 = pr.join(a3, { role: 'guest', name: 'C', tok: 'c', lv: 'level2', pub: '1' });
  pr.leave(m1, a1);                                                                                    // 0번 자리 사람이 대기 중 나감
  assert.equal(pr.members.size, 2);
  const a4 = mk(); pr.join(a4, { role: 'guest', name: 'D', tok: 'd', lv: 'level2', pub: '1' });
  const a5 = mk(); pr.join(a5, { role: 'guest', name: 'E', tok: 'e', lv: 'level2', pub: '1' });
  assert.equal(pr.online().length, 4); assert.ok(pending.some(x => x.ms <= 3000));                    // 4명 → 3초
  pending.slice().forEach(x => x.f());
  assert.equal(pr.started, true);
  const seats = pr.roster().map(r => r.seat + ':' + r.name + (r.host ? '*' : '')); assert.deepEqual(seats, ['0:D*', '1:B', '2:C', '3:E']);
  assert.equal(last(a4, 'welcome').host, true); assert.equal(last(a4, 'welcome').go, true); assert.equal(last(a2, 'welcome').seat, 1);
  const late2 = mk(); assert.equal(pr.join(late2, { role: 'guest', name: 'L', tok: 'l', lv: 'level2', pub: '1' }), null);
  pr.message(pr.members.get('d'), JSON.stringify({ t: 'state', d: 'S' })); assert.equal(last(a3, 'state').d, 'S');
  /* '지금 시작': 2명이면 바로 */
  const pr2 = new RoomCore('PUBY', timers); const b1 = mk(), n1 = pr2.join(b1, { role: 'guest', name: 'X', tok: 'x', lv: 'l', pub: '1' });
  pr2.message(n1, JSON.stringify({ t: 'go' })); assert.equal(pr2.started, false);                     // 혼자서는 시작 안 됨
  const b2 = mk(); pr2.join(b2, { role: 'guest', name: 'Y', tok: 'y', lv: 'l', pub: '1' });
  pr2.message(n1, JSON.stringify({ t: 'go' })); assert.equal(pr2.started, true); assert.equal(last(b1, 'welcome').host, true);
  console.log('mp-room: quick match queue, public room countdown, compaction, go-now PASS');
})().catch(e => { console.error(e); process.exit(1); });
