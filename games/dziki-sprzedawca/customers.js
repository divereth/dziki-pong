import {CATEGORIES,customerPurchase,listedItems,negotiationLimit,negotiatedPurchase,round} from './economy.js';
import {STANDS,PLAYER_SHOP} from './layout.js';
const NAMES=['Ania','Marek','Zosia','Tomek','Basia','Kuba','Ola','Piotr','Iga','Leon','Maja','Adam','Ewa','Filip','Hania','Jan','Klara','Wojtek'];
export class CustomerMarket{
  constructor(state,onEvent=()=>{},rng=Math.random){
    this.state=state;this.onEvent=onEvent;this.rng=rng;this.reservations=new Map();
    this.customers=NAMES.map((name,i)=>({id:i,name,x:(i%3-1)*1.4,z:i<4?9+i*.45:1-(i-4)*4.4,budget:0,preferred:CATEGORIES[i%CATEGORIES.length].id,tolerance:.25+rng()*.75,speed:1.35+rng()*.45,route:[],stage:'walking',wait:0,destination:null,bag:false,bubble:'',bubbleTime:0,phase:i*1.8,wantedUid:null,negotiation:null}));
    this.customers.forEach(c=>this.chooseDestination(c));
  }
  routeTo(c,destination){
    const lane=(c.id%2?1:-1)*(1.15+(c.id%3)*.38);
    const point=destination==='player'?{x:PLAYER_SHOP.approach.x-.45+(c.id%6)*.8,z:PLAYER_SHOP.approach.z-.3+Math.floor(c.id/6)*.85}:(()=>{const [x,z,r]=STANDS[destination];return {x:x+Math.sin(r)*2.35,z:z+Math.cos(r)*2.35}})();
    c.destination=destination;c.stage='walking';c.wait=0;c.wantedUid=null;c.route=[{x:lane,z:c.z},{x:lane,z:point.z},{x:point.x,z:point.z}];
    c.budget=Math.max(220,this.state.peak*1.5)*(.45+this.rng()*.8);
  }
  chooseDestination(c){
    const available=[...new Set(this.state.offers.filter(o=>!o.sold).map(o=>o.stand))];
    if(listedItems(this.state).length&&(this.rng()<.4||!available.length))this.routeTo(c,'player');else if(available.length)this.routeTo(c,available[Math.floor(this.rng()*available.length)]);else this.routeTo(c,'player');
  }
  notifyListings(){
    if(!listedItems(this.state).length||this.customers.some(c=>c.destination==='player'&&!['resting','waiting'].includes(c.stage)))return;
    const eligible=this.customers.filter(c=>!['negotiating','waiting'].includes(c.stage));
    const nearest=eligible.sort((a,b)=>Math.hypot(a.x-PLAYER_SHOP.x,a.z-PLAYER_SHOP.z)-Math.hypot(b.x-PLAYER_SHOP.x,b.z-PLAYER_SHOP.z))[0];if(nearest)this.routeTo(nearest,'player');
  }
  beginNegotiation(id){
    const c=this.customers.find(c=>c.id===id),entry=this.state.inventory.find(e=>e.uid===c?.wantedUid&&e.ask!==null);
    if(!c||c.stage!=='waiting'||!entry)return {ok:false,message:'Ten klient nie czeka teraz na negocjacje.'};
    if(this.reservations.has(entry.uid))return {ok:false,message:'Ktoś inny negocjuje już zakup tego przedmiotu.'};
    const limit=negotiationLimit(this.state,c,entry);c.negotiation={uid:entry.uid,rounds:0,counter:round(Math.max(.01,Math.min(entry.ask,limit*.9)))};c.stage='negotiating';c.walking=false;this.reservations.set(entry.uid,c.id);
    return {ok:true,customer:c,entry,counter:c.negotiation.counter};
  }
  offer(id,price){
    const c=this.customers.find(c=>c.id===id),deal=c?.negotiation;
    if(!deal||c.stage!=='negotiating'||this.reservations.get(deal.uid)!==id)return {ok:false,reason:'missing'};
    const result=negotiatedPurchase(this.state,c,deal.uid,price);
    if(result.ok){this.finishNegotiation(c,'Dogadane!');c.bag=true;this.onEvent(result);return result}
    if(result.reason==='invalid')return result;
    const entry=this.state.inventory.find(e=>e.uid===deal.uid&&e.ask!==null);
    if(!entry){this.finishNegotiation(c,'Może innym razem');return {ok:false,reason:'missing'}}
    deal.rounds++;if(deal.rounds>=3){this.finishNegotiation(c,'Nie dogadamy się');return {ok:false,reason:'ended'}}
    const limit=negotiationLimit(this.state,c,entry);deal.counter=round(Math.min(limit,deal.counter+(limit-deal.counter)*.6));
    return {ok:false,reason:'counter',counter:deal.counter,rounds:deal.rounds};
  }
  finishNegotiation(c,bubble){if(c.negotiation)this.reservations.delete(c.negotiation.uid);c.negotiation=null;c.wantedUid=null;c.stage='resting';c.wait=5;c.bubble=bubble;c.bubbleTime=4}
  cancelNegotiation(id){const c=this.customers.find(c=>c.id===id);if(c?.stage==='negotiating')this.finishNegotiation(c,'Może następnym razem')}
  update(dt){
    const changed=[];
    for(const c of this.customers){
      if(c.stage==='negotiating')continue;
      c.bubbleTime=Math.max(0,c.bubbleTime-dt);
      if(c.stage==='walking'){
        const p=c.route[0];if(!p){c.stage='browsing';c.wait=1.8+this.rng()*2.2;c.walking=false;continue}
        const dx=p.x-c.x,dz=p.z-c.z,d=Math.hypot(dx,dz),step=c.speed*dt;c.walking=d>.05;c.heading=Math.atan2(dx,dz);
        if(d<=step){c.x=p.x;c.z=p.z;c.route.shift()}else{c.x+=dx/d*step;c.z+=dz/d*step}
      }else if(c.stage==='browsing'){
        c.wait-=dt;if(c.wait>0)continue;const result=customerPurchase(this.state,c,c.destination,this.reservations);
        c.bag=result.ok||c.bag;c.stage='resting';c.wait=3+this.rng()*3;
        if(!result.ok&&result.reason==='price'&&c.destination==='player'&&result.uid){c.stage='waiting';c.wait=50;c.wantedUid=result.uid;c.bubble='Za drogo · porozmawiaj';c.bubbleTime=50}
        else{c.bubble=result.ok?'Biorę!':result.reason==='price'?'Za drogo…':'Rozejrzę się';c.bubbleTime=3.5}
        if(result.ok){changed.push(result);this.onEvent(result)}
      }else{
        if(c.stage==='waiting'&&!this.state.inventory.some(e=>e.uid===c.wantedUid&&e.ask!==null)){c.bubble='Rozejrzę się';c.bubbleTime=3;c.wait=0}
        c.wait-=dt;if(c.wait<=0)this.chooseDestination(c);
      }
    }
    return changed;
  }
}
