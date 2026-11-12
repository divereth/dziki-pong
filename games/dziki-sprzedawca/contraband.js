import * as T from './vendor/three.module.min.js';
import {box,cylinder,sphere,lineBetween} from './models.js';
export const CONTRABAND=[
 ['illegal_pistol','Pistolet bez numerów',45000,'pistol'],['illegal_rifle','Karabin z przemytu',95000,'rifle'],['illegal_sniper','Karabin wyborowy',180000,'sniper'],['illegal_crate','Skrzynia broni',260000,'crate'],['illegal_bike','Kradziony motocykl',340000,'bike'],['illegal_car','Kradziony samochód',520000,'car'],['illegal_armored','Przemycony transporter',740000,'armored'],['illegal_tank','Czołg z przemytu',1200000,'tank']
].map(([id,name,base,shape])=>({id,name,base,shape,category:'other',model:id,illegal:true}));
export function contrabandModel(item,scale=1,display=false){
 const g=new T.Group(),metal='#343b36',dark='#171c20',wood='#65503d';
 const b=(x,y,z,w,h,d,c=metal)=>box(g,x,y,z,w,h,d,c),bar=(a,b,r=.025,c=metal)=>lineBetween(g,a,b,c,r);
 function gun(x=0,y=0,z=0,long=true){b(x,y+.18,z,.48,.13,.09);b(x-.3,y+.16,z,.24,.14,.085,wood);b(x+.02,y+.05,z,.07,.18,.075,dark);b(x+.12,y+.035,z,.09,.22,.07,dark);bar([x+.2,y+.2,z],[x+(long?.67:.35),y+.2,z],.023,dark);b(x-.03,y+.26,z,.25,.018,.035,dark);if(item.shape==='sniper'){bar([x-.05,y+.33,z],[x+.2,y+.33,z],.035,dark);b(x+.35,y+.13,z,.23,.055,.08,wood);}}
 if(['pistol','rifle','sniper'].includes(item.shape)){gun(0,0,0,item.shape!=='pistol');if(item.shape==='pistol')g.scale.setScalar(.8);}
 else if(item.shape==='crate'){b(0,.19,0,.85,.38,.48,wood);for(const x of [-.34,.34])b(x,.2,0,.045,.42,.5,dark);gun(-.05,.4,0);}
 else if(item.shape==='bike'){for(const x of [-.46,.46]){const wheel=cylinder(g,x,.25,0,.24,.24,.12,dark,24);wheel.rotation.z=Math.PI/2;bar([x,.25,0],[0,.6,0],.035);}b(0,.56,0,.4,.18,.2,metal);b(-.14,.72,0,.35,.07,.22,dark);bar([.4,.5,0],[.35,.93,0]);bar([.35,.93,-.2],[.35,.93,.2]);sphere(g,.48,.68,0,.075,'#c6b579');}
 else {const tank=item.shape==='tank',armored=tank||item.shape==='armored';b(0,.5,0,1.8,.45,.92,armored?'#4a5140':'#3d4d5e');b(-.13,.89,0,.95,.43,.8,armored?metal:'#6a8b96');if(!armored){b(-.13,1.12,0,.95,.065,.85,dark);for(const z of [-.43,.43])b(-.13,.9,z,.8,.24,.02,'#8ea6a4');}
 for(const z of [-.56,.56])for(const x of [-.62,.62]){const w=cylinder(g,x,.3,z,.28,.28,.18,dark,20);w.rotation.x=Math.PI/2;}
 if(armored){for(const z of [-.57,.57]){b(0,.32,z,1.95,.42,.25,dark);for(let x=-.77;x<.9;x+=.26){const w=cylinder(g,x,.31,z,.16,.16,.27,'#55594b',12);w.rotation.x=Math.PI/2;}}b(.08,1.16,0,.58,.28,.62,'#4c5542');bar([.15,1.26,0],[1.55,1.26,0],.055);}}
 // Full-size vehicle on the rug; a miniature display model on the player's counter.
 const factor=display&&['car','tank','armored','bike'].includes(item.shape)?(item.shape==='bike'?2:3):.55;
 g.scale.multiplyScalar(scale*factor);g.userData.modelReady=true;g.userData.contraband=true;
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return g;
}

