import {WIDTH,HEIGHT} from './engine.js';
// Keep the original world framing; the engine still follows terrain vertically.
export function cameraExtent(){return 1;}
export function cameraView(){
 return {extent:1,scale:1,left:0,top:0,width:WIDTH,height:HEIGHT,right:WIDTH,bottom:HEIGHT};
}
