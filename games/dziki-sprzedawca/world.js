import * as T from './vendor/three.module.min.js';
import {product,box,cylinder,sphere,ring,mesh,material,label,lineBetween,rand,colors,palette} from './models.js';
import {STANDS,STAND_NAMES,STAND_THEMES,PLAYER_SHOP,BOUNDS} from './layout.js';
export {STANDS} from './layout.js';

function disposeGroup(group){group.removeFromParent();group.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(o.userData.ownedMaterial){o.material.map?.dispose();o.material.dispose()}}})}
function textureCanvas(size,draw){const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=4;return map}
const canopyMaterials=new Map();
function canopyMaterial(color,map){if(!canopyMaterials.has(color))canopyMaterials.set(color,new T.MeshStandardMaterial({color,map,side:T.DoubleSide,roughness:1}));return canopyMaterials.get(color)}
// Bake static geometry into material batches to keep the larger market smooth.
function batchMeshes(root,excluded=new Set()){
  root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),batches=new Map();
  root.traverse(o=>{if(!o.isMesh||excluded.has(o)||Array.isArray(o.material))return;const key=`${o.material.uuid}:${o.castShadow}:${o.receiveShadow}`;if(!batches.has(key))batches.set(key,{material:o.material,cast:o.castShadow,receive:o.receiveShadow,meshes:[]});batches.get(key).meshes.push(o)});
  for(const batch of batches.values()){
    if(batch.meshes.length<2)continue;const attributes={position:[],normal:[],uv:[]};
    for(const old of batch.meshes){const geometry=old.geometry.index?old.geometry.toNonIndexed():old.geometry.clone();geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,old.matrixWorld));for(const key of ['position','normal','uv']){const attribute=geometry.getAttribute(key);if(attribute)attributes[key].push(attribute.array);else attributes[key].push(new Float32Array(geometry.getAttribute('position').count*(key==='uv'?2:3)))}geometry.dispose();old.removeFromParent();old.geometry.dispose()}
    const geometry=new T.BufferGeometry();for(const key of ['position','normal','uv']){const length=attributes[key].reduce((n,a)=>n+a.length,0),array=new Float32Array(length);let offset=0;for(const a of attributes[key]){array.set(a,offset);offset+=a.length}geometry.setAttribute(key,new T.BufferAttribute(array,key==='uv'?2:3))}geometry.computeBoundingSphere();const merged=new T.Mesh(geometry,batch.material);merged.castShadow=batch.cast;merged.receiveShadow=batch.receive;root.add(merged);
  }
}

