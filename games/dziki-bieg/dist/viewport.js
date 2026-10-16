(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.RunViewport=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Uniform scaling preserves distances, collision shapes and the full jump arc.
  function layout(width,height,{touch=false,pixelRatio=1,controls=0,hud=60}={}){
    width=Math.max(1,width);height=Math.max(1,height);
    const targetWidth=touch&&width<600?1080:1280;
    const playHeight=Math.max(80,height-controls-hud-24);
    const scale=Math.min(width/targetWidth,playHeight/390);
    const floor=touch?height-controls-18:height*.775;
    const offsetY=floor/scale-465;
    return {cssWidth:width,cssHeight:height,dpr:Math.min(2,Math.max(1,pixelRatio)),scale,width:width/scale,height:height/scale,offsetY,top:-offsetY,bottom:height/scale-offsetY,safeFeet:(hud+20)/scale-offsetY};
  }
  return {layout};
});
