import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const js=ts.transpileModule(fs.readFileSync('src/introAudio.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const scope={exports:{},performance};vm.runInNewContext(js,scope);
const run=scope.exports.whenIntroAudioRunning;
let time=0, pending, calls=[];
const ctx={state:'suspended',resume(){return new Promise(r=>pending=r)}};
const p=run(ctx,720,n=>calls.push(n),()=>time);
assert.deepEqual(calls,[]);time=180;ctx.state='running';pending();await p;assert.deepEqual(calls,[540]);
ctx.state='suspended';calls=[];time=0;const expired=run(ctx,720,n=>calls.push(n),()=>time);time=900;ctx.state='running';pending();await expired;assert.deepEqual(calls,[]);
ctx.state='running';time=0;await run(ctx,720,n=>calls.push(n),()=>time);assert.deepEqual(calls,[720]);
ctx.state='interrupted';calls=[];time=0;const restored=run(ctx,120,n=>calls.push(n),()=>time);time=20;ctx.state='running';pending();await restored;assert.deepEqual(calls,[100]);
for(const resume of [()=>Promise.reject(Error('blocked')),()=>{throw Error('closed')}]){calls=[];await run({state:'suspended',resume},720,n=>calls.push(n),()=>0);assert.deepEqual(calls,[]);}
calls=[];await run({state:'closed'},720,n=>calls.push(n),()=>0);assert.deepEqual(calls,[]);
console.log('PASS: cold start delay, expired roll, already running, interrupted recovery, rejected/throwing resume, closed context');
