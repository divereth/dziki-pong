import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,relative,extname,sep} from 'node:path';
import {publicFile} from '../../../automation/game-tools.mjs';
import {getGame} from '../../../automation/games.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),game=getGame('dziki-sprzedawca');
const port=Number(process.argv[2]||4188);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  try{
    const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const filename=resolve(root,`.${requested==='/'?'/index.html':requested}`),local=relative(root,filename).split(sep).join('/');
    if(!filename.startsWith(root)||!publicFile(game,local)||!['GET','HEAD'].includes(req.method)){res.writeHead(404);res.end();return;}
    const bytes=await readFile(filename);
    res.writeHead(200,{'Content-Type':types[extname(filename)]||'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store'});
    res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404);res.end();}
});
server.listen(port,'127.0.0.1',()=>console.log(`Dziki Sprzedawca: http://127.0.0.1:${port}/`));
