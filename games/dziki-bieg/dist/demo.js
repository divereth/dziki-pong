import {Game} from './engine.js';
import {demoSnapshot,forecastGame,applyDemoAction} from './demo-planner.js';
export function demoRandom(seed=1){
 let state=seed>>>0;
 return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
}
const signature=g=>[g.distance,g.player.y,g.player.gravity,g.player.thrust,g.player.jumps,g.player.airMeter,g.player.dashFrames,g.player.offset].map(n=>Math.round(n*1e5)).join('|');
export class DemoController{
 constructor(game,{onFailure=()=>{}}={}){
  this.game=game;this.onFailure=onFailure;this.enabled=false;this.generation=0;this.serial=0;this.bestWish=0;this.lead=16;
  const step=game.step.bind(game);
  game.step=()=>{if(this.enabled)this.beforeStep();step();};
 }
 makeWorker(){
  if(this.worker)return;
  const entry=new URL('./demo-worker.js',import.meta.url);
  if(entry.protocol==='data:'){
   const bytes=Uint8Array.from(atob(entry.href.slice(entry.href.indexOf(',')+1)),char=>char.charCodeAt(0));
   this.workerURL=URL.createObjectURL(new Blob([bytes],{type:'text/javascript'}));
   this.worker=new Worker(this.workerURL);
  }else this.worker=new Worker(entry,{type:'module'});
  this.worker.onmessage=event=>this.receive(event.data);
  this.worker.onerror=event=>{event.preventDefault();this.fail();};
 }
 prepare(){
  this.enabled=true;this.ready=false;this.active=null;this.pending=null;this.job=null;this.generation++;this.lead=16;
  try{
   this.makeWorker();const opening=new Game();opening.start();
   this.request(demoSnapshot(opening),null,true);return true;
  }catch{this.fail();return false;}
 }
 stop(){
  this.enabled=false;this.ready=false;this.generation++;this.worker?.terminate();this.worker=null;this.active=null;this.pending=null;this.job=null;
  if(this.workerURL){URL.revokeObjectURL(this.workerURL);this.workerURL=null;}
  this.game.releaseJump();this.game.releaseDash();
 }
 fail(){this.stop();this.onFailure();}
 request(snapshot,expected,initial=false){
  const id=++this.serial;this.job={id,tick:snapshot.ticks,expected,initial};
  this.worker.postMessage({id,generation:this.generation,snapshot});
 }
 receive(data){
  if(!this.enabled||data.generation!==this.generation||data.id!==this.job?.id)return;
  const job=this.job;this.job=null;if(data.error){this.fail();return;}
  const plan={...data.plan,expected:job.expected};
  if(job.initial){this.active=plan;this.ready=true;return;}
  // Keep commitment boundaries stable. Small timing variations and worker GC
  // must not change an otherwise deterministic route. Widen only after a
  // genuinely late result; the previous safe plan covers that delay.
  if(plan.tick<this.game.ticks){this.latePlans=(this.latePlans||0)+1;this.lead=Math.min(48,this.lead+8);return;}
  this.pending=plan;
 }
 planAhead(){
  if(this.job||this.pending||!this.active||!this.worker)return;
  const index=this.game.ticks-this.active.tick,remaining=this.active.actions.length-index;
  if(remaining<=1)return;
  const future=forecastGame(demoSnapshot(this.game)),lead=Math.min(this.lead,remaining-1);
  for(let i=0;i<lead;i++){
   applyDemoAction(future,this.active.actions[index+i]);future.step();if(future.state!=='playing')return;
  }
  this.request(demoSnapshot(future),signature(future));
 }
 beforeStep(){
  const g=this.game;if(g.state!=='playing'||!this.ready)return;
  if(this.pending&&g.ticks>=this.pending.tick){
   if(g.ticks===this.pending.tick&&signature(g)===this.pending.expected)this.active=this.pending;
   else this.mismatches=(this.mismatches||0)+1;
   this.pending=null;
  }
  this.planAhead();
  const index=g.ticks-(this.active?.tick||0),action=this.active?.actions[index];
  if(action!==undefined){applyDemoAction(g,action);return;}
  // A slow/unavailable planner keeps using legal inputs; it never changes
  // position, speed, energy, obstacles or the score to rescue the boar.
  const p=g.player,wx=g.distance+p.x,cone=g.stars.some(s=>!s.broken&&!s.missed&&s.x-wx>-40&&s.x-wx<150&&Math.abs(p.y-28-s.y)<100);
  applyDemoAction(g,1+((cone||p.gravity>p.thrust+8)&&g.canDash()?2:0));
 }
}
