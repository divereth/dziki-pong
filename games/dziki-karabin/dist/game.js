import * as THREE from './vendor/three.module.min.js';
import {WEAPONS,KNIFE,MAP,OBSTACLES,CHEST_POSITIONS,blocked,moveBody,settleDeath,winningTeam,reloadAmmo,purchaseWeapon,findPath} from './core.js';
import {createTouchControls} from './touch-controls.js';

const $=id=>document.getElementById(id);
const show=(id,yes=true)=>$(id).classList.toggle('hidden',!yes);
const clamp=THREE.MathUtils.clamp;
const rand=(a,b)=>a+Math.random()*(b-a);
const clock=new THREE.Clock();
const nativeTouch=!!window.matchMedia?.('(pointer: coarse)')?.matches;
let controlPreference=null;
try{controlPreference=localStorage.getItem('dzikikarabin-controls');}catch{}
let touchMode=controlPreference==='touch'||controlPreference!=='mouse'&&nativeTouch;
let renderer;
try{
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,nativeTouch?1.25:1.7));
  renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
  $('world').appendChild(renderer.domElement);
}catch(error){show('loading',false);show('unsupported');throw error;}
const scene=new THREE.Scene();scene.background=new THREE.Color('#becfd0');scene.fog=new THREE.Fog('#becfd0',44,115);
const camera=new THREE.PerspectiveCamera(76,innerWidth/innerHeight,.04,160);camera.rotation.order='YXZ';scene.add(camera);
scene.add(new THREE.HemisphereLight('#e5f4f3','#777457',2.6));
const sun=new THREE.DirectionalLight('#fff0d4',3.2);sun.position.set(-18,38,14);sun.castShadow=true;
sun.shadow.mapSize.set(nativeTouch?1024:2048,nativeTouch?1024:2048);Object.assign(sun.shadow.camera,{left:-43,right:43,top:43,bottom:-43,near:1,far:100});sun.shadow.bias=-.00035;sun.shadow.normalBias=.025;scene.add(sun);
const mats={};
function material(color,extra={}){const key=color+(extra.map?extra.map.uuid:JSON.stringify(extra));return mats[key]??=new THREE.MeshStandardMaterial({color,roughness:.92,...extra});}
const raycastWalls=[];
function box(w,h,d,x,y,z,color,parent=scene,shadow=true){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),typeof color==='string'?material(color):color);m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;parent.add(m);return m;}
function label(text,bg='#c5f576',fg='#25382b',w=256,h=128){const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);ctx.fillStyle=fg;ctx.font=`900 ${h*.7}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,w/2,h*.53);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return material('#ffffff',{map:tex});}

function makeMap(){
  box(180,.5,180,0,-.36,0,'#a6a18a',scene,false);
  const floor=box(60,.15,48,0,-.08,0,'#b5b49a',scene,false);floor.receiveShadow=true;
  // Fine paving joints make movement and distances readable without texture downloads.
  const grid=new THREE.GridHelper(60,40,'#989f89','#a6aa91');grid.position.y=.008;grid.scale.z=.8;grid.material.transparent=true;grid.material.opacity=.25;scene.add(grid);
  box(56,.018,8,0,.013,0,'#c1bda4',scene,false);box(9,.019,42,0,.014,0,'#c0bda4',scene,false);
  for(const o of OBSTACLES){
    const color=o.kind==='boundary'?'#a7a78a':o.kind==='building'?(o.x<0?'#c4b39a':'#acb9ac'):o.kind==='tower'?'#bbc1ac':o.kind==='crate'?'#8e8669':'#acb1a0';
    const base=box(o.w,o.h,o.d,o.x,o.h/2,o.z,color);raycastWalls.push(base);
    if(o.kind==='building'){
      box(o.w+.35,.25,o.d+.35,o.x,o.h+.12,o.z,'#d7d4bc');
      box(o.w+.05,.34,o.d+.05,o.x,.3,o.z,'#879c8a');
      const front=o.z<0?1:-1;
      box(o.w-.1,.65,.04,o.x,2.65,o.z+front*(o.d/2+.025),o.x<0?'#648d80':'#d09972');
      for(let dx=-o.w/2+1.3;dx<o.w/2-1;dx+=2.3){box(1.1,1.1,.1,o.x+dx,3.85,o.z+front*(o.d/2+.06),'#425a54');box(1.1,.1,.2,o.x+dx,3.3,o.z+front*(o.d/2+.12),'#ddd7bd');}
      box(1.8,2.5,.1,o.x,1.25,o.z+front*(o.d/2+.06),'#536f61');
      const roof=box(2,.7,1.6,o.x+1.5,o.h+.6,o.z-.4,'#8a9c8b');
      for(let v=-.7;v<=.7;v+=.35)box(.09,.06,1.4,roof.position.x+v,o.h+.98,roof.position.z,'#526d5e');
      box(.12,2.5,.12,o.x-o.w/3,o.h+1.4,o.z,'#607567');
    }else if(o.kind==='tower'){
      box(5.45,.28,6.45,0,6.4,0,'#d6d1b7');
      box(5.08,.65,6.08,0,4.9,0,'#6b9e8a');
      const sign=box(2,1.5,.04,0,3.5,3.04,label('07','#d4a879','#33463a'));
      box(2,1.5,.04,0,3.5,-3.04,label('07','#a1c2a2','#33463a')).rotation.y=Math.PI;
      box(.17,4.4,.17,.8,8.5,0,'#566e5d');
      box(2.7,.1,.1,.8,10.3,0,'#566e5d');
      box(.09,.09,2.3,.8,9.8,0,'#566e5d');
      box(1.4,1.1,.1,1.4,9.3,0,'#c5f576');
      for(let n=0;n<4;n++){box(.06,.06,1.4,2.55,1+n*.7,0,'#526a5b');box(.06,3.1,.06,2.55,2.05,-.7,'#526a5b');box(.06,3.1,.06,2.55,2.05,.7,'#526a5b');}
    }else if(o.kind==='crate'){
      box(o.w+.08,.16,o.d+.08,o.x,.22,o.z,'#5c7060');box(o.w+.08,.16,o.d+.08,o.x,o.h-.22,o.z,'#5c7060');
      for(const s of [-1,1])box(.15,o.h+.04,o.d+.05,o.x+s*(o.w/2-.25),o.h/2,o.z,'#b1ac89');
    }else if(o.kind==='cover'){
      box(o.w+.1,.16,o.d+.1,o.x,o.h,o.z,'#cfceb3');
      for(let n=-o.w/2+.4;n<o.w/2;n+=1.1)box(.05,.8,.03,o.x+n,.9,o.z+o.d/2+.02,'#8d9c86');
    }
  }
  // Perimeter towers and palms frame the arena, leaving the playable lanes clear.
  for(const x of [-29,29])for(const z of [-23,23]){box(3,7,3,x,3.5,z,'#b4b69c');box(3.5,.5,3.5,x,7.2,z,'#d1cdb0');box(2.6,.8,2.6,x,7.7,z,'#708f78');}
  const palm=(x,z,s=1)=>{
    const p=new THREE.Group();p.position.set(x,0,z);p.scale.setScalar(s);scene.add(p);
    box(.6,6.2,.6,0,3.1,0,'#9c9770',p);for(let i=0;i<5;i++)box(.68,.13,.68,0,1+i,0,'#777e57',p);
    box(1.5,1.3,1.5,0,6.2,0,'#799264',p);
    for(let a=0;a<6;a++){const leaf=box(4,.32,1.2,Math.cos(a*Math.PI/3)*1.8,6.4,Math.sin(a*Math.PI/3)*1.8,a%2?'#719361':'#8aab6d',p);leaf.rotation.y=-a*Math.PI/3;leaf.rotation.z=(a%2?.12:-.12);}
  };
  [[-25,-19],[-25,20],[26,-20],[25,21],[-33,7],[34,-7]].forEach(([x,z])=>palm(x,z,rand(.9,1.1)));
  for(let i=0;i<15;i++){
    const x=-75+i*11,z=i%2?-55:55;
    box(rand(5,12),rand(7,17),rand(5,12),x,4,z,i%2?'#b3b9ac':'#a0b3a7',scene,false);
  }
  for(const x of [-27,27]){
    const team=x<0?'#71b9a9':'#d59c71';
    box(3.5,.025,9,x,.03,0,team,scene,false);
    for(let z=-3;z<=3;z+=1.5)box(.7,.03,.1,x,.05,z,'#e6e6c9',scene,false);
    box(.12,6,.12,x,3,-9,'#6a7d67');box(.08,1.8,2.5,x+.1,5.1,-8.1,team);
  }
  for(const [x,z]of [[-11,18],[11,-18],[-26,9],[26,-9]]){
    box(1.1,1.25,1.1,x,.625,z,'#638a78');box(1.17,.1,1.17,x,1.2,z,'#496a5a');
  }
  for(let i=0;i<45;i++){
    const x=rand(-28,28),z=rand(-22,22);if(blocked(x,z,1)||Math.abs(x)<4||Math.abs(z)<5)continue;
    box(rand(.1,.25),.08,rand(.12,.3),x,.04,z,'#a0a58b',scene,false);
  }
}
makeMap();

const chests=[];
for(const p of CHEST_POSITIONS){
  const group=new THREE.Group();group.position.set(p.x,0,p.z);scene.add(group);
  box(1.3,.65,.9,0,.4,0,'#c7a265',group);box(1.34,.12,.94,0,.11,0,'#6b6d4f',group);
  for(const x of [-.43,.43])box(.13,.62,.95,x,.4,0,'#606f54',group);
  const lid=new THREE.Group();lid.position.set(0,.77,-.45);group.add(lid);box(1.35,.17,.95,0,0,.45,'#e0ba78',lid);
  box(.25,.28,.06,0,.58,.49,'#c5f576',group);
  const glow=box(.9,.015,.6,0,.025,0,material('#c5f576',{emissive:'#7da94b',emissiveIntensity:.4}),group,false);
  chests.push({...p,group,lid,glow,opened:false,opening:0});
}

function soldier(team){
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const uniform=team===0?'#5a9c8c':'#b58360',dark=team===0?'#355c53':'#6d5142';
  box(.73,.72,.4,0,1.02,0,uniform,body);box(.64,.25,.45,0,.78,0,dark,body);
  box(.7,.42,.08,0,1.04,.24,dark,body);
  box(.15,.19,.11,-.19,1.05,.3,'#9db29a',body);box(.15,.19,.11,.01,1.05,.3,'#9db29a',body);
  box(.64,.57,.61,0,1.67,0,'#cca67f',body);
  box(.69,.22,.67,0,1.94,0,uniform,body);box(.73,.12,.7,0,1.79,0,dark,body);
  box(.12,.1,.03,-.16,1.7,.32,'#263d32',body);box(.12,.1,.03,.16,1.7,.32,'#263d32',body);
  box(.14,.07,.04,0,1.48,.32,'#775743',body);
  const legs=[];for(const x of [-.21,.21]){const leg=new THREE.Group();leg.position.set(x,.72,0);body.add(leg);box(.28,.64,.31,0,-.32,0,dark,leg);box(.3,.18,.42,0,-.65,.04,'#36493d',leg);legs.push(leg);}
  const arms=[];for(const x of [-.49,.49]){const arm=new THREE.Group();arm.position.set(x,1.3,0);body.add(arm);box(.25,.5,.28,0,-.23,0,uniform,arm);box(.24,.24,.25,0,-.52,.01,'#c4a17c',arm);arms.push(arm);}
  arms[0].rotation.x=-.9;arms[1].rotation.x=-1.15;
  const gun=new THREE.Group();gun.position.set(.27,1.12,.42);body.add(gun);
  box(.2,.2,.72,0,0,0,'#35463d',gun);box(.08,.08,.48,0,.02,.55,'#34473d',gun);box(.14,.25,.16,0,-.18,.05,'#546254',gun);
  const flash=box(.3,.3,.3,.27,1.16,1.27,material('#ffe9a3',{emissive:'#ffc13a',emissiveIntensity:3}),root,false);flash.visible=false;
  root.userData={body,legs,arms,flash};scene.add(root);return root;
}
const names=['TY','Kaktus','Pixel','Echo','Mango','Rudy','Cień','Kobalt','Iskra','Vox'];
let actors=[],player,viewGun,knifeMesh,muzzle;
const previewSoldiers=[];
for(const [x,y,z,t]of [[13,5.5,13,0],[19,5.5,13,0],[9,0,7,1],[-3,0,7,0]]){const m=soldier(t);m.position.set(x,y,z);m.rotation.y=.6;previewSoldiers.push(m);}

const gunRig=new THREE.Group();gunRig.scale.setScalar(.72);camera.add(gunRig);
function makeViewWeapon(){
  gunRig.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});gunRig.clear();const gun=new THREE.Group();gunRig.add(gun);viewGun=gun;
  const weapon=selectedWeapon;
  const bodyColor=weapon.id==='ak47'?'#737354':weapon.id==='scout'?'#6a8571':'#455b51';
  const compact=weapon.id==='viper';
  box(.17,.18,compact?.44:.62,0,0,-.16,bodyColor,gun,false);
  box(.13,.12,.45,0,-.005,.23,'#607367',gun,false);
  box(.09,.08,weapon.id==='scout'?.65:.37,0,.012,-.62,'#33483e',gun,false);
  box(.1,.12,.09,0,.06,-.42,'#293e34',gun,false);
  box(.13,.28,.15,0,-.2,-.2,'#384d41',gun,false).rotation.x=-.2;
  box(.1,.25,.12,0,-.19,.15,'#30483b',gun,false).rotation.x=-.28;
  box(.11,.075,.14,0,.12,.08,'#263b30',gun,false);box(.025,.1,.04,-.05,.18,.1,'#263b30',gun,false);box(.025,.1,.04,.05,.18,.1,'#263b30',gun,false);
  box(.028,.03,.025,0,.16,-.63,'#c5f576',gun,false);
  if(weapon.id==='scout'){box(.1,.14,.37,0,.2,-.15,'#2c4336',gun,false);box(.07,.07,.025,0,.22,.045,'#8fc59b',gun,false);}
  for(let i=0;i<5;i++)box(.18,.035,.025,0,.11,-.06-i*.065,'#314a3a',gun,false);
  // The block hands are intentionally visible in first person.
  box(.15,.18,.17,.015,-.15,.17,'#bd9972',gun,false);
  box(.18,.24,.2,.025,-.28,.24,'#4b8274',gun,false).rotation.x=-.4;
  box(.16,.16,.25,-.06,-.12,-.39,'#c3a078',gun,false);
  const sleeve=box(.18,.25,.45,-.19,-.25,-.2,'#5b9a86',gun,false);sleeve.rotation.z=-.55;sleeve.rotation.y=-.3;
  muzzle=box(.14,.14,.22,0,.02,-.86,material('#ffdc72',{emissive:'#ffb322',emissiveIntensity:5}),gun,false);muzzle.visible=false;
  knifeMesh=new THREE.Group();gunRig.add(knifeMesh);knifeMesh.visible=false;
  box(.09,.06,.48,0,.035,-.27,'#cbd4bb',knifeMesh,false);box(.05,.04,.16,0,.035,-.56,'#dde5d1',knifeMesh,false).rotation.y=.12;
  box(.2,.04,.06,0,0,-.02,'#63735b',knifeMesh,false);box(.1,.1,.25,0,-.02,.12,'#344b3c',knifeMesh,false);
  box(.16,.18,.18,.02,-.05,.17,'#c3a078',knifeMesh,false);box(.18,.25,.28,.04,-.19,.28,'#5a9784',knifeMesh,false);
  gunRig.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.depthTest=false;o.material.depthWrite=false;o.renderOrder=100;}});
  gunRig.position.set(.32,-.28,-.55);gunRig.visible=false;
}

let state='menu',scores=[0,0],round=1,roundElapsed=0,wallet=10,selectedWeapon=WEAPONS[0],owned=new Set(['k24']);
let equipped=1,ammo=24,reserve=72,reloading=0,nextShot=0,yaw=Math.PI/2,pitch=0,verticalSpeed=0,eyeHeight=1.72;
let mouseDown=false,aiming=false,windowedMouse=false,keySet=new Set(),interactionTarget=null,interactProgress=0,walkTime=0,recoil=0,flashTime=0,hitTime=0,damageTime=0;
let audioEnabled=true,audioContext=null,sensitivity=.0021,toastTimer,transitionTime=0,feed=[],lastHud='',lastScoreboard='',lastTime=0,spectateTarget=null;
let particles=[],tracers=[],deathBursts=[],frame=0,menuTime=0,scoreboardOpen=false;
const deathCubeGeometry=new THREE.BoxGeometry(1,1,1);
const deathCubeMaterial=material('#ffffff');
const deathCubeTransform=new THREE.Object3D();
const raycaster=new THREE.Raycaster();const direction=new THREE.Vector3(),origin=new THREE.Vector3(),temp=new THREE.Vector3();
makeViewWeapon();
const touchControls=createTouchControls({
  joystick:$('touch-joystick'),knob:$('joystick-knob'),lookZone:$('touch-look'),
  buttons:{fire:$('touch-fire'),aim:$('touch-aim'),jump:$('touch-jump'),interact:$('touch-interact')},
  canControl:()=>touchMode&&state==='playing'&&player?.alive&&!scoreboardOpen,
  onLook:(dx,dy)=>{yaw-=dx*sensitivity*1.7;pitch=clamp(pitch-dy*sensitivity*1.7,-1.25,1.25);},
  onFire:()=>shoot()
});
const touchInput=touchControls.state;
function setTouchMode(enabled,remember=false){
  touchMode=enabled;touchControls.reset();mouseDown=false;aiming=false;
  document.body.classList.toggle('touch-mode',enabled);
  $('controls-touch').setAttribute('aria-pressed',String(enabled));$('controls-mouse').setAttribute('aria-pressed',String(!enabled));
  $('sensitivity-label').textContent=enabled?'Czułość dotyku':'Czułość myszy';
  $('interaction-key').textContent=enabled?'▣':'E';
  $('scoreboard-help').textContent=enabled?'Dotknij ×, aby wrócić do gry.':'Przytrzymaj TAB, aby zobaczyć wyniki.';
  if(remember){controlPreference=enabled?'touch':'mouse';try{localStorage.setItem('dzikikarabin-controls',controlPreference);}catch{}}
}
setTouchMode(touchMode);

function saveWallet(){try{localStorage.setItem('blockops-wallet',String(wallet));}catch{}}
try{const v=Number(localStorage.getItem('blockops-wallet'));if(Number.isFinite(v)&&localStorage.getItem('blockops-wallet')!==null)wallet=clamp(Math.floor(v),0,99999);}catch{}
function toast(text){$('toast').textContent=text;$('toast').classList.add('toast-visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('toast-visible'),2300);}
function initAudio(){if(!audioContext)try{audioContext=new (window.AudioContext||window.webkitAudioContext)();}catch{}if(audioContext?.state==='suspended')audioContext.resume();}
function sound(kind){
  if(!audioEnabled||!audioContext)return;const t=audioContext.currentTime;
  const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.connect(gain);gain.connect(audioContext.destination);
  if(kind==='shot'){osc.type='sawtooth';osc.frequency.setValueAtTime(140,t);osc.frequency.exponentialRampToValueAtTime(40,t+.095);gain.gain.setValueAtTime(.1,t);gain.gain.exponentialRampToValueAtTime(.001,t+.1);osc.start(t);osc.stop(t+.11);}
  else if(kind==='hit'){osc.type='triangle';osc.frequency.setValueAtTime(850,t);osc.frequency.exponentialRampToValueAtTime(400,t+.07);gain.gain.setValueAtTime(.045,t);gain.gain.exponentialRampToValueAtTime(.001,t+.08);osc.start(t);osc.stop(t+.09);}
  else if(kind==='knife'){osc.type='sawtooth';osc.frequency.setValueAtTime(260,t);osc.frequency.exponentialRampToValueAtTime(60,t+.13);gain.gain.setValueAtTime(.055,t);gain.gain.exponentialRampToValueAtTime(.001,t+.14);osc.start(t);osc.stop(t+.15);}
  else{osc.type='sine';const freq=kind==='empty'?140:kind==='reload'?370:kind==='coin'?950:kind==='hurt'?100:640;osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(freq*1.45,t+.12);gain.gain.setValueAtTime(.055,t);gain.gain.exponentialRampToValueAtTime(.001,t+.17);osc.start(t);osc.stop(t+.18);}
}

function createActors(){
  for(const a of actors)if(a.mesh){scene.remove(a.mesh);a.mesh.traverse(o=>{if(o.isMesh)o.geometry.dispose();});}actors=[];
  for(let i=0;i<10;i++){
    const team=i<5?0:1;
    const actor={id:i,name:names[i],team,isPlayer:i===0,x:0,z:0,health:100,alive:true,kills:0,deaths:0,mesh:i===0?null:soldier(team),path:[],pathTimer:0,fireTimer:rand(.3,1.5),reload:0,ammo:24,reserve:72,reaction:rand(.2,.6),targetId:-1,wave:rand(0,10),walk:0};
    actors.push(actor);
  }
  player=actors[0];
}
function spawnRound(){
  clearDeathBursts();
  touchControls.reset();document.body.classList.remove('spectating');scoreboardOpen=false;
  $('touch-scores').setAttribute('aria-pressed','false');$('touch-interact').disabled=true;
  for(let i=0;i<actors.length;i++){
    const a=actors[i],index=i%5;
    a.x=a.team===0?-27.5:27.5;a.z=(index-2)*3.6;
    a.health=100;a.alive=true;a.path=[];a.pathTimer=.3+index*.12;a.fireTimer=rand(.7,1.4);a.reload=0;a.ammo=24;a.reserve=72;a.targetId=-1;
    if(a.mesh){a.mesh.visible=true;a.mesh.scale.setScalar(1);a.mesh.position.set(a.x,0,a.z);a.mesh.rotation.set(0,a.team===0?Math.PI/2:-Math.PI/2,0);a.mesh.userData.body.rotation.set(0,0,0);}
  }
  for(const c of chests){c.opened=false;c.lid.rotation.x=0;c.glow.visible=true;}
  eyeHeight=1.72;verticalSpeed=0;yaw=-Math.PI/2;pitch=0;equipped=1;ammo=selectedWeapon.mag;reserve=selectedWeapon.reserve;reloading=0;nextShot=0;recoil=0;mouseDown=false;
  roundElapsed=0;interactProgress=0;transitionTime=0;spectateTarget=null;feed=[];$('killfeed').innerHTML='';
  makeViewWeapon();gunRig.visible=true;viewGun.visible=true;knifeMesh.visible=false;
  show('spectate',false);show('interaction',false);show('round-banner',false);lastHud='';updateHud();
}
function startMatch(){
  initAudio();scores=[0,0];round=1;selectedWeapon=WEAPONS[0];owned=new Set(['k24']);createActors();previewSoldiers.forEach(m=>m.visible=false);show('menu',false);show('results',false);show('topbar',false);openShop(true);
}
function openShop(first=false){
  state='shop';document.body.classList.remove('playing');releasePointer();gunRig.visible=false;show('hud',false);show('scoreboard',false);show('shop');
  $('shop-eyebrow').textContent=`PRZYGOTOWANIE DO RUNDY ${String(round).padStart(2,'0')}`;
  $('shop-title').innerHTML=first?'DOBRY PLAN.<br><span>LEPSZY EKWIPUNEK.</span>':`WYNIK ${scores[0]} : ${scores[1]}<br><span>KOLEJNA RUNDA. NOWY PLAN.</span>`;
  $('shop-intro').textContent=first?'Karabinek i nóż już czekają. Wybierz broń na nadchodzącą rundę.':'Twoja drużyna wraca w pełnym składzie. Uzupełnij ekwipunek i ruszaj dalej.';
  renderShop();
}
function weaponSvg(id){
  const long=id==='scout',wood=id==='ak47',compact=id==='viper';
  return `<svg viewBox="0 0 200 86" aria-hidden="true"><g fill="currentColor"><path d="M17 38h${compact?28:36}v15H18l-9 6V36z" opacity=".5"/><path d="M45 30h${compact?68:90}v25H45z"/><path d="M${compact?110:130} 34h${long?51:35}v7h15v6h-15v-4h-${long?51:35}z"/><path d="M72 53h15l-6 23H68z" opacity=".7"/><path d="M99 51h18l7 24h-18z" opacity=".7"/><path d="M56 25h48v5H56zM64 20h7v9h-7zM125 23h7v10h-7z"/>${long?'<path d="M74 14h42v9H74zM80 12h6v13h-6zM106 12h6v13h-6z"/>':''}${wood?'<path d="M25 39h24v11H25zM118 31h20v18h-20z" fill="#c29260"/>':''}</g></svg>`;
}
function renderShop(){
  $('shop-coins').textContent=wallet;
  $('weapons').innerHTML=WEAPONS.map((w,i)=>{const isOwned=owned.has(w.id),active=w.id===selectedWeapon.id;return `<article class="weapon-card ${active?'selected':''}"><span class="weapon-number">0${i+1} /</span><span class="weapon-badge">${active?'WYPOSAŻONO':isOwned?'W EKWIPUNKU':`${w.price} ◈`}</span>${weaponSvg(w.id)}<h3>${w.name}</h3><p>${w.type}</p><div class="weapon-stats"><span>MOC <b>${w.damage}</b></span><span>MAG. <b>${w.mag}</b></span><span>${w.auto?'AUTO':'SEMI'}</span></div><button data-weapon="${w.id}" class="buy-button" ${active||!isOwned&&wallet<w.price?'disabled':''}>${active?'✓ WYBRANA':isOwned?'WYPOSAŻ':wallet<w.price?`BRAKUJE ${w.price-wallet} ◈`:`KUP ZA ${w.price} ◈`}</button></article>`;}).join('');
}
$('weapons').addEventListener('click',e=>{const button=e.target.closest('[data-weapon]');if(!button)return;const result=purchaseWeapon(button.dataset.weapon,wallet,owned);if(result.ok){wallet=result.wallet;selectedWeapon=result.weapon;saveWallet();sound('coin');renderShop();}});
function startRound(){
  spawnRound();show('shop',false);show('hud');state='playing';document.body.classList.add('playing');requestPointer();
  banner(`RUNDA ${String(round).padStart(2,'0')}`, 'WYELIMINUJ ODDZIAŁ EMBER');setTimeout(()=>{if(state==='playing'||state==='paused')show('round-banner',false);},2100);
  if(touchMode)toast('Lewy joystick: ruch. Prawa strona: celowanie.');
}
function banner(text,sub){$('round-banner').innerHTML=`${text}<small>${sub}</small>`;show('round-banner');}
function releasePointer(){if(document.pointerLockElement)document.exitPointerLock();keySet.clear();touchControls.reset();mouseDown=false;aiming=false;}
async function requestPointer(){if(touchMode)return;try{await renderer.domElement.requestPointerLock();windowedMouse=false;}catch{if(state==='playing'){windowedMouse=true;document.body.classList.add('windowed-mouse');toast('Przytrzymaj prawy przycisk myszy, aby się rozglądać.');}}}
function pauseGame(){if(state!=='playing')return;state='paused';document.body.classList.remove('playing');releasePointer();show('pause');show('scoreboard',false);scoreboardOpen=false;$('touch-scores').setAttribute('aria-pressed','false');}
function resumeGame(){initAudio();show('pause',false);state='playing';document.body.classList.add('playing');requestPointer();}
function returnMenu(){state='menu';clearDeathBursts();releasePointer();document.body.classList.remove('playing');['hud','shop','pause','results','scoreboard','interaction'].forEach(id=>show(id,false));show('menu');show('topbar');gunRig.visible=false;for(const a of actors)if(a.mesh)a.mesh.visible=false;previewSoldiers.forEach(m=>m.visible=true);camera.fov=60;camera.updateProjectionMatrix();}
function finishRound(team){
  if(state!=='playing')return;scores[team]++;state='roundEnd';transitionTime=3.6;mouseDown=false;keySet.clear();gunRig.visible=false;
  banner(team===0?'RUNDA DLA MINT':'RUNDA DLA EMBER',`${scores[0]} : ${scores[1]} · ${scores[team]===3?'KONIEC MECZU':'ZA CHWILĘ WRACAMY DO SKLEPU'}`);sound(team===0?'coin':'hurt');updateHud();
  touchControls.reset();
}
function showResults(){
  state='results';releasePointer();document.body.classList.remove('playing');show('hud',false);show('results');const win=scores[0]===3;
  $('results').querySelector('.result-card').classList.toggle('loss',!win);$('result-title').textContent=win?'ZWYCIĘSTWO!':'NASTĘPNYM RAZEM.';
  $('result-copy').textContent=win?'Oddział Mint przejmuje posterunek. Dobra robota.':'Oddział Ember przejmuje posterunek. Czas na rewanż.';
  $('result-score').innerHTML=`${scores[0]} <span>:</span> ${scores[1]}`;
  $('result-kills').textContent=player.kills;$('result-deaths').textContent=player.deaths;$('result-coins').textContent=wallet;saveWallet();
}

function updateHud(){
  if(!player)return;
  const live=[actors.filter(a=>a.team===0&&a.alive).length,actors.filter(a=>a.team===1&&a.alive).length];
  const signature=[player.health,ammo,reserve,equipped,wallet,reloading>0,...scores,...live].join(',');
  if(lastHud!==signature){
    lastHud=signature;$('health').textContent=Math.ceil(player.health);$('health-fill').style.width=`${player.health}%`;$('health-fill').style.background=player.health<30?'#e89f71':'#c5f576';
    $('ammo').textContent=equipped===2?'∞':reloading>0?'··':ammo;$('ammo').style.color=ammo===0&&equipped===1?'#e89f71':'';$('reserve').textContent=equipped===2?'—':reserve;
    $('weapon-name').textContent=equipped===2?KNIFE.name:reloading>0?'PRZEŁADOWANIE…':selectedWeapon.name;
    $('hud-coins').textContent=wallet;$('score-blue').textContent=scores[0];$('score-red').textContent=scores[1];
    $('allies-alive').innerHTML=Array.from({length:5},(_,i)=>`<i class="${i<live[0]?'':'dead'}"></i>`).join('');
    $('enemies-alive').innerHTML=Array.from({length:5},(_,i)=>`<i class="${i<live[1]?'':'dead'}"></i>`).join('');
    $('slot-1').classList.toggle('active',equipped===1);$('slot-2').classList.toggle('active',equipped===2);
    $('touch-weapon-label').textContent=equipped===1?'NÓŻ':'KARABIN';$('touch-weapon').setAttribute('aria-label',equipped===1?'Zmień broń na nóż':'Zmień broń na karabin');
    $('touch-fire').querySelector('small').textContent=equipped===2?'CIOS':'STRZAŁ';
    $('touch-reload').disabled=!player.alive||equipped===2||reloading>0||reserve===0||ammo===selectedWeapon.mag;
  }
  $('round-label').textContent=`RUNDA ${String(round).padStart(2,'0')}`;
  const mins=Math.floor(roundElapsed/60),seconds=Math.floor(roundElapsed)%60;$('round-time').textContent=`${String(mins).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}
