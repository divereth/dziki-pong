import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {Game} from '../dist/engine.js';
import {demoRandom,DemoController} from '../dist/demo.js';
import {demoSnapshot,forecastGame,applyDemoAction,planDemo} from '../dist/demo-planner.js';

test('forecasting uses unchanged physical rules and does not touch the live world or its random stream',()=>{
 let calls=0;const random=demoRandom(82),game=new Game({random:()=>{calls++;return random();}});game.start();
 const initial=demoSnapshot(game),before=JSON.stringify(initial),count=calls;
 const forecast=forecastGame(initial);const plan=planDemo(initial,{width:8,horizon:30});
 assert.equal(JSON.stringify(demoSnapshot(game)),before);assert.equal(JSON.stringify(initial),before);assert.equal(calls,count);assert.equal(plan.forecast,30);assert.ok(plan.actions.every(action=>Number.isInteger(action)&&action>=0&&action<=3));
 for(let tick=0;tick<75;tick++){
  const action=tick<10?1:tick<18?0:tick<30?1:tick<34?3:0;
  applyDemoAction(game,action);applyDemoAction(forecast,action);game.update(1/34);forecast.step();
  for(const field of ['x','y','gravity','thrust','jumps','airMeter','offset','dashFrames','animState','grounded'])assert.equal(forecast.player[field],game.player[field],field+' at '+tick);
  assert.equal(forecast.distance,game.distance);assert.equal(forecast.score,game.score);
 }
});

test('recorded AI inputs replay to 105,948 points in one wish without changing terrain, resources or scoring',()=>{
 const reference=JSON.parse(fs.readFileSync(new URL('./demo-reference.json',import.meta.url))),game=new Game({random:demoRandom(reference.seed)});game.start();
 for(const [action,length]of reference.runs)for(let frame=0;frame<length;frame++){
  assert.equal(game.state,'playing');applyDemoAction(game,action);game.update(1/34);
 }
 assert.equal(game.ticks,reference.ticks);assert.equal(game.wish,1);assert.equal(game.score,reference.score);assert.ok(game.score>=100000);assert.equal(game.state,'playing');
});

test('demo worker results are isolated by session and stop releases controls and the worker',()=>{
 const previous=globalThis.Worker,workers=[];
 globalThis.Worker=class{constructor(){this.messages=[];workers.push(this);}postMessage(message){this.messages.push(message);}terminate(){this.terminated=true;}};
 try{
  const game=new Game(),demo=new DemoController(game);assert.equal(demo.prepare(),true);const worker=workers[0],job=worker.messages[0];
  worker.onmessage({data:{id:job.id,generation:job.generation,plan:{tick:0,actions:Array(60).fill(1)},duration:50}});
  assert.equal(demo.ready,true);game.start();game.update(1/34);assert.equal(game.player.jumpHeld,true);assert.equal(worker.messages.length,2);
  demo.stop();assert.equal(worker.terminated,true);assert.equal(game.player.jumpHeld,false);assert.equal(game.player.dashHeld,false);assert.equal(demo.enabled,false);
  worker.onmessage({data:{id:job.id,generation:job.generation,plan:{tick:0,actions:[3]},duration:50}});assert.equal(demo.ready,false);assert.equal(demo.active,null);
 }finally{globalThis.Worker=previous;}
});
