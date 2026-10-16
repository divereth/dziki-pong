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
function label(text,width,height,bg='#f5e8ce',fg='#3e5949',size=70){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,1024,256);ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 ${size}px "Segoe UI", Arial`;ctx.fillText(text,512,133,965);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const m=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));m.userData.ownedMaterial=true;return m}
function lineBetween(p,a,b,color='#7a7862',radius=.015){const start=new T.Vector3(...a),end=new T.Vector3(...b),dir=end.clone().sub(start),m=mesh(new T.CylinderGeometry(radius,radius,dir.length(),6),color,p);m.position.copy(start.add(end).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());return m}

export function product(model,accent='#b8a16c'){
 const g=new T.Group(),dark='#3f4c45',white='#ece5d4',gold='#c9a561';
 if(model==='radio'){
  box(g,0,.22,0,.64,.43,.27,'#b77b4d');box(g,0,.23,.145,.57,.33,.025,'#debd83');box(g,-.12,.22,.164,.24,.22,.02,dark);
  for(let i=0;i<7;i++)box(g,-.12,.135+i*.029,.18,.21,.008,.012,'#b7a37e');box(g,.17,.32,.17,.2,.07,.025,'#5d6b58');for(const x of [.1,.23]){const k=cylinder(g,x,.15,.182,.038,.038,.025,gold);k.rotation.x=Math.PI/2}const h=ring(g,0,.45,0,.2,.018,dark);h.scale.y=.5;lineBetween(g,[.21,.41,-.06],[.4,.92,-.06],dark,.009);
 }else if(model==='camera'){
  box(g,0,.22,0,.52,.33,.25,dark);box(g,0,.36,0,.53,.07,.26,'#b7b8a3');box(g,-.09,.42,0,.18,.1,.18,dark);const lens=cylinder(g,.04,.22,.22,.115,.13,.2,dark,20);lens.rotation.x=Math.PI/2;const glass=cylinder(g,.04,.22,.329,.088,.088,.014,'#6f9e9e',20);glass.rotation.x=Math.PI/2;box(g,-.17,.3,.14,.07,.05,.02,'#d4ddca');cylinder(g,.18,.42,0,.04,.04,.04,gold);
 }else if(model==='record'){
  box(g,0,.03,0,.55,.04,.55,'#d6b987');const record=cylinder(g,0,.06,0,.23,.23,.018,'#39433c',32);cylinder(g,0,.073,0,.073,.073,.01,'#bc8166',20);for(const r of [.14,.18,.21]){const t=ring(g,0,.072,0,r,.002,'#6d7365');t.rotation.x=-Math.PI/2}box(g,.13,.31,-.22,.53,.56,.025,'#879b82');const art=sphere(g,.13,.35,-.19,.17,'#d9c784');art.scale.set(1,1,.03);
 }else if(model==='books'){
  const cs=['#ba8164','#819787','#cfba88','#807e6e'];for(let i=0;i<4;i++){const b=new T.Group();b.position.set((i%2)*.02,i*.077+.04,0);b.rotation.y=i*.16-.2;box(b,0,0,0,.47,.07,.34,cs[i]);box(b,0,0,.014,.43,.045,.33,white);g.add(b)}
 }else if(model==='vase'){
  const points=[[.13,0],[.2,.07],[.2,.24],[.12,.39],[.07,.43],[.075,.56],[.09,.58]].map(([x,y])=>new T.Vector2(x,y));mesh(new T.LatheGeometry(points,16),accent,g);ring(g,0,.58,0,.08,.012,'#b39b70').rotation.x=Math.PI/2;
 }else if(model==='lamp'){
  cylinder(g,0,.025,0,.17,.2,.05,'#77755d');cylinder(g,0,.34,0,.025,.03,.65,gold);cylinder(g,0,.58,0,.16,.31,.3,'#dfc99a');cylinder(g,0,.745,0,.025,.025,.025,gold);
 }else if(model==='clock'){
  const c=cylinder(g,0,.25,0,.23,.23,.13,accent,28);c.rotation.x=Math.PI/2;const face=cylinder(g,0,.25,.075,.195,.195,.02,white,28);face.rotation.x=Math.PI/2;box(g,0,.3,.09,.012,.11,.01,dark);box(g,.045,.25,.092,.1,.012,.01,dark);for(const x of [-.17,.17]){sphere(g,x,.49,0,.09,gold);box(g,x,.035,0,.05,.07,.08,dark)}
 }else if(model==='console'){
  box(g,0,.09,0,.65,.16,.43,'#d6d3ba');box(g,0,.18,-.04,.45,.018,.16,'#748475');box(g,-.2,.19,.13,.08,.02,.04,'#9b6755');box(g,.19,.19,.13,.11,.02,.04,dark);const pad=new T.Group();pad.position.set(.05,.08,.4);box(pad,0,0,0,.34,.07,.17,dark);box(pad,-.08,.04,0,.1,.014,.03,'#a7b4a0');box(pad,-.08,.04,0,.03,.014,.1,'#a7b4a0');for(const x of [.06,.12])cylinder(pad,x,.04,0,.023,.023,.02,'#b77a6b');g.add(pad);
 }else if(model==='headphones'){
  const arc=ring(g,0,.29,0,.23,.04,dark);for(const x of [-.23,.23]){box(g,x,.18,0,.11,.2,.16,'#9b7356');box(g,x*.8,.18,0,.04,.17,.14,'#444c43')}
 }else if(model==='plant'){
  cylinder(g,0,.13,0,.17,.12,.26,'#ba8668');cylinder(g,0,.266,0,.15,.15,.01,'#5e5e44');for(let i=0;i<7;i++){const a=i*2.4;const x=Math.cos(a)*.18,z=Math.sin(a)*.18,y=.38+rand()*.22;lineBetween(g,[0,.23,0],[x,y,z],'#5f8254',.012);const leaf=sphere(g,x,y,z,.12,'#729356');leaf.scale.set(1.3,.35,.7);leaf.rotation.z=x*1.8}
 }else if(model==='typewriter'){
  box(g,0,.12,0,.65,.18,.48,'#7c9584');const key=box(g,0,.23,.14,.53,.03,.25,dark);key.rotation.x=.15;for(let i=0;i<3;i++)for(let j=0;j<7;j++)cylinder(g,-.21+j*.07,.255+i*.009,.06+i*.065,.019,.019,.015,white,8);box(g,0,.3,-.14,.59,.16,.14,dark);box(g,0,.5,-.18,.4,.36,.018,white);
 }else if(model==='painting'){
  box(g,0,.4,0,.62,.7,.05,'#af8a55');box(g,0,.4,.03,.52,.6,.014,'#e7dac0');const shapes=[[-.1,.48,.17,'#a3ae7a'],[.1,.34,.19,'#c6a17a'],[.06,.58,.11,'#8d9d85']];shapes.forEach(([x,y,r,c])=>{const s=sphere(g,x,y,.045,r,c);s.scale.z=.02});g.rotation.x=-.12;
 }else if(model==='guitar'){
  const s=sphere(g,0,.2,0,.23,'#c09a5d');s.scale.set(1,.95,.32);const t=sphere(g,0,.42,0,.17,'#c09a5d');t.scale.set(1,1,.45);box(g,0,.73,0,.065,.48,.06,'#6b5b42');box(g,0,1,0,.1,.16,.08,'#b49660');const hole=cylinder(g,0,.35,.072,.065,.065,.012,dark);hole.rotation.x=Math.PI/2;for(let i=0;i<4;i++)lineBetween(g,[-.015+i*.01,.15,.08],[-.015+i*.01,.99,.05],'#d7cda7',.002);
 }else if(model==='speaker'){
  box(g,0,.35,0,.4,.7,.32,'#886345');box(g,0,.35,.17,.34,.64,.015,dark);for(const [y,r] of [[.23,.13],[.52,.085]]){const c=cylinder(g,0,y,.19,r,r,.03,'#777a64',24);c.rotation.x=Math.PI/2;const b=cylinder(g,0,y,.214,r*.4,r*.4,.012,dark,16);b.rotation.x=Math.PI/2}
 }else if(model==='watch'){
  box(g,0,.04,0,.19,.07,.62,'#98734e');const c=cylinder(g,0,.12,0,.17,.17,.1,gold,24);cylinder(g,0,.177,0,.14,.14,.012,'#f1ebd7',24);box(g,0,.19,-.045,.01,.01,.09,dark);box(g,.04,.19,0,.08,.01,.01,dark);cylinder(g,.19,.125,0,.025,.025,.04,gold);
 }else if(model==='sneaker'){
  const s=sphere(g,0,.12,0,.25,'#d6d4bc');s.scale.set(.7,.55,1.5);box(g,0,.035,.02,.35,.05,.7,white);box(g,0,.23,-.15,.3,.17,.28,'#748e78');for(let i=0;i<4;i++)box(g,0,.22,-.02+i*.055,.2,.015,.015,white);
 }else if(model==='lens'){
  cylinder(g,0,.24,0,.16,.18,.48,dark,24);for(const y of [.1,.24,.4])cylinder(g,0,y,0,.182,.182,.035,'#777e6d',24);cylinder(g,0,.49,0,.14,.14,.018,'#769a91',24);
 }else if(model==='sculpture'){
  box(g,0,.05,0,.35,.1,.35,'#a5a38b');const s=ring(g,0,.43,0,.25,.095,'#aa8b57');s.rotation.y=.4;box(g,0,.2,0,.1,.22,.1,'#aa8b57');sphere(g,.2,.75,0,.11,'#aa8b57');
 }else if(model==='chair'){
  box(g,0,.35,0,.58,.16,.55,'#b28b62');box(g,0,.65,-.21,.58,.55,.15,'#b28b62');for(const x of [-.22,.22])for(const z of [-.2,.2])box(g,x,.15,z,.05,.3,.05,'#80644a');
 }else if(['shirt','hoodie','coat'].includes(model)){
  const tall=model==='coat',bodyColor=tall?'#b18b64':model==='hoodie'?'#687b95':'#b96a59';
  const shape=new T.Shape();[[-.19,.02],[.19,.02],[.2,tall?.68:.43],[.34,.34],[.43,.52],[.21,tall?.87:.66],[.09,tall?.91:.71],[0,tall?.82:.63],[-.09,tall?.91:.71],[-.21,tall?.87:.66],[-.43,.52],[-.34,.34],[-.2,tall?.68:.43]].forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();mesh(new T.ExtrudeGeometry(shape,{depth:.08,bevelEnabled:true,bevelSize:.012,bevelThickness:.01,bevelSegments:1,steps:1}),bodyColor,g,0,0,0);
  if(model==='hoodie'){sphere(g,0,.64,-.02,.15,bodyColor);box(g,0,.25,.105,.25,.1,.014,'#596f87')}if(tall){lineBetween(g,[0,.05,.11],[0,.7,.11],'#795b43',.008);for(let y=.2;y<.7;y+=.17)sphere(g,.035,y,.115,.012,'#e0caa3')}else box(g,0,.42,.105,.12,.12,.012,'#e4d6b5');
 }else if(model==='jeans'){
  for(const x of [-.115,.115]){const leg=box(g,x,.25,0,.2,.5,.1,'#5c7d98');leg.rotation.z=x*.25;box(g,x,.06,.061,.19,.07,.012,'#93a7b5')}box(g,0,.56,0,.43,.15,.11,'#597590');box(g,0,.64,.01,.45,.035,.12,'#b99a73');
 }else if(model==='cap'){
  const c=sphere(g,0,.12,0,.22,'#688c78');c.scale.set(1,.65,1);const brim=cylinder(g,0,.035,.14,.22,.22,.02,'#567a66',20);brim.scale.z=1.4;box(g,0,.15,.19,.07,.065,.012,'#dacaa5');
 }else if(model==='bag'){
  box(g,0,.23,0,.43,.4,.2,'#a77952');box(g,0,.31,.115,.44,.17,.025,'#bb9166');ring(g,0,.49,0,.16,.025,'#74573f').scale.y=.75;box(g,0,.22,.14,.08,.065,.02,gold);
 }else if(model==='phone'||model==='smartphone'){
  const smart=model==='smartphone';box(g,0,.27,0,smart?.29:.25,.54,.065,'#303c43');box(g,0,smart?.29:.38,.037,smart?.25:.19,smart?.43:.18,.008,'#447b88');
  if(smart){box(g,0,.46,.045,.09,.015,.005,'#1b3037');for(let i=0;i<6;i++)box(g,-.065+(i%3)*.065,.18+Math.floor(i/3)*.075,.047,.038,.04,.004,['#cea96b','#8cbca9','#a6c1d0'][i%3])}else for(let i=0;i<12;i++)box(g,-.066+i%3*.066,.09+Math.floor(i/3)*.055,.04,.04,.03,.01,'#b5bdb3');
  cylinder(g,0,.05,.037,.019,.019,.008,'#b5bdb3').rotation.x=Math.PI/2;g.rotation.x=-.16;
 }else if(model==='apples'){
  box(g,0,.08,0,.65,.16,.45,'#b48e55');for(let i=0;i<7;i++){const x=-.22+i%3*.21,z=-.13+Math.floor(i/3)*.15,y=.19+(i>5?.12:0);sphere(g,x,y,z,.1,i%2?'#9aac4f':'#c46542');lineBetween(g,[x,y+.075,z],[x+.013,y+.13,z],'#746039',.008)}
 }else if(model==='bread'||model==='pastry'){
  box(g,0,.03,0,.63,.055,.4,'#c7ad7b');const count=model==='bread'?1:3;for(let i=0;i<count;i++){const loaf=sphere(g,(i-(count-1)/2)*.2,.14,0,.2,'#c78e45');loaf.scale.set(count===1?1.45:.6,.55,.82);for(let j=0;j<3;j++){const cut=box(g,(i-(count-1)/2)*.2+(j-1)*.055,.237,0,.018,.008,.2,'#ead2a0');cut.rotation.y=-.4}}
 }else if(model==='cheese'){
  cylinder(g,0,.12,0,.25,.25,.23,'#d9b44f',18);cylinder(g,0,.24,0,.245,.245,.02,'#f0d47b',18);for(const [x,z,r] of [[-.1,.1,.035],[.08,.09,.045],[.03,-.1,.03]])cylinder(g,x,.253,z,r,r,.006,'#bf943e',12);box(g,.3,.08,.1,.21,.16,.25,'#e1bd5b');
 }else if(model==='honey'){
  cylinder(g,0,.18,0,.15,.15,.34,'#b98335',16);cylinder(g,0,.37,0,.16,.16,.055,'#a88646',16);box(g,0,.2,.151,.23,.13,.01,'#eadbb0');box(g,0,.2,.158,.12,.025,.006,'#966b36');
 }else if(model==='teddy'){
  sphere(g,0,.23,0,.19,'#b98d61');sphere(g,0,.49,0,.16,'#c99c6b');for(const x of [-.14,.14]){sphere(g,x,.61,0,.075,'#b98d61');sphere(g,x,.09,.08,.095,'#b98d61');sphere(g,x*1.55,.31,0,.085,'#c99c6b');sphere(g,x*.4,.51,.14,.018,'#393e35')}sphere(g,0,.45,.14,.065,'#e0c29b');sphere(g,0,.47,.2,.025,'#5b4c3b');
 }else if(model==='tools'){
  box(g,0,.14,0,.6,.25,.35,'#688d83');box(g,0,.28,0,.64,.04,.38,'#82a394');const h=ring(g,0,.35,0,.13,.026,dark);h.scale.y=.5;for(const x of [-.17,.17])box(g,x,.2,.19,.05,.09,.025,gold);
 }else if(model==='skateboard'){
  const deck=box(g,0,.12,0,.26,.04,.8,'#c39b67');for(const z of [-.27,.27])for(const x of [-.15,.15]){const wheel=cylinder(g,x,.06,z,.045,.045,.055,'#e2c87e',12);wheel.rotation.z=Math.PI/2}box(g,0,.145,0,.22,.008,.55,'#617c70');
 }else if(model==='kettle'){
  const b=sphere(g,0,.21,0,.21,'#d0e1d2');b.scale.y=.9;cylinder(g,0,.4,0,.13,.17,.045,'#91ac99');sphere(g,0,.44,0,.04,dark);ring(g,0,.4,0,.25,.025,dark);lineBetween(g,[.15,.24,0],[.33,.35,0],'#b3c8b8',.055);
 }else if(model==='bike'){
  for(const z of [-.36,.36]){const w=ring(g,0,.25,z,.25,.025,dark);w.rotation.y=Math.PI/2;lineBetween(g,[0,.25,z],[0,.45,0],'#b1b6a0',.008)}for(const [a,b] of [[[0,.25,-.36],[0,.57,-.08]],[[0,.57,-.08],[0,.25,.1]],[[0,.25,.1],[0,.25,-.36]],[[0,.25,.1],[0,.56,.23]],[[0,.56,.23],[0,.25,.36]],[[0,.57,-.08],[0,.56,.23]]])lineBetween(g,a,b,'#6f9a86',.025);box(g,0,.64,-.1,.16,.035,.17,dark);lineBetween(g,[-.16,.68,.25],[.16,.68,.25],dark,.016);g.scale.setScalar(.85);
 }
 return g;
}


export {box,cylinder,sphere,ring,mesh,material,label,lineBetween,rand,colors,palette};
