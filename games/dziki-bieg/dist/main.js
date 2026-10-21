import {Game} from './engine.js';
import {Renderer} from './art.js';
import {AudioSystem} from './audio.js';
import {Presentation} from './presentation.js';
import {Leaderboard} from './leaderboard.js';
import {Settings} from './settings.js';
import {TouchControls} from './touch.js';
import {DemoController,demoRandom} from './demo.js';
const $=id=>document.getElementById(id),canvas=$('game'),renderer=new Renderer(canvas),audio=new AudioSystem($('default-music'));
const leaderboard=new Leaderboard($('leaderboard'));
const settings=new Settings(audio,{setAmbientParticles:enabled=>renderer.ambientParticles=enabled});
let best=0,mode='title',lastChange=performance.now(),introEnds=0,introAction='start',musicWanted=false,musicRequest=0,demoRun=false,demoAdvanceAt=0,demoRoute=4;
try{best=Number(localStorage.getItem('uniboar-best'))||0;}catch{}
const game=new Game({event:name=>{
 if(name==='start'||name==='resume'){const firstWish=name==='start'&&game.wish===1;if(firstWish){touch.resetHints();audio.resetMusic();}musicWanted=true;requestMusic(firstWish);}
 else if(name==='pause'){musicWanted=false;++musicRequest;audio.stopMusic();}
 else if(name==='death'){if(game.state==='over'){musicWanted=false;++musicRequest;audio.stopMusic();}audio.effect('death');if(demoRun){demo.bestWish=Math.max(demo.bestWish,game.score);game.best=best;}else{best=Math.max(best,game.best);try{localStorage.setItem('uniboar-best',String(best));}catch{}}}
 else {if(name==='jump'||name==='double')touch.markUsed('jump');if(name==='dash')touch.markUsed('dash');audio.effect(name);}
}});const presentation=new Presentation(game);game.best=best;
const demo=new DemoController(game,{onFailure:()=>{endDemo();$('demo-start').textContent='AI demo unavailable';$('demo-start').disabled=true;}});
const touch=new TouchControls(game,()=>demoRun?'demo':mode);
function requestMusic(firstWish=false){const request=++musicRequest;audio.unlock().then(ready=>{if(!ready||request!==musicRequest||!musicWanted)return;audio.startMusic();if(firstWish)audio.effect('boar');}).catch(()=>{});}
const motion=matchMedia('(prefers-reduced-motion: reduce)');game.reducedMotion=motion.matches;motion.addEventListener('change',()=>game.reducedMotion=motion.matches);
$('lives').innerHTML=[0,1,2].map(()=>'<span class="life"><canvas width="152" height="96" aria-hidden="true"></canvas></span>').join('');
function changeMode(next){settings.close();mode=next;lastChange=performance.now();presentation.reset();refresh();if(next==='over'&&!demoRun)leaderboard.show(game.total);else leaderboard.close();if(demoRun&&['dead','over'].includes(next))demoAdvanceAt=performance.now()+2300;}
function refresh(){
 touch.sync(mode==='playing'&&!demoRun);$('title-actions').hidden=mode!=='title';$('demo-controls').hidden=!demoRun;$('demo-controls').classList.toggle('demo-menu',['intro','dead','over'].includes(mode));
 $('menu-actions').hidden=!['title','instructions','dead','over','paused'].includes(mode);$('pause').hidden=mode!=='playing';
 $('result').classList.toggle('has-leaderboard',mode==='over'&&!demoRun);
 $('title-screen').hidden=!['title','instructions'].includes(mode);$('play').hidden=mode!=='title';$('instructions').hidden=mode!=='instructions';$('intro').hidden=mode!=='intro';$('result').hidden=!['dead','over'].includes(mode);$('paused').hidden=mode!=='paused';$('hud').hidden=!['playing','dying','paused'].includes(mode);$('touch-controls').hidden=mode!=='playing'||demoRun;
 if(mode==='dead'||mode==='over'){
  $('result-title').textContent=mode==='over'?'Three wishes complete':`Wish ${game.wish} complete`;
  renderer.drawWishHead($('result-head'),game.death);
  $('wish-scores').innerHTML=[0,1,2].map((i)=>`<div class="wish-score"><span>${['1st','2nd','3rd'][i]} Wish:</span><strong>${game.scores[i]===undefined?'':Math.floor(game.scores[i])}</strong><i></i></div>`).join('');
  $('result-total').hidden=false;$('result-total').textContent=game.total;
  $('result-message').textContent='';
  $('next').textContent=demoRun?(mode==='over'?'A new AI run starts soon…':'The next AI wish starts soon…'):mode==='over'?'Press Z to make your dreams come true again!':'Press Z to make your next wish!';
 }
}
function focus(){canvas.focus({preventScroll:true});}
function advance(){
 audio.unlock().catch(()=>{});
 if(mode==='title')changeMode('instructions');
 else if(mode==='instructions'||mode==='over'){if(demoRun){if(mode==='over')game.random=demoRandom(++demoRoute);if(!demo.prepare())return;}else game.random=Math.random;game.state='title';introAction='start';$('intro').lastElementChild.textContent=demoRun?'Chasing 100,000…':'You will fail!';changeMode('intro');introEnds=performance.now()+1800;}
 else if(mode==='dead'){if(demoRun)if(!demo.prepare())return;introAction='continue';$('intro').lastElementChild.textContent=game.wish===1?'Chase your dreams!':'Believe in yourself!';changeMode('intro');introEnds=performance.now()+1800;}
 else if(mode==='paused'){game.pause();changeMode('playing');}
 focus();
}
$('play').addEventListener('click',advance);$('begin').addEventListener('click',advance);$('next').addEventListener('click',advance);$('resume').addEventListener('click',advance);
function endDemo(){
 demoRun=false;demo.stop();musicWanted=false;++musicRequest;audio.stopMusic();audio.stopHooves();game.state='title';game.random=Math.random;game.best=best;changeMode('title');focus();
}
$('demo-start').addEventListener('click',()=>{
 audio.unlock().catch(()=>{});demoRun=true;demoRoute=4;demo.bestWish=0;game.random=demoRandom(demoRoute);game.state='title';introAction='start';if(!demo.prepare())return;$('intro').lastElementChild.textContent='Chasing 100,000…';changeMode('intro');introEnds=performance.now()+1800;focus();
});
$('demo-stop').addEventListener('click',endDemo);
function pause(){if(mode==='playing'){game.pause();changeMode('paused');}else if(mode==='paused')advance();}
function controlButton(id,action){
 let lastTouch=-Infinity;const button=$(id);
 button.addEventListener('pointerdown',event=>{if(event.pointerType==='touch'){event.preventDefault();lastTouch=performance.now();action();}});
 button.addEventListener('click',()=>{if(performance.now()-lastTouch>600)action();});
}
controlButton('pause',pause);
controlButton('fullscreen',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('game-frame').closest('.game-wrap').requestFullscreen();}catch{$('notice').textContent='Full screen is unavailable in this browser.';}});
function resizeView(){renderer.resize();if(mode==='paused')renderer.render(presentation.sample(),performance.now()/1000);}
document.addEventListener('fullscreenchange',()=>{resizeView();$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit full screen':'Enter full screen');});
document.addEventListener('keydown',e=>{
 if(settings.handleKeydown(e))return;
 const key=e.key.toLowerCase();if(e.target instanceof HTMLInputElement)return;
 if((key===' '||key==='enter')&&e.target instanceof HTMLButtonElement)return;
 if(!['z','x',' ','arrowup','shift','enter','p','escape'].includes(key))return;e.preventDefault();if(e.repeat)return;
 if(key==='p'||key==='escape'){pause();return;}
 if(mode!=='playing'){if(['z',' ','enter'].includes(key)&&performance.now()-lastChange>180)advance();return;}
 if(demoRun)return;
 if(['z',' ','arrowup'].includes(key))game.jump();else if(['x','shift'].includes(key))game.dash();
});
document.addEventListener('keyup',e=>{const key=e.key.toLowerCase();if(['z',' ','arrowup'].includes(key))game.releaseJump();if(['x','shift'].includes(key))game.releaseDash();});
window.addEventListener('blur',()=>{game.releaseJump();game.releaseDash();if(mode==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pause();});
window.addEventListener('resize',resizeView);
let previous=performance.now(),shownWishes=-1;
function loop(now){
 const dt=Math.min((now-previous)/1000,.1);previous=now;
 if(demoRun&&['dead','over'].includes(mode)&&now>=demoAdvanceAt)advance();
 if(mode==='intro'&&now>=introEnds){if(renderer.assetsReady&&(!demoRun||demo.ready)){game[introAction]();changeMode('playing');}else $('intro').lastElementChild.textContent=demoRun?'Getting ready…':'Preparing the forest…';}
 if(mode==='playing'||mode==='dying')game.update(dt);else if(mode==='title'||mode==='instructions')game.time+=dt;
 if((game.state==='dead'||game.state==='over')&&mode==='playing')changeMode('dying');
 if(mode==='dying'&&game.death&&game.death.age>=game.death.duration)changeMode(game.state);
 if(mode==='playing'||mode==='dying'){const view=presentation.sample();renderer.render(view,now/1000);audio.updateRunning(view.player,mode==='playing');}
 else audio.updateRunning(game.player,false);
 const tutorialCone=game.stars.find(s=>!s.broken&&!s.missed&&game.platforms.some(p=>p.slot===s.platformId&&p.ordinal===3));
 const coneGap=tutorialCone? tutorialCone.x-game.distance-game.player.x:Infinity;
 const showDashHint=!demoRun&&mode==='playing'&&game.player.dash<=0&&coneGap>-20&&coneGap<550;
 if($('dash-hint').hidden===showDashHint)$('dash-hint').hidden=!showDashHint;
 const shownScore=String(Math.floor(game.score));if($('score').textContent!==shownScore)$('score').textContent=shownScore;
 if(demoRun){const peak=Math.max(demo.bestWish,game.score),label='AI demo · Best wish '+Math.floor(peak).toLocaleString()+(peak>=100000?' ✓':'');if($('demo-status').textContent!==label)$('demo-status').textContent=label;}
 if(shownWishes!==game.scores.length){shownWishes=game.scores.length;
  [...$('lives').children].forEach((el,i)=>el.classList.toggle('used',i>=3-shownWishes));
  $('lives').setAttribute('aria-label',`${3-shownWishes} wishes remaining`);
 }
 requestAnimationFrame(loop);
}
refresh();renderer.resize();requestAnimationFrame(loop);
const warmTerrain=()=>{if(mode==='title'||mode==='instructions'||mode==='intro')renderer.render(presentation.sample(),performance.now()/1000);};
renderer.ready.then(warmTerrain);
if('requestIdleCallback'in window)requestIdleCallback(warmTerrain,{timeout:1000});else setTimeout(warmTerrain,80);
