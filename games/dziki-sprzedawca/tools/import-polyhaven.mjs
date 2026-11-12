#!/usr/bin/env node
/**
 * Reproducible Poly Haven -> compact, static glTF market props.
 *
 * npm install --prefix games/dziki-sprzedawca/tools
 * node games/dziki-sprzedawca/tools/import-polyhaven.mjs
 * node games/dziki-sprzedawca/tools/import-polyhaven.mjs --ids Camera_01,food_apple_01,adjustable_wrench
 *
 * POLYHAVEN_TOOLKIT may point to another directory containing package.json and
 * node_modules (for example .artifacts/model-tools). Downloads and checkpoints
 * are cached under .artifacts/polyhaven; every downloaded original is checked
 * against the official API's MD5. Failed models are reported and cause exit 1.
 * --limit and --ids deliberately write a PARTIAL catalog for prototyping.
 */
import {createHash} from 'node:crypto';
import {mkdir, readFile, rename, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

const TOOLS_DIR=path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR=path.resolve(TOOLS_DIR,'..');
const REPO_DIR=path.resolve(GAME_DIR,'../..');
const CACHE_DIR=path.join(REPO_DIR,'.artifacts','polyhaven');
const OUTPUT_DIR=path.join(GAME_DIR,'assets','polyhaven');
const API='https://api.polyhaven.com';
const USER_AGENT='DzikiSprzedawca-PolyHavenImporter/1.0 (CC0 game asset preparation)';
const VERSION=1;
const SETTINGS={
  sourceResolution:'1k',targetTriangles:8000,simplifyErrors:[0.005,0.01],
  colorTextureSize:512,dataTextureSize:256,textureFormat:'webp',textureQuality:80,
  textureEffort:80,meshoptLevel:'high',displayMax:[0.95,1,0.72],
};
const DEPENDENCIES={
  '@gltf-transform/core':'4.5.1','@gltf-transform/extensions':'4.5.1',
  '@gltf-transform/functions':'4.5.1',meshoptimizer:'1.3.0',sharp:'0.35.5',
};
const FINGERPRINT=createHash('sha256').update(JSON.stringify({VERSION,SETTINGS,DEPENDENCIES})).digest('hex');
const hash=(bytes,algorithm='sha256')=>createHash(algorithm).update(bytes).digest('hex');
const errorText=error=>error instanceof Error?error.message:String(error);

function options(argv){
  const opts={limit:Infinity,ids:null,force:false};
  for(let i=0;i<argv.length;i++){
    const [flag,inline]=argv[i].split('=',2);
    if(flag==='--help'||flag==='-h'){
      console.log('Usage: node import-polyhaven.mjs [--limit N] [--ids id1,id2] [--force]\n'+
        'Partial selections write a partial catalog. Cached successes resume automatically.\n'+
        'POLYHAVEN_TOOLKIT optionally points to a dependency installation directory.');
      process.exit(0);
    }
    if(flag==='--force'){opts.force=true;continue;}
    if(flag!=='--limit'&&flag!=='--ids')throw new Error(`Unknown argument: ${argv[i]}`);
    const value=inline??argv[++i];
    if(!value)throw new Error(`Missing value for ${flag}`);
    if(flag==='--limit'){
      opts.limit=Number(value);
      if(!Number.isSafeInteger(opts.limit)||opts.limit<1)throw new Error('--limit must be a positive integer');
    }else opts.ids=[...new Set(value.split(',').map(id=>id.trim()).filter(Boolean))];
  }
  return opts;
}

async function jsonIfPresent(filename){
  try{return JSON.parse(await readFile(filename,'utf8'));}
  catch(error){if(error.code==='ENOENT')return null;throw error;}
}

async function atomicWrite(filename,data){
  await mkdir(path.dirname(filename),{recursive:true});
  const temporary=`${filename}.${process.pid}.tmp`;
  await writeFile(temporary,data);
  await rename(temporary,filename);
}
const writeJSON=(filename,data)=>atomicWrite(filename,`${JSON.stringify(data,null,2)}\n`);

function semaphore(limit){
  let running=0;
  const queue=[];
  return async task=>{
    if(running>=limit)await new Promise(resolve=>queue.push(resolve));
    else running++;
    try{return await task();}
    finally{const resume=queue.shift();if(resume)resume();else running--;}
  };
}
const downloadSlot=semaphore(4);
let metadataQueue=Promise.resolve();
let lastMetadataRequest=0;

async function request(url,{metadata=false}={}){
  for(let attempt=0;attempt<4;attempt++){
    try{
      // Only API metadata calls are limited to <=55/minute. Asset files have a
      // separate four-download semaphore, including retries.
      if(metadata){
        const turn=metadataQueue.then(async()=>{
          await delay(Math.max(0,1100-(Date.now()-lastMetadataRequest)));
          lastMetadataRequest=Date.now();
        });
        metadataQueue=turn.catch(()=>{});
        await turn;
      }
      const response=await fetch(url,{
        headers:{'User-Agent':USER_AGENT,Accept:metadata?'application/json':'*/*'},
        signal:AbortSignal.timeout(120000),
      });
      if(!response.ok){
        const retryable=response.status===429||response.status>=500;
        const error=new Error(`HTTP ${response.status} downloading ${url}`);
        error.retryable=retryable;
        error.retryAfter=Math.min(60000,Number(response.headers.get('retry-after')||0)*1000);
        await response.body?.cancel();
        throw error;
      }
      return Buffer.from(await response.arrayBuffer());
    }catch(error){
      if(attempt===3||error.retryable===false)throw error;
      await delay(Math.max(error.retryAfter||0,1000*2**attempt));
    }
  }
}

async function metadata(filename,url){
  const cached=await jsonIfPresent(filename);
  if(cached)return cached;
  const bytes=await request(url,{metadata:true});
  const result=JSON.parse(bytes.toString('utf8'));
  if(!result||typeof result!=='object'||Array.isArray(result))throw new Error(`Invalid metadata from ${url}`);
  await atomicWrite(filename,`${JSON.stringify(result,null,2)}\n`);
  return result;
}

function safeLocal(root,relative){
  if(typeof relative!=='string'||!relative||relative.includes('\\')||relative.includes('\0')||
    relative.split('/').some(part=>part==='..')||path.posix.isAbsolute(relative)){
    throw new Error(`Unsafe original file path: ${relative}`);
  }
  const resolved=path.resolve(root,...relative.split('/'));
  if(!resolved.startsWith(`${path.resolve(root)}${path.sep}`))throw new Error(`Original path escapes cache: ${relative}`);
  return resolved;
}

function originalFiles(id,files){
  const selected=files.gltf?.['1k']?.gltf;
  if(!selected?.url)throw new Error(`${id}: official 1k glTF not available`);
  const mainName=decodeURIComponent(new URL(selected.url).pathname.split('/').pop());
  const descriptors=[{path:mainName,...selected},...Object.entries(selected.include||{}).map(([relative,data])=>({path:relative,...data}))];
  for(const descriptor of descriptors){
    const url=new URL(descriptor.url);
    if(url.protocol!=='https:'||!/(^|\.)polyhaven\.(org|com)$/.test(url.hostname)){
      throw new Error(`${id}: unexpected source URL ${descriptor.url}`);
    }
    if(!/^[a-f0-9]{32}$/i.test(descriptor.md5||''))throw new Error(`${id}: missing original MD5 for ${descriptor.path}`);
    safeLocal(path.join(CACHE_DIR,'originals',id),descriptor.path);
    delete descriptor.include;
  }
  if(new Set(descriptors.map(file=>file.path)).size!==descriptors.length)throw new Error(`${id}: duplicate original file paths`);
  return {selected,mainName,descriptors};
}

async function downloadOriginal(root,descriptor){
  const filename=safeLocal(root,descriptor.path);
  try{
    const bytes=await readFile(filename);
    if(hash(bytes,'md5')===descriptor.md5.toLowerCase())return;
  }catch(error){if(error.code!=='ENOENT')throw error;}
  await downloadSlot(async()=>{
    const bytes=await request(descriptor.url);
    if(hash(bytes,'md5')!==descriptor.md5.toLowerCase())throw new Error(`Original MD5 mismatch: ${descriptor.path}`);
    if(Number.isFinite(descriptor.size)&&bytes.byteLength!==descriptor.size)throw new Error(`Original size mismatch: ${descriptor.path}`);
    await atomicWrite(filename,bytes);
  });
}

function triangleCount(scene){
  let count=0;
  scene.traverse(node=>{
    for(const primitive of node.getMesh()?.listPrimitives()||[]){
      const vertices=primitive.getIndices()?.getCount()??primitive.getAttribute('POSITION')?.getCount()??0;
      if(primitive.getMode()===4)count+=Math.floor(vertices/3);
      else if(primitive.getMode()===5||primitive.getMode()===6)count+=Math.max(0,vertices-2);
    }
  });
  return count;
}

function normalize(document,scene,getBounds){
  const bounds=getBounds(scene);
  const dimensions=bounds.max.map((maximum,i)=>maximum-bounds.min[i]);
  if(![...bounds.min,...bounds.max,...dimensions].every(Number.isFinite)||Math.max(...dimensions)<=0){
    throw new Error('Model has no finite visible bounds');
  }
  const scale=Math.min(...dimensions.map((size,i)=>size>1e-12?SETTINGS.displayMax[i]/size:Infinity));
  const wrapper=document.createNode('Market display normalization')
    .setScale([scale,scale,scale])
    .setTranslation([-(bounds.min[0]+bounds.max[0])/2*scale,-bounds.min[1]*scale,-(bounds.min[2]+bounds.max[2])/2*scale]);
  for(const child of [...scene.listChildren()])wrapper.addChild(child);
  scene.addChild(wrapper);
  return {sourceBounds:bounds,scale};
}

async function loadToolkit(){
  const require=createRequire(process.env.POLYHAVEN_TOOLKIT
    ?pathToFileURL(path.resolve(process.env.POLYHAVEN_TOOLKIT,'package.json')):import.meta.url);
  const load=async name=>import(pathToFileURL(require.resolve(name)).href);
  const [core,extensions,functions,meshoptimizer,sharpModule]=await Promise.all([
    load('@gltf-transform/core'),load('@gltf-transform/extensions'),load('@gltf-transform/functions'),load('meshoptimizer'),load('sharp'),
  ]);
  await Promise.all([meshoptimizer.MeshoptEncoder.ready,meshoptimizer.MeshoptDecoder.ready,meshoptimizer.MeshoptSimplifier.ready]);
  const sharp=sharpModule.default;
  sharp.concurrency(2);
  return {core,extensions,functions,meshoptimizer,sharp};
}

async function optimize(filename,toolkit){
  const {core:{NodeIO,Logger},extensions:{ALL_EXTENSIONS,EXTTextureWebP},
    functions:{dedup,weld,simplify,prune,unpartition,meshopt,compressTexture,listTextureSlots,getBounds},
    meshoptimizer:{MeshoptEncoder,MeshoptDecoder,MeshoptSimplifier},sharp}=toolkit;
  const warnings=[];
  const logger={debug(){},info(){},warn(message){warnings.push(message);},error(message){warnings.push(message);}};
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder,
  }).setLogger(new Logger(Logger.Verbosity.ERROR));
  const document=await io.read(filename);
  document.setLogger(logger);
  const root=document.getRoot();
  const scene=root.getDefaultScene()||root.listScenes()[0];
  if(!scene)throw new Error('glTF has no scene');
  root.setDefaultScene(scene);
  for(const other of root.listScenes())if(other!==scene)other.dispose();
  for(const animation of root.listAnimations())animation.dispose();
  for(const camera of root.listCameras())camera.dispose();
  if(root.listSkins().length)warnings.push('Skin preserved in its default pose; animations removed.');
  await document.transform(prune({keepSolidTextures:true}),dedup(),weld());
  const sourceTriangles=triangleCount(scene);
  if(sourceTriangles===0)throw new Error('glTF has no visible triangles');
  for(const error of SETTINGS.simplifyErrors){
    const triangles=triangleCount(scene);
    if(triangles<=SETTINGS.targetTriangles)break;
    await document.transform(simplify({simplifier:MeshoptSimplifier,ratio:SETTINGS.targetTriangles/triangles,error}));
  }
  // A texture shared by several PBR slots keeps the larger color-map budget.
  // Encoding one texture at a time also bounds memory for multi-material props.
  for(const texture of root.listTextures()){
    const color=listTextureSlots(texture).some(slot=>/^(baseColorTexture|emissiveTexture)$/.test(slot));
    const size=color?SETTINGS.colorTextureSize:SETTINGS.dataTextureSize;
    await compressTexture(texture,{
      encoder:sharp,targetFormat:'webp',resize:[size,size],
      quality:SETTINGS.textureQuality,effort:SETTINGS.textureEffort,
    });
  }
  if(root.listTextures().length)document.createExtension(EXTTextureWebP).setRequired(true);
  await document.transform(prune({keepSolidTextures:true}),unpartition(),meshopt({
    encoder:MeshoptEncoder,level:SETTINGS.meshoptLevel,quantizePosition:14,quantizeNormal:10,quantizeTexcoord:12,
  }));
  const normalization=normalize(document,scene,getBounds);
  const bytes=await io.writeBinary(document);
  // Validate the actual compressed payload, including decoder round-trip and
  // the final bounds; this also catches unsupported or broken source geometry.
  const check=await io.readBinary(bytes);
  const checkedScene=check.getRoot().getDefaultScene()||check.getRoot().listScenes()[0];
  const bounds=getBounds(checkedScene);
  const dimensions=bounds.max.map((maximum,i)=>maximum-bounds.min[i]);
  if(![...bounds.min,...bounds.max].every(Number.isFinite)||dimensions.some((size,i)=>size>SETTINGS.displayMax[i]+0.0001)||
    Math.abs(bounds.min[1])>0.0001||Math.abs(bounds.min[0]+bounds.max[0])>0.0001||Math.abs(bounds.min[2]+bounds.max[2])>0.0001){
    throw new Error(`Normalized output bounds are invalid: ${JSON.stringify(bounds)}`);
  }
  const triangles=triangleCount(checkedScene);
  if(triangles>SETTINGS.targetTriangles)warnings.push(`Simplification retained ${triangles} triangles to respect the 1% shape-error limit.`);
  if(bytes.byteLength>500*1024)warnings.push(`Output is ${(bytes.byteLength/1024).toFixed(0)} KiB, above the 500 KiB guideline.`);
  return {bytes,triangles,sourceTriangles,bounds,normalization,warnings:[...new Set(warnings)]};
}

