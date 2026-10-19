const assert=require('node:assert/strict');const {harness}=require('./check-enemy-practice.cjs');
(async()=>{for(const rows of [2,3])for(const fever of [false,true]){
 const h=harness('enjo');h.win.location.search+='&walls='+rows+'&fever='+(fever?1:0);await h.boot();await h.until(()=>h.tree.read().status==='playing','start');
 const parts=()=>h.tree.read().board.flatMap((row,y)=>row.flatMap((c,x)=>c?.enjo?[{c,x,y}]:[]));
 assert.equal(parts().length,rows);assert.equal(h.tree.armEnjo(),false,'cannot tap sealed bomb');
 for(let i=0;i<rows;i++){const target=parts().find(p=>p.c.enjo.part===i);const b=h.tree.read().board.map(row=>row.map(c=>c?.id.startsWith('enjo-unlock-one-')?null:c));b[target.y][1]={id:'one-'+i,value:1,group:1100+i};b[target.y][2]={id:'six-'+i,value:6,group:1200+i};await h.drop(b,2,6);assert(parts().find(p=>p.c.enjo.part===i).c.enjo.open,'real adjacent seven unlocks one wall');if(i<rows-1)assert.equal(h.tree.armEnjo(),false,'all tiers required');}
 assert.equal(h.tree.armEnjo(),true);await h.flush();assert.equal(h.tree.read().enjoFlight.phase,'hover');assert.equal(parts().length,0,'launch removes collider');
 const b=h.tree.emptyBoard();for(let y=9;y<14;y++)for(let x=0;x<7;x++)b[y][x]={id:'target-'+x+'-'+y,value:(x+y)%2?-1:5,group:3000+y*7+x};
 b[13][0]={id:'target-ice',value:-7,hyoketsu:'frozen',group:9999};h.tree.setBoard(b);h.tree.setCurrent(h.tree.makeSinglePiece(990,2,0));await h.flush();h.tree.hardDrop();await h.flush();await h.until(()=>h.tree.read().enjoBlast!==null,'impact');assert.equal(h.tree.read().enjoBlast,fever);assert.equal(h.tree.read().clearingCells.size,fever?23:16);
 h.tree.togglePause();await h.flush();await h.advance(2300);assert.notEqual(h.tree.read().enjoBlast,null);h.tree.resume();await h.flush();await h.until(()=>h.tree.read().enjoBlast===null,'finish');
 const remaining=h.tree.read().board.flat().filter(Boolean).map(c=>c.id);assert(!remaining.includes('target-3-13'));assert(!remaining.includes('target-ice'),'fire destroys frozen bomb');assert(remaining.includes('target-0-9'),'outside pyramid survives');
 h.tree.playAgain();await h.flush();await h.until(()=>h.tree.read().status==='playing','replay');assert.equal(parts().length,rows);assert(parts().every(p=>!p.c.enjo.open));assert.equal(h.tree.read().enjoFlight,null);h.assertRealUnchanged();console.log('PASS real Enjo game: '+rows+' tiers, '+(fever?'FEVER 23 clipped':'normal 16')+', unlock/tap/next drop/pause/replay/save isolation');
}})().catch(e=>{console.error(e);process.exitCode=1;});
