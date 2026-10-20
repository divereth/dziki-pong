const LIMIT=6,MAX_BODY=1024;
const ranking='SELECT id,nickname,score,created_at FROM scores ORDER BY score DESC,created_at ASC,id ASC LIMIT 6';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const rows=result=>result.results.map((row,i)=>({rank:i+1,nickname:row.nickname,score:row.score,createdAt:row.created_at}));
async function smallBody(request){
 const reader=request.body?.getReader();if(!reader)throw Error('invalid');
 let size=0,text='';const decoder=new TextDecoder();
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){await reader.cancel();throw Error('large');}text+=decoder.decode(value,{stream:true});}
 return JSON.parse(text+decoder.decode());
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname!=='/api/leaderboard')return env.ASSETS.fetch(request);
  if(!env.SCORES_DB)return json({error:'Global leaderboard is not configured.'},503);
  try{
   if(request.method==='GET')return json({limit:LIMIT,scores:rows(await env.SCORES_DB.prepare(ranking).all())});
   if(request.method!=='POST')return json({error:'Method not allowed.'},405);
   const origin=request.headers.get('Origin');if(origin&&origin!==url.origin)return json({error:'Origin not allowed.'},403);
   if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))return json({error:'Send JSON.'},415);
   let data;try{data=await smallBody(request);}catch(error){return json({error:'Invalid score submission.'},error.message==='large'?413:400);}
   const nickname=typeof data?.nickname==='string'?data.nickname.normalize('NFC').trim():'';
   if(!nickname||Array.from(nickname).length>20||/[\p{C}<>]/u.test(nickname)||!Number.isSafeInteger(data.score)||data.score<1||data.score>10000000||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(data.submissionId||''))return json({error:'Use a nickname of 1–20 characters and a valid score.'},400);
   const id=data.submissionId.toLowerCase(),created=new Date().toISOString();
   const result=await env.SCORES_DB.batch([
    env.SCORES_DB.prepare('INSERT INTO scores(id,nickname,score,created_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM scores WHERE score>=?)<6 ON CONFLICT(id) DO NOTHING').bind(id,nickname,data.score,created,data.score),
    env.SCORES_DB.prepare('DELETE FROM scores WHERE id NOT IN (SELECT id FROM scores ORDER BY score DESC,created_at ASC,id ASC LIMIT 6)'),
    env.SCORES_DB.prepare(ranking)
   ]);
   const saved=result[2].results.find(row=>row.id===id);
   return json({submitted:!!saved,limit:LIMIT,scores:rows(result[2])});
  }catch{return json({error:'Leaderboard temporarily unavailable. Please try again.'},503);}
 }
};
