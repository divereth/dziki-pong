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
function seed(db,n){const insert=db.prepare('INSERT INTO leaderboard_entries(id,nickname,score,created_at) VALUES(?,?,?,?)');db.exec('BEGIN');for(let i=1;i<=n;i++)insert.run(id(i),'Player '+i,(n-i+1)*100,'2026-10-19T00:00:00.000Z');db.exec('COMMIT');}
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
  const insert=db.prepare('INSERT INTO leaderboard_entries(id,nickname,score,created_at) VALUES(?,?,?,?)');for(let i=1;i<=70;i++)insert.run(id(i),'Tie '+i,100,'2026-10-19T00:00:00.000Z');
  const first=await call(env),second=await call(env,'GET',undefined,'?cursor='+first.next),third=await call(env,'GET',undefined,'?cursor='+second.next);
  assert.deepEqual(first.scores.map(s=>s.rank),Array.from({length:25},(_,i)=>i+1));
  assert.deepEqual(second.scores.map(s=>s.rank),Array.from({length:25},(_,i)=>i+26));
  assert.deepEqual(third.scores.map(s=>s.rank),Array.from({length:20},(_,i)=>i+51));assert.equal(third.next,null);
  assert.deepEqual((await call(env,'GET',undefined,'?cursor='+third.previous+'&direction=before')).scores,second.scores);
  assert.equal((await call(env,'POST',{nickname:'Zero',score:0,submissionId:crypto.randomUUID()})).myRank,71);
  assert.equal((await call(env,'POST',{nickname:'Tie late',score:100,submissionId:crypto.randomUUID()})).myRank,71);
 }finally{db.close();}
});

test('My score fills its twelve-row budget at the top and bottom, and shows every entry in small rankings',async()=>{
 for(const count of [1,2,3,5,8,11,12,13,30]){
  const {db,env}=fixture();try{
   seed(db,count);
   for(const place of new Set([1,Math.ceil(count/2),count])){
    const page=await call(env,'GET',undefined,'?near='+id(place));
    const ranks=page.scores.map(row=>row.rank);
    assert.equal(page.myRank,place);
    assert.equal(page.scores.length,Math.min(count,12),'total '+count+' place '+place);
    assert.equal(new Set(ranks).size,ranks.length);
    assert.equal(page.scores.filter(row=>row.mine).length,1);
    assert.equal(page.scores.find(row=>row.mine).rank,place);
    assert.deepEqual(ranks.slice(0,Math.min(3,count)),Array.from({length:Math.min(3,count)},(_,i)=>i+1));
    if(count<=12){
     assert.deepEqual(ranks,Array.from({length:count},(_,i)=>i+1));
     assert.equal(page.previous,null);assert.equal(page.next,null);
    }
    if(place===1&&count>12){
     assert.deepEqual(ranks,Array.from({length:12},(_,i)=>i+1));
     const next=await call(env,'GET',undefined,'?cursor='+page.next);
     assert.equal(next.scores[0].rank,13,'next page starts after every displayed score');
    }
    if(place===count)assert.equal(page.next,null);
   }
  }finally{db.close();}
 }
});

test('personal windows backfill tied scores with correct ranks and usable backwards cursors',async()=>{
 const {db,env}=fixture();try{
  const insert=db.prepare('INSERT INTO leaderboard_entries(id,nickname,score,created_at) VALUES(?,?,?,?)');
  for(let i=1;i<=30;i++)insert.run(id(i),'Tie '+i,100,'2026-10-19T00:00:00.000Z');
  for(const place of [1,2,3,4,5,6,7,8,9,15,28,29,30]){
   const page=await call(env,'GET',undefined,'?near='+id(place));
   assert.equal(page.scores.length,12,'tied place '+place);
   assert.equal(page.scores.find(row=>row.mine).rank,place);
   for(const row of page.scores)assert.equal(row.nickname,'Tie '+row.rank);
   if(page.previous){
    const previous=await call(env,'GET',undefined,'?cursor='+page.previous+'&direction=before');
    const localStart=place<=8?1:Math.max(4,Math.min(place-4,22));
    assert.equal(previous.scores.at(-1).rank,localStart-1);
   }
  }
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
  assert.deepEqual({...db.prepare('SELECT * FROM leaderboard_entries').get()},{id:id(1),nickname:'Old player',score:1234,created_at:'2026-10-18T00:00:00.000Z',nickname_key:''});
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
test('nickname prefix search ignores case and Polish accents, returns true global places and paginates',async()=>{
 const {db,env}=fixture();try{
  seed(db,40);
  for(let i=1;i<=33;i++)await call(env,'POST',{nickname:'Łukasz '+String(i).padStart(2,'0'),score:i*75,submissionId:crypto.randomUUID()});
  const first=await call(env,'GET',undefined,'?search=lUkAsZ');
  assert.equal(first.search,'lUkAsZ');assert.equal(first.scores.length,25);assert.equal(first.previous,null);assert.ok(first.next);
  const ranked=db.prepare('SELECT nickname,ROW_NUMBER() OVER (ORDER BY score DESC,created_at,id) AS rank FROM leaderboard_entries').all();
  for(const row of first.scores)assert.equal(row.rank,ranked.find(entry=>entry.nickname===row.nickname).rank);
  const second=await call(env,'GET',undefined,'?search=ŁUKASZ&cursor='+first.next);assert.equal(second.scores.length,8);assert.equal(second.next,null);
  assert.equal(new Set([...first.scores,...second.scores].map(row=>row.nickname)).size,33);
  const previous=await call(env,'GET',undefined,'?search=lukasz&direction=before&cursor='+second.previous);assert.deepEqual(previous.scores,first.scores);
  assert.equal((await call(env,'GET',undefined,'?search=lukasz%2005')).scores[0].nickname,'Łukasz 05');
  assert.deepEqual((await call(env,'GET',undefined,'?search=nobody')).scores,[]);
 }finally{db.close();}
});
test('search handles literal wildcards, composed accents and Unicode pagination safely',async()=>{
 const {db,env}=fixture();try{
  for(const nickname of ['%Dzik','_Dzik','Leśny','Les\u0301ny'])await call(env,'POST',{nickname,score:123,submissionId:crypto.randomUUID()});
  assert.equal((await call(env,'GET',undefined,'?search=%25')).scores.length,1);
  assert.equal((await call(env,'GET',undefined,'?search=_')).scores.length,1);
  assert.equal((await call(env,'GET',undefined,'?search=LES')).scores.length,2);
  for(let i=1;i<=28;i++)await call(env,'POST',{nickname:'🌲Żółw '+i,score:i,submissionId:crypto.randomUUID()});
  const page=await call(env,'GET',undefined,'?search='+encodeURIComponent('🌲zolw'));
  assert.equal(page.scores.length,25);assert.ok(page.next);
  const next=await call(env,'GET',undefined,'?search='+encodeURIComponent('🌲żółw')+'&cursor='+page.next);assert.equal(next.scores.length,3);
  for(const query of ['?search=','?search='+encodeURIComponent('a'.repeat(21)),'?search=foo&cursor='+page.next,'?search=a&near='+id(1)])assert.equal((await worker.fetch(request('GET',undefined,query),env)).status,400);
 }finally{db.close();}
});
