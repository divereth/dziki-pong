import {RaceEngine,beginRace,claimRaceReward,ensureRacing,saveRace,trackPoint,TRACK,PRIZES} from './racing.js';
import {RaceWorld} from './race-world.js';

const $=id=>document.getElementById(id);
const money=value=>new Intl.NumberFormat('pl-PL').format(value)+' zł';
export function raceTime(value){const ticks=Math.round(value*100),minutes=Math.floor(ticks/6000),seconds=((ticks%6000)/100).toFixed(2).padStart(5,'0');return `${minutes}:${seconds}`;}

export class RacingGame{
  constructor({world,getState,onSave,onEnter,onLeave,onCancel,isTouch=()=>false,toast=()=>{}}){
    Object.assign(this,{world,getState,onSave,onEnter,onLeave,onCancel,isTouch,toast});
    this.engine=null;this.view=null;this.paused=false;this.keys=new Set();this.touches=new Map();this.attempt=0;this.entering=false;
    this.entry=$('race-entry');this.results=$('race-results');
    $('race-enter').addEventListener('click',()=>this.enter());$('race-cancel').addEventListener('click',()=>this.cancelEntry());
    this.entry.addEventListener('cancel',event=>{event.preventDefault();this.cancelEntry();});
    this.results.addEventListener('cancel',event=>event.preventDefault());
    $('race-claim').addEventListener('click',()=>this.claim());
    $('race-pause').addEventListener('click',()=>this.paused?this.resume():this.pause());$('race-resume').addEventListener('click',()=>this.resume());
    for(const button of document.querySelectorAll('[data-race-control]')){
      button.addEventListener('pointerdown',event=>{if(!this.active||this.paused)return;event.preventDefault();this.touches.set(event.pointerId,button.dataset.raceControl);button.setPointerCapture(event.pointerId);button.classList.add('pressed');});
      for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,event=>{this.touches.delete(event.pointerId);button.classList.remove('pressed');});
    }
    document.addEventListener('keydown',event=>{
      if(!this.active||this.results.open)return;
      if(['Escape','KeyP'].includes(event.code)){event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)this.paused?this.resume():this.pause();return;}
      if(['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(event.code)){event.preventDefault();this.keys.add(event.code);}
      if(event.code!=='Tab'&&!event.code.startsWith('F'))event.stopImmediatePropagation();
    },true);
    document.addEventListener('keyup',event=>{this.keys.delete(event.code);},true);
    window.addEventListener('blur',()=>{if(this.active)this.pause();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.active)this.pause();});
    window.addEventListener('beforeunload',()=>this.persist());
  }
  get active(){return !!this.engine;}
  get entryOpen(){return this.entry.open;}
  hasPending(){return !!ensureRacing(this.getState()).active;}
  clearInput(){this.keys.clear();this.touches.clear();document.querySelectorAll('[data-race-control]').forEach(b=>b.classList.remove('pressed'));}
  openEntry(){
    const state=this.getState();if(this.hasPending()){this.resumePending();return;}
    $('race-entry-cash').textContent=`Twój portfel: ${money(state.cash)}`;
    $('race-entry-message').textContent=state.cash<10000?'Brakuje gotówki na wpisowe. Wróć, gdy zbierzesz 10 000 zł.':'Jedna opłata obejmuje jeden wyścig. Samochód otrzymujesz na czas zawodów.';
    $('race-enter').disabled=state.cash<10000;$('race-enter').textContent='Zapłać 10 000 zł i startuj';
    this.entry.showModal();
  }
  cancelEntry(){this.attempt++;this.entry.close();this.onCancel?.();}
  prepare(){
    this.view||=new RaceWorld(this.world.renderer,{environment:this.world.environmentTarget.texture,mobile:this.isTouch()});return this.view.load();
  }
  async enter(){
    if(this.entering)return;this.entering=true;const attempt=++this.attempt;
    $('race-enter').disabled=true;$('race-enter').textContent='Przygotowuję samochód…';
    try{
      await this.prepare();if(attempt!==this.attempt||!this.entry.open)return;
      const result=beginRace(this.getState(),Math.floor(Math.random()*0xffffffff));
      if(!result.ok){$('race-entry-message').textContent=result.message;return;}
      this.engine=new RaceEngine(result.session.snapshot);this.onSave();this.activate();this.entry.close();
    }catch(error){console.error(error);$('race-entry-message').textContent='Samochód nie wczytał się. Opłata nie została pobrana. Spróbuj ponownie.';}
    finally{this.entering=false;$('race-enter').disabled=this.getState().cash<10000;$('race-enter').textContent='Zapłać 10 000 zł i startuj';}
  }
  async resumePending(){
    if(this.active){this.resume();return true;}
    if(this.resuming)return true;
    const session=ensureRacing(this.getState()).active;if(!session)return false;
    this.resuming=true;
    try{await this.prepare();this.engine=new RaceEngine(session.snapshot);this.activate();return true;}
    catch(error){console.error(error);this.toast('Nie udało się wczytać toru. Twój wyścig jest zapisany; spróbuj ponownie.');return false;}
    finally{this.resuming=false;}
  }
  activate(){
    this.paused=false;this.clearInput();this.lastSave=this.engine.data.elapsed;this.lastHud=-1;
    document.body.classList.add('racing');$('race-hud').hidden=false;$('race-touch-controls').hidden=!this.isTouch();$('race-resume').hidden=true;
    this.onEnter();this.view.activate(this.engine);this.updateHud();
    if(this.engine.data.phase==='finished')this.showResults();
  }
  input(){
    const held=control=>[...this.touches.values()].includes(control),key=(...codes)=>codes.some(c=>this.keys.has(c));
    return {throttle:Number(held('gas')||key('KeyW','ArrowUp')),brake:Number(held('brake')||key('KeyS','ArrowDown','Space')),steer:Number(held('right')||key('KeyD','ArrowRight'))-Number(held('left')||key('KeyA','ArrowLeft'))};
  }
  pause(){
    if(!this.active||this.results.open)return;this.paused=true;this.clearInput();this.persist();$('race-resume').hidden=false;$('race-countdown').textContent='PAUZA';$('race-pause').textContent='Wznów';
  }
  resume(){if(!this.active)return;this.paused=false;this.clearInput();$('race-resume').hidden=true;$('race-pause').textContent='Pauza';this.updateHud();}
  persist(){if(this.engine){saveRace(this.getState(),this.engine);this.onSave();}}
  update(dt){
    if(!this.engine)return;
    if(!this.paused&&!this.results.open){
      const previous=this.engine.data.phase;this.engine.update(dt,this.input());
      if(this.engine.data.elapsed-this.lastSave>=2){this.persist();this.lastSave=this.engine.data.elapsed;}
      if(previous!=='finished'&&this.engine.data.phase==='finished'){this.persist();this.showResults();}
    }
    if(!this.paused)this.updateHud();this.view.render(this.engine,this.paused?0:Math.min(dt,.1));
  }
  updateHud(){
    const e=this.engine,r=e.data,player=r.cars[0];
    $('race-position').textContent=String(e.position).padStart(2,'0');$('race-lap').textContent=`${Math.min(3,player.laps+1)} / 3`;
    $('race-timer').textContent=raceTime(player.finishTime??r.elapsed);$('race-speed').textContent=String(Math.round(player.speed*3.6));
    const countdown=$('race-countdown');countdown.textContent=r.phase==='countdown'?String(Math.max(1,Math.ceil(r.countdown))):r.elapsed<.8?'START':r.phase==='finishing'?'META':'';
    $('race-notice').textContent=r.phase==='finishing'?`Ukończono: ${r.cars.filter(c=>c.finishTime!==null).length}/10 · Czekamy na pozostałych kierowców`:player.contact>0?'Kontakt! Tracisz prędkość.':r.phase==='countdown'?'Trzy okrążenia. Dziewięciu rywali. Jeden zwycięzca.':this.isTouch()?'Przytrzymaj GAZ · ← / → kierunek · HAMULEC':'W / ↑ gaz · S / ↓ hamulec · A/D / ←→ kierunek';
    $('race-lap-time').textContent=player.lapTimes.length?`Ostatnie okrążenie: ${raceTime(player.lapTimes.at(-1))}`:'Czysta linia jest szybsza niż przepychanki.';
    if(r.elapsed-this.lastHud>.18||this.lastHud<0){
      const standings=e.standings();let visible=standings.slice(0,4);if(!visible.some(c=>c.id===0))visible=[...standings.slice(0,3),player];
      $('race-live-rank').replaceChildren(...visible.map(car=>{const row=document.createElement('li');if(car.id===0)row.className='you';const number=document.createElement('b');number.textContent=String(standings.indexOf(car)+1).padStart(2,'0');const name=document.createElement('span');name.textContent=car.name;row.append(number,name);return row;}));
      this.drawMap();this.lastHud=r.elapsed;
    }
    document.body.dataset.racePhase=r.phase;document.body.dataset.raceLap=String(player.laps);document.body.dataset.racePosition=String(e.position);
  }
  drawMap(){
    const canvas=$('race-map'),ctx=canvas.getContext('2d'),sx=canvas.width/335,sz=canvas.height/185;
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#ffffff80';ctx.lineWidth=7;ctx.beginPath();
    for(let i=0;i<=100;i++){const p=trackPoint(i/100*TRACK.length);const x=canvas.width/2+p.x*sx,z=canvas.height/2+p.z*sz;i?ctx.lineTo(x,z):ctx.moveTo(x,z);}ctx.stroke();
    for(const car of [...this.engine.data.cars.slice(1),this.engine.data.cars[0]]){const p=trackPoint(car.progress,car.offset);ctx.beginPath();ctx.arc(canvas.width/2+p.x*sx,canvas.height/2+p.z*sz,car.id===0?4:2.4,0,Math.PI*2);ctx.fillStyle=car.id===0?'#f4ce70':'#e5ede0';ctx.fill();}
  }
  showResults(){
    this.clearInput();const standings=this.engine.standings(),position=this.engine.position,prize=PRIZES[position-1]??0;
    $('race-result-title').textContent=position===1?'Pierwsze miejsce!':`Meta. Miejsce ${position}.`;
    $('race-reward').textContent=prize?`Nagroda: +${money(prize)}`:'Tym razem poza podium. Następny start może być Twój.';
    $('race-results-body').replaceChildren(...standings.map((car,i)=>{const row=document.createElement('tr');if(car.id===0)row.className='you';for(const value of [String(i+1).padStart(2,'0'),car.name,`${car.laps}/3`,raceTime(car.finishTime),PRIZES[i]?money(PRIZES[i]):'—']){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}return row;}));
    $('race-claim').textContent=prize?`Odbierz ${money(prize)} i wróć`:'Wróć na Czarny Rynek';
    this.results.showModal();$('race-claim').focus();
  }
  claim(){
    if(!this.engine||!this.results.open)return;
    this.persist();const result=claimRaceReward(this.getState());if(!result.ok)return;
    this.onSave();this.view.deactivate();this.engine=null;this.clearInput();document.body.classList.remove('racing');$('race-hud').hidden=true;this.results.close();
    delete document.body.dataset.racePhase;delete document.body.dataset.raceLap;delete document.body.dataset.racePosition;
    this.onLeave(result);
  }
}
