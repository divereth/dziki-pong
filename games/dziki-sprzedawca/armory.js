import * as T from './vendor/three.module.min.js';
import {box,cylinder,sphere,label} from './models.js';

export const ARMORY_ENTRY_FEE=1000;
export const RIFLES=[
  {id:'karabin-treningowy',name:'Karabin treningowy',price:650,desc:'Lekki i wygodny na początek.',color:'#826a45',cooldown:.24},
  {id:'karabin-precyzyjny',name:'Karabin precyzyjny',price:1250,desc:'Stabilny, z długą lufą.',color:'#52645d',cooldown:.42},
  {id:'karabin-taktyczny',name:'Karabin taktyczny',price:1850,desc:'Cięższy model z celownikiem.',color:'#414b4a',cooldown:.18},
];

export function ensureArmory(state){
  const current=state.armory&&typeof state.armory==='object'?state.armory:{};
  const owned=Array.isArray(current.owned)?[...new Set(current.owned.filter(id=>RIFLES.some(item=>item.id===id)))]:[];
  state.armory={unlocked:current.unlocked===true,owned,equipped:owned.includes(current.equipped)?current.equipped:owned[owned.length-1]||null,hits:Number.isInteger(current.hits)&&current.hits>=0?current.hits:0};
  return state.armory;
}

export function unlockArmory(state){
  const armory=ensureArmory(state);
  if(armory.unlocked)return {ok:true,charged:0};
  if(state.cash<ARMORY_ENTRY_FEE)return {ok:false,message:'Ochroniarz żąda 1 000 zł za wejście. Brakuje Ci gotówki.'};
  state.cash=Math.round((state.cash-ARMORY_ENTRY_FEE)*100)/100;armory.unlocked=true;
  return {ok:true,charged:ARMORY_ENTRY_FEE};
}

export function buyArmoryRifle(state,id){
  const armory=ensureArmory(state),rifle=RIFLES.find(item=>item.id===id);
  if(!armory.unlocked)return {ok:false,message:'Najpierw zapłać ochroniarzowi za wejście do arsenału.'};
  if(!rifle)return {ok:false,message:'Ten karabin nie jest dostępny.'};
  if(armory.owned.includes(id))return {ok:false,message:'Ten karabin jest już Twój.'};
  if(state.cash<rifle.price)return {ok:false,message:'Za mało gotówki na ten karabin.'};
  state.cash=Math.round((state.cash-rifle.price)*100)/100;armory.owned.push(id);armory.equipped=id;
  return {ok:true,rifle};
}

function rifleModel(id){
  const rifle=RIFLES.find(item=>item.id===id)||RIFLES[0],g=new T.Group(),metal='#3d4542',wood=rifle.color;
  box(g,-.43,0,0,.45,.16,.18,wood);box(g,-.12,.015,0,.25,.2,.22,metal);box(g,.1,.015,0,.37,.24,.26,metal);
  box(g,.43,.035,0,.48,.075,.085,'#69736d');box(g,.65,.035,0,.06,.12,.12,'#85887b');
  box(g,.02,-.19,.015,.13,.22,.12,wood);box(g,.1,-.27,0,.16,.21,.16,metal);box(g,-.02,.15,0,.08,.07,.08,'#c2ab72');
  if(id==='karabin-precyzyjny')box(g,.23,.17,0,.34,.08,.1,'#a5a181');
  if(id==='karabin-taktyczny'){box(g,-.19,.15,0,.32,.075,.1,'#858e83');box(g,.36,.14,0,.12,.1,.1,'#c2ab72');}
  return g;
}

function invisibleHit(parent,x,y,z,w,h,d){
  const material=new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),hit=new T.Mesh(new T.BoxGeometry(w,h,d),material);
  hit.position.set(x,y,z);hit.userData.armoryHit=true;hit.castShadow=false;parent.add(hit);return hit;
}

