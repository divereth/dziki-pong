import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from './vendor/three.module.min.js';
import {MarketStalls,mergeStallParts,canopyVariant,CANOPY_COLORS} from './market-stalls.js';
import {STANDS,PLAYER_SHOP} from './layout.js';

// Decode the shipped uncompressed GLB geometry without a browser/image decoder.
function assetScene(){
  const bytes=readFileSync(new URL('./assets/market-stall/stragan.glb',import.meta.url));
  assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);
  const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.toString('utf8',20,20+length)),bin=bytes.subarray(28+length);
  const types={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5121:Uint8Array},sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
  function accessor(index){
    const a=json.accessors[index],view=json.bufferViews[a.bufferView],Type=types[a.componentType],size=sizes[a.type];
    assert.ok(!view.byteStride,'Fixture decoder expects packed accessors');
    const data=bin.subarray((view.byteOffset||0)+(a.byteOffset||0),(view.byteOffset||0)+(a.byteOffset||0)+a.count*size*Type.BYTES_PER_ELEMENT);
    const copied=Uint8Array.from(data);return new T.BufferAttribute(new Type(copied.buffer),size,!!a.normalized);
  }
  const materials=json.materials.map(m=>new T.MeshStandardMaterial({name:m.name}));
  function node(index){
    const source=json.nodes[index],group=new T.Group();
    if(source.matrix)group.applyMatrix4(new T.Matrix4().fromArray(source.matrix));
    else{if(source.translation)group.position.fromArray(source.translation);if(source.rotation)group.quaternion.fromArray(source.rotation);if(source.scale)group.scale.fromArray(source.scale);}
    if(source.mesh!==undefined)for(const p of json.meshes[source.mesh].primitives){
      const geometry=new T.BufferGeometry();for(const [key,index] of Object.entries(p.attributes)){const attr={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv'}[key];if(attr)geometry.setAttribute(attr,accessor(index));}
      if(p.indices!==undefined)geometry.setIndex(accessor(p.indices));group.add(new T.Mesh(geometry,materials[p.material]));
    }
    for(const child of source.children||[])group.add(node(child));return group;
  }
  const scene=new T.Group();for(const index of json.scenes[json.scene||0].nodes)scene.add(node(index));
  return {scene,json};
}

test('shipped stall has correct game orientation, dimensions and embedded PBR maps',()=>{
  const {scene,json}=assetScene(),bounds=new T.Box3().setFromObject(scene),size=bounds.getSize(new T.Vector3());
  assert.ok(Math.abs(size.x-4.6)<.05);assert.ok(size.y>2.9&&size.y<3);assert.ok(size.z>2.3&&size.z<2.4);assert.ok(Math.abs(bounds.min.y)<.01);
  assert.ok(json.images.every(image=>image.bufferView!==undefined));
  for(const name of ['Weathered oak | grain','Woven olive and linen canvas']){
    const m=json.materials.find(m=>m.name===name);assert.ok(m.normalTexture);assert.ok(m.pbrMetallicRoughness.baseColorTexture);assert.ok(m.pbrMetallicRoughness.metallicRoughnessTexture);
  }
  const parts=mergeStallParts(scene);assert.equal(parts.length,5);assert.equal(parts.filter(p=>p.canopy).length,1);
  assert.equal(parts.reduce((n,p)=>n+p.geometry.getAttribute('position').count/3,0),23392);
});

test('24 market stalls and player stall share geometry in 12 instanced batches',async()=>{
  const {scene:source}=assetScene(),scene=new T.Scene(),stalls=new MarketStalls(scene);let requests=0;
  stalls.loader={loadAsync:async()=>{requests++;return {scene:source};}};
  const placements=STANDS.map(([x,z,r],i)=>{const root=new T.Group();root.position.set(x,0,z);root.rotation.y=r;scene.add(root);return {root,color:(i*5+3)%8,offset:[0,0,.3]};});
  const player=new T.Group();player.position.set(PLAYER_SHOP.x,0,PLAYER_SHOP.z);player.rotation.y=-.55;scene.add(player);
  placements.push({root:player,color:0,scale:[.74,1.44/1.06,.8]});
  await Promise.all([stalls.load(placements),stalls.load(placements)]);assert.equal(requests,1);assert.equal(stalls.meshes.length,12);
  const shared=stalls.meshes.filter(m=>!m.name.includes('Canvas'));assert.equal(shared.length,4);assert.ok(shared.every(m=>m.count===25));
  const canopies=stalls.meshes.filter(m=>m.name.includes('Canvas'));assert.equal(canopies.length,8);assert.equal(canopies.reduce((n,m)=>n+m.count,0),25);assert.equal(new Set(canopies.map(m=>m.geometry)).size,1);
  const matrix=new T.Matrix4();shared[0].getMatrixAt(24,matrix);const scale=new T.Vector3(),position=new T.Vector3();matrix.decompose(position,new T.Quaternion(),scale);
  assert.ok(Math.abs(position.x-PLAYER_SHOP.x)<1e-5);assert.ok(Math.abs(scale.y*1.06-1.44)<1e-5);
  shared[0].getMatrixAt(0,matrix);position.setFromMatrixPosition(matrix);assert.ok(Math.abs(position.x-(STANDS[0][0]+.3))<1e-5);
  const oldMaterial=source.children[0];assert.ok(oldMaterial);assert.ok(stalls.ready);
});

test('canopy variants preserve maps and tint only colored stripes',()=>{
  const material=new T.MeshStandardMaterial({map:new T.Texture(),normalMap:new T.Texture(),roughnessMap:new T.Texture()});
  const variants=CANOPY_COLORS.map((_,i)=>canopyVariant(material,i));assert.equal(new Set(CANOPY_COLORS).size,8);
  for(const variant of variants){
    assert.equal(variant.map,material.map);assert.equal(variant.normalMap,material.normalMap);assert.equal(variant.roughnessMap,material.roughnessMap);
    const shader={uniforms:{},fragmentShader:'#include <map_fragment>'};variant.onBeforeCompile(shader);assert.ok(shader.uniforms.canopyTint);assert.ok(shader.fragmentShader.includes('vMapUv.x'));assert.ok(shader.fragmentShader.includes('mix(vec3(1.0),canopyTint,stripe)'));
  }
});

test('failed stall request can be retried without leaving partial scene copies',async()=>{
  const scene=new T.Scene(),stalls=new MarketStalls(scene);let attempts=0;
  stalls.loader={loadAsync:async()=>{if(++attempts===1)throw new Error('offline');return {scene:assetScene().scene};}};
  const root=new T.Group();scene.add(root);const placements=[{root,color:0}];
  await assert.rejects(stalls.load(placements),/offline/);assert.equal(stalls.meshes.length,0);await stalls.load(placements);assert.equal(attempts,2);assert.equal(stalls.meshes.length,5);
});
