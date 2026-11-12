import {STANDS, STAND_THEMES} from './layout.js';
import {CATALOG} from './catalog.js';
import {LEGACY_ITEMS} from './legacy-items.js';
export {CATALOG} from './catalog.js';
export const GOAL=1_000_000, CAPACITY=8, SAVE_KEY='dziki-sprzedawca-save-v3', PREVIOUS_SAVE_KEY='dziki-sprzedawca-save-v2', LEGACY_SAVE_KEY='fliper-save-v1';
export const CATEGORIES=[
  {id:'retro',name:'Elektronika i retro',short:'Klasyka wraca do gry',model:'boombox'},
  {id:'design',name:'Design i wnętrza',short:'Rzeczy z charakterem',model:'desk_lamp_arm_01'},
  {id:'collect',name:'Kolekcjonerskie',short:'Rzadkie znaleziska',model:'pocket_watch'},
  {id:'tools',name:'Narzędzia',short:'Do pracy i majsterkowania',model:'adjustable_wrench'},
  {id:'kitchen',name:'Kuchnia i naczynia',short:'Na każdy stół',model:'wooden_bowl_01'},
  {id:'food',name:'Jedzenie',short:'Prosto od wystawców',model:'food_apple_01'},
  {id:'other',name:'Różności',short:'Każda rzecz ma swojego kupca',model:'rubber_duck_toy'},
];
const itemIndex=new Map(CATALOG.map(item=>[item.id,item]));
export const LEVELS=[{at:0,name:'Łowca okazji',desc:'Każdy milion zaczyna się od stówki.'},{at:500,name:'Bywalec targu',desc:'Masz oko do dobrych interesów.'},{at:2500,name:'Sprytny handlarz',desc:'Droższe towary czekają na odkrycie.'},{at:15000,name:'Znawca przedmiotów',desc:'Klienci zaczynają Cię znać.'},{at:80000,name:'Inwestor',desc:'Duże okazje. Jeszcze większy zysk.'},{at:350000,name:'Gruba ryba',desc:'Milion jest już na horyzoncie.'},{at:GOAL,name:'Dziki milioner',desc:'Twój stragan wyrósł na imperium.'}];
export const round=n=>Math.round(n*100)/100;
export const getItem=id=>itemIndex.get(id)||itemIndex.get(LEGACY_ITEMS[id]);
export function getLevel(value){let index=0;LEVELS.forEach((l,i)=>{if(value>=l.at)index=i});return {...LEVELS[index],index}}
export const marketValue=(item,state)=>round(item.base*state.market[item.category]);
export const itemValue=(entry,state)=>round(marketValue(getItem(entry.itemId),state)*entry.quality);
export const suggestedPrice=(entry,state)=>round(itemValue(entry,state)*1.02);
export const inventoryValue=state=>round(state.inventory.reduce((sum,e)=>sum+itemValue(e,state),0));
export const wealth=state=>round(state.cash+inventoryValue(state));
export const listedItems=state=>state.inventory.filter(e=>e.ask!==null);

