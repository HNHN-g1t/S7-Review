const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const m={exports:{}};vm.runInNewContext('(function(exports){'+ts.transpileModule(fs.readFileSync('src/skills/enjomeModel.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText+'\n})')(m.exports);
for(const fever of [false,true]){const r=m.exports.enjoRange(fever);assert.equal(r.length,fever?25:16);assert.equal(new Set(r.map(p=>p.x+','+p.y)).size,r.length);(fever?[9,7,5,3,1]:[7,5,3,1]).forEach((width,row)=>{const cells=r.filter(p=>p.y===8-row);assert.equal(cells.length,width);assert.equal(cells.reduce((sum,p)=>sum+p.x,0)/width,4);});}
assert.deepEqual(Array.from(m.exports.ENJO_STEPS),['wall','breakUpper','lower','breakLower','ready','hover','drop','blast','done']);
console.log('PASS Enjome design: upper wall→lower wall→tap→sky→next drop→blast; normal 16 / FEVER 25 symmetric pyramid cells');

const audio={exports:{}};vm.runInNewContext('(function(exports){'+ts.transpileModule(fs.readFileSync('src/skills/enjomeAudio.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText+'\n})')(audio.exports);
const starts=[],ends=[],nodes=[];const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}});
const node=()=>{const n={connect(){},disconnect(){},start(t){starts.push(t)},stop(t){ends.push(t)},gain:param(),frequency:param(),Q:param()};nodes.push(n);return n;};
const ctx={currentTime:10,sampleRate:8000,createGain:node,createOscillator:node,createBiquadFilter:node,createBufferSource:node,createBuffer:(_,n)=>({getChannelData:()=>new Float32Array(n)})};
audio.exports.playEnjoWallBreak(ctx,{});assert.equal(starts.length,7);assert(Math.max(...ends)<10.66);
starts.length=0;ends.length=0;audio.exports.playEnjoImpact(ctx,{});assert.equal(starts.length,17);assert(Math.max(...ends)>11.4);nodes.forEach(n=>n.onended?.());
console.log('PASS Enjome audio: short wall fracture, impact + sustained fire, source cleanup');

for(const phase of m.exports.ENJO_STEPS){assert.equal(m.exports.enjoDemoOccupied(4,5,phase),false);assert.equal(m.exports.enjoDemoOccupied(4,6,phase),false);}assert.equal(m.exports.enjoDemoOccupied(4,7,'drop'),false);assert.equal(m.exports.enjoDemoOccupied(3,6,'wall'),true);console.log('PASS Enjome occupies two empty cells; landing cells never overlap dice');

assert.deepEqual(Array.from(m.exports.enjoSteps(2)),Array.from(m.exports.ENJO_STEPS));const three=Array.from(m.exports.enjoSteps(3));assert(three.indexOf('middle')>three.indexOf('breakUpper'));assert(three.indexOf('breakMiddle')<three.indexOf('lower'));assert(three.indexOf('ready')>three.indexOf('breakLower'));for(const phase of three)for(const y of [4,5,6])assert.equal(m.exports.enjoDemoOccupied(4,y,phase,3),false);console.log('PASS three-cell capsule: upper/middle/lower unlock before ready; three empty cells, two-cell flame');

starts.length=0;ends.length=0;audio.exports.playEnjoRise(ctx,{});assert.equal(starts.length,3);assert(Math.max(...ends)<=10.61);
starts.length=0;ends.length=0;audio.exports.playEnjoDive(ctx,{});assert.equal(starts.length,2);assert(Math.max(...ends)<=10.35);
starts.length=0;ends.length=0;audio.exports.playEnjoImpact(ctx,{});assert.equal(starts.filter(t=>t>=11).length,10);assert(Math.max(...ends)<11.7);nodes.forEach(n=>n.onended?.());
console.log('PASS Enjo ascent/descent envelopes and four timed extinguish swishes fit the blast lifetime');
