const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
const {harness,boardFixture}=require('./check-enemy-practice.cjs');
const m={exports:{}};vm.runInNewContext('(function(exports){'+ts.transpileModule(fs.readFileSync(require('path').join(__dirname,'../src/enemy/hyoketsuFireworks.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText+'\n})')(m.exports);
const {HYOKETSU_BURST_MS,HYOKETSU_RING,hyoketsuIceState}=m.exports;
assert.equal(HYOKETSU_BURST_MS,2600);assert.equal(HYOKETSU_RING.length,8);assert.equal(new Set(HYOKETSU_RING.map(p=>p.x+','+p.y)).size,8);
assert.deepEqual(Array.from(HYOKETSU_RING,p=>p.x+','+p.y),['1,0','0,0','0,1','0,2','1,2','2,2','2,1','2,0']);
for(let i=0;i<=8;i++)assert.equal(hyoketsuIceState(i*125).frozen,i);
assert.equal(hyoketsuIceState(999).phase,'freeze');assert.equal(hyoketsuIceState(1000).phase,'sweep');assert.equal(hyoketsuIceState(1399).phase,'sweep');assert.equal(hyoketsuIceState(1400).phase,'shatter');assert.equal(hyoketsuIceState(1999).phase,'shatter');assert.equal(hyoketsuIceState(2000).phase,'afterglow');assert.equal(hyoketsuIceState(2599).phase,'afterglow');assert.equal(hyoketsuIceState(2600).phase,'done');
const audioModule={exports:{}};vm.runInNewContext('(function(exports){'+ts.transpileModule(fs.readFileSync(require('path').join(__dirname,'../src/enemy/icePing.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText+'\n})')(audioModule.exports);
const tones=[];const context={currentTime:10,createGain:()=>({gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}),createOscillator:()=>{const tone={frequency:{setValueAtTime(v){tone.from=v;},exponentialRampToValueAtTime(v,t){tone.to=v;tone.rise=t;}},connect(){},disconnect(){},start(t){tone.startAt=t;},stop(t){tone.stopAt=t;}};tones.push(tone);return tone;}};
audioModule.exports.playIcePing(context,{});assert.equal(tones.length,4);for(const tone of tones){assert(tone.to>tone.from);assert(tone.stopAt>10.3&&tone.stopAt<10.5);}
const noises=[];const fullAudio={...context,sampleRate:24000,createBuffer:(_channels,n)=>({getChannelData:()=>new Float32Array(n)}),createBufferSource:()=>{const n={connect(){},disconnect(){},start(t){n.at=t;},stop(t){n.end=t;}};noises.push(n);return n;},createBiquadFilter:()=>({frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},Q:{value:0},connect(){},disconnect(){}})};
audioModule.exports.playIceFreeze(fullAudio,{});assert.equal(noises.length,8);noises.forEach((n,i)=>{assert(Math.abs(n.at-(10+i*.125))<1e-6);assert(Math.abs(n.end-n.at-.1)<1e-6);});
const toneCount=tones.length;audioModule.exports.playIceCrash(fullAudio,{});assert.equal(tones.length-toneCount,9);assert.equal(noises.length,9);assert(tones.at(-1).stopAt>11,'glass tail extends through afterglow');
(async()=>{
 const h=harness('hyoketsume');await h.boot();await h.until(()=>h.tree.read().status==='playing','startup');
 const points=[];for(let y=11;y<14;y++)for(let x=2;x<5;x++)points.push([x,y,2]);
 const b=boardFixture(h,points);b[12][3]={id:'firework-test',value:-7,hyoketsu:'active',fuse:1,group:-4403};b[12][2].value=-1;b[12][4].value=-2;
 h.tree.setBoard(b);h.tree.setCurrent(h.tree.makeSinglePiece(990,2,0));await h.flush();h.tree.hardDrop();await h.flush();await h.until(()=>h.tree.read().hyoketsuBlasts.length===1,'burst starts');
 assert.equal(h.tree.read().hyoketsuBlasts[0].flashCells.length,9);assert.equal(h.tree.read().clearingCells.size,0,'ice phases replace old white square flash');
 await h.advance(1000);assert.equal(h.tree.read().hyoketsuBlasts.length,1,'effect still active after 1 second');assert(h.tree.read().board[12][3],'body retained through flash');
 await h.advance(1050);assert.equal(h.tree.read().hyoketsuBlasts.length,1,'afterglow remains after shatter at 2050ms');
 h.tree.togglePause();await h.flush();await h.advance(3000);assert.equal(h.tree.read().status,'paused');assert.equal(h.tree.read().hyoketsuBlasts.length,1,'pause keeps effect');
 h.tree.resume();await h.flush();await h.until(()=>['playing','cleared'].includes(h.tree.read().status),'burst ends');assert.equal(h.tree.read().hyoketsuBlasts.length,0);assert.equal(h.tree.read().clearingCells.size,0);assert(!h.tree.read().board.flat().some(c=>c?.id==='firework-test'));
 h.tree.playAgain();await h.flush();await h.until(()=>h.tree.read().status==='playing','replay');assert.equal(h.tree.read().hyoketsuBlasts.length,0);h.assertRealUnchanged();
 console.log('PASS Hyoketsu fireworks: 1000ms counterclockwise freeze, 400ms sweep, 600ms 2D shatter + 600ms afterglow over nine occupied cells, pause, cleanup, replay and isolated saves');
})().catch(e=>{console.error(e);process.exitCode=1;});
