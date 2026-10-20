import {createPlatform,solidAt,surfaceY} from './terrain.js';
export {surfaceY} from './terrain.js';
export const WIDTH=2560/3,HEIGHT=480,PHYSICS_HZ=34,FOOT_OFFSET=26.15,CONE_SPAWN_CHANCE=2/3;
const STEP=1/PHYSICS_HZ,TAU=Math.PI*2;
const CONE_HURT_INSET_X=10,CONE_HURT_INSET_Y=8,CONE_HURT_EPSILON=1e-9;
const FAIRY_PICKUP_PADDING=16,CONE_OFFSCREEN_MARGIN=128;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const twip=n=>Math.trunc(n*20)/20;
// Measured wing-box motion from a 41-frame native fairy animation cycle.
const FAIRY_WING_TOPS=[-36.45,-41.55,-46.65,-49.95,-53.25,-56.55,-58.05,-59.55,-61.05,-61.35,-60.45,-59.55,-58.65,-55.95,-53.25,-50.55,-46.05,-41.55,-37.05,-31.8,-26.55,-21.3,-16.05,-12.75,-9.45,-6.15,-4.65,-3.15,-1.65,-1.35,-2.25,-3.15,-4.05,-6.75,-9.45,-12.15,-16.65,-21.15,-25.65,-31.35,-31.35];
export function fairyBobOffset(phase){return FAIRY_WING_TOPS[((phase%41)+41)%41];}
const PROBES={top:[1.7,-57],topRight:[26,-55.9],right:[23.95,-34.25],
  bottom:[1.7,0],bottomLeft:[-20.4,-.2],bottomRight:[28.5,-.8],
  stick:[1.7,1.5],leftStick:[-20.4,1.3],rightStick:[28.5,.7],root:[1.7,16.5]};
