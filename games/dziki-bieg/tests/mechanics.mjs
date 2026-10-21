import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game,WIDTH,HEIGHT,PHYSICS_HZ,FOOT_OFFSET,CONE_SPAWN_CHANCE,MAX_SPEED_PER_FRAME} from '../dist/engine.js';
import {createPlatform,solidAt,solidIntervals,surfaceY,TERRAIN_TEMPLATES} from '../dist/terrain.js';
const tests=[],test=(name,fn)=>tests.push([name,fn]),tick=g=>g.update(1/34);
const near=(a,b,label,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<=tolerance,label+': '+a+' != '+b);
function random(seed){return()=>{let n=seed+=0x6d2b79f5;n=Math.imul(n^n>>>15,n|1);n^=n+Math.imul(n^n>>>7,n|61);return((n^n>>>14)>>>0)/4294967296;};}
function flatGame(){
  const g=new Game({random:random(1)});g.start();
  g.platforms=[0,1].map(()=>({x:-100000,y:224,width:1000000,bottom:10000}));
  g.stars=[];g.pixies=[];
  Object.assign(g.player,{bodyY:197.85,y:224,applyGravity:false,touchGround:1,grounded:true,
    animState:'run',thrust:0,gravity:0,jumps:0,upPress:false});
  return g;
}
function nativeRows(file='reference-motion.json'){
  const fixture=JSON.parse(readFileSync(new URL('./'+file,import.meta.url),'utf8'));
  return fixture.rows.map(values=>Object.fromEntries(fixture.fields.map((key,i)=>[key,values[i]])));
}
// The larger pickup box awards these fixture fairies one frame earlier:
// frame 38 instead of 39 (+10), and 164 instead of 165 (+20).
// All other scores and native movement remain directly comparable.
const refreshedFixtureScore=row=>row.score+(row.tick===38?10:row.tick===164?20:0);
function alignRecycledTerrain(g,row){
  for(let i=0;i<2;i++){
    const prefix='p'+(i+1),old=g.platforms[i],x=row[prefix+'x'],y=row[prefix+'y'],id=row[prefix+'template'];
    if(Math.abs(old.nativeCenterX-x)<1&&old.templateId===id)continue;
    // Recorded random geometry is supplied only after an offscreen recycle.
    // Player state and physics are never overwritten by this replay adapter.
    assert.ok(x>1000,'fixture geometry may change only offscreen after a recycle');
    const p=createPlatform(id,x+g.distance,y,.5);p.nativeCenterX=x;p.slot=i;g.platforms[i]=p;
    g.stars=g.stars.filter(a=>a.platformId!==i);g.pixies=g.pixies.filter(a=>a.platformId!==i);
    if(row[prefix+'starVisible'])g.stars.push({platformId:i,localX:row[prefix+'starX'],
      localY:row[prefix+'starY'],x:p.centerX+row[prefix+'starX'],y:p.y+row[prefix+'starY'],r:54,
      broken:row[prefix+'starFrame']!==1,missed:false});
    g.pixies.push({platformId:i,localX:row[prefix+'fairyX'],localY:row[prefix+'fairyY'],
      x:p.centerX+row[prefix+'fairyX'],y:p.y+row[prefix+'fairyY'],
      collected:row[prefix+'fairyFrame']!==1,missed:false});
  }
}
test('speed accelerates normally and settles at the raised 60-pixel cap',()=>{
  const g=flatGame();tick(g);near(g.speedPerFrame,14.01,'initial acceleration');
  g.speedPerFrame=59.995;tick(g);assert.equal(g.speedPerFrame,MAX_SPEED_PER_FRAME);
  for(let i=0;i<100;i++)tick(g);
  assert.equal(MAX_SPEED_PER_FRAME,60);assert.equal(g.speedPerFrame,60);assert.equal(g.speed,2040);assert.equal(g.state,'playing');
});

