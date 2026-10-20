export function qualifies(score){return Number.isSafeInteger(score)&&score>=0;}
export function displayRows(scores){
 const rows=[];let previous=(scores[0]?.rank||1)-1;
 for(const score of scores){if(score.rank>previous+1)rows.push(null);rows.push(score);previous=score.rank;}
 return rows;
}
export class Leaderboard{
 constructor(root){
  this.root=root;this.body=root.querySelector('tbody');this.status=root.querySelector('[role="status"]');this.form=root.querySelector('form');this.input=root.querySelector('input');this.button=this.form.querySelector('button');this.retry=root.querySelector('[data-retry]');this.navigation=root.querySelector('nav');this.version=0;this.requestVersion=0;
  this.form.addEventListener('submit',event=>{event.preventDefault();this.submit();});
  this.retry.addEventListener('click',()=>{if(!this.busy)this.load(this.version,this.lastQuery);});
  this.navigation.addEventListener('click',event=>{
   const action=event.target.closest('button')?.dataset.page;if(!action||this.busy)return;
   const query=action==='mine'?'?near='+this.submissionId:action==='top'?'':('?cursor='+encodeURIComponent(this.page[action])+'&direction='+(action==='previous'?'before':'after'));
   this.load(this.version,query);
  });
  this.resizeObserver=new ResizeObserver(()=>this.focusOwn());this.resizeObserver.observe(root.querySelector('.leaderboard-table'));
  try{this.input.value=localStorage.getItem('uniboar-nickname')||'';}catch{}
 }
 close(){this.version++;this.requestVersion++;this.root.hidden=true;this.form.hidden=true;this.saving=false;this.busy=false;this.button.disabled=false;}
 show(score){
  this.close();this.score=score;this.submissionId=crypto.randomUUID();this.saved=false;this.root.hidden=false;this.form.hidden=!qualifies(score);this.retry.hidden=true;this.body.replaceChildren();
  this.load(this.version);
 }
 async api(query='',options={}){
  const response=await fetch('/api/leaderboard'+query,{cache:'no-store',signal:AbortSignal.timeout(8000),...options});
  if(!response.ok)throw Error('Scores unavailable');const result=await response.json();
  if(!Array.isArray(result.scores)||!Number.isSafeInteger(result.total))throw Error('Invalid leaderboard');return result;
 }
 controls(){
  for(const button of this.navigation.querySelectorAll('button')){
   const action=button.dataset.page;
   button.disabled=this.busy||(action==='mine'?!this.saved:['previous','next'].includes(action)?!this.page?.[action]:false);
  }
  this.button.disabled=this.busy;
  this.retry.disabled=this.busy;
 }
 focusOwn(){
  const table=this.root.querySelector('.leaderboard-table'),own=this.body.querySelector('.leaderboard-mine');
  if(this.root.hidden||!own)return;
  let pinned=this.root.querySelector('thead').getBoundingClientRect().height;
  for(const row of this.body.querySelectorAll('.leaderboard-top')){row.style.top=pinned+'px';pinned+=row.getBoundingClientRect().height;}
  const rect=own.getBoundingClientRect(),area=table.getBoundingClientRect();
  if(rect.top<area.top+pinned||rect.bottom>area.bottom)table.scrollTop+=rect.top-area.top-pinned-Math.max(0,(area.height-pinned-rect.height)/2);
 }
 render(result){
  this.page=result;this.body.replaceChildren();
  for(const score of displayRows(result.scores)){
   const row=document.createElement('tr');
   if(!score){const cell=document.createElement('td');cell.colSpan=3;cell.textContent='…';cell.className='leaderboard-gap';row.append(cell);}
   else{
    if(result.myRank>7&&score.rank<=3)row.classList.add('leaderboard-top');
    if(score.mine){row.className='leaderboard-mine';row.setAttribute('aria-label','Your score');}
    for(const value of [String(score.rank),score.nickname,String(score.score)]){const cell=document.createElement('td');cell.textContent=value;cell.title=value;row.append(cell);}
   }
   this.body.append(row);
  }
  if(!result.scores.length){const row=this.body.insertRow(),cell=row.insertCell();cell.colSpan=3;cell.textContent='Be the first to save a score!';}
  this.root.querySelector('[data-total]').textContent=result.total.toLocaleString()+' scores';
  this.root.querySelector('.leaderboard-table').scrollTop=0;this.controls();this.focusOwn();
 }
 async load(version,query=''){
  const requestVersion=++this.requestVersion;this.lastQuery=query;this.busy=true;this.retry.hidden=true;this.controls();this.status.textContent='Loading global scores…';
  try{
   const result=await this.api(query);if(version!==this.version||requestVersion!==this.requestVersion)return;
   this.render(result);this.form.hidden=this.saved||!qualifies(this.score);
   this.status.textContent=result.myRank!==null?'Your place: #'+result.myRank.toLocaleString():this.saved?'Your score is saved. Browse the global ranking.':'Every score counts. Enter your nickname to join.';
  }catch{if(version!==this.version||requestVersion!==this.requestVersion)return;this.status.textContent='Global scores are unavailable. Connect and retry.';this.retry.hidden=false;}
  finally{if(version===this.version&&requestVersion===this.requestVersion){this.busy=false;this.controls();}}
 }
 async submit(){
  if(this.busy||this.saved||!qualifies(this.score))return;
  const nickname=this.input.value.normalize('NFC').trim();
  if(!nickname||Array.from(nickname).length>20||/[\p{C}<>]/u.test(nickname)){this.status.textContent='Enter a nickname of 1–20 characters.';this.input.focus();return;}
  const version=this.version;this.busy=true;this.retry.hidden=true;this.controls();this.status.textContent='Saving your score…';
  try{
   const result=await this.api('',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname,score:this.score,submissionId:this.submissionId})});
   if(version!==this.version)return;this.saved=result.submitted;this.render(result);this.form.hidden=true;
   this.status.textContent=result.submitted?'Saved globally! Your place: #'+result.myRank.toLocaleString():'Only the best 1,000,000 scores are kept. This score is below the cutoff.';
   try{localStorage.setItem('uniboar-nickname',nickname);}catch{}
  }catch{if(version===this.version)this.status.textContent='Could not save. Your score is still here — please retry.';}
  finally{if(version===this.version){this.busy=false;this.controls();}}
 }
}
