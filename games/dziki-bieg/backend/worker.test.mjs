import {test} from 'node:test';import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
import worker from './worker.mjs';
function fixture(){
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
 const wrap=(sql,args=[])=>({bind:(...values)=>wrap(sql,values),all:async()=>({results:db.prepare(sql).all(...args)}),sql,args});
 return {db,env:{ASSETS:{fetch:()=>new Response('game asset')},SCORES_DB:{prepare:wrap,batch:async statements=>{db.exec('BEGIN');try{const result=statements.map(s=>({results:db.prepare(s.sql).all(...s.args)}));db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}}}};
}
const request=(method='GET',data,origin)=>new Request('https://game.test/api/leaderboard',{method,headers:method==='POST'?{'Content-Type':'application/json',...(origin?{Origin:origin}:{})}:{},...(data?{body:JSON.stringify(data)}:{})});
test('global top six persist across requests, rank correctly and retries do not duplicate scores',async()=>{
 const {db,env}=fixture();try{
  assert.deepEqual((await(await worker.fetch(request(),env)).json()).scores,[]);
  for(let i=1;i<=8;i++)assert.equal((await worker.fetch(request('POST',{nickname:'Dzik '+i,score:i*100,submissionId:'00000000-0000-4000-8000-'+String(i).padStart(12,'0')}),env)).status,200);
  const before=await(await worker.fetch(request(),env)).json();assert.deepEqual(before.scores.map(s=>s.score),[800,700,600,500,400,300]);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM scores').get().n,6);
  const duplicate={nickname:'Dzik 8',score:800,submissionId:'00000000-0000-4000-8000-000000000008'};
  assert.equal((await(await worker.fetch(request('POST',duplicate),env)).json()).submitted,true);
  assert.deepEqual((await(await worker.fetch(request(),env)).json()).scores,before.scores);
  for(const score of [299,300]){
   const response=await(await worker.fetch(request('POST',{nickname:'Late entry',score,submissionId:crypto.randomUUID()}),env)).json();
   assert.equal(response.submitted,false,'a lower score or a tied last place cannot displace an existing score');
   assert.deepEqual(response.scores,before.scores);
  }
 }finally{db.close();}
});
test('invalid input, cross-origin writes and unavailable bindings fail explicitly; assets still work',async()=>{
 const {db,env}=fixture();try{
  for(const data of [{nickname:'<script>',score:100,submissionId:crypto.randomUUID()},{nickname:'Dzik',score:-1,submissionId:crypto.randomUUID()},{nickname:'Dzik',score:100,submissionId:'invalid'}])assert.equal((await worker.fetch(request('POST',data),env)).status,400);
  assert.equal((await worker.fetch(request('POST',{nickname:'Dzik',score:100,submissionId:crypto.randomUUID()},'https://other.test'),env)).status,403);
  assert.equal((await worker.fetch(request('POST',{nickname:'x'.repeat(2000)}),env)).status,413);
  assert.equal((await worker.fetch(request(),{})).status,503);
  assert.equal(await(await worker.fetch(new Request('https://game.test/main.js'),env)).text(),'game asset');
 }finally{db.close();}
});
