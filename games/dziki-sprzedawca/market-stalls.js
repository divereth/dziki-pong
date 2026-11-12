import * as T from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

// Query version also invalidates the on-demand service-worker model cache.
export const STALL_MODEL='./assets/market-stall/stragan.glb?v=weathered-2';
export const CANOPY_COLORS=['#748763','#985b56','#546f91','#ac9557','#b17b56','#568b89','#81878b','#89718e'];
const baseColor=new T.Color(CANOPY_COLORS[0]);

export function canopyVariant(source,index){
  const material=source.clone(),tint=new T.Color(CANOPY_COLORS[index%CANOPY_COLORS.length]);
  tint.r/=baseColor.r;tint.g/=baseColor.g;tint.b/=baseColor.b;
  // Recolor only the olive stripes. Linen, dirt, weave and all PBR maps survive.
  material.onBeforeCompile=shader=>{
    shader.uniforms.canopyTint={value:tint};
    shader.fragmentShader='uniform vec3 canopyTint;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      #ifdef USE_MAP
      float stripe=1.0-step(0.5,mod(floor(clamp(vMapUv.x,0.0,0.99999)*8.0),2.0));
      diffuseColor.rgb*=mix(vec3(1.0),canopyTint,stripe);
      #endif`);
  };
  material.customProgramCacheKey=()=> 'weathered-canopy-v1';
  material.name=`Canvas ${index+1}`;
  return material;
}

export function mergeStallParts(source){
  source.updateMatrixWorld(true);
  const buckets=new Map();
  source.traverse(object=>{
    if(!object.isMesh)return;
    if(Array.isArray(object.material))throw new Error('Unexpected multi-material stall part');
    const material=object.material;
    if(!buckets.has(material))buckets.set(material,[]);
    let geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    for(const key of Object.keys(geometry.attributes))if(!['position','normal','uv'].includes(key))geometry.deleteAttribute(key);
    if(!geometry.getAttribute('uv'))geometry.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count*2),2));
    buckets.get(material).push(geometry);
  });
  return [...buckets].map(([material,geometries])=>{
    const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
    if(!geometry)throw new Error('Cannot merge stall geometry');
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    return {geometry,material,canopy:material.name.includes('canvas')};
  });
}

export class MarketStalls{
  constructor(scene,{anisotropy=4}={}){this.scene=scene;this.anisotropy=anisotropy;this.promise=null;this.meshes=[];this.loader=new GLTFLoader();}
  load(placements){
    if(this.promise)return this.promise;
    this.promise=this.loader.loadAsync(STALL_MODEL).then(({scene})=>{
      const parts=mergeStallParts(scene),matrix=new T.Matrix4();
      for(const part of parts){
        for(const value of Object.values(part.material))if(value?.isTexture)value.anisotropy=this.anisotropy;
        const variants=part.canopy?CANOPY_COLORS.map((_,i)=>({material:canopyVariant(part.material,i),placements:placements.filter(p=>p.color===i)})):[{material:part.material,placements}];
        for(const variant of variants){
          if(!variant.placements.length)continue;
          const mesh=new T.InstancedMesh(part.geometry,variant.material,variant.placements.length);
          mesh.name=part.canopy?`Stragany | ${variant.material.name}`:`Stragany | ${part.material.name}`;
          mesh.castShadow=true;mesh.receiveShadow=true;
          variant.placements.forEach((p,i)=>{p.root.updateWorldMatrix(true,false);matrix.copy(p.root.matrixWorld);if(p.offset)matrix.multiply(new T.Matrix4().makeTranslation(...p.offset));if(p.scale)matrix.scale(new T.Vector3(...p.scale));mesh.setMatrixAt(i,matrix);});
          mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
          this.scene.add(mesh);this.meshes.push(mesh);
        }
      }
      this.ready=true;return this;
    }).catch(error=>{this.promise=null;throw error;});
    return this.promise;
  }
}