function drawScoreboard(){
  const signature=actors.map(a=>`${a.kills},${a.deaths},${a.alive},${Math.ceil(a.health)}`).join(';');if(signature===lastScoreboard)return;lastScoreboard=signature;
  $('scoreboard-body').innerHTML=[0,1].map(team=>`<h3 class="${team===0?'cyan':'orange'}">ODDZIAŁ ${team===0?'MINT':'EMBER'} · ${actors.filter(a=>a.team===team&&a.alive).length} / 5</h3><div class="scoreboard-row header"><span>GRACZ</span><span>ZABÓJSTWA</span><span>ŚMIERCI</span><span>ZDROWIE</span></div>${actors.filter(a=>a.team===team).sort((a,b)=>b.kills-a.kills).map(a=>`<div class="scoreboard-row ${a.isPlayer?'you':''} ${a.alive?'':'eliminated'}"><span>${a.name} ${a.isPlayer?'[ TY ]':'· BOT'}</span><span>${a.kills}</span><span>${a.deaths}</span><span>${a.alive?Math.ceil(a.health):'—'}</span></div>`).join('')}`).join('');
}
function addFeed(killer,victim,weapon){feed.unshift({text:`${killer?.name??'Arena'} <span>${weapon==='knife'?'╱':'⌁'}</span> ${victim.name}`,player:killer?.isPlayer,life:6});feed=feed.slice(0,5);renderFeed();}
function renderFeed(){$('killfeed').innerHTML=feed.map(f=>`<div class="kill-line ${f.player?'player-kill':''}">${f.text}</div>`).join('');}

