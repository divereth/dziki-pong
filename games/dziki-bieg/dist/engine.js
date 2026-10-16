(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.YoshiGame=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const GROUND=465,GRAVITY=2100,JUMP=800,AIR_JUMP=770,BASE_SPEED=290,MAX_SPEED=760,ACCELERATION=8.5,DASH_TIME=.26,DASH_COOLDOWN=.7,EGG_MIN_HEIGHT=120,EGG_MAX_HEIGHT=146;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const speedAt=time=>Math.min(MAX_SPEED,BASE_SPEED+Math.max(0,time)*ACCELERATION);
  function surfaceY(platform,x){const y=platform.y??GROUND;return y+((platform.endY??y)-y)*clamp((x-platform.x)/platform.w,0,1);}
  function rng(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
  class Game{
    constructor(seed){this.reset(seed);}
    reset(seed=Date.now()){
      this.random=rng(seed);this.state='ready';this.time=0;this.distance=0;this.speed=BASE_SPEED;this.bonus=0;this.eggCount=0;this.koopaCount=0;this.reason='';this.events=[];this.pendingEvents=[];this.jumpBuffer=0;this.section=0;
      this.player={x:250,y:GROUND,vy:0,grounded:true,coyote:.1,jumps:0,dash:0,cooldown:0,tongue:0,blink:0};
      this.platforms=[{x:-300,w:1300,y:GROUND,endY:GROUND,kind:'meadow'}];this.entities=[{type:'koopa',x:510,y:GROUND-65,phase:0},{type:'egg',x:740,y:GROUND,h:130,phase:0}];this.nextEdge=1000;this.generate();
    }
    get meters(){return Math.floor(this.distance/8);}
    get score(){return this.meters+this.bonus;}
    get jumpsRemaining(){return this.player.grounded?2:Math.max(0,2-Math.max(1,this.player.jumps));}
    start(){if(this.state==='ready')this.state='running';}
    jump(){if(this.state==='running')this.jumpBuffer=.13;}
    dash(){const p=this.player;if(this.state!=='running'||p.cooldown>0||p.dash>0)return false;p.dash=DASH_TIME;p.cooldown=DASH_COOLDOWN;p.vy=0;this.pendingEvents.push({type:'dash',x:p.x,y:p.y-30});return true;}
    pause(){if(this.state==='running'){this.state='paused';this.jumpBuffer=0;}}
    resume(){if(this.state==='paused')this.state='running';}
    die(reason){if(this.state!=='running')return;this.state='ended';this.reason=reason;this.events.push({type:'death',x:this.player.x,y:this.player.y-35});}
    generate(){
      while(this.nextEdge<this.distance+3000){
        const previous=this.platforms[this.platforms.length-1],lastY=surfaceY(previous,this.nextEdge);
        const currentSpeed=speedAt(this.time),runUp=Math.max(0,this.nextEdge-(this.distance+250));
        const futureSpeed=Math.min(MAX_SPEED,Math.sqrt(currentSpeed*currentSpeed+2*ACCELERATION*runUp));
        const kind=['cliff','ramp','island','meadow','ramp','island'][this.section%6];
        const change=this.section===0?-70:(this.random()-.5)*160;
        const y=clamp(lastY+change,340,500),up=Math.max(0,lastY-y);
        // Anticipate acceleration before take-off, with extra room for higher landings.
        const gap=futureSpeed*(.98+this.random()*.14-up*.0014),x=this.nextEdge+gap;
        const w=(kind==='island'?Math.max(360,futureSpeed*.58):kind==='meadow'?Math.max(850,futureSpeed*1.35):Math.max(620,futureSpeed*1.05))+this.random()*(kind==='island'?150:260);
        const endY=kind==='ramp'?clamp(y+(this.section%6===1?-65:65),340,500):y;
        const platform={x,w,y,endY,kind,approachSpeed:futureSpeed,depth:kind==='island'?100+this.random()*30:0};this.platforms.push(platform);
        const landingRunway=Math.max(290,futureSpeed*.55),exitRunway=Math.max(220,futureSpeed*.38);
        if(kind!=='island'&&w>landingRunway+exitRunway+105){const eggX=x+landingRunway+this.random()*(w-landingRunway-exitRunway);this.entities.push({type:'egg',x:eggX,y:surfaceY(platform,eggX),h:EGG_MIN_HEIGHT+this.random()*(EGG_MAX_HEIGHT-EGG_MIN_HEIGHT),phase:this.random()*6});}
        const koopaX=x+w*.67;this.entities.push({type:'koopa',x:koopaX,y:surfaceY(platform,koopaX)-70,phase:this.random()*6});
        if(this.section%2===0)this.entities.push({type:'koopa',x:x-gap*.48,y:Math.min(lastY,y)-120,phase:this.random()*6});
        this.nextEdge=x+w;this.section++;
      }
    }
    update(dt){
      if(this.state!=='running')return;dt=Math.min(dt,1/30);this.events=this.pendingEvents;this.pendingEvents=[];this.time+=dt;this.speed=speedAt(this.time);
      const p=this.player,oldY=p.y,oldX=p.x,wasGrounded=p.grounded;
      p.cooldown=Math.max(0,p.cooldown-dt);p.tongue=Math.max(0,p.tongue-dt);p.blink=Math.max(0,p.blink-dt);
      this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);p.coyote=wasGrounded?.1:Math.max(0,p.coyote-dt);
      let jumped=false;
      if(this.jumpBuffer>0&&(p.coyote>0||p.jumps<2)){
        const fromGround=wasGrounded||p.coyote>0;p.jumps=fromGround?1:Math.max(1,p.jumps)+1;
        p.vy=fromGround?-JUMP:-AIR_JUMP;p.grounded=false;p.coyote=0;p.dash=0;this.jumpBuffer=0;jumped=true;
        this.events.push({type:fromGround?'jump':'double-jump',x:p.x,y:p.y});
      }
      const dashActive=p.dash>0,advance=(this.speed+(dashActive?430:0))*dt;this.distance+=advance;p.x=250+this.distance;
      if(dashActive)p.vy=0;else p.vy+=GRAVITY*dt;
      p.y+=p.vy*dt;p.grounded=false;
      for(const platform of this.platforms){
        if(p.x+17<=platform.x||p.x-17>=platform.x+platform.w)continue;
        const top=surfaceY(platform,p.x),oldTop=surfaceY(platform,oldX);
        const followsSlope=wasGrounded&&!jumped&&oldX>=platform.x&&oldX<=platform.x+platform.w&&Math.abs(oldY-oldTop)<2;
        if(followsSlope||(p.vy>=0&&oldY<=oldTop+1&&p.y>=top)){
          p.y=top;p.vy=0;p.grounded=true;p.jumps=0;continue;
        }
        const bottom=platform.kind==='island'?Math.max(platform.y,platform.endY)+platform.depth:800;
        if(oldX+17<=platform.x&&p.y>top+10&&p.y-58<bottom){this.die('Uskok! Użyj drugiego skoku (Z), żeby wskoczyć na wyższą platformę.');break;}
      }
      if(this.state==='running')for(const e of this.entities){
        if(e.dead)continue;
        if(e.type==='koopa'){
          const ey=e.y+Math.sin(this.time*3+e.phase)*16;
          if(e.x-p.x>=-28&&e.x-p.x<150&&Math.abs(ey-(p.y-44))<62){e.dead=true;this.koopaCount++;this.bonus+=100;p.tongue=.19;this.events.push({type:'eat',x:e.x,y:ey,value:100});}
        }else if(Math.abs(e.x-p.x)<17+e.h*33/90&&p.y>e.y-e.h+12&&p.y-60<e.y-5){
          if(dashActive){e.dead=true;this.eggCount++;this.bonus+=200;this.events.push({type:'smash',x:e.x,y:e.y-e.h/2,value:200});}
          else{this.die('Jajko na drodze! Rozbij je dashem (X) albo przeskocz (Z).');break;}
        }
      }
      p.dash=Math.max(0,p.dash-dt);
      if(p.y>780)this.die('Przepaść! Naciśnij Z ponownie w powietrzu. Dash (X) wydłuża lot.');
      this.platforms=this.platforms.filter(v=>v.x+v.w>this.distance-150);this.entities=this.entities.filter(e=>!e.dead&&e.x>this.distance-180);this.generate();
    }
  }
  return {Game,GROUND,GRAVITY,JUMP,AIR_JUMP,BASE_SPEED,MAX_SPEED,ACCELERATION,EGG_MIN_HEIGHT,EGG_MAX_HEIGHT,DASH_TIME,DASH_COOLDOWN,speedAt,surfaceY,rng};
});
