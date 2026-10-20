import {test} from 'node:test';import assert from 'node:assert/strict';
import {Renderer} from '../dist/art.js';
function renderer(){return Object.assign(Object.create(Renderer.prototype),{terrainJobs:new Map(),terrainQueue:[],terrainPlatforms:new Set(['current']),terrainCache:new Map(),terrainCacheBytes:0});}
test('terrain cache releases evicted bitmaps and stays within its memory budget',()=>{
 const r=renderer();let closed=0;
 for(let i=0;i<40;i++)r.cacheTerrain('tile'+i,{bytes:1024*1024,canvas:{close(){closed++;}}});
 assert.equal(r.terrainCacheBytes,32*1024*1024);assert.equal(r.terrainCache.size,32);assert.equal(closed,8);assert.equal(r.terrainCache.has('tile0'),false);assert.equal(r.terrainCache.has('tile39'),true);
});
test('worker queue is bounded, discards retired terrain and recovers from worker failure',()=>{
 const originalWorker=globalThis.Worker,originalCanvas=globalThis.OffscreenCanvas;
 let closed=0,terminated=0;const sent=[];
 globalThis.OffscreenCanvas=class {};
 globalThis.Worker=class {postMessage(job){sent.push(job);}terminate(){terminated++;}};
 try{
  const r=renderer();r.initTerrainWorker();const worker=r.terrainWorker;
  for(let i=0;i<40;i++)r.queueTerrain({key:'old'+i,prefix:'current',visible:false});
  assert.equal(sent.length,1);assert.equal(r.terrainJobs.size,24);
  r.terrainPlatforms=new Set(['new']);
  worker.onmessage({data:{key:'old0',bitmap:{close(){closed++;}},bytes:100}});
  assert.equal(closed,1);assert.equal(r.terrainCache.size,0);assert.equal(r.terrainJobs.size,0);assert.equal(r.terrainQueue.length,0);
  r.queueTerrain({key:'new0',prefix:'new',visible:true});assert.equal(sent.length,2);
  worker.onmessage({data:{key:'new0',error:true}});
  assert.equal(r.terrainWorker,null);assert.equal(terminated,1);assert.equal(r.terrainJobs.size,0);assert.equal(r.terrainRunning,false);
 }finally{globalThis.Worker=originalWorker;globalThis.OffscreenCanvas=originalCanvas;}
});
