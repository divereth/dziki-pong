import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {getGame} from './games.mjs';
import {inspectGeneratedChange} from './request.mjs';
import {progressMessage} from './notify.mjs';

function fixture(fn){
 const root=mkdtempSync(join(tmpdir(),'dziki-generated-'));
 try{
  mkdirSync(join(root,'games/dziki-bieg/dist'),{recursive:true});
  writeFileSync(join(root,'games/dziki-bieg/dist/index.html'),'<title>Uniboar</title>');
  const git=(...args)=>execFileSync('git',args,{cwd:root,stdio:'pipe'});
  git('init','-q');git('add','.');git('-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','Baseline');
  const temp=join(root,'runner-temp');mkdirSync(temp);
  // Model output is outside the repository in the real workflow.
  git('config','status.showUntrackedFiles','normal');
  writeFileSync(join(root,'.git/info/exclude'),'runner-temp/\n');
  fn(root,{RUNNER_TEMP:temp,GITHUB_OUTPUT:join(temp,'outputs')});
 }finally{
  assert.ok(resolve(root).startsWith(resolve(tmpdir(),'dziki-generated-')));
  rmSync(root,{recursive:true,force:true});
 }
}
test('an unchanged generation reports its actual explanation without a fake preview or validation failure',()=>fixture((root,env)=>{
 const explanation='Globalna tabela wymaga istniejącego API i bazy danych.';
 writeFileSync(join(env.RUNNER_TEMP,'dziki-output.md'),explanation);
 const result=inspectGeneratedChange(getGame('dziki-bieg'),env,root);
 assert.equal(result.changed,false);
 assert.equal(Buffer.from(result.summary_b64,'base64').toString('utf8'),explanation);
 assert.match(readFileSync(env.GITHUB_OUTPUT,'utf8'),/changed=false\n/);
 const message=progressMessage('result',{GAME_ID:'dziki-bieg',REQUEST_ID:'123',JOB_STATUS:'success',REQUEST_CHANGED:'false',REQUEST_SUMMARY_B64:result.summary_b64});
 assert.ok(message.includes(explanation));assert.match(message,/Nie powstały zmiany/);assert.doesNotMatch(message,/Podgląd gotowy/);
}));
test('real game edits proceed while missing generator output still gives an explicit explanation',()=>fixture((root,env)=>{
 const empty=inspectGeneratedChange(getGame('dziki-bieg'),env,root);
 assert.equal(empty.changed,false);assert.ok(empty.summary_b64);
 writeFileSync(join(root,'games/dziki-bieg/dist/index.html'),'<title>Uniboar changed</title>');
 assert.equal(inspectGeneratedChange(getGame('dziki-bieg'),env,root).changed,true);
}));
test('no-change inspection preserves the security boundary for unexpected files',()=>fixture((root,env)=>{
 writeFileSync(join(root,'unsafe.js'),'bad');
 assert.throws(()=>inspectGeneratedChange(getGame('dziki-bieg'),env,root),/Blocked unexpected file change/);
}));
