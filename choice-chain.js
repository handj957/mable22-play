/* choice-chain.js v2 — "주사위 → 칸 → 실제 결과" 턴 체인 (공용 모듈)
   Level 1·2·3·4 / Beginning 1·2·3·4 공용.
   한 턴 동안 실제로 일어난 일을 순서대로 기록해 보드 가운데 하단에 보여 준다.
     원인  : 🎲 이동 7 → 📍 도쿄 도착
     결과  : 그 칸에서 실제 일어난 일(통행료·매입·이벤트·카드·정책 선택 …)
     지표  : 바뀐 지표 전부(좋아진 것 초록, 나빠진 것 빨강, 순자산은 바뀐 경우에만 자연스러운 위치에)
   - v1과 달리 '순자산'을 마지막에 억지로 남기지 않는다.
   - 바뀐 게 없으면 "변화 없음"을 그대로 보여 준다.
   - 터치를 막지 않음(pointer-events:none) · 속도 '빠름'/동작 줄이기에서는 애니메이션 없이 바로 표시 */
(function(){
'use strict';
if(window.CC&&window.CC.v>=2)return;

/* ───────── 스타일 (테마와 무관하게 읽히는 밝은 리본) ───────── */
const css=`
.ccrib{position:fixed;z-index:60;display:flex;flex-direction:column;gap:3px;box-sizing:border-box;padding:6px 9px;border-radius:14px;overflow:hidden;
 background:#fffdf6;color:#2a2438;border:2px solid var(--rc,#e8a33a);box-shadow:0 8px 22px rgba(0,0,0,.35),0 0 14px color-mix(in srgb,var(--rc,#e8a33a) 35%,transparent);
 font:700 clamp(10px,1.45vw,13px)/1.25 var(--f-body,system-ui,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif);pointer-events:none;
 animation:ccin .3s ease-out;transition:opacity .5s;max-width:calc(100vw - 12px)}
.ccrib.out{opacity:0}
.ccrib .why{display:flex;align-items:center;gap:5px;font-weight:800;color:color-mix(in srgb,var(--rc,#e8a33a) 78%,#000);max-width:100%}
.ccrib .why i{width:8px;height:8px;border-radius:50%;background:var(--rc,#e8a33a);flex:none}
.ccrib .rw{display:flex;flex-wrap:wrap;align-items:center;gap:3px 5px}
.ccrib .lb{font-size:.84em;font-weight:800;color:#7a7390;min-width:3.2em}
.ccrib .ar{opacity:0;font-weight:800;transition:opacity .25s}
.ccrib .ar.on{opacity:.55}
.ccrib.still .ar{opacity:.55;transition:none}
.ccrib .c{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:999px;white-space:nowrap;background:#e8f8ee;color:#176b3a;border:1.5px solid #3fbf72;
 max-width:100%;overflow:hidden;text-overflow:ellipsis;opacity:0;transform:translateY(5px) scale(.88);transition:opacity .25s,transform .25s}
.ccrib .c.b{background:#fdeceb;color:#a02727;border-color:#e46a6a}
.ccrib .c.n{background:#eef2fb;color:#2c4a8a;border-color:#7c97d6}
.ccrib .c.on{opacity:1;transform:none}
.ccrib .c small{font-size:.92em;font-weight:800}
.ccrib.still .c,.ccrib.still{animation:none;transition:none}
@keyframes ccin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
`;
const st=document.createElement('style');st.id='ccstyle';st.textContent=css;document.head.appendChild(st);

/* ───────── 공통 도구 ───────── */
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const RM=matchMedia('(prefers-reduced-motion: reduce)');
const Q={rq:[],busy:false};
let A=null;                                   // 현재 레벨 어댑터
const Tr={on:false,mute:0,steps:[],s0:null,p:null,n0:null,inSay:false,inRoll:false};

/* KO/EN: 영어 모드면 고정 문구는 표로, 그 밖의 글자는 i18n.js 의 M22I18N.t() 로 번역 */
const EN_MAP={'위치':'Position','현금':'Cash','국채':'Bonds','대출':'Loans','땅':'Land','도시':'Cities','건물':'Buildings','기업':'Firms','교육':'Education',
 '지지율':'Approval','혼란':'Unrest','외교력':'Diplomacy','군사력':'Military','기술':'Tech','문화':'Culture','인구':'Population','승리 진행':'Victory','순자산':'Net worth',
 '선택:':'Choice:','도착':'arrive','차례 결과':'turn result','원인':'Cause','일어난 일':'Result','지표':'Stats','변화 없음':'No change','외':'+',
 '이동':'Move','경제':'Economy','군사':'Military','외교':'Diplomacy','자원':'Resources','정치':'Politics','세계':'World','사회':'Society'};
const isEn=()=>!!(window.M22I18N&&window.M22I18N.lang==='en');
const L=k=>isEn()&&EN_MAP[k]?EN_MAP[k]:k;
const T=k=>{try{return isEn()&&window.M22I18N.t?window.M22I18N.t(String(k)):k}catch(e){return k}};
function whyText(w){
  const m=/^(.*)\s차례 결과$/.exec(w);
  if(m)return T(m[1])+' '+L('차례 결과');
  return T(w);
}
const money=x=>typeof won==='function'?won(x):'₵'+Math.round(x).toLocaleString('ko-KR');
const fmt=(x,m,u)=>m?money(x):x+(u||'');
const plain=h=>String(h==null?'':h).replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
const cut=(s,n)=>s.length>n?s.slice(0,n-1)+'…':s;
const DLAB={move:'이동',mv:'이동',mil:'군사',dip:'외교',econ:'경제',eco:'경제',res:'자원',pol:'정치',world:'세계',so:'사회',re:'부동산',rd:'결과'};

/* 문장 → 색(좋음/나쁨/중립). 지표 칩은 숫자로 정확히 색이 정해지므로 이건 글줄 칩에만 쓴다 */
const GOOD=/[+＋▲]|성공|획득|수령|매입|건설|인수|승리|증가|상승|개발|완성|협정|확대|회복|호황/;
const BAD=/[−▼]|실패|파산|납부|지불|제재|피해|하락|감소|억류|부도|패배|발각|봉쇄|위기|불황|재난|파괴/;
function tone(t){const g=GOOD.test(t),b=BAD.test(t);return g&&!b?'g':b&&!g?'b':'n'}

/* 행동한 지도자 이름이 줄 맨 앞에 붙어 있으면 떼어 짧게 */
function clean(h){
  let t=plain(h);if(!t)return'';
  const nm=Tr.p&&Tr.p.name;
  if(nm){const k=t.indexOf(nm);if(k>=0&&k<=8)t=(t.slice(0,k)+t.slice(k+nm.length)).replace(/^\s+/,'').replace(/^[‍️]+/,'')}
  return cut(t,34);
}

/* ───────── 턴 기록 ───────── */
function begin(p){
  if(!A||!p)return;
  try{Tr.on=true;Tr.p=p;Tr.steps=[];Tr.s0=A.snap(p);Tr.n0=A.news?A.news():null}catch(e){Tr.on=false}
}
function rec(row,o){
  if(!Tr.on||Tr.mute)return;
  Tr.steps.push(Object.assign({row},o));
}
const recDice=(k,v)=>rec('cause',{e:'🎲',k:DLAB[k]||String(k),v,cls:'n'});
const recArrive=(i)=>{try{rec('cause',{e:'📍',cell:A.cellName(i),cls:'n'})}catch(e){}};
const recText=(t,e)=>{t=clean(t);if(t)rec('effect',{e:e||'',text:t,cls:tone(t)})};

/* 로그/한 줄 요약(say)을 가로채 '실제 일어난 일'로 기록 */
function hookLog(skipSay){
  if(typeof log!=='function')return;
  const _l=log;
  log=function(h){
    try{if(Tr.on&&!Tr.mute&&!(skipSay&&Tr.inSay))recText(h)}catch(e){}
    return _l.apply(this,arguments);
  };
}
/* 라운드 결산은 이번 턴의 결과가 아니므로 기록에서 제외 */
function muteFn(name){
  const f=window[name];
  if(typeof f!=='function')return;
  /* 결산이 끝나면 '이번 턴 시작 상태'를 다시 잡아, 결산 때문에 바뀐 지표가 이번 턴 결과로 섞이지 않게 한다 */
  const done=()=>{Tr.mute--;if(Tr.on&&!Tr.mute&&A&&Tr.p){try{Tr.s0=A.snap(Tr.p);Tr.n0=A.news?A.news():null;Tr.steps=[]}catch(e){}}};
  window[name]=function(){
    Tr.mute++;let r;
    try{r=f.apply(this,arguments)}catch(e){done();throw e}
    if(r&&typeof r.then==='function')return r.finally(done);
    done();return r;
  };
}

/* 스냅샷 두 장의 차이 → 지표 칩 (순자산을 억지로 말미에 붙이지 않음) */
function diffStats(a,b){
  const out=[];
  A.metrics.forEach(([k,e,n,m,sgn,unit])=>{
    if(k==='pos'||a[k]==null||b[k]==null)return;
    const d=b[k]-a[k];if(!d)return;
    if(m&&Math.abs(d)<5)return;                       // 잔돈 변화는 생략
    out.push({e,n,from:a[k],to:b[k],d,money:!!m,unit:unit||'',cls:(sgn||1)*d>0?'g':'b'});
  });
  return out;
}
const norm=s=>String(s).replace(/[^가-힣A-Za-z]/g,'');   // 글자만 남겨 비교(숫자·기호·이모지 제외)
function newsLines(){
  try{
    const n=A.news&&A.news();if(!n||n===Tr.n0||!Array.isArray(n.chain))return[];
    return n.chain.map(x=>Array.isArray(x)?x[0]:x).map(t=>clean(t)).filter(t=>t&&!/^🎲/.test(t)).map(t=>({row:'effect',e:'',text:t,cls:tone(t)}));
  }catch(e){return[]}
}
const recChoice=label=>{const t=plain(label);if(t)rec('effect',{e:'🙋',text:cut(L('선택:')+' '+t,34),cls:'n',core:norm(t)})};

function end(){
  if(!Tr.on)return;
  Tr.on=false;
  const p=Tr.p;
  try{
    if(!A||!p||A.over())return;
    const cause=Tr.steps.filter(s=>s.row==='cause');
    /* 주사위 이전의 행동(AI의 건설 등)은 이번 턴 결과로 남기되, 게임 시작 안내 줄(세계정세·국가 특성)은 뺀다 */
    const k0=Tr.steps.findIndex(s=>s.row==='cause');
    let eff=Tr.steps.filter((s,i)=>s.row==='effect'&&(s.core||(k0>=0&&i>k0)||!/^(🎴|🧬)/.test(s.text)));
    const nl=newsLines();
    if(nl.length)eff=eff.filter(s=>!/^🎲/.test(s.text)).concat(nl);   // 이벤트·경제 주사위는 뉴스 체인이 더 정확
    /* 중복 제거: '선택' 칩은 같은 내용의 결과 줄이 있으면 생략, 나머지는 같은 글자열이면 하나만 */
    const logs=eff.filter(s=>!s.core).map(s=>norm(s.text));
    eff=eff.filter(s=>!(s.core&&s.core.length>=2&&logs.some(z=>z.includes(s.core))));
    /* 같은 줄이 로그와 뉴스 체인에 한 번씩 나오면 하나만: 더 긴 줄 안에 통째로 들어 있는 짧은 조각은 뺀다 */
    const n2=eff.map(s=>String(s.text).replace(/[^가-힣A-Za-z0-9]/g,''));
    eff=eff.filter((s,i)=>{
      const k=n2[i];if(!k)return false;
      return !n2.some((z,j)=>j!==i&&((z===k&&j<i)||(z.length>k.length&&k.length>=4&&z.includes(k))));
    });
    const stats=diffStats(Tr.s0,A.snap(p));
    if(!cause.length&&!eff.length&&!stats.length)return;
    Q.rq.push({p,why:`${A.emoji(p)} ${p.name} 차례 결과`,cause,eff,stats});
    if(Q.rq.length>3)Q.rq.splice(0,Q.rq.length-3);
    if(!Q.busy)run();
  }catch(e){}
}

async function run(){
  Q.busy=true;
  while(Q.rq.length){const r=Q.rq.shift();try{await show(r)}catch(e){}}
  Q.busy=false;
}

/* ───────── 리본 그리기 ───────── */
const MAXE=6,MAXS=7;
function chipHTML(c){
  if(c.cell!=null)return `<span class="c ${c.cls}">${c.e} ${esc(T(c.cell))} ${esc(L('도착'))}</span>`;
  if(c.k!=null)return `<span class="c ${c.cls}">${c.e} ${esc(L(c.k))} <b>${esc(c.v)}</b></span>`;
  if(c.n!=null)return `<span class="c ${c.cls}">${c.e} ${esc(L(c.n))} <b data-f="${c.from}" data-t="${c.to}" data-m="${c.money?1:0}" data-u="${c.unit}">${fmt(c.from,c.money,c.unit)}</b> <small>${c.d>0?'▲':'▼'}${c.money?money(Math.abs(c.d)):Math.abs(c.d)+c.unit}</small></span>`;
  return `<span class="c ${c.cls}">${c.e?c.e+' ':''}${esc(T(c.text))}</span>`;
}
function rowHTML(label,list){
  if(!list.length)return'';
  return `<div class="rw"><span class="lb">${esc(L(label))}</span>`+list.map((c,k)=>(k?'<span class="ar">→</span>':'')+chipHTML(c)).join('')+`</div>`;
}
function show({p,why,cause,eff,stats}){
  return new Promise(res=>{
    const ce=A&&A.center();
    if(!ce){res();return}
    const r=ce.getBoundingClientRect();
    if(r.width<120||r.height<50){res();return}
    let E=eff.slice(0,MAXE);
    if(eff.length>MAXE)E=E.slice(0,MAXE-1).concat({e:'',text:`${L('외')} ${eff.length-MAXE+1}`,cls:'n'});
    if(!E.length&&!stats.length)E=[{e:'',text:L('변화 없음'),cls:'n'}];
    let S2=stats.slice(0,MAXS);
    const el=document.createElement('div');
    const mo=A.motion()&&!RM.matches;
    el.className='ccrib'+(mo?'':' still');
    el.style.setProperty('--rc',A.color(p));
    el.style.left=Math.max(4,Math.round(r.left+6))+'px';
    el.style.width=Math.round(Math.min(r.width-12,innerWidth-8))+'px';
    el.style.bottom=Math.max(6,Math.round(innerHeight-r.bottom+8))+'px';
    el.style.maxHeight=Math.round(Math.max(60,r.height*0.62))+'px';
    el.innerHTML=`<span class="why"><i></i>${esc(whyText(why))}</span>`+rowHTML('원인',cause)+rowHTML('일어난 일',E)+rowHTML('지표',S2);
    document.body.appendChild(el);
    const chips=[...el.querySelectorAll('.c')];
    const slow=A.slow&&A.slow();
    const gap=mo?(p.human?300:170)*(slow?1.5:1):0;
    chips.forEach((c,k)=>setTimeout(()=>{
      c.classList.add('on');
      const pv=c.previousElementSibling;if(pv&&pv.classList.contains('ar'))pv.classList.add('on');
      const b=c.querySelector('b[data-f]');
      if(!b)return;
      const f=+b.dataset.f,t=+b.dataset.t,m=b.dataset.m==='1',u=b.dataset.u;
      if(!mo){b.textContent=fmt(t,m,u);return}
      const t0=performance.now();
      const step=now=>{const q=Math.min(1,(now-t0)/420);b.textContent=fmt(Math.round(f+(t-f)*q),m,u);if(q<1)requestAnimationFrame(step)};
      requestAnimationFrame(step);
    },k*gap));
    const hold=((p.human?3600:2200)+chips.length*gap)*(slow?1.4:1);
    setTimeout(()=>{el.classList.add('out');setTimeout(()=>{el.remove();res()},450)},hold);
  });
}

/* ───────── 레벨별 어댑터 ───────── */
const skipId=id=>['ok','x','n','no','close','roll'].includes(String(id));
const choiceLabel=(opts,id)=>{const o=(opts||[]).find(x=>String(x.id)===String(id));return o&&!skipId(id)&&!o.g?plain(o.l):''};

/* 공통: ask() 로 고른 사람의 선택을 '선택: …' 으로 기록 */
function hookAsk(){
  const _ask=ask;
  ask=function(prompt,opts,pv){
    const p=Tr.p;
    return _ask(prompt,opts,pv).then(id=>{
      try{if(Tr.on&&p&&p.human){const o=(opts||[]).find(x=>String(x.id)===String(id));
        if(o&&!skipId(id)&&!o.g)recChoice(o.l)}}catch(e){}
      return id;
    });
  };
}

/* Level 1 (부자되기) */
function installL1(){
  const winPct=p=>{try{const fr=Object.keys(DIST).map(d=>{const n=CELLS.filter(c=>c.t==='land'&&c.d===d).length;return n?landOf(p,d)/n:0}).sort((a,b)=>b-a);return Math.round(((fr[0]||0)+(fr[1]||0))/2*100)}catch(e){return 0}};
  A={
    name:'L1',
    state:()=>S,
    center:()=>document.querySelector('#board .center'),
    color:p=>p.color,emoji:p=>p.emoji||'🧑‍💼',
    motion:()=>typeof fxOn==='function'?fxOn():true,
    slow:()=>S&&S.speed==='slow',
    over:()=>!S||S.over,
    news:()=>S&&S.news,
    cellName:i=>CELLS[i].short||CELLS[i].name,
    snap:p=>({pos:p.pos,cash:Math.round(p.cash),debt:Math.round(p.debt||0),land:landOf(p),bld:bldOf(p),
      co:Object.values(p.comp||{}).reduce((a,l)=>a+l,0),edu:p.edu||0,win:winPct(p),nw:Math.round(netWorth(p))}),
    metrics:[['pos','📍','위치'],['cash','💰','현금',1],['debt','📄','대출',1,-1],['land','🏞️','땅'],['bld','🏗️','건물'],
      ['co','🏭','기업'],['edu','🎓','교육'],['win','🏆','승리 진행',0,1,'%'],['nw','🏁','순자산',1]]
  };
  hookLog(false);muteFn('roundEnd');hookAsk();
  const _roll=roll;
  roll=async function(k){const v=await _roll(k);try{recDice(k,v)}catch(e){}return v};
  const _land=land;
  land=function(p,i){recArrive(i);return _land.apply(this,arguments)};
  const _pt=playTurn;
  playTurn=async function(p){
    /* 라운드 결산이 먼저 끝난 뒤부터 기록하려고, 결산이 끝나면 begin 한다 */
    begin(p);
    const r=await _pt(p);
    end();
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
  hookLog(true);
  /* say(메시지, 연쇄 설명): 메시지는 한 칩, 연쇄 설명은 '→'로 나눠 칩으로 */
  const _say=say;
  say=function(m,ch){
    try{if(Tr.on&&!Tr.mute){
      recText(m);
      if(ch)String(ch).split(/\s*→\s*/).forEach(x=>{if(!/^반응:/.test(x))recText(x)})}}catch(e){}
    Tr.inSay=true;try{return _say.apply(this,arguments)}finally{Tr.inSay=false}
  };
  const _st=startTurn;
  startTurn=function(){try{if(G&&G.players&&!G.winner)begin(cur())}catch(e){}return _st.apply(this,arguments)};
  const _dr=doRoll;
  doRoll=function(p){Tr.inRoll=true;try{return _dr.apply(this,arguments)}finally{Tr.inRoll=false}};
  const _mv=move;
  move=function(p,n){if(Tr.inRoll)recDice('move',n);return _mv.apply(this,arguments)};
  const _rs=resolve;
  resolve=function(p){
    const n0=Tr.steps.length;
    recArrive(p.pos);
    const k0=Tr.steps.length;
    const r=_rs.apply(this,arguments);
    /* 선택지가 뜨는 칸이면 resolve 중의 say 는 '안내'일 뿐이므로 결과에서 뺀다 */
    if(r&&r.length&&Tr.on)Tr.steps.length=k0;
    return r;
  };
  const _pk=pick;
  pick=function(i){
    try{const ch=G&&G.choices?G.choices[i]:null;const p=G&&G.players?cur():null;
      if(ch&&p&&p.human&&!ch.pass)recChoice(ch.label)}catch(e){}
    return _pk.apply(this,arguments);
  };
  const _et=endTurn;
  endTurn=function(){end();return _et.apply(this,arguments)};
}

/* Level 3 (나라정책) · Level 4 (우주 패권) 공통 */
const DLAB34={move:'이동',mil:'군사',dip:'외교'};
function installL34(isL4){
  const base={
    state:()=>S,
    center:()=>document.querySelector('#board .center'),
    color:p=>p.color,emoji:p=>typeof pemo==='function'?pemo(p):'🙂',
    motion:()=>!S||S.speed!=='fast',
    slow:()=>S&&S.speed==='slow',
    over:()=>!S||S.over,
    news:()=>S&&S.news,
    cellName:i=>CELLS[i].short||CELLS[i].name
  };
  if(isL4){
    /* Level 4 는 자체 v34 리본(선택→지표)이 있었다 — 이 모듈의 체인으로 대체하고 v34 리본은 끈다 */
    try{v34Rib=function(){}}catch(e){}
    A=Object.assign({name:'L4',snap:p=>v34Snap(p),
      metrics:[['pos','📍','위치'],['cash','💰','현금',1],['debt','📄','국채',1,-1],['city','🏙️','도시'],['lv','🏗️','건물'],['ap','🙂','지지율'],['un','🔥','혼란',0,-1],
        ['dp','🕊️','외교력'],['M','🛡️','군사력'],['edu','🎓','교육'],['tech','🔬','기술'],['win','🏆','승리 진행',0,1,'%'],['nw','🏁','순자산',1]]},base);
  }else{
    A=Object.assign({name:'L3',
      snap:p=>({pos:p.pos,cash:Math.round(p.cash),debt:Math.round(p.debt||0),city:ownedCities(p).length,lv:levelsOf(p),
        ap:p.ap,un:p.un,dp:typeof dpOf==='function'?dpOf(p):0,M:p.M,edu:p.edu,tech:(p.qt||0)+(p.sky||0)+(p.term||0),nw:Math.round(netWorth(p))}),
      metrics:[['pos','📍','위치'],['cash','💰','현금',1],['debt','📄','국채',1,-1],['city','🏙️','도시'],['lv','🏗️','건물'],['ap','🙂','지지율'],
        ['un','🔥','혼란',0,-1],['dp','🕊️','외교력'],['M','🛡️','군사력'],['edu','🎓','교육'],['tech','🔬','기술'],['nw','🏁','순자산',1]]},base);
  }
  hookLog(false);muteFn('roundEnd');hookAsk();
  const _ra=rollA;
  rollA=async function(k){const v=await _ra(k);try{recDice(DLAB34[k]?k:k,v)}catch(e){}return v};
  const _land=land;
  land=function(p,mv){try{recArrive(p.pos)}catch(e){}return _land.apply(this,arguments)};
  const _tt=takeTurn;
  takeTurn=async function(p){
    begin(p);
    const r=await _tt(p);
    end();
    return r;
  };
}

/* ───────── 설치: 어떤 레벨인지 함수 모양으로 판별 ───────── */
function install(){
  try{
    if(typeof pick==='function'&&typeof fxDiff==='function'&&typeof aiTurn==='function')installL2();
    else if(typeof takeTurn==='function'&&typeof dpOf==='function')installL34(typeof v34Rib==='function'&&typeof v34Snap==='function');
    else if(typeof playTurn==='function'&&typeof fxChain==='function')installL1();
  }catch(e){console.warn('choice-chain: 설치 실패',e)}
}
/* 예전 호출(CC.flush)과 호환 */
window.CC={v:2,flush(){},rec:(k,v)=>{try{recDice(k,v)}catch(e){}},install,_A:()=>A,_T:()=>Tr,reset(){Q.rq.length=0;Tr.on=false;Tr.steps=[];document.querySelectorAll('.ccrib').forEach(e=>e.remove())}};
install();
})();
