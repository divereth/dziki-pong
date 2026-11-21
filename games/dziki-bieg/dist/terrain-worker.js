import {Renderer} from './art.js';
import {createPlatform} from './terrain.js';

// Reuse the exact terrain painter in a worker; no collision or physics state
// crosses this boundary. Only bounded, transferable texture tiles come back.
const painter=Object.create(Renderer.prototype);
painter.profileCache=new Map();
self.onmessage=async({data:job})=>{
  try{
    const {key,templateId,seed,density,ox,oy,tw,th,pad}=job;
    // Keep the voxel block rasterization off the foreground drawing context.
    const canvas=new OffscreenCanvas((tw+pad*2)*density,(th+pad*2)*density),context=canvas.getContext('2d',{willReadFrequently:true});
    context.setTransform(density,0,0,density,(pad-ox)*density,(pad-oy)*density);
    painter.paintNativePlatform(createPlatform(templateId,0,0,seed),context);
    const bitmap=canvas.transferToImageBitmap();self.postMessage({key,bitmap,bytes:canvas.width*canvas.height*4},[bitmap]);
  }catch{self.postMessage({key:job.key,error:true});}
};
