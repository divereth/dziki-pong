export function joystickVector(dx,dy,radius){
  const distance=Math.hypot(dx,dy),strength=Math.min(1,distance/radius);
  if(strength<.12)return {x:0,y:0};
  const amount=(strength-.12)/.88;
  return {x:dx/distance*amount,y:dy/distance*amount};
}

// Each control owns its pointer until release, including when a finger leaves the button.
export function createTouchControls({joystick,knob,lookZone,buttons,canControl,onLook,onFire}){
  const state={x:0,y:0,fire:false,aim:false,jump:false,interact:false};
  const bindings=[];
  function bind(element,{start,move,end}){
    const binding={element,id:null,x:0,y:0};bindings.push(binding);
    const down=e=>{
      if(!canControl()||binding.id!==null||e.button>0)return;
      e.preventDefault();e.stopPropagation();binding.id=e.pointerId;binding.x=e.clientX;binding.y=e.clientY;
      try{element.setPointerCapture(e.pointerId);}catch{}
      element.classList.add('pressed');start?.(e,binding);
    };
    const drag=e=>{
      if(e.pointerId!==binding.id)return;e.preventDefault();e.stopPropagation();
      if(!canControl()){release(e);return;}
      move?.(e,binding);binding.x=e.clientX;binding.y=e.clientY;
    };
    const release=e=>{
      if(binding.id===null||e.pointerId!==binding.id)return;
      const id=binding.id;binding.id=null;element.classList.remove('pressed');end?.();
      try{if(element.hasPointerCapture(id))element.releasePointerCapture(id);}catch{}
    };
    binding.release=()=>release({pointerId:binding.id});
    element.addEventListener('pointerdown',down,{passive:false});
    element.addEventListener('pointermove',drag,{passive:false});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,release);
  }
  function moveJoystick(e){
    const r=joystick.getBoundingClientRect(),radius=r.width*.34;
    const dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;
    const vector=joystickVector(dx,dy,radius);state.x=vector.x;state.y=vector.y;
    const amount=Math.min(radius,Math.hypot(dx,dy)),angle=Math.atan2(dy,dx);
    knob.style.transform=`translate(${Math.cos(angle)*amount}px,${Math.sin(angle)*amount}px)`;
    joystick.classList.toggle('sprinting',Math.hypot(vector.x,vector.y)>.92);
  }
  bind(joystick,{start:moveJoystick,move:moveJoystick,end:()=>{state.x=0;state.y=0;knob.style.transform='translate(0px,0px)';joystick.classList.remove('sprinting');}});
  const look=(e,p)=>onLook(e.clientX-p.x,e.clientY-p.y);
  bind(lookZone,{move:look});
  for(const action of ['fire','aim','jump','interact']){
    bind(buttons[action],{start:()=>{state[action]=true;if(action==='fire')onFire();},move:action==='fire'?look:undefined,end:()=>{state[action]=false;}});
  }
  return {state,reset(){for(const binding of bindings)binding.release();state.x=0;state.y=0;for(const key of ['fire','aim','jump','interact'])state[key]=false;}};
}
