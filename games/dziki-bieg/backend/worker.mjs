const LIMIT=1000000,PAGE_SIZE=25,MAX_BODY=1024;
const fields='id,nickname,score,created_at',order='score DESC,created_at ASC,id ASC';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const publicRow=(row,rank,mine)=>({rank,nickname:row.nickname,score:row.score,createdAt:row.created_at,...(row.id===mine?{mine:true}:{})});
const cursor=row=>btoa(JSON.stringify([row.score,row.created_at,row.id,...(row.nickname_key!==undefined?[encodeURIComponent(row.nickname_key)]:[])])).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const nicknameKey=value=>value.normalize('NFKD').toLowerCase().replace(/\p{M}/gu,'').replaceAll('ł','l');
function prefixEnd(value){const chars=Array.from(value);for(let i=chars.length-1;i>=0;i--){const point=chars[i].codePointAt(0);if(point<0x10ffff)return chars.slice(0,i).join('')+String.fromCodePoint(point+1);}return null;}
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
function decode(value){
 if(!value||value.length>2048)throw Error('query');
 try{const [score,created_at,id,key]=JSON.parse(atob(value.replaceAll('-','+').replaceAll('_','/'))),nickname_key=key===undefined?undefined:decodeURIComponent(key);if(!Number.isSafeInteger(score)||score<0||typeof created_at!=='string'||created_at.length>30||!uuid(id)||(nickname_key!==undefined&&(typeof nickname_key!=='string'||nickname_key.length>160)))throw Error();return {score,created_at,id,nickname_key};}catch{throw Error('query');}
}
const parameters=row=>[row.score,row.score,row.created_at,row.created_at,row.id];
const before='(score>? OR (score=? AND (created_at<? OR (created_at=? AND id<?))))';
const after='(score<? OR (score=? AND (created_at>? OR (created_at=? AND id>?))))';
async function smallBody(request){
 const reader=request.body?.getReader();if(!reader)throw Error('invalid');
 let size=0,text='';const decoder=new TextDecoder();
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){await reader.cancel();throw Error('large');}text+=decoder.decode(value,{stream:true});}
 return JSON.parse(text+decoder.decode());
}
function rankStatement(db,row){
 // Bucket totals avoid counting the entire higher-scoring part of a large ranking.
 const floor=Math.floor(row.score/1000)*1000;
 return db.prepare('SELECT 1+(SELECT COALESCE(SUM(entries),0) FROM leaderboard_buckets WHERE bucket>?)+(SELECT COUNT(*) FROM leaderboard_entries WHERE score>=? AND score<=? AND '+before+') AS rank').bind(Math.floor(row.score/1000),row.score,Math.min(Number.MAX_SAFE_INTEGER,floor+999),...parameters(row));
}
async function rank(db,row){
 const result=await rankStatement(db,row).all();
 return result.results[0].rank;
}
async function search(db,term,anchor,direction){
 const key=nicknameKey(term),upper=prefixEnd(key),previous=direction==='before';
 if(!key||!upper||(anchor&&(typeof anchor.nickname_key!=='string'||!anchor.nickname_key.startsWith(key))))throw Error('query');
 const args=[key,upper];let condition='nickname_key>=? AND nickname_key<?';
 if(anchor){condition+=' AND (nickname_key'+(previous?'<':'>')+'? OR (nickname_key=? AND '+(previous?before:after)+'))';args.push(anchor.nickname_key,anchor.nickname_key,...parameters(anchor));}
 const selected=(await db.prepare('SELECT '+fields+',nickname_key FROM leaderboard_entries WHERE '+condition+' ORDER BY '+(previous?'nickname_key DESC,score ASC,created_at DESC,id DESC':'nickname_key ASC,'+order)+' LIMIT ?').bind(...args,PAGE_SIZE+1).all()).results;
 const more=selected.length>PAGE_SIZE;selected.splice(PAGE_SIZE);if(previous)selected.reverse();
 const ranked=selected.length?await db.batch(selected.map(row=>rankStatement(db,row))):[];
 const total=(await db.prepare('SELECT entries FROM leaderboard_stats WHERE singleton=1').all()).results[0].entries;
 return {limit:LIMIT,total,pageSize:PAGE_SIZE,search:term,scores:selected.map((row,i)=>publicRow(row,ranked[i].results[0].rank)),myRank:null,
  previous:selected.length&&(previous?more:!!anchor)?cursor(selected[0]):null,
  next:selected.length&&(previous?!!anchor:more)?cursor(selected.at(-1)):null};
}
async function listing(db,{near,anchor,direction}={}){
 const total=(await db.prepare('SELECT entries FROM leaderboard_stats WHERE singleton=1').all()).results[0].entries;
 let selected=[],myRank=null,top=[];
 if(near){
  const own=(await db.prepare('SELECT '+fields+' FROM leaderboard_entries WHERE id=?').bind(near).all()).results[0];
  if(own){
   myRank=await rank(db,own);
   // Keep nine nearby scores even at either end of the ranking. If that
   // window overlaps the top three, fill the shared twelve-row budget instead
   // of returning duplicates and leaving avoidable blank space in My score.
   const nearby=Math.min(total,9);
   let windowStart=Math.max(1,Math.min(myRank-4,total-nearby+1));
   let windowEnd=windowStart+nearby-1;
   if(windowStart<=4){windowStart=1;windowEnd=Math.min(total,12);}
   const results=await db.batch([
    db.prepare('SELECT '+fields+' FROM leaderboard_entries ORDER BY '+order+' LIMIT 3'),
    db.prepare('SELECT '+fields+' FROM leaderboard_entries WHERE score>=? AND '+before+' ORDER BY score ASC,created_at DESC,id DESC LIMIT ?').bind(own.score,...parameters(own),myRank-windowStart),
    db.prepare('SELECT '+fields+' FROM leaderboard_entries WHERE score<=? AND '+after+' ORDER BY '+order+' LIMIT ?').bind(own.score,...parameters(own),windowEnd-myRank)
   ]);
   top=results[0].results.map((row,i)=>publicRow(row,i+1,near));
   selected=[...results[1].results.reverse(),own,...results[2].results];
  }
 }
 if(!selected.length){
  if(anchor){
   const previous=direction==='before';
   selected=(await db.prepare('SELECT '+fields+' FROM leaderboard_entries WHERE score'+(previous?'>=':'<=')+'? AND '+(previous?before:after)+' ORDER BY '+(previous?'score ASC,created_at DESC,id DESC':order)+' LIMIT ?').bind(anchor.score,...parameters(anchor),PAGE_SIZE).all()).results;
   if(previous)selected.reverse();
  }else selected=(await db.prepare('SELECT '+fields+' FROM leaderboard_entries ORDER BY '+order+' LIMIT ?').bind(PAGE_SIZE).all()).results;
 }
 const start=selected.length?(myRank===null?await rank(db,selected[0]):myRank-selected.findIndex(row=>row.id===near)):0;
 const scores=selected.map((row,i)=>publicRow(row,start+i,near));
 const unique=new Map([...top,...scores].map(row=>[row.rank,row]));
 return {limit:LIMIT,total,pageSize:PAGE_SIZE,scores:[...unique.values()].sort((a,b)=>a.rank-b.rank),myRank,
  previous:selected.length&&start>1?cursor(selected[0]):null,
  next:selected.length&&start+selected.length-1<total?cursor(selected.at(-1)):null};
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname!=='/api/leaderboard')return env.ASSETS.fetch(request);
  if(!env.SCORES_DB)return json({error:'Global leaderboard is not configured.'},503);
  try{
   if(request.method==='GET'){
    const near=url.searchParams.get('near'),value=url.searchParams.get('cursor'),direction=url.searchParams.get('direction')||'after',term=url.searchParams.get('search')?.normalize('NFC').trim();
    if((near&&!uuid(near))||!['before','after'].includes(direction))throw Error('query');
    if(term!==undefined){if(!term||Array.from(term).length>20||/[\p{C}<>]/u.test(term)||near)throw Error('query');return json(await search(env.SCORES_DB,term,value?decode(value):null,direction));}
    return json(await listing(env.SCORES_DB,{near:near?.toLowerCase(),anchor:value?decode(value):null,direction}));
   }
   if(request.method!=='POST')return json({error:'Method not allowed.'},405);
   const origin=request.headers.get('Origin');if(origin&&origin!==url.origin)return json({error:'Origin not allowed.'},403);
   if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))return json({error:'Send JSON.'},415);
   let data;try{data=await smallBody(request);}catch(error){return json({error:'Invalid score submission.'},error.message==='large'?413:400);}
   const nickname=typeof data?.nickname==='string'?data.nickname.normalize('NFC').trim():'';
   if(!nickname||Array.from(nickname).length>20||/[\p{C}<>]/u.test(nickname)||!Number.isSafeInteger(data.score)||data.score<0||!uuid(data.submissionId))return json({error:'Use a nickname of 1–20 characters and a valid score.'},400);
   const id=data.submissionId.toLowerCase();
   await env.SCORES_DB.batch([env.SCORES_DB.prepare('INSERT INTO leaderboard_entries(id,nickname,score,created_at,nickname_key) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,nickname,data.score,new Date().toISOString(),nicknameKey(nickname))]);
   const result=await listing(env.SCORES_DB,{near:id});
   return json({...result,submitted:result.myRank!==null});
  }catch(error){return error.message==='query'?json({error:'Invalid leaderboard page.'},400):json({error:'Leaderboard temporarily unavailable. Please try again.'},503);}
 }
};
