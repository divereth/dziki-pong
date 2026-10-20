const storedVolume = key => {
 try {
  const stored=localStorage.getItem(key);
  if(stored!==null&&stored.trim()!==''&&Number.isFinite(Number(stored)))return Math.max(0,Math.min(1,Number(stored)));
  return localStorage.getItem('uniboar-muted')==='true'?0:1;
 }catch{return 1;}
};
export class Settings{
 constructor(audio,{setAmbientParticles=()=>{}}={}){
  this.panel=document.getElementById('settings');this.trigger=document.getElementById('settings-open');this.done=document.getElementById('settings-done');
  this.trigger.addEventListener('click',()=>this.open());this.done.addEventListener('click',()=>this.close());
  for(const [name,setter]of [['music','setMusicVolume'],['effects','setEffectsVolume']]){
   const input=document.getElementById(name+'-volume'),output=document.getElementById(name+'-value'),key='uniboar-'+name+'-volume';
   const apply=value=>{audio[setter](value);input.value=String(Math.round(value*100));output.value=input.value+'%';};
   apply(storedVolume(key));
   input.addEventListener('input',()=>{const value=Number(input.value)/100;apply(value);try{localStorage.setItem(key,String(value));}catch{}});
  }
  const particles=document.getElementById('ambient-particles');
  if(particles){
   try{particles.checked=localStorage.getItem('uniboar-ambient-particles')!=='false';}catch{particles.checked=true;}
   setAmbientParticles(particles.checked);
   particles.addEventListener('change',()=>{setAmbientParticles(particles.checked);try{localStorage.setItem('uniboar-ambient-particles',String(particles.checked));}catch{}});
  }
 }
 open(){this.panel.hidden=false;this.trigger.setAttribute('aria-expanded','true');this.done.focus({preventScroll:true});}
 close(){if(this.panel.hidden)return;this.panel.hidden=true;this.trigger.setAttribute('aria-expanded','false');if(!this.trigger.closest('[hidden]'))this.trigger.focus({preventScroll:true});}
 handleKeydown(event){
  if(this.panel.hidden)return false;
  if(event.key==='Escape'){event.preventDefault();this.close();}
  if(event.key==='Tab'){
   const controls=[document.getElementById('fullscreen'),...this.panel.querySelectorAll('input,button')].filter(el=>!el.hidden&&!el.disabled&&!el.closest('[hidden]'));
   const index=controls.indexOf(document.activeElement),next=index+(event.shiftKey?-1:1);
   if(index<0||next<0||next>=controls.length){event.preventDefault();controls[(next+controls.length)%controls.length].focus();}
  }
  return true;
 }
}