function damageActor(victim,amount,killer,weapon='k24'){
  if(!victim.alive||state!=='playing')return;
  victim.health=Math.max(0,victim.health-amount);
  if(victim.isPlayer){damageTime=.35;sound('hurt');}
  if(victim.health===0){
    const result=settleDeath(victim,killer,wallet);if(!result.changed)return;wallet=result.wallet;saveWallet();addFeed(killer,victim,weapon);
    shatterActor(victim,killer);
    if(killer?.isPlayer){toast(`+5 MONET · ${victim.name} wyeliminowany`);sound('coin');}
    if(victim.isPlayer){gunRig.visible=false;show('interaction',false);toast('−1 MONETA · Wrócisz w następnej rundzie');spectateTarget=null;mouseDown=false;touchControls.reset();document.body.classList.add('spectating');}
    const winner=winningTeam(actors);if(winner!==null)finishRound(winner);
  }
}
function clearDeathBursts(){
  for(const burst of deathBursts){scene.remove(burst.mesh);burst.mesh.dispose();}
  deathBursts=[];
}
function setDeathCube(burst,cube,index,scale=1){
  deathCubeTransform.position.copy(cube.position);
  deathCubeTransform.rotation.copy(cube.rotation);
  deathCubeTransform.scale.setScalar(cube.size*scale);
  deathCubeTransform.updateMatrix();burst.mesh.setMatrixAt(index,deathCubeTransform.matrix);
}
function shatterActor(victim,killer){
  // Sample the posed model, so the fragments inherit the real body colors and position.
  const model=victim.mesh??soldier(victim.team),cubes=[];
  model.position.set(victim.x,0,victim.z);
  if(victim.isPlayer)model.rotation.y=yaw+Math.PI;
  model.updateMatrixWorld(true);
  const push=new THREE.Vector3(victim.x-(killer?.x??victim.x),0,victim.z-(killer?.z??victim.z)).normalize().multiplyScalar(1.8);
  model.traverse(part=>{
    if(!part.isMesh||!part.visible||part===model.userData.flash)return;
    const {width:w,height:h,depth:d}=part.geometry.parameters;
    if(w*h*d<.004)return;
    const nx=Math.ceil(w/.28),ny=Math.ceil(h/.28),nz=Math.ceil(d/.28);
    for(let ix=0;ix<nx;ix++)for(let iy=0;iy<ny;iy++)for(let iz=0;iz<nz;iz++){
      const position=new THREE.Vector3((ix+.5)*w/nx-w/2,(iy+.5)*h/ny-h/2,(iz+.5)*d/nz-d/2).applyMatrix4(part.matrixWorld);
      const radial=new THREE.Vector3(position.x-victim.x,0,position.z-victim.z).normalize().multiplyScalar(rand(1.4,3.5));
      cubes.push({position,velocity:radial.add(push).add(new THREE.Vector3(rand(-.7,.7),rand(2.5,5.7),rand(-.7,.7))),rotation:new THREE.Euler(rand(0,.3),rand(0,.3),rand(0,.3)),spin:new THREE.Vector3(rand(-7,7),rand(-7,7),rand(-7,7)),size:Math.max(.09,Math.min(w/nx,h/ny,d/nz)*.91),color:part.material.color.clone()});
    }
  });
  model.visible=false;model.userData.flash.visible=false;
  if(!victim.mesh){scene.remove(model);model.traverse(part=>{if(part.isMesh)part.geometry.dispose();});}
  const mesh=new THREE.InstancedMesh(deathCubeGeometry,deathCubeMaterial,cubes.length);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=true;mesh.receiveShadow=true;
  // Cubes fly beyond their initial bounds; keep the burst visible throughout the animation.
  mesh.frustumCulled=false;
  const burst={mesh,cubes,age:0,duration:2.6};
  cubes.forEach((cube,i)=>{setDeathCube(burst,cube,i);mesh.setColorAt(i,cube.color);});
  mesh.instanceMatrix.needsUpdate=true;scene.add(mesh);deathBursts.push(burst);
}
function updateDeathBursts(dt){
  for(let i=deathBursts.length-1;i>=0;i--){
    const burst=deathBursts[i];burst.age+=dt;
    if(burst.age>=burst.duration){scene.remove(burst.mesh);burst.mesh.dispose();deathBursts.splice(i,1);continue;}
    const shrink=1-clamp((burst.age-1.75)/.85,0,1);
    burst.cubes.forEach((cube,index)=>{
      cube.velocity.y-=12*dt;
      moveBody(cube.position,cube.velocity.x*dt,cube.velocity.z*dt,cube.size/2);
      cube.position.y+=cube.velocity.y*dt;
      if(cube.position.y<cube.size/2+.035){
        cube.position.y=cube.size/2+.035;
        if(cube.velocity.y<-.6)cube.velocity.y*=-.28;else cube.velocity.y=0;
        cube.velocity.x*=Math.exp(-7*dt);cube.velocity.z*=Math.exp(-7*dt);cube.spin.multiplyScalar(Math.exp(-8*dt));
      }
      cube.rotation.x+=cube.spin.x*dt;cube.rotation.y+=cube.spin.y*dt;cube.rotation.z+=cube.spin.z*dt;
      setDeathCube(burst,cube,index,shrink);
    });
    burst.mesh.instanceMatrix.needsUpdate=true;
  }
}
function wallDistance(from,dir,max){raycaster.set(from,dir);raycaster.far=max;const hits=raycaster.intersectObjects(raycastWalls,false);return hits.length?hits[0].distance:max;}
function visibleBetween(a,b){origin.set(a.x,1.52,a.z);direction.set(b.x-a.x,0,b.z-a.z);const dist=direction.length();if(dist<.05)return true;direction.divideScalar(dist);return wallDistance(origin,direction,dist)>=dist-.2;}
function hitActor(from,dir,max,team){
  let closest=max,target=null,headshot=false;
  for(const a of actors){
    if(!a.alive||a.team===team)continue;
    const volumes=[{min:new THREE.Vector3(a.x-.37,.07,a.z-.33),max:new THREE.Vector3(a.x+.37,1.39,a.z+.33),head:false},{min:new THREE.Vector3(a.x-.34,1.39,a.z-.34),max:new THREE.Vector3(a.x+.34,2.05,a.z+.34),head:true}];
    for(const v of volumes){const point=raycaster.ray.intersectBox(new THREE.Box3(v.min,v.max),temp);if(point){const dist=point.distanceTo(from);if(dist<closest){closest=dist;target=a;headshot=v.head;}}}
  }
  return {target,distance:closest,headshot};
}
function tracer(from,to,team=0){
  const geo=new THREE.BufferGeometry().setFromPoints([from.clone(),to.clone()]);const m=new THREE.Line(geo,new THREE.LineBasicMaterial({color:team===0?'#f2e8a0':'#ffc08a',transparent:true,opacity:.65}));scene.add(m);tracers.push({mesh:m,life:.065});
}
function sparks(point,color='#d8c48f',count=5){
  for(let i=0;i<count;i++){const m=box(.055,.055,.055,point.x,point.y,point.z,color,scene,false);particles.push({mesh:m,velocity:new THREE.Vector3(rand(-2,2),rand(.4,2.8),rand(-2,2)),life:rand(.15,.35)});}
}
function shoot(){
  if(state!=='playing'||!player.alive||nextShot>0||reloading>0)return;
  const weapon=equipped===2?KNIFE:selectedWeapon;
  if(equipped===1&&ammo===0){nextShot=.3;sound('empty');if(reserve>0)reload();else toast('Brak amunicji. Otwórz skrzynkę [E] lub wybierz nóż [2].');return;}
  nextShot=weapon.interval;recoil=equipped===2?.85:.14;flashTime=.055;
  camera.getWorldDirection(direction);direction.normalize();origin.copy(camera.position);
  if(equipped===1){
    ammo--;sound('shot');pitch=clamp(pitch+.008,-1.25,1.25);
    const spread=selectedWeapon.spread*(aiming?.25:1)*(keySet.has('ShiftLeft')?1.9:1);
    direction.x+=rand(-spread,spread);direction.y+=rand(-spread,spread);direction.z+=rand(-spread,spread);direction.normalize();
  }else sound('knife');
  const max=wallDistance(origin,direction,weapon.range);const hit=hitActor(origin,direction,max,player.team);
  const end=origin.clone().addScaledVector(direction,hit.distance);
  if(equipped===1){const from=new THREE.Vector3(0,.02,-.8);viewGun.localToWorld(from);tracer(from,end);}
  if(hit.target){
    damageActor(hit.target,weapon.damage*(hit.headshot&&equipped===1?1.65:1),player,weapon.id);hitTime=.15;$('hitmarker').style.color=hit.headshot?'#e89f71':'#e9ffb9';sparks(end,'#d6e2a0',8);sound('hit');
  }else if(hit.distance<weapon.range)sparks(end);
  if(equipped===1&&!selectedWeapon.auto)mouseDown=false;lastHud='';
}
function reload(){if(state!=='playing'||!player.alive||equipped!==1||reloading>0||ammo===selectedWeapon.mag||reserve===0)return;reloading=selectedWeapon.reload;sound('reload');lastHud='';}
function equip(slot){if(!player?.alive)return;equipped=slot;reloading=0;viewGun.visible=slot===1;knifeMesh.visible=slot===2;nextShot=.2;lastHud='';}

