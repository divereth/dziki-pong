import {Game} from './engine.js';
import {Renderer} from './art.js';
import {AudioSystem} from './audio.js';
import {Presentation} from './presentation.js';
import {Leaderboard} from './leaderboard.js';
const $=id=>document.getElementById(id),canvas=$('game'),renderer=new Renderer(canvas),audio=new AudioSystem($('default-music'));
const leaderboard=new Leaderboard($('leaderboard'));
let best=0,muted=false,mode='title',lastChange=performance.now(),introEnds=0,introAction='start',musicWanted=false,musicRequest=0;
try{best=Number(localStorage.getItem('uniboar-best'))||0;muted=localStorage.getItem('uniboar-muted')==='true';}catch{}
const game=new Game({event:name=>{
 if(name==='start'||name==='resume'){const firstWish=name==='start'&&game.wish===1;if(firstWish)audio.resetMusic();musicWanted=true;requestMusic(firstWish);}
 else if(name==='pause'){musicWanted=false;++musicRequest;audio.stopMusic();}
 else if(name==='death'){if(game.state==='over'){musicWanted=false;++musicRequest;audio.stopMusic();}audio.effect('death');best=Math.max(best,game.best);try{localStorage.setItem('uniboar-best',String(best));}catch{}}
 else audio.effect(name);
}});const presentation=new Presentation(game);game.best=best;audio.setMuted(muted);
function requestMusic(firstWish=false){const request=++musicRequest;audio.unlock().then(ready=>{if(!ready||request!==musicRequest||!musicWanted)return;audio.startMusic();if(firstWish)audio.effect('boar');}).catch(()=>{});}
const motion=matchMedia('(prefers-reduced-motion: reduce)');game.reducedMotion=motion.matches;motion.addEventListener('change',()=>game.reducedMotion=motion.matches);
const lifeSVG='<svg viewBox="0 0 72 40" aria-hidden="true"><path d="M3 26 1 20 6 22 10 20C7 5 38 7 43 12L48 8 49 2 54 9 59 7 61 1 64 12 71 16 69 24 60 26 57 30 51 29 49 20 43 22 40 36 34 36 35 25 21 25 18 35 12 35 12 27 7 29Z"/><path d="M64 22q8 0 6-7" fill="none" stroke="white" stroke-width="3"/></svg>';
$('lives').innerHTML=[0,1,2].map(()=>`<span class="life">${lifeSVG}</span>`).join('');
function audioUI(){$('sound').textContent=muted?'SOUND OFF':'SOUND ON';$('sound').setAttribute('aria-label',muted?'Unmute sound':'Mute sound');$('sound').setAttribute('aria-pressed',String(muted));}audioUI();
function changeMode(next){mode=next;lastChange=performance.now();presentation.reset();refresh();if(next==='over')leaderboard.show(game.total);else leaderboard.close();}
function refresh(){
 $('result').classList.toggle('has-leaderboard',mode==='over');
 $('title-screen').hidden=!['title','instructions'].includes(mode);$('play').hidden=mode!=='title';$('instructions').hidden=mode!=='instructions';$('intro').hidden=mode!=='intro';$('result').hidden=!['dead','over'].includes(mode);$('paused').hidden=mode!=='paused';$('hud').hidden=!['playing','dying','paused'].includes(mode);$('touch-controls').hidden=mode!=='playing';
 if(mode==='dead'||mode==='over'){
  $('result-title').textContent=mode==='over'?'Three wishes complete':`Wish ${game.wish} complete`;
  renderer.drawWishHead($('result-head'),game.death);
  $('wish-scores').innerHTML=[0,1,2].map((i)=>`<div class="wish-score"><span>${['1st','2nd','3rd'][i]} Wish:</span><strong>${game.scores[i]===undefined?'':Math.floor(game.scores[i])}</strong><i></i></div>`).join('');
  $('result-total').hidden=false;$('result-total').textContent=game.total;
  $('result-message').textContent='';
  $('next').textContent=mode==='over'?'Press Z to make your dreams come true again!':'Press Z to make your next wish!';
 }
}
function focus(){canvas.focus({preventScroll:true});}
function advance(){
 audio.unlock().catch(()=>{});
 if(mode==='title')changeMode('instructions');
 else if(mode==='instructions'||mode==='over'){game.state='title';introAction='start';$('intro').lastElementChild.textContent='You will fail!';changeMode('intro');introEnds=performance.now()+1800;}
 else if(mode==='dead'){introAction='continue';$('intro').lastElementChild.textContent=game.wish===1?'Chase your dreams!':'Believe in yourself!';changeMode('intro');introEnds=performance.now()+1800;}
 else if(mode==='paused'){game.pause();changeMode('playing');}
 focus();
}
$('play').addEventListener('click',advance);$('begin').addEventListener('click',advance);$('next').addEventListener('click',advance);$('resume').addEventListener('click',advance);
function pause(){if(mode==='playing'){game.pause();changeMode('paused');}else if(mode==='paused')advance();}
$('pause').addEventListener('click',pause);
$('sound').addEventListener('click',()=>{muted=!muted;audio.setMuted(muted);audioUI();try{localStorage.setItem('uniboar-muted',String(muted));}catch{}if(!muted&&musicWanted)requestMusic();});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('game-frame').closest('.game-wrap').requestFullscreen();}catch{$('notice').textContent='Full screen is unavailable in this browser.';}});
function resizeView(){renderer.resize();if(mode==='paused')renderer.render(presentation.sample(),performance.now()/1000);}
document.addEventListener('fullscreenchange',()=>{resizeView();$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit full screen':'Enter full screen');});
for(const name of ['jump','dash']){
 const button=$(name);button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);if(mode==='playing')game[name]();});
 const release=()=>{if(name==='jump')game.releaseJump();else game.releaseDash();};button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);
}
document.addEventListener('keydown',e=>{
 const key=e.key.toLowerCase();if(e.target instanceof HTMLInputElement)return;
 if((key===' '||key==='enter')&&e.target instanceof HTMLButtonElement)return;
 if(!['z','x',' ','arrowup','shift','enter','p','escape'].includes(key))return;e.preventDefault();if(e.repeat)return;
 if(key==='p'||key==='escape'){pause();return;}
 if(mode!=='playing'){if(['z',' ','enter'].includes(key)&&performance.now()-lastChange>180)advance();return;}
 if(['z',' ','arrowup'].includes(key))game.jump();else if(['x','shift'].includes(key))game.dash();
});
document.addEventListener('keyup',e=>{const key=e.key.toLowerCase();if(['z',' ','arrowup'].includes(key))game.releaseJump();if(['x','shift'].includes(key))game.releaseDash();});
window.addEventListener('blur',()=>{game.releaseJump();game.releaseDash();if(mode==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pause();});
window.addEventListener('resize',resizeView);
$('track-label').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();$('track').click();}});
$('track').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{await audio.unlock();const name=await audio.loadTrack(file);$('notice').textContent='Music: '+name+' (local file)';if(musicWanted)requestMusic();}catch{$('notice').textContent='Could not open that audio file. Try MP3, WAV or OGG.';}});
let previous=performance.now(),shownWishes=-1;
function loop(now){
 const dt=Math.min((now-previous)/1000,.1);previous=now;
 if(mode==='intro'&&now>=introEnds){game[introAction]();changeMode('playing');}
 if(mode==='playing'||mode==='dying')game.update(dt);else if(mode==='title'||mode==='instructions')game.time+=dt;
 if((game.state==='dead'||game.state==='over')&&mode==='playing')changeMode('dying');
 if(mode==='dying'&&game.death&&game.death.age>=game.death.duration)changeMode(game.state);
 if(mode==='playing'||mode==='dying')renderer.render(presentation.sample(),now/1000);
 const tutorialCone=game.stars.find(s=>!s.broken&&!s.missed&&game.platforms.some(p=>p.slot===s.platformId&&p.ordinal===3));
 const coneGap=tutorialCone? tutorialCone.x-game.distance-game.player.x:Infinity;
 const showDashHint=mode==='playing'&&game.player.dash<=0&&coneGap>-20&&coneGap<550;
 if($('dash-hint').hidden===showDashHint)$('dash-hint').hidden=!showDashHint;
 const shownScore=String(Math.floor(game.score));if($('score').textContent!==shownScore)$('score').textContent=shownScore;
 if(shownWishes!==game.scores.length){shownWishes=game.scores.length;
  [...$('lives').children].forEach((el,i)=>el.classList.toggle('used',i>=3-shownWishes));
  $('lives').setAttribute('aria-label',`${3-shownWishes} wishes remaining`);
 }
 requestAnimationFrame(loop);
}
refresh();renderer.resize();requestAnimationFrame(loop);
const warmTerrain=()=>{if(mode==='title'||mode==='instructions')renderer.render(presentation.sample(),performance.now()/1000);};
if('requestIdleCallback'in window)requestIdleCallback(warmTerrain,{timeout:1000});else setTimeout(warmTerrain,80);
