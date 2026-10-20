import {Renderer} from './art.js';
import {createPlatform} from './terrain.js';

// Reuse the exact terrain painter in a worker; no collision or physics state
// crosses this boundary. Only bounded, transferable texture tiles come back.
const painter=Object.create(Renderer.prototype);
painter.profileCache=new Map();painter.terrainPaintCache=new Map();
self.onmessage=({data:job})=>{
  try{
    const {key,templateId,seed,density,ox,oy,tw,th,pad}=job;
    // Keep complex vector rasterization off the foreground GPU's command queue.
    // Only completed tiles are uploaded when the game draws their bitmaps.
    const canvas=new OffscreenCanvas((tw+pad*2)*density,(th+pad*2)*density),context=canvas.getContext('2d',{willReadFrequently:true});
    context.setTransform(density,0,0,density,(pad-ox)*density,(pad-oy)*density);
    painter.paintNativePlatform(createPlatform(templateId,0,0,seed),context);
    const bitmap=canvas.transferToImageBitmap();self.postMessage({key,bitmap,bytes:canvas.width*canvas.height*4},[bitmap]);
  }catch{self.postMessage({key:job.key,error:true});}
};
