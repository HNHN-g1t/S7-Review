/** Actual App state/clock regressions. Rendering and human hearing are separate checks. */
const assert = require('node:assert/strict');
const { harness } = require('./check-enemy-practice.cjs');
const plain = value => JSON.parse(JSON.stringify(value));
async function start(options = {}) {
  const h = harness('anchikushoume', options);
  await h.boot();
  await h.until(() => h.tree.read().status === 'playing', 'Anchi ready');
  return h;
}
function fixture(h, {x=2,y=10,w=3,height=3,eye={x:0,y:0},turn=0,sizeIndex=4} = {}) {
  const b = h.tree.emptyBoard();
  for(let yy=y;yy<y+height;yy++) for(let xx=x;xx<x+w;xx++) b[yy][xx]={id:`a${xx}-${yy}`,value:-6,group:-6000};
  [1,2,3].forEach((value,xx)=> b[13][xx]={id:`t${xx}`,value,group:xx+1});
  h.tree.setBoard(b); h.tree.updateAnchi({sizeIndex,eye,turn,dying:false});
  return b;
}
async function lightning({ eye, fever=false, body=true }) {
  const h = await start();
  // Predict the real RNG choice from a fresh twin, rather than replacing damage or selection.
  const twin = await start(); fixture(twin); await twin.flush();
  if(fever) { twin.tree.setFever(100); await twin.until(()=>twin.tree.read().feverActive,'twin FEVER'); }
  void twin.tree.fireThunder(); await twin.until(()=>!!twin.tree.read().thunderBolt,'twin bolt');
  const cols = plain(twin.tree.read().thunderBolt);
  const selected = cols[0], missed = [...Array(7).keys()].find(x=>!cols.includes(x));
  const x = body ? Math.min(selected, missed) : missed;
  const width = body ? Math.abs(selected-missed)+1 : 1;
  fixture(h,{x,w:width,height:1,sizeIndex:1,eye:{x:(eye?selected:missed)-x,y:0}});
  await h.flush();
  if(fever) { h.tree.setFever(100); await h.until(()=>h.tree.read().feverActive,'FEVER'); }
  void h.tree.fireThunder(); await h.flush();
  assert.equal(h.tree.read().thunderCall,'イチ'); assert.equal(h.tree.read().anchiHit,false);
  await h.advance(319); assert.equal(h.tree.read().thunderBolt,null);
  await h.advance(1); assert.equal(h.tree.read().thunderCall,'ニノ');
  // 2026-10-14 イチニノサンダー：「ニノ」のあと300msのタメ
  await h.advance(619); assert.equal(h.tree.read().thunderCall,'ニノ'); assert.equal(h.tree.read().thunderBolt,null);
  assert.equal(h.tree.read().anchiDefeated,0);
  await h.advance(1);
  assert.deepEqual(plain(h.tree.read().thunderBolt),cols);
  assert.equal(cols.length,fever?4:2);
  if(!fever) assert(cols.every((x,i)=>i===0||x-cols[i-1]>1));
  assert.equal(h.tree.read().thunderCall,'サンダー！');
  assert.equal(h.tree.read().anchiHit,eye,'hit expression starts on the exact bolt tick');
  if(eye || body) assert.equal(h.tree.read().anchiHitTone,'thunder');
  if(eye) assert.equal(h.tree.read().anchiFlash,null,'yellow body Canvas keeps eye visible');
  await h.advance(180);
  if(eye) assert(h.tree.read().anchiHit,'expression persists during hit sequence');
  await h.until(()=>['playing','cleared'].includes(h.tree.read().status),'thunder resolved');
  assert.equal(h.tree.read().anchiDefeated,eye?1:0,'only actual eye hit defeats');
  if(!eye) assert(h.tree.read().board.some(row=>row.some(c=>c?.value===-6)),'body/miss preserves enemy');
  else assert(!h.tree.read().board.some(row=>row.some(c=>c?.value===-6)),'eye hit removes enemy');
  h.assertRealUnchanged();
}
async function eyeMotion() {
  const h=await start({effects:true});
  fixture(h,{w:4,height:4,y:9,sizeIndex:6,eye:{x:0,y:2}}); await h.flush();
  await h.advance(1650);
  const a=plain(h.tree.read().anchi.eye);
  assert(!Number.isInteger(a.x)||!Number.isInteger(a.y),'eye has intermediate visible samples');
  assert(a.y<=2 && (a.x===0||a.x===3||a.y===0));
  assert(h.tree.anchiEyeIn([{x:2+Math.floor(a.x+.5),y:9+Math.floor(a.y+.5)}],h.tree.read().board));
  h.tree.togglePause(); await h.flush(); await h.advance(4000);
  assert.deepEqual(plain(h.tree.read().anchi.eye),a,'pause freezes authority eye');
  h.tree.resume();await h.flush();await h.advance(500);
  assert(Number.isInteger(h.tree.read().anchi.eye.x)&&Number.isInteger(h.tree.read().anchi.eye.y));
  h.tree.setStatus('clearing');await h.flush();const frozen=plain(h.tree.read().anchi.eye);await h.advance(3000);
  assert.deepEqual(plain(h.tree.read().anchi.eye),frozen,'chant/resolving freezes eye');
  h.tree.playAgain();await h.flush();await h.until(()=>h.tree.read().status==='playing','restart eye');
  assert.deepEqual(plain(h.tree.read().anchi.eye),{x:0,y:0});
}
async function growthAndPaint() {
  const h=await start({effects:true});
  const b=fixture(h,{x:3,y:12,w:1,height:1,sizeIndex:0,turn:1,eye:{x:0,y:0}});
  b[12][2]={id:'food',value:4,group:19}; h.tree.setBoard(b); h.tree.setStatus('clearing'); await h.flush();
  let finished=false;void h.tree.growAnchi(b).then(()=>finished=true);await h.flush();
  assert.equal(h.tree.read().absorbCells.size,1,'same multi-absorb state as Detarame');
  assert.equal(h.tree.read().absorbCells.get('2,12').dx,1);
  assert.equal(h.tree.read().board[12][2].value,4,'food persists until animation ends');
  await h.advance(759);assert.equal(finished,false);
  await h.advance(1);assert(finished);assert.equal(h.tree.read().absorbCells.size,0);
  assert.equal(h.tree.read().board[12][2].value,-6);
  assert.deepEqual(plain(h.tree.read().anchi.eye),{x:1,y:0},'growth remaps old world eye after left shift');
  // Keep max-size geometry unchanged; frequency is exactly turns 1,5,9.
  const p=fixture(h,{x:2,y:9,w:4,height:4,sizeIndex:6,turn:0});
  h.tree.setStatus('clearing');await h.flush();
  for(let turn=1;turn<=9;turn++) {
    h.tree.updatePaints([]);await h.tree.growAnchi(p);await h.flush();
    assert.equal(h.tree.read().anchiPaints.length>0,turn%4===1,'half-frequency turn '+turn);
  }
  let paint=h.tree.read().anchiPaints[0];assert.equal(paint.phase,'flying');
  await h.advance(330);paint=h.tree.read().anchiPaints[0];assert.equal(paint.phase,'spreading');
  await h.advance(270);assert.equal(h.tree.read().anchiPaints[0].phase,'resting');
  h.tree.togglePause();await h.flush();let age=h.tree.read().anchiPaints[0].age;
  await h.advance(6000);assert.equal(h.tree.read().anchiPaints[0].age,age);
  h.tree.resume();await h.flush();await h.until(()=>h.tree.read().anchiPaints.some(p=>p.phase==='fading'),'paint fade');
  await h.advance(2500);assert.equal(h.tree.read().anchiPaints.length,0,'expiry removes all paint');
  h.tree.throwAnchiPaint(h.tree.read().board,{x:2,y:9,w:4,h:4});await h.flush();
  h.tree.playAgain();await h.flush();await h.advance(6000);
  assert.equal(h.tree.read().anchiPaints.length,0,'old launch cannot land in restarted run');
  assert.equal(h.tree.read().absorbCells.size,0);
}
async function mixed() {
  const h=harness('anchikushoume',{campaign:true,location:{hostname:'localhost',pathname:'/',search:'?review=story'}});
  h.win.localStorage.setItem('sainome-wall1-progress-v1',JSON.stringify({cleared:Array.from({length:43},(_,i)=>20+i),gateReached:true}));
  h.win.localStorage.setItem('sainome-reset-story-v1','1');
  await h.boot(); h.tree.startStage(63);await h.until(()=>h.tree.read().status==='playing','6-4 ready');
  for (let i=0;i<2;i++) await h.drop(h.tree.read().board,4,i===0?0:6);
  assert.equal(h.tree.read().detarames.length,2,'both Detarame in mixed mission after two legal moves');
  assert(h.tree.read().anchi,'Anchi in mixed mission');
  const b=h.tree.read().board.map(r=>r.map(c=>c&&({...c})));
  let spot=null;
  for(let y=13;y>=0&&!spot;y--) for(let x=0;x<5&&!spot;x++) if([0,1,2].every(dx=>!b[y][x+dx]||b[y][x+dx].value>0)) spot={x,y};
  assert(spot);
  [1,2,3].forEach((value,i)=>{b[spot.y][spot.x+i]={id:'mixed-thunder-'+i,value,group:80+i};});
  // Leave actual enemy state/ids intact; add only the legal trace to available bottom cells.
  h.tree.setBoard(b);await h.flush();void h.tree.fireThunder();
  await h.until(()=>!!h.tree.read().thunderBolt,'mixed strike');
  await h.until(()=>['playing','cleared','gameover'].includes(h.tree.read().status),'mixed resolves');
  const ids=h.tree.read().detarames.map(d=>d.id);assert.equal(new Set(ids).size,ids.length,'mixed identities remain distinct');
}
(async()=>{
  await lightning({eye:true});await lightning({eye:false});await lightning({eye:false,body:false});await lightning({eye:true,fever:true});
  console.log('PASS actual lightning tick: eye hit, body-only, full miss, FEVER5, normal3 nonadjacent; yellow hit and one-hit defeat');
  await eyeMotion();console.log('PASS actual eye travel, matching hit cell, pause/resume/clearing/restart');
  await growthAndPaint();console.log('PASS Detarame absorption, origin shift, half-frequency paint launch/spread/fade/expiry and interruption');
  await mixed();console.log('PASS 6-4 Anchi + two Detarame real resolver with distinct identities');
})().catch(e=>{console.error(e);process.exitCode=1;});
