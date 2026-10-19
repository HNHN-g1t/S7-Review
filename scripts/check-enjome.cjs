const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const m={exports:{}};vm.runInNewContext('(function(exports){'+ts.transpileModule(fs.readFileSync('src/skills/enjomeModel.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText+'\n})')(m.exports);
for(const fever of [false,true]){const r=m.exports.enjoRange(fever);assert.equal(r.length,fever?25:16);assert.equal(new Set(r.map(p=>p.x+','+p.y)).size,r.length);(fever?[9,7,5,3,1]:[7,5,3,1]).forEach((width,row)=>{const cells=r.filter(p=>p.y===8-row);assert.equal(cells.length,width);assert.equal(cells.reduce((sum,p)=>sum+p.x,0)/width,4);});}
assert.deepEqual(Array.from(m.exports.ENJO_STEPS),['wall','lower','ready','hover','drop','blast','done']);
console.log('PASS Enjome design: upper wall→lower wall→tap→sky→next drop→blast; normal 16 / FEVER 25 symmetric pyramid cells');
