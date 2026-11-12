import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,prune,weld,resample,meshopt} from '@gltf-transform/functions';
import {MeshoptEncoder} from 'meshoptimizer';

const [input,output,sourceList]=process.argv.slice(2);
if(!input||!output||!sourceList)throw new Error('Usage: node optimize-characters.mjs <raw-directory> <output-directory> <source-manifest>');
await MeshoptEncoder.ready;
await fs.mkdir(output,{recursive:true});
const sources=JSON.parse(await fs.readFile(sourceList,'utf8'));
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder});
const original={
  'casual-man':'Casual_Male','casual-woman':'Casual_Female',
  'jacket-man':'Casual2_Male','jacket-woman':'Casual2_Female',
  'sport-man':'Casual3_Male','sport-woman':'Casual3_Female',
  'worker-man':'Worker_Male','worker-woman':'Worker_Female',
  'chef-man':'Chef_Male','chef-woman':'Chef_Female',
  'older-man':'OldClassy_Male','older-woman':'OldClassy_Female',
  'police':'Casual_Male','guard':'Casual_Bald',
};
const report={creator:'Quaternius',pack:'Ultimate Animated Character Pack (November 2019)',source:'https://quaternius.com/packs/ultimatedanimatedcharacter',license:'CC0-1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',modifications:'Varied skin tones, vertex colours and mesh compression. Police: navy uniform, skinned cap, badge and POLICJA lettering. Guard: broader upper body and dark clothing.',models:[]};
for(const [id,base]of Object.entries(original)){
  const document=await io.read(path.join(input,`${id}.glb`));
  await document.transform(dedup(),prune(),weld(),resample(),meshopt({encoder:MeshoptEncoder,level:'medium'}));
  const target=path.join(output,`${id}.glb`);await io.write(target,document);
  const bytes=await fs.readFile(target),root=document.getRoot();
  const record={id,file:`${id}.glb`,sourceFile:`${base}.blend`,sourceUrl:`https://drive.google.com/file/d/${sources.find(s=>s.name===base+'.blend').id}/view`,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),triangles:root.listMeshes().reduce((n,m)=>n+m.listPrimitives().reduce((n,p)=>n+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0),0),drawCalls:root.listMeshes().reduce((n,m)=>n+m.listPrimitives().length,0),animations:root.listAnimations().map(a=>a.getName())};
  report.models.push(record);console.log(JSON.stringify(record));
}
await fs.writeFile(path.join(output,'asset-info.json'),JSON.stringify(report,null,2)+'\n');
