import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cameraExtent,cameraView} from '../dist/camera.js';
import {Game,WIDTH,HEIGHT} from '../dist/engine.js';
import {HoofCadence} from '../dist/gait.js';
import {AudioSystem} from '../dist/audio.js';

test('camera reveals 75%, then 90%, then 125% of the world with continuous monotonic easing',()=>{
 assert.equal(cameraExtent(0,14),.75);assert.equal(cameraExtent(4,15.36),.9);assert.equal(cameraExtent(50,31),1.25);
 assert.equal(cameraExtent(120,60),1.25);
 let previous=.75;
 for(let frame=0;frame<=60*70;frame++){
  const seconds=frame/60,current=cameraExtent(seconds,Math.min(60,14+seconds*.34));
  assert.ok(current>=previous-1e-10);assert.ok(current-previous<.003);previous=current;
 }
});
test('opening camera keeps the entire boar in view and sampling never changes simulation',()=>{
 const game=new Game({random:()=>.5});game.start();const before=JSON.stringify(game);
 const view=cameraView(game),foot=(game.player.y-game.cameraY-view.top)/view.extent;
 assert.ok(foot>150&&foot<HEIGHT-50);assert.ok(foot-72/view.extent>0);
 assert.equal(view.width,WIDTH*.75);assert.equal(view.height,HEIGHT*.75);
 assert.equal(JSON.stringify(game),before);
 game.ticks=1700;game.speedPerFrame=31;assert.equal(cameraView(game).extent,1.25);
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
