import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.module.js';
import {MarketCharacters,CHARACTER_MODELS,CIVILIAN_MODELS,characterFor} from './characters.js';
import {MarketWorld} from './world.js';

const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),templates=new Map();
async function loadModel(id){
  if(!templates.has(id))templates.set(id,(async()=>{
    const bytes=await readFile(new URL(`./assets/characters/${id}.glb`,import.meta.url));
    return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  })());
  return templates.get(id);
}

test('all 14 local CC0 assets are distinct, compressed, skinned and contain working idle/walk clips',async()=>{
  const report=JSON.parse(await readFile(new URL('./assets/characters/asset-info.json',import.meta.url)));
  assert.equal(report.license,'CC0-1.0');assert.equal(report.models.length,14);
  assert.equal(new Set(report.models.map(m=>m.sha256)).size,14);
  assert.ok(report.models.reduce((n,m)=>n+m.bytes,0)<3*1024*1024);
  for(const record of report.models){
    const bytes=await readFile(new URL(`./assets/characters/${record.file}`,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);
    assert.equal(record.drawCalls,1);assert.ok(record.triangles<10000);
    const gltf=await loadModel(record.id),skins=[];
    gltf.scene.traverse(o=>{if(o.isSkinnedMesh)skins.push(o);});
    assert.equal(skins.length,1);assert.ok(skins[0].geometry.getAttribute('color'));
    assert.ok(skins[0].skeleton.bones.length>15);
    assert.deepEqual(gltf.animations.map(a=>a.name).sort(),['idle','walk']);
  }
});

test('civilians vary; police and guard use reserved models and independent animated skeletons',async()=>{
  const characters=new MarketCharacters({loadModel});await characters.load();
  assert.equal(new Set(Array.from({length:18},(_,i)=>characterFor('customer',i))).size,12);
  assert.equal(CIVILIAN_MODELS.length,12);
  const a=characters.create('customer',0),b=characters.create('customer',12);
  let skinA,skinB;a.traverse(o=>{if(o.isSkinnedMesh)skinA=o;});b.traverse(o=>{if(o.isSkinnedMesh)skinB=o;});
  assert.equal(skinA.geometry,skinB.geometry);assert.notEqual(skinA.skeleton.bones[0],skinB.skeleton.bones[0]);
  const poseB=skinB.skeleton.bones.map(b=>b.quaternion.toArray());
  a.userData.walking=true;characters.animate(a,.28);
  assert.deepEqual(skinB.skeleton.bones.map(b=>b.quaternion.toArray()),poseB);
  for(const id of CHARACTER_MODELS){
    const role=['police','guard'].includes(id)?id:'vendor';
    const actor=characters.create(role,Math.max(0,CIVILIAN_MODELS.indexOf(id)));
    actor.userData.walking=true;
    for(let i=0;i<12;i++){
      characters.animate(actor,.12);actor.updateMatrixWorld(true);
      actor.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();o.boundingBox=null;}});
      const bounds=new T.Box3().setFromObject(actor);
      assert.ok(bounds.min.y>-.25&&bounds.max.y<2.35,`${id} stays grounded: ${bounds.min.y}..${bounds.max.y}`);
      assert.ok(bounds.max.x<1.5&&bounds.min.x> -1.5,`${id} stays in place`);
    }
    assert.equal(actor.userData.characterId,id);
  }
});

test('a customer can still be selected for negotiation after its animated model loads',async()=>{
  const characters=new MarketCharacters({loadModel}),scene=new T.Scene(),actor=characters.create('customer',7);scene.add(actor);
  const target=actor.userData.hitTarget;
  const camera=new T.PerspectiveCamera(66,1,.05,100);camera.position.set(0,1.5,4);camera.lookAt(0,1,0);camera.updateMatrixWorld();
  const world={camera,ray:new T.Raycaster(),customerHitTargets:[target],visiblePath:()=>true};
  scene.updateMatrixWorld(true);assert.equal(MarketWorld.prototype.pickCustomer.call(world),7);
  await characters.load();characters.animate(actor,.4);scene.updateMatrixWorld(true);
  assert.equal(MarketWorld.prototype.pickCustomer.call(world),7);assert.equal(actor.userData.hitTarget,target);
  actor.visible=false;assert.equal(MarketWorld.prototype.pickCustomer.call(world),null);
});

test('failed downloads can be retried without duplicate actors or replacing already loaded templates',async()=>{
  let fail=true,concurrent=0,maxConcurrent=0;
  const characters=new MarketCharacters({loadModel:async id=>{
    concurrent++;maxConcurrent=Math.max(maxConcurrent,concurrent);
    try{if(fail&&id===CHARACTER_MODELS[0]){fail=false;throw new Error('offline');}return await loadModel(id);}
    finally{concurrent--;}
  }});
  const actor=characters.create('customer',0);
  await assert.rejects(characters.load(),/offline/);
  const loaded=characters.templates.get(CHARACTER_MODELS[1]);
  await characters.load();assert.equal(characters.templates.size,14);
  assert.equal(characters.templates.get(CHARACTER_MODELS[1]),loaded);
  assert.equal(characters.actors.length,1);assert.equal(actor.children.filter(c=>c===actor.userData.body).length,1);
  assert.ok(maxConcurrent<=3);
});