function updatePlayer(dt){
  if(!player.alive){
    if(!spectateTarget?.alive)spectateTarget=actors.find(a=>a.team===0&&a.alive);
    if(spectateTarget){
      show('spectate');$('spectate-name').textContent=spectateTarget.name;
      const m=spectateTarget.mesh;camera.position.set(spectateTarget.x-Math.sin(m.rotation.y)*3.8,3,spectateTarget.z-Math.cos(m.rotation.y)*3.8);camera.lookAt(spectateTarget.x,1.5,spectateTarget.z);
    }
    return;
  }
  if(touchMode)aiming=touchInput.aim;
  const forward=(keySet.has('KeyW')?1:0)-(keySet.has('KeyS')?1:0)-touchInput.y,side=(keySet.has('KeyD')?1:0)-(keySet.has('KeyA')?1:0)+touchInput.x;
  let moving=forward!==0||side!==0;
  const sprint=(keySet.has('ShiftLeft')||Math.hypot(touchInput.x,touchInput.y)>.92)&&moving&&!aiming&&equipped===1;
  const speed=equipped===2?6.8:sprint?7.5:aiming?3:5.2;
  const length=Math.max(1,Math.hypot(forward,side));
  const dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*side)/length*speed*dt;
  const dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*side)/length*speed*dt;
  moveBody(player,dx,dz,.37);
  if((keySet.has('Space')||touchInput.jump)&&eyeHeight<=1.721)verticalSpeed=5.1;
  verticalSpeed-=15*dt;eyeHeight=Math.max(1.72,eyeHeight+verticalSpeed*dt);if(eyeHeight===1.72)verticalSpeed=0;
  walkTime+=dt*(moving?(sprint?13:9):2);
  const bob=moving?Math.sin(walkTime)*.035:Math.sin(walkTime)*.007;
  camera.position.set(player.x,eyeHeight+bob,player.z);camera.rotation.set(pitch,yaw,0);
  const portrait=touchMode&&camera.aspect<.9;gunRig.scale.setScalar(portrait?.5:.72);
  gunRig.position.set((aiming?.08:portrait?.18:.32)+(moving?Math.cos(walkTime*.5)*.015:0),-.28+Math.abs(bob)*.6,-.55+recoil*.1);
  gunRig.rotation.set(recoil*.45,recoil*.13,equipped===2?-recoil*.8:recoil*.08);
  if(reloading>0){const progress=1-reloading/selectedWeapon.reload;gunRig.position.y-=Math.sin(progress*Math.PI)*.23;gunRig.rotation.x-=Math.sin(progress*Math.PI)*.5;}
  const targetFov=aiming&&equipped===1?(selectedWeapon.id==='scout'?43:59):sprint?portrait?90:82:portrait?84:76;
  if(Math.abs(camera.fov-targetFov)>.05){camera.fov=THREE.MathUtils.lerp(camera.fov,targetFov,dt*10);camera.updateProjectionMatrix();}
  if(mouseDown||touchInput.fire&&(equipped===2||selectedWeapon.auto))shoot();
  updateInteraction(dt);
}
function updateInteraction(dt){
  let closest=null,dist=2.7;
  for(const c of chests){if(c.opened)continue;const d=Math.hypot(c.x-player.x,c.z-player.z);if(d<dist){dist=d;closest=c;}}
  if(closest!==interactionTarget){interactProgress=0;interactionTarget=closest;}
  show('interaction',!!closest);
  $('touch-interact').disabled=!closest;
  if(!closest)return;
  if(keySet.has('KeyE')||touchInput.interact){interactProgress+=dt;if(interactProgress>=.85){closest.opened=true;closest.glow.visible=false;reserve+=selectedWeapon.mag*2;player.health=Math.min(100,player.health+30);interactProgress=0;interactionTarget=null;touchInput.interact=false;$('touch-interact').disabled=true;sound('coin');toast(`Skrzynka: +${selectedWeapon.mag*2} amunicji · +30 zdrowia`);show('interaction',false);lastHud='';}}
  else interactProgress=Math.max(0,interactProgress-dt*2);
  $('interaction-progress').style.width=`${Math.min(100,interactProgress/.85*100)}%`;
}

