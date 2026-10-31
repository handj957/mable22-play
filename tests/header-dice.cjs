const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

for (const level of [3, 4]) {
  const html = fs.readFileSync(`level${level}.html`, 'utf8');
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(match[1]);
  const start = html.indexOf('function renderHStage(){');
  const end = html.indexOf('const _topH=renderTop;', start);
  assert(start >= 0 && end > start);
  for (const mode of ['ready', 'asking', 'moving', 'arrived', 'ai', 'bankrupt']) {
    const nodes = {};
    const node = () => ({style: {setProperty() {}}, dataset: {}, classList: {toggle() {}}, querySelector() {return null;}});
    for (const selector of ['#hstage', '.hdr', '#hwho', '#hstrip']) nodes[selector] = node();
    const p = {id: 0, pos: 0, name: '<Player>', human: mode !== 'ai', color: '#f00', bankrupt: mode === 'bankrupt'};
    const S = {players: [p], round: 1, maxRounds: 30, props: {}, ask: mode === 'asking', dicePair: {move: {value: 9}, judge: {value: 4}}, dv: {move: 9, world: 4}, _rollK: 'world', _rollT: Date.now()};
    if (mode === 'moving' || mode === 'arrived') S._mv = {id: 0, from: 0, n: 9, t: Date.now(), end: mode === 'arrived' ? Date.now() : null};
    const before = JSON.stringify(S);
    const context = {S, cur: () => p, $: selector => nodes[selector] || null, N: 64,
      CELLS: Array.from({length: 64}, () => ({name: 'City', short: 'City'})), cellIcon: () => 'X',
      esc: value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
      DualDice: {roll() {throw Error('Header must never roll dice');}},
      dualDiceHTML() {throw Error('Header must never render dice');}};
    vm.runInNewContext(html.slice(start, end) + '\nrenderHStage();', context);
    assert(!nodes['#hwho'].innerHTML.includes('dual-dice'));
    assert(!nodes['#hwho'].innerHTML.includes('주사위'));
    assert(nodes['#hwho'].innerHTML.includes('&lt;Player&gt;'));
    assert.equal(JSON.stringify(S), before, 'Rendering must not mutate dice or gameplay state');
  }
  assert((html.match(/dualDiceHTML\(dk\)/g) || []).length >= 4, 'Board action renderers keep their dice');
  console.log(`Level ${level}: script syntax and six header states PASS`);
}
