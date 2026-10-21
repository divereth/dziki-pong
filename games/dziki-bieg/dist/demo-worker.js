import {planDemo} from './demo-planner.js';
self.onmessage=({data})=>{
 const started=performance.now();
 try{const plan=planDemo(data.snapshot,{width:48,horizon:120});self.postMessage({id:data.id,generation:data.generation,plan,duration:performance.now()-started});}
 catch{self.postMessage({id:data.id,generation:data.generation,error:true});}
};
