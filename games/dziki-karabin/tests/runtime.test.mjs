import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as Three from '../dist/vendor/three.module.min.js';
import * as core from '../dist/core.js';
import {createTouchControls} from '../dist/touch-controls.js';

const source=(await readFile(new URL('../dist/game.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
function harness(seed=3,{touch=false}={}){
  const nodes=new Map();
  const context2d=new Proxy({},{get:(_t,p)=>p==='canvas'?{}:()=>{}});
  const makeNode=()=>{const events=new Map(),captures=new Set();return {style:{},classList:{toggle(){},add(){},remove(){}},appendChild(){},addEventListener(type,callback){if(!events.has(type))events.set(type,[]);events.get(type).push(callback);},emit(type,event={}){for(const callback of events.get(type)??[])callback({button:0,pointerId:1,clientX:60,clientY:60,preventDefault(){},stopPropagation(){},...event});},setPointerCapture(id){captures.add(id);},hasPointerCapture(id){return captures.has(id);},releasePointerCapture(id){captures.delete(id);},getBoundingClientRect(){return {left:0,top:0,width:120,height:120};},setAttribute(){},querySelector(){return makeNode();},getContext(){return context2d;},textContent:'',innerHTML:''};};
  const node=id=>{if(!nodes.has(id))nodes.set(id,makeNode());return nodes.get(id);};
  class Renderer{constructor(){this.shadowMap={};this.domElement=makeNode();this.domElement.requestPointerLock=()=>Promise.reject(new Error('No input in simulation'));}setPixelRatio(){}setSize(){}render(scene){scene.updateMatrixWorld(true);}}
  const randomMath=Object.create(Math);randomMath.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const context=vm.createContext({THREE:{...Three,WebGLRenderer:Renderer},...core,createTouchControls,Math:randomMath,performance,console,innerWidth:1280,innerHeight:800,devicePixelRatio:1,requestAnimationFrame(){},setTimeout(){},clearTimeout(){},document:{getElementById:node,createElement:makeNode,body:makeNode(),addEventListener(){},exitPointerLock(){},pointerLockElement:null},window:{addEventListener(){},matchMedia(){return {matches:touch};}},localStorage:{getItem:()=>null,setItem(){}},});
  vm.runInContext(source,context);
  return {run:script=>vm.runInContext(script,context),nodes};
}

test('the actual game spawns 10 characters in two teams and equips a finite rifle',()=>{
  const g=harness();g.run("startMatch();spawnRound();state='playing'");
  assert.equal(g.run('actors.length'),10);assert.equal(g.run('actors.filter(a=>a.team===0).length'),5);assert.equal(g.run('actors.filter(a=>a.team===1).length'),5);
  assert.equal(g.run('actors.filter(a=>a.isPlayer).length'),1);assert.equal(g.run('ammo'),24);assert.equal(g.run('reserve'),72);
});
test('actual hitscan awards a kill, cover stops bullets, and an empty gun cannot fire',()=>{
  const g=harness();g.run("startMatch();spawnRound();state='playing';actors.slice(1).forEach(a=>a.alive=false);actors[5].alive=true;actors[5].x=-20;actors[5].z=-7.2;actors[5].health=24;player.x=-25;player.z=-7.2;camera.position.set(-25,1.2,-7.2);camera.rotation.set(0,-Math.PI/2,0);scene.updateMatrixWorld(true);shoot()");
  assert.equal(g.run('actors[5].alive'),false);assert.equal(g.run('player.kills'),1);assert.equal(g.run('wallet'),15);assert.equal(g.run('scores[0]'),1);
  const before=g.run('ammo');g.run("nextShot=0;shoot()");assert.equal(g.run('ammo'),before,'round end prevents additional shots');
  g.run("spawnRound();state='playing';actors[5].x=3;actors[5].z=0;actors[5].health=100;camera.position.set(-3.1,1.2,0);camera.rotation.set(0,-Math.PI/2,0);scene.updateMatrixWorld(true);shoot()");
  assert.equal(g.run('actors[5].health'),100,'central tower stops hitscan');
  g.run('ammo=0;reserve=0;nextShot=0;shoot()');assert.equal(g.run('ammo'),0);assert.equal(g.run('reloading'),0);
});
test('a chest gives two reserve magazines and capped healing exactly once per round',()=>{
  const g=harness();g.run("startMatch();spawnRound();state='playing';player.x=-18;player.z=0;player.health=85;reserve=0;keySet.add('KeyE');updateInteraction(.9)");
  assert.equal(g.run('chests[0].opened'),true);assert.equal(g.run('reserve'),48);assert.equal(g.run('player.health'),100);
  g.run('updateInteraction(.9)');assert.equal(g.run('reserve'),48);g.run('spawnRound()');assert.equal(g.run('chests[0].opened'),false);
});
test('nine bots finish multiple elimination rounds without freezing behind cover',()=>{
  for(const seed of [7,42,2026]){
    const g=harness(seed);g.run("startMatch();spawnRound();state='playing'");
    // Leave the player at spawn, as a new player might, and run the real AI and combat.
    const elapsed=g.run(`(()=>{let elapsed=0;while(state==='playing'&&elapsed<180){updateBots(.05);scene.updateMatrixWorld(true);updateEffects(.05);elapsed+=.05;}return elapsed;})()`);
    assert.equal(g.run('state'),'roundEnd',`seed ${seed} must finish (simulated ${elapsed}s)`);
    assert.equal(g.run('scores[0]+scores[1]'),1);
  }
});
test('a 3 point match opens the final result, with correct death deductions',()=>{
  const g=harness();g.run("startMatch();spawnRound();state='playing';scores=[0,2];actors.slice(1,5).forEach(a=>{a.alive=false});damageActor(player,100,actors[5]);showResults()");
  assert.equal(g.run('scores[1]'),3);assert.equal(g.run('state'),'results');assert.equal(g.run('player.deaths'),1);assert.equal(g.run('wallet'),9);
  assert.equal(g.nodes.get('result-score').innerHTML,'0 <span>:</span> 3');
});

test('a killed bot becomes animated colored cubes, with no duplicate death effect',()=>{
  const g=harness();g.run("startMatch();spawnRound();state='playing';damageActor(actors[5],100,player)");
  assert.equal(g.run('actors[5].mesh.visible'),false);
  assert.equal(g.run('deathBursts.length'),1);
  assert.ok(g.run('deathBursts[0].cubes.length')>50);
  assert.equal(g.run('deathBursts[0].mesh.count===deathBursts[0].cubes.length'),true);
  assert.ok(g.run('new Set(deathBursts[0].cubes.map(c=>c.color.getHex())).size')>3,'helmet, skin and equipment keep their colors');
  g.run('const firstCubeStart=deathBursts[0].cubes[0].position.clone();updateDeathBursts(.1)');
  assert.ok(g.run('deathBursts[0].cubes[0].position.distanceTo(firstCubeStart)')>.1);
  g.run('damageActor(actors[5],100,player)');assert.equal(g.run('deathBursts.length'),1);assert.equal(g.run('wallet'),15);
  g.run('for(let i=0;i<60;i++)updateDeathBursts(.05)');assert.equal(g.run('deathBursts.length'),0);
});

test('player death also shatters, and a new round clears old cubes and restores models',()=>{
  const g=harness();g.run("startMatch();spawnRound();state='playing';const initialSceneSize=scene.children.length;damageActor(player,100,actors[5])");
  assert.equal(g.run('deathBursts.length'),1);
  assert.equal(g.run('scene.children.length'),g.run('initialSceneSize+1'),'temporary player model is removed');
  g.run('damageActor(actors[6],100,actors[1])');assert.equal(g.run('deathBursts.length'),2);
  g.run('spawnRound()');assert.equal(g.run('deathBursts.length'),0);assert.equal(g.run('player.alive'),true);assert.equal(g.run('actors[6].mesh.visible'),true);
  assert.equal(g.run('scene.children.length'),g.run('initialSceneSize'));
});

test('touch starts a round without pointer lock and combines movement, aiming and fire',()=>{
  const g=harness(3,{touch:true});g.run('startMatch();startRound()');assert.equal(g.run('touchMode'),true);assert.equal(g.run('state'),'playing');
  const startX=g.run('player.x'),startYaw=g.run('yaw');
  g.nodes.get('touch-joystick').emit('pointerdown',{pointerId:11,clientY:10});
  g.nodes.get('touch-fire').emit('pointerdown',{pointerId:22});
  g.nodes.get('touch-fire').emit('pointermove',{pointerId:22,clientX:90});
  g.run('nextShot=0;updatePlayer(.1)');
  assert.ok(g.run('player.x')>startX);assert.ok(g.run('yaw')<startYaw);assert.ok(g.run('ammo')<24);
  g.nodes.get('touch-joystick').emit('pointerup',{pointerId:11});assert.equal(g.run('touchInput.x'),0);assert.equal(g.run('touchInput.y'),0);assert.equal(g.run('touchInput.fire'),true);
  g.run('pauseGame()');assert.equal(g.run('touchInput.fire'),false);assert.equal(g.run('touchInput.aim'),false);assert.equal(g.run('state'),'paused');
});

test('touch buttons switch weapon, reload and open a chest without a keyboard',()=>{
  const g=harness(3,{touch:true});g.run('startMatch();startRound()');
  g.nodes.get('touch-weapon').emit('click');assert.equal(g.run('equipped'),2);
  g.nodes.get('touch-weapon').emit('click');assert.equal(g.run('equipped'),1);
  g.run('ammo=5');g.nodes.get('touch-reload').emit('click');assert.ok(g.run('reloading')>0);
  g.run('player.x=-18;player.z=0;player.health=40;reserve=0;updateInteraction(0)');
  assert.equal(g.nodes.get('touch-interact').disabled,false);
  g.nodes.get('touch-interact').emit('pointerdown');g.run('updateInteraction(.9)');
  assert.equal(g.run('chests[0].opened'),true);assert.equal(g.run('reserve'),48);assert.equal(g.run('player.health'),70);
});

test('held touch fire respects the DMR single shot trigger and touch jump works',()=>{
  const g=harness(3,{touch:true});g.run("startMatch();selectedWeapon=WEAPONS[3];startRound()");
  g.nodes.get('touch-fire').emit('pointerdown');assert.equal(g.run('ammo'),9);
  g.run('nextShot=0;updatePlayer(.1)');assert.equal(g.run('ammo'),9,'holding the semi automatic trigger must not auto fire');
  g.nodes.get('touch-fire').emit('pointerup');g.nodes.get('touch-fire').emit('pointerdown');assert.equal(g.run('ammo'),8);
  g.nodes.get('touch-jump').emit('pointerdown',{pointerId:7});g.run('updatePlayer(.1)');assert.ok(g.run('eyeHeight')>1.72);
});
