import {Game} from './engine.js';
import {surfaceY,terrainTemplate} from './terrain.js';
const noop=()=>{},twip=n=>Math.trunc(n*20)/20;

// Forecast only terrain already revealed by the real generator. The planner
// never samples the live RNG or chooses what the next platform will be.
function forecastWorld(amount){
 this.distance+=amount;
 for(const platform of this.platforms){
  this.runPoints+=Math.floor(amount/8);
  platform.nativeCenterX=twip(platform.nativeCenterX-amount);
  const center=platform.nativeCenterX+320+this.distance,shift=center-platform.centerX;
  platform.x+=shift;platform.centerX=center;
  for(const dot of Object.values(platform.dots))dot.x+=shift;
  this.syncCollectibles(platform);
 }
}
export function demoSnapshot(game){
 const fields=['distance','ticks','speedPerFrame','speed','score','runPoints','bonus','starChain','pixieChain','wish','state','cameraY','cameraX','engineX','platformSerial','shake','shakeDirection'];
 const snapshot=Object.fromEntries(fields.map(key=>[key,game[key]]));
 snapshot.player={...game.player,rotationHistory:[...game.player.rotationHistory]};
 snapshot.platforms=game.platforms.map(({template,points,...platform})=>({...platform,dots:Object.fromEntries(Object.entries(platform.dots).map(([key,dot])=>[key,{...dot}]))}));
 snapshot.stars=game.stars.map(object=>({...object}));snapshot.pixies=game.pixies.map(object=>({...object}));snapshot.scores=[...game.scores];return snapshot;
}
export function forecastGame(snapshot){
 const g=Object.assign(Object.create(Game.prototype),snapshot);
 g.platforms=snapshot.platforms.map(p=>({...p,template:terrainTemplate(p.templateId),dots:Object.fromEntries(Object.entries(p.dots).map(([key,dot])=>[key,{...dot}]))}));
 g.player={...snapshot.player,rotationHistory:[...snapshot.player.rotationHistory]};g.stars=snapshot.stars.map(o=>({...o}));g.pixies=snapshot.pixies.map(o=>({...o}));g.scores=[...snapshot.scores];
 g.event=noop;g.burst=noop;g.popup=noop;g.updateCamera=noop;g.moveWorld=forecastWorld;g.random=()=>.5;return g;
}
export function applyDemoAction(game,action){
 if(action&1)game.jump();else game.releaseJump();
 if(action&2)game.dash();else game.releaseDash();
}
function stateKey(g){
 const p=g.player;
 return [Math.round(g.distance/8),Math.round(p.y/7),Math.round(p.gravity/2),p.thrust,p.jumps,p.upPress?1:0,p.touchGround,p.animState,Math.round(p.airMeter/8),Math.ceil(p.chargeCoolDown/4),Math.ceil(p.dashFrames/3),Math.round(p.offset/12),g.stars.map(s=>s.broken?1:0).join('')].join('|');
}
function value(g,initial){
 const p=g.player,wx=g.distance+p.x;
 let floor=null;
 for(const platform of g.platforms){const y=surfaceY(platform,wx);if(y!==null&&(floor===null||Math.abs(y-p.y)<Math.abs(floor-p.y)))floor=y;}
 const heightCost=floor===null?0:Math.abs(p.y-floor+35)*.012;
 return (g.score-initial.score)*1.5+p.airMeter*.07+(p.grounded?8:0)-p.jumps*2-heightCost-Math.max(0,p.bodyY-430)*.7-Math.max(0,-p.bodyY-430)*.06;
}
function diverseBeam(states,width){
 const ranked=[...states.values()].sort((a,b)=>b.value-a.value),buckets=new Map();
 for(const node of ranked){
  const p=node.game.player,key=[p.animState,p.jumps,Math.floor(p.y/70),Math.floor((p.thrust-p.gravity)/6)].join('|');
  let bucket=buckets.get(key);if(!bucket)buckets.set(key,bucket=[]);bucket.push(node);
 }
 const result=[];
 for(let layer=0;result.length<width;layer++){
  let found=false;for(const bucket of buckets.values())if(bucket[layer]){result.push(bucket[layer]);found=true;if(result.length===width)break;}
  if(!found)break;
 }
 return result;
}
export function planDemo(snapshot,{horizon=78,width=24,precise=10}={}){
 const initial=forecastGame(snapshot);let beam=[{game:initial,actions:[],value:0}],best=beam[0],reached=0;
 for(let depth=0;depth<horizon;){
  const steps=Math.min(depth<precise?1:3,horizon-depth),states=new Map();
  for(const node of beam)for(let action=0;action<4;action++){
   const p=node.game.player;if((action&2)&&!node.game.canDash()&&!(action&1)&&!p.jumpHeld)continue;
   const game=forecastGame(node.game),actions=node.actions.slice();
   for(let n=0;n<steps&&game.state==='playing';n++){applyDemoAction(game,action);game.step();actions.push(action);}
   if(game.state!=='playing')continue;
   const score=value(game,initial),key=stateKey(game),prior=states.get(key);
   if(!prior||score>prior.value)states.set(key,{game,actions,value:score});
  }
  if(!states.size)break;
  beam=diverseBeam(states,width);best=beam.reduce((a,b)=>a.value>b.value?a:b);depth+=steps;reached=depth;
 }
 return {tick:snapshot.ticks,actions:best.actions,forecast:reached,value:best.value};
}
