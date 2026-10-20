import {WIDTH,HEIGHT} from './engine.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
export function cameraExtent(seconds=0,speed=14){
 if(seconds<4)return .5+.25*smooth(seconds/4);
 // The native speed reaches 31 px/frame after 50 seconds. Using speed here
 // keeps the reveal tied to acceleration while simulation is paused or resumed.
 return .75+.5*smooth((speed-15.36)/(31-15.36));
}
export function cameraView(game){
 const seconds=Math.max(0,(game.ticks??0)/34),extent=cameraExtent(seconds,game.speedPerFrame??14);
 const width=WIDTH*extent,height=HEIGHT*extent,baseX=60+Math.max(0,((game.speedPerFrame??14)-14)/2);
 const startFoot=(game.player?.y??0)-(game.cameraY??0),settle=smooth(seconds/2);
 const pivotY=startFoot*(1-settle)+226.15*settle;
 const left=baseX-WIDTH*.18*extent,top=pivotY-HEIGHT*.68*extent;
 return {extent,scale:1/extent,left,top,width,height,right:left+width,bottom:top+height};
}
