import {surfaceY as nativeSurfaceY,terrainTemplate} from './terrain.js';
import {WIDTH as W,HEIGHT as H} from './engine.js';
// Measured once from the shipped artwork; avoid synchronous pixel readbacks at startup.
const ARTWORK_METRICS={"boar-run-brown.png":{"width":1774,"height":887,"frames":[{"x":15,"y":163,"width":423,"height":246,"centerY":117.93124019549333},{"x":11,"y":150,"width":429,"height":214,"centerY":106.69457250936232},{"x":11,"y":168,"width":429,"height":237,"centerY":110.62624556416976},{"x":12,"y":159,"width":425,"height":233,"centerY":106.37963793732811},{"x":15,"y":122,"width":420,"height":225,"centerY":112.42377843854115},{"x":2,"y":119,"width":439,"height":236,"centerY":113.31105150376828},{"x":23,"y":111,"width":416,"height":227,"centerY":112.26855766646786},{"x":11,"y":126,"width":428,"height":235,"centerY":112.40056340701265}]},"pine-cone-round.webp":{"width":1254,"height":1254,"frames":[{"x":125,"y":98,"width":1004,"height":1061,"centerY":573.416090351029}]},"boar-head-wrecked.webp":{"width":1536,"height":1024,"frames":[{"x":153,"y":65,"width":1229,"height":896,"centerY":461.71548261684836}]}};
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mod=(v,n)=>((v%n)+n)%n;
const rand=n=>{const a=Math.sin(n*127.1+19.17)*43758.5453;return a-Math.floor(a);};
function path(c,pts,close=true){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));if(close)c.closePath();}
function smoothShape(c,pts){
  if(pts.length<3){path(c,pts);return;}const last=pts[pts.length-1],first=pts[0];c.beginPath();c.moveTo((last[0]+first[0])/2,(last[1]+first[1])/2);
  for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];c.quadraticCurveTo(a[0],a[1],(a[0]+b[0])/2,(a[1]+b[1])/2);}c.closePath();
}
function line(c,pts,color,width=1){path(c,pts,false);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
function oval(c,x,y,rx,ry,color,stroke,width=1){c.beginPath();c.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,TAU);if(color){c.fillStyle=color;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function starPoints(x,y,r){return Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,z=i%2?r*.45:r;return[x+Math.cos(a)*z,y+Math.sin(a)*z];});}
function surface(p,x){if(p.templateId)return nativeSurfaceY(p,p.x+x);const pts=p.points;if(!pts?.length)return p.y;x=clamp(x,0,p.width);for(let i=1;i<pts.length;i++)if(x<=pts[i].x){const a=pts[Math.max(0,i-2)].y,b=pts[i-1].y,z=pts[i].y,d=pts[Math.min(pts.length-1,i+1)].y,f=(x-pts[i-1].x)/(pts[i].x-pts[i-1].x||1);return p.y+(2*b+(-a+z)*f+(2*a-5*b+4*z-d)*f*f+(-a+3*b-3*z+d)*f*f*f)/2;}return p.y+pts[pts.length-1].y;}

// Bronze wild boar fallback: compact legs and a prismatic horn, mane and tail.
export function drawBoar(c,x,y,scale=1,phase=0,dashing=false,airborne=false){
  c.save();c.translate(x,y);c.scale(scale,scale);c.lineJoin='round';c.lineCap='round';
  c.translate(0,10+(airborne?0:-Math.abs(Math.sin(phase*2))*.5));
  const outline='#684324',chrome=c.createLinearGradient(0,-48,0,-12);
  chrome.addColorStop(0,'#efc78c');chrome.addColorStop(.25,'#d9a15d');chrome.addColorStop(.47,'#a26a34');chrome.addColorStop(.57,'#dbad67');chrome.addColorStop(.82,'#c8924d');chrome.addColorStop(1,'#684323');
  const limb=(hip,offset,back)=>{
    const a=phase+offset,s=Math.sin(a),co=Math.cos(a),knee=[hip+s*6,-18+co*2],foot=[hip+s*10,-10+(airborne?-3+Math.max(0,co)*4:Math.min(1,co*3))];
    line(c,[[hip,-27],knee,foot],back?'#594123':outline,3.6);line(c,[[hip,-27],knee,foot],back?'#a77742':'#d2a46a',2.2);
    oval(c,knee[0],knee[1],1.7,1.7,back?'#79532d':'#edc280',outline,.55);
    line(c,[[foot[0]-1,foot[1]],[foot[0]+5,foot[1]+.3]],back?'#604326':'#d0a567',2.7);line(c,[[foot[0]+1,foot[1]+1.1],[foot[0]+5,foot[1]+1.1]],'#4d341c',.65);
  };
  limb(-18,Math.PI,true);limb(14,.5,true);
  const colors=['#ec44d4','#6442dc','#29c8df','#79e647','#ffe569','#ff894e'];
  colors.forEach((col,i)=>{c.beginPath();c.moveTo(-28,-31+i*.75);c.bezierCurveTo(-37,-34+i*.6,-38,-25+i,-47,-25+i*.75);c.strokeStyle=col;c.lineWidth=1.35;c.stroke();});
  line(c,[[-26,-29],[-32,-31],[-36,-28]],'#edc280',2.4);
  c.beginPath();c.moveTo(-30,-34);c.bezierCurveTo(-25,-40,-9,-43,6,-39);c.lineTo(20,-40);c.lineTo(29,-31);c.lineTo(21,-20);c.bezierCurveTo(9,-16,-15,-18,-27,-23);c.closePath();c.fillStyle=chrome;c.fill();c.strokeStyle=outline;c.lineWidth=.8;c.stroke();
  path(c,[[-27,-33],[-16,-37],[-11,-23],[-23,-24]]);c.fillStyle='#c39151';c.fill();c.strokeStyle='#7a552d';c.lineWidth=.6;c.stroke();
  path(c,[[-14,-37],[3,-38],[8,-23],[-10,-23]]);c.fillStyle='#d5ab6d';c.fill();
  line(c,[[-14,-37],[-10,-23],[7,-20]],'#6e4b29',.7);line(c,[[-24,-35],[-15,-38],[3,-38]],'#fff',1.5);
  line(c,[[5,-37],[1,-29],[10,-23]],'#79512d',.7);oval(c,-20,-28,3.8,3.8,'#956b3b','#624523',.65);oval(c,-20,-28,2,2,'#d5ab6d');
  limb(-18,0,false);limb(14,Math.PI+.5,false);
  c.beginPath();c.moveTo(7,-36);c.lineTo(13,-45);c.lineTo(24,-44);c.lineTo(30,-35);c.lineTo(39,-31);c.lineTo(37,-22);c.lineTo(28,-21);c.lineTo(17,-25);c.lineTo(10,-26);c.closePath();c.fillStyle=chrome;c.fill();c.strokeStyle=outline;c.lineWidth=.8;c.stroke();
  line(c,[[13,-40],[20,-41],[29,-31]],'#fff',1.4);
  path(c,[[13,-42],[10,-51],[20,-46],[20,-41]]);c.fillStyle='#d6aa6d';c.fill();c.strokeStyle=outline;c.lineWidth=.7;c.stroke();path(c,[[14,-47],[16,-43],[18,-45]]);c.fillStyle='#a56d43';c.fill();
  path(c,[[23,-43],[27,-50],[29,-39]]);c.fillStyle='#b4874b';c.fill();c.strokeStyle=outline;c.stroke();
  const horn=c.createLinearGradient(23,-61,27,-43);['#f35c78','#f5b34c','#f6e968','#7dc65c','#58c7db','#b275dd'].forEach((color,i)=>horn.addColorStop(i/5,color));
  path(c,[[21,-43],[29,-61],[26,-42]]);c.fillStyle=horn;c.fill();c.strokeStyle='#c5a2d3';c.lineWidth=.55;c.stroke();line(c,[[24,-50],[27,-49]],'#cba9da',.5);line(c,[[26,-55],[28,-54]],'#cba9da',.5);
  colors.slice().reverse().forEach((col,i)=>{c.beginPath();c.moveTo(17-i*.9,-45);c.bezierCurveTo(10-i,-51,5-i*1.2,-45,-1-i,-43+i*.7);c.strokeStyle=col;c.lineWidth=1.35;c.stroke();});
  line(c,[[24,-36],[29,-34]],'#5e3c22',1.2);line(c,[[25,-36],[28,-35]],'#a6fff8',.65);
  oval(c,37,-27,6.5,5.4,'#a76c46','#674026',.7);oval(c,37,-28,1,1.8,'#4a2b1b');oval(c,40,-27.5,.8,1.7,'#4a2b1b');line(c,[[34,-30],[38,-31]],'#fff',1.2);
  c.beginPath();c.moveTo(28,-23);c.quadraticCurveTo(34,-17,36,-27);c.quadraticCurveTo(33,-23,32,-29);c.closePath();c.fillStyle='#ffffed';c.fill();c.strokeStyle='#9b784b';c.lineWidth=.6;c.stroke();
  c.beginPath();c.moveTo(41,-24);c.quadraticCurveTo(45,-18,46,-26);c.lineTo(43,-23);c.closePath();c.fillStyle='#ffffed';c.fill();
  if(dashing){c.globalCompositeOperation='screen';c.shadowBlur=8;c.shadowColor='#c5e37e';line(c,[[-27,-35],[-11,-41],[10,-40],[20,-43]],'#e3e78d',1.2);}
  c.restore();
}

