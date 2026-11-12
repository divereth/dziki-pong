import * as T from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.module.js';
import {clone as cloneModel} from './vendor/SkeletonUtils.js';
import {CATALOG} from './catalog.js';

// Geometry, PBR materials and textures belong to the cache, never to stall clones.
export class PolyhavenProducts {
  constructor({mobile=false,onChange=()=>{},onStatus=()=>{}}={}) {
    this.loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    this.items=new Map(CATALOG.map(item=>[item.id,item]));
    this.records=new Map();this.slots=new Set();this.queue=[];this.inflight=0;
    this.parallel=mobile?2:3;this.radius=mobile?23:31;this.limit=mobile?28:48;
    this.onChange=onChange;this.onStatus=onStatus;this.lastUpdate=-1;
    this.thumbnails=new Map();this.thumbnailQueue=[];this.previewSize=128;
    this.position=new T.Vector3();this.disposed=false;
  }
  record(item) {
    if(!this.records.has(item.id))this.records.set(item.id,{item,status:'idle',source:null,slots:new Set(),last:0,preview:false,promise:null});
    return this.records.get(item.id);
  }
  create(item,scale=1) {
    const root=new T.Group(),record=this.record(item);
    const slot={root,record,alive:true,want:false,instance:null};
    root.scale.setScalar(scale);root.userData.modelReady=false;
    root.userData.releaseModel=()=>this.release(slot);
    this.slots.add(slot);record.slots.add(slot);return root;
  }
  attach(slot) {
    if(!slot.alive||slot.instance||!slot.want||!slot.record.source)return;
    slot.instance=cloneModel(slot.record.source);
    slot.instance.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;object.userData.polyhavenShared=true;}});
    slot.root.add(slot.instance);slot.root.userData.modelReady=true;
    slot.record.last=performance.now();this.onChange();
  }
  detach(slot) {
    if(slot.instance){slot.instance.removeFromParent();slot.instance=null;slot.root.userData.modelReady=false;this.onChange();}
  }
  release(slot) {
    slot.alive=false;this.detach(slot);slot.record.slots.delete(slot);this.slots.delete(slot);
  }
  ensure(record) {
    if(record.status==='ready')return Promise.resolve(record);
    if(record.status==='error')return Promise.reject(record.error);
    if(!record.promise){
      record.status='queued';record.promise=new Promise((resolve,reject)=>{record.resolve=resolve;record.reject=reject;});
      this.queue.push(record);this.pump();
    }
    return record.promise;
  }
  pump() {
    while(!this.disposed&&this.inflight<this.parallel&&this.queue.length){
      const record=this.queue.shift();this.inflight++;record.status='loading';
      this.loader.loadAsync(record.item.asset).then(gltf=>{
        record.source=gltf.scene;record.status='ready';record.last=performance.now();
        record.source.traverse(object=>{if(object.isMesh){object.userData.polyhavenShared=true;}});
        for(const slot of record.slots)this.attach(slot);
        record.resolve(record);
      }).catch(error=>{record.status='error';record.error=error;record.reject(error);console.warn(`Model Poly Haven niedostępny: ${record.item.id}`);})
        .finally(()=>{this.inflight--;this.status();this.pump();this.trim();});
    }
    this.status();
  }
  preload(items) {return Promise.all(items.map(item=>this.ensure(this.record(item))));}
  retry() {
    for(const record of this.records.values())if(record.status==='error'){
      record.status='idle';record.promise=null;record.error=null;
      if(record.preview||[...record.slots].some(slot=>slot.want))this.ensure(record).catch(()=>{});
    }
    this.status();
  }
  status() {
    const relevant=[...this.records.values()].filter(record=>record.preview||[...record.slots].some(slot=>slot.want));
    this.onStatus({loading:relevant.filter(r=>['idle','queued','loading'].includes(r.status)).length,failed:relevant.filter(r=>r.status==='error').length,ready:relevant.filter(r=>r.status==='ready').length,total:relevant.length});
  }
  update(camera,time) {
    if(time-this.lastUpdate<.3&&this.lastUpdate>=0)return;this.lastUpdate=time;
    const near=[];
    for(const slot of this.slots){
      slot.root.getWorldPosition(this.position);
      const distance=this.position.distanceTo(camera.position);
      slot.want=distance<(slot.instance?this.radius+5:this.radius);
      if(slot.want){near.push({slot,distance});if(slot.record.status==='ready')this.attach(slot);}
      else this.detach(slot);
    }
    near.sort((a,b)=>a.distance-b.distance);
    for(const {slot} of near)this.ensure(slot.record).catch(()=>{});
    this.trim();this.status();
  }
  trim() {
    const ready=[...this.records.values()].filter(r=>r.source);
    const unused=ready.filter(r=>!r.preview&&![...r.slots].some(slot=>slot.instance)).sort((a,b)=>a.last-b.last);
    while(ready.length>this.limit&&unused.length){
      const record=unused.shift();const geometries=new Set(),materials=new Set(),textures=new Set();
      record.source.traverse(object=>{if(object.isMesh){geometries.add(object.geometry);for(const material of (Array.isArray(object.material)?object.material:[object.material])){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}}});
      geometries.forEach(g=>g.dispose());textures.forEach(t=>{t.dispose();t.source?.data?.close?.();});materials.forEach(m=>m.dispose());
      record.source=null;record.status='idle';record.promise=null;ready.pop();
    }
  }
  updatePreviews(renderer,environment) {
    for(const image of document.querySelectorAll('img[data-model-preview]:not([src])')){
      const id=image.dataset.modelPreview;
      if(this.thumbnails.has(id)){image.src=this.thumbnails.get(id);continue;}
      const item=this.items.get(id);if(!item)continue;const record=this.record(item);
      if(!record.preview){record.preview=true;this.thumbnailQueue.push(record);this.ensure(record).catch(()=>{});}
    }
    const index=this.thumbnailQueue.findIndex(r=>r.status==='ready');if(index<0)return;
    const record=this.thumbnailQueue.splice(index,1)[0];
    if(!this.previewScene){
      this.previewScene=new T.Scene();this.previewScene.add(new T.HemisphereLight(0xffffff,0xb8a487,2.2));
      const light=new T.DirectionalLight(0xffffff,3);light.position.set(-2,4,3);this.previewScene.add(light);
      this.previewCamera=new T.PerspectiveCamera(38,1,.01,10);this.previewCamera.position.set(1.35,1.1,1.8);this.previewCamera.lookAt(0,.4,0);
      this.previewTarget=new T.WebGLRenderTarget(this.previewSize,this.previewSize,{samples:4});
      this.previewCanvas=document.createElement('canvas');this.previewCanvas.width=this.previewCanvas.height=this.previewSize;
      this.pixels=new Uint8Array(this.previewSize*this.previewSize*4);
    }
    const instance=cloneModel(record.source);this.previewScene.add(instance);this.previewScene.environment=environment;
    const previousTarget=renderer.getRenderTarget(),color=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha(),shadows=renderer.shadowMap.enabled,shadowUpdate=renderer.shadowMap.needsUpdate;
    try{
      renderer.shadowMap.enabled=false;renderer.setRenderTarget(this.previewTarget);renderer.setClearColor(0xf0eadb,0);renderer.clear();renderer.render(this.previewScene,this.previewCamera);
      renderer.readRenderTargetPixels(this.previewTarget,0,0,this.previewSize,this.previewSize,this.pixels);
      const context=this.previewCanvas.getContext('2d'),data=context.createImageData(this.previewSize,this.previewSize),row=this.previewSize*4;
      for(let y=0;y<this.previewSize;y++)data.data.set(this.pixels.subarray((this.previewSize-1-y)*row,(this.previewSize-y)*row),y*row);
      context.putImageData(data,0,0);this.thumbnails.set(record.item.id,this.previewCanvas.toDataURL('image/webp',.85));
      if(this.thumbnails.size>128)this.thumbnails.delete(this.thumbnails.keys().next().value);
    }finally{
      renderer.setRenderTarget(previousTarget);renderer.setClearColor(color,alpha);renderer.shadowMap.enabled=shadows;renderer.shadowMap.needsUpdate=shadowUpdate;
      instance.removeFromParent();record.preview=false;record.last=performance.now();
    }
  }
}