export class Game{
  constructor({event=()=>{},random=Math.random}={}){this.event=event;this.random=random;this.best=0;this.reset();this.state='title';}
  reset(){this.scores=[];this.wish=1;this.total=0;this.time=0;this.setupWish();}
  setupWish(){
    this.distance=0;this.runTime=0;this.ticks=0;this.accumulator=0;this.speedPerFrame=14;this.speed=476;
    this.score=0;this.runPoints=0;this.bonus=0;this.starChain=0;this.pixieChain=0;this.cameraY=-102;
    this.cameraX=0;this.engineX=320;this.shakeDirection=1;this.cameraAccumulator=0;
    this.player={x:60,nativeX:-260,bodyY:-41.25,y:-15.1,vy:0,jumps:0,grounded:false,
      gravity:0,thrust:0,applyGravity:true,touchGround:0,coyote:0,upPress:false,
      animState:'run',chargeCoolDown:100,chargeEndTime:0,dashFrames:0,
      dash:0,attack:0,attackFrames:0,cooldown:0,cooldownFrames:0,airMeter:100,
      offset:0,lunge:0,anim:0,runFrame:1,rotation:0,rotationTarget:0,rotationHistory:[0,0,0,0],
      jumpHeld:false,dashHeld:false};
    this.jumpQueued=false;this.dashQueued=false;
    this.platforms=[createPlatform(1,200,264.1,.3),createPlatform(1,1760.05,464.1,.7)];
    this.platformSerial=2;
    this.platforms.forEach((p,i)=>{p.slot=i;p.ordinal=i+1;p.coneExempt=true;p.coneRolled=true;});
    this.stars=[];this.pixies=this.platforms.map((p,i)=>({platformId:i,localX:38.25,localY:-332.7,
      x:p.centerX+38.25,y:p.y-332.7,bobPhase:40,nextBobPhase:0,wingTop:-31.35,collected:false,missed:false}));
    this.platforms.forEach(p=>this.spawnPinecone(p));
    this.particles=[];this.popups=[];this.shake=0;this.flash=0;this.death=null;
  }
  start(){this.reset();this.state='playing';this.event('start');}
  continue(){if(this.state!=='dead')return;this.wish++;this.setupWish();this.state='playing';this.event('start');}
  jump(){if(this.state!=='playing')return false;this.player.jumpHeld=true;this.jumpQueued=true;return this.player.animState!=='charge';}
  releaseJump(){this.player.jumpHeld=false;}
  canDash(){return this.player.chargeCoolDown>20&&this.player.airMeter>40;}
  dash(){if(this.state!=='playing')return false;this.player.dashHeld=true;this.dashQueued=true;return this.canDash();}
  releaseDash(){this.player.dashHeld=false;}
  pause(){
    if(this.state==='playing'){this.state='paused';this.releaseJump();this.releaseDash();this.jumpQueued=false;this.dashQueued=false;this.event('pause');}
    else if(this.state==='paused'){this.state='playing';this.event('resume');}
  }
  generate(){}
  spawnPinecone(platform){
    if(platform.coneExempt||platform.coneRolled)return null;
    platform.coneRolled=true;
    if(this.stars.some(s=>s.platformId===platform.slot))return null;
    const roll=this.random();if(!platform.coneGuaranteed&&!(roll<CONE_SPAWN_CHANCE))return null;
    // One independent roll determines presence and an equally likely attachment.
    const threshold=platform.coneGuaranteed ? .5 : CONE_SPAWN_CHANCE/2;
    const dots=platform.dots||{},preferred=roll<threshold?dots.dot2:dots.dot3;
    const other=preferred===dots.dot2?dots.dot3:dots.dot2;
    const left=platform.x+38.05,right=platform.x+platform.width-32.05;
    const place=x=>{
      if(!Number.isFinite(x)||x<left||x>right)return null;
      const floor=surfaceY(platform,x);
      if(!Number.isFinite(floor)||!solidAt(platform,x,floor+.01))return null;
      const y=floor-55.4,cone={platformId:platform.slot,localX:x-platform.centerX,
        localY:y-platform.y,x,y,r:54,broken:false,missed:false};
      this.stars.push(cone);return cone;
    };
    for(const dot of [preferred,other]){const cone=place(dot?.x);if(cone)return cone;}
    // Attachment markers can land beyond a cliff or over an internal opening.
    // Search the nearby walkable lane without changing the spawn probability.
    const origin=clamp(preferred?.x??platform.centerX,left,right);
    for(let offset=0;offset<=platform.width;offset+=8){
      for(const x of [origin-offset,origin+offset]){const cone=place(x);if(cone)return cone;}
    }
    return null;
  }
  syncCollectibles(platform){
    for(const object of [...this.stars,...this.pixies])if(object.platformId===platform.slot){
      object.x=platform.centerX+object.localX;object.y=platform.y+object.localY;
    }
  }
  moveWorld(amount){
    this.distance+=amount;
    for(let i=0;i<this.platforms.length;i++){
      let platform=this.platforms[i];
      this.runPoints+=Math.floor(amount/8);
      if(!platform.template)continue;
      platform.nativeCenterX=twip(platform.nativeCenterX-amount);
      const center=platform.nativeCenterX+320+this.distance,shift=center-platform.centerX;
      platform.x+=shift;platform.centerX=center;
      for(const dot of Object.values(platform.dots))dot.x+=shift;
      if(platform.nativeCenterX< -1500){
        const other=this.platforms[1-i];
        const id=1+Math.floor(this.random()*Math.max(1,Math.floor(amount/1.5)));
        const fresh=createPlatform(id,0,0,this.random());
        const newX=other.nativeCenterX+other.layoutWidth/2+fresh.layoutWidth/2+400+amount*8+Math.floor(this.random()*100);
        const newY=300+Math.floor(this.random()*100);
        this.stars=this.stars.filter(s=>s.platformId!==i);
        this.pixies=this.pixies.filter(s=>s.platformId!==i);
        platform=createPlatform(id,newX+this.distance,newY,fresh.seed);
        platform.nativeCenterX=twip(newX);platform.slot=i;platform.ordinal=++this.platformSerial;platform.coneGuaranteed=platform.ordinal===3;this.platforms[i]=platform;
        this.spawnPinecone(platform);
        const dot=platform.dots.dot1;
        this.pixies.push({platformId:i,localX:dot.x-platform.centerX-(400+amount*2),
          localY:dot.y-platform.y-150+Math.floor(this.random()*30),bobPhase:40,nextBobPhase:40,wingTop:-31.35,collected:false,missed:false});
      }
      this.syncCollectibles(platform);
    }
  }
  moveY(amount){const p=this.player;p.bodyY=twip(p.bodyY+amount);p.y=p.bodyY+FOOT_OFFSET;}
  probe(name){
    const [x,y]=PROBES[name],p=this.player,wx=this.distance+p.x+x;
    return this.platforms.some(platform=>solidAt(platform,wx,p.y+y));
  }
  resolve(name,direction,limit=19){
    let moved=0;while(moved<limit&&this.probe(name)){this.moveY(direction);moved++;}
    return moved;
  }
  oddLanding(direction){
    const p=this.player;
    if(this.probe('root')){
      for(let n=0;n<9&&!this.probe('stick');n++)this.moveY(1);
    }else{
      for(let n=0;n<9;n++){
        if(this.probe('stick')){p.applyGravity=false;p.touchGround=1;break;}
        p.nativeX=twip(p.nativeX+direction);p.x=p.nativeX+320;
      }
    }
  }
  contact(){
    const p=this.player;let ceiling=false;
    if(this.probe('top')){ceiling=true;this.resolve('top',1);}
    if(this.probe('bottom')){p.touchGround=1;p.rotationTarget-=this.resolve('bottom',-1)*3;}
    if(this.probe('right')){this.score=this.runPoints+this.bonus;this.die('You crashed into the hillside.');return;}
    if(p.applyGravity){
      if(this.probe('topRight')){ceiling=true;this.resolve('topRight',1,512);}
      for(const [name,direction] of [['bottomLeft',-1],['bottomRight',1]])if(this.probe(name)){
        if(p.gravity>p.thrust&&!p.touchGround)this.oddLanding(direction);
        if(!p.touchGround)this.resolve(name,-1,512);
      }
    }
    if(ceiling&&p.applyGravity)p.thrust/=2;
    if(p.touchGround){
      p.applyGravity=false;p.gravity=0;
      if(p.animState!=='charge')p.animState='run';
      if(p.animState!=='charge'&&this.probe('root')){
        for(let n=0;n<9&&!this.probe('stick');n++){this.moveY(1);p.rotationTarget+=2;}
      }
      if(p.animState!=='charge'&&!this.probe('stick')&&!this.probe('rightStick')&&!this.probe('leftStick')){
        p.touchGround=0;p.coyote=10;p.jumps=1;p.applyGravity=true;p.thrust=14;p.gravity=14;p.animState='jump';
      }
    }
  }
  endCharge(){
    const p=this.player;p.touchGround=0;
    if(p.jumps===0)p.coyote=10;else p.jumps=1;
    p.chargeEndTime=10;p.applyGravity=true;p.thrust=14;p.gravity=14;p.animState='jump';
  }
  burst(x,y,n,color,force=1,kind='spark'){
    for(let i=0;i<n;i++){const angle=this.random()*TAU,v=(30+this.random()*150)*force,life=.3+this.random()*.6;
      this.particles.push({x,y,vx:Math.cos(angle)*v,vy:Math.sin(angle)*v,life,max:life,color,size:2+this.random()*4,kind,angle});}
  }
  popup(x,y,text){this.popups.push({x,y,text,life:1});}
  die(cause,cone=null){
    if(this.state!=='playing')return;this.score=Math.floor(this.score);this.scores.push(this.score);
    this.death={age:0,duration:30/PHYSICS_HZ,x:this.player.x,y:this.player.y,pose:{...this.player},cone};
    this.total=this.scores.reduce((a,b)=>a+b,0);this.state=this.wish===3?'over':'dead';this.cause=cause;
    this.shake=6;this.flash=.5;this.player.dead=true;this.best=Math.max(this.best,this.total);
    this.burst(this.player.x,this.player.y-25,40,'#fff6ea',2,'metal');
    this.burst(this.player.x,this.player.y-25,25,'#b8e78b',2,'shard');this.event('death');
  }
  updateCamera(follow=true,bodyY=this.player.bodyY){
    if(follow)this.cameraY=-Math.max(0,twip(-this.cameraY-((-this.cameraY+bodyY)-200)/10));
    if(this.shake>0){
      const range=Math.floor(this.shake*3);
      this.cameraY=-twip(-this.cameraY+Math.floor(this.random()*range)*this.shakeDirection);
      this.engineX=twip(this.engineX+Math.floor(this.random()*range)*this.shakeDirection);
      this.shakeDirection*=-1;this.shake-=.1;
    }else this.shake=0;
    if(this.engineX>321)this.engineX=twip(this.engineX-.25);
    else if(this.engineX<319)this.engineX=twip(this.engineX+.25);
    this.cameraX=this.engineX-320;
  }
  update(dt){
    dt=clamp(dt,0,.25);this.time+=dt;this.flash=Math.max(0,this.flash-dt*2);
    for(const a of this.particles){a.x+=a.vx*dt;a.y+=a.vy*dt;a.vy+=300*dt;a.angle+=dt*4;a.life-=dt;}
    this.particles=this.particles.filter(a=>a.life>0);
    for(const a of this.popups){a.y-=dt*30;a.life-=dt;}this.popups=this.popups.filter(a=>a.life>0);
    if(this.state!=='playing'){
      if(this.state==='dead'||this.state==='over'){
        if(this.death)this.death.age+=dt;
        this.cameraAccumulator+=dt;
        while(this.cameraAccumulator+1e-10>=STEP){this.cameraAccumulator-=STEP;this.updateCamera(false);}
      }
      return;
    }
    this.accumulator+=dt;
    while(this.accumulator+1e-10>=STEP&&this.state==='playing'){this.accumulator-=STEP;this.step();}
  }
  step(){
    const p=this.player;
    if(Math.abs(p.y-(p.bodyY+FOOT_OFFSET))>1e-8)p.bodyY=twip(p.y-FOOT_OFFSET);
    this.ticks++;this.runTime=this.ticks/PHYSICS_HZ;const previousState=p.animState;
    p.coyote=Math.max(0,p.coyote-1);if(p.airMeter<100)p.airMeter++;
    p.rotationHistory=[p.rotationTarget,...p.rotationHistory.slice(0,3)];
    p.rotation=clamp(p.rotationHistory.reduce((a,b)=>a+b,0)/4,-20,20)*Math.PI/180;p.rotationTarget=0;
    if(p.dashHeld&&this.canDash()){
      this.moveY(-8);p.airMeter-=70;p.lunge=15;p.chargeCoolDown=0;p.applyGravity=false;
      p.animState='charge';p.dashFrames=10;this.event('dash');this.burst(p.x-20,p.y-24,12,'#d5f57b',1.2,'leaf');
    }
    this.dashQueued=false;
    if(p.chargeCoolDown<21)p.chargeCoolDown++;
    if(p.chargeEndTime>0)p.chargeEndTime--;
    if(p.animState!=='charge'){
      if(p.jumpHeld){
        const first=!p.applyGravity||p.coyote>0||p.jumps===0;
        if(first){
          if(!p.upPress){
            p.jumps=1;p.coyote=0;p.touchGround=0;p.applyGravity=true;p.thrust=14;p.gravity=0;p.animState='jump';
            this.event('jump');this.burst(p.x,p.y-8,6,'#fff9ff');
          }
        }else{
          if(!p.upPress&&p.gravity>6&&p.jumps===1){
            p.jumps=2;p.applyGravity=true;p.thrust=14;p.gravity=2;p.animState='jump';
            this.event('double');this.burst(p.x,p.y-22,10,'#ffe2ff');
          }
          p.gravity-=.75;
        }
        p.upPress=true;
      }else p.upPress=false;
    }
    this.jumpQueued=false;
    const sf=this.speedPerFrame;this.speed=sf*PHYSICS_HZ;this.moveWorld(sf);this.speedPerFrame=Math.min(50,sf+.01);
    p.nativeX=twip((sf-14)/2-260+p.offset);p.x=p.nativeX+320;p.offset=p.offset>0?p.offset-5:0;
    if(p.applyGravity&&p.animState!=='charge'){
      const upward=Math.min(10,p.thrust-p.gravity);this.moveY(-upward);p.vy=-upward*PHYSICS_HZ;p.gravity+=1.2;
    }else p.vy=0;
    this.contact();if(this.state!=='playing'){this.updateCamera(false);return;}
    const cameraBodyY=p.bodyY;
    p.bodyY=Math.max(-600,p.bodyY);p.y=p.bodyY+FOOT_OFFSET;
    if(p.animState==='run'){
      if(previousState!=='run'){p.airMeter=100;p.runFrame=200;}
      p.jumps=0;const oldFrame=p.runFrame;
      p.runFrame=Math.min(552,oldFrame+Math.floor(sf*2));if(oldFrame>450)p.runFrame=oldFrame-450;p.anim=p.runFrame/450*TAU;
    }else if(p.animState==='charge'){
      this.moveWorld(sf/2);p.offset+=p.lunge;p.lunge=Math.max(0,p.lunge-1);
    }
    this.score=this.runPoints+this.bonus;
    if(p.bodyY>700){this.die('Your dreams are just out of reach.');this.updateCamera(false);return;}
    this.collect();
    p.grounded=p.animState==='run';if(p.applyGravity)p.rotation=0;
    this.updateCamera(this.state==='playing',cameraBodyY);
    if(p.animState==='charge'&&--p.dashFrames===0)this.endCharge();
    p.dash=p.animState==='charge'?p.dashFrames/34:0;
    p.attackFrames=(p.animState==='charge'?p.dashFrames+10:p.chargeEndTime);
    p.attack=p.attackFrames/34;p.cooldownFrames=Math.max(0,21-p.chargeCoolDown);
    p.cooldown=Math.max(p.cooldownFrames,41-p.airMeter)/34;
  }
  collect(){
    const p=this.player,wx=this.distance+p.x;
    // Missing is a scoring event, independent of platform rolls and visual
    // cleanup. Keep passed cones visible until their offscreen despawn point.
    // Resolve misses before hits so array order cannot carry a stale combo.
    for(const star of this.stars){
      if(!star.broken&&!star.comboMissed&&star.x+32.05<=wx-32.55){
        star.comboMissed=true;this.starChain=0;
      }
    }
    for(const star of this.stars){
      if(star.broken||star.missed)continue;
      const attacking=p.animState==='charge'||p.chargeEndTime>0;
      const insetX=attacking?0:CONE_HURT_INSET_X,insetY=attacking?0:CONE_HURT_INSET_Y;
      const epsilon=attacking?0:CONE_HURT_EPSILON;
      if(wx-32.55<star.x+32.05-insetX-epsilon&&wx+26.55>star.x-38.05+insetX+epsilon
        &&p.y-55.95<star.y+55.4-insetY-epsilon&&p.y-6.35>star.y-52.4+insetY+epsilon){
        if(attacking){
          star.broken=true;this.starChain++;const points=this.starChain*100;this.bonus+=points;
          this.popup(star.x-this.distance,star.y,'+'+points);this.burst(star.x-this.distance,star.y,24,'#ad733f',1.5,'shard');
          this.shake=4;this.event('star');
        }else{this.score=this.runPoints+this.bonus;this.die('You must dash through the pinecones.',star);return;}
      }
      // Despawn beyond the screen, independently of the boar's dash lunge.
      if(star.x-this.distance+Math.max(0,this.cameraX)<-CONE_OFFSCREEN_MARGIN)star.missed=true;
    }
    for(const fairy of this.pixies){
      if(fairy.collected||fairy.missed)continue;
      fairy.bobPhase=fairy.nextBobPhase??0;fairy.wingTop=fairyBobOffset(fairy.bobPhase);
      fairy.nextBobPhase=(fairy.bobPhase+1)%41;
      if(fairy.platformId!==undefined){
        fairy.localX=twip(fairy.localX+3);const platform=this.platforms[fairy.platformId];
        fairy.x=platform.centerX+fairy.localX;fairy.y=platform.y+fairy.localY;
      }else fairy.x+=3;
      if(wx-32.55<fairy.x+29.5+FAIRY_PICKUP_PADDING&&wx+26.55>fairy.x-35.9-FAIRY_PICKUP_PADDING
        &&p.y-55.95<fairy.y+fairy.wingTop+61.2+FAIRY_PICKUP_PADDING&&p.y-6.35>fairy.y+fairy.wingTop-FAIRY_PICKUP_PADDING){
        fairy.collected=true;this.pixieChain++;const points=this.pixieChain*10;this.bonus+=points;
        this.popup(fairy.x-this.distance,fairy.y,'+'+points);this.burst(fairy.x-this.distance,fairy.y,10,'#ffffad');this.event('pixie');
      }
      if(fairy.x<wx-70-FAIRY_PICKUP_PADDING){fairy.missed=true;this.pixieChain=0;}
    }
    this.score=this.runPoints+this.bonus;
  }
}