function updateBots(dt){
  for(const a of actors){
    if(a.isPlayer||!a.alive)continue;
    const m=a.mesh;const data=m.userData;data.flash.visible=false;a.fireTimer-=dt;a.pathTimer-=dt;a.wave+=dt;
    if(a.reload>0){a.reload-=dt;if(a.reload<=0){const result=reloadAmmo(a.ammo,a.reserve,24);a.ammo=result.ammo;a.reserve=result.reserve;} }
    const enemies=actors.filter(b=>b.team!==a.team&&b.alive);if(!enemies.length)continue;
    let target=enemies.reduce((best,b)=>Math.hypot(a.x-b.x,a.z-b.z)<Math.hypot(a.x-best.x,a.z-best.z)?b:best,enemies[0]);
    let dist=Math.hypot(a.x-target.x,a.z-target.z),visible=visibleBetween(a,target);
    // An enemy in another lane takes priority over a nearer enemy behind a building.
    if(!visible)for(const e of enemies){const d=Math.hypot(a.x-e.x,a.z-e.z);if(d<32&&visibleBetween(a,e)){target=e;dist=d;visible=true;break;}}
    const melee=a.ammo===0&&a.reserve===0;
    if(a.targetId!==target.id){a.targetId=target.id;a.fireTimer=Math.max(a.fireTimer,a.reaction);a.pathTimer=0;}
    const desired=Math.atan2(target.x-a.x,target.z-a.z);
    let diff=desired-m.rotation.y;diff=Math.atan2(Math.sin(diff),Math.cos(diff));m.rotation.y+=diff*Math.min(1,dt*9);
    let moving=false;
    if(visible && dist<(melee?2.35:25)){
      if(dist>(melee?1.7:14)||dist<4&&!melee){
        const approach=dist<4?-1:1,dx=(target.x-a.x)/(dist||1),dz=(target.z-a.z)/(dist||1);
        const strafe=Math.sin(a.wave*1.4+a.id)*.65;
        moveBody(a,(dx*approach-dz*strafe)*2.7*dt,(dz*approach+dx*strafe)*2.7*dt,.43);moving=true;
      }else{
        const strafe=Math.sin(a.wave*1.5+a.id);moveBody(a,Math.cos(desired)*strafe*1.2*dt,-Math.sin(desired)*strafe*1.2*dt,.43);moving=Math.abs(strafe)>.2;
      }
    }else{
      if(a.pathTimer<=0){a.path=findPath(a.x,a.z,target.x,target.z);a.pathTimer=rand(.65,1.25);}
      const next=a.path[0];if(next){const pd=Math.hypot(next.x-a.x,next.z-a.z);if(pd<.3)a.path.shift();else{moveBody(a,(next.x-a.x)/pd*3.6*dt,(next.z-a.z)/pd*3.6*dt,.43);moving=true;if(!visible){const walkAngle=Math.atan2(next.x-a.x,next.z-a.z);m.rotation.y=walkAngle;}}}
    }
    // Gentle separation avoids a stack of bots in narrow lanes.
    for(const b of actors){if(b===a||!b.alive)continue;const d=Math.hypot(a.x-b.x,a.z-b.z);if(d>.01&&d<.85)moveBody(a,(a.x-b.x)/d*dt*1.8,(a.z-b.z)/d*dt*1.8,.43);}
    if(visible && Math.abs(diff)<.3 && dist<(melee?2.65:42) && a.fireTimer<=0 && a.reload<=0){
      if(melee){damageActor(target,35,a,'knife');a.fireTimer=.7;}
      else if(a.ammo>0){
        a.ammo--;a.fireTimer=rand(.22,.42);data.flash.visible=true;
        const from=new THREE.Vector3(a.x,1.3,a.z);const to=new THREE.Vector3(target.x,1.2,target.z);tracer(from,to,a.team);
        const chance=clamp(.86-dist*.014,.27,.85);
        if(Math.random()<chance){const botDamage=target.isPlayer?rand(6,10):rand(12,19);damageActor(target,botDamage,a);}
        if(a.ammo===0&&a.reserve>0)a.reload=2;
      }
    }
    m.position.set(a.x,0,a.z);a.walk+=moving?dt*9:dt*2;
    data.legs[0].rotation.x=moving?Math.sin(a.walk)*.55:0;data.legs[1].rotation.x=moving?-Math.sin(a.walk)*.55:0;
    data.body.position.y=moving?Math.abs(Math.sin(a.walk))*.025:0;
    if(state!=='playing')break;
  }
}

