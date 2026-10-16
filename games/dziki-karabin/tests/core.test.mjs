import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OBSTACLES,WEAPONS,blocked,moveBody,settleDeath,winningTeam,reloadAmmo,purchaseWeapon,findPath} from '../dist/core.js';

test('one elimination gives exactly 5 coins and cannot pay twice',()=>{
  const victim={alive:true,health:20,deaths:0,team:1},killer={isPlayer:true,kills:0,team:0};
  const result=settleDeath(victim,killer,10);assert.equal(result.wallet,15);assert.equal(killer.kills,1);assert.equal(victim.deaths,1);
  assert.equal(settleDeath(victim,killer,result.wallet).wallet,15);assert.equal(killer.kills,1);
});
test('death costs one coin without going below zero',()=>{
  for(const [before,after]of [[5,4],[0,0]]){const victim={alive:true,isPlayer:true,health:100,deaths:0,team:0};assert.equal(settleDeath(victim,{team:1,kills:0},before).wallet,after);}
});
test('a round ends only after a team is completely eliminated',()=>{
  const a=Array.from({length:10},(_,i)=>({team:i<5?0:1,alive:true}));assert.equal(winningTeam(a),null);
  a.slice(5,9).forEach(p=>p.alive=false);assert.equal(winningTeam(a),null);a[9].alive=false;assert.equal(winningTeam(a),0);
  a.forEach(p=>p.alive=p.team===1);assert.equal(winningTeam(a),1);
});
test('reload transfers only available reserve and does not create ammunition',()=>{
  assert.deepEqual(reloadAmmo(4,7,24),{ammo:11,reserve:0});assert.deepEqual(reloadAmmo(20,72,24),{ammo:24,reserve:68});assert.deepEqual(reloadAmmo(0,0,24),{ammo:0,reserve:0});
});
test('purchase refuses insufficient funds and owned weapons cost nothing to equip',()=>{
  const owned=new Set(['k24']);assert.equal(purchaseWeapon('scout',10,owned).ok,false);assert.equal(owned.has('scout'),false);
  const result=purchaseWeapon('viper',20,owned);assert.equal(result.wallet,5);assert.equal(owned.has('viper'),true);assert.equal(purchaseWeapon('viper',5,owned).wallet,5);
});
test('navigation routes safely between all spawn positions and enemy territory',()=>{
  for(const side of [-1,1])for(let i=0;i<5;i++){
    const x=side*27.5,z=(i-2)*3.6;assert.equal(blocked(x,z,.43),false);
    const path=findPath(x,z,-x,-z);assert.ok(path.length>0,'bot can cross the map');
    for(const p of path)assert.equal(blocked(p.x,p.z,.43),false);
    const body={x,z};for(const next of path){for(let j=0;j<150&&Math.hypot(next.x-body.x,next.z-body.z)>.12;j++){const d=Math.hypot(next.x-body.x,next.z-body.z);moveBody(body,(next.x-body.x)/d*.08,(next.z-body.z)/d*.08,.43);}assert.ok(Math.hypot(next.x-body.x,next.z-body.z)<.2,'route is physically traversable');}
  }
});
test('solid cover blocks movement and permits sliding along it',()=>{
  const p={x:-3,z:0};moveBody(p,1,.3,.4);assert.equal(p.x,-3);assert.equal(p.z,.3);
  assert.ok(OBSTACLES.length>10);assert.equal(WEAPONS[0].price,0);
});