export class ArmoryMarket{
  constructor(world,state){
    this.world=world;this.state=state;this.origin={x:145,z:0};this.group=new T.Group();this.group.position.set(this.origin.x,0,this.origin.z);this.group.name='weapon-market-room';world.scene.add(this.group);
    this.targets=[];this.goods=[];this.shootTargets=[];this.targetBoards=[];this.viewModel=null;this.lastShot=-Infinity;this.recoil=0;
    this.buildRoom();this.refresh();this.group.visible=false;
  }
  buildRoom(){
    const g=this.group;
    box(g,0,-.16,-4,24,.32,26,'#37383a');box(g,-12,2,-4,.35,4,26,'#292d30');box(g,12,2,-4,.35,4,26,'#292d30');
    box(g,0,2,-17,24,4,.35,'#292d30');box(g,0,2,9,24,4,.35,'#292d30');
    box(g,0,3.98,-4,24,.16,26,'#222629');
    for(const x of [-9,0,9]){
      box(g,x,3.86,-4,1.45,.1,1.45,'#171b1c');const bulb=sphere(g,x,3.7,-4,.18,'#ffe0a5');bulb.material=bulb.material.clone();bulb.material.emissive.set('#ffc36b');bulb.material.emissiveIntensity=2;
      const light=new T.PointLight('#ffc67c',47,13,2);light.position.set(x,3.55,-4);g.add(light);
    }
    const header=label('ARSENAŁ · TARG KARABINÓW',10,.9,'#182022','#d6bd83');header.position.set(0,3.05,-16.72);g.add(header);
    const range=label('STRZELNICA TRENINGOWA',6.4,.48,'#282e30','#d8c894');range.position.set(0,2.85,-16.7);g.add(range);
    const exit=box(g,0,1.1,8.2,2.25,2.2,.16,'#435047');this.targets.push({object:exit,action:'armory-exit',title:'Wyjście z arsenału'});
    for(const x of [-1.2,1.2])box(g,x,1.48,8.07,.13,2.96,.22,'#c1b28c');box(g,0,3,8.07,2.53,.16,.22,'#c1b28c');
    const exitSign=label('WYJŚCIE',2.6,.4,'#28352d','#ead59c');exitSign.position.set(0,3.45,7.95);g.add(exitSign);
    const boardColor=['#9e6652','#66818a','#8b7954','#667f61','#8c6e89'];
    for(let i=0;i<5;i++){
      const x=-8+i*4,z=-14.7;
      box(g,x,1.54,z,1.3,1.55,.16,'#7c7564');
      for(const [radius,color,offset] of [[.56,'#d5cbb2',.105],[.43,'#9f5b4c',.15],[.29,'#dfd2b2',.195],[.14,boardColor[i],.24]]){
        const disc=cylinder(g,x,1.54,z+offset,radius,radius,.035,color,24);disc.rotation.x=Math.PI/2;
      }
      const collider=invisibleHit(g,x,1.54,z+.3,1.35,1.6,.64);this.shootTargets.push(collider);
      this.targets.push({object:collider,action:'shoot-target',index:i,title:`Tarcza ${i+1}`});
      const marker=sphere(g,x,1.54,z+.29,.12,'#f3dc8d');marker.material=marker.material.clone();marker.material.emissive.set('#ffdc73');marker.material.emissiveIntensity=3;marker.visible=false;this.targetBoards.push({collider,marker,until:0});
      const number=label(String(i+1),.36,.28,'#282d2e','#e1cc91',76);number.position.set(x,2.56,z+.2);g.add(number);
    }
    for(let i=0;i<RIFLES.length;i++){
      const item=RIFLES[i],x=-7+i*7,z=-1.5;
      const rug=box(g,x,.025,z,5.3,.05,3.15,i%2?'#504239':'#3c4643');
      box(g,x,1.05,z-.32,4.8,.16,1.1,'#7a5e42');box(g,x,1.88,z-.78,4.8,1.55,.13,'#4d5049');box(g,x,2.72,z-.78,4.98,.13,.2,'#9b805b');
      for(const dx of [-2.25,2.25])box(g,x+dx,1.34,z-.78,.13,.72,.17,'#967551');
      const model=rifleModel(item.id);model.position.set(x,1.24,z-.18);g.add(model);
      const sign=label(`${item.name} · ${item.price.toLocaleString('pl-PL')} ZŁ`,4.55,.48,'#292d2d','#e3ce98',57);sign.position.set(x,2.52,z-.59);g.add(sign);
      const hit=invisibleHit(g,x,1.55,z-.12,1.95,.9,1.05);this.targets.push({object:hit,action:'weapon-buy',index:i,title:item.name});
      this.goods.push({item,model,sign,rug});
    }
    const wallNotice=label('CELE TRENINGOWE · STRZAŁY NIE WPŁYWAJĄ NA TARG',8,.42,'#292d2d','#c7c3ad',53);wallNotice.position.set(0,.62,-16.68);g.add(wallNotice);
  }
  refresh(){
    const armory=ensureArmory(this.state);
    this.goods.forEach((good,i)=>{
      const owned=armory.owned.includes(good.item.id);good.model.visible=!owned;good.rug.visible=true;good.sign.visible=true;
      good.sign.removeFromParent();good.sign.geometry.dispose();good.sign.material.map?.dispose();good.sign.material.dispose();good.sign=label(owned?`${good.item.name} · WYPOSAŻONY`: `${good.item.name} · ${good.item.price.toLocaleString('pl-PL')} ZŁ`,4.55,.48,'#292d2d',owned?'#a7c18a':'#e3ce98',57);good.sign.position.set(-7+i*7,2.52,-2.09);this.group.add(good.sign);
      const target=this.targets.find(t=>t.action==='weapon-buy'&&t.index===i);if(target)target.object.visible=!owned;
    });
    const rifle=RIFLES.find(item=>item.id===armory.equipped);
    if(this.viewModel){this.viewModel.traverse(object=>{if(object.isMesh)object.geometry.dispose()});this.viewModel.removeFromParent();this.viewModel=null;}
    if(rifle){this.viewModel=rifleModel(rifle.id);this.viewModel.scale.setScalar(.72);this.viewModel.rotation.y=Math.PI/2;this.viewModel.position.set(.39,-.34,-.76);this.viewModel.traverse(object=>{object.castShadow=false;object.receiveShadow=false;});this.world.camera.add(this.viewModel);this.viewModel.visible=this.world.underworld?.armoryInside===true;}
  }
  walkable(x,z){const localX=x-this.origin.x,localZ=z-this.origin.z;return localX>-11.3&&localX<11.3&&localZ>-15.6&&localZ<7.1;}
  update(dt,time,inside){if(this.viewModel){this.viewModel.visible=inside;this.recoil=Math.max(0,this.recoil-dt*1.5);this.viewModel.position.z=-.76+this.recoil;}for(const board of this.targetBoards)if(board.marker.visible&&time>board.until)board.marker.visible=false;}
  fire(time){
    const armory=ensureArmory(this.state),rifle=RIFLES.find(item=>item.id===armory.equipped);
    if(!rifle)return {ok:false,message:'Najpierw kup karabin na jednym ze stoisk.'};
    if(time-this.lastShot<rifle.cooldown)return {ok:false,cooldown:true};
    this.lastShot=time;this.recoil=.075;
    this.world.ray.setFromCamera(this.world.pointer,this.world.camera);
    const hit=this.world.ray.intersectObjects(this.shootTargets,false).find(result=>result.distance<35);
    if(!hit)return {ok:true,hit:false,rifle};
    const board=this.targetBoards.find(candidate=>candidate.collider===hit.object);if(!board)return {ok:true,hit:false,rifle};
    armory.hits++;board.marker.visible=true;board.until=time+.22;
    return {ok:true,hit:true,hits:armory.hits,rifle};
  }
}
