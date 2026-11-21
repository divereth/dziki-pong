const random=n=>{const value=Math.sin(n*127.1+19.17)*43758.5453;return value-Math.floor(value);};
const canvas=(w,h)=>typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):Object.assign(document.createElement('canvas'),{width:w,height:h});
export function createTerrainMaterials(image){
 const rock=canvas(768,256),moss=canvas(768,256);
 const paintBlocks=(target,palette,seed)=>{
  const c=target.getContext('2d'),size=16;
  for(let y=0;y<target.height;y+=size)for(let x=0;x<target.width;x+=size){
   const n=Math.floor(random(x*1.7+y*3.1+seed)*palette.length),base=palette[n];
   c.fillStyle=base;c.fillRect(x,y,size,size);
   c.fillStyle='#ffffff16';c.fillRect(x,y,size,2);c.fillRect(x,y,2,size);
   c.fillStyle='#10211730';c.fillRect(x+size-2,y+2,2,size-2);c.fillRect(x+2,y+size-2,size-2,2);
   if(random(x*2+y+seed)>0.72){c.fillStyle='#f2e9b218';c.fillRect(x+4,y+5,4,3);}
  }
 };
 paintBlocks(rock,['#795638','#85613e','#6c4c35','#927047','#735238'],31);
 paintBlocks(moss,['#729b3f','#83aa49','#648b38','#91ae51','#557d34'],79);
 void image;
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
  c.save();c.clip(shape);
  const start=points[0][0],end=points[points.length-1][0];
  for(let x=Math.ceil(start/16)*16;x<end;x+=16){
   const index=Math.min(points.length-1,Math.max(0,Math.floor((x-start)/3))),y=points[index][1],tone=random(x+seed*13);
   c.fillStyle=tone>.72?'#86a947':tone>.34?'#789c40':'#6d923b';c.fillRect(x,y+2,16,13);
   c.fillStyle='#b9d27475';c.fillRect(x,y+2,16,2);
   c.fillStyle='#36552f75';c.fillRect(x+14,y+3,2,12);
   c.fillStyle='#54743780';c.fillRect(x+1,y+14,13,1);
  }
  c.restore();
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y+1):c.moveTo(x,y+1));c.strokeStyle='#c4d98548';c.lineWidth=4;c.stroke();c.strokeStyle='#e0eab787';c.lineWidth=1.05;c.stroke();
 }
 c.restore();
}