export class Renderer{
  constructor(canvas){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.effects=[];this.lastTime=0;this.lastJumps=0;this.lastDash=false;this.lastDistance=0;this.effectTime=0;this.leafSpawn=0;this.dustSpawn=0;this.landingArmed=false;this.lastGrounded=false;this.effectSerial=0;this.coneStates=new WeakMap();this.leafSprites=this.makeLeafSprites();
    this.assetTasks=[];this.forestReady=false;this.forestImage=this.loadAsset('forest-panorama.webp',()=>{this.forestReady=true;});this.spriteFrames=[];this.profileCache=new Map();this.terrainCache=new Map();this.terrainPaintCache=new Map();this.terrainCacheBytes=0;this.terrainCacheDensity=0;this.terrainJobs=new Map();this.terrainQueue=[];this.terrainPlatforms=new Set();this.initTerrainWorker();this.loadBoar();this.loadWoodlandAssets();this.ready=Promise.all(this.assetTasks).then(()=>{this.assetsReady=true;});this.resize();
  }
  resize(){const r=this.canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);this.canvas.width=Math.max(1,Math.round((r.width||W)*dpr));this.canvas.height=Math.max(1,Math.round((r.height||H)*dpr));}
  loadAsset(src,prepare){
    const image=new Image();
    this.assetTasks.push(new Promise(resolve=>{
      image.onload=async()=>{try{if(image.decode)await image.decode();prepare(image);}catch{}finally{resolve();}};
      image.onerror=resolve;image.src=src;
    }));
    return image;
  }
  terrainPrefix(p,density){return p.templateId+'|'+(p.seed??p.templateId*.17)+'|'+density;}
  initTerrainWorker(){
    if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined')return;
    try{
      const worker=this.terrainWorker=new Worker(new URL('./terrain-worker.js',import.meta.url),{type:'module'});
      worker.onmessage=({data})=>{
        const job=this.terrainJobs.get(data.key);this.terrainJobs.delete(data.key);this.terrainRunning=false;
        if(data.error){this.disableTerrainWorker();return;}
        if(job&&this.terrainPlatforms.has(job.prefix))this.cacheTerrain(data.key,{canvas:data.bitmap,bytes:data.bytes});else data.bitmap?.close();
        this.runTerrainQueue();
      };
      worker.onerror=event=>{event.preventDefault();this.disableTerrainWorker();};
    }catch{this.disableTerrainWorker();}
  }
  disableTerrainWorker(){this.terrainWorker?.terminate();this.terrainWorker=null;this.terrainJobs.clear();this.terrainQueue.length=0;this.terrainRunning=false;}
  cacheTerrain(key,tile){
    while(this.terrainCacheBytes+tile.bytes>32*1024*1024&&this.terrainCache.size){
      const oldKey=this.terrainCache.keys().next().value,old=this.terrainCache.get(oldKey);this.terrainCache.delete(oldKey);this.terrainCacheBytes-=old.bytes;
      if(old.canvas.close)old.canvas.close();else{old.canvas.width=0;old.canvas.height=0;}
    }
    this.terrainCache.set(key,tile);this.terrainCacheBytes+=tile.bytes;
  }
  queueTerrain(job){
    const existing=this.terrainJobs.get(job.key);if(existing){existing.visible||=job.visible;return;}
    if(this.terrainJobs.size>=24)return;
    this.terrainJobs.set(job.key,job);this.terrainQueue.push(job);this.runTerrainQueue();
  }
  runTerrainQueue(){
    if(this.terrainRunning||!this.terrainWorker)return;
    this.terrainQueue.sort((a,b)=>Number(b.visible)-Number(a.visible));
    while(this.terrainQueue.length){
      const job=this.terrainQueue.shift();
      if(!this.terrainPlatforms.has(job.prefix)){this.terrainJobs.delete(job.key);continue;}
      this.terrainRunning=true;
      try{this.terrainWorker.postMessage(job);}catch{this.disableTerrainWorker();}
      return;
    }
  }
  loadBoar(){
    this.loadAsset('boar-run-brown.png',image=>{
      const measured=ARTWORK_METRICS['boar-run-brown.png'];
      if(image.naturalWidth===measured.width&&image.naturalHeight===measured.height){
        const cw=image.naturalWidth/4,ch=image.naturalHeight/2;
        this.spriteFrames=measured.frames.map((f,index)=>{
          const cell=document.createElement('canvas');cell.width=Math.ceil(cw);cell.height=Math.ceil(ch);
          cell.getContext('2d').drawImage(image,index%4*cw,Math.floor(index/4)*ch,cw,ch,0,0,cell.width,cell.height);
          const crop=document.createElement('canvas');crop.width=f.width;crop.height=f.height;
          crop.getContext('2d').drawImage(cell,f.x,f.y,f.width,f.height,0,0,f.width,f.height);
          return {image:crop,width:f.width,height:f.height,centerY:f.centerY};
        });
        this.deathFragmentCache=null;return;
      }
      const cw=image.naturalWidth/4,ch=image.naturalHeight/2,frames=[];
      for(let frame=0;frame<8;frame++){
        const cell=document.createElement('canvas');cell.width=Math.ceil(cw);cell.height=Math.ceil(ch);
        const cc=cell.getContext('2d');cc.drawImage(image,(frame%4)*cw,Math.floor(frame/4)*ch,cw,ch,0,0,cell.width,cell.height);
        const data=cc.getImageData(0,0,cell.width,cell.height).data,cols=new Uint16Array(cell.width),rows=new Uint16Array(cell.height);
        for(let y=0;y<cell.height;y++)for(let x=0;x<cell.width;x++)if(data[(y*cell.width+x)*4+3]>40){cols[x]++;rows[y]++;}
        let left=0,right=cell.width-1,top=0,bottom=cell.height-1;
        // Ignore the few isolated generation flecks outside each actual sprite.
        while(left<right&&cols[left]<5)left++;while(right>left&&cols[right]<5)right--;
        while(top<bottom&&rows[top]<5)top++;while(bottom>top&&rows[bottom]<5)bottom--;
        left=Math.max(0,left-1);right=Math.min(cell.width-1,right+1);top=Math.max(0,top-1);bottom=Math.min(cell.height-1,bottom+1);
        const crop=document.createElement('canvas');crop.width=right-left+1;crop.height=bottom-top+1;crop.getContext('2d').drawImage(cell,left,top,crop.width,crop.height,0,0,crop.width,crop.height);
        let mass=0,cy=0;for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const a=data[(y*cell.width+x)*4+3];if(a>40){mass+=a;cy+=(y-top)*a;}}
        frames.push({image:crop,width:crop.width,height:crop.height,centerY:mass?cy/mass:crop.height*.55});
      }
      this.spriteFrames=frames;this.deathFragmentCache=null;
    });
  }
  jumpPitch(p){
    if(p.animState?p.animState!=='jump':p.grounded||p.dash>0)return 0;
    const gravity=clamp(p.gravity||0,0,40);return gravity<16?-Math.sin(gravity/16*Math.PI)*.56:clamp((gravity-16)/20,0,1)*.19;
  }
  hero(p){
    if(this.spriteFrames.length!==8){drawBoar(this.ctx,0,0,1,p.anim||0,p.dash>0,!p.grounded);return;}
    const charging=p.animState?p.animState==='charge':p.dash>0,running=p.animState?p.animState==='run':p.grounded;
    const index=charging?5:!running?Math.floor(clamp((p.gravity||0)*8.75/301,0,.999)*8):Math.floor(mod(p.anim||0,TAU)/TAU*8),f=this.spriteFrames[index],scale=84/f.width;
    this.ctx.imageSmoothingEnabled=true;this.ctx.imageSmoothingQuality='high';
    if(p.grounded){
      // Keep the compact torso steady while every planted hoof meets the terrain.
      // Only the lower leg portion is normalized; the airborne poses stay intact.
      const split=Math.min(f.height-1,f.centerY+7/scale),upper=split*scale,legs=12;
      this.ctx.drawImage(f.image,0,0,f.width,split,-43,-legs-upper,84,upper+.15);
      this.ctx.drawImage(f.image,0,split,f.width,f.height-split,-43,-legs,84,legs);
    }else this.ctx.drawImage(f.image,-43,-20-f.centerY*scale,84,f.height*scale);
  }
  cropArtwork(image,sx=0,sy=0,sw=image.naturalWidth,sh=image.naturalHeight){
    const measured=Object.values(ARTWORK_METRICS).find(item=>item.frames.length===1&&item.width===image.naturalWidth&&item.height===image.naturalHeight);
    if(measured&&image.naturalWidth===measured.width&&image.naturalHeight===measured.height&&sx===0&&sy===0&&sw===image.naturalWidth&&sh===image.naturalHeight){
      const f=measured.frames[0],crop=document.createElement('canvas');crop.width=f.width;crop.height=f.height;
      crop.getContext('2d').drawImage(image,f.x,f.y,f.width,f.height,0,0,f.width,f.height);return crop;
    }
    const cell=document.createElement('canvas');cell.width=sw;cell.height=sh;const c=cell.getContext('2d');c.drawImage(image,sx,sy,sw,sh,0,0,sw,sh);
    const data=c.getImageData(0,0,sw,sh).data;let left=sw,top=sh,right=0,bottom=0;
    for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)if(data[(y*sw+x)*4+3]>40){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    if(right<left)return cell;const crop=document.createElement('canvas');crop.width=right-left+1;crop.height=bottom-top+1;crop.getContext('2d').drawImage(cell,left,top,crop.width,crop.height,0,0,crop.width,crop.height);return crop;
  }
  loadWoodlandAssets(){
    this.groves=[];this.treeImages=Array(6).fill(null);this.treeCells=new Map();this.fairyFrames=[];
    ['tree-oak.webp','tree-birch.webp','tree-pine.webp','tree-beech.webp','tree-spruce.webp','tree-rowan.webp'].forEach((src,i)=>{
      this.loadAsset(src,image=>{
        const tree=document.createElement('canvas');tree.width=image.naturalWidth;tree.height=image.naturalHeight;const c=tree.getContext('2d');c.drawImage(image,0,0);
        // Blend roots into their own depth's mist instead of floating over it.
        c.globalCompositeOperation='destination-in';const fade=c.createLinearGradient(0,0,0,tree.height);fade.addColorStop(0,'#000');fade.addColorStop(.76,'#000');fade.addColorStop(1,'#0000');c.fillStyle=fade;c.fillRect(0,0,tree.width,tree.height);
        this.treeImages[i]=tree;this.groves=this.treeImages.filter(Boolean);
      });
    });
    this.loadAsset('forest-fairy.webp',fairies=>{
      // Three complete poses, using inspected gutters instead of blind grid cuts.
      const scale=fairies.naturalWidth/2172;
      this.fairyFrames=[[0,535,350],[540,500,320],[1042,536,320]].map(([x,w,anchor])=>{
        const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;
        canvas.getContext('2d').drawImage(fairies,x*scale,0,w*scale,fairies.naturalHeight,80-anchor*.2,8,w*.2,144.8);
        return canvas;
      });
    });
    this.loadAsset('pine-cone-round.webp',cone=>{this.coneArtwork=this.cropArtwork(cone);this.pineConeSprite=null;this.coneFragments=null;this.pineConeFragments();});
    this.loadAsset('boar-head-wrecked.webp',head=>{this.wreckedHead=this.cropArtwork(head);const canvas=document.getElementById('result-head');if(canvas)this.drawWishHead(canvas);});
  }
  forestTrees(distance,cameraY,layer){
    const speeds=[.065,.15,.31],spacings=[260,340,440],spacing=spacings[layer],scroll=distance*speeds[layer],first=Math.floor(scroll/spacing)-2,result=[];
    for(let index=first;index*spacing-scroll<W+spacing;index++){
      const key=layer+':'+index;let tree=this.treeCells.get(key);
      if(!tree){
        const seed=index*17.31+layer*83.17;
        const height=[170,245,320][layer]+rand(seed+1)*[100,130,150][layer];
        const base=H+height*.29+rand(seed+6)*38+layer*6;
        tree={worldX:index*spacing+(rand(seed+4)-.5)*spacing*.65,base,height,variant:mod(index*5+Math.floor(index/6)*2+layer*3,6),flip:rand(seed+3)>.5,alpha:[.25,.48,.78][layer]+rand(seed+5)*.12};
        this.treeCells.set(key,tree);if(this.treeCells.size>96)this.treeCells.delete(this.treeCells.keys().next().value);
      }
      // The transparent root fade must begin below the forest floor, even at
      // camera extremes. Height and parallax still vary the visible crowns.
      const base=Math.max(H+tree.height*.25,tree.base-clamp(cameraY,-350,350)*[.02,.035,.05][layer]);
      result.push({...tree,x:tree.worldX-scroll,base});
    }
    return result;
  }
  drawForestTrees(distance,cameraY,layer){
    const c=this.ctx;
    for(const tree of this.forestTrees(distance,cameraY,layer)){
      const image=this.treeImages[tree.variant];if(!image)continue;const w=tree.height*image.width/image.height;
      if(tree.x+w/2< -2||tree.x-w/2>W+2)continue;
      c.save();c.globalAlpha=tree.alpha;c.translate(tree.x,tree.base);if(tree.flip)c.scale(-1,1);c.drawImage(image,-w/2,-tree.height,w,tree.height);c.restore();
    }
  }
  forestBackground(distance,cameraY=0){
    const image=this.forestImage,c=this.ctx;
    // The distant light source stays fixed: it is never tiled or mirrored.
    if(this.forestReady)c.drawImage(image,0,0,W,H);
    this.drawForestTrees(distance,cameraY,0);
    const mist=c.createLinearGradient(0,130,0,H);mist.addColorStop(0,'#d9e4bd00');mist.addColorStop(1,'#d5e0b74a');c.fillStyle=mist;c.fillRect(0,130,W,H-130);
    this.drawForestTrees(distance,cameraY,1);this.drawForestTrees(distance,cameraY,2);
  }
  background(distance,cameraY,t,reduced){
    const c=this.ctx,g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,'#9cb57b');g.addColorStop(.5,'#b8cca0');g.addColorStop(1,'#d7dfb2');c.fillStyle=g;c.fillRect(0,0,W,H);
    this.forestBackground(distance,cameraY);
    for(let i=0;i<10;i++){const xx=mod(i*93-distance*.22+(reduced?0:t*9),W+70)-35,yy=mod(i*67+(reduced?0:t*(8+i%3)),H+55)-25;c.save();c.translate(xx,yy);c.rotate(i+(reduced?0:Math.sin(t+i)*.5));oval(c,0,0,2.8+i%3,1.2,i%3?'#829e5480':'#e7d99c99');c.restore();}
  }
  nativeProfile(p,details=true){
    if(this.profileCache.has(p.templateId)&&(!details||this.profileCache.get(p.templateId).segments))return this.profileCache.get(p.templateId);
    const template=p.template||terrainTemplate(p.templateId),shape=new Path2D(),slices=template.slices;
    if(!details){const profile={shape:null,template};this.profileCache.set(p.templateId,profile);return profile;}
    for(let i=0;i<slices.length-1;i++){
      const a=slices[i],b=slices[i+1],dx=b[0]-a[0];
      let corresponding=a.length===b.length;
      if(corresponding)for(let j=1;j+1<a.length;j+=2){if(Math.max(a[j],b[j])>Math.min(a[j+1],b[j+1])+.01){corresponding=false;break;}}
      if(corresponding){
        for(let j=1;j+1<a.length;j+=2){shape.moveTo(a[0],a[j]);shape.lineTo(b[0],b[j]);shape.lineTo(b[0],b[j+1]);shape.lineTo(a[0],a[j+1]);shape.closePath();}
      }else{
        for(let j=1;j+1<a.length;j+=2)shape.rect(a[0],a[j],dx*.501,a[j+1]-a[j]);
        for(let j=1;j+1<b.length;j+=2)shape.rect(a[0]+dx*.499,b[j],dx*.501,b[j+1]-b[j]);
      }
    }
    const segments=[];let run=[];
    for(let q=0;q<=p.width;q+=3){
      const worldY=nativeSurfaceY(p,p.x+q),y=worldY===null?null:worldY-p.y;
      if(y===null||run.length&&Math.abs(y-run[run.length-1][1])>24){if(run.length>1)segments.push(run);run=[];}
      if(y!==null)run.push([q,y]);
    }
    if(run.length>1)segments.push(run);
    const profile={shape,segments,template};this.profileCache.set(p.templateId,profile);return profile;
  }
  nativePlatform(p,distance,cameraY){
    const c=this.ctx,x=p.x-distance,y=p.y-cameraY,w=p.width,async=!!this.terrainWorker,lookahead=async?384:20;if(x>W+lookahead||x+w< -20)return;
    const profile=this.nativeProfile(p,!async),template=profile.template,size=256,pad=2,density=Math.min(2,Math.max(1,Math.ceil(this.canvas.width/W))),baseX=-2,baseY=Math.floor(template.minY)-2,right=Math.ceil(w)+2,bottom=Math.ceil(template.maxY)+2;
    if(!profile.tileCoverage)profile.tileCoverage=new Map();
    const x0=Math.max(0,Math.floor((-x-baseX-2)/size)),x1=Math.min(Math.ceil((right-baseX)/size)-1,Math.floor((W+lookahead-x-baseX+2)/size));
    const y0=Math.max(0,Math.floor((-y-baseY-2-(async?96:0))/size)),y1=Math.min(Math.ceil((bottom-baseY)/size)-1,Math.floor((H-y-baseY+2+(async?96:0))/size));
    for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){
      const ox=baseX+tx*size,oy=baseY+ty*size,tw=Math.min(size,right-ox),th=Math.min(size,bottom-oy),coverageKey=tx+':'+ty;
      let occupied=profile.tileCoverage.get(coverageKey);
      if(occupied===undefined){
        occupied=false;const slices=template.slices,n=slices.length-1,a=Math.max(0,Math.floor((ox-pad)/w*n)),b=Math.min(n,Math.ceil((ox+tw+pad)/w*n));
        for(let i=a;i<=b&&!occupied;i++){const column=slices[i];for(let j=1;j+1<column.length;j+=2)if(column[j]<=oy+th+pad&&column[j+1]>=oy-pad){occupied=true;break;}}
        profile.tileCoverage.set(coverageKey,occupied);
      }
      if(!occupied)continue;
      const key=p.templateId+'|'+(p.seed??p.templateId*.17)+'|'+density+'|'+coverageKey;
      let tile=this.terrainCache.get(key);
      if(tile){this.terrainCache.delete(key);this.terrainCache.set(key,tile);}
      else if(async){
        const visible=x+ox<W+2&&x+ox+tw> -2&&y+oy<H+2&&y+oy+th> -2;
        this.queueTerrain({key,prefix:this.terrainPrefix(p,density),templateId:p.templateId,seed:p.seed??p.templateId*.17,density,ox,oy,tw,th,pad,visible});
        if(visible){
          // A cold/unsupported worker never stalls a frame for vector painting.
          // This small silhouette is replaced by the identical detailed bitmap.
          c.save();c.beginPath();c.rect(x+ox,y+oy,tw,th);c.clip();c.fillStyle='#654a32';
          const slices=template.slices,n=slices.length-1,start=Math.max(0,Math.floor(ox/w*n)-1),end=Math.min(n,Math.ceil((ox+tw)/w*n)+1);
          for(let i=start;i<end;i+=3){const a=slices[i],next=slices[Math.min(n,i+3)];for(let j=1;j+1<a.length;j+=2)c.fillRect(x+a[0],y+a[j],next[0]-a[0]+.1,a[j+1]-a[j]);}
          c.restore();
        }
        continue;
      }else{
        const canvas=document.createElement('canvas');canvas.width=(tw+pad*2)*density;canvas.height=(th+pad*2)*density;const tc=canvas.getContext('2d');tc.setTransform(density,0,0,density,(pad-ox)*density,(pad-oy)*density);this.paintNativePlatform(p,tc);
        tile={canvas,bytes:canvas.width*canvas.height*4};this.cacheTerrain(key,tile);
      }
      if(x+ox>W+2||x+ox+tw< -2||y+oy>H+2||y+oy+th< -2)continue;
      const bleed=1/density;c.drawImage(tile.canvas,(pad-bleed)*density,(pad-bleed)*density,(tw+bleed*2)*density,(th+bleed*2)*density,x+ox-bleed,y+oy-bleed,tw+bleed*2,th+bleed*2);
    }
  }
  paintNativePlatform(p,c){
    const key=p.templateId+'|'+p.seed;let commands=this.terrainPaintCache.get(key);
    if(!commands){
      commands=[];let current=new Path2D();
      const pathMethods=new Set(['moveTo','lineTo','bezierCurveTo','quadraticCurveTo','closePath','rect','ellipse','arc']);
      const recorder=new Proxy({}, {
        set:(_,name,value)=>{commands.push(['set',[name,value]]);return true;},
        get:(_,name)=>{
          if(name==='beginPath')return()=>{current=new Path2D();};
          if(pathMethods.has(name))return(...args)=>current[name](...args);
          if(name==='createLinearGradient'||name==='createRadialGradient')return(...args)=>({gradient:name,args,stops:[],addColorStop(offset,color){this.stops.push([offset,color]);}});
          if(name==='fill'||name==='stroke'||name==='clip')return(...args)=>commands.push([name,args[0] instanceof Path2D?args:[new Path2D(current),...args]]);
          return(...args)=>commands.push([name,args]);
        }
      });
      this.paintNativeDetails(p,recorder);
      if(this.terrainPaintCache.size>=8)this.terrainPaintCache.delete(this.terrainPaintCache.keys().next().value);
      this.terrainPaintCache.set(key,commands);
    }
    for(const [name,args]of commands){
      if(name==='set'){
        let value=args[1];if(value?.gradient){const gradient=c[value.gradient](...value.args);for(const stop of value.stops)gradient.addColorStop(...stop);value=gradient;}c[args[0]]=value;
      }else c[name](...args);
    }
  }
  paintNativeDetails(p,c){
    const w=p.width;
    const {shape,segments,template}=this.nativeProfile(p),seed=p.seed??p.templateId*.17,minY=template.minY,maxY=template.maxY;
    c.save();
    c.fillStyle='#2e3423';
    for(const [dx,dy]of [[-1.15,0],[1.15,0],[0,-1.15],[0,1.15]]){c.save();c.translate(dx,dy);c.fill(shape);c.restore();}
    c.save();c.clip(shape);
    c.fillStyle='#654a32';c.fillRect(-5,minY-5,w+10,maxY-minY+10);
    for(let row=0;row<Math.ceil((maxY-minY)/48)+1;row++){
      const upper=[],lower=[],phase=seed*17+row*2.31;
      for(let q=-20;q<=w+30;q+=17){const wave=Math.sin(q*.019+phase)*14+Math.sin(q*.0083+phase*.7)*19+Math.sin(q*.041+phase*2)*3,y=minY+30+row*48+wave,thick=6+(Math.sin(q*.014+phase*1.8)+1)*5;upper.push([q,y]);lower.push([q+5,y+thick]);}
      smoothShape(c,[...upper,...lower.reverse()]);c.fillStyle=row%3===1?'#795a39':'#967043';c.fill();
      if(row%2===0){const front=[],back=[];for(let q=-20;q<=w+30;q+=19){const y=minY+43+row*48+Math.sin(q*.014+phase+.8)*18+Math.sin(q*.005+phase*.8)*27,thick=8+(Math.sin(q*.02+phase)+1)*10;front.push([q,y]);back.push([q+4,y+thick]);}smoothShape(c,[...front,...back.reverse()]);c.fillStyle='#463323';c.fill();}
    }
    for(let q=70;q<w;q+=170+rand(q+seed)*150){
      const top=nativeSurfaceY(p,p.x+q);if(top===null||rand(q+seed+4)<.45)continue;const sy=top-p.y+35,lean=(rand(q+seed)-.5)*18;
      c.beginPath();c.moveTo(q-4,sy);c.bezierCurveTo(q+12,sy+13,q-5+lean,sy+32,q+12+lean,sy+49);c.quadraticCurveTo(q+10+lean,sy+55,q+6+lean,sy+55);c.bezierCurveTo(q-12+lean,sy+34,q+2,sy+18,q-7,sy+3);c.closePath();c.fillStyle='#463323';c.fill();
      c.beginPath();c.moveTo(q+5,sy+24);c.quadraticCurveTo(q+22,sy+27,q+31,sy+36);c.quadraticCurveTo(q+13,sy+32,q+2,sy+30);c.closePath();c.fillStyle='#967043';c.fill();
    }
    for(let i=0;i<w/155;i++){const xx=rand(seed+i*7.1)*w,yy=minY+45+rand(seed+i*17)*(maxY-minY-45);path(c,[[xx-4,yy-3],[xx+1,yy-6],[xx+6,yy-2],[xx+3,yy+5],[xx-2,yy+2]]);c.fillStyle='#3a3c2c';c.fill();path(c,[[xx-5,yy-1],[xx-2,yy+5],[xx+4,yy+7],[xx-2,yy+10],[xx-7,yy+4]]);c.fillStyle='#a18151';c.fill();}
    // Grass follows each actual walkable contour, preserving holes and ceilings.
    const yAt=q=>{const y=nativeSurfaceY(p,p.x+clamp(q,0,w));return y===null?minY:y-p.y;};
    for(const top of segments){
      const start=top[0][0],end=top[top.length-1][0],lower=[];
      for(let q=start;q<end;q+=3.6){const cell=Math.floor(q/27),f=mod(q,27)/27,tuft=Math.pow(Math.sin(f*Math.PI),4)*rand(cell+seed*11)*15,blade=rand(cell+seed+80)>.87?Math.pow(Math.sin(f*Math.PI),12)*16:0,d=32+Math.sin(q*.041+seed)*4+tuft+blade+rand(q+seed)*4;lower.push([q+(rand(q+14)-.5)*2,yAt(q)+d]);}
      lower.push([end,yAt(end)+32]);const lowerForward=lower.slice(),brightLower=lowerForward.map(([xx,y])=>[xx,y-5-Math.sin(xx*.075+seed)*2]);
      path(c,[...top,...lower.reverse()]);c.fillStyle='#3e5d28';c.fill();c.strokeStyle='#2d4320';c.lineWidth=1.3;c.stroke();
      path(c,[...top,...brightLower.reverse()]);c.fillStyle='#739b3c';c.fill();
      for(let q=start+13;q<end-9;q+=25+rand(q+seed)*18){
        const point=lowerForward[Math.min(lowerForward.length-1,Math.max(0,Math.round((q-start)/3.6)))],edgeY=point?point[1]:yAt(q)+39,lean=(rand(q+seed+8)-.5)*16,height=7+rand(q+seed+17)*13;
        c.beginPath();c.moveTo(q-5,edgeY-1);c.lineTo(q+lean-1,edgeY-height);c.quadraticCurveTo(q+lean+1,edgeY-height+6,q+5,edgeY-3);c.closePath();c.fillStyle='#3e5d28';c.fill();
      }
      for(let q=start+7;q<end-8;q+=15){const width=5+rand(seed+q)*22,y=yAt(q)+4+rand(seed+q+3)*10;path(c,[[q,y],[q+width*.2,y-1],[q+width*.58,y],[q+width,y-2],[q+width*.78,y+1],[q+width*.33,y+3],[q-2,y+2]]);c.fillStyle=rand(q+seed)>.4?'#b1c75c':'#9cbb48';c.fill();}
      for(let q=start+28;q<end-15;q+=69+rand(q+seed)*52){
        const sy=yAt(q)+23,lean=(rand(q+seed+9)-.5)*36;
        c.beginPath();c.moveTo(q,sy);c.bezierCurveTo(q+lean,sy+18,q-lean*.3,sy+50,q+lean*.8,sy+83);c.strokeStyle='#352c1c';c.lineWidth=4.3;c.stroke();c.strokeStyle='#a3844b';c.lineWidth=1.1;c.stroke();
        line(c,[[q+lean*.2,sy+40],[q+lean*.2+13,sy+51],[q+lean*.2+21,sy+54]],'#4c3823',2);
        const fy=yAt(q)+10;line(c,[[q-10,fy+15],[q-8,fy-1]],'#345827',1);
        for(let j=0;j<4;j++){const yy=fy+j*3;line(c,[[q-8,yy],[q-15+j,yy-3]],'#4b722a',1.5);line(c,[[q-8,yy],[q-2-j,yy-3]],'#9abd51',1.2);}
        if(rand(q+seed+4)>.6){const mx=q+17,my=yAt(mx)+17;line(c,[[mx,my+8],[mx-1,my]],'#ded1a3',2.1);c.beginPath();c.ellipse(mx-1,my,6,3.4,0,Math.PI,TAU);c.lineTo(mx+5,my+1);c.lineTo(mx-7,my+1);c.closePath();c.fillStyle='#bd6943';c.fill();oval(c,mx-3,my-1,1,.65,'#f4d6a1');oval(c,mx+1,my-1.7,.8,.6,'#f4d6a1');}
      }
      path(c,top,false);c.strokeStyle='#314e24';c.lineWidth=1.3;c.stroke();path(c,top.map(([xx,y])=>[xx,y+2]),false);c.strokeStyle='#ccde8399';c.lineWidth=1;c.stroke();
    }
    c.restore();c.restore();
  }
  platform(p,distance,cameraY){
    if(p.templateId){this.nativePlatform(p,distance,cameraY);return;}
    const c=this.ctx,x=p.x-distance,w=p.width;if(x>W+120||x+w< -120)return;
    const yy=local=>surface(p,local)-cameraY,topPts=[];for(let q=0;q<w;q+=10)topPts.push([x+q,yy(q)]);topPts.push([x+w,yy(w)]);
    const left=yy(0),right=yy(w),seed=p.seed??p.x*.01;
    const depth=p.x<0?138:155+rand(seed+83)*115;
    const underside=[];
    for(let q=0;q<=w;q+=65){
      const edge=Math.sin(Math.PI*q/w),d=63+edge*(depth-63)+Math.sin(q*.011+seed*8)*27+Math.sin(q*.026+seed*17)*11;
      underside.push([x+q+(0.5-q/w)*24,yy(q)+d]);
    }
    underside.push([x+w-12,right+68]);
    const cliff=()=>{
      path(c,topPts,false);c.bezierCurveTo(x+w+8,right+22,x+w-3,right+45,x+w-12,right+68);
      for(let i=underside.length-2;i>0;i--){const a=underside[i],b=underside[i-1];c.quadraticCurveTo(a[0],a[1],(a[0]+b[0])/2,(a[1]+b[1])/2);}
      c.quadraticCurveTo(x+13,left+81,x+5,left+60);c.bezierCurveTo(x-8,left+36,x-4,left+14,x,left);c.closePath();
    };
    c.save();cliff();c.clip();
    const rock=c.createLinearGradient(0,Math.min(left,right),0,H+100);rock.addColorStop(0,'#795133');rock.addColorStop(.55,'#62432e');rock.addColorStop(1,'#513c2d');c.fillStyle=rock;c.fillRect(x-30,-250,w+60,H+850);
    // Narrow, uneven strata follow the local rock face. Their phases differ
    // across the shelf, avoiding a tiled ornamental swirl or broad flat stripe.
    for(let row=0;row<8;row++){
      const upper=[],lower=[],phase=seed*17+row*2.31;
      for(let q=-25;q<=w+30;q+=18){
        const wave=Math.sin(q*.019+phase)*14+Math.sin(q*.0083+phase*.7)*19+Math.sin(q*.041+phase*2)*3;
        const y=yy(q)+36+row*50+wave,thickness=9+(Math.sin(q*.014+phase*1.8)+1)*9;
        upper.push([x+q,y]);lower.push([x+q+5,y+thickness]);
      }
      path(c,[...upper,...lower.reverse()]);c.fillStyle=row%3===1?'#8b633c':'#987547';c.fill();
      if(row%2===0){
        const rim=[],back=[];for(let q=-25;q<=w+30;q+=20){const y=yy(q)+51+row*50+Math.sin(q*.014+phase+.8)*18+Math.sin(q*.005+phase*.8)*27,thick=3+(Math.sin(q*.02+phase)+1)*4;rim.push([x+q,y]);back.push([x+q+4,y+thick]);}
        path(c,[...rim,...back.reverse()]);c.fillStyle='#433322';c.fill();
      }
    }
    for(let q=70;q<w;q+=170+rand(q+seed)*150){
      const xx=x+q,sy=yy(q)+25,lean=(rand(q+seed)-.5)*45;
      c.beginPath();c.moveTo(xx-5,sy);c.bezierCurveTo(xx+24,sy+27,xx-11+lean,sy+58,xx+25+lean,sy+91);c.lineTo(xx+19+lean,sy+108);c.bezierCurveTo(xx-24+lean,sy+65,xx+7,sy+38,xx-14,sy+3);c.closePath();c.fillStyle='#40321f';c.fill();
      path(c,[[xx+12,sy+38],[xx+45,sy+53],[xx+31,sy+60],[xx+4,sy+48]]);c.fillStyle='#a17b45';c.fill();
    }
    for(let i=0;i<Math.max(3,w/150);i++){
      const xx=x+rand(seed+i*7.1)*w,sy=yy(xx-x)+60+rand(seed+i*17)*280;path(c,[[xx-4,sy-3],[xx+1,sy-6],[xx+6,sy-2],[xx+3,sy+5],[xx-2,sy+2]]);c.fillStyle='#3a3c2c';c.fill();path(c,[[xx-5,sy-1],[xx-2,sy+5],[xx+4,sy+7],[xx-2,sy+10],[xx-7,sy+4]]);c.fillStyle='#a18151';c.fill();
    }
    c.restore();cliff();c.strokeStyle='#293823';c.lineWidth=1.7;c.stroke();
    const lower=[];
    for(let q=0;q<w;){const j=rand(seed+q*.31),d=27+j*12,len=30+rand(seed+q+42)*38;
      lower.push([x+q,yy(q)+d],[x+q+len*.18,yy(q+len*.18)+d-3],[x+q+len*.37,yy(q+len*.37)+d+3]);
      if(j>.72)lower.push([x+q+len*.64,yy(q+len*.64)+d+18],[x+q+len*.57,yy(q+len*.57)+d+2]);
      else lower.push([x+q+len*.58,yy(q+len*.58)+d+8],[x+q+len*.78,yy(q+len*.78)+d+1]);
      lower.push([x+q+len*.9,yy(q+len*.9)+d-2]);q+=len;
    }lower.push([x+w,right+23]);path(c,[...topPts,...lower.reverse()]);
    const turf=c.createLinearGradient(0,Math.min(left,right),0,Math.min(left,right)+60);turf.addColorStop(0,'#8aa841');turf.addColorStop(.34,'#6e9137');turf.addColorStop(1,'#425f29');c.fillStyle=turf;c.fill();c.strokeStyle='#334d24';c.lineWidth=1.6;c.stroke();
    for(let q=8;q<w-8;q+=16){const width=5+rand(seed+q)*23,y=yy(q)+4+rand(seed+q+3)*10;path(c,[[x+q,y],[x+q+width*.2,y-1],[x+q+width*.58,y],[x+q+width,y-2],[x+q+width*.78,y+1],[x+q+width*.33,y+3],[x+q-2,y+2]]);c.fillStyle=rand(q+seed)>.4?'#b4c95d':'#a2bc4a';c.fill();}
    path(c,topPts,false);c.strokeStyle='#314e24';c.lineWidth=1.5;c.stroke();path(c,topPts.map(([xx,y])=>[xx,y+2]),false);c.strokeStyle='#ccde83aa';c.lineWidth=1.1;c.stroke();
  }
  makePineCone(){
    if(!this.coneArtwork)return null;
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const c=canvas.getContext('2d'),image=this.coneArtwork,h=108,w=Math.min(116,h*image.width/image.height);
    c.scale(2,2);c.translate(64,64);c.drawImage(image,-w/2,55.4-h,w,h);return canvas;
  }
  pineConeFragments(){
    if(this.coneFragments)return this.coneFragments;if(!this.pineConeSprite)this.pineConeSprite=this.makePineCone();if(!this.pineConeSprite)return [];
    const edge=[[-5,-65],[65,-65],[65,-5],[65,65],[-5,65],[-65,65],[-65,-5],[-65,-65]];
    this.coneFragments=edge.map((point,index)=>{
      const points=[[0,0],point,edge[(index+1)%edge.length]],xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),left=Math.min(...xs)-1,top=Math.min(...ys)-1,w=Math.max(...xs)-left+1,h=Math.max(...ys)-top+1,canvas=document.createElement('canvas');canvas.width=w*2;canvas.height=h*2;const c=canvas.getContext('2d');c.setTransform(2,0,0,2,-left*2,-top*2);path(c,points);c.clip();c.drawImage(this.pineConeSprite,-64,-64,128,128);return{image:canvas,x:left+w/2,y:top+h/2,w,h,index};
    });return this.coneFragments;
  }
  breakPineCone(s,distance){
    const x=s.x-distance;if(x< -110||x>W+110)return;const serial=this.effectSerial++;
    for(const part of this.pineConeFragments()){
      const n=serial*41+part.index*7;this.effects.push({kind:'coneChunk',part,x:x+part.x,y:s.y+part.y,age:0,life:.6+rand(n+1)*.18,vx:part.x< -10?-50+rand(n+2)*230:290+rand(n+2)*320,vy:-105-rand(n+3)*140,gravity:510,angle:0,spin:(part.index%2?-1:1)*(5+rand(n+4)*9)});
    }
    // Loose wooden scales and a little olive-brown sawdust fill the gaps between
    // the large textured sections, without consuming any simulation randomness.
    for(let i=0;i<13;i++){const n=serial*67+i*11;this.effects.push({kind:i%3?'dust':'grass',x:x+(rand(n)-.5)*46,y:s.y-36+rand(n+1)*83,age:0,life:.32+rand(n+2)*.4,size:i%3?2+rand(n+3)*3.3:3+rand(n+3)*3,color:i%3?'#b8a06c':'#a5ad63',vx:100+rand(n+4)*420,vy:-50-rand(n+5)*150,gravity:280,angle:rand(n+6)*TAU,spin:(rand(n+7)-.5)*12});}
  }
  pineConeImpactAngle(s,death,reduced=false){
    const struck=death?.cone;if(!struck||s.broken||s.missed||s!==struck&&Object.getPrototypeOf(s)!==struck)return 0;
    const age=Math.max(0,death.age||0),peak=.375,settled=.21,impact=.19;
    const angle=age<impact?Math.sin(age/impact*Math.PI/2)*peak:settled+(peak-settled)*Math.exp(-(age-impact)*7)*Math.cos((age-impact)*16);
    return angle*(reduced?.25:1);
  }
  crystal(s,distance,cameraY,death=null,reduced=false,cameraX=0){
    if(s.broken||s.missed)return;const x=s.x-distance,y=s.y-cameraY;if(x+cameraX< -128||x+cameraX>W+128)return;
    if(!this.pineConeSprite)this.pineConeSprite=this.makePineCone();if(!this.pineConeSprite)return;const angle=this.pineConeImpactAngle(s,death,reduced);
    if(angle){const c=this.ctx;c.save();c.translate(x,y+55.4);c.rotate(angle);c.drawImage(this.pineConeSprite,-64,-119.4,128,128);c.restore();}
    else this.ctx.drawImage(this.pineConeSprite,x-64,y-64,128,128);
  }
  fairy(p,distance,cameraY,t){
    if(p.collected||p.missed||this.fairyFrames.length!==3)return;
    const x=p.x-distance,y=p.y-cameraY+(p.wingTop??-5.6)+30.6;if(x< -60||x>W+60)return;
    const frame=[0,1,2,1][Math.floor(t*12)%4],c=this.ctx;
    c.drawImage(this.fairyFrames[frame],x-40,y-39,64,64);
    for(let i=0;i<3;i++){const xx=x-28-i*11,yy=y-2+Math.sin(i*3+t*4)*7;c.globalAlpha=.65-i*.16;c.drawImage(this.leafSprites[i],xx-6,yy-4,12,8);}c.globalAlpha=1;
  }
  makeLeafSprites(){
    return ['#91c94d','#c1df65','#dfc46d','#61a949'].map((color,i)=>{
      const canvas=document.createElement('canvas');canvas.width=96;canvas.height=64;const c=canvas.getContext('2d');c.scale(2,2);c.translate(24,16);
      const glow=c.createRadialGradient(0,0,0,0,0,21);glow.addColorStop(0,i===2?'#ebcf8666':'#c6e68166');glow.addColorStop(1,'#cce99b00');c.fillStyle=glow;c.fillRect(-24,-16,48,32);
      c.beginPath();c.moveTo(-11,0);c.bezierCurveTo(-6,-8,5,-8,12,-1);c.bezierCurveTo(5,7,-5,8,-11,0);c.fillStyle=color;c.fill();c.strokeStyle=i===2?'#796e38':'#3b783c';c.lineWidth=.65;c.stroke();line(c,[[-12,1],[8,-1]],'#e0ed9c',.65);
      for(let j=-1;j<2;j++){const x=j*4;line(c,[[x,0],[x+1,-3.5]],'#edeea399',.5);line(c,[[x,0],[x+3,3.5]],'#315f354f',.5);}return canvas;
    });
  }
  leaf(x,y,size,angle,index=0,alpha=1){
    const c=this.ctx;c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha*=alpha;const scale=size/12;c.drawImage(this.leafSprites[mod(index,4)],-24*scale,-16*scale,48*scale,32*scale);c.restore();
  }
  trail(p,cameraY,t){
    const c=this.ctx,x=p.x,y=p.y-cameraY-22,dash=p.animState?p.animState==='charge':p.dash>0,jump=(p.animState?p.animState==='jump':!p.grounded)&&p.jumps===1;
    if(!dash&&!jump)return;c.save();
    if(dash){
      const glow=c.createRadialGradient(x+6,y,5,x+6,y,53);glow.addColorStop(0,'#d6e78e24');glow.addColorStop(.6,'#a6da6927');glow.addColorStop(1,'#d1e68b00');c.fillStyle=glow;c.fillRect(x-50,y-56,112,112);
      for(let i=0;i<31;i++){const f=mod(i/31+t*.52,1),xx=x+15-f*246,swirl=t*12+i*2.399,yy=y+Math.sin(swirl)*(12+f*18)+Math.sin(f*7)*6;this.leaf(xx,yy,5+rand(i+14)*6,swirl+i,i,.88*(1-f*.85));}
      for(let i=0;i<8;i++){const a=t*8+i*TAU/8;this.leaf(x+10+Math.cos(a)*40,y+Math.sin(a)*30,6.5+rand(i)*3,a+Math.PI/2,i,.78);}
    }else{
      for(let i=0;i<6;i++){const f=mod(i/6+t*.45,1);this.leaf(x-26-f*65,y+8+f*15+Math.sin(t*4+i)*6,3.5+rand(i+4)*2,t*3+i,i,(1-f)*.6);}
    }c.restore();
  }
  landingBurst(p,reduced){
    const n=this.effectSerial++,motion=reduced?.4:1,x=p.x,y=p.y-.8;
    this.effects.push({kind:'landingPuff',landing:true,x,y,age:0,life:.32,size:reduced?12:18,vx:0,vy:-3});
    for(let i=0;i<(reduced?4:8);i++){
      const side=i%2?1:-1,seed=n*31+i*7;this.effects.push({kind:i%3?'dirt':'grass',landing:true,x:x+side*(3+rand(seed)*13),y:y-.5,age:0,life:.28+rand(seed+1)*.16,size:1.4+rand(seed+2)*1.5,color:i%3?'#8f7047':'#a5b85b',vx:side*(30+rand(seed+3)*82)*motion,vy:-(26+rand(seed+4)*51)*motion,gravity:220*motion,angle:rand(seed+5)*TAU,spin:(rand(seed+6)-.5)*11*motion});
    }
  }
  updateEffects(g,t){
    const rawdt=clamp(t-this.lastTime,0,.05),dt=g.state==='playing'?rawdt:0,p=g.player;this.lastTime=t;
    if(g.distance<this.lastDistance-50||g.state==='title'||this.effectWish!==g.wish||p&&this.effectPlayer!==p){this.effects=[];this.lastJumps=0;this.lastDash=false;this.leafSpawn=0;this.dustSpawn=0;this.landingArmed=false;this.lastGrounded=false;this.effectSerial=0;this.effectTime=0;this.coneStates=new WeakMap();}
    this.effectWish=g.wish;this.effectPlayer=p;this.effectTime+=dt;const dash=p&&(p.animState?p.animState==='charge':p.dash>0);
    const scroll=Math.max(0,(g.distance||0)-this.lastDistance);
    this.effects.forEach(a=>{a.age+=dt;a.x-=scroll;if(a.vx!==undefined){a.x+=a.vx*dt;a.vy+=(a.gravity||0)*dt;a.y+=(a.vy||0)*dt;}});this.effects=this.effects.filter(a=>a.age<(a.life||.5));
    for(const cone of g.stars||[]){const previous=this.coneStates.get(cone);if(previous===false&&cone.broken&&!cone.missed)this.breakPineCone(cone,g.distance||0);this.coneStates.set(cone,!!cone.broken);}
    if(p&&(g.state==='playing'||g.state==='paused')){
      const grounded=!!p.grounded&&p.animState==='run';
      // A real ascent arms the impact. Walking off an edge or tiny slope snaps
      // use gravity at or above thrust, so they cannot produce a landing puff.
      if(g.state==='playing'&&!grounded&&p.animState==='jump'&&p.jumps>0&&(p.vy< -20||p.jumpHeld&&p.gravity<(p.thrust||14)-1))this.landingArmed=true;
      if(grounded){if(this.landingArmed&&!this.lastGrounded&&g.state==='playing')this.landingBurst(p,!!g.reducedMotion);this.landingArmed=false;}
      this.lastGrounded=grounded;
    }
    if(p&&g.state==='playing'){
      if(p.jumps>this.lastJumps&&p.jumps>1)this.effects.push({x:p.x,y:p.y-22,age:0,kind:'jump'});
      if(dash){this.leafSpawn+=dt;while(this.leafSpawn>=.04){this.leafSpawn-=.04;const n=Math.floor(this.effectTime*250);this.effects.push({x:p.x-20-rand(n)*40,y:p.y-22+(rand(n+1)-.5)*40,age:0,life:.72,kind:'leaf',size:5+rand(n+2)*5,angle:rand(n+3)*TAU,spin:(rand(n+4)-.5)*9,index:n%4,vx:-25-rand(n+5)*35,vy:-12+rand(n+6)*28});}}else this.leafSpawn=0;
      if(p.grounded&&p.animState==='run'&&!dash){
        this.dustSpawn+=dt;while(this.dustSpawn>=1/15){this.dustSpawn-=1/15;const n=this.effectSerial++,hoof=p.x+(Math.cos((p.anim||0)*2)>0?-17:16),foot=p.y-.8;
          this.effects.push({kind:'dust',x:hoof-1,y:foot,age:0,life:.24+rand(n+1)*.13,size:2.2+rand(n+2)*1.7,color:'#af9863',vx:-24-rand(n+3)*30,vy:-16-rand(n+4)*23,gravity:110});
          this.effects.push({kind:n%3?'dirt':'grass',x:hoof,y:foot,age:0,life:.27+rand(n+4)*.13,size:1.2+rand(n+5)*1.6,color:n%3?'#785537':'#9bb34d',vx:-32-rand(n+6)*50,vy:-35-rand(n+7)*25,gravity:170,angle:rand(n+8)*TAU,spin:(rand(n+9)-.5)*10});
        }
      }else this.dustSpawn=0;
    }
    if(this.effects.length>128)this.effects.splice(0,this.effects.length-128);this.lastJumps=p?.jumps||0;this.lastDash=!!dash;this.lastDistance=g.distance||0;
  }
  effect(e,cameraY,reduced){
    const c=this.ctx,y=e.y-cameraY;
    if(e.kind==='leaf'){const f=e.age/e.life;this.leaf(e.x,y+(reduced?0:Math.sin(e.age*7+e.angle)*5),e.size,e.angle+(reduced?0:e.age*e.spin),e.index,(1-f)*.8);return;}
    if(e.kind==='landingPuff'){
      const f=e.age/e.life,rx=e.size*(.5+f),ry=2.5+f*5;c.save();c.translate(e.x,y);c.globalAlpha=(1-f)*(1-f)*(reduced?.25:.43);oval(c,0,-ry*.55,rx,ry,'#aa9467');oval(c,-rx*.52,-ry*.9,rx*.55,ry*.72,'#c3ae7c');oval(c,rx*.5,-ry*.75,rx*.48,ry*.68,'#b7a071');c.restore();return;
    }
    if(e.kind==='coneChunk'){const f=e.age/e.life,part=e.part;c.save();c.globalAlpha=clamp((1-f)*3,0,1);c.translate(e.x,y);c.rotate(e.angle+(reduced?0:e.age*e.spin));c.drawImage(part.image,-part.w/2,-part.h/2,part.w,part.h);c.restore();return;}
    if(e.kind==='dust'||e.kind==='dirt'||e.kind==='grass'){
      const f=e.age/e.life;c.save();c.globalAlpha=(1-f)*(e.kind==='dust'?.48:.9);c.translate(e.x,y);c.rotate((e.angle||0)+(reduced?0:e.age*(e.spin||0)));
      if(e.kind==='dust')oval(c,0,0,e.size*(1+f*.8),e.size*.6*(1+f*.8),e.color);
      else if(e.kind==='grass'){path(c,[[-e.size,-.6],[e.size*.15,-e.size*1.8],[e.size*.65,.2],[e.size*.9,e.size]]);c.fillStyle=e.color;c.fill();line(c,[[-e.size*.5,0],[e.size*.5,-e.size]],'#cee087',.45);}
      else{path(c,[[-e.size,-e.size*.5],[e.size*.6,-e.size],[e.size,e.size*.45],[-e.size*.4,e.size]]);c.fillStyle=e.color;c.fill();}c.restore();return;
    }
    const f=e.age/.5,alpha=(1-f)*(reduced?.2:.55),r=35+f*18;c.save();c.globalAlpha=alpha;c.strokeStyle='#c5dc83';c.lineWidth=.8;c.beginPath();c.ellipse(e.x,y,r,r*1.03,0,0,TAU);c.stroke();
    if(e.kind==='jump')for(let i=0;i<6;i++){const a=i*TAU/6;this.leaf(e.x+Math.cos(a)*r*.7,y+Math.sin(a)*r*.7,4,a+(reduced?0:f*3),i,1-f);}c.restore();
  }
  deathFragments(death){
    if(this.deathFragmentCache?.death===death)return this.deathFragmentCache.parts;
    const density=4,base=document.createElement('canvas');base.width=112*density;base.height=84*density;const bc=base.getContext('2d');bc.setTransform(density,0,0,density,56*density,70*density);
    const previous=this.ctx;try{this.ctx=bc;this.hero(death.pose||{});}finally{this.ctx=previous;}
    const masks=[
      {kind:'tail',points:[[-48,-45],[-25,-45],[-20,-24],[-24,-10],[-48,-8]],vx:-175,vy:-180,spin:-8},
      {kind:'body',points:[[-25,-43],[5,-43],[14,-26],[13,-10],[-25,-10]],vx:-45,vy:-240,spin:5},
      {kind:'rearleg',points:[[-31,-14],[-7,-12],[0,6],[-31,6]],vx:-130,vy:75,spin:-10},
      {kind:'frontleg',points:[[-7,-12],[16,-15],[39,-4],[39,6],[-7,6]],vx:135,vy:40,spin:9},
      {kind:'head',points:[[5,-58],[49,-58],[49,-4],[17,-9],[12,-21],[5,-25]],vx:0,vy:0,spin:0}
    ];
    const parts=masks.map(mask=>{const xs=mask.points.map(p=>p[0]),ys=mask.points.map(p=>p[1]),left=Math.min(...xs),top=Math.min(...ys),w=Math.max(...xs)-left,h=Math.max(...ys)-top,canvas=document.createElement('canvas');canvas.width=Math.ceil(w*density);canvas.height=Math.ceil(h*density);const c=canvas.getContext('2d');c.setTransform(density,0,0,density,-left*density,-top*density);path(c,mask.points);c.clip();c.drawImage(base,-56,-70,112,84);return{...mask,image:canvas,x:left+w/2,y:top+h/2,w,h};});
    this.deathFragmentCache={death,parts};return parts;
  }
  drawWishHead(canvas,death){
    const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);
    const image=this.wreckedHead||this.deathFragments(death||{pose:{grounded:true,anim:0}}).find(p=>p.kind==='head')?.image;if(!image)return;
    const scale=Math.min(canvas.width/image.width,canvas.height/image.height)*.96,w=image.width*scale,h=image.height*scale;
    c.drawImage(image,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
  }
  fireball(x,y,r,frame,alpha=1){
    if(r<1||alpha<=0)return;const c=this.ctx;c.save();c.translate(x,y);c.globalAlpha*=alpha;
    const glow=c.createRadialGradient(0,0,r*.15,0,0,r*1.65);glow.addColorStop(0,'#ffe9a64a');glow.addColorStop(1,'#ffd69000');c.fillStyle=glow;c.fillRect(-r*1.7,-r*1.7,r*3.4,r*3.4);
    for(const [scale,color]of [[1.16,'#7d371fc0'],[1.05,'#ea783b'],[.85,'#ffd37a'],[.65,'#fffdee']]){
      const points=[];for(let i=0;i<23;i++){const a=i*TAU/23,rr=r*scale*(.85+rand(i*3+Math.floor(frame*.6))* .27);points.push([Math.cos(a)*rr,Math.sin(a)*rr]);}smoothShape(c,points);c.fillStyle=color;c.fill();
    }
    c.restore();
  }
  deathExplosion(death,cameraY,reduced){
    if(!death)return;const c=this.ctx,tick=clamp((death.age||0)*34,0,30),age=tick/34,parts=this.deathFragments(death),x=death.x,y=death.y-cameraY;
    // The native animation sends the severed head above the screen, then brings
    // it back much larger. These measured keys preserve that distinctive arc.
    const keys=[[1,7.49,-13.31,1,0],[2,11.29,-31.68,1.14,5.2],[4,19.25,-75.21,1.44,14.2],[6,27.51,-123.49,1.73,20.6],[9,40.44,-194.97,2.18,28],[14,61.17,-273.6,2.91,30.4],[19,82.58,-281.19,3.65,35.9],[24,107.42,-181.51,4.38,47.6],[26,118.17,-101.96,4.68,53.9],[28,130.30,4.72,4.97,61.4],[29,136.62,69.08,5.11,65.4]];
    let a=keys[0],b=keys[keys.length-1];for(let i=1;i<keys.length;i++)if(tick<=keys[i][0]){a=keys[i-1];b=keys[i];break;}const f=clamp((tick-a[0])/(b[0]-a[0]||1),0,1),mix=i=>a[i]+(b[i]-a[i])*f;
    const scatter=clamp(1-tick/7,0,1);
    for(const part of parts){
      if(part.kind==='head')continue;if(scatter<=0)break;c.save();c.globalAlpha=scatter;c.translate(x+part.x+part.vx*age,y+part.y+part.vy*age+260*age*age);c.rotate(part.spin*age*(reduced?.3:1));c.drawImage(part.image,-part.w/2,-part.h/2,part.w,part.h);c.restore();
    }
    if(tick<24){const impact=clamp((24-tick)/10,0,1),r=10+Math.sin(clamp(tick/7,0,1)*Math.PI/2)*31;this.fireball(x+5,y-25-r*.3,r,tick,impact);}
    const head=parts.find(p=>p.kind==='head');if(head){const hx=x+head.x+mix(1)-7.49,hy=y+head.y+mix(2)+13.31,scale=mix(3),angle=mix(4)*Math.PI/180;c.save();c.translate(hx,hy);c.rotate(angle);c.scale(scale,scale);this.fireball(-head.w*.4,-head.h*.05,9,tick,clamp(tick/3,0,1));c.drawImage(head.image,-head.w/2,-head.h/2,head.w,head.h);c.restore();}
    if(tick<5){c.save();c.globalAlpha=(1-tick/5)*(reduced?.15:.65);const burst=c.createRadialGradient(x,y-25,2,x,y-25,80);burst.addColorStop(0,'#ffffed');burst.addColorStop(.3,'#e2edaccc');burst.addColorStop(1,'#b8d87900');c.fillStyle=burst;c.fillRect(x-85,y-110,170,170);c.restore();}
  }
  wishEntry(g){
    if(g.state!=='playing'&&g.state!=='paused')return;const tick=g.ticks||0,c=this.ctx;if(tick>80)return;
    if(tick>=8&&tick<57){
      const a=clamp((tick-8)/8,0,1)*clamp((57-tick)/9,0,1);c.save();c.globalAlpha=a;
      c.save();c.translate(W/2,275);c.scale(1,.3);const halo=c.createRadialGradient(0,0,2,0,0,112);halo.addColorStop(0,'#f7ffdeea');halo.addColorStop(.4,'#b7d67ac0');halo.addColorStop(1,'#b7d67a00');c.fillStyle=halo;c.fillRect(-112,-112,224,224);c.restore();
      c.font='italic 27px Georgia,serif';c.textAlign='center';c.fillStyle='#f7ffe8';c.shadowColor='#a8d06c';c.shadowBlur=12;c.fillText(['First Wish!','Second Wish!','Third Wish!'][(g.wish||1)-1]||'First Wish!',W/2,285);
      for(let i=0;i<4;i++){const x=W/2-85+i*47+Math.sin(tick*.08+i)*6,y=267+Math.sin(i*2.7+tick*.055)*25,r=i%2?3:5;path(c,[[x,y-r],[x+r*.26,y-r*.26],[x+r,y],[x+r*.26,y+r*.26],[x,y+r],[x-r*.26,y+r*.26],[x-r,y],[x-r*.26,y-r*.26]]);c.fill();}c.restore();
    }
    if(tick>=54&&tick<79){
      const f=(tick-54)/25,a=Math.sin(f*Math.PI);c.save();c.globalAlpha=a;
      c.save();c.translate(W/2,275);c.scale(1,.4);const flare=c.createRadialGradient(0,0,4,0,0,95);flare.addColorStop(0,'#ffffff');flare.addColorStop(.65,'#ffffffc0');flare.addColorStop(1,'#d9ef9e00');c.fillStyle=flare;c.fillRect(-100,-100,200,200);c.restore();
      if(tick>=59){const r=38+(tick-59)*12;c.beginPath();c.arc(W/2+13,278,r,0,TAU);c.strokeStyle='#f7ffe8';c.lineWidth=1.5;c.shadowColor='#fff';c.shadowBlur=6;c.stroke();for(let i=0;i<4;i++){const angle=i*2.3+f*3;oval(c,W/2+13+Math.cos(angle)*r*.55,278+Math.sin(angle)*r*.45,3.4,3.4,'#fff');}}c.restore();
    }
    if(tick<12){c.fillStyle='rgba(255,255,255,'+(1-tick/12)+')';c.fillRect(0,0,W,H);}
  }
  render(g,time=0){
    const c=this.ctx,t=Number.isFinite(time)?time:0;g=g||{};const reduced=!!g.reducedMotion,decorTime=reduced?0:t,distance=g.distance||0,cameraY=g.cameraY||0;
    const density=Math.min(2,Math.max(1,Math.ceil(this.canvas.width/W)));
    this.terrainPlatforms=new Set((g.platforms||[]).map(p=>this.terrainPrefix(p,density)));
    c.setTransform(this.canvas.width/W,0,0,this.canvas.height/H,0,0);c.clearRect(0,0,W,H);this.updateEffects(g,t);
    this.background(distance,cameraY,decorTime,reduced);c.save();c.translate(reduced?0:(g.cameraX||0),0);
    (g.platforms||[]).forEach(p=>this.platform(p,distance,cameraY));(g.stars||[]).forEach(s=>this.crystal(s,distance,cameraY,(g.state==='dead'||g.state==='over')?g.death:null,reduced,reduced?0:(g.cameraX||0)));(g.pixies||[]).forEach(p=>this.fairy(p,distance,cameraY,reduced?0:(g.ticks||0)/34));
    this.effects.forEach(e=>{if(e.kind==='coneChunk')this.effect(e,cameraY,reduced);});
    const p=g.player;if(p&&g.state!=='dead'&&g.state!=='over'){this.trail(p,cameraY,reduced?0:this.effectTime);c.save();c.translate(p.x,p.y-cameraY);if(p.rotation)c.rotate(p.rotation);const pitch=this.jumpPitch(p);if(pitch){c.translate(0,-20);c.rotate(pitch);c.translate(0,20);}if(p.animState?p.animState==='charge':p.dash>0){c.filter='brightness(1.12) saturate(1.08)';c.shadowColor='#c9df75';c.shadowBlur=5;}this.hero(p);c.restore();}
    if(g.death&&(g.state==='dead'||g.state==='over'))this.deathExplosion(g.death,cameraY,reduced);
    this.effects.forEach(e=>{if(e.kind!=='coneChunk')this.effect(e,cameraY,reduced);});
    (g.particles||[]).forEach(a=>{
      const life=clamp(a.life/(a.max||a.maxLife||1),0,1),x=a.x,y=a.y-cameraY,size=a.size||3;c.save();c.globalAlpha=life;c.translate(x,y);c.rotate(a.angle??((a.rotation||0)+(reduced?0:t)*(a.spin||1)));
      if(a.kind==='leaf'){this.leaf(0,0,Math.max(3,size*1.7),reduced?0:this.effectTime*(a.spin||2),Math.floor((a.size||3)*5),1);}
      else if(a.star||a.kind==='shard'){const g=c.createLinearGradient(-size,-size,size,size);g.addColorStop(0,'#fff');g.addColorStop(1,a.color||'#bb8a45');path(c,[[-size*.5,-size*.5],[size*.7,-size*.2],[size*.2,size*.7],[-size*.4,size*.2]]);c.fillStyle=g;c.fill();c.strokeStyle='#e5ebc9';c.lineWidth=.5;c.stroke();}
      else if(a.kind==='metal'){path(c,[[-size*.8,-size*.3],[size*.6,-size*.5],[size*.5,size*.4],[-size*.4,size*.6]]);c.fillStyle='#fbf5df';c.fill();c.strokeStyle='#899568';c.lineWidth=.6;c.stroke();}
      else{c.fillStyle=a.color||'#fff';c.fillRect(-size*.5,-size*.5,size,size);}c.restore();
    });
    (g.popups||[]).forEach(a=>{c.save();c.globalAlpha=clamp(a.life,0,1);c.textAlign='center';c.font='italic 24px Georgia,serif';c.fillStyle='#fff';c.shadowColor='#a5ca6b';c.shadowBlur=7;c.fillText(a.text,a.x,a.y-cameraY);c.restore();});
    c.restore();if(g.flash>0){c.fillStyle='rgba(246,255,224,'+Math.min(reduced?.12:.65,g.flash)+')';c.fillRect(0,0,W,H);}this.wishEntry(g);
  }
}
