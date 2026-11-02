/* 결과 주사위(RD) — 칸에 도착한 뒤 d12를 한 번 더 굴려 "그 칸의 결과"를 다양하게 만든다.
   1–2 대형 악재 · 3–4 소형 악재 · 5–8 변화 없음 · 9–10 소형 호재 · 11–12 대형 호재
   기본 OFF. 켜기: 주소 뒤에 ?variety=1  (끄기 ?variety=0) — 저장: localStorage bm22_variety
   적용 목록: 프로젝트 문서 '결과체인-다양화-레벨별-적용목록.md' */
(function(){
if(window.RD)return;
var on=false;
try{var q=new URLSearchParams(location.search).get('variety');
 if(q==='1')localStorage.setItem('bm22_variety','1');else if(q==='0')localStorage.removeItem('bm22_variety');
 on=localStorage.getItem('bm22_variety')==='1'}catch(e){on=/[?&]variety=1/.test(location.search)}
var band=function(d){return d<=2?0:d<=4?1:d<=8?-1:d<=10?2:3}; /* 0 대악 1 소악 2 소호 3 대호 */
var BN=['대형 악재','소형 악재','','소형 호재','대형 호재'];
function run(tbl,key,p,roll,say,fx){
 var row=tbl[key];if(!row)return;
 var d=roll(),b=band(d);
 try{window.CC&&CC.rec('rd',d)}catch(e){}
 if(b<0)return say(p,'결과 주사위 '+d+' · 이번엔 특별한 일이 없었다');
 var o=row[b];if(!o)return;
 say(p,o[0]);try{o[1](p)}catch(e){}
}
function L1(){
 if(typeof land!=='function'||typeof landProp!=='function'||typeof pay!=='function')return false;
 var T={
  tax:[['세무조사 추징금',p=>pay(p,150,'세무조사 추징')],['신고 누락 가산세',p=>pay(p,60,'가산세')],['세금 환급',p=>gain(p,60,'세금 환급')],['세제 혜택 확정',p=>gain(p,150,'세제 혜택')]],
  bank:[['금융 사고 수수료',p=>pay(p,120,'금융 사고')],['수수료 인상',p=>pay(p,50,'수수료')],['우대 이자',p=>gain(p,50,'우대 이자')],['금리 특판 당첨',p=>gain(p,130,'특판 이자')]],
  fund:[['기금 운용 손실',p=>pay(p,100,'기금 손실')],['기금 수수료',p=>pay(p,40,'기금 수수료')],['기금 운용 수익',p=>gain(p,50,'기금 수익')],['기금 특별 배당',p=>gain(p,120,'특별 배당')]],
  edu:[['교육 시설 사고',p=>pay(p,100,'시설 보수')],['교재비 증가',p=>pay(p,40,'교재비')],['장학금 환급',p=>gain(p,50,'장학금')],['교육 성과 포상',p=>gain(p,120,'교육 포상')]],
  hq:[['본사 보안 사고',p=>pay(p,120,'보안 사고')],['경비 증가',p=>pay(p,50,'경비')],['사업 보너스',p=>gain(p,60,'사업 보너스')],['대형 계약 체결',p=>gain(p,140,'대형 계약')]],
  stock:[['증시 급락',p=>pay(p,130,'증시 급락')],['소폭 하락',p=>pay(p,50,'소폭 손실')],['소폭 상승',p=>gain(p,50,'소폭 수익')],['증시 급등',p=>gain(p,130,'증시 급등')]],
  xch:[['환율 손실',p=>pay(p,100,'환율 손실')],['수수료',p=>pay(p,40,'환전 수수료')],['환차익',p=>gain(p,50,'환차익')],['대형 환차익',p=>gain(p,120,'환차익')]],
  ins:[['보험금 지급 거절',p=>pay(p,80,'보험 손실')],['보험료 인상',p=>pay(p,40,'보험료')],['보험 환급',p=>gain(p,50,'보험 환급')],['보험금 수령',p=>gain(p,120,'보험금')]],
  auction:[['경매 낙찰 후회',p=>pay(p,100,'경매 수수료')],['경매 수수료',p=>pay(p,40,'경매 수수료')],['경매 수익',p=>gain(p,50,'경매 수익')],['경매 대박',p=>gain(p,120,'경매 대박')]]};
 var _l=land;land=async function(p,i){var r=await _l.apply(this,arguments);
  try{if(p&&!p.bankrupt)run(T,CELLS[i].t,p,d12,function(q,t){log(pn(q)+' 🎲 '+t)})}catch(e){}return r};
 return true}
function L2(){
 if(typeof endTurn!=='function'||typeof resolve!=='function'||typeof fixStats!=='function')return false;
 var S_=(k,d)=>p=>{p[k]+=d;fixStats()};
 var T={
  culture:[['문화 행사 파행',S_('support',-4)],['관객 감소',S_('culture',-1)],['문화 호응',S_('culture',1)],['문화 대성공',p=>{p.culture+=2;p.support+=3;fixStats()}]],
  edu:[['교육 스캔들',S_('support',-4)],['교원 이탈',S_('edu',-1)],['학력 향상',S_('edu',1)],['교육 혁신',p=>{p.edu+=1;p.support+=3;fixStats()}]],
  bank:[['금융 위기 조짐',S_('cash',-80)],['대출 연체',S_('cash',-30)],['이자 수익',S_('cash',40)],['금융 호황',S_('cash',100)]],
  welfare:[['복지 재정 논란',S_('support',-4)],['복지 누수',S_('unrest',2)],['복지 만족',S_('support',3)],['복지 대호평',p=>{p.support+=5;p.unrest-=2;fixStats()}]],
  taxoffice:[['탈세 폭로',p=>{p.support-=4;p.unrest+=2;fixStats()}],['세수 부진',S_('cash',-40)],['세수 증가',S_('cash',50)],['세수 대호조',S_('cash',110)]],
  pop:[['인구 유출',S_('pop',-2)],['출산율 하락',S_('pop',-1)],['인구 유입',S_('pop',1)],['인구 대유입',S_('pop',2)]],
  corner:[['정쟁 격화',p=>{p.support-=4;p.unrest+=2;fixStats()}],['의회 공전',S_('support',-2)],['의회 합의',S_('support',2)],['개혁 입법',p=>{p.support+=4;p.unrest-=2;fixStats()}]],
  public:[['시설 사고',S_('unrest',3)],['시설 노후',S_('unrest',1)],['이용객 증가',S_('support',2)],['명소 등극',p=>{p.support+=3;p.culture+=1;fixStats()}]]};
 var _e=endTurn;endTurn=function(){
  try{var p=cur(),c=p&&CELLS[p.pos];if(p&&!p.out&&c&&G.phase!=='over')run(T,c.t,p,d12,function(q,t){say(q.name+' 🎲 '+t,'')})}catch(e){}
  return _e.apply(this,arguments)};
 return true}
function L34(){
 if(typeof land!=='function'||typeof rollA!=='function'||typeof led!=='function')return false;
 var M=(p,d)=>{p.M=Math.max(0,Math.min(12,p.M+d))},REP=(p,d)=>{if(p.rep==null)p.rep=40;p.rep=Math.max(0,Math.min(100,p.rep+d))};
 var G_=(p,n)=>{n=pl(n);p.cash+=n;led(null,p,n,'결과 주사위')},P_=(p,n)=>payBank(p,pl(n),'결과 주사위');
 var T={
  defense:[['군수 비리 적발 · 군사력 −1, 지지율 −3',p=>{M(p,-1);apc(p,-3)}],['방위 예산 삭감',p=>P_(p,40)],['기술 도약 · 군사력 +1',p=>M(p,1)],['대형 방위 계약 · 군사력 +2',p=>{M(p,2);G_(p,60)}]],
  dip:[['외교 참사 · 평판 −6',p=>REP(p,-6)],['외교 결례 · 평판 −3',p=>REP(p,-3)],['외교 호평 · 평판 +3',p=>REP(p,3)],['외교 대성과 · 평판 +6',p=>REP(p,6)]],
  refugee:[['난민 수용 갈등 · 혼란 +8',p=>unc(p,8)],['수용 비용',p=>P_(p,30)],['난민 노동력 · 지지율 +3',p=>apc(p,3)],['난민 정착 성공 · 평판 +4',p=>{REP(p,4);apc(p,3)}]],
  bank:[['금융 사고',p=>P_(p,80)],['수수료 인상',p=>P_(p,30)],['이자 수익',p=>G_(p,40)],['금융 호황',p=>G_(p,100)]],
  edu:[['인재 유출 · 지지율 −3',p=>apc(p,-3)],['교육 예산 누수',p=>P_(p,30)],['학력 향상 · 지지율 +2',p=>apc(p,2)],['교육 혁신 · 지지율 +4',p=>{apc(p,4);G_(p,40)}]],
  cult:[['문화 논란 · 평판 −3',p=>REP(p,-3)],['흥행 부진',p=>P_(p,30)],['문화 호응 · 평판 +3',p=>REP(p,3)],['문화 열풍 · 평판 +5',p=>{REP(p,5);apc(p,2)}]],
  pop:[['인구 유출 · 지지율 −4',p=>apc(p,-4)],['출산율 하락 · 지지율 −2',p=>apc(p,-2)],['인구 유입 · 지지율 +2',p=>apc(p,2)],['인구 대유입 · 지지율 +4',p=>apc(p,4)]],
  robot:[['자동화 실직 · 혼란 +8',p=>unc(p,8)],['설비 고장',p=>P_(p,40)],['생산성 향상',p=>G_(p,50)],['자동화 대성공',p=>{G_(p,100);unc(p,-4)}]],
  cp:[['해적 습격',p=>P_(p,60)],['통관 지연',p=>P_(p,25)],['물동량 증가',p=>G_(p,40)],['물동량 폭증',p=>G_(p,90)]],
  nuke:[['핵 사고 · 평판 −6, 혼란 +6',p=>{REP(p,-6);unc(p,6)}],['사찰 압박 · 평판 −3',p=>REP(p,-3)],['억지력 인정 · 군사력 +1',p=>M(p,1)],['핵 억지 성공 · 군사력 +1, 평판 +3',p=>{M(p,1);REP(p,3)}]],
  cyber:[['사이버 공격 피해',p=>P_(p,70)],['보안 경보 · 지지율 −2',p=>apc(p,-2)],['방어 성공 · 지지율 +2',p=>apc(p,2)],['해킹 반격 성공',p=>G_(p,80)]],
  fleet:[['함대 사고 · 군사력 −1',p=>M(p,-1)],['정비 비용',p=>P_(p,40)],['함대 훈련 · 군사력 +1',p=>M(p,1)],['우주 패권 과시 · 군사력 +2',p=>M(p,2)]],
  mars:[['기지 사고',p=>P_(p,80)],['보급 지연',p=>P_(p,30)],['보급 성공',p=>G_(p,50)],['자원 발견',p=>G_(p,120)]]};
 var _l=land;land=async function(p,mv){var r=await _l.apply(this,arguments);
  try{if(p&&!p.bankrupt&&CELLS[p.pos])run(T,CELLS[p.pos].t,p,function(){return d12('world')},function(q,t){log(pn(q)+' 🎲 '+t)})}catch(e){}return r};
 return true}
function init(){
 if(!on)return;
 var ok=L1()||L2()||L34();
 window.RD={on:true,ok:ok};
}
window.RD={on:false,enable(){try{localStorage.setItem('bm22_variety','1')}catch(e){}location.reload()},disable(){try{localStorage.removeItem('bm22_variety')}catch(e){}location.reload()}};
if(document.readyState==='complete')setTimeout(init,0);else addEventListener('load',function(){setTimeout(init,0)});
})();
