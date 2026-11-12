import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {newState,restoreSave,checkWin} from './economy.js';
import {unlockBlackMarket} from './black-market.js';
import {MarketWorld} from './world.js';
import {Underworld} from './underworld.js';
import {RaceWorld} from './race-world.js';
import {RaceEngine,createRace,trackPoint,TRACK,CAR_STATS,beginRace,saveRace,claimRaceReward,ensureRacing,validRaceSnapshot} from './racing.js';

const driver=e=>{const c=e.data.cars[0];return {throttle:1,steer:Math.max(-1,Math.min(1,(-5.4-c.offset)*.8-c.lateralSpeed*.22))};};
function complete(engine){for(let i=0;i<16000&&engine.data.phase!=='finished';i++)engine.update(1/60,driver(engine));assert.equal(engine.data.phase,'finished');return engine;}
const completed=complete(new RaceEngine(createRace(42,1))).snapshot();
function stateForRace(cash=20000){const state=newState();unlockBlackMarket(state,'button');state.cash=cash;return state;}

test('closed circuit is continuous, points are finite and a centre-line lap is about 30 seconds',()=>{
  assert.ok(TRACK.length/CAR_STATS.maxSpeed>28&&TRACK.length/CAR_STATS.maxSpeed<31);
  for(const distance of [0,160,160+Math.PI*62,320+Math.PI*62,TRACK.length]){
    const a=trackPoint(distance-.001),b=trackPoint(distance+.001);
    assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.003);assert.ok(Math.hypot(a.tx-b.tx,a.tz-b.tz)<.001);
  }
  const a=trackPoint(-20),b=trackPoint(TRACK.length-20);assert.deepEqual(a,b);
});
test('10 cars wait for the countdown and all share the same acceleration and maximum speed',()=>{
  const e=new RaceEngine();const initial=e.snapshot();e.update(1,{throttle:1});assert.equal(e.data.elapsed,0);assert.deepEqual(e.data.cars,initial.cars);
  e.data.phase='racing';e.data.countdown=0;e.data.cars.forEach((c,i)=>{c.progress=i*65;c.offset=0;});e.driverInput=()=>({throttle:1});
  for(let i=0;i<300;i++)e.update(1/60,{throttle:1});
  assert.equal(e.data.cars.length,10);for(const c of e.data.cars)assert.equal(c.speed,CAR_STATS.maxSpeed);
});
test('three real laps finish every driver, record times and rank by crossing order',()=>{
  assert.equal(completed.cars.length,10);assert.ok(completed.elapsed<105);
  for(const c of completed.cars){assert.equal(c.laps,3);assert.equal(c.lapTimes.length,3);assert.ok(c.lapTimes.every(t=>t>24&&t<42));assert.ok(Math.abs(c.lapTimes.reduce((a,b)=>a+b,0)-c.finishTime)<1e-6);assert.ok(c.progress>=3*TRACK.length);}
  const e=new RaceEngine(completed),order=e.standings();assert.ok(order.every((c,i)=>i===0||c.finishTime>=order[i-1].finishTime));assert.equal(e.position,1);assert.ok(validRaceSnapshot(e.snapshot()));
});
test('car contacts reduce both speeds without destroying cars; barriers contain either steering direction',()=>{
  const e=new RaceEngine();e.data.phase='racing';e.data.countdown=0;e.driverInput=()=>({throttle:1});
  e.data.cars.forEach((c,i)=>{c.progress=70*i;c.offset=0;c.speed=24;});
  e.data.cars[0].progress=20;e.data.cars[1].progress=23;e.update(.02,{throttle:1});
  assert.ok(e.data.cars[0].speed<22);assert.ok(e.data.cars[1].speed<22);assert.ok(e.data.contacts>0);assert.equal(e.data.cars.length,10);
  for(const direction of [-1,1])for(let i=0;i<600;i++){e.update(1/60,{throttle:1,steer:direction});assert.ok(e.data.cars.every(c=>Math.abs(c.offset)<=TRACK.maxOffset+.00001));}
  assert.equal(e.data.cars.length,10);assert.ok(e.data.cars.every(c=>c.health===undefined&&Number.isFinite(c.progress)));
});
test('10,000 entry is charged exactly once per race and insufficient funds do not begin a race',()=>{
  const poor=stateForRace(9999);assert.equal(beginRace(poor).reason,'cash');assert.equal(poor.cash,9999);assert.equal(poor.racing.active,null);
  const locked=newState();locked.cash=20000;assert.equal(beginRace(locked).reason,'locked');
  const state=stateForRace();assert.equal(beginRace(state,42).charged,10000);assert.equal(state.cash,10000);assert.equal(beginRace(state).reason,'active');assert.equal(state.cash,10000);
  assert.equal(claimRaceReward(state).ok,false);assert.equal(state.cash,10000);
});
test('podium rewards are 200,000 / 50,000 / 10,000; claims and old sessions cannot pay twice',()=>{
  for(const [place,expected] of [[1,200000],[2,50000],[3,10000],[4,0]]){
    const state=stateForRace(30000);beginRace(state);const result=structuredClone(completed);
    const ids=[...Array(10).keys()].filter(id=>id!==0);ids.splice(place-1,0,0);
    ids.forEach((id,i)=>{const c=result.cars[id];c.finishTime=90+i;c.lastLapAt=c.finishTime;c.lapTimes=[30,30,30+i];});result.elapsed=100;
    const old=new RaceEngine(result);saveRace(state,old);
    const claim=claimRaceReward(state);assert.deepEqual(claim,{ok:true,position:place,prize:expected});assert.equal(state.cash,20000+expected);
    assert.equal(claimRaceReward(state).ok,false);assert.equal(state.cash,20000+expected);
    beginRace(state);const current=structuredClone(state.racing.active);saveRace(state,old);assert.deepEqual(state.racing.active,current);assert.equal(claimRaceReward(state).ok,false);
  }
});
test('JSON reload preserves the race and its contact cooldowns without another entry charge',()=>{
  const state=stateForRace();const session=beginRace(state,42).session,e=new RaceEngine(session.snapshot);
  for(let i=0;i<2100;i++)e.update(1/60,driver(e));saveRace(state,e);
  const restored=restoreSave(JSON.parse(JSON.stringify(state)));ensureRacing(restored);const resumed=new RaceEngine(restored.racing.active.snapshot);
  assert.equal(beginRace(restored).reason,'active');assert.equal(restored.cash,10000);
  for(let i=0;i<1000;i++){e.update(1/60,driver(e));resumed.update(1/60,driver(resumed));}
  assert.deepEqual(resumed.snapshot(),e.snapshot());
  const broken=structuredClone(state);broken.racing.active.snapshot.cars[0].offset=Infinity;assert.equal(ensureRacing(broken).active,null);
});
test('a race prize can complete the million-zloty objective once',()=>{
  const state=stateForRace(820000);beginRace(state);saveRace(state,new RaceEngine(completed));claimRaceReward(state);assert.equal(state.cash,1010000);assert.equal(checkWin(state),true);assert.equal(checkWin(state),false);
});
test('racing door is inside the far end of the black market and is selectable',()=>{
  const previous=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
  try{const scene=new T.Scene(),world={scene,person:MarketWorld.prototype.person,secretWindows:[],camera:new T.PerspectiveCamera(),renderer:{shadowMap:{}},ray:new T.Raycaster(),pointer:new T.Vector2()};const u=new Underworld(world,stateForRace());u.enter(true);world.camera.position.set(100,1.76,-34.2);world.camera.lookAt(100,1.35,-38.72);world.camera.updateMatrixWorld();scene.updateMatrixWorld(true);assert.equal(u.target().action,'race');assert.ok(u.walkable(100,-34.2));u.enter(false);scene.updateMatrixWorld(true);assert.notEqual(u.target()?.action,'race');}
  finally{globalThis.document=previous;}
});
test('the local CC0 racing car has an intact hash, ten shared copies and four animated wheel nodes each',async()=>{
  const info=JSON.parse(await readFile(new URL('./assets/racing/asset-info.json',import.meta.url))),bytes=await readFile(new URL('./assets/racing/race-car-v1.glb',import.meta.url));
  assert.equal(info.license,'CC0-1.0');assert.equal(createHash('sha256').update(bytes).digest('hex'),info.sha256);
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const oldDoc=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
  try{const bounds=new T.Box3().setFromObject(gltf.scene),scene=new T.Scene(),view={template:gltf.scene,modelScale:CAR_STATS.length/(bounds.max.z-bounds.min.z),modelCenter:bounds.getCenter(new T.Vector3()),modelFloor:bounds.min.y,scene,cars:[]};for(let i=0;i<10;i++)RaceWorld.prototype.makeCar.call(view,i);assert.equal(view.cars.length,10);assert.ok(view.cars.every(c=>c.wheels.length===4));assert.equal(new Set(view.cars.map(c=>c.paint.color.getHexString())).size,10);assert.ok(new T.Box3().setFromObject(view.cars[0].model).getSize(new T.Vector3()).z>4.39);}
  finally{globalThis.document=oldDoc;}
});
