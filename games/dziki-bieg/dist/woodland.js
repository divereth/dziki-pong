import {WIDTH as W,HEIGHT as H} from './engine.js';
const TAU=Math.PI*2,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export class WoodlandEffects{
 constructor(){
  this.seed=0x71e5b9;this.motes=[];this.deer=[];this.frames=[];this.sprites=this.makeSprites();this.reset(1);
 }
 random(){let x=this.seed;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x>>>0;return this.seed/4294967296;}
 makeSprites(){
  return ['#ecdf9a','#c7d694','#a6bd75'].map((color,index)=>{
   const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const c=canvas.getContext('2d');
   const glow=c.createRadialGradient(16,16,0,16,16,15);glow.addColorStop(0,color+'b0');glow.addColorStop(.2,color+'3b');glow.addColorStop(1,color+'00');c.fillStyle=glow;c.fillRect(0,0,32,32);
   c.fillStyle=color;c.beginPath();c.ellipse(16,16,index?3.5:1.7,index?1.3:1.7,-.55,0,TAU);c.fill();return canvas;
  });
 }
 reset(wish){
  this.wish=wish;this.seed=(0x71e5b9+wish*139)>>>0;this.deer=[];this.nextDeer=50.7;this.lastRun=0;this.lastDistance=0;this.lastTime=null;
  this.motes=Array.from({length:58},(_,i)=>({x:this.random()*W,y:this.random()*H,depth:.15+this.random()*.68,
   size:.45+this.random()*.62,phase:this.random()*TAU,spin:(this.random()-.5)*.5,vx:0,vy:0,index:i%3}));
 }
 setDeerImage(image){
  const boxes=[[60,10,592,520,295,290],[772,54,742,375,378,216],[177,508,480,376,238,220],[903,537,533,449,237,205]];
  this.frames=boxes.map(([x,y,w,h,cx,cy])=>{
   const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(image,x,y,w,h,0,0,w,h);return {image:canvas,cx,cy};
  });
 }
 update(g,time,view,enabled=true){
  const run=(g.ticks||0)/34;
  if(this.wish!==(g.wish||1)||run<this.lastRun-.1)this.reset(g.wish||1);
  const dt=g.state==='playing'&&this.lastTime!==null?clamp(time-this.lastTime,0,.05):0;
  const scroll=Math.max(0,(g.distance||0)-this.lastDistance);
  this.lastTime=time;this.lastRun=run;this.lastDistance=g.distance||0;
  if(enabled&&dt&&!g.reducedMotion){
   const p=g.player,px=((p?.x||60)-view.left)/view.extent,py=((p?.y||0)-(g.cameraY||0)-view.top-27)/view.extent;
   for(const mote of this.motes){
    mote.x-=scroll*mote.depth/view.extent;mote.phase+=dt*(.5+mote.depth);
    const dx=mote.x-px,dy=mote.y-py,r=Math.hypot(dx,dy),reach=Math.min(140,75/view.extent);
    if(p&&r<reach&&r>1){const force=(1-r/reach)*mote.depth;mote.vx+=(dx/r*150+70)*force*dt;mote.vy+=(dy/r*110+(p.vy||0)*.26)*force*dt;}
    mote.x+=mote.vx*dt;mote.y+=(mote.vy+Math.sin(mote.phase)*4)*dt;
    mote.vx*=Math.exp(-dt*2.7);mote.vy*=Math.exp(-dt*2.7);
    if(mote.x< -24){mote.x=W+8+this.random()*32;mote.y=this.random()*H;}
    if(mote.y< -24)mote.y=H+12;if(mote.y>H+24)mote.y=-12;
   }
  }
  if(g.state==='playing'&&!g.reducedMotion&&view.extent>=1.249&&run>=this.nextDeer&&this.frames.length===4){
   this.deer.push({born:run,duration:2.45,size:140+this.random()*24,start:W*.22,travel:W*.88});
   this.deer.push({born:run+.48,duration:2.25,size:116+this.random()*22,start:W*.13,travel:W*.88});
   this.nextDeer=run+10+this.random()*6;
  }
  this.deer=this.deer.filter(deer=>run-deer.born<deer.duration);
 }
 drawMotes(c,front,enabled=true,reduced=false){
  if(!enabled)return;
  for(const mote of this.motes){
   if((mote.depth>.55)!==front)continue;
   const size=(front?11:7)*mote.size;
   c.save();c.globalAlpha=front?.48:.29;c.translate(mote.x,mote.y);c.rotate(reduced?0:mote.phase*mote.spin);c.drawImage(this.sprites[mote.index],-size,-size,size*2,size*2);c.restore();
  }
 }
 drawDeer(c,g,view){
  if(view.extent<1.249||g.reducedMotion)return;
  const run=(g.ticks||0)/34;
  for(const deer of this.deer){
   const f=(run-deer.born)/deer.duration;if(f<0||f>1)continue;
   const x=deer.start+deer.travel*f,y=H+86-Math.sin(f*Math.PI)*(H*.57+35),scale=deer.size/600;
   const pose=f<.17?0:f<.38?1:f<.64?2:3,boundary=[.17,.38,.64][pose];
   const blend=boundary===undefined?0:clamp((f-boundary+.045)/.045,0,1);
   c.save();c.translate(x,y);c.rotate(-.12+f*.28);
   const draw=(index,alpha)=>{const frame=this.frames[index];if(!frame||alpha<=0)return;c.globalAlpha=.94*alpha;c.drawImage(frame.image,-frame.cx*scale,-frame.cy*scale,frame.image.width*scale,frame.image.height*scale);};
   draw(pose,1-blend);if(blend)draw(pose+1,blend);c.restore();
  }
 }
}
