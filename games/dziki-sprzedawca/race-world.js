import * as T from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {box,cylinder,label} from './models.js';
import {TRACK,CAR_STATS,CAR_COLORS,trackPoint} from './racing.js';

const up=new T.Vector3(0,1,0);
function strip(a,b,color,y=.006){
  const count=560,vertices=[],indices=[];
  for(let i=0;i<=count;i++)for(const offset of [a,b]){const p=trackPoint(i/count*TRACK.length,offset);vertices.push(p.x,y,p.z);}
  for(let i=0;i<count;i++){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:.96,side:T.DoubleSide}));mesh.receiveShadow=true;return mesh;
}
function instances(parent,geometry,material,placements){
  const mesh=new T.InstancedMesh(geometry,material,placements.length),dummy=new T.Object3D();
  placements.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.heading||0,0);dummy.scale.set(p.w||1,p.h||1,p.d||1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
  mesh.receiveShadow=true;mesh.computeBoundingSphere();parent.add(mesh);return mesh;
}
function standard(color){return new T.MeshStandardMaterial({color,roughness:.85});}

export class RaceWorld{
  constructor(renderer,{environment,mobile=false}={}){
    this.renderer=renderer;this.mobile=mobile;this.scene=new T.Scene();this.scene.background=new T.Color('#b8d1dc');this.scene.fog=new T.Fog('#b8cfcf',175,440);this.scene.environment=environment;this.scene.environmentIntensity=.5;
    this.camera=new T.PerspectiveCamera(62,1,.1,520);this.cars=[];this.ready=null;this.active=false;
    this.scene.add(new T.HemisphereLight('#eff6ff','#6c785b',1.65));
    const sun=new T.DirectionalLight('#ffe8c7',2.5);sun.position.set(-80,150,-70);sun.target.position.set(0,0,0);sun.castShadow=true;sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);Object.assign(sun.shadow.camera,{left:-190,right:190,top:140,bottom:-140,near:1,far:420});sun.shadow.bias=-.0005;sun.shadow.normalBias=.05;this.scene.add(sun,sun.target);
    this.buildTrack();
  }
  buildTrack(){
    const scene=this.scene;
    const ground=new T.Mesh(new T.PlaneGeometry(1200,1000),standard('#91a27b'));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
    scene.add(strip(-TRACK.halfWidth,TRACK.halfWidth,'#343d41'));
    for(const side of [-1,1])scene.add(strip(side*7.22-.055,side*7.22+.055,'#eee9da',.02));
    const concrete=[[],[]],curbs=[[],[]],posts=[];
    const n=Math.ceil(TRACK.length/3),spacing=TRACK.length/n;
    for(let i=0;i<n;i++)for(const side of [-1,1]){
      let p=trackPoint((i+.5)*spacing,side*8.55);concrete[i%2].push({...p,y:.62,w:.62,h:1.24,d:spacing+.03});
      p=trackPoint((i+.5)*spacing,side*7.87);curbs[i%2].push({...p,y:.045,w:.55,h:.08,d:spacing+.02});
      if(i%3===0){p=trackPoint((i+.5)*spacing,side*8.72);posts.push({...p,y:1.55,w:.055,h:2.2,d:.055});}
    }
    const cube=new T.BoxGeometry(1,1,1);
    concrete.forEach((list,i)=>instances(scene,cube,standard(i?'#315b4c':'#dddcd1'),list));
    curbs.forEach((list,i)=>instances(scene,cube,standard(i?'#eee8d8':'#b44c3f'),list));
    instances(scene,cube,standard('#87938d'),posts);
    const grid=[];
    for(let slot=0;slot<10;slot++){
      const s=-8-Math.floor(slot/2)*7,offset=slot%2?2.5:-2.5;
      for(const [ds,dl,w,d]of [[-2.1,0,2.45,.1],[0,-1.2,.08,4.2],[0,1.2,.08,4.2]]){
        const p=trackPoint(s+ds,offset+dl);grid.push({...p,y:.028,w,h:.02,d});
      }
    }
    instances(scene,cube,standard('#d9dacd'),grid);
    const checks=[[],[]];
    for(let row=0;row<3;row++)for(let col=0;col<20;col++){
      const p=trackPoint(row*.5-.5,(col-9.5)*.75);checks[(row+col)%2].push({...p,y:.032,w:.75,h:.025,d:.5});
    }
    checks.forEach((list,i)=>instances(scene,cube,standard(i?'#eeeadc':'#1a2428'),list));
    const start=trackPoint(2),gantry=new T.Group();gantry.position.set(start.x,0,start.z);gantry.rotation.y=start.heading;scene.add(gantry);
    for(const x of [-10,10])box(gantry,x,4.5,0,.65,9,.7,'#d8ddd2');box(gantry,0,9,0,22,1.8,1.1,'#203c35');
    const banner=label('DZIKI GRAND PRIX',18,1.15,'#203c35','#f0cf72',88);banner.position.set(0,9,-.57);banner.rotation.y=Math.PI;gantry.add(banner);
    this.lights=[];
    for(let i=0;i<5;i++){const light=new T.Mesh(new T.SphereGeometry(.25,10,8),new T.MeshBasicMaterial({color:'#a53c32'}));light.position.set((i-2)*.85,7.8,-.5);gantry.add(light);this.lights.push(light);}
    // Infield buildings and spectator stands leave the entire racing surface clear.
    const building=new T.Group();building.position.set(0,0,0);scene.add(building);
    box(building,0,3,0,57,6,17,'#d6d9cc');box(building,0,6.5,-2,25,3,11,'#31544b');box(building,0,8.2,-2,27,.4,13,'#dddac9');
    for(let x=-22;x<25;x+=8)box(building,x,2.3,-8.6,6,3.8,.08,'#374a4d');
    const paddock=label('PADOK  /  DZIKI GP',30,1.6,'#31544b','#e9d58e',82);paddock.position.set(0,5,-8.65);paddock.rotation.y=Math.PI;building.add(paddock);
    for(const side of [-1,1]){
      const stand=new T.Group();stand.position.set(0,0,side*95);stand.rotation.y=side<0?0:Math.PI;scene.add(stand);
      for(let row=0;row<6;row++)box(stand,0,.7+row*.85,-row*1.7,100,.8,2.3,row%2?'#d9c36c':'#456f5c');
      box(stand,0,7,-4,105,.45,16,'#dedbca');for(const x of [-49,-25,0,25,49])box(stand,x,3.4,-10,.23,6.8,.23,'#586b62');
      const sign=label('OD STÓWKI DO POLE POSITION',64,2,'#223f35','#f0dfaa',85);sign.position.set(0,4.1,1.3);stand.add(sign);
    }
    const trunks=[],leaves=[];
    for(let i=0;i<54;i++){
      const side=i%2?1:-1,x=side*(165+Math.sin(i*7.2)*25),z=Math.cos(i*2.4)*140;
      trunks.push({x,y:2,z,w:.45,h:4,d:.45});leaves.push({x,y:5.2,z,w:3.3+(i%3),h:3.8,d:3.3+(i%3)});
    }
    instances(scene,cube,standard('#76624c'),trunks);instances(scene,new T.IcosahedronGeometry(1,1),standard('#607e53'),leaves);
    for(const x of [-55,55]){
      cylinder(scene,x,6,20,.09,.14,12,'#d5d6ca');const flag=label('DZIKI GP',6,1.5,'#315c47','#f3d477',90);flag.position.set(x+3,10,20);scene.add(flag);
    }
    scene.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&o!==ground)o.castShadow=o.position.y>.3;});
  }
  load(){
    if(this.ready)return this.ready;
    this.ready=new GLTFLoader().loadAsync(new URL('./assets/racing/race-car-v1.glb',import.meta.url).href).then(gltf=>{
      this.template=gltf.scene;
      const bounds=new T.Box3().setFromObject(this.template),size=bounds.getSize(new T.Vector3());
      this.modelScale=CAR_STATS.length/size.z;this.modelCenter=bounds.getCenter(new T.Vector3());this.modelFloor=bounds.min.y;
      for(let id=0;id<10;id++)this.makeCar(id);
      return this;
    }).catch(error=>{this.ready=null;throw error;});return this.ready;
  }
  makeCar(id){
    const root=new T.Group(),model=this.template.clone(true),paint=standard(CAR_COLORS[id]),wheels=[];
    this.tyreMaterial||=standard('#1c2422');this.glassMaterial||=new T.MeshStandardMaterial({color:'#294448',roughness:.3,metalness:.2});
    paint.roughness=.42;paint.metalness=.15;
    model.traverse(o=>{
      if(/^wheel(?:Back|Front)(?:Left|Right)$/.test(o.name))wheels.push(o);
      if(o.isMesh){o.castShadow=true;o.receiveShadow=true;
        let body=false;for(let parent=o;parent&&parent!==model;parent=parent.parent)if(parent.name.toLowerCase().startsWith('body'))body=true;
        if(o.material.name==='carTire')o.material=this.tyreMaterial;
        else if(o.material.name==='glass')o.material=this.glassMaterial;
        else if(body&&o.material.name==='grey')o.material=paint;
      }
    });
    model.scale.setScalar(this.modelScale);model.position.set(-this.modelCenter.x*this.modelScale,-this.modelFloor*this.modelScale,-this.modelCenter.z*this.modelScale);root.add(model);
    const roofHeight=new T.Box3().setFromObject(model).max.y;
    const number=label(String(id+1).padStart(2,'0'),.85,.75,'#20382f','#f5e9bb',160);number.position.set(0,roofHeight+.02,-.1);number.rotation.set(-Math.PI/2,0,Math.PI);root.add(number);
    if(id===0){const marker=new T.Mesh(new T.ConeGeometry(.28,.48,4),new T.MeshBasicMaterial({color:'#f3d66f'}));marker.rotation.x=Math.PI;marker.position.y=roofHeight+1.1;root.add(marker);root.userData.marker=marker;}
    this.scene.add(root);this.cars.push({root,model,paint,wheels});
  }
  activate(engine){this.active=true;this.previousShadowUpdate=this.renderer.shadowMap.autoUpdate;this.renderer.shadowMap.autoUpdate=true;this.render(engine,0,true);}
  deactivate(){this.active=false;this.renderer.shadowMap.autoUpdate=this.previousShadowUpdate??false;this.renderer.shadowMap.needsUpdate=true;}
  render(engine,dt,snap=false){
    const r=engine.data;
    for(const car of r.cars){
      const visual=this.cars[car.id],point=trackPoint(car.progress,car.offset);
      visual.root.position.set(point.x,.025,point.z);visual.root.rotation.y=point.heading+Math.atan2(car.lateralSpeed,Math.max(8,car.speed));visual.model.rotation.z=-car.steer*.035;
      visual.paint.emissive.set(car.contact>0?'#704018':'#000000');visual.paint.emissiveIntensity=car.contact*.7;
      for(const wheel of visual.wheels)wheel.rotation.x+=car.speed*dt/.34;
      if(visual.root.userData.marker)visual.root.userData.marker.position.y=2.4+Math.sin(r.elapsed*3)*.08;
    }
    const player=r.cars[0],p=trackPoint(player.progress,player.offset),ahead=trackPoint(player.progress+16,player.offset*.7);
    const target=new T.Vector3(p.x-p.tx*11,6.2,p.z-p.tz*11),look=new T.Vector3(ahead.x,1.2,ahead.z);
    if(snap)this.camera.position.copy(target);else this.camera.position.lerp(target,1-Math.exp(-dt*6));
    this.camera.up.copy(up);this.camera.lookAt(look);
    const aspect=this.renderer.domElement.clientWidth/Math.max(1,this.renderer.domElement.clientHeight);
    if(Math.abs(this.camera.aspect-aspect)>.001){this.camera.aspect=aspect;this.camera.updateProjectionMatrix();}
    this.lights.forEach((light,i)=>light.material.color.set(r.phase==='countdown'?(r.countdown<=3-i*.5?'#e15c41':'#3f3730'):'#8fcf78'));
    this.renderer.render(this.scene,this.camera);
  }
}