test('actual original runtime: 169 input frames match position, camera, energy, score and movement state',()=>{
  const g=new Game({random:random(42)});g.start();
  // Legacy environment adapter: the original fixture begins without obstacles;
  // the refreshed game intentionally rolls pinecones on its initial platforms.
  g.stars=[];
  const rows=nativeRows();assert.equal(rows.length,169);
  for(const r of rows){
    g.player.jumpHeld=r.z;g.player.dashHeld=r.x;tick(g);
    const p=g.player,label='native frame '+r.tick;
    near(p.nativeX,r.nativeX,label+' x');near(p.bodyY,r.bodyY,label+' y');
    near(-g.cameraY,r.engineY,label+' camera');near(p.offset,r.offset,label+' dash lunge');
    near(p.airMeter,r.energy,label+' energy');near(p.chargeCoolDown,r.dashCooldown,label+' cooldown');
    near(p.thrust,r.thrust,label+' thrust');near(g.score,refreshedFixtureScore(r),label+' score');
    // The Ruffle observer runs before child timelines advance; charge frame 10
    // then invokes endCharge. Compare the completed frame on both sides.
    const endingCharge=r.anim==='charge'&&r.chargePlayhead===10;
    near(p.gravity,endingCharge?14:r.gravity,label+' gravity');
    near(p.chargeEndTime,endingCharge?10:r.linger,label+' lingering protection');
    assert.equal(p.animState,endingCharge?'jump':r.anim,label+' animation state');
    alignRecycledTerrain(g,r);
  }
});

function groundedCone(g,cone){
  const p=g.platforms[cone.platformId],floor=surfaceY(p,cone.x);
  assert.ok(cone.x-38.05>=p.x&&cone.x+32.05<=p.x+p.width,'cone box must fit inside its platform');
  assert.ok(Number.isFinite(floor),'cone must have a walkable lane beneath it');
  near(cone.y+55.4,floor,'cone bottom touches ground');
  assert.equal(solidAt(p,cone.x,floor+.01),true,'ground must be solid');
  near(cone.localX,cone.x-p.centerX,'local horizontal attachment');
  near(cone.localY,cone.y-p.y,'local vertical attachment');
}
test('both opening tutorial platforms are exempt and consume no cone rolls',()=>{
  assert.equal(CONE_SPAWN_CHANCE,2/3);
  for(const roll of [0,.5,.99]){
    let calls=0;const g=new Game({random:()=>{calls++;return roll;}});calls=0;g.start();
    assert.equal(calls,0);assert.equal(g.stars.length,0);
    for(const [i,p] of g.platforms.entries()){
      assert.equal(p.ordinal,i+1);assert.equal(p.coneExempt,true);
      p.coneRolled=false;g.spawnPinecone(p);
    }
    assert.equal(calls,0);assert.equal(g.stars.length,0);
  }
});

test('the tutorial cone begins at 100 points and the next shatter adds 200',()=>{
  const g=new Game({random:()=>0});g.start();assert.equal(g.stars.length,0);
  g.platforms[0].nativeCenterX=-1495;g.moveWorld(14);g.pixies=[];
  const first=g.stars[0];assert.ok(first);
  const p=createPlatform(1,5200,350,.5);p.slot=2;g.platforms.push(p);
  const second=g.spawnPinecone(p);assert.ok(second);
  for(const cone of [first,second]){
    g.player.x=cone.x-g.distance;g.player.y=cone.y+55.4;g.player.animState='charge';g.collect();
    assert.equal(cone.broken,true);assert.equal(g.bonus,cone===first?100:300);
  }
  assert.equal(g.starChain,2);
});

