import {test} from 'node:test';
import assert from 'node:assert/strict';
import {joystickVector,createTouchControls} from '../dist/touch-controls.js';

function element(){
  const listeners=new Map(),captured=new Set();
  return {style:{},classList:{add(){},remove(){},toggle(){}},captured,
    getBoundingClientRect:()=>({left:0,top:0,width:120,height:120}),
    setPointerCapture(id){captured.add(id);},hasPointerCapture(id){return captured.has(id);},releasePointerCapture(id){captured.delete(id);},
    addEventListener(type,callback){listeners.set(type,callback);},
    emit(type,id,x=60,y=60){listeners.get(type)?.({pointerId:id,clientX:x,clientY:y,button:0,preventDefault(){},stopPropagation(){}});}
  };
}
function setup(){
  const joystick=element(),knob=element(),lookZone=element(),buttons=Object.fromEntries(['fire','aim','jump','interact'].map(key=>[key,element()]));
  const looks=[];let shots=0,enabled=true;
  const controls=createTouchControls({joystick,knob,lookZone,buttons,canControl:()=>enabled,onLook:(x,y)=>looks.push([x,y]),onFire:()=>shots++});
  return {joystick,knob,lookZone,buttons,looks,controls,shots:()=>shots,disable:()=>{enabled=false;}};
}
test('joystick has a dead zone, analogue speed and a capped diagonal',()=>{
  assert.deepEqual(joystickVector(0,0,40),{x:0,y:0});assert.deepEqual(joystickVector(2,0,40),{x:0,y:0});
  const half=joystickVector(20,0,40);assert.ok(half.x>0&&half.x<1);assert.equal(half.y,0);
  const diagonal=joystickVector(80,-80,40);assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.y)-1)<1e-9);
});
test('three fingers retain independent movement, look and fire ownership',()=>{
  const g=setup();g.joystick.emit('pointerdown',1,60,10);g.lookZone.emit('pointerdown',2,150,100);g.buttons.fire.emit('pointerdown',3);
  assert.ok(g.controls.state.y<0);assert.equal(g.controls.state.fire,true);assert.equal(g.shots(),1);
  g.lookZone.emit('pointermove',2,170,90);assert.deepEqual(g.looks,[[20,-10]]);
  g.joystick.emit('pointerup',1);assert.equal(g.controls.state.y,0);assert.equal(g.controls.state.fire,true);
  g.buttons.fire.emit('pointerup',3);assert.equal(g.controls.state.fire,false);
});
test('dragging the fire button aims without releasing the trigger',()=>{
  const g=setup();g.buttons.fire.emit('pointerdown',4,60,60);g.buttons.fire.emit('pointermove',4,40,75);
  assert.deepEqual(g.looks,[[-20,15]]);assert.equal(g.controls.state.fire,true);
  g.buttons.fire.emit('pointercancel',4);assert.equal(g.controls.state.fire,false);assert.equal(g.buttons.fire.captured.size,0);
});
test('another finger cannot steal a joystick and pointer capture loss stops motion',()=>{
  const g=setup();g.joystick.emit('pointerdown',1,60,10);g.joystick.emit('pointerdown',2,100,60);g.joystick.emit('pointerup',2);
  assert.equal(g.controls.state.x,0);assert.ok(g.controls.state.y<0);
  g.joystick.emit('lostpointercapture',1);assert.equal(g.controls.state.y,0);
});
test('pause or interruption releases every pointer and held action',()=>{
  const g=setup();g.joystick.emit('pointerdown',1,100,60);g.buttons.fire.emit('pointerdown',2);g.buttons.aim.emit('pointerdown',3);g.buttons.interact.emit('pointerdown',4);g.buttons.jump.emit('pointerdown',5);
  g.controls.reset();assert.deepEqual(g.controls.state,{x:0,y:0,fire:false,aim:false,jump:false,interact:false});
  for(const node of [g.joystick,...Object.values(g.buttons)])assert.equal(node.captured.size,0);
  g.disable();g.buttons.fire.emit('pointerdown',6);assert.equal(g.controls.state.fire,false);assert.equal(g.shots(),1);
});
