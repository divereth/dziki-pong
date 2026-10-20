import {PHYSICS_HZ} from './engine.js';

const mix=(a,b,t)=>a+(b-a)*t;
const angles=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
const snapshots=items=>new Map(items.map(item=>[item,{x:item.x,y:item.y,centerX:item.centerX,wingTop:item.wingTop}]));
function capture(g){
  const p=g.player;
  return {player:p,playerValues:{x:p.x,y:p.y,rotation:p.rotation,anim:p.anim,gravity:p.gravity,animState:p.animState},
    distance:g.distance,cameraX:g.cameraX,cameraY:g.cameraY,ticks:g.ticks,wish:g.wish,state:g.state,
    platforms:snapshots(g.platforms),stars:snapshots(g.stars),pixies:snapshots(g.pixies)};
}

// Physics keeps its original 34 Hz timing. Only this drawing view is blended
// between the two most recent simulation steps, at the display refresh rate.
export class Presentation{
  constructor(game){
    this.game=game;this.views=new WeakMap();this.view=Object.create(game);this.reset();
    const step=game.step.bind(game);
    game.step=()=>{this.previous=capture(game);step();};
  }
  reset(){this.previous=capture(this.game);}
  entity(item,previous,fields,t){
    let view=this.views.get(item);if(!view){view=Object.create(item);this.views.set(item,view);}
    for(const key of fields){const a=previous?.[key],b=item[key];view[key]=Number.isFinite(a)&&Number.isFinite(b)?mix(a,b,t):b;}
    return view;
  }
  sample(){
    const g=this.game,p=g.player;
    if(this.previous.player!==p||this.previous.wish!==g.wish||this.previous.state!==g.state||this.previous.ticks>g.ticks)this.reset();
    const old=this.previous,t=g.state==='playing'?Math.max(0,Math.min(1,g.accumulator*PHYSICS_HZ)):1,v=this.view;
    for(const key of ['distance','cameraX','cameraY','ticks'])v[key]=mix(old[key],g[key],t);
    const pv=this.entity(p,old.playerValues,['x','y'],t);
    pv.rotation=angles(old.playerValues.rotation,p.rotation,t);
    pv.anim=angles(old.playerValues.anim,p.anim,t);
    pv.gravity=old.playerValues.animState===p.animState?mix(old.playerValues.gravity,p.gravity,t):p.gravity;
    v.player=pv;
    v.platforms=g.platforms.map(item=>this.entity(item,old.platforms.get(item),['x','y','centerX'],t));
    v.stars=g.stars.map(item=>this.entity(item,old.stars.get(item),['x','y'],t));
    v.pixies=g.pixies.map(item=>this.entity(item,old.pixies.get(item),['x','y','wingTop'],t));
    return v;
  }
}
