import {test} from 'node:test';import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
import worker from './worker.mjs';
const schema=readFileSync(new URL('./schema.sql',import.meta.url),'utf8');
function fixture(cap=1000000){
 const db=new DatabaseSync(':memory:');db.exec(schema.replace('>1000000','>'+cap));
 const wrap=(sql,args=[])=>({bind:(...values)=>wrap(sql,values),all:async()=>({results:db.prepare(sql).all(...args)}),sql,args});
 return {db,env:{ASSETS:{fetch:()=>new Response('game asset')},SCORES_DB:{prepare:wrap,batch:async statements=>{db.exec('BEGIN');try{const result=statements.map(s=>({results:db.prepare(s.sql).all(...s.args)}));db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}}}};
}
const id=i=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0');
const request=(method='GET',data,query='',origin)=>new Request('https://game.test/api/leaderboard'+query,{method,headers:method==='POST'?{'Content-Type':'application/json',...(origin?{Origin:origin}:{})}:{},...(data?{body:JSON.stringify(data)}:{})});
const call=async(env,method='GET',data,query='')=>{const response=await worker.fetch(request(method,data,query),env);assert.equal(response.status,200,await response.clone().text());return response.json();};
function seed(db,n){const insert=db.prepare('INSERT INTO leaderboard_entries VALUES(?,?,?,?)');db.exec('BEGIN');for(let i=1;i<=n;i++)insert.run(id(i),'Player '+i,(n-i+1)*100,'2026-10-19T00:00:00.000Z');db.exec('COMMIT');}
test('all scores persist, UUID retries are idempotent, place 424 shows top three plus 420–428',async()=>{
 const {db,env}=fixture();try{
  seed(db,500);const data={nickname:'Leśny dzik',score:7750,submissionId:crypto.randomUUID()};
  const saved=await call(env,'POST',data);
  assert.equal(saved.submitted,true);assert.equal(saved.myRank,424);assert.equal(saved.total,501);
  assert.deepEqual(saved.scores.map(s=>s.rank),[1,2,3,420,421,422,423,424,425,426,427,428]);
  assert.equal(saved.scores.find(s=>s.mine).nickname,data.nickname);
  assert.deepEqual(await call(env,'POST',{...data,score:999999}),saved);
  const {submitted,...view}=saved;assert.deepEqual(await call(env,'GET',undefined,'?near='+data.submissionId),view);
 }finally{db.close();}
});
test('keyset pages traverse ties forward and backward without skipping, and zero scores can save',async()=>{
 const {db,env}=fixture();try{
  const insert=db.prepare('INSERT INTO leaderboard_entries VALUES(?,?,?,?)');for(let i=1;i<=70;i++)insert.run(id(i),'Tie '+i,100,'2026-10-19T00:00:00.000Z');
  const first=await call(env),second=await call(env,'GET',undefined,'?cursor='+first.next),third=await call(env,'GET',undefined,'?cursor='+second.next);
  assert.deepEqual(first.scores.map(s=>s.rank),Array.from({length:25},(_,i)=>i+1));
  assert.deepEqual(second.scores.map(s=>s.rank),Array.from({length:25},(_,i)=>i+26));
  assert.deepEqual(third.scores.map(s=>s.rank),Array.from({length:20},(_,i)=>i+51));assert.equal(third.next,null);
  assert.deepEqual((await call(env,'GET',undefined,'?cursor='+third.previous+'&direction=before')).scores,second.scores);
  assert.equal((await call(env,'POST',{nickname:'Zero',score:0,submissionId:crypto.randomUUID()})).myRank,71);
  assert.equal((await call(env,'POST',{nickname:'Tie late',score:100,submissionId:crypto.randomUUID()})).myRank,71);
 }finally{db.close();}
});
test('retention evicts only the worst entry, favors older ties and maintains exact counts',async()=>{
 const {db,env}=fixture(30);try{
  seed(db,30);
  assert.equal((await call(env,'POST',{nickname:'Below cutoff',score:0,submissionId:crypto.randomUUID()})).submitted,false);
  const saved=await call(env,'POST',{nickname:'New best',score:999999,submissionId:crypto.randomUUID()});assert.equal(saved.myRank,1);assert.equal(saved.total,30);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM leaderboard_entries').get().n,30);
  assert.equal(db.prepare('SELECT SUM(entries) n FROM leaderboard_buckets').get().n,30);
  assert.equal(db.prepare('SELECT MIN(score) n FROM leaderboard_entries').get().n,200);
  assert.equal((await call(env,'POST',{nickname:'New tie at cutoff',score:200,submissionId:crypto.randomUUID()})).submitted,false);
 }finally{db.close();}
});
test('legacy migration preserves rows and can safely run twice',()=>{
 const {db}=fixture();try{
  db.exec("CREATE TABLE scores(id TEXT PRIMARY KEY,nickname TEXT,score INTEGER,created_at TEXT);INSERT INTO scores VALUES('"+id(1)+"','Old player',1234,'2026-10-18T00:00:00.000Z');");
  const migration=readFileSync(new URL('./migrate-top-six.sql',import.meta.url),'utf8');db.exec(migration);db.exec(migration);
  assert.deepEqual({...db.prepare('SELECT * FROM leaderboard_entries').get()},{id:id(1),nickname:'Old player',score:1234,created_at:'2026-10-18T00:00:00.000Z'});
  assert.equal(db.prepare('SELECT entries FROM leaderboard_stats').get().entries,1);
 }finally{db.close();}
});
test('validation, origin checks, missing binding and malformed cursors fail explicitly',async()=>{
 const {db,env}=fixture();try{
  for(const data of [{nickname:'<script>',score:100,submissionId:crypto.randomUUID()},{nickname:'Dzik',score:-1,submissionId:crypto.randomUUID()},{nickname:'Dzik',score:100,submissionId:'invalid'}])assert.equal((await worker.fetch(request('POST',data),env)).status,400);
  assert.equal((await worker.fetch(request('POST',{nickname:'Dzik',score:100,submissionId:crypto.randomUUID()},'','https://other.test'),env)).status,403);
  assert.equal((await worker.fetch(request('POST',{nickname:'x'.repeat(2000)}),env)).status,413);
  for(const query of ['?cursor=broken','?near=invalid','?direction=sideways'])assert.equal((await worker.fetch(request('GET',undefined,query),env)).status,400);
  assert.equal((await worker.fetch(request(),{})).status,503);
  assert.equal(await(await worker.fetch(new Request('https://game.test/main.js'),env)).text(),'game asset');
 }finally{db.close();}
});