test('post-tutorial recycled platforms use the two-thirds threshold at every speed',()=>{
  for(const speed of [14,20,35,50,60])for(const roll of [0,2/3-Number.EPSILON,2/3,.99]){
    const g=new Game({random:()=>.99});g.start();g.platformSerial=3;let calls=0;
    g.random=()=>{calls++;return calls===5?roll:.5;};
    g.platforms[0].nativeCenterX=-1495;g.moveWorld(speed);
    const cones=g.stars.filter(s=>s.platformId===0);
    assert.equal(cones.length,roll<2/3?1:0,'speed '+speed+' threshold '+roll);
    assert.equal(calls,6,'one cone roll, alongside four terrain draws and one fairy draw');
    cones.forEach(cone=>groundedCone(g,cone));
  }
});
test('all terrain templates ground one cone, including deterministic fallback from gaps and invalid markers',()=>{
  const g=new Game({random:()=>0});g.start();
  for(const raw of TERRAIN_TEMPLATES)for(const roll of [0,.5]){
    g.random=()=>roll;
    const p=createPlatform(raw.id,200,350,.5);p.slot=0;g.platforms=[p];g.stars=[];
    assert.ok(g.spawnPinecone(p),'template '+raw.id+' attachment roll '+roll+' must support a cone');groundedCone(g,g.stars[0]);
    const cone=g.stars[0];cone.broken=true;g.spawnPinecone(p);
    assert.equal(g.stars.length,1,'a broken cone cannot respawn on the same platform');
  }
  const p={slot:0,x:0,y:224,width:500,centerX:250,bottom:10000,
    points:[{x:0,y:0},{x:100,y:0},{x:180,y:null},{x:300,y:null},{x:400,y:0},{x:500,y:0}],
    dots:{dot2:{x:250},dot3:{x:900}}};
  g.platforms=[p];g.stars=[];assert.ok(g.spawnPinecone(p),'a nearby solid top must replace unusable markers');
  groundedCone(g,g.stars[0]);
});
test('large seeded samples keep openings clear and ordinary platforms near two thirds',()=>{
  const g=new Game({random:random(751)});let recycled=0;const samples=3000;
  for(let i=0;i<samples;i++){g.setupWish();assert.equal(g.stars.length,0);}
  g.platformSerial=3;
  for(let i=0;i<samples;i++){
    g.platforms[0].nativeCenterX=-1501;g.platforms[1].nativeCenterX=1600;g.moveWorld(14);
    const cones=g.stars.filter(s=>s.platformId===0);assert.ok(cones.length<=1);recycled+=cones.length;
  }
  assert.ok(Math.abs(recycled/samples-2/3)<.03,'ordinary platform sample rate '+recycled/samples);
});

test('every wish repeats clear-clear-guaranteed tutorial and then ordinary platforms',()=>{
  for(let seed=0;seed<100;seed++){
    const g=new Game({random:random(seed)});g.start();
    for(let wish=1;wish<=3;wish++){
      assert.equal(g.stars.length,0,'seed '+seed+' wish '+wish+' openings');
      assert.ok(g.platforms.every(p=>p.coneExempt));
      g.platforms[0].nativeCenterX=-1495;g.moveWorld(14);
      assert.equal(g.platforms[0].ordinal,3);assert.equal(g.platforms[0].coneGuaranteed,true);
      assert.equal(g.stars.filter(s=>s.platformId===0).length,1,'third platform always has a cone');
      groundedCone(g,g.stars[0]);const count=g.stars.length;g.spawnPinecone(g.platforms[0]);
      assert.equal(g.stars.length,count,'third platform cannot reroll or duplicate');
      if(wish<3){g.score=0;g.die('fixture');g.continue();}
    }
    g.start();assert.equal(g.stars.length,0);assert.equal(g.platformSerial,2);
  }
  const g=new Game({random:()=>.999});g.start();g.platforms[0].nativeCenterX=-1495;g.moveWorld(14);
  assert.equal(g.stars.length,1,'a failed probability roll cannot suppress tutorial cone');
  g.platforms[1].nativeCenterX=-1495;g.moveWorld(14);
  assert.equal(g.platforms[1].ordinal,4);assert.equal(g.platforms[1].coneGuaranteed,false);
  assert.equal(g.stars.filter(s=>s.platformId===1).length,0,'fourth platform rolls normally');
});

