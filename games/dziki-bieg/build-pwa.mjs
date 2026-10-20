import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=new URL('./dist/',import.meta.url);
const files=['index.html','style.css','main.js','settings.js','leaderboard.js','engine.js','terrain.js','presentation.js','art.js','audio.js','pwa.js','manifest.webmanifest','icon.svg','icon-180.png','icon-192.png','icon-512.png','icon-maskable-512.png','boar-run-brown.png','forest-panorama.webp','tree-oak.webp','tree-birch.webp','tree-pine.webp','tree-beech.webp','tree-spruce.webp','tree-rowan.webp','forest-fairy.webp','pine-cone-round.webp','boar-head-wrecked.webp','boar-start.mp3','boar-hit.mp3','always-free.mp3'];
const template=await readFile(new URL('./sw-template.js',import.meta.url),'utf8');
const hash=createHash('sha256').update(template);let bytes=0;
for(const file of files){const data=await readFile(new URL(file,root));hash.update(file).update(data);bytes+=data.length;}
const version=hash.digest('hex').slice(0,16),name='robot-uniboar-'+version;
await writeFile(new URL('./sw.js',root),template.replace('__CACHE_NAME__',name).replace('__APP_FILES__',JSON.stringify(files.map(file=>'./'+file))));
console.log(JSON.stringify({cache:name,files:files.length,offlineBytes:bytes,serviceWorker:fileURLToPath(new URL('./sw.js',root))}));