async function validCheckpoint(record){
  if(record?.fingerprint!==FINGERPRINT||!record.output?.file||!record.output?.sha256)return false;
  if(path.basename(record.output.file)!==record.output.file)return false;
  try{
    const filename=path.join(OUTPUT_DIR,record.output.file);
    if((await stat(filename)).size!==record.output.bytes)return false;
    return hash(await readFile(filename))===record.output.sha256;
  }catch(error){if(error.code==='ENOENT')return false;throw error;}
}

async function processModel(entry,assetInfo,toolkit,opts,existing){
  const checkpoint=path.join(CACHE_DIR,'processed',`${entry.id}.json`);
  if(!opts.force){
    const saved=await jsonIfPresent(checkpoint)||existing;
    if(await validCheckpoint(saved))return {...saved,cached:true};
  }
  const sourceMetadataUrl=`${API}/files/${encodeURIComponent(entry.id)}`;
  const files=await metadata(path.join(CACHE_DIR,`${entry.id}-files.json`),sourceMetadataUrl);
  const {selected,mainName,descriptors}=originalFiles(entry.id,files);
  const originalRoot=path.join(CACHE_DIR,'originals',entry.id);
  await Promise.all(descriptors.map(descriptor=>downloadOriginal(originalRoot,descriptor)));
  const result=await optimize(safeLocal(originalRoot,mainName),toolkit);
  const sha256=hash(result.bytes);
  const file=`${entry.id}.${sha256.slice(0,8)}.glb`;
  await atomicWrite(path.join(OUTPUT_DIR,file),result.bytes);
  const record={
    id:entry.id,fingerprint:FINGERPRINT,sourcePage:`https://polyhaven.com/a/${encodeURIComponent(entry.id)}`,
    sourceMetadataUrl,sourceAssetUrl:selected.url,sourceResolution:'1k',
    authors:assetInfo?.authors||{},sourceName:assetInfo?.name||entry.id,
    license:'CC0-1.0',licenseUrl:'https://polyhaven.com/license',
    originals:descriptors.map(({path:relative,url,md5,size})=>({path:relative,url,md5,bytes:size})),
    output:{file,asset:`assets/polyhaven/${file}`,sha256,bytes:result.bytes.byteLength,triangles:result.triangles,bounds:result.bounds},
    sourceTriangles:result.sourceTriangles,normalization:result.normalization,warnings:result.warnings,
  };
  await writeJSON(checkpoint,record);
  return {...record,cached:false};
}

