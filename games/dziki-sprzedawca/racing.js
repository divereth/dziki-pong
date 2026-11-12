export const RACE_FEE=10000;
export const RACE_LAPS=3;
export const PRIZES=[200000,50000,10000];
export const CAR_STATS=Object.freeze({maxSpeed:24.5,acceleration:8.2,braking:17,width:2.05,length:4.4});
export const TRACK=Object.freeze({straight:160,radius:62,halfWidth:8,maxOffset:6.65,length:320+2*Math.PI*62});
export const DRIVER_NAMES=['Ty','Ruda','Turbo Mirek','Lis','Nocny','Żaba','Kosa','Pestka','Borys','Iskra'];
export const CAR_COLORS=['#e8bb42','#d65a4b','#64a3c7','#85b87e','#ac7bba','#e5e0d5','#e48543','#567eac','#d980a2','#537d6c'];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const money=n=>Math.round(n*100)/100;

// Distance follows the closed centre line. Lateral offset is measured to the
// right, so an inside line is shorter on the two left-hand bends.
export function trackPoint(distance,offset=0){
  const {straight:s,radius:r,length}=TRACK;
  let d=(((distance+s/2)%length)+length)%length,x,z,tx,tz,curvature=0;
  if(d<s){x=-s/2+d;z=-r;tx=1;tz=0;}
  else if((d-=s)<Math.PI*r){const a=-Math.PI/2+d/r;x=s/2+r*Math.cos(a);z=r*Math.sin(a);tx=-Math.sin(a);tz=Math.cos(a);curvature=1/r;}
  else if((d-=Math.PI*r)<s){x=s/2-d;z=r;tx=-1;tz=0;}
  else{d-=s;const a=Math.PI/2+d/r;x=-s/2+r*Math.cos(a);z=r*Math.sin(a);tx=-Math.sin(a);tz=Math.cos(a);curvature=1/r;}
  return {x:x+tz*offset,z:z-tx*offset,tx,tz,curvature,heading:Math.atan2(tx,tz)};
}

export function createRace(seed=1,raceId=0){
  const grid=[1,2,3,4,5,6,0,7,8,9];
  return {version:1,raceId,seed:seed>>>0,phase:'countdown',countdown:3,elapsed:0,contacts:0,contactTimes:{},cars:DRIVER_NAMES.map((name,id)=>{
    const slot=grid.indexOf(id);
    return {id,name,progress:-8-Math.floor(slot/2)*7,offset:slot%2?2.5:-2.5,speed:0,lateralSpeed:0,steer:0,laps:0,lapTimes:[],lastLapAt:0,finishTime:null,contact:0,wallAt:-10,targetLane:((id*3+seed)%6-2.5)*1.85};
  })};
}

export function validRaceSnapshot(r){
  if(!r||r.version!==1||!Number.isInteger(r.raceId)||r.raceId<0||!Number.isInteger(r.seed)||!['countdown','racing','finishing','finished'].includes(r.phase)||!Number.isFinite(r.countdown)||r.countdown<0||r.countdown>3||!Number.isFinite(r.elapsed)||r.elapsed<0||!Number.isInteger(r.contacts)||r.contacts<0||!r.contactTimes||typeof r.contactTimes!=='object'||Object.entries(r.contactTimes).some(([key,time])=>!/^\d:\d$/.test(key)||!Number.isFinite(time)||time<0)||!Array.isArray(r.cars)||r.cars.length!==10)return false;
  return r.cars.every((c,id)=>c.id===id&&Number.isFinite(c.progress)&&c.progress>=-80&&Number.isFinite(c.offset)&&Math.abs(c.offset)<=TRACK.maxOffset+.001&&Number.isFinite(c.speed)&&c.speed>=0&&c.speed<=CAR_STATS.maxSpeed+.001&&Number.isFinite(c.lateralSpeed)&&Math.abs(c.lateralSpeed)<20&&Number.isFinite(c.steer)&&Number.isFinite(c.contact)&&Number.isFinite(c.targetLane)&&Number.isFinite(c.wallAt)&&Number.isInteger(c.laps)&&c.laps>=0&&c.laps<=3&&Array.isArray(c.lapTimes)&&c.lapTimes.length===c.laps&&c.lapTimes.every(t=>Number.isFinite(t)&&t>0)&&Number.isFinite(c.lastLapAt)&&c.lastLapAt>=0&&(c.finishTime===null||Number.isFinite(c.finishTime)&&c.finishTime>0&&c.finishTime<=r.elapsed+1e-6&&c.laps===3&&c.progress>=3*TRACK.length))&&
    (r.phase!=='finished'||r.cars.every(c=>c.finishTime!==null))&&(r.phase!=='finishing'||r.cars[0].finishTime!==null);
}

