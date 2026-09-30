
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('board'), ctx = canvas.getContext('2d'), court = $('court');
  canvas.tabIndex = 0;
  const W = 1000, H = 510, PW = 15, PH = 94, PR = 6, R = 9, LX = 90, RX = W - 90 - PW;
  const BARRIER_HEIGHT = H, BARRIER_WIDTH = 10, BARRIER_GAP = 24;
  const courtBackground = document.createElement('canvas');
  const backgroundCtx = courtBackground.getContext('2d');
  const SERVE_SPEED = 420, MAX_SPEED = 1150, PADDLE_ACCELERATION = 1.075;
  const KEYBOARD_SPEED = 560, POINTER_SPEED = 1275, COMPUTER_SPEED = 450;
  const MIN_BALL_SCALE = .2, MAX_BALL_SCALE = 5, BALL_SIZE_CHANGE = 1.5;
  const obstacles = [];
  const SHAPES = ['circle', 'square', 'diamond', 'triangle', 'hexagon'];
  const SHAPE_SIDES = { square: 4, diamond: 4, triangle: 3, hexagon: 6 };
  const OBSTACLE_COLORS = { bumper: '#ff9a62', splitter: '#55f1ed', freezer: '#8fe8ff', fireball: '#ff6848', grower: '#d7ff3f', shrinker: '#c6a7ff', blackhole: '#21172f' };
  const MAX_SPLITTERS = 2, BLACK_HOLE_HOLD_TIME = 2, FROZEN_SPEED = .58, FIREBALL_SPEED = 1.5;
  const PADDLE_EFFECT_DURATION = 30, PADDLE_FROZEN_SPEED = .4;
  function makeBall(x, y, vx, vy) {
    return { x, y, vx, vy, sizeScale: 1, trail: [], effect: null };
  }
  function ballRadius(ball) { return R * ball.sizeScale; }
  function ballColor(ball) {
    const red = clamp((Math.hypot(ball.vx, ball.vy)-SERVE_SPEED)/(MAX_SPEED-SERVE_SPEED),0,1);
    return `hsl(${51*(1-red)} 100% 50%)`;
  }
  const state = { mode: 'ready', twoPlayer: false, cpu: 0, human: 0, left: (H-PH)/2, right: (H-PH)/2,
    balls: [makeBall(W/2+90,H/2,0,0)], splitUsed: false, paddleEffects: { left: null, right: null },
    barriers: { left: false, right: false },
    delay: 0, aiTimer: 0, aiTarget: H/2, rally: 0, time: 0 };
  const keys = new Set(), particles = [];
  const controls = {
    left: { target: null, pointerId: null, velocity: 0 },
    right: { target: null, pointerId: null, velocity: 0 },
  };
  const touchSides = new Map();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let soundOn = true, audio, previous = 0, accumulator = 0;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const leftName = () => state.twoPlayer ? 'Lewy' : 'Komputer';
  const rightName = () => state.twoPlayer ? 'Prawy' : 'Ty';
  function paddleEffectStrength(side) {
    const effect=state.paddleEffects[side];
    return effect ? 1-clamp(effect.elapsed/PADDLE_EFFECT_DURATION,0,1) : 0;
  }
  function paddleSpeedScale(side) {
    const effect=state.paddleEffects[side], strength=paddleEffectStrength(side);
    if (!effect) return 1;
    return effect.type==='frozen' ? 1-(1-PADDLE_FROZEN_SPEED)*strength : 1+strength;
  }
  function mixColor(base, effect, strength) {
    const channels=color=>[1,3,5].map(index=>parseInt(color.slice(index,index+2),16));
    const from=channels(base), to=channels(effect);
    return `#${from.map((channel,index)=>Math.round(channel+(to[index]-channel)*strength).toString(16).padStart(2,'0')).join('')}`;
  }
  function applyBallEffect(ball, effect) {
    if (ball.effect===effect) return false;
    let speed=Math.hypot(ball.vx,ball.vy);
    if (ball.effect==='frozen') speed/=FROZEN_SPEED;
    else if (ball.effect==='fireball') speed*=FROZEN_SPEED;
    speed=Math.min(MAX_SPEED,speed*(effect==='frozen' ? FROZEN_SPEED : FIREBALL_SPEED));
    const angle=Math.atan2(ball.vy,ball.vx);
    ball.vx=Math.cos(angle)*speed; ball.vy=Math.sin(angle)*speed; ball.effect=effect;
    return true;
  }

  function prepareAudio() {
    if (!audio) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return false;
      audio = new Audio();
    }
    if (audio.state === 'suspended') audio.resume();
    return true;
  }

  document.addEventListener('pointerdown', prepareAudio, { once: true });
  document.addEventListener('keydown', prepareAudio, { once: true });

  function setMode(twoPlayer) {
    state.twoPlayer=twoPlayer;
    $('mode-solo').setAttribute('aria-pressed',String(!twoPlayer));
    $('mode-duo').setAttribute('aria-pressed',String(twoPlayer));
    $('left-name').textContent=twoPlayer ? 'LEWY' : 'KOMPUTER';
    $('right-name').textContent=twoPlayer ? 'PRAWY' : 'TY';
    $('left-detail').textContent=twoPlayer ? 'Lewa · klawiatura / dotyk' : 'Lewa strona · CPU';
    $('right-detail').textContent=twoPlayer ? 'Prawa · mysz / dotyk' : 'Prawa strona · gracz';
    $('left-court-label').textContent=twoPlayer ? 'DOTYK / GRACZ 1' : 'CPU / 01';
    $('right-court-label').textContent=twoPlayer ? 'DOTYK / GRACZ 2' : 'PLAYER / 02';


    canvas.setAttribute('aria-label',twoPlayer
      ? 'Gracz 1: W i S lub dotyk lewej połowy planszy, także przestrzeni za paletką. Gracz 2: strzałki góra/dół, mysz lub dotyk prawej połowy, także przestrzeni za paletką. Możecie dotykać obu połówek jednocześnie.'
      : 'Komputer po lewej. Twoja platforma po prawej: strzałki góra/dół, mysz lub dotyk; możesz dotykać przestrzeni za paletką.');
    start();
    state.mode='ready'; syncCourtCursor();
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
  function bounceSound(freq) {
    if (!soundOn || !audio) return;
    const now = audio.currentTime;
    const click = audio.createOscillator(), ring = audio.createOscillator();
    const clickVolume = audio.createGain(), ringVolume = audio.createGain();
    click.type = 'triangle'; ring.type = 'sine';
    click.frequency.setValueAtTime(freq * 1.45, now);
    click.frequency.exponentialRampToValueAtTime(freq, now + .045);
    ring.frequency.setValueAtTime(freq * .8, now);
    ring.frequency.exponentialRampToValueAtTime(freq * .45, now + .13);
    clickVolume.gain.setValueAtTime(.07, now);
    clickVolume.gain.exponentialRampToValueAtTime(.001, now + .055);
    ringVolume.gain.setValueAtTime(.035, now);
    ringVolume.gain.exponentialRampToValueAtTime(.001, now + .13);
    click.connect(clickVolume); clickVolume.connect(audio.destination);
    ring.connect(ringVolume); ringVolume.connect(audio.destination);
    click.start(now); click.stop(now + .055);
    ring.start(now); ring.stop(now + .13);
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
    // Keep serves clear of the center obstacle field.
    state.balls = [makeBall(W/2+direction*90,H/2,direction*SERVE_SPEED*Math.cos(angle),SERVE_SPEED*Math.sin(angle))];
    state.barriers.left = state.human-state.cpu >= 3;
    state.barriers.right = state.cpu-state.human >= 3;
    state.delay = 1; state.rally = 0; state.splitUsed = false;
  }
  function addObstacle() {
    const splitters = obstacles.filter(obstacle => obstacle.kind === 'splitter').length;
    const hasBlackHole = obstacles.some(obstacle => obstacle.kind === 'blackhole');
    const kinds = splitters < MAX_SPLITTERS
      ? ['bumper', 'bumper', 'splitter', 'freezer', 'fireball', 'grower', 'shrinker']
      : ['bumper', 'bumper', 'bumper', 'freezer', 'fireball', 'grower', 'shrinker'];
    if (!hasBlackHole) kinds.push('blackhole');
    const kind = kinds[Math.floor(Math.random()*kinds.length)];
    const shape = kind === 'blackhole' ? 'circle' : SHAPES[Math.floor(Math.random()*SHAPES.length)];
    const size = kind === 'blackhole' ? 30 : 25 + Math.random()*6;
    const rotation=shape==='square' ? Math.PI/4 : shape==='diamond' ? 0 : Math.random()*Math.PI*2;
    const obstacle = {
      x: 0, y: 0, size, shape, rotation,
      kind, color: OBSTACLE_COLORS[kind], vertices: null,
    };
    const servePoints = [{x: W/2-90,y:H/2},{x: W/2+90,y:H/2}];
    for (let attempt=0; attempt<120; attempt++) {
      obstacle.x = 175 + Math.random()*(W-350);
      obstacle.y = 55 + Math.random()*(H-110);
      const clearObstacles = obstacles.every(existing =>
        Math.hypot(obstacle.x-existing.x,obstacle.y-existing.y) > obstacle.size+existing.size+12);
      const clearServes = servePoints.every(point =>
        Math.hypot(obstacle.x-point.x,obstacle.y-point.y) > obstacle.size+R+12);
      const clearBalls = state.balls.every(ball =>
        Math.hypot(obstacle.x-ball.x,obstacle.y-ball.y) > obstacle.size+ballRadius(ball)+12);
      if (clearObstacles && clearServes && clearBalls) {
        obstacles.push(obstacle);
        return obstacle;
      }
    }
    // A deterministic grid fallback keeps each scheduled obstacle spawn reliable.
    for (let y=65; y<H-55; y+=70) for (let x=180; x<W-180; x+=75) {
      obstacle.x=x; obstacle.y=y;
      if (obstacles.every(existing => Math.hypot(x-existing.x,y-existing.y) > obstacle.size+existing.size+4)
        && servePoints.every(point => Math.hypot(x-point.x,y-point.y) > obstacle.size+R+4)
        && state.balls.every(ball => Math.hypot(x-ball.x,y-ball.y) > obstacle.size+ballRadius(ball)+4)) {
        obstacles.push(obstacle);
        return obstacle;
      }
    }
    // The court has ample room for the nine obstacles possible in one match.
    obstacles.push(obstacle);
    return obstacle;
  }
  function relocateBlackHole(obstacle, ignoreBall) {
    const servePoints = [{x: W/2-90,y:H/2},{x: W/2+90,y:H/2}];
    const otherObstacles = obstacles.filter(existing => existing !== obstacle);
    const otherBalls = state.balls.filter(ball => ball !== ignoreBall && !ball.capturedBy);
    const isClear = (x,y,margin) =>
      Math.hypot(x-W/2,y-H/2) > 55
      && otherObstacles.every(existing => Math.hypot(x-existing.x,y-existing.y) > obstacle.size+existing.size+margin)
      && servePoints.every(point => Math.hypot(x-point.x,y-point.y) > obstacle.size+R+margin)
      && otherBalls.every(ball => Math.hypot(x-ball.x,y-ball.y) > obstacle.size+ballRadius(ball)+margin);
    for (let attempt=0; attempt<120; attempt++) {
      const x=175+Math.random()*(W-350), y=55+Math.random()*(H-110);
      if (isClear(x,y,12)) { obstacle.x=x; obstacle.y=y; return; }
    }
    for (let y=65; y<H-55; y+=70) for (let x=180; x<W-180; x+=75) {
      if (isClear(x,y,4)) { obstacle.x=x; obstacle.y=y; return; }
    }
  }
  function start() {
    state.cpu = state.human = 0; state.left = state.right = (H-PH)/2;
    state.mode = 'playing'; syncCourtCursor(); state.aiTimer = 0; resetControls();
    obstacles.length = 0; state.paddleEffects.left = state.paddleEffects.right = null;
    particles.length = 0; keys.clear(); scores();
    $('overlay').hidden = true; $('pause').disabled = false; $('pause').querySelector('span').textContent = 'Pauza'; $('pause').setAttribute('aria-label','Wstrzymaj mecz');
    $('status').textContent = 'Gramy! Mecz do 10 punktów'; $('round-message').textContent = 'Pierwszy serwis!';
    serve(Math.random()>.5 ? 1 : -1);
    canvas.focus({preventScroll:true});
  }
  function overlay(title, description, button, eyebrow) {
    $('overlay-title').textContent = title; $('overlay-description').textContent = description;
    $('eyebrow').textContent = eyebrow; $('play').textContent = button; $('overlay').hidden = false;
  }
  function syncCourtCursor() { court.classList.toggle('is-playing', state.mode === 'playing'); }
  function pause() {
    if (state.mode !== 'playing' && state.mode !== 'paused') return;
    if (state.mode === 'playing') {
      state.mode = 'paused'; syncCourtCursor(); resetControls();
      overlay('Krótka przerwa.', 'Piłka poczeka. Wróć, kiedy będziesz gotowy.', 'Wracam do gry ↗', 'CZAS NA ODDECH');
      $('status').textContent = 'Mecz wstrzymany'; $('pause').querySelector('span').textContent = 'Wznów'; $('pause').setAttribute('aria-label','Wznów mecz');
    } else {
      state.mode = 'playing'; syncCourtCursor(); $('overlay').hidden = true;
      $('status').textContent = 'Gramy! Mecz do 10 punktów'; $('pause').querySelector('span').textContent = 'Pauza'; $('pause').setAttribute('aria-label','Wstrzymaj mecz');
      canvas.focus({preventScroll:true});
    }
  }
  function point(who) {
    state[who]++; scores(); tone(who === 'human' ? 740 : 180,.2,'triangle');
    if ((state.cpu+state.human)%2===0) {
      const obstacle=addObstacle();
      const obstacleNames = { splitter: 'rozdzielacz', freezer: 'lodowa przeszkoda', fireball: 'ognista piłka', blackhole: 'czarna dziura', grower: 'powiększacz', shrinker: 'pomniejszacz', bumper: 'odbijacz' };
      const name=obstacleNames[obstacle.kind];
      $('announcement').textContent += ` Nowa przeszkoda: ${name}.`;
    }
    if (state[who] === 10) {
      state.mode = 'ended'; syncCourtCursor(); $('pause').disabled = true; $('round-message').textContent = '';
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
    const side=direction>0 ? 'left' : 'right';
    const incomingEffect=b.effect, paddleEffect=state.paddleEffects[side];
    const paddleName=side==='left' ? state.twoPlayer ? 'gracza 1' : 'komputera' : state.twoPlayer ? 'gracza 2' : 'gracza';
    const cancels=(incomingEffect==='fireball' && paddleEffect?.type==='frozen')
      || (incomingEffect==='frozen' && paddleEffect?.type==='fireball');
    const speed = incomingEffect==='frozen' ? SERVE_SPEED : Math.min(MAX_SPEED, Math.hypot(b.vx,b.vy)*PADDLE_ACCELERATION);
    b.vx = direction*speed*Math.cos(hit*1.03); b.vy = speed*Math.sin(hit*1.03);
    if (cancels) {
      state.paddleEffects[side]=null;
      $('status').textContent=`Platforma ${paddleName} wróciła do naturalnej formy`;
      $('announcement').textContent=$('status').textContent;
    } else if (incomingEffect==='frozen' || incomingEffect==='fireball') {
      state.paddleEffects[side]={type:incomingEffect,elapsed:0};
      const effectName=incomingEffect==='frozen' ? 'zamrożona' : 'podpalona';
      $('status').textContent=`Platforma ${paddleName} ${effectName} — efekt słabnie przez 30 sekund`;
      $('announcement').textContent=$('status').textContent;
    }
    b.effect=null;
    state.rally++; burst(b.x,b.y,direction>0 ? '#ff9a62' : '#d7ff3f'); bounceSound(direction>0 ? 340 : 520);
  }
  function hitPaddle(b, paddleX, paddleY, direction) {
    if (b.vx*direction>=0) return;
    const radius=ballRadius(b);
    const closestX=clamp(b.x,paddleX+PR,paddleX+PW-PR);
    const closestY=clamp(b.y,paddleY+PR,paddleY+PH-PR);
    const dx=b.x-closestX, dy=b.y-closestY, distance=Math.hypot(dx,dy);
    const contact=PR+radius;
    if(distance>contact) return;
    const nx=distance>0 ? dx/distance : direction, ny=distance>0 ? dy/distance : 0;
    if(b.vx*nx+b.vy*ny>=0) return;
    b.x=closestX+nx*(contact+.1); b.y=closestY+ny*(contact+.1);
    bounce(b,paddleY,direction);
  }
  function barrierPosition(side) {
    const centerX = side==='left' ? LX-BARRIER_GAP : RX+PW+BARRIER_GAP;
    const top = 0;
    return { x: centerX, top, bottom: top+BARRIER_HEIGHT };
  }
  function hitBarrier(b, side) {
    if (!state.barriers[side]) return;
    const direction = side==='left' ? 1 : -1;
    if (b.vx*direction>=0) return;
    const {x,top,bottom} = barrierPosition(side), radius = ballRadius(b);
    const crossed = direction>0
      ? b.x-radius<=x+BARRIER_WIDTH/2
      : b.x+radius>=x-BARRIER_WIDTH/2;
    if (!crossed || b.y+radius<top || b.y-radius>bottom) return;
    const hit = clamp((b.y-(top+BARRIER_HEIGHT/2))/(BARRIER_HEIGHT/2),-1,1);
    const speed = Math.min(MAX_SPEED,Math.hypot(b.vx,b.vy)*PADDLE_ACCELERATION);
    b.x=x+direction*(BARRIER_WIDTH/2+radius+.1);
    b.vx=direction*speed*Math.cos(hit*.8); b.vy=speed*Math.sin(hit*.8);
    state.barriers[side]=false;
    state.rally++;
    burst(b.x,b.y,'#a8f3ff'); bounceSound(side==='left' ? 340 : 520);
    $('status').textContent='Bariera ochronna odbiła piłkę!';
    $('announcement').textContent=$('status').textContent;
  }
  function obstacleVertices(obstacle) {
    const sides=SHAPE_SIDES[obstacle.shape];
    if (!sides) return null;
    if (obstacle.vertices) return obstacle.vertices;
    obstacle.vertices=Array.from({length:sides},(_,index)=>{
      const angle=obstacle.rotation+index*Math.PI*2/sides;
      return {x:obstacle.x+Math.cos(angle)*obstacle.size,y:obstacle.y+Math.sin(angle)*obstacle.size};
    });
    return obstacle.vertices;
  }
  function obstacleContact(b, obstacle) {
    const radius=ballRadius(b);
    const dx=b.x-obstacle.x, dy=b.y-obstacle.y, contact=obstacle.size+radius;
    if (dx*dx+dy*dy>contact*contact) return null;
    if (obstacle.shape==='circle') {
      const distance=Math.hypot(dx,dy);
      const nx=distance>0 ? dx/distance : 1, ny=distance>0 ? dy/distance : 0;
      return {x:obstacle.x+nx*obstacle.size,y:obstacle.y+ny*obstacle.size,nx,ny};
    }
    const vertices=obstacleVertices(obstacle);
    let nearest=null, nearestDistance=Infinity, area=0, inside=false;
    for (let i=0,j=vertices.length-1;i<vertices.length;j=i++) {
      const a=vertices[j], c=vertices[i], dx=c.x-a.x, dy=c.y-a.y;
      const lengthSquared=dx*dx+dy*dy;
      const projection=clamp(((b.x-a.x)*dx+(b.y-a.y)*dy)/lengthSquared,0,1);
      const x=a.x+projection*dx, y=a.y+projection*dy, distance=Math.hypot(b.x-x,b.y-y);
      if (distance<nearestDistance) nearest={x,y,dx,dy,distance}, nearestDistance=distance;
      area+=a.x*c.y-c.x*a.y;
      if ((a.y>b.y)!==(c.y>b.y) && b.x<(c.x-a.x)*(b.y-a.y)/(c.y-a.y)+a.x) inside=!inside;
    }
    if (!inside && nearestDistance>radius) return null;
    const outward=area>=0 ? {x:nearest.dy,y:-nearest.dx} : {x:-nearest.dy,y:nearest.dx};
    const length=Math.hypot(outward.x,outward.y);
    const nx=inside || nearestDistance===0 ? outward.x/length : (b.x-nearest.x)/nearestDistance;
    const ny=inside || nearestDistance===0 ? outward.y/length : (b.y-nearest.y)/nearestDistance;
    return {x:nearest.x,y:nearest.y,nx,ny};
  }
  function hitObstacle(b, obstacle) {
    if (obstacle.kind==='blackhole') return;
    const contact=obstacleContact(b,obstacle);
    if (!contact) return;
    const {nx,ny}=contact;
    const approach=b.vx*nx+b.vy*ny;
    if(approach>=0) return;
    b.vx-=2*approach*nx; b.vy-=2*approach*ny;
    if (obstacle.kind==='grower' || obstacle.kind==='shrinker') {
      const change=obstacle.kind==='grower' ? BALL_SIZE_CHANGE : 1/BALL_SIZE_CHANGE;
      b.sizeScale=clamp(b.sizeScale*change,MIN_BALL_SCALE,MAX_BALL_SCALE);
      $('status').textContent=obstacle.kind==='grower' ? 'Piłka powiększona!' : 'Piłka pomniejszona!';
      $('announcement').textContent=$('status').textContent;
    }
    const radius=ballRadius(b);
    b.x=contact.x+nx*(radius+.1); b.y=contact.y+ny*(radius+.1);
    burst(b.x,b.y,obstacle.color); bounceSound(obstacle.kind==='splitter' ? 850 : 440);
    if (obstacle.kind==='freezer' && applyBallEffect(b,'frozen')) {
      $('status').textContent='Piłka spowolniona! Odbij ją od platformy, by ją zamrozić';
      $('announcement').textContent=$('status').textContent;
    } else if (obstacle.kind==='fireball' && applyBallEffect(b,'fireball')) {
      $('status').textContent='Ognista piłka przyspieszona! Odbij ją od platformy, by podpalić paletkę';
      $('announcement').textContent=$('status').textContent;
    }
    if(obstacle.kind!=='splitter' || state.splitUsed) return;
    state.splitUsed=true;
    const speed=Math.hypot(b.vx,b.vy), angle=Math.atan2(b.vy,b.vx), spread=.28;
    const tx=-ny, ty=nx, separation=ballRadius(b)+2;
    const contactX=b.x, contactY=b.y;
    b.x+=tx*separation; b.y+=ty*separation;
    b.vx=Math.cos(angle+spread)*speed; b.vy=Math.sin(angle+spread)*speed;
    b.trail=[];
    const copy=makeBall(contactX-tx*separation,contactY-ty*separation,
      Math.cos(angle-spread)*speed,Math.sin(angle-spread)*speed);
    copy.effect=b.effect; copy.sizeScale=b.sizeScale;
    state.balls.push(copy);
    $('status').textContent='Dwie piłki! Każda daje osobny punkt';
    $('announcement').textContent='Rozdwojenie! Na planszy są teraz dwie piłki.';
    burst(obstacle.x,obstacle.y,obstacle.color,24);
  }
  function captureInBlackHole(b, obstacle) {
    if (obstacle.occupied || Math.hypot(b.x-obstacle.x,b.y-obstacle.y)>obstacle.size*.4+ballRadius(b)) return false;
    obstacle.occupied=true;
    b.capturedBy=obstacle; b.captureTime=BLACK_HOLE_HOLD_TIME;
    b.x=obstacle.x; b.y=obstacle.y; b.vx=b.vy=0; b.trail=[];
    $('status').textContent='Piłka wpadła do czarnej dziury!';
    $('announcement').textContent='Piłka wpadła do czarnej dziury i wróci za chwilę.';
    tone(120,.18,'sine');
    return true;
  }
  function pullTowardBlackHole(b, obstacle, dt) {
    if (obstacle.kind!=='blackhole' || obstacle.occupied) return;
    const dx=obstacle.x-b.x, dy=obstacle.y-b.y, distance=Math.hypot(dx,dy);
    if (distance<=obstacle.size*.4) return;
    const range=obstacle.size*3.5*1.5;
    if (distance>=range) return;
    const acceleration=2250*(1-distance/range);
    b.vx+=dx/distance*acceleration*dt; b.vy+=dy/distance*acceleration*dt;
    const speed=Math.hypot(b.vx,b.vy);
    if(speed>MAX_SPEED){b.vx*=MAX_SPEED/speed;b.vy*=MAX_SPEED/speed;}
  }
  function releaseFromBlackHole(b) {
    const obstacle=b.capturedBy, startX=obstacle.x, startY=obstacle.y;
    let dx=W/2-startX, dy=H/2-startY, distance=Math.hypot(dx,dy);
    if (distance===0) { dx=1; dy=0; distance=1; }
    const ux=dx/distance, uy=dy/distance;
    obstacle.occupied=false;
    relocateBlackHole(obstacle,b);
    b.capturedBy=null; b.captureTime=0;
    b.x=startX+ux*(obstacle.size+ballRadius(b)+2); b.y=startY+uy*(obstacle.size+ballRadius(b)+2);
    b.vx=ux*SERVE_SPEED*1.35; b.vy=uy*SERVE_SPEED*1.35; b.trail=[];
    burst(startX,startY,obstacle.color,24); burst(obstacle.x,obstacle.y,obstacle.color,16);
    $('status').textContent='Piłka wystrzelona z czarnej dziury w stronę środka planszy';
    $('announcement').textContent='Czarna dziura przeniosła się w inne miejsce.';
    tone(520,.16,'triangle');
  }
  function update(dt) {
    if (state.mode !== 'playing') return;
    state.time += dt;
    for (const side of ['left','right']) {
      const effect=state.paddleEffects[side];
      if (effect && (effect.elapsed+=dt)>=PADDLE_EFFECT_DURATION) state.paddleEffects[side]=null;
    }
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
    const aiSpeed=COMPUTER_SPEED*paddleSpeedScale('left');
    if (Math.abs(aiDistance)>9) state.left += clamp(aiDistance,-aiSpeed*dt,aiSpeed*dt);
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
        if (b.capturedBy) {
          b.captureTime-=step;
          if (b.captureTime<=0) releaseFromBlackHole(b);
          continue;
        }
        for(const obstacle of obstacles) pullTowardBlackHole(b,obstacle,step);
        b.x+=b.vx*step; b.y+=b.vy*step;
        for(const obstacle of obstacles) {
          if (obstacle.kind==='blackhole' && captureInBlackHole(b,obstacle)) break;
        }
        if (b.capturedBy) continue;
        let radius=ballRadius(b);
        if(b.y-radius<=0 && b.vy<0){b.y=radius;b.vy*=-1;burst(b.x,b.y,'#beb2ff',7);bounceSound(260);}
        if(b.y+radius>=H && b.vy>0){b.y=H-radius;b.vy*=-1;burst(b.x,b.y,'#beb2ff',7);bounceSound(260);}
        hitPaddle(b,LX,state.left,1);
        hitPaddle(b,RX,state.right,-1);
        hitBarrier(b,'left');
        hitBarrier(b,'right');
        for(const obstacle of obstacles) hitObstacle(b,obstacle);
        radius=ballRadius(b);
        if(b.x-radius<=0 || b.x+radius>=W){
          const who=b.x-radius<=0 ? 'human' : 'cpu';
          state.balls=state.balls.filter(active=>active!==b);
          point(who);
          if(state.mode==='ended') return;
          if(state.balls.length===0){
            $('round-message').textContent=`${who==='human' ? rightName() : leftName()} +1`;
            $('status').textContent='Gramy! Mecz do 10 punktów';
            serve(who==='human' ? 1 : -1);return;
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
  function drawCourtBackground() {
    courtBackground.width=canvas.width; courtBackground.height=canvas.height;
    backgroundCtx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
    backgroundCtx.fillStyle='#6250cb'; backgroundCtx.fillRect(0,0,W,H);
    const shade=backgroundCtx.createLinearGradient(0,0,W,H);
    shade.addColorStop(0,'#8b65e040'); shade.addColorStop(1,'#3422a440');
    backgroundCtx.fillStyle=shade; backgroundCtx.fillRect(0,0,W,H);
    backgroundCtx.strokeStyle='#c9b6ff12'; backgroundCtx.lineWidth=1;
    backgroundCtx.beginPath();
    for(let x=0;x<W;x+=40){backgroundCtx.moveTo(x,0);backgroundCtx.lineTo(x,H);}
    for(let y=15;y<H;y+=40){backgroundCtx.moveTo(0,y);backgroundCtx.lineTo(W,y);}
    backgroundCtx.stroke();
    backgroundCtx.strokeStyle='#d7c9ff55'; backgroundCtx.lineWidth=2;
    backgroundCtx.setLineDash([10,13]); backgroundCtx.beginPath();
    backgroundCtx.moveTo(W/2,0); backgroundCtx.lineTo(W/2,H); backgroundCtx.stroke();
    backgroundCtx.setLineDash([]);
    backgroundCtx.strokeStyle='#d7c9ff29'; backgroundCtx.beginPath();
    backgroundCtx.arc(W/2,H/2,65,0,Math.PI*2); backgroundCtx.stroke();
    backgroundCtx.fillStyle='#bcaaff'; backgroundCtx.fillRect(0,0,W,3); backgroundCtx.fillRect(0,H-3,W,3);
  }
  function obstaclePath(obstacle, offsetX=0, offsetY=0) {
    ctx.beginPath();
    if(obstacle.shape==='circle') ctx.arc(obstacle.x+offsetX,obstacle.y+offsetY,obstacle.size,0,Math.PI*2);
    else {
      const vertices=obstacleVertices(obstacle);
      ctx.moveTo(vertices[0].x+offsetX,vertices[0].y+offsetY);
      for(let i=1;i<vertices.length;i++)ctx.lineTo(vertices[i].x+offsetX,vertices[i].y+offsetY);
      ctx.closePath();
    }
  }
  function render() {
    ctx.drawImage(courtBackground,0,0,W,H);
    for(const obstacle of obstacles){
      const used=obstacle.kind==='splitter' && state.splitUsed;
      obstaclePath(obstacle,4,5);ctx.fillStyle='#30236970';ctx.fill();
      obstaclePath(obstacle);ctx.fillStyle=used ? '#9385ba' : obstacle.color;ctx.fill();
      ctx.strokeStyle=used ? '#b5a9d0' : obstacle.kind==='blackhole' ? '#c3a1ff' : '#fff9';ctx.lineWidth=obstacle.kind==='blackhole' ? 3 : 2;ctx.stroke();
      if (obstacle.kind==='blackhole') {
        ctx.beginPath();ctx.arc(obstacle.x,obstacle.y,obstacle.size*.62,0,Math.PI*2);
        ctx.strokeStyle='#ff9a62';ctx.lineWidth=2;ctx.stroke();
        ctx.beginPath();ctx.arc(obstacle.x,obstacle.y,obstacle.size*.34,0,Math.PI*2);
        ctx.fillStyle='#080711';ctx.fill();
      } else {
        ctx.fillStyle='#302369';ctx.font='900 20px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
        const symbol=obstacle.kind==='splitter' ? (used ? '✓' : '×2') : obstacle.kind==='freezer' ? '❄' : obstacle.kind==='fireball' ? '🔥' : obstacle.kind==='grower' ? '+' : obstacle.kind==='shrinker' ? '-' : '';
        if(symbol)ctx.fillText(symbol,obstacle.x,obstacle.y+1);
      }
    }
    for(const side of ['left','right']) if(state.barriers[side]) {
      const {x,top,bottom}=barrierPosition(side);
      ctx.save(); ctx.globalAlpha=.52; ctx.shadowColor='#a8f3ff'; ctx.shadowBlur=16;
      rounded(x-BARRIER_WIDTH/2,top,BARRIER_WIDTH,bottom-top,5,'#a8f3ff');
      ctx.globalAlpha=.9; ctx.shadowBlur=0;
      rounded(x-1,top+5,2,bottom-top-10,1,'#ffffff'); ctx.restore();
    }
    const leftEffect=state.paddleEffects.left, rightEffect=state.paddleEffects.right;
    const leftStrength=paddleEffectStrength('left'), rightStrength=paddleEffectStrength('right');
    const leftColor=leftEffect ? mixColor('#ff9a62',leftEffect.type==='frozen' ? '#8fe8ff' : '#ff4d32',leftStrength) : '#ff9a62';
    const rightColor=rightEffect ? mixColor('#d7ff3f',rightEffect.type==='frozen' ? '#8fe8ff' : '#ff4d32',rightStrength) : '#d7ff3f';
    const leftHighlight=leftEffect ? mixColor('#ffc6a0',leftEffect.type==='frozen' ? '#e8fbff' : '#ffe0a0',leftStrength) : '#ffc6a0';
    const rightHighlight=rightEffect ? mixColor('#edffab',rightEffect.type==='frozen' ? '#e8fbff' : '#ffe0a0',rightStrength) : '#edffab';
    rounded(LX+4,state.left+5,PW,PH,PR,'#30236960');rounded(RX+4,state.right+5,PW,PH,PR,'#30236960');
    rounded(LX,state.left,PW,PH,PR,leftColor);
    rounded(RX,state.right,PW,PH,PR,rightColor);
    rounded(LX+4,state.left+13,3,PH-26,2,leftHighlight);
    rounded(RX+4,state.right+13,3,PH-26,2,rightHighlight);
    for(const b of state.balls){
      if(b.capturedBy)continue;
      const color=ballColor(b);
      const radius=ballRadius(b);
      if(state.delay<=0)b.trail.forEach((p,i)=>{ctx.globalAlpha=(1-i/b.trail.length)*.22;ctx.fillStyle=color;ctx.beginPath();ctx.arc(p.x,p.y,radius*(1-i/20),0,Math.PI*2);ctx.fill();});
      ctx.globalAlpha=1;ctx.shadowColor=color;ctx.shadowBlur=15;ctx.fillStyle=color;ctx.beginPath();ctx.arc(b.x,b.y,radius,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
      if(b.effect==='frozen'){ctx.strokeStyle='#a8f3ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(b.x,b.y,radius+3,0,Math.PI*2);ctx.stroke();}
      if(b.effect==='fireball'){ctx.strokeStyle='#ffb05c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(b.x,b.y,radius+3,0,Math.PI*2);ctx.stroke();}
    }
    for(const p of particles){ctx.globalAlpha=p.life*2;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);}ctx.globalAlpha=1;
  }
  function resize() {
    const rect = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1,2);
    canvas.width = Math.round(rect.width*dpr); canvas.height = Math.round(rect.height*dpr);
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
    drawCourtBackground(); render();
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
  $('mode-solo').addEventListener('click',()=>setMode(false));
  $('mode-duo').addEventListener('click',()=>setMode(true));
  $('restart').addEventListener('click',start); $('pause').addEventListener('click',pause);
  $('sound').addEventListener('click',()=>{
    if(!prepareAudio()) return;
    soundOn=!soundOn; $('sound').setAttribute('aria-pressed',String(soundOn));
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
    const speedScale=paddleSpeedScale(side);
    const touching=control.pointerId!==null;
    if(movement && !touching)control.target=null;
    if(control.target!==null) {
      // An active finger owns its paddle; keyboard and mouse cannot fight it.
      control.velocity=0;
      state[side]+=clamp(control.target-PH/2-state[side],-POINTER_SPEED*speedScale*dt,POINTER_SPEED*speedScale*dt);
    } else {
      const desired=movement*KEYBOARD_SPEED, oldVelocity=control.velocity;
      const rate=!movement ? 42 : oldVelocity*desired<0 ? 28 : 16;
      const decay=Math.exp(-rate*dt);
      control.velocity=desired+(oldVelocity-desired)*decay;
      // Exact integration of exponential easing makes short taps consistent.
      state[side]+=(desired*dt+(oldVelocity-desired)*(1-decay)/rate)*speedScale;
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

