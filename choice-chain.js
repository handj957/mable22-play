/* choice-chain.js v1 — "선택 → 결과 체인" 공용 모듈
   Level 1·2·3 / Beginning 1·2·3 공용. (Level 4는 자체 v34 리본을 그대로 사용)
   내가 선택을 고르면(또는 AI 차례가 끝나면) 보드 가운데 하단에
   "선택: 호텔 → 건물 3 ▲1 → 외교력 35 ▲2 → 승리 진행 43% ▲5% → 순자산 ₵1,755 ▲₵120"
   처럼 바뀐 지표만 차례로 나타나고 숫자가 올라가거나 내려간다.
   - 초록 칩 = 좋아진 지표, 빨강 칩 = 나빠진 지표
   - 터치를 막지 않음(pointer-events:none) · 속도 '빠름'/동작 줄이기에서는 애니메이션 없이 바로 표시 */
(function(){
'use strict';
if(window.CC)return;

/* ───────── 스타일 (테마와 무관하게 읽히는 밝은 리본) ───────── */
const css=`
.ccrib{position:fixed;z-index:60;display:flex;flex-wrap:wrap;align-items:center;gap:4px 5px;box-sizing:border-box;padding:6px 9px;border-radius:14px;
 background:#fffdf6;color:#2a2438;border:2px solid var(--rc,#e8a33a);box-shadow:0 8px 22px rgba(0,0,0,.35),0 0 14px color-mix(in srgb,var(--rc,#e8a33a) 35%,transparent);
 font:700 clamp(10px,1.45vw,13px)/1.25 var(--f-body,system-ui,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif);pointer-events:none;
 animation:ccin .3s ease-out;transition:opacity .5s;max-width:calc(100vw - 12px)}
.ccrib.out{opacity:0}
.ccrib .why{display:inline-flex;align-items:center;gap:5px;font-weight:800;color:color-mix(in srgb,var(--rc,#e8a33a) 78%,#000);max-width:100%}
.ccrib .why i{width:8px;height:8px;border-radius:50%;background:var(--rc,#e8a33a);flex:none}
.ccrib .ar{opacity:.55;font-weight:800}
.ccrib .c{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:999px;white-space:nowrap;background:#e8f8ee;color:#176b3a;border:1.5px solid #3fbf72;
 opacity:0;transform:translateY(5px) scale(.88);transition:opacity .25s,transform .25s}
.ccrib .c.b{background:#fdeceb;color:#a02727;border-color:#e46a6a}
.ccrib .c.n{background:#eef2fb;color:#2c4a8a;border-color:#7c97d6}
.ccrib .c.on{opacity:1;transform:none}
.ccrib .c small{font-size:.92em;font-weight:800}
.ccrib.still .c,.ccrib.still{animation:none;transition:none}
@keyframes ccin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
`;
const st=document.createElement('style');st.id='ccstyle';st.textContent=css;document.head.appendChild(st);

/* ───────── 엔진 ───────── */
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const RM=matchMedia('(prefers-reduced-motion: reduce)');
const Q={rq:[],busy:false,pend:null,timer:0};
let A=null;                                   // 현재 레벨 어댑터

/* KO/EN: 영어 모드면 고정 문구는 표로, 그 밖의 글자는 i18n.js 의 M22I18N.t() 로 번역 */
const EN_MAP={'위치':'Position','현금':'Cash','국채':'Bonds','대출':'Loans','땅':'Land','도시':'Cities','건물':'Buildings','기업':'Firms','교육':'Education',
 '지지율':'Approval','혼란':'Unrest','외교력':'Diplomacy','군사력':'Military','기술':'Tech','문화':'Culture','인구':'Population','승리 진행':'Victory','순자산':'Net worth',
 '선택:':'Choice:','도착':'arrive','차례 결과':'turn result'};
const isEn=()=>!!(window.M22I18N&&window.M22I18N.lang==='en');
const L=k=>isEn()&&EN_MAP[k]?EN_MAP[k]:k;
const T=k=>{try{return isEn()&&window.M22I18N.t?window.M22I18N.t(String(k)):k}catch(e){return k}};
function whyText(w){
  if(w.indexOf('선택: ')===0)return L('선택:')+' '+T(w.slice(4));
  const m=/^(.*)\s차례 결과$/.exec(w);
  if(m)return T(m[1])+' '+L('차례 결과');
  return T(w);
}
const money=x=>typeof won==='function'?won(x):'₵'+Math.round(x).toLocaleString('ko-KR');
const fmt=(x,m,u)=>m?money(x):x+(u||'');

/* 스냅샷 두 장의 차이 → 칩 목록 */
function diff(a,b){
  const out=[];
  A.metrics.forEach(([k,e,n,m,sgn,unit])=>{
    if(a[k]==null||b[k]==null)return;
    const d=b[k]-a[k];if(!d)return;
    if(k==='pos'){out.push({e,cell:A.cellName(b.pos),cls:'n'});return}
    if(m&&Math.abs(d)<5)return;                       // 잔돈 변화는 생략
    out.push({e,n,from:a[k],to:b[k],d,money:!!m,unit:unit||'',cls:(sgn||1)*d>0?'g':'b',key:k});
  });
  /* 칩이 7개를 넘으면 마지막(순자산)은 꼭 남긴다 */
  if(out.length>7)return out.slice(0,6).concat(out[out.length-1]);
  return out;
}

function enqueue(p,why,list){
  if(!list.length||!A)return;
  Q.rq.push({p,why,list});
  if(Q.rq.length>3)Q.rq.splice(0,Q.rq.length-3);
  if(!Q.busy)run();
}
async function run(){
  Q.busy=true;
  while(Q.rq.length){const r=Q.rq.shift();try{await show(r)}catch(e){}}
  Q.busy=false;
}

function show({p,why,list}){
  return new Promise(res=>{
    const ce=A&&A.center();
    if(!ce){res();return}
    const r=ce.getBoundingClientRect();
    if(r.width<120||r.height<50){res();return}
    const el=document.createElement('div');
    const mo=A.motion()&&!RM.matches;
    el.className='ccrib'+(mo?'':' still');
    el.style.setProperty('--rc',A.color(p));
    el.style.left=Math.max(4,Math.round(r.left+6))+'px';
    el.style.width=Math.round(Math.min(r.width-12,innerWidth-8))+'px';
    el.style.bottom=Math.max(6,Math.round(innerHeight-r.bottom+8))+'px';
    el.innerHTML=`<span class="why"><i></i>${esc(whyText(why))}</span>`+list.map(c=>
      `<span class="ar">→</span><span class="c ${c.cls}">${c.e} `+
      (c.cell!=null?esc(T(c.cell)+' '+L('도착')):`${esc(L(c.n))} <b data-f="${c.from}" data-t="${c.to}" data-m="${c.money?1:0}" data-u="${c.unit}">${fmt(c.from,c.money,c.unit)}</b> <small>${c.d>0?'▲':'▼'}${c.money?money(Math.abs(c.d)):Math.abs(c.d)+c.unit}</small>`)+`</span>`).join('');
    document.body.appendChild(el);
    const chips=[...el.querySelectorAll('.c')];
    const slow=A.slow&&A.slow();
    const gap=mo?(p.human?330:200)*(slow?1.5:1):0;
    chips.forEach((c,k)=>setTimeout(()=>{
      c.classList.add('on');
      const b=c.querySelector('b[data-f]');
      if(!b)return;
      const f=+b.dataset.f,t=+b.dataset.t,m=b.dataset.m==='1',u=b.dataset.u;
      if(!mo){b.textContent=fmt(t,m,u);return}
      const t0=performance.now();
      const step=now=>{const q=Math.min(1,(now-t0)/420);b.textContent=fmt(Math.round(f+(t-f)*q),m,u);if(q<1)requestAnimationFrame(step)};
      requestAnimationFrame(step);
    },k*gap));
    const hold=((p.human?3200:2000)+chips.length*gap)*(slow?1.4:1);
    setTimeout(()=>{el.classList.add('out');setTimeout(()=>{el.remove();res()},450)},hold);
  });
}

/* 사람이 고른 선택 → 잠시 뒤(또는 다음 선택 직전에) 결과 리본 */
function flush(){
  clearTimeout(Q.timer);
  const P=Q.pend;Q.pend=null;
  if(!P||!A)return;
  try{
    if(P.g!==A.state())return;                         // 새 게임이면 버림
    const now=A.snap(P.p),d=diff(P.s,now);
    if(d.length)enqueue(P.p,P.label,d);
  }catch(e){}
}
function pend(p,label,s,wait){
  flush();
  Q.pend={p,label,s,g:A.state()};
  Q.timer=setTimeout(flush,wait||2400);
}
const plain=h=>String(h||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().slice(0,28);

/* AI 차례 결과 */
function aiResult(p,s){
  try{
    if(!A||A.over())return;
    const d=diff(s,A.snap(p));
    if(d.length)enqueue(p,`${A.emoji(p)} ${p.name} 차례 결과`,d);
  }catch(e){}
}

/* ───────── 레벨별 어댑터 ───────── */
const skipId=id=>['ok','x','n','no','close'].includes(String(id));

/* Level 1 (부자되기) */
function installL1(){
  /* 승리 진행: 구역 독점 2개가 목표 → 가장 가까운 두 구역의 점유율 평균 */
  const winPct=p=>{try{const fr=Object.keys(DIST).map(d=>{const n=CELLS.filter(c=>c.t==='land'&&c.d===d).length;return n?landOf(p,d)/n:0}).sort((a,b)=>b-a);return Math.round(((fr[0]||0)+(fr[1]||0))/2*100)}catch(e){return 0}};
  A={
    name:'L1',
    state:()=>S,
    center:()=>document.querySelector('#board .center'),
    color:p=>p.color,emoji:p=>p.emoji||'🧑‍💼',
    motion:()=>typeof fxOn==='function'?fxOn():true,
    slow:()=>S&&S.speed==='slow',
    over:()=>!S||S.over,
    cellName:i=>CELLS[i].short||CELLS[i].name,
    snap:p=>({pos:p.pos,cash:Math.round(p.cash),debt:Math.round(p.debt||0),land:landOf(p),bld:bldOf(p),
      co:Object.values(p.comp||{}).reduce((a,l)=>a+l,0),edu:p.edu||0,win:winPct(p),nw:Math.round(netWorth(p))}),
    metrics:[['pos','📍','위치'],['cash','💰','현금',1],['debt','📄','대출',1,-1],['land','🏞️','땅'],['bld','🏗️','건물'],
      ['co','🏭','기업'],['edu','🎓','교육'],['win','🏆','승리 진행',0,1,'%'],['nw','🏁','순자산',1]]
  };
  const _ask=ask;
  ask=function(prompt,opts){
    flush();
    const p=S?cur():null;
    return _ask(prompt,opts).then(id=>{
      const o=(opts||[]).find(x=>String(x.id)===String(id));
      if(p&&p.human&&o&&!skipId(id))pend(p,'선택: '+plain(o.l),A.snap(p));
      return id;
    });
  };
  const _pt=playTurn;
  playTurn=async function(p){
    const ai=p&&!p.human,s=ai?A.snap(p):null;
    const r=await _pt(p);
    if(ai)aiResult(p,s);else if(p&&p.human)flush();
    return r;
  };
}

/* Level 2 (도시정책) */
function installL2(){
  A={
    name:'L2',
    state:()=>G,
    center:()=>document.querySelector('#center'),
    color:p=>p.col,emoji:p=>p.sym||'🙂',
    motion:()=>!window.__FAST&&(typeof OPT==='undefined'||OPT.speed!=='fast'),
    slow:()=>typeof OPT!=='undefined'&&OPT.speed==='slow',
    over:()=>!G||G.phase==='over',
    cellName:i=>CELLS[i].sn||CELLS[i].name,
    snap:p=>({pos:p.pos,cash:Math.round(p.cash),loans:Math.round(p.loans||0),city:ownedBy(p.id).length,
      lv:ownedBy(p.id).reduce((a,c)=>a+(G.cells[c.i].l||0),0),co:(p.comps||[]).length,
      support:p.support,unrest:p.unrest,culture:p.culture,pop:p.pop,edu:p.edu,nw:Math.round(worth(p))}),
    metrics:[['pos','📍','위치'],['cash','💰','현금',1],['loans','📄','대출',1,-1],['city','🏙️','땅'],['lv','🏗️','건물'],['co','🏭','기업'],
      ['support','🙂','지지율'],['unrest','🔥','혼란',0,-1],['culture','🎭','문화'],['pop','👥','인구'],['edu','🎓','교육'],['nw','🏁','순자산',1]]
  };
  const _pick=pick;
  pick=function(i){
    const p=G&&G.players?cur():null;
    const ch=G&&G.choices?G.choices[i]:null;
    const s=p&&ch&&p.human?A.snap(p):null;
    const label=ch?plain(ch.label):'';
    const r=_pick(i);
    if(s&&label&&!ch.pass)pend(p,'선택: '+label,s,1800);
    return r;
  };
  const _ai=aiTurn;
  aiTurn=async function(p){const s=A.snap(p);const r=await _ai(p);aiResult(p,s);return r};
  const _et=endTurn;
  endTurn=function(){flush();return _et()};
}

/* Level 3 (나라정책) */
function installL3(){
  A={
    name:'L3',
    state:()=>S,
    center:()=>document.querySelector('#board .center'),
    color:p=>p.color,emoji:p=>typeof pemo==='function'?pemo(p):'🙂',
    motion:()=>!S||S.speed!=='fast',
    slow:()=>S&&S.speed==='slow',
    over:()=>!S||S.over,
    cellName:i=>CELLS[i].short||CELLS[i].name,
    snap:p=>({pos:p.pos,cash:Math.round(p.cash),debt:Math.round(p.debt||0),city:ownedCities(p).length,lv:levelsOf(p),
      ap:p.ap,un:p.un,dp:typeof dpOf==='function'?dpOf(p):0,M:p.M,edu:p.edu,tech:(p.qt||0)+(p.sky||0)+(p.term||0),nw:Math.round(netWorth(p))}),
    metrics:[['pos','📍','위치'],['cash','💰','현금',1],['debt','📄','국채',1,-1],['city','🏙️','도시'],['lv','🏗️','건물'],['ap','🙂','지지율'],
      ['un','🔥','혼란',0,-1],['dp','🕊️','외교력'],['M','🛡️','군사력'],['edu','🎓','교육'],['tech','🔬','기술'],['nw','🏁','순자산',1]]
  };
  const _ask=ask;
  ask=function(prompt,opts,pv){
    flush();
    const p=S?cur():null;
    return _ask(prompt,opts,pv).then(id=>{
      const o=(opts||[]).find(x=>String(x.id)===String(id));
      if(p&&p.human&&o&&!skipId(id))pend(p,'선택: '+plain(o.l),A.snap(p));
      return id;
    });
  };
  const _tt=takeTurn;
  takeTurn=async function(p){
    const ai=p&&!p.human,s=ai?A.snap(p):null;
    const r=await _tt(p);
    if(ai&&S&&!S.over)aiResult(p,s);else if(p&&p.human)flush();
    return r;
  };
}

/* ───────── 설치: 어떤 레벨인지 함수 모양으로 판별 ───────── */
function install(){
  try{
    if(typeof v34Rib==='function')return;                                   // Level 4 — 자체 리본 사용
    if(typeof pick==='function'&&typeof fxDiff==='function'&&typeof aiTurn==='function')installL2();
    else if(typeof takeTurn==='function'&&typeof dpOf==='function')installL3();
    else if(typeof playTurn==='function'&&typeof fxChain==='function')installL1();
  }catch(e){console.warn('choice-chain: 설치 실패',e)}
}
window.CC={flush,install,_A:()=>A,reset(){Q.rq.length=0;Q.pend=null;clearTimeout(Q.timer);document.querySelectorAll('.ccrib').forEach(e=>e.remove())}};
install();
})();
