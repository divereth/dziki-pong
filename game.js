
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('board'), ctx = canvas.getContext('2d'), court = $('court');
  canvas.tabIndex = 0;
  const W = 1000, H = 510, PW = 15, PH = 94, R = 9, LX = 30, RX = W - 30 - PW;
  const MAX_SPEED = 1150, PADDLE_ACCELERATION = 1.14;
  const KEYBOARD_SPEED = 560, POINTER_SPEED = 1275, COMPUTER_SPEED = 450;
  const obstacles = [
    { x: W/2, y: 95, radius: 26, color: '#ff9a62' },
    { x: W/2, y: H/2, radius: 30, color: '#55f1ed', splitter: true },
    { x: W/2, y: H-95, radius: 26, color: '#ff9a62' },
  ];
  function makeBall(x, y, vx, vy, color = '#fffcd9') {
    return { x, y, vx, vy, color, trail: [] };
  }
  const state = { mode: 'ready', twoPlayer: false, cpu: 0, human: 0, left: (H-PH)/2, right: (H-PH)/2,
    balls: [makeBall(W/2+90,H/2,0,0)], splitUsed: false,
    delay: 0, aiTimer: 0, aiTarget: H/2, rally: 0, time: 0 };
  const keys = new Set(), particles = [];
  const controls = {
    left: { target: null, pointerId: null, velocity: 0 },
    right: { target: null, pointerId: null, velocity: 0 },
  };
  const touchSides = new Map();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let soundOn = false, audio, previous = 0, accumulator = 0;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const leftName = () => state.twoPlayer ? 'Gracz 1' : 'Komputer';
  const rightName = () => state.twoPlayer ? 'Gracz 2' : 'Ty';

  function setMode(twoPlayer) {
    state.twoPlayer=twoPlayer;
    $('left-name').textContent=leftName().toUpperCase();
    $('right-name').textContent=rightName().toUpperCase();
    $('left-detail').textContent=twoPlayer ? 'Lewa · klawiatura / dotyk' : 'Lewa strona · CPU';
    $('right-detail').textContent=twoPlayer ? 'Prawa · mysz / dotyk' : 'Prawa strona · gracz';
    $('left-court-label').textContent=twoPlayer ? 'DOTYK / GRACZ 1' : 'CPU / 01';
    $('right-court-label').textContent=twoPlayer ? 'DOTYK / GRACZ 2' : 'PLAYER / 02';


    canvas.setAttribute('aria-label',twoPlayer
      ? 'Gracz 1: W i S lub dotyk lewej połowy planszy. Gracz 2: strzałki góra/dół, mysz lub dotyk prawej połowy. Możecie dotykać obu połówek jednocześnie.'
      : 'Komputer po lewej. Twoja platforma po prawej: strzałki góra/dół, mysz lub dotyk.');
    start();
    state.mode='ready';
    $('round-message').textContent='';$('status').textContent='Czekamy na pierwszy serwis';$('pause').disabled=true;
    overlay(twoPlayer ? 'Pojedynek we dwoje.' : 'Rozkręć ten mecz.',twoPlayer
      ? 'Dotykajcie swojej połowy planszy — możecie grać dwoma palcami jednocześnie. Gracz 1 może też używać klawiatury, a gracz 2 myszy.'
      : 'Sterujesz limonkową platformą po prawej. Zdobądź 10 punktów i pokonaj komputer.', 'Gramy! ↗','GOTOWY NA ODBICIE?');
  }

  function tone(freq, length = .07, type = 'sine') {
    if (!soundOn || !audio) return;
    const oscillator = audio.createOscillator(), volume = audio.createGain();
    oscillator.type = type; oscillator.frequency.value = freq;
    volume.gain.setValueAtTime(.045, audio.currentTime);
    volume.gain.exponentialRampToValueAtTime(.001, audio.currentTime + length);
    oscillator.connect(volume); volume.connect(audio.destination);
    oscillator.start(); oscillator.stop(audio.currentTime + length);
  }
  function burst(x, y, color, count = 12) {
    if (reducedMotion) return;
    for (let i=0; i<count; i++) {
      const angle = Math.random()*Math.PI*2, speed = 50+Math.random()*190;
      particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:.5,color});
    }
  }
  function scores() {
    $('cpu-score').textContent = state.cpu; $('human-score').textContent = state.human;
    $('announcement').textContent = `${leftName()} ${state.cpu}, ${rightName()} ${state.human}.`;
  }
  function serve(direction) {
    const angle = Math.random()*.7-.35;
    // Start outside the splitter so a new serve never activates it automatically.
    state.balls = [makeBall(W/2+direction*90,H/2,direction*420*Math.cos(angle),420*Math.sin(angle))];
    state.delay = 1; state.rally = 0; state.splitUsed = false;
  }
  function start() {
    state.cpu = state.human = 0; state.left = state.right = (H-PH)/2;
    state.mode = 'playing'; state.aiTimer = 0; resetControls();
    particles.length = 0; keys.clear(); scores();
    $('overlay').hidden = true; $('pause').disabled = false; $('pause').textContent = 'Ⅱ Pauza';
    $('status').textContent = 'Gramy! Mecz do 10 punktów'; $('round-message').textContent = 'Pierwszy serwis!';
    serve(Math.random()>.5 ? 1 : -1);
    canvas.focus({preventScroll:true});
  }
  function overlay(title, description, button, eyebrow) {
    $('overlay-title').textContent = title; $('overlay-description').textContent = description;
    $('eyebrow').textContent = eyebrow; $('play').textContent = button; $('overlay').hidden = false;
  }
  function pause() {
    if (state.mode !== 'playing' && state.mode !== 'paused') return;
    if (state.mode === 'playing') {
      state.mode = 'paused'; resetControls();
      overlay('Krótka przerwa.', 'Piłka poczeka. Wróć, kiedy będziesz gotowy.', 'Wracam do gry ↗', 'CZAS NA ODDECH');
      $('status').textContent = 'Mecz wstrzymany'; $('pause').textContent = '▶ Wznów';
    } else {
      state.mode = 'playing'; $('overlay').hidden = true;
      $('status').textContent = 'Gramy! Mecz do 10 punktów'; $('pause').textContent = 'Ⅱ Pauza';
      canvas.focus({preventScroll:true});
    }
  }
  function point(who) {
    state[who]++; scores(); tone(who === 'human' ? 740 : 180,.2,'triangle');
    if (state[who] === 10) {
      state.mode = 'ended'; $('pause').disabled = true; $('round-message').textContent = '';
      resetControls();
      const humanWon = who === 'human';
      const winner=humanWon ? rightName() : leftName();
      const title=state.twoPlayer ? `${winner} wygrywa!` : humanWon ? 'Dzikie zwycięstwo!' : 'Komputer wygrywa.';
      overlay(title, `${leftName()} ${state.cpu} : ${state.human} ${rightName()}. Czas na rewanż?`, 'Gramy rewanż! ↗', 'KONIEC MECZU');
      $('status').textContent = `${winner} — zwycięstwo! 10 punktów.`;
      $('announcement').textContent += ` ${title}`;
      $('play').focus({preventScroll:true});
    }
  }
  function bounce(b, paddleY, direction) {
    const hit = clamp((b.y-(paddleY+PH/2))/(PH/2),-1,1);
    const speed = Math.min(MAX_SPEED, Math.hypot(b.vx,b.vy)*PADDLE_ACCELERATION);
    b.vx = direction*speed*Math.cos(hit*1.03); b.vy = speed*Math.sin(hit*1.03);
    state.rally++; burst(b.x,b.y,direction>0 ? '#ff9a62' : '#d7ff3f'); tone(direction>0 ? 340 : 520);
  }
  function hitObstacle(b, obstacle) {
    const dx=b.x-obstacle.x, dy=b.y-obstacle.y, distance=Math.hypot(dx,dy);
    const contact=obstacle.radius+R;
    if(distance>contact) return;
    const nx=distance>0 ? dx/distance : 1, ny=distance>0 ? dy/distance : 0;
    b.x=obstacle.x+nx*(contact+.1); b.y=obstacle.y+ny*(contact+.1);
    const approach=b.vx*nx+b.vy*ny;
    if(approach>=0) return;
    b.vx-=2*approach*nx; b.vy-=2*approach*ny;
    burst(b.x,b.y,obstacle.color); tone(obstacle.splitter ? 850 : 440);
    if(!obstacle.splitter || state.splitUsed) return;
    state.splitUsed=true;
    const speed=Math.hypot(b.vx,b.vy), angle=Math.atan2(b.vy,b.vx), spread=.28;
    const tx=-ny, ty=nx, separation=R+2;
    b.x+=tx*separation; b.y+=ty*separation;
    b.vx=Math.cos(angle+spread)*speed; b.vy=Math.sin(angle+spread)*speed;
    b.trail=[];
    const copy=makeBall(obstacle.x+nx*(contact+.1)-tx*separation,
      obstacle.y+ny*(contact+.1)-ty*separation,
      Math.cos(angle-spread)*speed,Math.sin(angle-spread)*speed,'#55f1ed');
    state.balls.push(copy);
    $('status').textContent='Dwie piłki! Każda daje osobny punkt';
    $('announcement').textContent='Rozdwojenie! Na planszy są teraz dwie piłki.';
    burst(obstacle.x,obstacle.y,obstacle.color,24);
  }
  function update(dt) {
    if (state.mode !== 'playing') return;
    state.time += dt;
    for (let i=particles.length-1;i>=0;i--) {
      const p=particles[i]; p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt;
      if(p.life<=0) particles.splice(i,1);
    }
    const leftMovement = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0);
    const rightMovement = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0);
    if(state.twoPlayer) {
      movePlayer('left',leftMovement,dt);
      movePlayer('right',rightMovement,dt);
    } else {
      movePlayer('right',rightMovement,dt);
    }
    if(!state.twoPlayer) {
    state.aiTimer -= dt;
    if (state.aiTimer<=0) {
      state.aiTimer = .14;
      const threat=state.balls.filter(b=>b.vx<0)
        .sort((a,b)=>(a.x-LX-PW)/-a.vx-(b.x-LX-PW)/-b.vx)[0];
      state.aiTarget = threat ? threat.y+Math.sin(state.time*2.7)*24 : H/2;
    }
    const aiDistance = state.aiTarget-(state.left+PH/2);
    if (Math.abs(aiDistance)>9) state.left += clamp(aiDistance,-COMPUTER_SPEED*dt,COMPUTER_SPEED*dt);
    state.left = clamp(state.left,0,H-PH);
    }
    if (state.delay>0) {
      state.delay -= dt;
      if (state.delay<=0) $('round-message').textContent = '';
      return;
    }
    // Substeps keep fast balls from passing through small obstacles or paddles.
    const steps=Math.ceil(dt*240), step=dt/steps;
    for(let s=0;s<steps;s++) {
      for(const b of [...state.balls]) {
        const oldX=b.x;
        b.x+=b.vx*step; b.y+=b.vy*step;
        if(b.y-R<=0 && b.vy<0){b.y=R;b.vy*=-1;burst(b.x,b.y,'#beb2ff',7);tone(260);}
        if(b.y+R>=H && b.vy>0){b.y=H-R;b.vy*=-1;burst(b.x,b.y,'#beb2ff',7);tone(260);}
        if(b.vx<0 && oldX-R>=LX+PW && b.x-R<=LX+PW && b.y+R>=state.left && b.y-R<=state.left+PH){
          b.x=LX+PW+R;bounce(b,state.left,1);
        }else if(b.vx>0 && oldX+R<=RX && b.x+R>=RX && b.y+R>=state.right && b.y-R<=state.right+PH){
          b.x=RX-R;bounce(b,state.right,-1);
        }
        for(const obstacle of obstacles) hitObstacle(b,obstacle);
        if(b.x-R<=0 || b.x+R>=W){
          const who=b.x-R<=0 ? 'human' : 'cpu';
          state.balls=state.balls.filter(active=>active!==b);
          point(who);
          if(state.mode==='ended') return;
          if(state.balls.length===0){
            $('round-message').textContent=`${who==='human' ? rightName() : leftName()} +1`;
            $('status').textContent='Gramy! Mecz do 10 punktów';
            serve(who==='human' ? -1 : 1);return;
          }
          $('status').textContent='Punkt! Druga piłka nadal w grze';
        }
      }
    }
    if(!reducedMotion) for(const b of state.balls){
      b.trail.unshift({x:b.x,y:b.y});if(b.trail.length>15)b.trail.pop();
    }
  }
  function rounded(x,y,w,h,r,color) {
    ctx.fillStyle=color; ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fill();
  }
  function render() {
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#3d8f5a'; ctx.fillRect(0,0,W,H);
    const shade=ctx.createLinearGradient(0,0,W,H); shade.addColorStop(0,'#8b65e040'); shade.addColorStop(1,'#3422a440'); ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#c9b6ff12';ctx.lineWidth=1;
    ctx.beginPath();for(let x=0;x<W;x+=40){ctx.moveTo(x,0);ctx.lineTo(x,H);}for(let y=15;y<H;y+=40){ctx.moveTo(0,y);ctx.lineTo(W,y);}ctx.stroke();
    ctx.strokeStyle='#d7c9ff55';ctx.lineWidth=2;ctx.setLineDash([10,13]);ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke();ctx.setLineDash([]);
    ctx.strokeStyle='#d7c9ff29';ctx.beginPath();ctx.arc(W/2,H/2,65,0,Math.PI*2);ctx.stroke();
    for(const obstacle of obstacles){
      const used=obstacle.splitter && state.splitUsed;
      ctx.fillStyle='#30236970';ctx.beginPath();ctx.arc(obstacle.x+4,obstacle.y+5,obstacle.radius,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=used ? '#9385ba' : obstacle.color;
      ctx.beginPath();ctx.arc(obstacle.x,obstacle.y,obstacle.radius,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=used ? '#b5a9d0' : '#fff9';ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle='#302369';ctx.font='900 20px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(obstacle.splitter ? (used ? '✓' : '×2') : '↔',obstacle.x,obstacle.y+1);
    }
    ctx.fillStyle='#bcaaff';ctx.fillRect(0,0,W,3);ctx.fillRect(0,H-3,W,3);
    rounded(LX+4,state.left+5,PW,PH,6,'#30236960');rounded(RX+4,state.right+5,PW,PH,6,'#30236960');
    rounded(LX,state.left,PW,PH,6,'#ff9a62');rounded(RX,state.right,PW,PH,6,'#d7ff3f');
    rounded(LX+4,state.left+13,3,PH-26,2,'#ffc6a0');rounded(RX+4,state.right+13,3,PH-26,2,'#edffab');
    for(const b of state.balls){
      if(state.delay<=0)b.trail.forEach((p,i)=>{ctx.globalAlpha=(1-i/b.trail.length)*.22;ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(p.x,p.y,R*(1-i/20),0,Math.PI*2);ctx.fill();});
      ctx.globalAlpha=1;ctx.shadowColor=b.color;ctx.shadowBlur=15;ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(b.x,b.y,R,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    }
    for(const p of particles){ctx.globalAlpha=p.life*2;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);}ctx.globalAlpha=1;
  }
  function resize() {
    const rect = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1,2);
    canvas.width = Math.round(rect.width*dpr); canvas.height = Math.round(rect.height*dpr);
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0); render();
  }
  function frame(time) {
    accumulator += Math.min((time-previous)/1000 || 0,.05); previous=time;
    while (accumulator>=1/120) { update(1/120); accumulator-=1/120; }
    render(); requestAnimationFrame(frame);
  }
  const fullscreenButton = $('fullscreen');
  const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  function updateFullscreenButton() {
    const active = Boolean(fullscreenElement());
    fullscreenButton.setAttribute('aria-pressed', String(active));
    fullscreenButton.setAttribute('aria-label', active ? 'Wyłącz pełny ekran' : 'Włącz pełny ekran');
    fullscreenButton.querySelector('span').textContent = active ? 'Wyjdź z pełnego ekranu' : 'Pełny ekran';
  }
  async function toggleFullscreen() {
    try {
      if (fullscreenElement()) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } else {
        const root = document.documentElement;
        if (root.requestFullscreen) await root.requestFullscreen();
        else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
        else $('status').textContent = 'Pełny ekran niedostępny w tej przeglądarce';
      }
    } catch {
      $('status').textContent = 'Nie udało się włączyć pełnego ekranu';
    }
    updateFullscreenButton();
  }
  fullscreenButton.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', updateFullscreenButton);
  document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
  updateFullscreenButton();
  $('play').addEventListener('click',()=>state.mode==='paused' ? pause() : start());
  $('game-mode').addEventListener('change',event=>setMode(event.target.value==='duo'));
  $('restart').addEventListener('click',start); $('pause').addEventListener('click',pause);
  $('sound').addEventListener('click',()=>{
    if(!audio) { const Audio = window.AudioContext || window.webkitAudioContext; if(!Audio) return; audio=new Audio(); }
    audio.resume(); soundOn=!soundOn; $('sound').setAttribute('aria-pressed',String(soundOn));
    $('sound').setAttribute('aria-label',soundOn ? 'Wyłącz dźwięk' : 'Włącz dźwięk');
    $('sound').querySelector('span').textContent=soundOn ? 'Dźwięk: wł.' : 'Dźwięk: wył.'; tone(620);
  });
  window.addEventListener('keydown',event=>{
    if(['SELECT','INPUT','TEXTAREA'].includes(event.target.tagName))return;
    const key=event.key.length===1 ? event.key.toLowerCase() : event.key;
    if(['ArrowUp','ArrowDown','w','s'].includes(key)){event.preventDefault();keys.add(key);}
    if(event.code==='Space' && event.target.tagName!=='BUTTON') {event.preventDefault();if(!event.repeat){if(state.mode==='ready'||state.mode==='ended')start();else pause();}}
    if(event.key==='Escape' && state.mode==='playing')pause();
  });
  window.addEventListener('keyup',event=>keys.delete(event.key.length===1 ? event.key.toLowerCase() : event.key));
  function resetControls() {
    keys.clear();
    const captured=[...touchSides.keys()];
    touchSides.clear();
    for(const control of Object.values(controls)) {
      control.target=null;control.pointerId=null;control.velocity=0;
    }
    for(const id of captured)if(court.hasPointerCapture(id))court.releasePointerCapture(id);
  }
  function movePlayer(side, movement, dt) {
    const control=controls[side];
    const touching=control.pointerId!==null;
    if(movement && !touching)control.target=null;
    if(control.target!==null) {
      // An active finger owns its paddle; keyboard and mouse cannot fight it.
      control.velocity=0;
      state[side]+=clamp(control.target-PH/2-state[side],-POINTER_SPEED*dt,POINTER_SPEED*dt);
    } else {
      const desired=movement*KEYBOARD_SPEED, oldVelocity=control.velocity;
      const rate=!movement ? 42 : oldVelocity*desired<0 ? 28 : 16;
      const decay=Math.exp(-rate*dt);
      control.velocity=desired+(oldVelocity-desired)*decay;
      // Exact integration of exponential easing makes short taps consistent.
      state[side]+=desired*dt+(oldVelocity-desired)*(1-decay)/rate;
      if(!movement && Math.abs(control.velocity)<2)control.velocity=0;
    }
    state[side]=clamp(state[side],0,H-PH);
    if((state[side]===0 && control.velocity<0) || (state[side]===H-PH && control.velocity>0))control.velocity=0;
  }
  function beginPointer(event) {
    if(state.mode!=='playing' || event.target.closest('button'))return;
    if(event.pointerType==='touch' || event.pointerType==='pen') {
      const rect=canvas.getBoundingClientRect();
      const side=state.twoPlayer && event.clientX<rect.left+rect.width/2 ? 'left' : 'right';
      // Keep each finger attached to its starting half even if it crosses the line.
      if(controls[side].pointerId!==null)return;
      touchSides.set(event.pointerId,side);
      controls[side].pointerId=event.pointerId;
      controls[side].velocity=0;
      court.setPointerCapture(event.pointerId);
    }
    event.preventDefault();canvas.focus({preventScroll:true});movePointer(event);
  }
  function movePointer(event) {
    if(state.mode!=='playing')return;
    const contact=event.pointerType==='touch' || event.pointerType==='pen';
    const side=contact ? touchSides.get(event.pointerId) : 'right';
    if(!side || (!contact && controls[side].pointerId!==null))return;
    const rect=canvas.getBoundingClientRect();
    controls[side].target=clamp((event.clientY-rect.top)/rect.height*H,0,H);
  }
  function endPointer(event) {
    const side=touchSides.get(event.pointerId);
    if(!side)return;
    touchSides.delete(event.pointerId);
    controls[side].target=null;controls[side].pointerId=null;controls[side].velocity=0;
    if(court.hasPointerCapture(event.pointerId))court.releasePointerCapture(event.pointerId);
  }
  court.addEventListener('pointerdown',beginPointer);
  court.addEventListener('pointermove',movePointer);
  court.addEventListener('pointerup',endPointer);
  court.addEventListener('pointercancel',endPointer);
  court.addEventListener('lostpointercapture',endPointer);
  window.addEventListener('blur',()=>{if(state.mode==='playing')pause();else resetControls();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden && state.mode==='playing')pause();});
  new ResizeObserver(resize).observe(court); resize(); requestAnimationFrame(frame);
})();

