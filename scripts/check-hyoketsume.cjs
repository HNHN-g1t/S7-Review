const assert = require('node:assert/strict');
const {harness, boardFixture}=require('./check-enemy-practice.cjs');
(async()=>{
 const h=harness('hyoketsume');await h.boot();await h.until(()=>h.tree.read().status==='playing','startup');
 let cells=h.tree.read().board.flat().filter(Boolean);
 assert(cells.some(c=>c.value===-1));assert(cells.some(c=>c.value===-2));assert(cells.some(c=>c.hyoketsu==='frozen'));
 const ice=()=>h.tree.read().board.flat().find(c=>c?.hyoketsu);
 const board=boardFixture(h,[[2,13,1],[6,13,-2]]);board[13][3]={id:'test-ice',value:-7,hyoketsu:'frozen',group:-4403};
 await h.drop(board,6,2);assert.equal(ice().hyoketsu,'active');assert.equal(ice().fuse,6);
 for(let n=5;n>=1;n--){const b=boardFixture(h,[[6,13,-2]]);b[13][3]={...ice()};await h.drop(b,2,0);assert.equal(ice().fuse,n);}
 const last=boardFixture(h,[[6,13,-2],[2,13,5],[4,13,5]]);last[13][3]={...ice()};await h.drop(last,2,0);assert(!ice(),'expired bomb disappears');assert(!h.tree.read().board[13][2]);assert(!h.tree.read().board[13][4]);
 const frozen=boardFixture(h,[[6,13,-2]]);frozen[13][3]={id:'cold',value:-7,hyoketsu:'frozen',group:-4403};await h.drop(frozen,2,0);assert.equal(ice().hyoketsu,'frozen');assert.equal(ice().fuse,undefined);
 const active=boardFixture(h,[[6,13,-2]]);active[13][3]={id:'hot',value:3,hyoketsu:'active',fuse:6,group:-4403};await h.drop(active,4,3);assert(ice(),'3+4 cannot erase active bomb');assert.equal(ice().fuse,5);
 for(const state of ['frozen','active']) {
   const b=boardFixture(h,[[0,13,1],[1,13,1],[2,13,1],[3,13,1],[6,13,-2]]);
   b[12][3]={id:'immune-'+state,value:state==='frozen'?-7:3,hyoketsu:state,fuse:state==='active'?6:undefined,group:-4403};
   await h.drop(b,1,4);assert(ice(),'special move cannot erase '+state);assert.equal(ice().hyoketsu,state,'special move does not thaw ice');
 }
 const other=boardFixture(h,[[6,13,-2]]);
 other[13][2]={id:'expired',value:-7,hyoketsu:'active',fuse:1,group:-4410};
 other[13][3]={id:'survivor',value:-7,hyoketsu:'active',fuse:6,group:-4411};
 await h.drop(other,2,0);assert.equal(ice().id,'survivor','another bomb blast cannot erase unexpired bomb');assert.equal(ice().fuse,5);
 h.tree.playAgain();await h.flush();await h.until(()=>h.tree.read().status==='playing','replay');assert(ice()?.hyoketsu==='frozen');h.assertRealUnchanged();
 console.log('PASS Hyoketsume real App: mixed opening, adjacent thaw, 6..1 countdown, blast, frozen hold, seven immunity, replay and save isolation');
})().catch(e=>{console.error(e);process.exitCode=1;});