const minimap=$('minimap'),mapCtx=minimap.getContext('2d');
function drawMinimap(){
  const ctx=mapCtx,w=180,h=150,s=2.65;ctx.clearRect(0,0,w,h);ctx.fillStyle='#152c25';ctx.fillRect(0,0,w,h);
  ctx.save();ctx.translate(w/2,h/2);ctx.fillStyle='#50654e';
  for(const o of OBSTACLES)ctx.fillRect((o.x-o.w/2)*s,(o.z-o.d/2)*s,o.w*s,o.d*s);
  for(const c of chests)if(!c.opened){ctx.fillStyle='#c9b975';ctx.fillRect(c.x*s-2,c.z*s-2,4,4);}
  for(const a of actors){if(!a.alive)continue;if(a.team===1&&!actors.some(b=>b.alive&&b.team===0&&Math.hypot(a.x-b.x,a.z-b.z)<14&&visibleBetween(b,a)))continue;
    ctx.fillStyle=a.isPlayer?'#d9ff9d':a.team===0?'#72cbb2':'#e8a276';ctx.beginPath();ctx.arc(a.x*s,a.z*s,a.isPlayer?3.5:2.5,0,Math.PI*2);ctx.fill();
    if(a.isPlayer){ctx.strokeStyle='#d9ff9d';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(a.x*s,a.z*s);ctx.lineTo(a.x*s-Math.sin(yaw)*9,a.z*s-Math.cos(yaw)*9);ctx.stroke();}
  }ctx.restore();
}
function updateEffects(dt){
  updateDeathBursts(dt);
  recoil=Math.max(0,recoil-dt*(equipped===2?2.4:1.5));flashTime=Math.max(0,flashTime-dt);hitTime=Math.max(0,hitTime-dt);damageTime=Math.max(0,damageTime-dt);
  if(muzzle)muzzle.visible=flashTime>0&&equipped===1&&state==='playing';$('hitmarker').style.opacity=hitTime>0?'1':'0';$('damage').style.opacity=String(damageTime*.95);
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.velocity.y-=8*dt;p.mesh.position.addScaledVector(p.velocity,dt);if(p.life<=0){scene.remove(p.mesh);p.mesh.geometry.dispose();particles.splice(i,1);}}
  for(let i=tracers.length-1;i>=0;i--){const t=tracers[i];t.life-=dt;if(t.life<=0){scene.remove(t.mesh);t.mesh.geometry.dispose();t.mesh.material.dispose();tracers.splice(i,1);}}
  for(const c of chests)c.lid.rotation.x=THREE.MathUtils.lerp(c.lid.rotation.x,c.opened?-1.7:0,Math.min(1,dt*7));
}

