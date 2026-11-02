const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

/* choice-chain.js: 선택 → 결과 체인 공용 모듈 (Level 1~4, Beginning 1~4 모두 같은 모듈 한 개) */
const js = fs.readFileSync('choice-chain.js', 'utf8');
new vm.Script(js);
assert(js.includes("window.CC={"));
assert(js.includes('function installL1()') && js.includes('function installL2()') && js.includes('function installL34('));

for (const f of ['level1', 'level2', 'level3', 'level4', 'beginning-level1', 'beginning-level2', 'beginning-level3', 'beginning-level4']) {
  const html = fs.readFileSync(`${f}.html`, 'utf8');
  for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(m[1]);
  assert.equal((html.match(/choice-chain\.js\?v=\d+/g) || []).length, 1, `${f}: one choice-chain.js tag`);
  console.log(`${f} PASS`);
}
console.log('choice-chain contract PASS');