export class MarketWorld{
  constructor(canvas,{mobile=false}={}){
    this.canvas=canvas;this.scene=new T.Scene();this.scene.background=new T.Color('#a9cbd9');this.scene.fog=new T.Fog('#c2d5d7',34,100);
    this.camera=new T.PerspectiveCamera(66,1,.05,130);this.camera.position.set(.2,1.8,7.4);this.camera.rotation.order='YXZ';this.yaw=.08;this.pitch=-.055;
    this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1:1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    this.scene.add(new T.HemisphereLight('#e8f4ff','#9b8c6a',1.45));
    const sun=new T.DirectionalLight('#ffe8c0',2.5);sun.position.set(-18,30,6);sun.target.position.set(0,0,-29);sun.castShadow=true;sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);Object.assign(sun.shadow.camera,{left:-28,right:28,top:54,bottom:-55,near:1,far:150});sun.shadow.bias=-.0004;sun.shadow.normalBias=.035;this.scene.add(sun,sun.target);
    this.stallGroups=[];this.obstacles=[];this.offerGroups=[];this.playerGoods=[];this.hitTargets=[];this.customerMeshes=new Map();this.customerHitTargets=[];this.vendorMeshes=[];this.flags=[];this.ray=new T.Raycaster();this.pointer=new T.Vector2();this.offerRoots=new Map();
    this.highlight=new T.BoxHelper(new T.Mesh(new T.BoxGeometry()),'#f9db7c');this.highlight.material.transparent=true;this.highlight.material.opacity=.8;this.highlight.material.depthTest=false;this.highlight.visible=false;this.scene.add(this.highlight);
    this.buildTextures();this.buildGround();this.buildBuildings();STANDS.forEach((p,i)=>this.buildStand(p,i));this.buildDecor();batchMeshes(this.scene,new Set(this.flags.map(f=>f.mesh)));this.camera.rotation.set(this.pitch,this.yaw,0);this.resize();new ResizeObserver(()=>this.resize()).observe(canvas.parentElement);this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.needsUpdate=true;this.render();
  }
  buildTextures(){
    this.woodMap=textureCanvas(128,(c,s)=>{c.fillStyle='#ded2be';c.fillRect(0,0,s,s);for(let i=0;i<80;i++){c.strokeStyle=`rgba(100,74,45,${.03+rand()*.12})`;c.beginPath();const y=rand()*s;c.moveTo(0,y);c.bezierCurveTo(40,y-3,80,y+3,s,y);c.stroke()}});
    for(const color of [palette.wood,palette.darkWood,'#a58059','#b18a5e','#946b46','#b29471']){const m=material(color);m.map=this.woodMap;m.needsUpdate=true}
    this.clothMap=textureCanvas(64,(c,s)=>{c.fillStyle='#faf6ed';c.fillRect(0,0,s,s);c.strokeStyle='#d9d4c6';c.lineWidth=.4;for(let i=0;i<s;i+=4){c.beginPath();c.moveTo(i,0);c.lineTo(i,s);c.moveTo(0,i);c.lineTo(s,i);c.stroke()}});
    this.pavingMap=textureCanvas(512,(c,s)=>{c.fillStyle='#968b76';c.fillRect(0,0,s,s);for(let row=0;row<8;row++)for(let col=-1;col<8;col++){const x=col*75+(row%2)*37.5,y=row*64,v=162+Math.floor(rand()*28);c.fillStyle=`rgb(${v+16},${v+8},${v-10})`;c.beginPath();c.roundRect(x+2,y+2,71,60,4);c.fill();c.strokeStyle='#ddd2b8';c.lineWidth=1;c.stroke()}for(let i=0;i<2000;i++){c.fillStyle=rand()>.5?'#fff1':'#372b2111';c.fillRect(rand()*s,rand()*s,1+rand()*2,1)}});this.pavingMap.repeat.set(4,15);
  }
  resize(){const {width,height}=this.canvas.getBoundingClientRect();this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height,false)}
  buildGround(){
    box(this.scene,0,-.19,-16,100,.3,120,'#88966b');
    const paving=new T.MeshStandardMaterial({map:this.pavingMap,bumpMap:this.pavingMap,bumpScale:.045,roughness:1});const plane=mesh(new T.PlaneGeometry(25,88),paving,this.scene,0,-.015,-29);plane.rotation.x=-Math.PI/2;plane.receiveShadow=true;plane.castShadow=false;
    for(const x of [-12.3,12.3]){box(this.scene,x,.05,-29,.35,.17,88,'#b1aa91');box(this.scene,x*1.07,.01,-29,1.5,.1,88,'#b7b198')}
    for(let z=-69;z<13;z+=2){for(const x of [-3.2,3.2])box(this.scene,x,-.005,z,.075,.018,1.9,'#92866d')}
  }
  buildStand([x,z,rotation],i){
    const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rotation;this.scene.add(g);this.stallGroups.push(g);const color=colors[i%colors.length];
    for(const xx of [-2.02,2.02])for(const zz of [-1.04,1.04]){cylinder(g,xx,1.47,zz,.048,.06,2.94,palette.wood,10);box(g,xx,.1,zz,.2,.2,.2,palette.darkWood)}
    box(g,0,.99,.25,4.18,.14,1.5,'#a58059');box(g,0,1.07,.32,4.24,.035,1.56,'#d5c39e');
    const skirt=box(g,0,.64,1.08,4.2,.79,.035,color);skirt.material=material(color).clone();skirt.material.map=this.clothMap;box(g,0,.92,1.11,4.2,.055,.02,'#f0dcb2');
    for(let j=0;j<10;j++){const x1=-2.35+j*.47,x2=x1+.47;for(const side of [-1,1]){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([x1,3.29,0,x2,3.29,0,x1,2.93,side*1.48,x2,3.29,0,x2,2.93,side*1.48,x1,2.93,side*1.48],3));geo.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,0,1,1,0,1,1,0,1],2));geo.computeVertexNormals();mesh(geo,canopyMaterial(j%2?'#f3dfb5':color,this.clothMap),g);box(g,(x1+x2)/2,2.82,side*1.48,.465,.21,.03,j%2?'#f3dfb5':color)}}
    const sign=label(STAND_NAMES[i],2.9,.4,'#f6e7c7','#3c4d3d',54);sign.position.set(0,2.48,1.13);g.add(sign);for(const xx of [-1.2,1.2])lineBetween(g,[xx,2.67,1.12],[xx,2.96,1.12],palette.darkWood,.009);
    const num=label(String(i+1).padStart(2,'0'),.29,.19,color,'#fff6df',90);num.position.set(-1.8,.65,1.12);g.add(num);
    for(const xx of [-1.7,1.65]){box(g,xx,.25,-.15,.53,.5,.62,'#946b46');for(let k=0;k<3;k++)box(g,xx,.09+k*.16,.17,.48,.025,.015,'#b18a5e')}
    const person=this.person(g,.3,-.64,colors[(i+4)%16],i);this.vendorMeshes.push(person);
    if(STAND_THEMES[i]==='clothes'){const rack=new T.Group();rack.position.set(-1.7,0,-.45);g.add(rack);for(const xx of [-.38,.38])cylinder(rack,xx,1.1,0,.02,.02,2.2,'#59635a');lineBetween(rack,[-.4,2.2,0],[.4,2.2,0],'#59635a',.02);const shirt=product('shirt');shirt.scale.setScalar(.65);shirt.position.set(0,1.45,0);rack.add(shirt)}
    if(STAND_THEMES[i]==='food'){const chalk=label('LOKALNIE · ŚWIEŻO',1.4,.35,'#344c3e','#eee7cb',62);chalk.position.set(0,.55,1.12);g.add(chalk)}
    const b=new T.Box3().setFromCenterAndSize(new T.Vector3(x,0,z),new T.Vector3(rotation?2.35:4.65,1,rotation?4.65:2.35));this.obstacles.push({x0:b.min.x-.12,x1:b.max.x+.12,z0:b.min.z-.12,z1:b.max.z+.12});
  }
  person(parent,x,z,color,index=0){
    const g=new T.Group();g.position.set(x,0,z);parent.add(g);const skin=['#d1a47d','#b18462','#dfb890','#a97756'][index%4],hair=['#514032','#86664a','#493b32','#bc9a6f'][index%4],limbs=[];
    for(const side of [-1,1]){const leg=new T.Group();leg.position.set(side*.105,.65,0);g.add(leg);box(leg,0,-.29,0,.15,.57,.18,index%2?'#3e4d58':'#62674e');box(leg,0,-.61,.045,.17,.09,.27,'#493f35');limbs.push(leg)}
    cylinder(g,0,.94,0,.225,.185,.58,color,12);box(g,0,.87,.19,.035,.43,.015,'#f4e3bd');
    cylinder(g,0,1.29,0,.065,.075,.15,skin,10);const head=sphere(g,0,1.47,0,.18,skin,16);head.scale.set(.86,1.1,.85);const hairMesh=sphere(g,0,1.57,-.02,.171,hair,14);hairMesh.scale.set(.98,.65,.9);
    for(const side of [-1,1]){sphere(g,side*.16,1.46,0,.035,skin);sphere(g,side*.06,1.49,.145,.013,'#302f2b',8);const arm=new T.Group();arm.position.set(side*.245,1.13,0);g.add(arm);box(arm,0,-.17,0,.115,.34,.15,color);cylinder(arm,0,-.39,0,.043,.04,.16,skin,8);sphere(arm,0,-.5,0,.052,skin);limbs.push(arm)}
    if(index%4===1){cylinder(g,0,1.66,0,.23,.23,.035,'#d0ac6e',20);cylinder(g,0,1.72,0,.145,.16,.13,'#d0ac6e',16)}
    if(index%5===2){for(const xx of [-.06,.06]){const eye=ring(g,xx,1.49,.15,.04,.007,'#594f42');eye.scale.y=.8}lineBetween(g,[-.02,1.49,.15],[.02,1.49,.15],'#594f42',.005)}
    const bag=new T.Group();bag.position.set(.28,.48,.04);g.add(bag);box(bag,0,0,0,.23,.28,.15,index%2?'#c7a167':'#a29a70');ring(bag,0,.17,0,.06,.012,'#705f43');bag.visible=false;g.userData.limbs=limbs;g.userData.bag=bag;return g;
  }
  buildBuildings(){
    const building=(x,z,w,h,d,color,rot=0)=>{const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rot;this.scene.add(g);box(g,0,h/2,0,w,h,d,color);box(g,0,.3,d/2+.02,w,.6,.13,'#a4967f');box(g,0,h-.12,0,w+.25,.25,d+.15,'#e1d0ae');
      const roof=new T.Shape();roof.moveTo(-w/2-.25,0);roof.lineTo(0,2.1);roof.lineTo(w/2+.25,0);roof.closePath();mesh(new T.ExtrudeGeometry(roof,{depth:d+.5,bevelEnabled:false}),'#946955',g,0,h,-d/2-.25);
      for(let yy=1.8;yy<h-.7;yy+=2.1)for(let xx=-w/2+.9;xx<w/2-.4;xx+=1.7){box(g,xx,yy,d/2+.035,.85,1.22,.09,'#f0dfbc');box(g,xx,yy,d/2+.09,.62,.96,.03,'#527b80');box(g,xx,yy,d/2+.12,.035,.94,.02,'#c4c5a8');box(g,xx,yy,d/2+.13,.61,.035,.02,'#c4c5a8');box(g,xx,yy-.62,d/2+.18,.98,.09,.26,'#d2c4a3');for(const side of [-1,1])box(g,xx+side*.55,yy,d/2+.1,.2,1.16,.05,'#647a6e');if(rand()>.6){box(g,xx,yy-.73,d/2+.3,.77,.17,.3,'#a97955');for(let k=0;k<4;k++)sphere(g,xx-.25+k*.17,yy-.59,d/2+.31,.11,k%2?'#ba654e':'#788f4c')}}
      box(g,0,1.1,d/2+.07,.95,2.2,.1,'#675f4a');for(const xx of [-w/2+.15,w/2-.15])box(g,xx,h*.5,d/2+.09,.12,h,.12,'#b7a78b');
    };
    const cs=['#cfb68e','#bdc0a1','#d2a78c','#a3b9b2','#d8c49a'];for(let i=0;i<12;i++){building(-17,7-i*7.1,7,5.8+rand()*1.7,7,cs[i%5],Math.PI/2);building(17,7-i*7.1,7,5.5+rand()*2,7,cs[(i+2)%5],-Math.PI/2)}for(let i=0;i<5;i++)building(-14+i*7,-77,6.9,6+rand()*2,5,cs[(i+1)%5]);
    const sign=label('DZIKI TARG · STARE MIASTO',8.6,.75,'#345b49','#f2dfb6',63);sign.position.set(0,4.6,-72);this.scene.add(sign);for(const x of [-4.6,4.6]){cylinder(this.scene,x,2.4,-72,.12,.12,4.8,'#54644d');sphere(this.scene,x,4.9,-72,.18,'#bf9b5e')}
  }
  tree(x,z,size=1){const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(size);this.scene.add(g);box(g,0,.17,0,1.8,.34,1.8,'#8f9277');box(g,0,.35,0,1.65,.1,1.65,'#5a694a');cylinder(g,0,1.65,0,.12,.21,3.1,'#80613e',9);for(const [xx,yy,zz,r] of [[0,3.9,0,1.4],[-.8,3.3,.1,1.1],[.8,3.4,.2,1.1],[.1,4.5,-.3,1]]){const crown=mesh(new T.IcosahedronGeometry(r,2),['#60864f','#759b58','#517b47'][Math.floor(rand()*3)],g,xx,yy,zz);crown.scale.y=.85}this.obstacles.push({x0:x-.9*size,x1:x+.9*size,z0:z-.9*size,z1:z+.9*size})}
  buildDecor(){
    for(const x of [-11,11])for(const z of [7,-10,-28,-46,-64])this.tree(x,z,.85+rand()*.15);
    for(const z of [-3,-15,-27,-39,-51,-63])for(let i=0;i<19;i++){const xx=-8.2+i*.91,yy=4.45-Math.sin(i/18*Math.PI)*.7;const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([-.23,0,0,.23,0,0,0,-.43,0],3));geo.computeVertexNormals();const flag=mesh(geo,new T.MeshStandardMaterial({color:['#c97851','#e6c273','#5c9278','#7c94a2'][i%4],side:T.DoubleSide}),this.scene,xx,yy,z);this.flags.push({mesh:flag,phase:i*.6});if(i<18)lineBetween(this.scene,[xx,yy,z],[xx+.91,4.45-Math.sin((i+1)/18*Math.PI)*.7,z],'#746a50',.01)}
    const kiosk=new T.Group();kiosk.position.set(PLAYER_SHOP.x,0,PLAYER_SHOP.z);kiosk.rotation.y=-.55;this.scene.add(kiosk);this.playerKiosk=kiosk;
    box(kiosk,0,.65,0,2.8,1.3,1.55,'#315c47');box(kiosk,0,1.36,0,3.02,.14,1.85,'#bda375');for(const x of [-1.32,1.32])box(kiosk,x,2.25,-.65,.1,1.75,.1,'#725e40');box(kiosk,0,3.08,-.65,3.15,.9,.13,'#264d3b');
    const sign=label('TWÓJ STRAGAN',2.85,.55,'#264d3b','#f2dc99',70);sign.position.set(0,3.1,-.57);kiosk.add(sign);const sub=label('TY USTALASZ CENĘ',2.4,.3,'#315c47','#ead4a0',61);sub.position.set(0,.73,.79);kiosk.add(sub);box(kiosk,0,1.73,-.48,2.7,.08,.45,'#bda375');
    this.obstacles.push({x0:5.1,x1:8.6,z0:6.4,z1:9});
    for(const x of [-10.3,10.3])for(const z of [1,-18,-36]){cylinder(this.scene,x,2.25,z,.045,.085,4.5,palette.iron,8);box(this.scene,x,4.45,z,.35,.08,.35,palette.iron);box(this.scene,x,4.18,z,.25,.43,.25,'#eed7a0');cylinder(this.scene,x,4.52,z,0,.27,.25,palette.iron,4)}
    for(const x of [-10,10]){const bench=new T.Group();bench.position.set(x,0,-71);this.scene.add(bench);for(let i=0;i<4;i++)box(bench,0,.58,-.23+i*.15,1.9,.07,.12,'#a58059');for(const xx of [-.7,.7])box(bench,xx,.3,0,.08,.58,.6,'#465e4f')}
    for(let i=0;i<7;i++){const cloud=new T.Group();cloud.position.set(-35+rand()*70,20+rand()*8,-45-rand()*20);this.scene.add(cloud);for(let j=0;j<4;j++){const s=sphere(cloud,j*2,0,0,2+rand(),'#e7eeea');s.scale.set(1.4,.35,.6);s.castShadow=false}}
    // Wayfinding on the ground and a visible sign for the player's stand.
    const arrow=label('TWÓJ STRAGAN  →',2.4,.45,'#ead8aa','#3e5d42',66);arrow.position.set(3,1.1,10.8);this.scene.add(arrow);cylinder(this.scene,3,.5,10.8,.03,.03,1,'#725f43',8);
  }
  setOffers(offers,catalog){
    this.offerGroups.forEach(disposeGroup);this.offerGroups=[];this.hitTargets=[];this.offerRoots=new Map();
    for(const offer of offers)this.addOffer(offer,catalog);
    this.highlight.visible=false;this.renderer.shadowMap.needsUpdate=true;
  }
  addOffer(offer,catalog){
    if(offer.sold)return;const item=catalog.find(i=>i.id===offer.itemId),group=new T.Group();group.position.set(-1.32+offer.slot*1.31,1.09,.35);const p=product(item.model);batchMeshes(p);p.rotation.y=[-.12,.12,-.08][offer.slot];group.add(p);this.stallGroups[offer.stand].add(group);group.updateWorldMatrix(true,true);const bounds=new T.Box3().setFromObject(p),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());group.worldToLocal(center);
      const hit=mesh(new T.BoxGeometry(Math.max(size.x,.7),Math.max(size.y,.6),Math.max(size.z,.65)),new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),group,center.x,center.y,center.z);hit.castShadow=false;hit.userData={offer:offer.uid,ownedMaterial:true};this.hitTargets.push(hit);group.userData.offer=offer.uid;this.offerRoots.set(offer.uid,p);
      const tag=label(`${offer.price.toLocaleString('pl-PL',{maximumFractionDigits:2})} zł`,.6,.2,'#f6e6bf','#4d513b',67);tag.rotation.x=-.65;tag.position.set(0,.013,.7);group.add(tag);this.offerGroups.push(group);
    this.renderer.shadowMap.needsUpdate=true;
  }
  setPlayerStock(entries,catalog){
    this.playerGoods.forEach(disposeGroup);this.playerGoods=[];
    entries.forEach((entry,i)=>{const group=new T.Group(),p=product(catalog.find(c=>c.id===entry.itemId).model);p.scale.setScalar(.6);group.add(p);group.position.set(-1.05+(i%4)*.7,i<4?1.44:1.78,i<4?.22:-.48);this.playerKiosk.add(group);const tag=label(`${entry.ask.toLocaleString('pl-PL')} zł`,.48,.13,'#f3d68c','#3b5038',69);tag.position.set(0,0,.33);tag.rotation.x=-.6;group.add(tag);this.playerGoods.push(group)});this.renderer.shadowMap.needsUpdate=true;
  }
  removeOffer(uid){const group=this.offerGroups.find(g=>g.userData.offer===uid);if(group){disposeGroup(group);this.offerGroups=this.offerGroups.filter(g=>g!==group);this.hitTargets=this.hitTargets.filter(h=>h.userData.offer!==uid);this.offerRoots.delete(uid);this.highlight.visible=false;this.renderer.shadowMap.needsUpdate=true}}
  target(){this.ray.setFromCamera(this.pointer,this.camera);const hit=this.ray.intersectObjects(this.hitTargets,false).find(h=>h.distance<3.7&&this.visiblePath(h.point));if(hit){this.highlight.setFromObject(this.offerRoots.get(hit.object.userData.offer));this.highlight.visible=true;return hit.object.userData.offer}this.highlight.visible=false;return null}
  pickCustomer(clientX=null,clientY=null){const point=new T.Vector2();if(clientX!==null){const r=this.canvas.getBoundingClientRect();point.set((clientX-r.left)/r.width*2-1,-((clientY-r.top)/r.height*2-1))}this.ray.setFromCamera(point,this.camera);const hit=this.ray.intersectObjects(this.customerHitTargets,false).find(h=>h.distance<8&&h.object.visible&&h.object.parent.visible&&this.visiblePath(h.point));return hit?hit.object.userData.customer:null}
  visiblePath(point){const pos=this.camera.position,dx=point.x-pos.x,dz=point.z-pos.z,dist=Math.hypot(dx,dz);for(const b of this.obstacles)for(let t=.25;t<dist-.65;t+=.3){const x=pos.x+dx*t/dist,z=pos.z+dz*t/dist;if(x>b.x0&&x<b.x1&&z>b.z0&&z<b.z1)return false}return true}
  nearKiosk(){return Math.hypot(this.camera.position.x-PLAYER_SHOP.x,this.camera.position.z-PLAYER_SHOP.z)<3.9}
  look(dx,dy){this.yaw-=dx*.0022;this.pitch=Math.max(-1.3,Math.min(1.15,this.pitch-dy*.0022));this.camera.rotation.set(this.pitch,this.yaw,0)}
  walkable(x,z){return x>BOUNDS.left&&x<BOUNDS.right&&z>BOUNDS.back&&z<BOUNDS.front&&!this.obstacles.some(b=>x>b.x0-.26&&x<b.x1+.26&&z>b.z0-.26&&z<b.z1+.26)}
  move(keys,dt,time,stick={x:0,y:0}){const speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?6:3.4;let f=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)+stick.y,r=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+stick.x;const norm=Math.max(1,Math.hypot(f,r));f/=norm;r/=norm;const dx=(-Math.sin(this.yaw)*f+Math.cos(this.yaw)*r)*speed*dt,dz=(-Math.cos(this.yaw)*f-Math.sin(this.yaw)*r)*speed*dt,pos=this.camera.position;if(this.walkable(pos.x+dx,pos.z))pos.x+=dx;if(this.walkable(pos.x,pos.z+dz))pos.z+=dz;
    if(keys.has('Space')&&this.jump===undefined)this.jump=4.1;if(this.jump!==undefined){this.jump-=dt*11;this.jumpHeight=Math.max(0,(this.jumpHeight||0)+this.jump*dt);if(this.jumpHeight===0&&this.jump<0)this.jump=undefined}pos.y=1.76+(this.jumpHeight||0)+((f||r)?Math.sin(time*(speed>4?13:9))*.022:0);this.camera.rotation.set(this.pitch,this.yaw,0);
  }
  syncCustomers(customers,time){
    for(const c of customers){let g=this.customerMeshes.get(c.id);if(!g){g=this.person(this.scene,c.x,c.z,colors[(c.id+3)%16],c.id);g.traverse(o=>{if(o.isMesh){o.castShadow=false;o.userData.customer=c.id;this.customerHitTargets.push(o)}});const shadow=mesh(new T.CircleGeometry(.35,16),new T.MeshBasicMaterial({color:'#384c35',transparent:true,opacity:.16,depthWrite:false}),g,0,.015,0);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;this.customerMeshes.set(c.id,g)}g.position.set(c.x,c.walking?Math.abs(Math.sin(time*7+c.phase))*.025:0,c.z);g.rotation.y=c.heading||0;g.userData.limbs.forEach((limb,i)=>limb.rotation.x=c.walking?Math.sin(time*7+c.phase+(i%2?Math.PI:0))*(i<2?.48:.28):0);g.userData.bag.visible=c.bag;
      if(c.bubbleTime>0){if(g.userData.bubbleText!==c.bubble){if(g.userData.bubble)disposeGroup(g.userData.bubble);const b=label(c.bubble,c.stage==='waiting'?2.15:1.2,.33,'#faf0d3',c.stage==='waiting'?'#a46e31':'#40543c',68);b.position.set(0,2.03,0);g.add(b);g.userData.bubble=b;g.userData.bubbleText=c.bubble}g.userData.bubble.visible=true;g.userData.bubble.quaternion.copy(this.camera.quaternion).premultiply(g.quaternion.clone().invert())}else if(g.userData.bubble)g.userData.bubble.visible=false;
    }
  }
  render(time=0){this.flags.forEach(f=>f.mesh.rotation.y=Math.sin(time*1.5+f.phase)*.13);this.renderer.render(this.scene,this.camera)}
  map(ctx,customers=[]){const scale=1.55,ox=72,oz=119;ctx.clearRect(0,0,144,144);ctx.fillStyle='#f0eadb';ctx.fillRect(0,0,144,144);ctx.fillStyle='#e0d8c3';ctx.fillRect(45,8,54,131);ctx.save();ctx.translate(ox,oz);ctx.scale(scale,scale);for(const [i,[x,z,r]] of STANDS.entries()){ctx.save();ctx.translate(x,z);ctx.rotate(-r);ctx.fillStyle=colors[i%colors.length];ctx.fillRect(-2.2,-1.1,4.4,2.2);ctx.restore()}ctx.fillStyle='#bd9650';ctx.fillRect(PLAYER_SHOP.x-1.5,PLAYER_SHOP.z-1,3,2);ctx.fillStyle='#9d8e73';for(const c of customers){ctx.beginPath();ctx.arc(c.x,c.z,.55,0,Math.PI*2);ctx.fill()}ctx.translate(this.camera.position.x,this.camera.position.z);ctx.rotate(-this.yaw);ctx.beginPath();ctx.moveTo(0,-1.9);ctx.lineTo(-1.1,1.1);ctx.lineTo(0,.65);ctx.lineTo(1.1,1.1);ctx.closePath();ctx.fillStyle='#315b48';ctx.fill();ctx.restore();ctx.font='8px Consolas';ctx.fillStyle='#7a826b';ctx.fillText('N',69,10)}
}
