import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CATALOG,newState,restoreSave,validSave,getItem} from './economy.js';
import {LEGACY_ITEMS} from './legacy-items.js';
import {STAND_THEMES} from './layout.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.module.js';
import {PolyhavenProducts} from './polyhaven-models.js';
import * as T from './vendor/three.module.min.js';

const manifest=JSON.parse(readFileSync(new URL('./assets/polyhaven/manifest.json',import.meta.url),'utf8'));
const sources=new Map(manifest.assets.map(asset=>[asset.id,asset]));
function readGLB(item){
  const bytes=readFileSync(new URL(item.asset,import.meta.url));
  assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const length=bytes.readUInt32LE(12);assert.equal(bytes.readUInt32LE(16),0x4e4f534a);
  const json=JSON.parse(bytes.toString('utf8',20,20+length));
  const offset=20+length;assert.equal(bytes.readUInt32LE(offset+4),0x004e4942);
  return {bytes,json,bin:bytes.subarray(offset+8)};
}

test('every sale item is a distinct, downloaded and verified Poly Haven CC0 model',()=>{
  assert.ok(CATALOG.length>=300);assert.equal(manifest.partial,false);assert.equal(manifest.failedCount,0);
  assert.equal(manifest.completedCount,CATALOG.length);assert.equal(new Set(CATALOG.map(item=>item.id)).size,CATALOG.length);
  for(const item of CATALOG){
    const source=sources.get(item.id);assert.ok(source,item.id);assert.equal(item.model,item.id);
    assert.equal(source.license,'CC0-1.0');assert.equal(source.sourcePage,`https://polyhaven.com/a/${item.id}`);
    assert.ok(source.originals.length>1);assert.ok(source.originals.every(file=>/^[a-f0-9]{32}$/.test(file.md5)));
    const {bytes,json}=readGLB(item);
    assert.equal(bytes.length,item.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),source.output.sha256);
    assert.ok(json.meshes.length>0);assert.ok(json.materials.length>0);
    assert.ok(json.images?.length>0,`${item.id}: real PBR textures required`);
    assert.ok(json.images.every(image=>Number.isInteger(image.bufferView)&&!image.uri),`${item.id}: embedded textures required`);
    assert.ok(json.buffers.every(buffer=>!buffer.uri),`${item.id}: no external geometry`);
    assert.ok(item.triangles>0);
    const {min,max}=source.output.bounds;assert.ok(Math.abs(min[1])<.001);
    assert.ok(max[0]-min[0]<=.951&&max[1]-min[1]<=1.001&&max[2]-min[2]<=.721);
  }
});

test('the shipped browser decoder decodes the compressed geometry of the whole catalog',async()=>{
  await MeshoptDecoder.ready;
  for(const item of CATALOG){
    const {json,bin}=readGLB(item);
    for(const view of json.bufferViews){
      const extension=view.extensions?.EXT_meshopt_compression;if(!extension)continue;
      const source=bin.subarray(extension.byteOffset||0,(extension.byteOffset||0)+extension.byteLength);
      const target=new Uint8Array(extension.count*extension.byteStride);
      assert.doesNotThrow(()=>MeshoptDecoder.decodeGltfBuffer(target,extension.count,extension.byteStride,source,extension.mode,extension.filter),item.id);
    }
  }
});

test('the previous catalog migrates money, inventory, own prices and history without resetting progress',()=>{
  for(const replacement of Object.values(LEGACY_ITEMS))assert.ok(CATALOG.some(item=>item.id===replacement),replacement);
  const raw=newState(()=>.4);raw.version=2;raw.cash=12345.67;raw.day=12;raw.trades=88;raw.totalProfit=7654;raw.nextId=9999;
  raw.inventory=[{uid:810,itemId:'camera',quality:1,paid:35,ask:145.25,listedAt:12}];
  raw.history=[{name:'Ania',itemId:'radio',price:75,profit:40,day:11}];
  for(const key of ['market','changes']){raw[key].clothes=raw[key].tools;raw[key].phones=raw[key].kitchen;delete raw[key].tools;delete raw[key].kitchen;}
  const restored=restoreSave(raw,()=>.4);
  assert.ok(validSave(restored));assert.equal(restored.version,3);assert.equal(restored.cash,12345.67);assert.equal(restored.day,12);
  assert.equal(restored.inventory[0].itemId,'Camera_01');assert.equal(restored.inventory[0].uid,810);assert.equal(restored.inventory[0].paid,35);
  assert.equal(restored.inventory[0].ask,145.25);assert.equal(restored.inventory[0].listedAt,12);assert.equal(restored.trades,88);assert.equal(restored.totalProfit,7654);
  assert.equal(restored.history[0].itemId,'boombox');assert.equal(restored.history[0].price,75);
  assert.ok(restored.offers.every(offer=>getItem(offer.itemId).category===STAND_THEMES[offer.stand]));
  assert.equal(raw.inventory[0].itemId,'camera');
});

test('removing one stall instance does not dispose another copy of the same model',async()=>{
  const products=new PolyhavenProducts(),geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial(),scene=new T.Group();scene.add(new T.Mesh(geometry,material));
  products.loader={loadAsync:async()=>({scene})};
  let disposed=0;geometry.addEventListener('dispose',()=>disposed++);
  const a=products.create(CATALOG[0]),b=products.create(CATALOG[0]);const record=products.record(CATALOG[0]);
  for(const slot of record.slots)slot.want=true;
  await products.preload([CATALOG[0]]);assert.ok(a.userData.modelReady&&b.userData.modelReady);
  a.userData.releaseModel();assert.equal(disposed,0);assert.equal(b.userData.modelReady,true);
  b.userData.releaseModel();products.limit=0;products.trim();assert.equal(disposed,1);
});

test('the service worker precaches its new modules but loads large models only when needed',()=>{
  const sw=readFileSync(new URL('./service-worker.js',import.meta.url),'utf8');
  const precache=sw.slice(sw.indexOf('const APP_FILES'),sw.indexOf("self.addEventListener('install'"));
  for(const path of [...precache.matchAll(/'\.\/([^']+)'/g)].map(match=>match[1]))assert.ok(existsSync(new URL(path,import.meta.url)),path);
  assert.ok(!precache.includes('.glb'));assert.ok(sw.includes('dziki-sprzedawca-shell-v3-polyhaven'));
});
