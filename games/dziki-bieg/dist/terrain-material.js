const random=n=>{const value=Math.sin(n*127.1+19.17)*43758.5453;return value-Math.floor(value);};
const canvas=(w,h)=>typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):Object.assign(document.createElement('canvas'),{width:w,height:h});
export function createTerrainMaterials(image){
 const rock=canvas(768,256),moss=canvas(768,256),w=image.width||image.naturalWidth,h=image.height||image.naturalHeight;
 rock.getContext('2d').drawImage(image,0,0,w,h/2,0,0,768,256);
 moss.getContext('2d').drawImage(image,0,h/2,w,h/2,0,0,768,256);
 return {rock,moss,contexts:new WeakMap()};
}
let materialTask;
export function loadTerrainMaterials(){
 if(typeof createImageBitmap==='undefined')return Promise.resolve(null);
 return materialTask??=fetch(new URL('./forest-terrain-atlas.webp',import.meta.url)).then(response=>{
  if(!response.ok)throw Error('Terrain material unavailable');return response.blob();
 }).then(createImageBitmap).then(image=>{const materials=createTerrainMaterials(image);image.close();return materials;}).catch(()=>null);
}
export function paintForestTerrain(platform,c,profile,materials){
 const {shape,segments,template}=profile,w=platform.width,seed=platform.seed??.5;
 let patterns=materials.contexts.get(c);
 if(!patterns){patterns={rock:c.createPattern(materials.rock,'repeat'),moss:c.createPattern(materials.moss,'repeat')};materials.contexts.set(c,patterns);}
 if(typeof DOMMatrix!=='undefined'){
  const matrix=new DOMMatrix().translate(seed*431,seed*127);
  patterns.rock.setTransform(matrix);patterns.moss.setTransform(matrix);
 }
 c.save();c.fillStyle='#283d2a';c.fill(shape);c.clip(shape);
 c.fillStyle=patterns.rock;c.fillRect(-2,template.minY-2,w+4,template.maxY-template.minY+4);
 const depth=c.createLinearGradient(0,template.minY,0,template.maxY);
 depth.addColorStop(0,'#c1bf7a08');depth.addColorStop(.45,'#29473f18');depth.addColorStop(1,'#122c36bb');
 c.fillStyle=depth;c.fillRect(-2,template.minY-2,w+4,template.maxY-template.minY+4);
 for(const points of segments){
  const cap=new Path2D();cap.moveTo(...points[0]);for(const point of points.slice(1))cap.lineTo(...point);
  for(let i=points.length-1;i>=0;i--){const [x,y]=points[i];cap.lineTo(x,y+24+Math.sin(x*.041+seed*15)*7+random(Math.floor(x/20)+seed)*9);}cap.closePath();
  c.fillStyle=patterns.moss;c.fill(cap);
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y+1):c.moveTo(x,y+1));c.strokeStyle='#c4d98548';c.lineWidth=4;c.stroke();c.strokeStyle='#e0eab787';c.lineWidth=1.05;c.stroke();
 }
 c.restore();
 // Fine edge foliage lives on the same sampled walkable contour, never a
 // separate raised ledge. Its silhouette stays within a few cosmetic pixels.
 for(const points of segments){
  for(let i=6;i<points.length-5;i+=15+Math.floor(random(i+seed)*13)){
   const [x,y]=points[i],height=3+random(i+seed+5)*6;
   c.beginPath();c.moveTo(x-4,y+1);c.quadraticCurveTo(x-2,y-height,x+1,y-1);c.quadraticCurveTo(x+4,y-height*.6,x+5,y+2);c.fillStyle=i%3?'#89a65b':'#bed07a';c.fill();
  }
 }
}
