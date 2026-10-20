import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game,PHYSICS_HZ} from '../dist/engine.js';
import {createPlatform} from '../dist/terrain.js';
import {Presentation} from '../dist/presentation.js';
const tests=[],test=(name,fn)=>tests.push([name,fn]),step=1/PHYSICS_HZ;
const near=(a,b,label,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<=tolerance,`${label}: ${a} != ${b}`);
function random(seed){return()=>{let n=seed+=0x6d2b79f5;n=Math.imul(n^n>>>15,n|1);n^=n+Math.imul(n^n>>>7,n|61);return((n^n>>>14)>>>0)/4294967296;};}
function make(seed=7){
  const game=new Game({random:random(seed)});game.start();
  // These motion-only presentation fixtures intentionally omit new obstacles.
  game.stars=[];return game;
}
const physics=g=>({ticks:g.ticks,state:g.state,wish:g.wish,score:g.score,distance:g.distance,
  cameraY:g.cameraY,cameraX:g.cameraX,accumulator:g.accumulator,player:{...g.player,
    rotationHistory:[...g.player.rotationHistory]},platforms:g.platforms.map(p=>({x:p.x,y:p.y,centerX:p.centerX,
      nativeCenterX:p.nativeCenterX,templateId:p.templateId})),stars:g.stars.map(a=>({...a})),pixies:g.pixies.map(a=>({...a}))});

test('presentation sampling leaves the measured 34 Hz simulation unchanged',()=>{
  const fixture=JSON.parse(readFileSync(new URL('./reference-motion.json',import.meta.url),'utf8'));
  const fields=Object.fromEntries(fixture.fields.map((key,i)=>[key,i]));
  const control=make(11),g=make(11),p=new Presentation(g);
  for(const row of fixture.rows){
    for(const game of [g,control]){
      game.player.jumpHeld=row[fields.z];game.player.dashHeld=row[fields.x];game.update(step);
    }
    const before=physics(g),view=p.sample();p.sample();
    assert.deepEqual(physics(g),before,'sampling must never write interpolated values into physics');
    assert.deepEqual(physics(g),physics(control),'wrapping step must preserve every simulated result');
    assert.notEqual(view.player,g.player,'the renderer must receive a separate player view');
  }
});

for(const rate of [60,120])test(`${rate} Hz rendering scrolls on every frame while physics stays at 34 Hz`,()=>{
  const g=make(),p=new Presentation(g);for(let i=0;i<20;i++)g.update(step);
  let view=p.sample(),distance=view.distance,screenX=view.platforms[0].x-view.distance;
  const deltas=[];const startTicks=g.ticks;
  for(let i=0;i<rate;i++){
    g.update(1/rate);view=p.sample();
    const x=view.platforms[0].x-view.distance;
    assert.ok(view.distance>distance,`render frame ${i} must advance between simulation ticks`);
    assert.ok(x<screenX,`render frame ${i} must scroll terrain between simulation ticks`);
    deltas.push(screenX-x);distance=view.distance;screenX=x;
  }
  assert.equal(g.ticks-startTicks,34,'render rate must not change physics frequency');
  assert.ok(Math.max(...deltas)/Math.min(...deltas)<1.2,'scroll must not alternate between still frames and full ticks');
});

test('a slow render frame interpolates the last adjacent simulation steps',()=>{
  const control=make(),g=make(),p=new Presentation(g);
  control.update(step);const one=control.distance;
  control.update(step);const two=control.distance;
  control.update(step);const three=control.distance;
  g.update(step*3.5);const view=p.sample();
  assert.equal(g.ticks,3);near(view.distance,(two+three)/2,'last-step midpoint');
  assert.ok(view.distance>one,'must not interpolate from the start of the whole render frame');
  near(view.player.y,(control.player.y+(-40.05+26.15))/2,'adjacent falling positions');
});

test('recycled terrain and a new wish appear at their actual positions without interpolation across identities',()=>{
  const g=make(),p=new Presentation(g);g.update(step*1.5);p.sample();
  const replacement=createPlatform(2,2100,350,.5);replacement.slot=0;g.platforms[0]=replacement;
  const replaced=p.sample();near(replaced.platforms[0].x,replacement.x,'new terrain x');
  near(replaced.platforms[0].y,replacement.y,'new terrain y');
  const firstPlayer=g.player;g.score=100;g.die('fixture');g.continue();
  const next=p.sample();assert.notEqual(g.player,firstPlayer);
  near(next.distance,0,'wish reset distance');near(next.player.y,g.player.y,'wish reset player');
  near(next.cameraY,g.cameraY,'wish reset camera');
});

test('pause and resume reset snapshots without changing simulation state',()=>{
  const g=make(),p=new Presentation(g);g.update(step*1.5);p.sample();
  g.pause();p.reset();let view=p.sample();
  near(view.distance,g.distance,'pause current world');near(view.player.y,g.player.y,'pause current player');
  const before=physics(g);for(let i=0;i<30;i++){g.update(1/120);p.sample();}
  assert.deepEqual(physics(g),before,'pause must stop physics');
  g.pause();p.reset();view=p.sample();near(view.distance,g.distance,'resume current world');
  g.update(step*.1);view=p.sample();near(view.distance,g.distance,'resume must not travel backward');
});

test('angle wrapping stays forward and collision/event states remain current',()=>{
  const g=make();g.player.anim=Math.PI*2-.08;
  g.stars=[{x:120,y:100,broken:false,missed:false}];
  g.step=function(){this.ticks++;this.player.anim=.04;this.player.animState='charge';
    this.player.gravity=7;this.player.jumps=2;this.stars[0].broken=true;};
  const p=new Presentation(g);g.step();g.accumulator=step/2;
  let view=p.sample();near(view.player.anim,Math.PI*2-.02,'animation wrap midpoint');
  assert.equal(view.player.animState,'charge');assert.equal(view.player.jumps,2);
  assert.equal(view.player.gravity,7,'a new movement state must not inherit the old pose gravity');
  assert.equal(view.stars[0].broken,true,'destroyed stars must disappear immediately');
  g.die('fixture');view=p.sample();assert.equal(view.state,'dead');
  near(view.player.y,g.player.y,'death position must not interpolate backward');
});

let failures=0;
for(const [name,fn] of tests){try{fn();console.log('PASS '+name);}catch(error){failures++;console.error('FAIL '+name+'\n'+error.stack);}}
console.log(`\n${tests.length-failures}/${tests.length} presentation tests passed.`);
if(failures)process.exitCode=1;
