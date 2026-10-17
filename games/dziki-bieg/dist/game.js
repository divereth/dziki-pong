(() => {
  'use strict';
  const {Game,GROUND,BASE_SPEED,DASH_COOLDOWN,surfaceY}=YoshiGame;
  const canvas=document.getElementById('game'),ctx=canvas.getContext('2d'),shell=document.getElementById('game-shell');
  const $=id=>document.getElementById(id),game=new Game();
  const ui={score:$('score'),distance:$('distance'),speed:$('speed'),best:$('best'),overlay:$('overlay'),start:$('start-card'),pause:$('pause-card'),end:$('end-card'),dashFill:$('dash-fill'),dashLabel:$('dash-label')};
  let record=0,soundOn=false,audio=null,previous=0,accumulator=0,clock=0,particles=[],popups=[],ghosts=[],shake=0,flash=0,viewY=0,lastState='',newRecord=false;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer=matchMedia('(any-pointer: coarse)'),compactScreen=matchMedia('(max-width: 1100px)');
  let touchLayout=false,view=RunViewport.layout(1280,600),resizeFrame=0,expandedScroll=0,lastWide=innerWidth>innerHeight,paintNeeded=true;
  const pressedPointers=new Map();
  function releaseControls(){for(const id of ['touch-jump','touch-dash'])$(id).classList.remove('pressed');pressedPointers.clear();}
  function resizeCanvas(){
    touchLayout=coarsePointer.matches||compactScreen.matches;
    const wide=innerWidth>innerHeight;
    if(touchLayout&&wide!==lastWide&&game.state==='running'){releaseControls();game.pause();$('pause-caption').textContent='Ekran obrócony. Wznów, kiedy będziesz gotowy.';updateUI();}
    lastWide=wide;
    document.documentElement.classList.toggle('touch-layout',touchLayout);
    document.documentElement.classList.toggle('phone-landscape',touchLayout&&innerWidth>innerHeight&&innerHeight<=600);
    const rect=shell.getBoundingClientRect(),control=$('mobile-controls'),controlStyle=getComputedStyle(control);
    const controls=touchLayout?control.getBoundingClientRect().height+(parseFloat(controlStyle.bottom)||0)+12:0;
    const hudRect=$('hud').getBoundingClientRect(),hud=Math.max(48,hudRect.bottom-rect.top);
    view=RunViewport.layout(rect.width,rect.height,{touch:touchLayout,pixelRatio:devicePixelRatio||1,controls,hud});
    const width=Math.round(rect.width*view.dpr),height=Math.round(rect.height*view.dpr);
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    paintNeeded=true;
  }
  function scheduleResize(){if(!resizeFrame)resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;resizeCanvas();});}
  function orientationChanged(){
    releaseControls();if(game.state==='running'){game.pause();$('pause-caption').textContent='Ekran obrócony. Wznów, kiedy będziesz gotowy.';updateUI();}
    scheduleResize();
  }
  window.addEventListener('resize',scheduleResize);
  window.addEventListener('orientationchange',orientationChanged);
  screen.orientation?.addEventListener('change',orientationChanged);
  coarsePointer.addEventListener('change',scheduleResize);compactScreen.addEventListener('change',scheduleResize);
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(scheduleResize).observe(shell);
  try{record=Math.max(0,Number(localStorage.getItem('dziki-bieg-best')??localStorage.getItem('yoshi-dash-best'))||0);soundOn=(localStorage.getItem('dziki-bieg-sound')??localStorage.getItem('yoshi-dash-sound'))==='true';}catch{}
  const fmt=n=>Math.floor(n).toLocaleString('pl-PL');
  function updateBest(){ui.best.innerHTML=fmt(record)+' <small>pkt</small>';}
  updateBest();

  function tone(freq,type='sine',duration=.1,volume=.05,slide=1){
    if(!soundOn)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*slide,audio.currentTime+duration);g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch{}
  }
  function syncSound(){const b=$('sound');b.classList.toggle('sound-on',soundOn);b.setAttribute('aria-pressed',String(soundOn));b.setAttribute('aria-label',soundOn?'Wyłącz dźwięk':'Włącz dźwięk');}
  syncSound();
  function toggleSound(){soundOn=!soundOn;syncSound();try{localStorage.setItem('dziki-bieg-sound',String(soundOn));}catch{}if(soundOn)tone(660,'sine',.12,.035,1.5);}
  function start(){game.reset();game.start();particles=[];popups=[];ghosts=[];shake=0;flash=0;viewY=0;newRecord=false;accumulator=0;releaseControls();previous=performance.now();tone(520,'sine',.16,.045,1.5);updateUI();}
  function pause(){if(game.state==='running'){game.pause();$('pause-caption').textContent='Gotowy na kolejną porcję przygody?';releaseControls();}else if(game.state==='paused')game.resume();updateUI();}
  function action(type){if(game.state!=='running')return;type==='jump'?game.jump():game.dash();}
  function expandedFallback(enabled){
    if(enabled)expandedScroll=scrollY;
    shell.classList.toggle('expanded',enabled);document.documentElement.classList.toggle('game-expanded',enabled);
    if(!enabled)window.scrollTo(0,expandedScroll);
    scheduleResize();
  }
  async function fullscreen(){
    if(document.fullscreenElement){try{await document.exitFullscreen();}catch{}return;}
    if(shell.classList.contains('expanded')){expandedFallback(false);return;}
    // A browser-sized game view also works on iPhones and embedded browsers.
    if(touchLayout){expandedFallback(true);return;}
    if(shell.requestFullscreen&&document.fullscreenEnabled){try{await shell.requestFullscreen({navigationUI:'hide'});return;}catch{}}
    expandedFallback(true);
  }
  document.addEventListener('fullscreenchange',()=>{document.documentElement.classList.toggle('game-expanded',!!document.fullscreenElement||shell.classList.contains('expanded'));scheduleResize();});
  $('start').onclick=start;$('restart').onclick=start;$('restart-pause').onclick=start;$('resume').onclick=()=>{game.resume();updateUI();};$('pause').onclick=()=>pause();$('sound').onclick=toggleSound;$('fullscreen').onclick=fullscreen;$('exit-expanded').onclick=fullscreen;
  document.addEventListener('keydown',e=>{
    if(e.altKey||e.ctrlKey||e.metaKey)return;
    const isButton=e.target instanceof HTMLElement&&e.target.closest('button,a,input,textarea,select');
    if(e.code==='Enter'&&isButton)return;
    if(['KeyZ','KeyX','Space','ArrowUp','KeyP','Escape','Enter','KeyF','KeyM'].includes(e.code))e.preventDefault();
    if(e.repeat)return;
    if(e.code==='Enter'){if(game.state==='ready'||game.state==='ended')start();else if(game.state==='paused'){game.resume();updateUI();}}
    else if(e.code==='KeyZ'||e.code==='ArrowUp'||e.code==='Space')action('jump');
    else if(e.code==='KeyX')action('dash');
    else if(e.code==='Escape'&&shell.classList.contains('expanded'))expandedFallback(false);
    else if(e.code==='KeyP'||e.code==='Escape')pause();
    else if(e.code==='KeyF')fullscreen();else if(e.code==='KeyM')toggleSound();
  });
  for(const [id,type]of[['touch-jump','jump'],['touch-dash','dash']]){
    const button=$(id);
    button.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();
      if(game.state!=='running')return;
      pressedPointers.set(e.pointerId,button);button.classList.add('pressed');
      try{button.setPointerCapture(e.pointerId);}catch{}
      action(type);
    });
    const release=e=>{pressedPointers.delete(e.pointerId);if(![...pressedPointers.values()].includes(button))button.classList.remove('pressed');};
    for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,release);
    button.addEventListener('click',e=>{if(e.detail===0)action(type);});
    button.addEventListener('contextmenu',e=>e.preventDefault());
  }
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('blur',()=>{releaseControls();game.pause();updateUI();});document.addEventListener('visibilitychange',()=>{if(document.hidden){releaseControls();game.pause();updateUI();}});

  function updateUI(){
    ui.score.textContent=String(game.score).padStart(5,'0');ui.distance.textContent=fmt(game.meters);ui.speed.textContent=(game.speed/BASE_SPEED).toFixed(1);
    const charge=1-game.player.cooldown/DASH_COOLDOWN;ui.dashFill.style.transform=`scaleX(${Math.max(0,charge)})`;ui.dashLabel.textContent=charge>=1?'DASH GOTOWY':'ŁADOWANIE';
    $('touch-dash').classList.toggle('recharging',charge<1);$('touch-dash').setAttribute('aria-disabled',String(charge<1));
    $('jump-count').textContent=game.jumpsRemaining+'/2';
    $('jump-indicator').setAttribute('aria-label','Pozostałe skoki: '+game.jumpsRemaining+' z 2');
    $('jump-indicator').classList.toggle('empty',game.jumpsRemaining===0);
    $('touch-jump').querySelector('.control-label').textContent=game.jumpsRemaining===1?'DRUGI SKOK':'SKOK';
    $('touch-jump').classList.toggle('no-jumps',game.jumpsRemaining===0);
    if(lastState===game.state)return;lastState=game.state;
    paintNeeded=true;
    shell.classList.remove('ready','running','paused','ended');shell.classList.add(game.state);
    if(game.state!=='running')releaseControls();
    ui.overlay.hidden=game.state==='running';ui.start.hidden=game.state!=='ready';ui.pause.hidden=game.state!=='paused';ui.end.hidden=game.state!=='ended';$('pause').disabled=game.state!=='running';
    if(game.state==='ended'){
      newRecord=game.score>record;if(newRecord){record=game.score;try{localStorage.setItem('dziki-bieg-best',String(record));}catch{}updateBest();}
      $('end-eyebrow').textContent=newRecord?'✦ NOWY REKORD!':'DOBRY BIEG!';$('end-title').textContent=newRecord?'Ale to był apetyt!':'Jeszcze jedna runda?';$('end-reason').textContent=game.reason;
      $('final-score').textContent=fmt(game.score);$('final-distance').textContent=fmt(game.meters);$('final-koopas').textContent=game.koopaCount;$('final-eggs').textContent=game.eggCount;
      $('announcement').textContent=`Koniec gry. ${game.score} punktów. ${game.reason}`;
      $('restart').focus({preventScroll:true});
    }else if(game.state==='paused'){$('resume').focus({preventScroll:true});$('announcement').textContent='Pauza.';}else if(game.state==='running'){$('announcement').textContent='Bieg rozpoczęty. Z — skok. Ponownie Z w powietrzu — drugi skok. X — dash.';if(document.activeElement instanceof HTMLElement)document.activeElement.blur();}
  }
  function ellipse(x,y,rx,ry,fill,stroke,angle=0){ctx.beginPath();ctx.ellipse(x,y,rx,ry,angle,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
  function path(points,fill,stroke,width=2){ctx.beginPath();points(ctx);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();}}
  function cloud(x,y,s=1,opacity=.6){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.globalAlpha=opacity;path(c=>{c.moveTo(-65,17);c.bezierCurveTo(-76,-3,-57,-22,-35,-16);c.bezierCurveTo(-34,-52,12,-56,25,-26);c.bezierCurveTo(47,-35,69,-16,62,2);c.bezierCurveTo(88,6,88,27,62,29);c.lineTo(-54,29);c.bezierCurveTo(-71,29,-77,22,-65,17);},'#fffdeb');ctx.restore();}
  function hill(x,y,w,h,color){path(c=>{c.moveTo(x-w,y+300);c.lineTo(x-w,y);c.bezierCurveTo(x-w,y-h,x-w*.4,y-h*1.14,x,y-h);c.bezierCurveTo(x+w*.5,y-h*.9,x+w,y-h*.75,x+w,y);c.lineTo(x+w,y+300);c.closePath();},color);}
  function tree(x,y,s=1,tone=0){ctx.save();ctx.translate(x,y);ctx.scale(s,s);const colors=tone?['#56886b','#679575','#78a27e']:['#638f60','#76a164','#8cae6c'];path(c=>{c.moveTo(-9,0);c.lineTo(-5,-100);c.lineTo(-30,-131);c.lineTo(-25,-136);c.lineTo(-3,-116);c.lineTo(5,-178);c.lineTo(10,-99);c.lineTo(31,-124);c.lineTo(35,-118);c.lineTo(11,-83);c.lineTo(16,0);},'#687b4d');ellipse(-31,-151,46,49,colors[0]);ellipse(24,-161,50,53,colors[0]);ellipse(0,-197,52,52,colors[1]);ellipse(-33,-183,37,36,colors[1]);ellipse(33,-187,31,32,colors[2]);ellipse(-15,-219,29,23,colors[2]);path(c=>{c.moveTo(-45,-176);c.quadraticCurveTo(-56,-190,-42,-202);},null,'#a1bd7f',3);ctx.restore();}
  function bush(x,y,s=1,color='#57814e'){ctx.save();ctx.translate(x,y);ctx.scale(s,s);path(c=>{c.moveTo(-50,0);c.bezierCurveTo(-62,-24,-31,-39,-20,-20);c.bezierCurveTo(-23,-64,34,-66,35,-25);c.bezierCurveTo(60,-35,80,-12,62,0);c.closePath();},color);ctx.restore();}
  function scenery(d){
    const W=view.width,bottom=Math.max(650,view.bottom),sky=ctx.createLinearGradient(0,0,W,420);sky.addColorStop(0,'#e9efd9');sky.addColorStop(.48,'#d4e8cf');sky.addColorStop(1,'#b9ddca');ctx.fillStyle=sky;ctx.fillRect(0,view.top,W,view.height);
    ellipse(W*.832,109,62,62,'#f5f0c9');ellipse(W*.832,109,77,77,'#f8f4d11f');
    for(let i=0;i<Math.ceil(W/300)+1;i++){const x=((i*330+180-d*.06+W+320)%(W+320))-160;cloud(x,78+(i%3)*34,.6+(i%2)*.22,.55);}
    const far=(d*.11)%1600;for(let i=-1;i<Math.ceil((W+far)/800)+1;i++){const x=i*800-far;hill(x+280,460,280,226,'#b0d1ab');hill(x+650,470,210,290,'#b9d6af');ellipse(x+640,205,5,12,'#9fc69e');ellipse(x+674,247,5,12,'#9fc69e');ellipse(x+241,294,5,12,'#9ac196');}
    const mid=(d*.22)%1400;for(let i=-1;i<Math.ceil((W+mid)/700)+1;i++){const x=i*700-mid;hill(x+180,520,270,187,'#91b98a');hill(x+590,540,210,187,'#a1c291');}
    const tr=(d*.38)%1500;for(let i=-1;i<Math.ceil((W+tr)/750)+1;i++){const x=i*750-tr;tree(x+150,478,.76,1);tree(x+690,468,1.08,0);bush(x+440,474,1.45,'#7da174');bush(x+300,480,1.3,'#83a779');}
    path(c=>{c.moveTo(0,492);for(let x=0;x<=W;x+=80)c.quadraticCurveTo(x+40,470,x+80,488);c.lineTo(W,bottom);c.lineTo(0,bottom);},'#527d59');
    for(let i=0;i<Math.ceil(W/120);i++){const x=((i*127-d*.5+W+320)%(W+320))-50;bush(x,540,.8,'#5c8053');}
    if(game.state==='ready'){
      const veil=ctx.createLinearGradient(0,0,W*.69,0);veil.addColorStop(0,'#e9efdbeb');veil.addColorStop(.54,'#e4ecd4d8');veil.addColorStop(1,'#d8e7ce00');ctx.fillStyle=veil;ctx.fillRect(0,view.top,W*.71,460-view.top);
    }
    for(let i=0;i<Math.ceil(W/250);i++){const x=(i*233+clock*8)%W,y=175+Math.sin(clock*.8+i*2)*33;ctx.globalAlpha=.35;ellipse(x,y,2,2,'#fffbdf');ctx.globalAlpha=1;}
  }
  function ground(platform,d){
    const x=platform.x-d,w=platform.w;if(x>view.width+50||x+w<0)return;
    const left=surfaceY(platform,platform.x),right=surfaceY(platform,platform.x+w),high=Math.min(left,right),floating=platform.kind==='island',bottom=floating?Math.max(left,right)+(platform.depth||110):Math.max(800,view.bottom+50);
    const top=q=>surfaceY(platform,platform.x+q);
    ctx.save();ctx.beginPath();ctx.moveTo(x,left-5);ctx.lineTo(x+w,right-5);ctx.lineTo(x+w,bottom-25);
    if(floating){ctx.lineTo(x+w*.8,bottom+2);ctx.lineTo(x+w*.59,bottom-8);ctx.lineTo(x+w*.4,bottom+13);ctx.lineTo(x+w*.17,bottom-4);}
    ctx.lineTo(x,bottom-24);ctx.closePath();ctx.clip();
    const soil=ctx.createLinearGradient(0,high,0,bottom);soil.addColorStop(0,floating?'#ae9269':'#a58b60');soil.addColorStop(1,'#79664c');ctx.fillStyle=soil;ctx.fillRect(x,high-8,w,bottom-high+24);
    path(c=>{c.moveTo(x,high+60);c.bezierCurveTo(x+w*.3,high+30,x+w*.45,high+110,x+w,high+70);c.lineTo(x+w,bottom+20);c.lineTo(x,bottom+20);},'#74624430');
    for(let i=0;i<w/28;i++){const q=17+i*31,px=x+q,py=top(q)+38+Math.sin(i*7.3+platform.x)*16+(i%3)*29;ellipse(px,py,3+i%3,2,'#d3b98464',null,i);if(i%4===0)path(c=>{c.moveTo(px+6,py+12);c.lineTo(px+12,py+12);},null,'#665b403d',2);}
    path(c=>{c.moveTo(x,left+12);c.lineTo(x+w,right+12);},null,'#688548',26);
    for(let q=0;q<w;q+=24)ellipse(x+q+12,top(q+12)+16,14,10,'#78964e');
    path(c=>{c.moveTo(x,left-1);c.lineTo(x+w,right-1);},null,'#adc873',13);
    path(c=>{c.moveTo(x,left-6);c.lineTo(x+w,right-6);},null,'#d0dd96',3);
    for(let i=0;i<w/21;i++){const px=x+i*21,py=top(i*21);path(c=>{c.moveTo(px,py-5);c.lineTo(px-3,py-12-(i%3)*2);c.lineTo(px+3,py-6);c.lineTo(px+7,py-15);c.lineTo(px+7,py-4);},'#a9c26c');}
    path(c=>{c.moveTo(x+7,left+18);c.lineTo(x+7,bottom);},null,'#6a59413d',12);path(c=>{c.moveTo(x+w-6,right+18);c.lineTo(x+w-6,bottom);},null,'#6a594159',12);
    ctx.restore();
    if(floating)for(let i=1;i<4;i++){const px=x+w*i/4;path(c=>{c.moveTo(px,bottom-12);c.quadraticCurveTo(px-10,bottom+8,px+3,bottom+24+i*4);},null,'#71824b',2);ellipse(px-4,bottom+6,4,7,'#789453',null,-.4);}
    for(let i=0;i<w/145;i++){const q=65+i*145,px=x+q,py=top(q),s=Math.sin(i*53+platform.x);if(s>.25){path(c=>{c.moveTo(px,py-6);c.quadraticCurveTo(px+1,py-24,px+9,py-29);c.moveTo(px+3,py-14);c.quadraticCurveTo(px-12,py-27,px-12,py-15);},null,'#5a8849',2);ellipse(px+9,py-29,4,4,'#fff0ad');ellipse(px+9,py-29,1.5,1.5,'#ccac57');}else if(s<-.4)ellipse(px,py-7,9,4,'#8c9e6c');}
  }
  function egg(x,y,h=82,rotation=0){ctx.save();ctx.translate(x,y);ctx.rotate(rotation);const s=h/90;ctx.scale(s,s);ellipse(0,-1,31,6,'#30552b20');path(c=>{c.moveTo(0,-90);c.bezierCurveTo(14,-90,35,-49,33,-29);c.bezierCurveTo(31,-7,18,0,0,0);c.bezierCurveTo(-22,0,-35,-12,-33,-33);c.bezierCurveTo(-31,-56,-14,-90,0,-90);},'#f9f5d8','#638548',2.5);ellipse(-16,-39,9,13,'#80a955',null,-.35);ellipse(13,-20,11,10,'#7ca351',null,.3);ellipse(5,-70,8,10,'#8baf5c',null,-.3);path(c=>{c.moveTo(-24,-54);c.quadraticCurveTo(-27,-47,-27,-41);},null,'#fffde9',3);ctx.restore();}
  function wing(x,y,s,flip,t){ctx.save();ctx.translate(x,y);ctx.scale(s*flip,s);ctx.rotate(Math.sin(t*15)*.18);path(c=>{c.moveTo(0,0);c.bezierCurveTo(-2,-11,6,-28,20,-37);c.bezierCurveTo(24,-38,22,-27,17,-19);c.bezierCurveTo(28,-28,32,-26,29,-19);c.bezierCurveTo(39,-23,35,-13,26,-8);c.bezierCurveTo(24,4,10,7,0,0);},'#fff8df','#9ba889',1.5);path(c=>{c.moveTo(4,-2);c.quadraticCurveTo(12,-8,21,-18);c.moveTo(11,0);c.lineTo(26,-10);},null,'#d9ddbe',1.4);ctx.restore();}
  function koopa(x,y,t,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);wing(-7,-5,.9,-1,t);ellipse(0,0,21,25,'#729845','#436c3e',2);ellipse(2,0,16,21,'#8aa853');path(c=>{c.moveTo(-8,-16);c.lineTo(4,-9);c.lineTo(9,6);c.lineTo(0,15);c.lineTo(-13,7);c.closePath();c.moveTo(4,-9);c.lineTo(13,-14);c.moveTo(9,6);c.lineTo(17,8);},null,'#547b3d',2);ellipse(-4,22,13,7,'#c9a15b','#8e7b4c',-.15);ellipse(19,13,10,6,'#d1a85c','#8e7b4c',.2);path(c=>{c.moveTo(12,-11);c.quadraticCurveTo(14,-36,29,-31);c.bezierCurveTo(40,-28,43,-10,31,-5);c.lineTo(19,1);},'#e0c379','#8f9560',1.6);ellipse(29,-26,4,7,'#fffbe6');ellipse(31,-26,1.8,3.3,'#384e38');ellipse(34,-12,7,5,'#e9ca80');wing(-5,-5,.92,1,t+.1);ctx.restore();}
  function boar(x,y,t,scale=.7,dashing=false,air=false,alpha=1){
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.scale(scale,scale);if(dashing){ctx.rotate(.16);ctx.translate(4,-3);}
    const run=air?.35:Math.sin(t*18),bob=air?0:Math.abs(Math.sin(t*18))*2;ctx.translate(0,-bob);
    path(c=>{c.moveTo(-25,-38);c.quadraticCurveTo(-43,-50,-48,-39);c.quadraticCurveTo(-53,-25,-39,-27);c.quadraticCurveTo(-29,-28,-36,-35);},null,'#70452f',4);
    ellipse(-3,-37,31,25,'#a6663d','#70452f',-.12);ellipse(7,-27,17,12,'#e3bf91',null,-.18);
    path(c=>{c.moveTo(-28,-51);c.lineTo(-30,-63);c.lineTo(-23,-56);c.lineTo(-20,-69);c.lineTo(-14,-57);c.lineTo(-8,-72);c.lineTo(-3,-56);c.lineTo(5,-69);c.lineTo(9,-51);},'#70452f','#70452f',2);
    ellipse(16,-48,21,20,'#a6663d','#70452f',-.28);ellipse(27,-68,20,19,'#b87547','#70452f',-.2);
    path(c=>{c.moveTo(13,-80);c.lineTo(8,-98);c.quadraticCurveTo(24,-94,29,-81);},'#885336','#70452f',2);path(c=>{c.moveTo(16,-84);c.lineTo(13,-92);c.quadraticCurveTo(21,-89,24,-83);},'#d99572');
    ellipse(42,-63,15,10,'#c88370','#70452f',-.08);ellipse(48,-64,2,1.7,'#70452f');ellipse(40,-61,1.7,1.4,'#70452f');
    ellipse(31,-76,5,6,'#fff4dc','#70452f',-.12);ellipse(33,-76,2,3.4,'#302b25');ellipse(33.7,-77,1,1.3,'#fff');
    path(c=>{c.moveTo(24,-53);c.quadraticCurveTo(30,-50,34,-60);c.quadraticCurveTo(36,-53,32,-49);},'#f5e7c5','#9b7953',1.5);
    const leg1=run*7,leg2=-run*7;path(c=>{c.moveTo(-17,-22);c.lineTo(-18-leg1,-5);},null,'#70452f',9);path(c=>{c.moveTo(14,-22);c.lineTo(15-leg2,-5);},null,'#70452f',9);
    ellipse(-20-leg1,-3,10,6,'#593d2d','#493426',1.8);ellipse(13-leg2,-3,10,6,'#593d2d','#493426',1.8);
    ctx.restore();
  }
  function burst(e){
    if(e.type==='jump'){tone(300,'sine',.16,.04,2);for(let i=0;i<7;i++)particles.push({x:e.x,y:e.y-3,vx:-60-Math.random()*80,vy:-20-Math.random()*45,life:.4,max:.4,size:3+Math.random()*4,color:'#e0d6a2',gravity:60});}
    if(e.type==='double-jump'){tone(530,'sine',.16,.05,1.8);for(let i=0;i<16;i++){const a=i*Math.PI/8;particles.push({x:e.x+Math.cos(a)*13,y:e.y+Math.sin(a)*5,vx:Math.cos(a)*110,vy:Math.sin(a)*55,life:.42,max:.42,size:3,color:i%2?'#eff6be':'#b8d685',gravity:40});}}
    if(e.type==='dash'){tone(170,'sawtooth',.16,.028,2.5);if(!reducedMotion)shake=2;}
    if(e.type==='eat'||e.type==='smash'){
      popups.push({x:e.x,y:e.y-35,text:'+'+e.value,life:1,max:1});
      tone(e.type==='eat'?620:220,e.type==='eat'?'sine':'triangle',.18,.055,e.type==='eat'?1.5:.35);
      if(e.type==='smash'){if(!reducedMotion){shake=6;flash=.08;}for(let i=0;i<22;i++)particles.push({x:e.x,y:e.y,vx:(Math.random()-.45)*300,vy:-50-Math.random()*280,life:.6+Math.random()*.3,max:.9,size:3+Math.random()*8,color:i%3?'#fffbdf':'#7f9d50',gravity:580,angle:Math.random()*6});}
      else for(let i=0;i<10;i++)particles.push({x:e.x,y:e.y,vx:(Math.random()-.5)*170,vy:(Math.random()-.7)*160,life:.5,max:.5,size:2+Math.random()*4,color:i%2?'#e8c86f':'#fff6bb',gravity:80});
    }
    if(e.type==='death'){tone(220,'triangle',.4,.06,.3);if(!reducedMotion)shake=8;}
  }
  function animateEffects(dt){for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=p.gravity*dt;p.life-=dt;p.angle=(p.angle||0)+dt*5;}particles=particles.filter(p=>p.life>0);for(const p of popups){p.y-=35*dt;p.life-=dt;}popups=popups.filter(p=>p.life>0);for(const g of ghosts)g.life-=dt;ghosts=ghosts.filter(g=>g.life>0);shake=Math.max(0,shake-dt*28);flash=Math.max(0,flash-dt);}
  function render(){
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.save();ctx.scale(view.dpr*view.scale,view.dpr*view.scale);ctx.translate(0,view.offsetY);if(shake&&!reducedMotion)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
    const ready=game.state==='ready',d=ready?0:game.distance;scenery(d);ctx.translate(0,-viewY);
    if(ready){const W=view.width,hero=W*.7;ground({x:-50,w:W*.52,y:GROUND,endY:GROUND},0);ground({x:W*.65,w:W*.42,y:415,endY:450,kind:'island',depth:105},0);bush(W*.97,442,1,'#567d48');egg(W*.87,434,140,-.09);egg(W*.96,441,120,.12);ellipse(hero-10,422,57,9,'#3c63322b');boar(hero,419,clock,1.18,false,false);koopa(W*.79,243+Math.sin(clock*2)*12,clock,.82);koopa(W*.93,247+Math.sin(clock*2+2)*16,clock,.6);path(c=>{c.moveTo(hero,210);c.quadraticCurveTo(hero-10,193,hero,181);c.moveTo(hero+19,199);c.lineTo(hero+25,183);},null,'#f5f2c7',3);}
    else{
      for(const p of game.platforms)ground(p,d);
      for(const e of game.entities){if(e.x-d<-100||e.x-d>view.width+100)continue;if(e.type==='egg')egg(e.x-d,e.y,e.h);else koopa(e.x-d,e.y+Math.sin(game.time*3+e.phase)*16,game.time);}
      const p=game.player;
      for(const g of ghosts)boar(g.x-d,g.y,game.time,.7,true,!p.grounded,g.life/.22*.25);
      if(p.grounded)ellipse(250,p.y+3,26,5,'#31542e25');
      if(p.tongue>0){const progress=1-p.tongue/.19,reach=Math.sin(progress*Math.PI)*10;path(c=>{c.moveTo(272+reach,p.y-48);c.quadraticCurveTo(279+reach,p.y-61,287+reach,p.y-53);},null,'#f4e6c4',3);}
      if(p.dash>0){ctx.save();ctx.globalAlpha=.5;for(let i=0;i<5;i++)path(c=>{c.moveTo(212-i*11,p.y-15-i*10);c.lineTo(162-i*15,p.y-15-i*10);},null,'#e9f2ad',2);ctx.restore();}
      boar(250,p.y,game.time,.7,p.dash>0,!p.grounded);
      for(const part of particles){ctx.save();ctx.globalAlpha=Math.min(1,part.life/part.max*1.5);ctx.translate(part.x-d,part.y);ctx.rotate(part.angle||0);ctx.fillStyle=part.color;ctx.fillRect(-part.size/2,-part.size/2,part.size,part.size);ctx.restore();}
      for(const pop of popups){ctx.save();ctx.globalAlpha=Math.min(1,pop.life*2);ctx.font='600 24px Outfit, sans-serif';ctx.textAlign='center';ctx.strokeStyle='#f6f6d9';ctx.lineWidth=4;ctx.strokeText(pop.text,pop.x-d,pop.y);ctx.fillStyle='#315d36';ctx.fillText(pop.text,pop.x-d,pop.y);ctx.restore();}
      if(flash>0){ctx.globalAlpha=flash*2;ctx.fillStyle='#fffce1';ctx.fillRect(0,view.top+viewY,view.width,view.height);ctx.globalAlpha=1;}
    }
    ctx.restore();
  }
  function frame(now){
    const dt=Math.min((now-previous)/1000||0,0.05);previous=now;
    if(game.state!=='paused'){clock+=dt;if(game.state==='running'){accumulator+=dt;while(accumulator>=1/120){game.update(1/120);for(const e of game.events)burst(e);if(game.player.dash>0&&!reducedMotion&&Math.random()<.35)ghosts.push({x:game.player.x,y:game.player.y,life:.22});accumulator-=1/120;if(game.state!=='running'){accumulator=0;break;}}}animateEffects(dt);}
    if(game.state!=='paused')viewY+=(Math.min(0,game.player.y-Math.max(190,view.safeFeet))*(game.state==='ready'?0:1)-viewY)*Math.min(1,dt*7);
    updateUI();if(game.state!=='paused'||paintNeeded){render();paintNeeded=false;}requestAnimationFrame(frame);
  }
  updateUI();resizeCanvas();requestAnimationFrame(frame);
})();
