import * as T from './vendor/three.module.min.js';
import {box,cylinder,sphere,label} from './models.js';
import {CONTRABAND,contrabandModel} from './contraband.js';
import {ensureBlackMarket,PolicePatrol} from './black-market.js';
export class Underworld{
 constructor(world,state){
  this.world=world;this.state=state;this.inside=false;this.targets=[];this.goods=[];this.patrol=new PolicePatrol();const b=ensureBlackMarket(state);
  this.mainLights=world.scene.children.filter(o=>o.isLight).map(o=>[o,o.intensity]);this.dayBackground=world.scene.background;this.dayFog=world.scene.fog;this.environmentIntensity=world.scene.environmentIntensity;
  this.guard=world.person(world.scene,11,-12,'#25232b',2);this.guard.scale.set(1.65,1.23,1.55);this.guard.rotation.y=-Math.PI/2;
  const door=box(world.scene,13.43,1.2,-12,.08,2.4,1.5,'#1b2424');this.targets.push({object:door,action:'door',title:'Ochroniarz · wejście do Czarnego Rynku'});
  const plaque=label('TEREN PRYWATNY',1.2,.24,'#27292c','#9a8d74');plaque.position.set(12.95,2.7,-12);plaque.rotation.y=-Math.PI/2;world.scene.add(plaque);
  const windows=world.secretWindows||[],spot=windows[b.window%windows.length];
  if(spot){const button=box(world.scene,spot.x,spot.y-.27,spot.z,.12,.12,.12,'#702f28');this.targets.push({object:button,action:'button',title:'Mały przycisk pod ramą okna'});}
  this.police=world.person(world.scene,this.patrol.x,this.patrol.z,'#183359',0);cylinder(this.police,0,1.74,0,.19,.19,.08,'#16345a',16);box(this.police,.1,1.04,.22,.055,.09,.015,'#c8b36b');const badge=label('POLICJA',.42,.1,'#16345a','#e5e9dc');badge.position.set(0,1.15,.22);this.police.add(badge);
  this.area=new T.Group();world.scene.add(this.area);box(this.area,100,-.13,-15,36,.25,48,'#24272c');
  for(const x of [82,118])box(this.area,x,2,-15,.4,4,48,'#272830');for(const z of [-39,9])box(this.area,100,2,z,36,4,.4,'#272830');
  // Lamps are local to this courtyard; their light never reaches the ordinary market.
  for(const x of [85,115])for(const z of [3,-9,-22,-35]){cylinder(this.area,x,2,z,.055,.09,4,'#282d32');box(this.area,x,4,z,.48,.14,.48,'#10151b');const bulb=sphere(this.area,x,3.8,z,.18,'#ffd38a');bulb.material=bulb.material.clone();bulb.material.emissive.set('#ffb85b');bulb.material.emissiveIntensity=2;const light=new T.PointLight('#ffc67c',90,13,2);light.position.set(x,3.7,z);this.area.add(light);}
  const name=label('CZARNY RYNEK',7,.85,'#171c24','#c59c62');name.position.set(100,3,-38.7);this.area.add(name);
  this.exit=box(this.area,100,1.15,8.7,2,2.3,.15,'#434b4e');this.targets.push({object:this.exit,action:'exit',title:'Powrót na zwykły targ'});
  const exitLamp=new T.Group();exitLamp.name='black-market-exit-lamp';exitLamp.position.set(100,2.65,8.35);this.area.add(exitLamp);
  box(exitLamp,0,.07,0,.72,.14,.36,'#1c2328');const exitBulb=box(exitLamp,0,-.035,-.02,.54,.045,.23,'#ffe1aa');exitBulb.material=exitBulb.material.clone();exitBulb.material.emissive.set('#ffbf69');exitBulb.material.emissiveIntensity=3;
  const exitLight=new T.SpotLight('#ffd48e',55,8,Math.PI/3,.7,2);exitLight.position.set(0,-.1,-.7);exitLight.target.position.set(0,-1.55,.3);exitLamp.add(exitLight,exitLight.target);
  CONTRABAND.forEach((item,i)=>{const x=i%2?110:90,z=1-Math.floor(i/2)*10;const rug=box(this.area,x,.018,z,7,.035,6,i%2?'#574039':'#363f46');
   for(const side of [-1,1])for(let j=0;j<18;j++)box(this.area,x-3.4+j*.4,.025,z+side*3,.05,.02,.25,'#a18b68');
   const vendor=world.person(this.area,x+(i%2?3:-3),z-2,'#403b36',i+3);vendor.rotation.y=i%2?-1:1;
   const model=contrabandModel(item,1,true);model.position.set(x,.045,z);this.area.add(model);const hit=box(this.area,x,1,z,item.shape==='tank'?9:5,2,item.shape==='tank'?5:3,'#222222');hit.material=new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false});hit.castShadow=false;
   const sign=label('',4,.45,'#171d24','#d1b88a');sign.position.set(x,.75,z+3.2);this.area.add(sign);this.goods.push({model,hit,sign,item});this.targets.push({object:hit,action:'buy',index:i,title:item.name});
  });this.refresh();this.area.visible=false;
 }
 refresh(){const b=ensureBlackMarket(this.state);this.goods.forEach((g,i)=>{g.model.visible=g.hit.visible=!b.offers[i].sold;g.sign.visible=!b.offers[i].sold;const text=`${g.item.name} · ${b.offers[i].price.toLocaleString('pl-PL')} zł`;if(g.text!==text){const old=g.sign;const sign=label(text,5,.42,'#171d24','#d1b88a',55);sign.position.copy(old.position);this.area.add(sign);old.removeFromParent();old.geometry.dispose();old.material.map?.dispose();old.material.dispose();g.sign=sign;g.text=text;}});}
 target(){const w=this.world;w.ray.setFromCamera(w.pointer,w.camera);const candidates=this.targets.filter(t=>this.inside?['buy','exit'].includes(t.action)&&t.object.visible:['door','button'].includes(t.action));const hits=w.ray.intersectObjects(candidates.map(t=>t.object),false);const hit=hits.find(h=>h.distance<(this.inside?8:3.8));return hit?candidates.find(t=>t.object===hit.object):null;}
 enter(inside){this.inside=inside;const w=this.world;this.area.visible=inside;w.camera.position.set(inside?100:10,1.76,inside?5:-12);w.yaw=inside?0:-Math.PI/2;w.pitch=0;w.camera.rotation.set(0,w.yaw,0);w.jump=undefined;w.jumpHeight=0;
  this.mainLights.forEach(([light,intensity])=>light.intensity=inside?(light.isHemisphereLight?.08:0):intensity);w.scene.background=inside?new T.Color('#070a12'):this.dayBackground;w.scene.fog=inside?new T.Fog('#090d16',12,52):this.dayFog;w.scene.environmentIntensity=inside?.06:this.environmentIntensity;w.renderer.shadowMap.needsUpdate=true;
 }
 walkable(x,z){return x>82.6&&x<117.4&&z>-38.5&&z<8.2&&!this.goods.some(g=>g.model.visible&&Math.abs(x-g.model.position.x)<(g.item.shape==='tank'?4:2.2)&&Math.abs(z-g.model.position.z)<1.7);}
 update(dt,time){const result=this.patrol.update(dt,this.state);this.police.position.set(this.patrol.x,0,this.patrol.z);this.police.rotation.y=this.patrol.heading;this.police.userData.limbs.forEach((limb,i)=>limb.rotation.x=Math.sin(time*7+(i%2?Math.PI:0))*.3);return result;}
}