function animate(){
  requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);frame++;
  if(state==='menu'){
    menuTime+=dt;const angle=.62+Math.sin(menuTime*.045)*.05;camera.position.set(Math.cos(angle)*43,23,Math.sin(angle)*43);camera.lookAt(2,1,0);camera.fov=58;camera.updateProjectionMatrix();
  }else if(state==='playing'){
    roundElapsed+=dt;nextShot=Math.max(0,nextShot-dt);
    if(reloading>0){reloading-=dt;if(reloading<=0){const result=reloadAmmo(ammo,reserve,selectedWeapon.mag);ammo=result.ammo;reserve=result.reserve;sound('reload');lastHud='';}}
    updatePlayer(dt);if(state==='playing')updateBots(dt);
    updateEffects(dt);updateHud();if(frame%6===0)drawMinimap();
    if(scoreboardOpen)drawScoreboard();
    let changed=false;feed.forEach(f=>f.life-=dt);const n=feed.length;feed=feed.filter(f=>f.life>0);if(feed.length!==n)renderFeed();
  }else if(state==='roundEnd'){
    transitionTime-=dt;updateEffects(dt);
    if(transitionTime<=0){if(scores.some(s=>s===3))showResults();else{round++;openShop();}}
  }
  renderer.render(scene,camera);
}

