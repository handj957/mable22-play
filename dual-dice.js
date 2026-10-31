/* Two independent D12 channels. No sum, extra random draw, or rule change. */
(function(root){
'use strict';
const domains=Object.freeze({move:'이동',pol:'정치',eco:'경제',mil:'군사',dip:'외교',res:'자원',re:'부동산',world:'자동 판정'});
function channel(kind){if(!Object.prototype.hasOwnProperty.call(domains,kind))throw new Error('Unknown dice domain: '+kind);return kind==='move'?'move':'judge'}
function state(game){
 if(!game)return {version:1,move:{value:null,kind:'move'},judge:{value:null,kind:'world'},active:null};
 if(!game.dicePair||game.dicePair.version!==1){const hot=game.hot;game.dicePair={version:1,move:{value:game.dv&&game.dv.move||null,kind:'move'},judge:{value:hot&&hot!=='move'&&game.dv?game.dv[hot]||null:null,kind:hot&&hot!=='move'?hot:'world'},active:null}}
 return game.dicePair;
}
function roll(game,kind,random){kind=kind||'world';const side=channel(kind),v=1+Math.floor((random||Math.random)()*12);if(game){const pair=state(game);pair[side]={value:v,kind:kind};pair.active=side}return v}
function html(game,kind){const pair=state(game),active=kind?channel(kind):pair.active;return '<div class="dual-dice" role="group" aria-label="이동·분야 판정 주사위">'+['move','judge'].map(side=>{const d=pair[side],label=side==='move'?'① 이동':'② 판정',detail=side==='move'?'이동 거리':domains[d.kind]||'분야 판정';return '<div class="dual-die '+side+(active===side?' active':'')+'" data-dice-channel="'+side+'" title="'+label+' · '+detail+' · 12면체"><span class="dual-value">'+(d.value||'–')+'</span><span class="dual-name">'+label+'</span><small>'+detail+'</small></div>'}).join('')+'</div>'}
root.DualDice=Object.freeze({channel:channel,state:state,roll:roll,html:html,domains:domains});
})(typeof window!=='undefined'?window:globalThis);
function dualDiceHTML(kind){return DualDice.html(typeof S!=='undefined'?S:null,kind)}
