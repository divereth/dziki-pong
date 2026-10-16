export function joystickVector(dx,dy,radius=38){const distance=Math.hypot(dx,dy),scale=distance>radius?radius/distance:1;return {x:dx*scale/radius,y:-dy*scale/radius,px:dx*scale,py:dy*scale}}
export class TouchJoystick{
  constructor(element,thumb,isActive){this.element=element;this.thumb=thumb;this.isActive=isActive;this.value={x:0,y:0};this.pointer=null;
    element.addEventListener('pointerdown',e=>{if(!isActive())return;e.preventDefault();this.pointer=e.pointerId;element.setPointerCapture(e.pointerId);this.update(e)});
    element.addEventListener('pointermove',e=>{if(e.pointerId===this.pointer){e.preventDefault();this.update(e)}});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(event,e=>{if(e.pointerId===this.pointer)this.reset()});
  }
  update(e){const r=this.element.getBoundingClientRect(),v=joystickVector(e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2,Math.min(38,r.width*.32));this.value={x:v.x,y:v.y};this.thumb.style.transform=`translate(${v.px}px,${v.py}px)`}
  reset(){this.pointer=null;this.value={x:0,y:0};this.thumb.style.transform='translate(0,0)'}
}
