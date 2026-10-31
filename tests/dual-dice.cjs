const fs=require('fs'),vm=require('vm'),assert=require('assert');
vm.runInThisContext(fs.readFileSync('dual-dice.js','utf8'));
let s={dv:{move:4,mil:8},hot:'mil'};
assert.deepEqual(DualDice.state(s).move,{value:4,kind:'move'});
assert.equal(DualDice.state(s).judge.value,8);
for(const k of Object.keys(DualDice.domains)){
 let calls=0,old=JSON.stringify(DualDice.state(s)[k==='move'?'judge':'move']);
 assert.equal(DualDice.roll(s,k,()=>{calls++;return 0}),1);assert.equal(calls,1);
 assert.equal(DualDice.roll(s,k,()=>1-Number.EPSILON),12);
 assert.equal(JSON.stringify(s.dicePair[k==='move'?'judge':'move']),old);
}
assert.throws(()=>DualDice.channel('unknown'));
assert.equal(DualDice.roll(s,undefined,()=>.5),7);
let copy=JSON.parse(JSON.stringify(s));assert.deepEqual(DualDice.state(copy),s.dicePair);
let counts=Array(12).fill(0);for(let i=0;i<12000;i++)counts[DualDice.roll(null,'move',()=>(i+.5)/12000)-1]++;assert(counts.every(n=>n===1000));
for(const prefix of ['','edu-'])for(const n of [3,4]){
 const file=prefix+'level'+n+'.html',html=fs.readFileSync(file,'utf8');
 for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(m[1]);
 assert(html.includes('function d12(kind){return DualDice.roll(S,kind||\'world\')}'));
 assert.equal((html.match(/const v=d12\(k\);S.dv\[k\]=v;/g)||[]).length,2);
 assert(html.includes("const mv=await rollA('move');"));
 assert(html.includes('await moveSteps(p,mv);await land(p,mv);'));
 assert(html.includes('if(mv===12){extra++;if(extra===3)'));
 assert((html.match(/dualDiceHTML\(dk\)/g)||[]).length>=4);if(prefix)assert(html.includes('dualDiceHTML(k)'));
 else assert(!html.slice(html.indexOf('function renderHStage(){'),html.indexOf('const _topH=renderTop;')).includes('dualDiceHTML('));
 assert(html.includes('dual-dice.js?v=1'));assert(/dual-dice\.css\?v=\d+/.test(html));
 console.log(file+' syntax and route contract PASS');
}
console.log('Single draw, boundaries, uniform distribution, channel isolation, migration, persistence PASS');

