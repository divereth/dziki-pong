import {gaitPhase} from './gait.js';
const mod=(v,n)=>((v%n)+n)%n;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const RIG_PARTS={body:[162,136,656,340],head:[967,87,463,387],front:[332,538,326,420],rear:[1015,518,270,437]};
const colors=['#ed646f','#efa64e','#f0d966','#86bf6b','#5fc6c5','#8b8fd2','#bc83c4'];
function ribbon(c,x,y,length,phase,strength,width){
 c.lineCap='round';
 for(let i=colors.length-1;i>=0;i--){
  const shift=(i-3)*width*.16,strandLength=length*(.78+.22*Math.sin((i+1)/8*Math.PI)),upper=[],lower=[];
  for(let s=0;s<=16;s++){
   const f=s/16,xx=x-strandLength*f,yy=y+shift+Math.sin(phase-f*5+i*.24)*strength*f-f*2.5;
   const half=width*.13*Math.pow(1-f,.65)+.03;upper.push([xx,yy-half]);lower.push([xx,yy+half]);
  }
  c.beginPath();c.moveTo(...upper[0]);for(const p of upper.slice(1))c.lineTo(...p);for(const p of lower.reverse())c.lineTo(...p);c.closePath();
  c.fillStyle=`hsl(${mod(i*360/colors.length+phase*3,360)} 68% 64%)`;c.fill();
 }
 c.strokeStyle='#fff0bd66';c.lineWidth=.5;c.beginPath();c.moveTo(x,y-width*.5);c.bezierCurveTo(x-length*.3,y-width*.4,x-length*.7,y+Math.sin(phase-3)*strength-3,x-length,y+Math.sin(phase-5)*strength-3);c.stroke();
}
export class UniboarRig{
 constructor(image){this.image=image;this.parts={};for(const [key,rect]of Object.entries(RIG_PARTS)){
  const part=document.createElement('canvas');part.width=rect[2];part.height=rect[3];part.getContext('2d').drawImage(image,...rect,0,0,rect[2],rect[3]);this.parts[key]=part;
 }}
 draw(c,p,time=0){
  const running=p.animState==='run'&&!!p.grounded,charging=p.animState==='charge',phase=gaitPhase(p);
  const bob=running?-Math.abs(Math.sin(phase))*1.15:charging?-.7:0;
  const flow=time*7+(charging?phase*.2:0),breath=running?Math.sin(phase*2)*.3:Math.sin(time*2.7)*.3;
  c.save();c.translate(0,bob);c.imageSmoothingEnabled=true;
  const leg=(x,offset,back,rear)=>{
   const a=phase+offset,fall=clamp((p.gravity||0)/30,0,1);
   const swing=running?Math.sin(a)*.52:charging?-.45:-.45+fall*.6+Math.sin(time*6+offset)*.08;
   const lift=running?Math.max(0,Math.sin(a))*3.4:4.5-fall*1.3;
   c.save();c.translate(x,-13);c.rotate(swing);c.globalAlpha=back?.62:1;
   const image=rear?this.parts.rear:this.parts.front,height=(13-bob-Math.sin(swing)*7)/Math.cos(swing)+1-lift;
   c.drawImage(image,-6,-1,15,height);c.restore();
  };
  leg(-17,Math.PI,true,true);leg(14,0,true,false);
  ribbon(c,-29,-31,25,flow,charging?4.5:3,5.5);
  c.drawImage(this.parts.body,-33,-43+breath,58,30);
  leg(-17,0,false,true);leg(14,Math.PI,false,false);
  c.save();c.translate(14,-35+breath);c.rotate(charging?-.09:Math.sin(phase)*.018);
  ribbon(c,7,-8,28,flow+1.1,charging?3.2:2,8.5);
  c.drawImage(this.parts.head,-1,-13,31,26);
  const horn=c.createLinearGradient(10,-13,26,-30);
  colors.forEach((color,i)=>horn.addColorStop(i/(colors.length-1),`hsl(${mod(i*360/(colors.length-1)+time*17,360)} 70% 65%)`));
  c.beginPath();c.moveTo(9,-10);c.quadraticCurveTo(18,-23,27,-29);c.quadraticCurveTo(21,-15,14,-8);c.closePath();c.fillStyle=horn;c.fill();c.strokeStyle='#ffedb9a0';c.lineWidth=.55;c.stroke();
  c.strokeStyle='#fff7dc88';c.lineWidth=.5;for(let i=0;i<4;i++){c.beginPath();c.moveTo(13+i*2.6,-13-i*3);c.lineTo(17+i*2.2,-12-i*3);c.stroke();}
  c.restore();c.restore();
 }
 drawIcon(canvas){
  const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);c.save();c.translate(canvas.width*.52,canvas.height*.9);const scale=Math.min(canvas.width/110,canvas.height/82);c.scale(scale,scale);this.draw(c,{animState:'run',grounded:true,anim:.35},.6);c.restore();
 }
}
