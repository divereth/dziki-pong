import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cameraExtent,cameraView} from '../dist/camera.js';
import {Game,WIDTH,HEIGHT} from '../dist/engine.js';
import {HoofCadence} from '../dist/gait.js';
import {AudioSystem} from '../dist/audio.js';

test('the original camera framing stays fixed across run time, speed and player motion',()=>{
 const game=new Game({random:()=>.5});game.start();
 const original={extent:1,scale:1,left:0,top:0,width:WIDTH,height:HEIGHT,right:WIDTH,bottom:HEIGHT};
 for(const [seconds,speed]of [[0,14],[4,15.36],[25,22.5],[50,31],[140,60]]){
  game.ticks=seconds*34;game.speedPerFrame=speed;game.player.x+=10;game.player.y-=20;game.cameraY+=15;
  const before=JSON.stringify(game);
  assert.equal(cameraExtent(seconds,speed),1);assert.deepEqual(cameraView(game),original);
  assert.equal(JSON.stringify(game),before,'render framing must not change terrain tracking or physics');
 }
});

test('gait contacts follow half-cycle landings and never occur airborne, charging or paused',()=>{
 const cadence=new HoofCadence(),p={grounded:true,animState:'run',anim:0};
 assert.equal(cadence.contact(p,true),false);
 p.anim=1;assert.equal(cadence.contact(p,true),false);
 p.anim=3.2;assert.equal(cadence.contact(p,true),true);
 p.anim=3.4;assert.equal(cadence.contact(p,true),false);
 p.anim=6.4;assert.equal(cadence.contact(p,true),true);
 p.grounded=false;p.anim=3.3;assert.equal(cadence.contact(p,true),false);
 p.grounded=true;p.animState='charge';assert.equal(cadence.contact(p,true),false);
 p.animState='run';assert.equal(cadence.contact(p,false),false);
 assert.equal(cadence.contact(p,true),false,'resuming cannot replay old contacts');
});
test('running audio stops existing hoof voices on takeoff and obeys effects volume',()=>{
 const audio=new AudioSystem();audio.context={state:'running'};let strikes=0,stopped=0;
 audio.hoofStep=()=>strikes++;
 const p={grounded:true,animState:'run',anim:0};audio.updateRunning(p,true);
 p.anim=1;audio.updateRunning(p,true);p.anim=3.2;audio.updateRunning(p,true);assert.equal(strikes,1);
 audio.hoofSources.add({stop(){stopped++;}});p.grounded=false;audio.updateRunning(p,true);assert.equal(stopped,1);
 p.grounded=true;p.anim=0;audio.effectsVolume=0;audio.updateRunning(p,true);
 p.anim=3.2;audio.updateRunning(p,true);assert.equal(strikes,1);
 audio.effectsVolume=1;p.anim=3.3;audio.updateRunning(p,true);assert.equal(strikes,1);
 p.anim=6.4;audio.updateRunning(p,true);assert.equal(strikes,2);
 audio.updateRunning(p,false);assert.equal(audio.hoofSources.size,0);
});