test('actual original runtime: 75 star encounter frames match world movement, hit frame, score and dash recovery',()=>{
  const g=new Game({random:random(43)});g.start();g.starChain=0;
  const platform=g.platforms[0];
  g.stars=[{platformId:0,localX:506.1,localY:-316.05,
    x:platform.centerX+506.1,y:platform.y-316.05,r:54,broken:false,missed:false}];
  const rows=nativeRows('reference-star.json');assert.equal(rows.length,75);let hitTick=0;
  for(const r of rows){
    g.player.jumpHeld=r.z;g.player.dashHeld=r.x;tick(g);
    const p=g.player,label='native star frame '+r.tick;
    near(p.nativeX,r.nativeX,label+' world x');near(p.bodyY,r.bodyY,label+' world y');
    near(p.offset,r.offset,label+' lunge');near(p.airMeter,r.energy,label+' energy');
    near(p.chargeCoolDown,r.dashCooldown,label+' cooldown');near(g.score,refreshedFixtureScore(r),label+' score');
    const endingCharge=r.anim==='charge'&&r.chargePlayhead===10;
    near(p.gravity,endingCharge?14:r.gravity,label+' gravity');
    near(p.chargeEndTime,endingCharge?10:r.linger,label+' protection');
    assert.equal(p.animState,endingCharge?'jump':r.anim,label+' movement state');
    if(g.stars[0].broken&&!hitTick)hitTick=r.tick;
    // Original and remake intentionally use independent RNG. Impact camera noise
    // changes screen coordinates, while world physics remains directly comparable.
    if(!hitTick)near(-g.cameraY,r.engineY,label+' pre-impact camera');
  }
  assert.equal(hitTick,59);assert.equal(g.bonus,110);assert.equal(g.starChain,1);
  assert.ok(g.cameraX!==0||g.shake>0,'native impact camera must react after shattering');
});
function coneCollisionFixture(x=0,y=0){
  const g=flatGame();g.player.x=x;g.player.y=y;g.starChain=0;
  g.stars=[{x:0,y:0,r:54,broken:false,missed:false}];return g;
}
test('fairies collect from the expanded fringe on all sides, once, but not beyond it',()=>{
  for(const [x,y] of [[-76,0],[76,0],[0,-45],[0,95]]){
    const g=flatGame();Object.assign(g.player,{x,y});
    g.pixies=[{x:-3,y:0,nextBobPhase:0,collected:false,missed:false}];
    g.collect();assert.equal(g.pixies[0].collected,true,'expanded pickup '+[x,y]);
    assert.equal(g.bonus,10);assert.equal(g.pixieChain,1);
    g.collect();assert.equal(g.bonus,10,'a fairy awards its bonus only once');
  }
  for(const [x,y] of [[-82,0],[82,0],[0,-48],[0,98]]){
    const g=flatGame();Object.assign(g.player,{x,y});
    g.pixies=[{x:-3,y:0,nextBobPhase:0,collected:false,missed:false}];
    g.collect();assert.equal(g.pixies[0].collected,false,'outside pickup '+[x,y]);
    assert.equal(g.bonus,0);
  }
});
test('pinecones remain until well beyond the viewport, regardless of lunge and camera shake',()=>{
  for(const playerX of [60,180])for(const cameraX of [-40,0,40]){
    const g=flatGame();g.distance=1000;g.player.x=playerX;g.cameraX=cameraX;
    const cone={x:0,y:-300,broken:false,missed:false};g.stars=[cone];
    for(const screenX of [30,-20,-74,-127]){
      cone.x=g.distance+screenX;g.collect();
      assert.equal(cone.missed,false,'retain screen x='+screenX+' player='+playerX+' camera='+cameraX);
    }
    cone.x=g.distance-129-Math.max(0,cameraX);g.collect();assert.equal(cone.missed,true);
  }
});
test('slight pinecone overlap is safe on all four sides while deep undashed contact is lethal',()=>{
  for(const [x,y] of [[-59.6,0],[59.6,0],[0,-42.05],[0,107.35]]){
    const g=coneCollisionFixture(x,y);g.collect();assert.equal(g.state,'playing','safe visible overlap '+[x,y]);
    assert.equal(g.stars[0].broken,false);
  }
  const g=coneCollisionFixture();g.collect();assert.equal(g.state,'dead');assert.equal(g.stars[0].broken,false);
});
test('fatal cone contact retains only the struck cone reference and clears it for the next wish',()=>{
  const g=coneCollisionFixture(),cone=g.stars[0];
  g.stars.push({x:1000,y:0,r:54,broken:false,missed:false});g.collect();
  assert.equal(g.state,'dead');assert.equal(g.death.cone,cone,'the renderer receives the actual struck cone');
  assert.equal(cone.broken,false,'a fatal impact must not shatter the cone');
  assert.equal(g.death.age,0);near(g.death.duration,30/34,'unchanged death timing');
  const control=coneCollisionFixture();control.die('fixture');
  assert.equal(control.death.cone,null,'non-cone deaths have no impact reference');
  assert.deepEqual(g.particles,control.particles,'the impact reference must not consume RNG or alter death particles');
  assert.deepEqual(g.scores,control.scores,'collision scoring is unchanged');
  g.continue();assert.equal(g.death,null,'the next wish clears the old impact');
  for(const cause of ['You crashed into the hillside.','Your dreams are just out of reach.']){
    const other=flatGame();other.die(cause);assert.equal(other.death.cone,null,'wall/fall fallback '+cause);
  }
});
test('pinecone lethal boundaries are tangent-safe and kill just inside each inset edge',()=>{
  const boundaries=[[-54.6,0,.001,0],[54.6,0,-.001,0],[0,-38.05,0,.001],[0,103.35,0,-.001]];
  for(const [x,y,dx,dy] of boundaries){
    const tangent=coneCollisionFixture(x,y);tangent.collect();
    assert.equal(tangent.state,'playing','exact tangent '+[x,y]);
    const penetrating=coneCollisionFixture(x+dx,y+dy);penetrating.collect();
    assert.equal(penetrating.state,'dead','inside inset edge '+[x+dx,y+dy]);
  }
});
test('active and recovering dashes retain the full original outer pinecone shatter box',()=>{
  for(const [x,y] of [[-59.6,0],[59.6,0],[0,-42.05],[0,107.35]])for(const recovery of [false,true]){
    const g=coneCollisionFixture(x,y);
    if(recovery)g.player.chargeEndTime=1;else g.player.animState='charge';
    g.collect();assert.equal(g.state,'playing');assert.equal(g.stars[0].broken,true);
    assert.equal(g.bonus,100,'outer shatter keeps its original score');
  }
});
test('a last-moment X saves the next real simulation tick after visible overlap begins',()=>{
  const approach=()=>{
    const g=flatGame();g.starChain=0;g.stars=[{x:133.6,y:193,r:54,broken:false,missed:false}];
    tick(g);assert.equal(g.state,'playing');
    assert.ok(g.distance+g.player.x+26.55>g.stars[0].x-38.05,'sprite has entered the outer box');
    assert.equal(g.stars[0].broken,false);return g;
  };
  const saved=approach();assert.equal(saved.dash(),true);tick(saved);
  assert.equal(saved.state,'playing');assert.equal(saved.stars[0].broken,true);assert.equal(saved.bonus,100);
  const unsaved=approach();tick(unsaved);assert.equal(unsaved.state,'dead');
  assert.equal(unsaved.stars[0].broken,false);
});
test('16:9 viewport preserves the native 34 Hz accumulator and startup across render rates',()=>{
  near(WIDTH/HEIGHT,16/9,'widescreen aspect');assert.equal(HEIGHT,480);assert.equal(PHYSICS_HZ,34);
  const a=new Game({random:random(7)}),b=new Game({random:random(7)});a.start();b.start();
  near(a.player.bodyY,-41.25,'native spawn');near(a.cameraY,-102,'native camera spawn');
  a.update(1/68);assert.equal(a.ticks,0);a.update(1/68);assert.equal(a.ticks,1);
  for(let i=1;i<34;i++)tick(a);for(let i=0;i<120;i++)b.update(1/120);
  near(a.player.bodyY,b.player.bodyY,'render partition y');near(a.cameraY,b.cameraY,'render partition camera');
  near(a.player.nativeX,b.player.nativeX,'render partition x');assert.equal(a.score,b.score);
});
test('jump release preserves momentum and the second jump requires a new sampled press',()=>{
  const g=flatGame();g.jump();tick(g);const vy=g.player.vy;g.releaseJump();near(g.player.vy,vy,'release velocity');
  tick(g);g.jump();tick(g);assert.equal(g.player.jumps,1,'an early second press must not jump');
  g.releaseJump();tick(g);for(let i=0;i<8;i++)tick(g);g.jump();tick(g);
  assert.equal(g.player.jumps,2);assert.ok(g.player.vy<0);
});
test('native ceiling contact pushes out and reduces thrust instead of instantly killing',()=>{
  const g=flatGame();g.platforms=[{x:-10000,y:100,width:100000,bottom:130}];
  Object.assign(g.player,{bodyY:173.85,y:200,applyGravity:true,touchGround:0,animState:'jump',thrust:14,gravity:0,jumps:1});
  tick(g);tick(g);assert.equal(g.state,'playing');near(g.player.thrust,7,'ceiling thrust');
  assert.ok(g.player.y>=187&&g.player.y<=190);
});
test('actual original runtime: 18 upper-limit frames preserve gravity and follow the pre-clamp body position',()=>{
  const g=new Game({random:()=>.5});g.start();g.stars=[];
  g.platforms.forEach(p=>{p.y=10000;});
  Object.assign(g.player,{bodyY:-595,y:-595+FOOT_OFFSET,gravity:0,thrust:14,
    applyGravity:true,animState:'jump',touchGround:0,jumps:1,upPress:false});
  const fixture=JSON.parse(readFileSync(new URL('./reference-ceiling.json',import.meta.url),'utf8'));
  assert.equal(fixture.rows.length,18);
  for(const [frame,x,y,camera,gravity,thrust] of fixture.rows){
    tick(g);const label='native upper-limit frame '+frame;
    near(g.player.nativeX,x,label+' x');near(g.player.bodyY,y,label+' y');
    near(-g.cameraY,camera,label+' camera');near(g.player.gravity,gravity,label+' gravity');
    near(g.player.thrust,thrust,label+' thrust');assert.ok(g.player.bodyY>=-600);
  }
});
test('cone combos add 100 per shatter and reset once on a real miss, independently of visual despawn',()=>{
  const g=flatGame();assert.equal(g.starChain,0);g.player.animState='charge';
  const add=()=>{
    const cone={x:g.distance+g.player.x+10,y:g.player.y-31,r:54,broken:false,missed:false};
    g.stars.push(cone);g.collect();return cone;
  };
  add();assert.equal(g.bonus,100);
  add();assert.equal(g.bonus,300);
  add();assert.equal(g.bonus,600);assert.equal(g.starChain,3);
  g.pixieChain=4;
  const miss={x:g.distance+g.player.x-65,y:900,r:54,broken:false,missed:false};
  g.stars.push(miss);g.collect();
  assert.equal(g.starChain,0);assert.equal(g.pixieChain,4);
  assert.equal(miss.comboMissed,true);assert.equal(miss.missed,false,'keep the visible cone until offscreen');
  add();assert.equal(g.bonus,700);assert.equal(g.starChain,1);
  g.collect();assert.equal(g.starChain,1,'an already missed cone cannot reset the new combo repeatedly');
  miss.x=g.distance-200;g.collect();
  assert.equal(miss.missed,true);assert.equal(g.starChain,1,'later visual despawn cannot break a new combo');
});

