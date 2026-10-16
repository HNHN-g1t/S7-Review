/** Run the actual App with the existing virtual-clock engine harness.
 * Fixtures isolate heights and RNG boundaries; not a natural-play balance test.
 */
const fs = require('fs'), Module = require('module');
const harnessPath = require.resolve('./check-campaign-engine.cjs');
let harness = fs.readFileSync(harnessPath, 'utf8').split('(async () => {')[0];
harness = harness.replace('crypto: require(\'crypto\').webcrypto, Math }', "crypto: require('crypto').webcrypto, Math: Object.create(Math), pieceWeights: [] }");
harness = harness.replace("source = source.replace(\"useState<SoundMode>('all')\"", "source = source.replace('const shape = pickShape();', 'globalThis.pieceWeights.push(boostWeight); const shape = pickShape();');\n        source = source.replace(\"useState<SoundMode>('all')\"");
harness = harness.replace('read:()=>({story,', 'wall22DiceWeight,stackReachesHeight,stackTooHigh,storyPickValue,createPiece,bombLockRef,startMission,read:()=>({current,nextPiece,story,');
const tests = `
(async () => {
 const heights = [0,1,4,5,6,7,8,9,10,14];
 const heightBoard = h => { const b = tree.emptyBoard(); for (let y=14-h;y<14;y++) b[y][0]={id:'height-'+y,value:2,group:9000+y}; return b; };
 const heightOf = b => { const y=b.findIndex(row=>row.some(Boolean));return y<0?0:14-y; };
 for (const h of heights) {
  const b=heightBoard(h);
  assert.equal(tree.stackReachesHeight(b,5), h>=5);
  assert.equal(tree.stackReachesHeight(b,9), h>=9);
  assert.equal(tree.stackTooHigh(b),h>=7,'other lessons retain seven-row threshold');
  assert.equal(tree.wall22DiceWeight(29,b),h>=5?4:3);
  for (const stage of [null,5,23,32,36,31]) assert.equal(tree.wall22DiceWeight(stage,b),3);
 }
 // Occupancy is the highest cell, including a high cell with holes underneath.
 const floating=tree.emptyBoard(); floating[5][6]={id:'high',value:2,group:1};
 assert(tree.stackReachesHeight(floating,9));
 await start(29);
 await until(()=>tree.read().bombPhase==='play'&&tree.read().status==='playing','2-2 demo');
 // The previous three-miss practice reset must also respect the ninth row.
 for (const h of [4,5,8,9]) {
  const b=heightBoard(h); b[13][4]={id:'seed1',value:3,group:4};b[12][5]={id:'seed2',value:3,group:5};
  tree.bombLesson.current.miss=2;tree.setBoard(b);await flush();
  let done=false;tree.bombLockRef.current(b,false,0).then(()=>done=true);
  await until(()=>done,'practice height '+h);
  assert.equal(heightOf(tree.read().board),h>=9?2:h,'practice reset threshold');
 }
 await fire('sla3');await fire('sla3');
 assert.equal(tree.read().bombPhase,'mission');
 // Exact raw draw weights: low [1,.45,3,1,.45,1], high [1,.45,4,1,.45,1].
 for (const [weight,total,expected] of [[3,6900,3000],[4,7900,4000]]) {
  let target=0;
  for(let i=0;i<total;i++) {context.Math.random=()=> (i+.5)/total; if(tree.storyPickValue(weight)===3)target++;}
  assert.equal(target,expected);
 }
 // Deterministic random stream also exercises existing inner-seven rerolls.
 function sample(weight) {
  let seed=1729,calls=0,target=0;
  context.Math.random=()=>{assert(++calls<200000,'bounded piece generation');seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
  for(let i=0;i<4000;i++) for(const v of tree.createPiece(i,false,weight).matrix.flat())if(v===3)target++;
  return target/12000;
 }
 const low=sample(3),high=sample(4);assert(high>low+.04);
 context.Math.random=Math.random;
 console.log('PASS raw 3 probability: 3000/6900 -> 4000/7900; accepted piece sample:',low,high);
 for(const h of [4,5,7,8,9,10]) {
  tree.bombLesson.current.success=1;context.pieceWeights.length=0;
  // Real hard-drop -> resolver -> bomb lock -> spawn/reset. Drop is elsewhere.
  const b=heightBoard(h);await dropBoard(b,2,6);
  const s=tree.read();assert.equal(s.bombSuccess,1,'reset retains progress');
  if(h<9){assert.equal(heightOf(s.board),h);assert.equal(context.pieceWeights.at(-1),h>=5?4:3,'replacement uses resolved height');}
  else {assert(heightOf(s.board)<5);assert.deepEqual(context.pieceWeights.slice(-2),[3,3],'reset immediately returns to normal weight');}
 }
 // Reducing the stack switches weighting back; shown NEXT stays unchanged.
 const shownNext=JSON.stringify(tree.read().nextPiece.matrix);
 await dropBoard(heightBoard(4),2,6);
 assert.equal(JSON.stringify(tree.read().current.matrix),shownNext);
 assert.equal(context.pieceWeights.at(-1),3);
 async function pendingReset(){const b=heightBoard(9);tree.setBoard(b);tree.setCurrent(tree.makeSinglePiece(++id,2,6));await flush();tree.hardDrop();await until(()=>tree.read().saika.text==='いったん消すとしようかの','scatter pending');}
 await pendingReset();tree.togglePause();await flush();
 assert.equal(tree.read().status,'paused');const frozen=JSON.stringify(tree.read().board);
 let elapsed=false;win.setTimeout(()=>elapsed=true,1000);await until(()=>elapsed,'pause clock');
 assert.equal(JSON.stringify(tree.read().board),frozen);
 tree.togglePause();await flush();await until(()=>tree.read().status==='playing','resume reset');assert(heightOf(tree.read().board)<5);
 for(const paused of [false,true]){
  for(const action of ['restart','exit']){
   await pendingReset();if(paused){tree.togglePause();await flush();}
   if(action==='restart')tree.playAgain();else tree.backToTitle();await flush();
   const run=tree.storyRunRef.current;let elapsed=false;win.setTimeout(()=>elapsed=true,1000);await until(()=>elapsed,'discard old reset');
   assert.equal(tree.storyRunRef.current,run);
   if(action==='exit'){assert.equal(tree.read().status,'ready');assert.equal(tree.read().mapStage,null);}
   else assert.equal(tree.read().bombPhase,'demo','old mission cannot overwrite restarted demo');
   await start(29);await until(()=>tree.read().bombPhase==='play'&&tree.read().status==='playing','return 2-2');await fire('sla3');await fire('sla3');
  }
 }
 // Legacy Slash 3 and other mapped lessons keep seven-row reset and weight 3.
 for(const stage of [5,32,36]){
  await start(stage);await until(()=>tree.read().bombPhase==='play'&&tree.read().status==='playing','unaffected demo');
  tree.bombLesson.current.phase='mission';context.pieceWeights.length=0;
  await dropBoard(heightBoard(7),2,6);assert(heightOf(tree.read().board)<7);assert(context.pieceWeights.every(w=>w===3));
 }
 assert.deepEqual(errors,[]);
 console.log('PASS 2-2 practice/mission 4/5/7/8/9/10 row boundaries, progress retained, NEXT preserved, low/high weighting, reset/pause/resume/restart/exit stale timers, legacy/other lessons unchanged');
})().catch(e=>{console.error(e);process.exitCode=1});
`;
const runner = new Module(harnessPath, module);runner.filename=harnessPath;runner.paths=module.paths;runner._compile(harness+tests,harnessPath);
