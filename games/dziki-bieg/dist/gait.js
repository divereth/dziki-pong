const TAU=Math.PI*2;
export const gaitPhase=player=>((player.anim||0)%TAU+TAU)%TAU;
export class HoofCadence{
 reset(){this.previous=null;this.player=null;}
 contact(player,playing){
  if(!playing||!player?.grounded||player.animState!=='run'){this.reset();return false;}
  const phase=gaitPhase(player),previous=this.player===player?this.previous:null;
  this.player=player;this.previous=phase;
  if(previous===null||previous===undefined)return false;
  const advance=(phase-previous+TAU)%TAU;
  // Drop catch-up sounds after a stalled frame, rather than replaying a burst.
  return advance<=Math.PI&&Math.floor(previous/Math.PI)!==Math.floor(phase/Math.PI);
 }
}