test('empty platforms, new cones, and recycled broken cones never reset an active combo',()=>{
  const g=new Game({random:()=>.99});g.start();g.starChain=3;g.pixieChain=4;g.platformSerial=3;
  const recycle=()=>{g.platforms[0].nativeCenterX=-1495;g.moveWorld(14);};
  for(let i=0;i<3;i++){
    recycle();assert.equal(g.stars.length,0);assert.equal(g.starChain,3);
  }
  g.random=()=>0;recycle();
  assert.equal(g.stars.length,1);assert.equal(g.starChain,3,'spawn after empty platforms preserves combo');
  g.stars[0].broken=true;recycle();
  assert.equal(g.starChain,3,'recycling a broken cone preserves combo');
  assert.equal(g.pixieChain,4,'terrain recycling cannot affect fairy combo');
});

test('fairies award 10, 20, 30 then restart at 10 after a miss without resetting cones',()=>{
  const g=flatGame();g.starChain=5;
  const add=()=>{
    g.pixies.push({x:g.distance+g.player.x-3,y:g.player.y-30,nextBobPhase:0,collected:false,missed:false});
    g.collect();
  };
  add();assert.equal(g.bonus,10);
  add();assert.equal(g.bonus,30);
  add();assert.equal(g.bonus,60);assert.equal(g.pixieChain,3);
  g.pixies.push({x:g.distance+g.player.x-100,y:900,collected:false,missed:false});g.collect();
  assert.equal(g.pixieChain,0);assert.equal(g.starChain,5);
  add();assert.equal(g.bonus,70);assert.equal(g.pixieChain,1);
});

