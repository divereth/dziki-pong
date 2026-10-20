export class TouchControls{
 constructor(game,getMode){
  this.game=game;this.getMode=getMode;this.pointers=new Map();this.used=new Set();this.root=document.getElementById('touch-controls');
  this.mobile=navigator.maxTouchPoints>0||matchMedia('(any-pointer: coarse)').matches;
  document.documentElement.classList.toggle('touch-device',this.mobile);
  document.addEventListener('pointerdown',event=>this.down(event),{passive:false});
  for(const name of ['pointerup','pointercancel'])window.addEventListener(name,event=>this.up(event));
  document.documentElement.addEventListener('lostpointercapture',event=>{if(event.target===document.documentElement)this.up(event);});
  window.addEventListener('blur',()=>this.release());
  for(const button of this.root.querySelectorAll('[data-touch-action]'))button.addEventListener('click',event=>{
   if(event.detail!==0||this.getMode()!=='playing')return;
   const action=button.dataset.touchAction;this.game[action]();setTimeout(()=>{if(!this.has(action))this.end(action);},60);
  });
  this.syncHints();
  if(this.mobile){
   const help='Left half: jump / double jump · Right half: leaf dash';
   document.querySelector('#instructions p').textContent=help;document.querySelector('.settings-controls').textContent=help;
   document.getElementById('dash-hint').textContent='Tap the right half to dash';
  }
 }
 has(action){return [...this.pointers.values()].includes(action);}
 end(action){if(action==='jump')this.game.releaseJump();else this.game.releaseDash();}
 down(event){
  if(event.pointerType!=='touch'||this.getMode()!=='playing')return;
  const zone=event.target.closest?.('[data-touch-action]');
  if(!zone&&event.target.closest?.('button,input,label,form,a,[role="dialog"]'))return;
  event.preventDefault();
  const action=event.clientX<innerWidth/2?'jump':'dash',held=this.has(action);
  this.pointers.set(event.pointerId,action);
  try{document.documentElement.setPointerCapture(event.pointerId);}catch{}
  if(!held)this.game[action]();
 }
 up(event){
  const action=this.pointers.get(event.pointerId);if(!action)return;
  this.pointers.delete(event.pointerId);if(!this.has(action))this.end(action);
 }
 release(){for(const action of new Set(this.pointers.values()))this.end(action);this.pointers.clear();}
 sync(playing){this.root.hidden=!playing;document.documentElement.classList.toggle('touch-playing',this.mobile&&playing);if(!playing)this.release();}
 markUsed(action){if(this.used.has(action))return;this.used.add(action);this.syncHints();}
 resetHints(){this.used.clear();this.syncHints();}
 syncHints(){for(const button of this.root.querySelectorAll('[data-touch-action]'))button.classList.toggle('needs-hint',!this.used.has(button.dataset.touchAction));}
}
