import * as T from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {clone as cloneSkeleton} from './vendor/SkeletonUtils.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.module.js';
import {box,ring} from './models.js';

export const CIVILIAN_MODELS=[
  'casual-woman','jacket-man','older-woman','casual-man',
  'sport-woman','worker-man','jacket-woman','older-man',
  'chef-woman','sport-man','worker-woman','chef-man',
];
export const CHARACTER_MODELS=[...CIVILIAN_MODELS,'police','guard'];
const hitGeometry=new T.BoxGeometry(.66,1.86,.52);
const hitMaterial=new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false});
const position=new T.Vector3();

export function characterFor(role,index=0){
  if(role==='police'||role==='guard')return role;
  const offset=role==='customer'?4:0;
  return CIVILIAN_MODELS[((index+offset)%CIVILIAN_MODELS.length+CIVILIAN_MODELS.length)%CIVILIAN_MODELS.length];
}

// Templates, geometry and materials are shared, but every actor has its own
// cloned skeleton and mixer. Loading is bounded and can be retried safely.
export class MarketCharacters{
  constructor({mobile=false,loadModel}={}){
    const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    this.loadModel=loadModel||((id)=>loader.loadAsync(new URL(`./assets/characters/${id}.glb?characters=3`,import.meta.url).href));
    this.mobile=mobile;this.templates=new Map();this.actors=[];this.pending=null;
    this.lastTime=0;this.lastAnimationTime=-Infinity;
  }
  load(){
    if(this.pending)return this.pending;
    this.pending=(async()=>{
      const missing=CHARACTER_MODELS.filter(id=>!this.templates.has(id));let next=0;
      const workers=await Promise.allSettled(Array.from({length:Math.min(3,missing.length)},async()=>{
        while(next<missing.length){
          const id=missing[next++],gltf=await this.loadModel(id);
          if(!gltf.animations.some(a=>a.name==='idle')||!gltf.animations.some(a=>a.name==='walk'))throw new Error(`Missing NPC animations: ${id}`);
          this.templates.set(id,gltf);
          for(const actor of this.actors)if(actor.userData.characterId===id&&!actor.userData.body)this.attach(actor,gltf);
        }
      }));
      const failed=workers.find(result=>result.status==='rejected');if(failed)throw failed.reason;
      return this;
    })().catch(error=>{this.pending=null;throw error;});
    return this.pending;
  }
  create(role='vendor',index=0){
    const root=new T.Group(),id=characterFor(role,index);
    root.name=`npc-${role}-${index}`;
    const height=role==='guard'?1.98:role==='police'?1.83:1.65+(index%5)*.038;
    root.userData={role,characterId:id,height,phase:index*.73,walking:false};
    if(role==='customer'){
      const hit=new T.Mesh(hitGeometry,hitMaterial);hit.position.y=.93;
      hit.userData.customer=index;root.add(hit);root.userData.hitTarget=hit;
      const bag=new T.Group();bag.position.set(.36,.6,.05);
      box(bag,0,0,0,.23,.28,.15,index%2?'#c7a167':'#a29a70');
      ring(bag,0,.17,0,.06,.012,'#705f43');bag.visible=false;
      root.add(bag);root.userData.bag=bag;
    }
    this.actors.push(root);
    const template=this.templates.get(id);if(template)this.attach(root,template);
    return root;
  }
  attach(root,gltf){
    const body=cloneSkeleton(gltf.scene),mixer=new T.AnimationMixer(body);
    const actions=new Map(gltf.animations.map(clip=>[clip.name,mixer.clipAction(clip)]));
    body.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;o.frustumCulled=false;o.userData.characterShared=true;}});
    actions.get('idle').play();mixer.update(root.userData.phase);
    body.updateMatrixWorld(true);body.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
    const bounds=new T.Box3().setFromObject(body),scale=root.userData.height/(bounds.max.y-bounds.min.y);
    body.scale.setScalar(scale);body.position.y=-bounds.min.y*scale;
    if(root.userData.role==='guard'){body.scale.x*=1.04;body.scale.z*=1.08;}
    root.add(body);Object.assign(root.userData,{body,mixer,actions,current:'idle'});
    this.animate(root,0);
  }
  animate(root,dt){
    const data=root.userData;if(!data.mixer)return;
    const name=data.walking?'walk':'idle';
    if(name!==data.current){
      const previous=data.actions.get(data.current),next=data.actions.get(name);
      next.reset().play();previous.crossFadeTo(next,.18,false);data.current=name;
    }
    data.actions.get('walk').timeScale=data.role==='police'?.9:1.05+(data.phase%3)*.07;
    data.mixer.update(dt);
    if(data.bag)data.bag.rotation.x=data.walking?Math.sin(data.mixer.time*6)*.12:0;
  }
  update(time,camera){
    const interval=this.mobile?1/15:1/24;
    if(time-this.lastAnimationTime<interval&&time>=this.lastAnimationTime)return;
    const dt=Math.min(.2,Math.max(0,time-this.lastTime));
    this.lastTime=time;this.lastAnimationTime=time;
    for(const actor of this.actors){
      if(!actor.userData.body)continue;
      let visible=true;for(let parent=actor;parent;parent=parent.parent)if(!parent.visible){visible=false;break;}
      if(!visible)continue;
      actor.getWorldPosition(position);const distance=position.distanceToSquared(camera.position);
      actor.userData.body.visible=distance<65*65;
      if(distance<26*26)this.animate(actor,dt);
    }
  }
}
