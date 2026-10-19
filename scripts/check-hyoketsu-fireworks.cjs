const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
const {harness,boardFixture}=require('./check-enemy-practice.cjs');
const m={exports:{}};vm.runInNewContext('(function(exports){'+ts.transpileModule(fs.readFileSync(require('path').join(__dirname,'../src/enemy/hyoketsuFireworks.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText+'\n})')(m.exports);
const {HYOKETSU_BURST_MS,hyoketsuFireworksAt}=m.exports;
assert.equal(HYOKETSU_BURST_MS,2000);
for(let t=0;t<2000;t+=13){const circles=hyoketsuFireworksAt(t);assert(circles.length>0,'continuous emission at '+t);assert(new Set(circles.map(c=>c.color)).size>=6);for(const c of circles){assert(c.x-c.r>=-1e-9&&c.x+c.r<=3+1e-9&&c.y-c.r>=-1e-9&&c.y+c.r<=3+1e-9,'circle stays inside 3x3');assert(c.alpha>0&&c.alpha<=1);}}
assert.equal(hyoketsuFireworksAt(2000).length,0);
(async()=>{
 const h=harness('hyoketsume');await h.boot();await h.until(()=>h.tree.read().status==='playing','startup');
 const points=[];for(let y=11;y<14;y++)for(let x=2;x<5;x++)points.push([x,y,2]);
 const b=boardFixture(h,points);b[12][3]={id:'firework-test',value:-7,hyoketsu:'active',fuse:1,group:-4403};b[12][2].value=-1;b[12][4].value=-2;
 h.tree.setBoard(b);h.tree.setCurrent(h.tree.makeSinglePiece(990,2,0));await h.flush();h.tree.hardDrop();await h.flush();await h.until(()=>h.tree.read().hyoketsuBlasts.length===1,'burst starts');
 assert.equal(h.tree.read().hyoketsuBlasts[0].flashCells.length,9);assert.equal(h.tree.read().clearingCells.size,9);
 await h.advance(1000);assert.equal(h.tree.read().hyoketsuBlasts.length,1,'effect still active after 1 second');assert(h.tree.read().board[12][3],'body retained through flash');
 h.tree.togglePause();await h.flush();await h.advance(3000);assert.equal(h.tree.read().status,'paused');assert.equal(h.tree.read().hyoketsuBlasts.length,1,'pause keeps effect');
 h.tree.resume();await h.flush();await h.until(()=>['playing','cleared'].includes(h.tree.read().status),'burst ends');assert.equal(h.tree.read().hyoketsuBlasts.length,0);assert.equal(h.tree.read().clearingCells.size,0);assert(!h.tree.read().board.flat().some(c=>c?.id==='firework-test'));
 h.tree.playAgain();await h.flush();await h.until(()=>h.tree.read().status==='playing','replay');assert.equal(h.tree.read().hyoketsuBlasts.length,0);h.assertRealUnchanged();
 console.log('PASS Hyoketsu fireworks: 2000ms continuous six-color circles within 3x3, nine occupied-cell flashes including both enemies, pause, cleanup, replay and isolated saves');
})().catch(e=>{console.error(e);process.exitCode=1;});