export function newState(rng=Math.random){
  const state={version:3,cash:100,day:1,inventory:[],market:{retro:1.12,design:.97,collect:1.04,tools:1.08,kitchen:1.03,food:1,other:.96},changes:{retro:12,design:-3,collect:4,tools:8,kitchen:3,food:0,other:-4},offers:[],trades:0,totalProfit:0,peak:100,won:false,nextId:1,elapsed:0,marketSales:0,playerSales:0,history:[]};
  restock(state,rng);return state;
}
export function restock(state,rng=Math.random){
  state.peak=Math.max(state.peak,wealth(state));
  state.offers=Array.from({length:STANDS.length*3},(_,n)=>createOffer(state,n,rng,true));
}
export function createOffer(state,n,rng=Math.random,tutorial=false){
    const max=Math.max(160,state.peak*.88);
    const category=STAND_THEMES[Math.floor(n/3)],pool=CATALOG.filter(i=>i.category===category&&i.base<=max),high=pool.filter(i=>i.base>=state.peak*.07),choices=n%3!==2&&high.length?high:pool;
    let item=choices[Math.floor(rng()*choices.length)];
    if(tutorial&&state.day===1&&n<3)item=getItem(['boombox','Camera_01','gaming_console'][n]);
    const quality=[.85,1,1.15][Math.floor(rng()*3)],factor=n%5===0?.4+rng()*.13:n%4===0?1.04+rng()*.22:.55+rng()*.32;
    const offer={uid:state.nextId++,itemId:item.id,quality,price:Math.max(2,round(marketValue(item,state)*quality*factor)),sold:false,stand:Math.floor(n/3),slot:n%3};
    if(tutorial&&n===0&&state.day===1){offer.price=35;offer.quality=1}return offer;
}
export function refillSoldOffers(state,rng=Math.random){
  const replenished=[];state.peak=Math.max(state.peak,wealth(state));
  state.offers.forEach((offer,n)=>{if(offer.sold&&state.elapsed-(offer.soldAt??0)>=12+(offer.stand%4)*2){const fresh=createOffer(state,n,rng);state.offers[n]=fresh;replenished.push(fresh)}});
  return replenished;
}
export function buy(state,uid){
  const offer=state.offers.find(o=>o.uid===uid);
  if(!offer||offer.sold)return {ok:false,message:'Ten przedmiot ma już nowego właściciela.'};
  if(state.inventory.length>=CAPACITY)return {ok:false,message:'Plecak i stragan są pełne. Poczekaj, aż klient coś kupi.'};
  if(state.cash<offer.price)return {ok:false,message:'Brakuje gotówki na ten zakup.'};
  state.cash=round(state.cash-offer.price);state.inventory.push({uid:offer.uid,itemId:offer.itemId,quality:offer.quality,paid:offer.price,ask:null,listedAt:null});offer.sold=true;offer.soldTo='player';offer.soldAt=state.elapsed;state.trades++;state.peak=Math.max(state.peak,wealth(state));
  return {ok:true,item:getItem(offer.itemId)};
}
export function listItem(state,uid,price){
  const entry=state.inventory.find(e=>e.uid===uid);
  if(!entry)return {ok:false,message:'Nie ma tego przedmiotu w plecaku.'};
  if(!Number.isFinite(price)||price<.01||price>5_000_000)return {ok:false,message:'Podaj cenę od 0,01 do 5 000 000 zł.'};
  entry.ask=round(price);entry.listedAt=state.elapsed;return {ok:true,item:getItem(entry.itemId),price:entry.ask};
}
export function withdrawListing(state,uid){const entry=state.inventory.find(e=>e.uid===uid);if(!entry)return false;entry.ask=null;entry.listedAt=null;return true}
export function willingness(entry,state,customer){const affinity=customer.preferred===getItem(entry.itemId).category?.12:0;return round(itemValue(entry,state)*(.8+customer.tolerance*.48+affinity))}
// Only the customer simulation calls this, after a visit and browsing time.
export function customerPurchase(state,customer,stand='player',reservations=new Map()){
  const player=stand==='player';
  const candidates=player?listedItems(state).filter(e=>!reservations.has(e.uid)):state.offers.filter(o=>o.stand===stand&&!o.sold&&!(state.day===1&&o.stand===0&&o.slot===0&&state.trades===0));
  const affordable=candidates.filter(e=>{const price=player?e.ask:e.price;return price<=customer.budget&&price<=willingness(e,state,customer)}).sort((a,b)=>{
    const score=e=>(customer.preferred===getItem(e.itemId).category?.2:0)+1-(player?e.ask:e.price)/itemValue(e,state);return score(b)-score(a);
  });
  if(!affordable.length){const wanted=[...candidates].sort((a,b)=>a.ask/itemValue(a,state)-b.ask/itemValue(b,state))[0];return {ok:false,reason:candidates.length?'price':'empty',uid:player?wanted?.uid:undefined}}
  const entry=affordable[0],price=player?entry.ask:entry.price,item=getItem(entry.itemId);
  if(player){
    return completePlayerSale(state,customer,entry,price);
  }
  customer.budget=round(customer.budget-price);entry.sold=true;entry.soldTo='npc';entry.soldAt=state.elapsed;state.marketSales++;return {ok:true,player:false,uid:entry.uid,item,price,name:customer.name};
}
function completePlayerSale(state,customer,entry,price){
  const item=getItem(entry.itemId);customer.budget=round(customer.budget-price);state.inventory.splice(state.inventory.findIndex(e=>e.uid===entry.uid),1);state.cash=round(state.cash+price);const profit=round(price-entry.paid);state.totalProfit=round(state.totalProfit+profit);state.trades++;state.playerSales++;state.peak=Math.max(state.peak,wealth(state));
  state.history.unshift({name:customer.name,itemId:item.id,price,profit,day:state.day});state.history=state.history.slice(0,5);return {ok:true,player:true,uid:entry.uid,item,price,profit,name:customer.name};
}
export function negotiationLimit(state,customer,entry){return round(Math.min(customer.budget,willingness(entry,state,customer)*1.08))}
export function negotiatedPurchase(state,customer,uid,price){
  const entry=state.inventory.find(e=>e.uid===uid&&e.ask!==null);
  if(!entry)return {ok:false,reason:'missing'};
  if(!Number.isFinite(price)||price<.01||price>5_000_000)return {ok:false,reason:'invalid'};
  price=round(price);if(price>negotiationLimit(state,customer,entry))return {ok:false,reason:'price'};
  return {...completePlayerSale(state,customer,entry,price),negotiated:true};
}
export function nextDay(state,rng=Math.random){
  state.day++;for(const c of CATEGORIES){const change=round((rng()-.44)*.28);state.market[c.id]=round(Math.max(.65,Math.min(1.65,state.market[c.id]*(1+change))));state.changes[c.id]=round(change*100)}restock(state,rng);
  if(state.cash<2&&!state.inventory.length){state.cash=25;return {recovery:true}}return {recovery:false};
}
export function checkWin(state){if(state.cash>=GOAL&&!state.won){state.won=true;return true}return false}
export function validSave(s,offerCount=STANDS.length*3){
  if(!s||s.version!==3||!Number.isFinite(s.cash)||s.cash<0||!Number.isInteger(s.day)||s.day<1||!Array.isArray(s.inventory)||s.inventory.length>CAPACITY||!Array.isArray(s.offers)||s.offers.length!==offerCount||!Number.isInteger(s.nextId)||!Number.isFinite(s.peak)||!Number.isFinite(s.totalProfit)||!Number.isInteger(s.trades)||typeof s.won!=='boolean'||!Number.isFinite(s.elapsed)||s.elapsed<0||!Number.isInteger(s.marketSales)||!Number.isInteger(s.playerSales)||!Array.isArray(s.history)||s.history.length>5)return false;
  if(!CATEGORIES.every(c=>Number.isFinite(s.market?.[c.id])&&s.market[c.id]>=.65&&s.market[c.id]<=1.65&&Number.isFinite(s.changes?.[c.id])))return false;
  const good=e=>getItem(e.itemId)&&Number.isInteger(e.uid)&&e.uid>0&&[.85,1,1.15].includes(e.quality);
  return s.inventory.every(e=>good(e)&&Number.isFinite(e.paid)&&e.paid>=0&&(e.ask===null||(Number.isFinite(e.ask)&&e.ask>=.01&&e.ask<=5_000_000))&&(e.listedAt===null||(Number.isFinite(e.listedAt)&&e.listedAt>=0)))&&s.offers.every((o,i)=>good(o)&&typeof o.sold==='boolean'&&Number.isFinite(o.price)&&o.price>0&&o.stand===Math.floor(i/3)&&o.slot===i%3)&&s.history.every(h=>typeof h.name==='string'&&getItem(h.itemId)&&Number.isFinite(h.price)&&Number.isFinite(h.profit)&&Number.isInteger(h.day))&&new Set(s.inventory.map(e=>e.uid)).size===s.inventory.length&&new Set(s.offers.map(e=>e.uid)).size===s.offers.length&&s.nextId>Math.max(0,...s.inventory.map(e=>e.uid),...s.offers.map(e=>e.uid));
}
export function restoreSave(raw,rng=Math.random){
  if(validSave(raw))return raw;
  if(validSave(raw,48)){const s=structuredClone(raw);for(let n=48;n<STANDS.length*3;n++)s.offers.push(createOffer(s,n,rng));return validSave(s)?s:null}
  if(raw?.version===2){
    if(!Array.isArray(raw.inventory)||!Array.isArray(raw.offers)||!Array.isArray(raw.history)||!raw.market||!raw.changes)return null;
    const s=structuredClone(raw);s.version=3;
    for(const entry of [...s.inventory,...s.offers,...s.history]){const item=getItem(entry.itemId);if(!item)return null;entry.itemId=item.id;}
    for(const key of ['market','changes']){s[key].tools=s[key].tools??s[key].clothes;s[key].kitchen=s[key].kitchen??s[key].phones;delete s[key].clothes;delete s[key].phones;}
    if(!validSave(s,s.offers.length)||![48,STANDS.length*3].includes(s.offers.length))return null;
    restock(s,rng);return validSave(s)?s:null;
  }
  if(raw?.version!==1||!Number.isFinite(raw.cash)||raw.cash<0||!Array.isArray(raw.inventory)||raw.inventory.length>CAPACITY||!Number.isInteger(raw.day)||raw.day<1||!raw.inventory.every(e=>getItem(e.itemId)&&Number.isFinite(e.paid)&&e.paid>=0&&[.85,1,1.15].includes(e.quality)&&Number.isInteger(e.uid)))return null;
  const s=newState(rng);s.cash=raw.cash;s.day=raw.day;s.inventory=raw.inventory.map(e=>({...e,itemId:getItem(e.itemId).id,ask:null,listedAt:null}));s.trades=Number.isInteger(raw.trades)?raw.trades:0;s.totalProfit=Number.isFinite(raw.totalProfit)?raw.totalProfit:0;s.peak=Math.max(raw.cash,Number.isFinite(raw.peak)?raw.peak:100);s.won=raw.won===true;s.nextId=Math.max(s.nextId,...s.inventory.map(e=>e.uid+1));restock(s,rng);return validSave(s)?s:null;
}
