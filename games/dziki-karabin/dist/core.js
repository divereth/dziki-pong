export const WEAPONS = [
  { id:'k24', name:'KARABINEK K-24', type:'LEKKI KARABIN', price:0, damage:24, mag:24, reserve:72, interval:.18, reload:1.65, spread:.009, range:65, auto:true },
  { id:'viper', name:'VIPER SMG', type:'PISTOLET MASZYNOWY', price:15, damage:20, mag:32, reserve:96, interval:.095, reload:1.35, spread:.016, range:48, auto:true },
  { id:'ak47', name:'AK-47 BLOCK', type:'KARABIN SZTURMOWY', price:25, damage:35, mag:30, reserve:90, interval:.17, reload:1.9, spread:.01, range:75, auto:true },
  { id:'scout', name:'SCOUT DMR', type:'KARABIN WYBOROWY', price:35, damage:59, mag:10, reserve:30, interval:.5, reload:2.1, spread:.002, range:100, auto:false }
];
export const KNIFE = {id:'knife',name:'NÓŻ TAKTYCZNY',damage:55,interval:.48,range:2.75};
export const MAP = { width:60, depth:48 };
export const OBSTACLES = [
  {x:0,z:-24,w:62,d:1.2,h:5,kind:'boundary'}, {x:0,z:24,w:62,d:1.2,h:5,kind:'boundary'},
  {x:-30,z:0,w:1.2,d:48,h:5,kind:'boundary'}, {x:30,z:0,w:1.2,d:48,h:5,kind:'boundary'},
  {x:-18,z:-14,w:13,d:7,h:5.4,kind:'building'}, {x:18,z:14,w:13,d:7,h:5.4,kind:'building'},
  {x:-17,z:15,w:11,d:6,h:4.4,kind:'building'}, {x:17,z:-15,w:11,d:6,h:4.4,kind:'building'},
  {x:0,z:-15,w:8,d:4,h:3.5,kind:'wall'}, {x:0,z:15,w:8,d:4,h:3.5,kind:'wall'},
  {x:0,z:0,w:5,d:6,h:6.4,kind:'tower'},
  {x:-10,z:-3.8,w:3.5,d:2.5,h:2,kind:'cover'}, {x:10,z:3.8,w:3.5,d:2.5,h:2,kind:'cover'},
  {x:-15,z:5,w:3,d:3,h:2,kind:'crate'}, {x:15,z:-5,w:3,d:3,h:2,kind:'crate'},
  {x:-6,z:9,w:2.4,d:3,h:1.5,kind:'crate'}, {x:6,z:-9,w:2.4,d:3,h:1.5,kind:'crate'},
  {x:-25,z:-4,w:2,d:5,h:2.1,kind:'cover'}, {x:25,z:4,w:2,d:5,h:2.1,kind:'cover'},
  {x:-8,z:-20,w:2.5,d:2.5,h:2,kind:'crate'}, {x:8,z:20,w:2.5,d:2.5,h:2,kind:'crate'}
];
export const CHEST_POSITIONS = [{x:-18,z:0},{x:18,z:0},{x:0,z:-8},{x:0,z:8}];
export function blocked(x,z,r=.4,obstacles=OBSTACLES){
  return obstacles.some(o => Math.abs(x-o.x)<o.w/2+r && Math.abs(z-o.z)<o.d/2+r);
}
export function moveBody(body,dx,dz,r=.4){
  if(!blocked(body.x+dx,body.z,r))body.x+=dx;
  if(!blocked(body.x,body.z+dz,r))body.z+=dz;
}
export function settleDeath(victim,killer,wallet){
  if(!victim.alive)return {wallet,changed:false};
  victim.alive=false;victim.health=0;victim.deaths++;
  if(killer && killer.team!==victim.team){killer.kills++;if(killer.isPlayer)wallet+=5;}
  if(victim.isPlayer)wallet=Math.max(0,wallet-1);
  return {wallet,changed:true};
}
export function winningTeam(actors){
  const live=[0,0];for(const a of actors)if(a.alive)live[a.team]++;
  if(live[0]===0 && live[1]>0)return 1;
  if(live[1]===0 && live[0]>0)return 0;
  return null;
}
export function reloadAmmo(ammo,reserve,capacity){const amount=Math.max(0,Math.min(capacity-ammo,reserve));return {ammo:ammo+amount,reserve:reserve-amount};}
export function purchaseWeapon(id,wallet,owned){
  const weapon=WEAPONS.find(w=>w.id===id);
  if(!weapon)return {ok:false,wallet};
  if(owned.has(id))return {ok:true,wallet,weapon};
  if(wallet<weapon.price)return {ok:false,wallet};
  owned.add(id);return {ok:true,wallet:wallet-weapon.price,weapon};
}
// A reusable navigation grid keeps the nine bots out of solid cover.
const step=1.5,cols=39,rows=31,originX=-28.5,originZ=-22.5;
const grid=Array.from({length:cols*rows},(_,i)=>!blocked(originX+(i%cols)*step,originZ+Math.floor(i/cols)*step,.57));
function nearest(x,z){let cx=Math.max(0,Math.min(cols-1,Math.round((x-originX)/step))),cz=Math.max(0,Math.min(rows-1,Math.round((z-originZ)/step)));if(grid[cz*cols+cx])return cz*cols+cx;for(let r=1;r<6;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){const nx=cx+dx,nz=cz+dz;if(nx>=0&&nz>=0&&nx<cols&&nz<rows&&grid[nz*cols+nx])return nz*cols+nx;}return -1;}
export function findPath(x,z,tx,tz){
  const start=nearest(x,z),goal=nearest(tx,tz);if(start<0||goal<0)return [];
  const open=[start],came=new Map(),cost=new Map([[start,0]]),score=new Map();
  const heuristic=n=>Math.abs(n%cols-goal%cols)+Math.abs(Math.floor(n/cols)-Math.floor(goal/cols));score.set(start,heuristic(start));
  let limit=1500;
  while(open.length && limit--){
    let bi=0;for(let i=1;i<open.length;i++)if(score.get(open[i])<score.get(open[bi]))bi=i;
    const current=open.splice(bi,1)[0];
    if(current===goal){const path=[];let at=current;while(at!==start){path.push({x:originX+(at%cols)*step,z:originZ+Math.floor(at/cols)*step});at=came.get(at);}return path.reverse();}
    const cx=current%cols,cz=Math.floor(current/cols);
    for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=cx+dx,nz=cz+dz;if(nx<0||nz<0||nx>=cols||nz>=rows)continue;
      const n=nz*cols+nx;if(!grid[n])continue;
      const g=cost.get(current)+1;if(g<(cost.get(n)??Infinity)){came.set(n,current);cost.set(n,g);score.set(n,g+heuristic(n));if(!open.includes(n))open.push(n);}
    }
  }return [];
}