$('start-btn').addEventListener('click',startMatch);$('ready-btn').addEventListener('click',startRound);
$('resume-btn').addEventListener('click',resumeGame);$('quit-btn').addEventListener('click',returnMenu);
$('rematch-btn').addEventListener('click',startMatch);$('menu-btn').addEventListener('click',returnMenu);
$('controls-mouse').addEventListener('click',()=>setTouchMode(false,true));$('controls-touch').addEventListener('click',()=>setTouchMode(true,true));
$('touch-pause').addEventListener('click',pauseGame);
$('touch-reload').addEventListener('click',reload);
$('touch-weapon').addEventListener('click',()=>{if(state==='playing'&&player.alive)equip(equipped===1?2:1);});
function toggleTouchScores(force){
  if(state!=='playing'&&state!=='roundEnd')return;
  scoreboardOpen=force??!scoreboardOpen;touchControls.reset();mouseDown=false;aiming=false;
  show('scoreboard',scoreboardOpen);$('touch-scores').setAttribute('aria-pressed',String(scoreboardOpen));if(scoreboardOpen)drawScoreboard();
}
$('touch-scores').addEventListener('click',()=>toggleTouchScores());$('close-scores').addEventListener('click',()=>toggleTouchScores(false));
document.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&!touchMode&&controlPreference!=='mouse')setTouchMode(true);},{capture:true,passive:true});
$('sound-btn').addEventListener('click',()=>{audioEnabled=!audioEnabled;initAudio();$('sound-btn').textContent=audioEnabled?'♪':'♪̸';$('sound-btn').setAttribute('aria-label',audioEnabled?'Wyłącz dźwięk':'Włącz dźwięk');toast(audioEnabled?'Dźwięk włączony':'Dźwięk wyłączony');});
$('fullscreen-btn').addEventListener('click',()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch(()=>toast('Pełny ekran jest niedostępny w tym podglądzie.'));else document.exitFullscreen?.();});
$('sensitivity').addEventListener('input',e=>{sensitivity=Number(e.target.value)*.00006;$('sensitivity-value').textContent=e.target.value;});
document.addEventListener('keydown',e=>{
  if(['Space','Tab','KeyW','KeyA','KeyS','KeyD'].includes(e.code)&&state!=='menu')e.preventDefault();
  if(e.code==='Tab'&&(state==='playing'||state==='roundEnd')){scoreboardOpen=true;show('scoreboard');drawScoreboard();return;}
  if(e.code==='Escape'){if(state==='playing')pauseGame();return;}
  if(state!=='playing')return;keySet.add(e.code);
  if(e.code==='Digit1')equip(1);if(e.code==='Digit2')equip(2);if(e.code==='KeyR')reload();
});
document.addEventListener('keyup',e=>{keySet.delete(e.code);if(e.code==='Tab'){scoreboardOpen=false;show('scoreboard',false);}});
document.addEventListener('mousemove',e=>{if(touchMode||state!=='playing'||!player?.alive)return;if(document.pointerLockElement!==renderer.domElement&&(!windowedMouse||!aiming))return;yaw-=e.movementX*sensitivity;pitch=clamp(pitch-e.movementY*sensitivity,-1.25,1.25);});
document.addEventListener('mousedown',e=>{if(touchMode||state!=='playing'||document.pointerLockElement!==renderer.domElement&&(!windowedMouse||e.target!==renderer.domElement))return;if(e.button===0){mouseDown=true;shoot();}if(e.button===2)aiming=true;});
document.addEventListener('mouseup',e=>{if(e.button===0)mouseDown=false;if(e.button===2)aiming=false;});
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement===renderer.domElement){windowedMouse=false;document.body.classList.remove('windowed-mouse');}else if(state==='playing'&&!touchMode&&!windowedMouse)pauseGame();});
window.addEventListener('blur',()=>{if(state==='playing')pauseGame();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pauseGame();});
let viewportWidth=innerWidth;
window.addEventListener('resize',()=>{if(Math.abs(innerWidth-viewportWidth)>40)touchControls.reset();viewportWidth=innerWidth;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();pauseGame();toast('Utracono obraz 3D. Odśwież stronę, aby wrócić do gry.');});

show('loading',false);animate();