test('a cone still within the dash collision box has not been missed',()=>{
  const g=flatGame();g.starChain=3;g.player.y=-1000;
  const cone={x:g.distance+g.player.x-64.59,y:224,broken:false,missed:false};g.stars=[cone];
  g.collect();assert.equal(g.starChain,3);assert.equal(cone.comboMissed,undefined);
  cone.x-=.02;g.collect();assert.equal(g.starChain,0);assert.equal(cone.comboMissed,true);
});

test('a simultaneous miss resets before a shatter even when objects are stored out of order',()=>{
  const g=flatGame();g.starChain=4;g.player.animState='charge';
  g.stars=[{x:g.player.x,y:g.player.y-31,broken:false,missed:false},
    {x:g.player.x-80,y:900,broken:false,missed:false}];
  g.collect();assert.equal(g.bonus,100);assert.equal(g.starChain,1);
});
test('native fields retain separate ceilings, walkable shelves and air gaps',()=>{
  assert.equal(TERRAIN_TEMPLATES.length,20);let checked=false;
  for(const raw of TERRAIN_TEMPLATES){
    const p=createPlatform(raw.id,0,300);
    for(let x=p.x+10;x<p.x+p.width-10;x+=20){
      const spans=solidIntervals(p,x);
      if(spans.length>=2&&spans[1][0]-spans[0][1]>5){
        const air=(spans[0][1]+spans[1][0])/2;
        assert.equal(solidAt(p,x,air),false);
        assert.equal(solidAt(p,x,(spans[0][0]+spans[0][1])/2),true);checked=true;break;
      }
    }
  }assert.ok(checked,'the reference contains overhead formations, not a single infinite floor');
});
test('equal-count terrain topology changes preserve air between the ceiling and main floor',()=>{
  const p=createPlatform(2,200,300);
  // Near x=488.9 the next sampled ceiling splits while a lower shelf ends.
  // Both columns have three spans, but matching spans by index would fill air.
  for(let x=488;x<=490;x+=.1){
    assert.equal(solidAt(p,p.x+x,p.y-500),false,'phantom seam at local x='+x);
    assert.equal(solidAt(p,p.x+x,p.y-1000),true,'ceiling must remain solid');
    assert.equal(solidAt(p,p.x+x,p.y-100),true,'main floor must remain solid');
  }
});
test('two platform slots recycle using the native speed-dependent template pool',()=>{
  const g=new Game({random:()=>.5});g.start();g.platforms[0].nativeCenterX=-1495;g.moveWorld(14);
  assert.equal(g.platforms.length,2);assert.equal(g.platforms[0].templateId,5);
  assert.ok(g.platforms[0].nativeCenterX>g.platforms[1].nativeCenterX);
});
test('three wishes sum scores, pause stops simulation and restart preserves the best',()=>{
  const g=flatGame();tick(g);g.pause();const before=[g.ticks,g.player.y,g.score,g.cameraY];
  for(let i=0;i<20;i++)tick(g);assert.deepEqual([g.ticks,g.player.y,g.score,g.cameraY],before);g.pause();
  for(let wish=1;wish<=3;wish++){g.score=100*wish+.9;g.die('test');assert.equal(g.state,wish===3?'over':'dead');if(wish<3)g.continue();}
  assert.deepEqual(g.scores,[100,200,300]);assert.equal(g.total,600);g.start();assert.equal(g.best,600);assert.equal(g.wish,1);
});
test('death keeps the impact pose, freezes live motion and lasts the native 30 animation frames',()=>{
  const g=flatGame();tick(g);const pose={...g.player},world=[g.ticks,g.distance,g.player.x,g.player.y];
  g.score=138;g.die('fixture');const death=g.death;
  assert.equal(g.state,'dead');assert.equal(death.age,0);near(death.duration,30/34,'native explosion duration');
  assert.deepEqual(death.pose,pose);assert.notEqual(death.pose,g.player);assert.equal(g.player.dead,true);
  near(death.x,pose.x,'impact x');near(death.y,pose.y,'impact feet y');
  g.die('duplicate');assert.equal(g.death,death);assert.deepEqual(g.scores,[138],'death counts only once');
  for(let i=0;i<29;i++)tick(g);
  near(death.age,29/34,'frame before result');assert.ok(death.age<death.duration);
  tick(g);near(death.age,death.duration,'result transition time');
  assert.deepEqual([g.ticks,g.distance,g.player.x,g.player.y],world,'the world and live player stop on impact');
  assert.deepEqual(death.pose,pose,'animation must retain the frozen impact pose');
  g.continue();assert.equal(g.death,null,'the next wish clears the previous explosion');assert.equal(g.wish,2);
  g.start();assert.equal(g.death,null,'a fresh game has no old fragments');
});
let failures=0;
for(const [name,fn] of tests){try{fn();console.log('PASS '+name);}catch(error){failures++;console.error('FAIL '+name+'\n'+error.stack);}}
console.log('\n'+(tests.length-failures)+'/'+tests.length+' tests passed (including 262 actual original runtime frames).');
if(failures)process.exitCode=1;
