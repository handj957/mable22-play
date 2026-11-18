/* 실제 멀티플레이 서버 점검 (배포 후)
 *   node tests/mp-live.mjs https://mable22-mp.handj957.workers.dev
 * 1) /health  2) 빠른 매칭 표 2장이 같은 방인지  3) 2명이 접속해 '지금 시작' → 자동 시작·호스트 지정  4) 상태 전달
 */
import WebSocket from 'ws';
const BASE = (process.argv[2] || '').replace(/\/+$/, '');
const ORIGIN = process.argv[3] || 'https://handj957.github.io';
const LV = 'live-check';
const ok = (m) => console.log('✅ ' + m), fail = (m) => { console.log('❌ ' + m); process.exit(1); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

const h = await fetch(BASE + '/health').then(r => r.text()).catch(e => 'ERR ' + e.message);
h.includes('mable22-mp ok') ? ok('서버 응답: ' + h.trim()) : fail('서버 응답 이상: ' + h);

const t1 = await (await fetch(`${BASE}/match?lv=${LV}`, { headers: { Origin: ORIGIN } })).json();
const t2 = await (await fetch(`${BASE}/match?lv=${LV}`, { headers: { Origin: ORIGIN } })).json();
t1.code && t1.code === t2.code ? ok('빠른 매칭: 같은 방 코드 ' + t1.code) : fail('매칭 표 이상 ' + JSON.stringify([t1, t2]));

function join(name) {
  const tok = name + Date.now() + Math.random().toString(36).slice(2);
  const url = `${BASE.replace(/^http/, 'ws')}/room/${t1.code}?role=guest&pub=1&lv=${LV}&name=${encodeURIComponent(name)}&tok=${tok}`;
  const ws = new WebSocket(url, { headers: { Origin: ORIGIN } });
  const c = { ws, msgs: [], last: t => [...c.msgs].reverse().find(m => m.t === t) };
  ws.on('message', d => c.msgs.push(JSON.parse(d.toString())));
  return new Promise((res, rej) => { ws.on('open', () => res(c)); ws.on('error', rej); });
}
const a = await join('점검A'); await wait(800);
const b = await join('점검B'); await wait(1200);
a.last('welcome')?.pub ? ok('매칭 방 입장 (호스트 없이 대기)') : fail('입장 실패 ' + JSON.stringify(a.msgs));
const r = b.last('roster');
r && r.members.length === 2 && r.startIn > 0 ? ok(`2명 모임 · ${Math.round(r.startIn / 1000)}초 뒤 자동 시작 예정`) : fail('대기 명단 이상 ' + JSON.stringify(r));
a.ws.send(JSON.stringify({ t: 'go' })); await wait(1500);
const wa = a.last('welcome'), wb = b.last('welcome');
wa?.go && wb?.go && wa.host !== wb.host ? ok(`'지금 시작' → 시작, 호스트 = ${wa.host ? '점검A' : '점검B'}`) : fail('시작 실패 ' + JSON.stringify([wa, wb]));
const [host, guest] = wa.host ? [a, b] : [b, a];
host.ws.send(JSON.stringify({ t: 'state', d: '{"live":1}' })); await wait(1000);
guest.last('state')?.d === '{"live":1}' ? ok('게임 상태 전달 (호스트 → 참가자)') : fail('상태 전달 실패');
a.ws.close(); b.ws.close();
console.log('🎉 실제 서버 점검 통과');
process.exit(0);
