// MABLE22 price catalog v1. Prices are KRW, tax treatment determined by merchant policy.
// Public configuration only: never treat this client-side file as proof of purchase.
(function(root){
  "use strict";
  const products = Object.freeze([
    {id:"beginning-l2",game:"beginning",levels:[2],priceKRW:2900,title:"도시관리 프로젝트"},
    {id:"beginning-l3",game:"beginning",levels:[3],priceKRW:3900,title:"국가경영 대통령2101"},
    {id:"beginning-l4",game:"beginning",levels:[4],priceKRW:4900,title:"글로벌패권 리더"},
    {id:"beginning-bundle",game:"beginning",levels:[2,3,4],priceKRW:8900,title:"Beginning 전체 이용권"},
    {id:"universe-l1",game:"universe",levels:[1],priceKRW:3900,title:"네오 아틀란스 부자 경영"},
    {id:"universe-l2",game:"universe",levels:[2],priceKRW:4900,title:"시티 건설"},
    {id:"universe-l3",game:"universe",levels:[3],priceKRW:5900,title:"국가 정책"},
    {id:"universe-l4",game:"universe",levels:[4],priceKRW:6900,title:"우주 패권"},
    {id:"universe-bundle",game:"universe",levels:[1,2,3,4],priceKRW:15900,title:"Universe 전체 이용권"},
    {id:"mable22-all",game:"all",levels:[1,2,3,4],priceKRW:19900,title:"MABLE22 통합 이용권"}
  ]);
  const freeLevels = Object.freeze({beginning:[1],universe:[]});
  function grants(productId) {
    const product=products.find(p=>p.id===productId);
    if(!product) return [];
    if(product.game==="all") return ["beginning","universe"].flatMap(game=>[1,2,3,4].map(level=>game+":"+level));
    return product.levels.map(level=>product.game+":"+level);
  }
  function canAccess(game,level,serverGrantedKeys) {
    if(!["beginning","universe"].includes(game)||![1,2,3,4].includes(level)) return false;
    if(freeLevels[game].includes(level)) return true;
    return Array.isArray(serverGrantedKeys)&&serverGrantedKeys.includes(game+":"+level);
  }
  root.MABLE22_CATALOG=Object.freeze({products,freeLevels,grants,canAccess});
})(typeof window!=="undefined"?window:globalThis);