async function main(){
  const opts=options(process.argv.slice(2));
  const seed=JSON.parse(await readFile(path.join(TOOLS_DIR,'catalog-seed.json'),'utf8'));
  if(!Array.isArray(seed)||!seed.length)throw new Error('Catalog seed must be a nonempty array');
  const allowed=new Set(['retro','design','collect','tools','kitchen','food','other']);
  const seen=new Set();
  for(const entry of seed){
    if(!/^[A-Za-z0-9_-]+$/.test(entry.id)||seen.has(entry.id)||!allowed.has(entry.category)||
      typeof entry.name!=='string'||!entry.name.trim()||!Number.isSafeInteger(entry.base)||entry.base<1){
      throw new Error(`Invalid or duplicate seed entry: ${JSON.stringify(entry)}`);
    }
    seen.add(entry.id);
  }
  if(opts.ids)for(const id of opts.ids)if(!seen.has(id))throw new Error(`Unknown seed model ID: ${id}`);
  const selected=seed.filter(entry=>!opts.ids||opts.ids.includes(entry.id)).slice(0,opts.limit);
  await mkdir(CACHE_DIR,{recursive:true});
  await mkdir(OUTPUT_DIR,{recursive:true});
  const [toolkit,assets,previous]=await Promise.all([
    loadToolkit(),metadata(path.join(CACHE_DIR,'assets.json'),`${API}/assets?type=models`),
    jsonIfPresent(path.join(OUTPUT_DIR,'manifest.json')),
  ]);
  const prior=new Map((previous?.assets||[]).map(record=>[record.id,record]));
  const successes=new Map();
  const failures=[];
  let next=0,done=0;
  console.log(`Poly Haven import: ${selected.length}/${seed.length} models, 4 downloads, 2 model workers.`);
  const worker=async()=>{
    while(next<selected.length){
      const entry=selected[next++];
      try{
        const record=await processModel(entry,assets[entry.id],toolkit,opts,prior.get(entry.id));
        successes.set(entry.id,record);
        console.log(`[${++done}/${selected.length}] ${entry.id}: ${record.cached?'cached':'OK'} ${record.output.triangles} triangles, ${(record.output.bytes/1024).toFixed(0)} KiB${record.warnings.length?`, ${record.warnings.length} warning(s)`:''}`);
      }catch(error){
        failures.push({id:entry.id,error:errorText(error)});
        console.error(`[${++done}/${selected.length}] ${entry.id}: FAILED ${errorText(error)}`);
      }
    }
  };
  await Promise.all([worker(),worker()]);
  const completed=selected.filter(entry=>successes.has(entry.id));
  const catalog=completed.map(entry=>{
    const output=successes.get(entry.id).output;
    return {...entry,model:entry.id,asset:output.asset,triangles:output.triangles,bytes:output.bytes};
  });
  const partial=completed.length!==seed.length;
  const generatedAt=new Date().toISOString();
  const records=completed.map(entry=>{const {cached,...record}=successes.get(entry.id);return record;});
  await atomicWrite(path.join(GAME_DIR,'catalog.js'),
    `// Generated by tools/import-polyhaven.mjs. ${partial?'PARTIAL import; see manifest.json.':'Official Poly Haven CC0 models.'}\n`+
    `export const CATALOG = ${JSON.stringify(catalog,null,2)};\n`);
  await writeJSON(path.join(OUTPUT_DIR,'manifest.json'),{
    schemaVersion:1,generatedAt,partial,seedCount:seed.length,requestedCount:selected.length,
    completedCount:completed.length,failedCount:failures.length,
    source:{provider:'Poly Haven',api:API,license:'CC0-1.0',licenseUrl:'https://polyhaven.com/license'},
    importer:{version:VERSION,fingerprint:FINGERPRINT,dependencies:DEPENDENCIES,settings:SETTINGS},assets:records,
  });
  await writeJSON(path.join(CACHE_DIR,'import-failures.json'),{generatedAt,requestedCount:selected.length,failures});
  const totalBytes=records.reduce((sum,record)=>sum+record.output.bytes,0);
  const warningCount=records.filter(record=>record.warnings.length).length;
  console.log(`Poly Haven import finished: ${completed.length} succeeded, ${failures.length} failed, ${warningCount} with warnings, ${(totalBytes/1024/1024).toFixed(2)} MiB. Catalog ${partial?'PARTIAL':'COMPLETE'}.`);
  if(failures.length)process.exitCode=1;
}

main().catch(error=>{console.error(`Poly Haven import aborted: ${errorText(error)}`);process.exitCode=1;});