export class RaceEngine{
  constructor(snapshot=createRace()){
    if(!validRaceSnapshot(snapshot))throw new Error('Nieprawidłowy zapis wyścigu');
    this.data=structuredClone(snapshot);this.data.cars.forEach(c=>c.name=DRIVER_NAMES[c.id]);
  }
  snapshot(){return structuredClone(this.data);}
  standings(){return [...this.data.cars].sort((a,b)=>a.finishTime!==null?(b.finishTime!==null?a.finishTime-b.finishTime||a.id-b.id:-1):b.finishTime!==null?1:b.progress-a.progress||a.id-b.id);}
  get position(){return this.standings().findIndex(c=>c.id===0)+1;}
  driverInput(car){
    const r=this.data,phase=(car.id*1.73+(r.seed%101)*.11),curve=trackPoint(car.progress).curvature;
    let lane=car.targetLane+Math.sin(r.elapsed*.16+phase)*.55;
    const ahead=r.cars.filter(c=>c.id!==car.id&&c.finishTime===null&&c.progress>car.progress&&c.progress-car.progress<15&&Math.abs(c.offset-car.offset)<2.15).sort((a,b)=>a.progress-b.progress)[0];
    let brake=0;
    if(ahead){
      const lanes=[-5.65,-2.9,0,2.9,5.65].filter(value=>!r.cars.some(c=>c.id!==car.id&&Math.abs(c.progress-car.progress)<8&&Math.abs(c.offset-value)<2.2));
      if(lanes.length)lane=lanes.sort((a,b)=>Math.abs(a-car.offset)-Math.abs(b-car.offset))[0];
      else if(ahead.progress-car.progress<7&&car.speed>ahead.speed)brake=.35;
    }
    // Drivers share the player's exact acceleration and top speed. Traffic,
    // racing lines and contact, rather than engine handicaps, create gaps.
    const steer=clamp((lane-car.offset)*.65-car.lateralSpeed*.22,-1,1);
    if(curve&&Math.abs(car.offset)>6.1)brake=Math.max(brake,.08);
    return {throttle:1,brake,steer};
  }
  update(dt,input={}){
    if(!Number.isFinite(dt)||dt<=0||this.data.phase==='finished')return;
    let remaining=Math.min(dt,1);
    while(remaining>1e-8){const step=Math.min(remaining,1/120);this.step(step,input);remaining-=step;}
  }
  step(dt,input){
    const r=this.data;
    if(r.phase==='countdown'){
      const used=Math.min(dt,r.countdown);r.countdown-=used;dt-=used;
      if(r.countdown>1e-8)return;r.countdown=0;r.phase='racing';if(dt<=1e-8)return;
    }
    if(r.phase==='finished')return;
    const previous=r.cars.map(c=>c.progress),startTime=r.elapsed;r.elapsed+=dt;
    for(const c of r.cars){
      c.contact=Math.max(0,c.contact-dt);
      const control=c.id===0&&c.finishTime===null?input:this.driverInput(c);
      const throttle=clamp(Number(control.throttle)||0,0,1),brake=clamp(Number(control.brake)||0,0,1),steer=clamp(Number(control.steer)||0,-1,1);
      c.steer+= (steer-c.steer)*Math.min(1,dt*10);
      const drag=throttle?0:1.4;
      c.speed=clamp(c.speed+(throttle*CAR_STATS.acceleration-brake*CAR_STATS.braking-drag)*dt,0,c.finishTime===null?CAR_STATS.maxSpeed:14);
      const targetLateral=steer*Math.min(4.7,c.speed*.23);
      c.lateralSpeed+=(targetLateral-c.lateralSpeed)*Math.min(1,dt*7);
      c.offset+=c.lateralSpeed*dt;
      if(Math.abs(c.offset)>TRACK.maxOffset){
        c.offset=clamp(c.offset,-TRACK.maxOffset,TRACK.maxOffset);c.lateralSpeed*=-.12;
        if(r.elapsed-c.wallAt>.35){c.speed*=.78;c.contact=.28;c.wallAt=r.elapsed;}
      }
      const factor=1+trackPoint(c.progress).curvature*c.offset;
      c.progress+=c.speed*dt/factor;
    }
    this.collisions(dt);
    for(const c of r.cars){
      while(c.laps<RACE_LAPS&&c.progress>=(c.laps+1)*TRACK.length){
        const line=(c.laps+1)*TRACK.length,span=c.progress-previous[c.id];
        const crossing=startTime+dt*clamp((line-previous[c.id])/Math.max(.00001,span),0,1);
        c.lapTimes.push(crossing-c.lastLapAt);c.lastLapAt=crossing;c.laps++;
        if(c.laps===RACE_LAPS){c.finishTime=crossing;if(c.id===0)r.phase='finishing';}
      }
    }
    if(r.cars.every(c=>c.finishTime!==null))r.phase='finished';
  }
  collisions(dt){
    const r=this.data;
    for(let i=0;i<r.cars.length;i++)for(let j=i+1;j<r.cars.length;j++){
      const a=r.cars[i],b=r.cars[j];if(a.finishTime!==null||b.finishTime!==null)continue;
      let ds=a.progress-b.progress;ds-=Math.round(ds/TRACK.length)*TRACK.length;
      const dl=a.offset-b.offset;
      if(Math.abs(ds)>=CAR_STATS.length||Math.abs(dl)>=CAR_STATS.width)continue;
      const key=`${i}:${j}`,last=r.contactTimes[key]??-10;
      if(r.elapsed-last>.42){a.speed*=.8;b.speed*=.8;a.contact=b.contact=.35;r.contacts++;r.contactTimes[key]=r.elapsed;}
      if(Math.abs(dl)/CAR_STATS.width>Math.abs(ds)/CAR_STATS.length){
        const push=(CAR_STATS.width-Math.abs(dl))*.51,sign=dl>=0?1:-1;
        a.offset=clamp(a.offset+sign*push,-TRACK.maxOffset,TRACK.maxOffset);b.offset=clamp(b.offset-sign*push,-TRACK.maxOffset,TRACK.maxOffset);
        a.lateralSpeed*=.5;b.lateralSpeed*=.5;
      }else{
        const push=(CAR_STATS.length-Math.abs(ds))*.51,sign=ds>=0?1:-1;
        a.progress+=sign*push;b.progress-=sign*push;
      }
    }
  }
}

