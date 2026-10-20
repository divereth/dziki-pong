import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {getGame} from './games.mjs';
import {buildGame,repositoryRoot,allowedChange} from './game-tools.mjs';
import {metadataFor,validatePromotion} from './request.mjs';
import '../games/dziki-bieg/hosting/uniboar-alias/worker.test.mjs';

test('Bieg previews build the current Uniboar edition and its complete offline soundtrack',()=>{
 const output=buildGame(getGame('dziki-bieg'));
 assert.match(readFileSync(join(output,'index.html'),'utf8'),/<title>Robot Uniboar Attack<\/title>/);
 assert.match(readFileSync(join(output,'index.html'),'utf8'),/src="always-free.mp3"/);
 assert.match(readFileSync(join(output,'engine.js'),'utf8'),/PHYSICS_HZ=34/);
 const worker=readFileSync(join(output,'sw.js'),'utf8');
 assert.match(worker,/robot-uniboar-[a-f0-9]{16}/);
 for(const name of ['main.js','terrain.js','terrain-worker.js','presentation.js','forest-fairy.webp','pine-cone-round.webp','always-free.mp3']){
  assert.ok(existsSync(join(output,name)),name);
  assert.ok(worker.includes('./'+name),'offline cache includes '+name);
 }
 assert.equal(existsSync(join(output,'game.js')),false,'retired entry point is absent');
 assert.equal(existsSync(join(output,'viewport.js')),false,'retired viewport is absent');
 assert.equal(worker,readFileSync(join(repositoryRoot,'games/dziki-bieg/dist/sw.js'),'utf8'));
 assert.equal(readFileSync(join(output,'_worker.js'),'utf8'),readFileSync(join(repositoryRoot,'games/dziki-bieg/backend/worker.mjs'),'utf8'));
 assert.deepEqual(JSON.parse(readFileSync(join(output,'_routes.json'),'utf8')),{version:1,include:['/api/leaderboard'],exclude:[]});
 assert.ok(worker.includes('./leaderboard.js'));
 for(const file of ['dist/_worker.js','dist/_routes.json','backend/worker.mjs','backend/schema.sql'])assert.equal(allowedChange(getGame('dziki-bieg'),'games/dziki-bieg/'+file),false);
});

test('Uniboar request metadata permits current previews and blocks old Bieg promotions',()=>{
 const game=getGame('dziki-bieg'),env={REQUEST_ID:'request-123',REQUEST_TEXT:'Dodaj więcej liści',DISCORD_CHANNEL_ID:'bieg-channel'};
 const data=metadataFor(env,game),paths=['games/dziki-bieg/dist/art.js'];
 const prFor=metadata=>({baseRefName:'main',headRefName:'discord/request-123',body:`<!-- dziki-pong-request:start -->\n${JSON.stringify(metadata)}\n<!-- dziki-pong-request:end -->`});
 assert.equal(data.source_version,'robot-uniboar-attack-v1');
 assert.equal(validatePromotion(prFor(data),game,env.REQUEST_ID,env.DISCORD_CHANNEL_ID,paths).source_version,data.source_version);
 const legacy={...data};delete legacy.source_version;
 assert.throws(()=>validatePromotion(prFor(legacy),game,env.REQUEST_ID,env.DISCORD_CHANNEL_ID,['games/dziki-bieg/dist/engine.js']),/old Dziki Bieg/);
 assert.throws(()=>validatePromotion(prFor({...data,source_version:'old-bieg'}),game,env.REQUEST_ID,env.DISCORD_CHANNEL_ID,paths),/old Dziki Bieg/);
 assert.equal(metadataFor(env,getGame('dziki-pong')).source_version,undefined,'other games retain their metadata');
});
