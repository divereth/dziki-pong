const LIMIT=6;
export function qualifies(score,scores){return Number.isSafeInteger(score)&&score>0&&(scores.length<LIMIT||score>scores[LIMIT-1].score);}
export class Leaderboard{
 constructor(root){
  this.root=root;this.body=root.querySelector('tbody');this.status=root.querySelector('[role="status"]');this.form=root.querySelector('form');this.input=root.querySelector('input');this.button=this.form.querySelector('button');this.retry=root.querySelector('[data-retry]');this.version=0;
  this.form.addEventListener('submit',event=>{event.preventDefault();this.submit();});this.retry.addEventListener('click',()=>this.load(this.version));
  try{this.input.value=localStorage.getItem('uniboar-nickname')||'';}catch{}
 }
 close(){this.version++;this.root.hidden=true;this.form.hidden=true;this.saving=false;this.button.disabled=false;}
 show(score){
  this.close();this.score=score;this.submissionId=crypto.randomUUID();this.saved=false;this.root.hidden=false;this.form.hidden=true;this.retry.hidden=true;this.body.replaceChildren();this.status.textContent='Loading global scores…';
  this.load(this.version);
 }
 async api(options={}){
  const response=await fetch('/api/leaderboard',{cache:'no-store',signal:AbortSignal.timeout(8000),...options});
  if(!response.ok)throw Error('Scores unavailable');const result=await response.json();
  if(!Array.isArray(result.scores))throw Error('Invalid leaderboard');return result;
 }
 render(scores){
  this.body.replaceChildren();
  for(let i=0;i<LIMIT;i++){
   const row=document.createElement('tr');
   for(const value of [String(i+1),scores[i]?.nickname||'—',scores[i]?String(scores[i].score):'—']){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
   this.body.append(row);
  }
 }
 async load(version){
  this.retry.hidden=true;this.status.textContent='Loading global scores…';
  try{
   const result=await this.api();if(version!==this.version)return;
   this.render(result.scores);this.form.hidden=this.saved||!qualifies(this.score,result.scores);
   this.status.textContent=this.saved?'Your score is saved.':this.form.hidden?'Global top 6 · all players':'You made the top 6! Enter your nickname.';
  }catch{if(version!==this.version)return;this.form.hidden=true;this.status.textContent='Global scores are unavailable. Connect to the internet and retry.';this.retry.hidden=false;}
 }
 async submit(){
  if(this.saving||this.saved)return;
  const nickname=this.input.value.normalize('NFC').trim();
  if(!nickname||Array.from(nickname).length>20||/[\p{C}<>]/u.test(nickname)){this.status.textContent='Enter a nickname of 1–20 characters.';this.input.focus();return;}
  const version=this.version;this.saving=true;this.button.disabled=true;this.status.textContent='Saving your score…';
  try{
   const result=await this.api({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname,score:this.score,submissionId:this.submissionId})});
   if(version!==this.version)return;this.render(result.scores);this.saved=true;this.form.hidden=true;
   this.status.textContent=result.submitted?'Your score is saved globally!':'Another player just passed you. Try again for the top 6!';
   try{localStorage.setItem('uniboar-nickname',nickname);}catch{}
  }catch{if(version===this.version)this.status.textContent='Could not save. Your score is still here — please retry.';}
  finally{if(version===this.version){this.saving=false;this.button.disabled=false;}}
 }
}
