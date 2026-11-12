import * as T from './vendor/three.module.min.js';
import {STANDS,STAND_NAMES,STAND_THEMES,PLAYER_SHOP,BOUNDS} from './layout.js';
export {STANDS} from './layout.js';

const palette={wood:'#aa7851',darkWood:'#795437',cream:'#f3e7c8',green:'#7c9970',leaf:'#718e59',iron:'#485b51'};
const colors=['#528b71','#c57958','#d2a34b','#5c8ba2','#9b7091','#739255','#b98b4d','#568c87','#657daa','#ba7a4f','#ab6f79','#5d8a69','#ac9865','#788ca0','#7b9570','#b68b6c'];
const names=STAND_NAMES;
let randomSeed=3510;
function rand(){randomSeed=(randomSeed*1664525+1013904223)>>>0;return randomSeed/4294967296}
const materials=new Map();
function material(color){if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.9}));return materials.get(color)}
function mesh(geometry,color,parent,x=0,y=0,z=0){const m=new T.Mesh(geometry,typeof color==='string'?material(color):color);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function box(p,x,y,z,w,h,d,c){return mesh(new T.BoxGeometry(w,h,d),c,p,x,y,z)}
function cylinder(p,x,y,z,rt,rb,h,c,n=12){return mesh(new T.CylinderGeometry(rt,rb,h,n),c,p,x,y,z)}
function sphere(p,x,y,z,r,c,n=12){return mesh(new T.SphereGeometry(r,n,10),c,p,x,y,z)}
function ring(p,x,y,z,r,t,c){const m=mesh(new T.TorusGeometry(r,t,8,24),c,p,x,y,z);return m}
function label(text,width,height,bg='#f5e8ce',fg='#3e5949',size=70){const canvas=document.createElement('canvas');canvas.width=width>=2?512:width>=1?256:128;canvas.height=canvas.width/4;const scale=canvas.width/1024;const ctx=canvas.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 ${size*scale*1.25}px "Segoe UI", Arial`;ctx.fillText(text,canvas.width/2,canvas.height/2,canvas.width-8);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const m=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));m.userData.ownedMaterial=true;return m}
function lineBetween(p,a,b,color='#7a7862',radius=.015){const start=new T.Vector3(...a),end=new T.Vector3(...b),dir=end.clone().sub(start),m=mesh(new T.CylinderGeometry(radius,radius,dir.length(),6),color,p);m.position.copy(start.add(end).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());return m}


export {box,cylinder,sphere,ring,mesh,material,label,lineBetween,rand,colors,palette};