export function ensureRacing(state){
  if(!state.racing||!Number.isInteger(state.racing.nextId)||state.racing.nextId<1)state.racing={nextId:1,lastClaimedId:0,active:null};
  const ledger=state.racing;
  if(!Number.isInteger(ledger.lastClaimedId)||ledger.lastClaimedId<0)ledger.lastClaimedId=0;
  if(ledger.active&&(!Number.isInteger(ledger.active.id)||ledger.active.id<=ledger.lastClaimedId||!validRaceSnapshot(ledger.active.snapshot)||ledger.active.snapshot.raceId!==ledger.active.id))ledger.active=null;
  ledger.nextId=Math.max(ledger.nextId,ledger.lastClaimedId+1,(ledger.active?.id??0)+1);
  return ledger;
}
export function beginRace(state,seed=1){
  const ledger=ensureRacing(state);
  if(ledger.active)return {ok:false,reason:'active',message:'Masz już rozpoczęty wyścig. Dokończ go bez kolejnej opłaty.'};
  if(!state.blackMarket?.unlocked)return {ok:false,reason:'locked',message:'Najpierw wejdź na Czarny Rynek.'};
  if(state.cash<RACE_FEE)return {ok:false,reason:'cash',message:'Na udział w wyścigu potrzebujesz 10 000 zł.'};
  state.cash=money(state.cash-RACE_FEE);const id=ledger.nextId++;ledger.active={id,snapshot:createRace(seed,id)};
  return {ok:true,charged:RACE_FEE,session:ledger.active};
}
export function saveRace(state,engine){
  const active=ensureRacing(state).active;if(active&&active.id===engine.data.raceId)active.snapshot=engine.snapshot();
}
export function claimRaceReward(state){
  const ledger=ensureRacing(state),active=ledger.active;
  if(!active||active.snapshot.phase!=='finished')return {ok:false,reason:'unfinished'};
  const engine=new RaceEngine(active.snapshot),position=engine.position,prize=PRIZES[position-1]??0;
  state.cash=money(state.cash+prize);state.peak=Math.max(state.peak,state.cash);
  ledger.lastClaimedId=active.id;ledger.active=null;
  return {ok:true,position,prize};
}
