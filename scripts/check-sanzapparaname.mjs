import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/enemy/sanzapparanameRules.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const r=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
assert.equal(r.sanzEruptionScale(180),.8);
assert.equal(r.sanzEruptionScale(360),1.16);
assert.equal(r.sanzEruptionScale(900),1);
for(let ms=0;ms<2400;ms+=10)assert(r.sanzEruptionScale(ms)>=.8&&r.sanzEruptionScale(ms)<=1.16);
assert(r.sanzEruptionScale(280)>=1.01);
assert(r.sanzEruptionScale(340)<=1.16);
for(const p of r.SANZ_CELLS.filter(p=>p.x===3))assert.equal(r.hitSanz(r.SANZ_CELLS,[p],'seven').removed.length,0);
assert.equal(r.hitSanz(r.SANZ_CELLS,[{x:1,y:11}],'seven').remaining.length,8);
for(const attack of ['sla3','str6','thunder']){
  assert(r.hitSanz(r.SANZ_CELLS,r.sanzRange(r.SANZ_EYE,attack),attack).defeated);
  const miss=r.hitSanz(r.SANZ_CELLS,r.sanzRange({x:1,y:11},attack),attack);
  assert(!miss.defeated);assert.equal(miss.remaining.filter(p=>p.x===3).length,3);
}
console.log('PASS Sanzapparaname: central immunity, perimeter removal, three piercing eye hits and misses');
// Persistence/occupied-cell/mission regressions run the actual App instead of
// checking for a setBoard string or committing the returned board in the test.
const {execFileSync}=await import('node:child_process');
// URL の pathname は Windows で「/C:/…」や日本語のエンコードのままになるので、fileURLToPath でふつうのパスにする
const {fileURLToPath}=await import('node:url');
execFileSync(process.execPath,[fileURLToPath(new URL('../tests/sanz-landing.cjs',import.meta.url))],{stdio:'inherit'});
