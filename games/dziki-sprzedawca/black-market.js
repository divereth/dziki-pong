import {CONTRABAND} from './contraband.js';
export const ENTRY_FEE=100000;
export const PATROL=[[0,-48],[0,-12],[3,9],[4.8,10.5],[2,11],[0,-15],[-2,-50]];
export function ensureBlackMarket(s,rng=Math.random){
 if(!s.blackMarket||!Number.isInteger(s.blackMarket.window)||s.blackMarket.window<0||s.blackMarket.window>=264)s.blackMarket={unlocked:false,window:Math.floor(rng()*264),offers:[]};
 s.policeDebt=Number.isFinite(s.policeDebt)&&s.policeDebt>=0?s.policeDebt:0;
 if(!Array.isArray(s.blackMarket.offers)||s.blackMarket.offers.length!==CONTRABAND.length||!s.blackMarket.offers.every((o,i)=>o.itemId===CONTRABAND[i].id&&Number.isInteger(o.uid)&&o.uid>0&&o.uid<s.nextId&&Number.isFinite(o.price)&&o.price>0&&typeof o.sold==='boolean')||s.blackMarket.stockDay!==s.day){s.blackMarket.offers=CONTRABAND.map((item,slot)=>({uid:s.nextId++,itemId:item.id,quality:1,price:Math.round(item.base*(.66+(slot%3)*.07)),sold:false,slot}));s.blackMarket.stockDay=s.day;}
 return s.blackMarket;
}
export function unlockBlackMarket(s,method){const b=ensureBlackMarket(s);if(b.unlocked)return {ok:true,charged:0};if(method==='guard'){if(s.cash<ENTRY_FEE)return {ok:false,message:'Ochroniarz żąda 100 000 zł. Brakuje Ci gotówki.'};s.cash-=ENTRY_FEE;}else if(method!=='button')return {ok:false};b.unlocked=true;return {ok:true,charged:method==='guard'?ENTRY_FEE:0};}
export function buyContraband(s,uid){const b=ensureBlackMarket(s),o=b.offers.find(o=>o.uid===uid);if(!b.unlocked)return {ok:false,message:'Najpierw odblokuj wejście.'};if(!o||o.sold)return {ok:false,message:'Ten towar jest już sprzedany.'};if(s.inventory.length>=8)return {ok:false,message:'Plecak i stragan są pełne.'};if(s.cash<o.price)return {ok:false,message:'Za mało gotówki.'};s.cash-=o.price;o.sold=true;s.inventory.push({uid:o.uid,itemId:o.itemId,quality:1,paid:o.price,ask:null,listedAt:null});s.trades++;return {ok:true,item:CONTRABAND.find(i=>i.id===o.itemId)};}
export function confiscate(s){
 const seized=s.inventory.filter(e=>e.ask!==null&&CONTRABAND.some(i=>i.id===e.itemId));if(!seized.length)return null;
 const fine=seized.reduce((sum,e)=>sum+Math.round(e.paid*300)/100,0),ids=new Set(seized.map(e=>e.uid));s.inventory=s.inventory.filter(e=>!ids.has(e.uid));s.policeDebt=(s.policeDebt||0)+fine;collectFine(s);return {fine,seized};
}
export function collectFine(s){const paid=Math.min(Math.max(0,s.cash),s.policeDebt||0);s.cash=Math.round((s.cash-paid)*100)/100;s.policeDebt=Math.round(((s.policeDebt||0)-paid)*100)/100;return paid;}
export class PolicePatrol{
 constructor(){this.x=PATROL[0][0];this.z=PATROL[0][1];this.next=1;this.heading=0;}
 update(dt,s){const [x,z]=PATROL[this.next],dx=x-this.x,dz=z-this.z,d=Math.hypot(dx,dz),step=Math.min(d,dt*1.5);if(d>.001){this.x+=dx/d*step;this.z+=dz/d*step;this.heading=Math.atan2(dx,dz);}if(d<.1)this.next=(this.next+1)%PATROL.length;return Math.hypot(this.x-6.8,this.z-7.7)<4?confiscate(s):null;}
}

