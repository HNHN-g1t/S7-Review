/**
 * Wall 7 actual-engine boundary checks, sharing the campaign hook/clock harness.
 * Only the VM copy gains read accessors and seeded randomness. Board fixtures
 * arrange legal moves; damage, AI, generated enemies and victory run unchanged.
 * This is not browser rendering, touch input, audio or natural-play balance QA.
 * Run: node scripts/check-wall7-engine.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const original = fs.readFileSync(path.join(__dirname, 'check-campaign-engine.cjs'), 'utf8');
const prefixEnd = original.indexOf('const dialogueCatalog =');
const helpersStart = original.indexOf('const bombs =');
const scenariosStart = original.indexOf('\n(async () => {');
if ([prefixEnd, helpersStart, scenariosStart].some(index => index < 0)) throw Error('Campaign harness markers changed.');
let harness = original.slice(0, prefixEnd) + original.slice(helpersStart, scenariosStart);
harness = harness.replace('return {startStage,', 'return {fireThunder,startStage,');
harness = harness.replace('read:()=>({story,', `read:()=>({qa:{detarames:detaramesRef.current,spawned:detarameSpawned.current,defeated:detarameDefeated.current,generated:campaignGeneratedEnemies.current,beams:detarameBeams,wallSpawned:wallEnemySpawned.current,reinforce:wallReinforcePending.current,swarmSpawned:swarmSpawned.current,anchi:anchiRef.current,anchiDefeated:anchiDefeated.current,thunderSet,thunderCall,thunderBolt},story,`);
harness = harness.replace("name === './thunder' ?", "name === './enemy/anchiEye' ? load('src/enemy/anchiEye.ts') : name === './thunder' ?");
harness = `let qaSeed = 741068, qaRandomOverride = null;
const qaMath = Object.create(Math);
qaMath.random = () => qaRandomOverride === null ? ((qaSeed = (Math.imul(qaSeed,1664525)+1013904223)>>>0)/4294967296) : qaRandomOverride;
` + harness.replace(', Math };', ', Math: qaMath };');

const scenarios = String.raw`
const mission = number => DATA.CAMPAIGN_MISSIONS.find(m => m.number === number);
const small = () => tree.read().board.flat().filter(c => c && [-1,-2].includes(c.value));
const remaining = () => tree.read().missionGoal-tree.read().missionNow;
async function begin(number) {
  qaRandomOverride=null;
  await start(mission(number).stage);
  await until(()=>tree.read().status==='playing'&&!tree.read().demo,'begin '+number);
}
async function advance(ms) {
  const end=now+ms;
  for(let n=0;n<5000;n++) {
    await flush();timers.sort((a,b)=>a.at-b.at);
    if(!timers.length||timers[0].at>end){now=end;await flush();return;}
    const timer=timers.shift();now=timer.at;timer.fn();
  }
  throw Error('Wall 7 timer loop');
}
async function quietDrop() { return dropBoard(actors(),2,3); }
function beamFixture() {
  const b=actors(), d=tree.read().qa.detarames.find(d=>!d.dying);
  assert(d,'beam fixture has a real live Detarame');
  // Use its outward-facing eye so the other Detarame cannot block the beam.
  const side=d.x<3?-1:1, x=side<0?0:6;
  const index=d.segs.findIndex(seg=>seg.alive&&seg.dir===side);
  assert(index>=0);
  for(let y=d.top+index;y<14;y++)b[y][x]={id:'wall7-beam-'+id++,value:2,group:50000+id};
  return b;
}
async function beginBeam() {
  await begin('7-4');
  await quietDrop();
  tree.setBoard(beamFixture());tree.setCurrent(tree.makeSinglePiece(++id,2,3));await flush();
  qaRandomOverride=0;tree.hardDrop();
  await until(()=>tree.read().qa.beams.length>0,'7-4 real beam in flight');
}
async function startThunder() {
  // Retain the enemy and arrange a legal 1-2-3 on the ground beside it.
  const b=actors();
  [1,2,3].forEach((value,x)=>{assert(!b[13][x]);b[13][x]={id:'wall7-thunder-'+id++,value,group:60000+id};});
  tree.setBoard(b);await flush();
  assert(tree.read().qa.thunderSet,'legal thunder pattern detected');
  void tree.fireThunder();await flush();
  assert.equal(tree.read().status,'clearing');
}

(async()=>{
  const expected=[
    ['7-1',68,30000,0],['7-2',69,10,5],['7-3',17,1,9],['7-4',71,6,0],
    ['7-5',16,3,0],['7-6',73,1,1],['7-7',19,7,4],['7-8',75,12,3],
  ];
  const powers=['spa1','sla3','squ4','str6','nico','fever','rainbow','thunder'];
  for(const [number,script,target,enemyCells] of expected) {
    await begin(number);const state=tree.read();
    assert.equal(state.mapStage,mission(number).stage,number+' retains save identity');
    assert.equal(state.story,script,number+' uses correct runtime script');
    assert.equal(state.missionNow,0,number+' begins at zero');
    assert.equal(state.missionGoal,target,number+' scheduled goal');
    assert.equal(state.board.flat().filter(c=>c&&c.value<0).length,enemyCells,number+' opening enemies');
    assert.equal(state.board.length,14);
    assert(state.board.every(row=>row.length===7),number+' never writes outside the board');
    assert.deepEqual(Array.from(state.powers),powers,number+' all previously learned powers');
    assert.equal(state.diceBias,false,number+' no practice dice bias');
    assert.equal(state.boostValues.length,0);
    assert.equal(mission(number).kind==='lesson',false);
  }
  console.log('PASS Wall 7 all eight openings: map/script identity, targets, enemy cells, 7x14 boards and learned powers');

  await begin('7-1');
  tree.setScore(29999);await flush();await fixture([],2,0);
  assert.equal(tree.read().status,'playing');assert.equal(tree.read().missionNow,29999);
  tree.setScore(30000);await flush();await fixture([],2,0);
  assert.equal(tree.read().status,'cleared');assert.equal(tree.read().wallCounts.sevens,0);
  assert.equal(tree.storyCombosRef.current,0);
  assert(Object.values(tree.read().wallCounts.bombs).every(n=>n===0));
  console.log('PASS 7-1 exact 30,000-point boundary without hidden action requirements');

  await begin('7-2');
  assert.equal(tree.read().qa.reinforce,5);
  await attack(-1);await attack(-1);
  assert.equal(tree.read().status,'playing');
  assert.equal(tree.read().qa.reinforce,0);
  assert.equal(small().filter(c=>c.value===-2).length,3,'Dame remain when Koitsume trigger reinforcements');
  assert.equal(small().filter(c=>c.value===-1).length,5,'exactly five reinforcements');
  assert.equal(tree.read().missionNow,2);assert.equal(tree.read().missionGoal,10);
  console.log('PASS 7-2 reinforcements trigger after the two Koitsume, including while three Dame remain');

  await begin('7-8');
  for(let killed=1;killed<=12;killed++) {
    await attack(-1);
    assert.equal(tree.read().missionNow,killed);
    assert.equal(tree.read().missionGoal,12);
    assert.equal(tree.read().qa.wallSpawned,Math.min(12,3*(Math.floor(killed/3)+1)));
    assert.equal(tree.read().status,killed===12?'cleared':'playing');
  }
  assert.equal(tree.read().wallCounts.enemyKills,12);
  console.log('PASS 7-8 four three-enemy waves, scheduled enemies prevent early completion');

  await begin('7-4');
  assert.equal(tree.read().qa.spawned,0);assert.equal(remaining(),6);
  await quietDrop();
  assert.equal(tree.read().status,'playing');assert.equal(tree.read().qa.spawned,1);
  assert.equal(tree.read().qa.detarames.filter(d=>!d.dying).length,1);
  assert.equal(remaining(),6,'five unspawned enemies remain required');
  await quietDrop();
  assert.equal(tree.read().qa.spawned,2);
  assert.equal(tree.read().qa.detarames.filter(d=>!d.dying).length,2);
  assert.equal(remaining(),6);
  const beam=beamFixture();qaRandomOverride=0;
  await dropBoard(beam,2,3);qaRandomOverride=0.99;
  const generated=tree.read().qa.generated;
  assert(generated>0,'actual beams generated small enemies');
  assert.equal(small().length,generated);
  assert.equal(tree.read().missionGoal,6+generated);
  assert.equal(tree.read().qa.spawned,2,'simultaneous cap is two');
  for(let turn=0;tree.read().qa.defeated<6;turn++) {
    assert(turn<100,'six Detarame must remain beatable');
    const state=tree.read();
    assert.equal(state.status,'playing');assert(state.qa.detarames.filter(d=>!d.dying).length<=2);
    assert.equal(state.missionGoal,6+generated);
    // Preserve every generated enemy, moving it away from the arranged legal
    // Seven so boss-first completion exercises the required cleanup boundary.
    const b=actors(), first=b.flatMap((row,y)=>row.map((c,x)=>c?.value===-5?{x,y}:null)).find(Boolean);
    assert(first,'a scheduled Detarame appears while kills remain');
    const preserved=[];
    b.forEach(row=>row.forEach((c,x)=>{if(c&&[-1,-2].includes(c.value)){preserved.push(c);row[x]=null;}}));
    const far=first.x<3?6:0;
    preserved.forEach((c,i)=>{assert(!b[13-i][far]);b[13-i][far]=c;});
    b[first.y-1][first.x]={id:'wall7-boss-hit-'+id++,value:1,group:70000+id};
    await dropBoard(b,6,first.x);
    assert.equal(tree.read().qa.generated,generated,'disabled random beam attempts do not add enemies');
    assert(tree.read().qa.spawned<=6);
    if(tree.read().qa.defeated<6) {
      assert.equal(tree.read().status,'playing','unspawned or live Detarame prevent early clear');
      assert(remaining()>=6-tree.read().qa.defeated);
    }
  }
  assert.equal(tree.read().qa.spawned,6);
  assert.equal(tree.read().status,'playing','all six bosses defeated still requires generated small enemies');
  assert.equal(small().length,generated);
  assert.equal(remaining(),generated);
  for(let turn=0;small().length;turn++){assert(turn<20);await attack(small().some(c=>c.value===-2)?-2:-1);}
  assert.equal(tree.read().status,'cleared');assert.equal(remaining(),0);
  assert.equal(tree.read().missionGoal,6+generated);
  qaRandomOverride=null;
  console.log('PASS 7-4 six scheduled Detarame, two-at-once cap, real beam-generated enemies and final-small-enemy completion');

  // The real beam is suspended mid-flight, then resumed or discarded by the
  // same public pause/retry/title actions used during gameplay.
  await beginBeam();tree.togglePause();await flush();
  const frozen=JSON.stringify({board:tree.read().board,qa:tree.read().qa});
  await advance(5000);assert.equal(tree.read().status,'paused');
  assert.equal(JSON.stringify({board:tree.read().board,qa:tree.read().qa}),frozen);
  tree.togglePause();await flush();await until(()=>tree.read().status==='playing','7-4 beam resumes');
  assert(tree.read().qa.generated>0);
  for(const paused of [false,true])for(const exit of [false,true]) {
    await beginBeam();if(paused){tree.togglePause();await flush();}
    qaRandomOverride=null;
    if(exit)tree.backToTitle();else tree.playAgain();await flush();
    await until(()=>tree.read().status===(exit?'ready':'playing'),'7-4 retry/title');
    const board=JSON.stringify(tree.read().board);
    await advance(5000);
    assert.equal(tree.read().status,exit?'ready':'playing');
    assert.equal(JSON.stringify(tree.read().board),board,'old beam cannot overwrite new board');
    assert.equal(tree.read().qa.generated,0);assert.equal(tree.read().qa.spawned,0);
    assert.equal(tree.read().qa.detarames.length,0);assert.equal(tree.read().qa.beams.length,0);
    if(!exit){assert.equal(tree.read().mapStage,71);assert.equal(tree.read().missionNow,0);assert.equal(tree.read().missionGoal,6);}
  }
  console.log('PASS 7-4 in-flight beam pause/resume, active/paused retry and exit, with counter and stale-write isolation');

  await begin('7-6');
  await attack(-6);
  assert.equal(tree.read().status,'playing','ordinary Seven does not defeat Anchi');
  assert.equal(tree.read().qa.anchiDefeated,0);assert.equal(remaining(),1);
  for(let turns=0;tree.read().status!=='cleared';turns++) {
    assert(turns<30,'seeded random thunder eventually reaches the eye');
    await startThunder();
    await until(()=>['playing','cleared'].includes(tree.read().status),'7-6 real thunder');
  }
  assert.equal(tree.read().qa.anchiDefeated,1);
  assert.equal(remaining(),0);assert.equal(tree.read().missionNow,1);
  assert(tree.read().wallCounts.thunder>0);
  console.log('PASS 7-6 ordinary Seven rejected, legal 1-2-3 thunder eye hit clears through actual App damage and victory');

  await begin('7-6');await startThunder();tree.togglePause();await flush();
  const pausedCall=tree.read().qa.thunderCall, pausedBoard=JSON.stringify(tree.read().board);
  await advance(5000);assert.equal(tree.read().status,'paused');
  assert.equal(tree.read().qa.thunderCall,pausedCall);assert.equal(JSON.stringify(tree.read().board),pausedBoard);
  tree.togglePause();await flush();await until(()=>['playing','cleared'].includes(tree.read().status),'7-6 countdown resumes');
  for(const paused of [false,true])for(const exit of [false,true]) {
    await begin('7-6');await startThunder();if(paused){tree.togglePause();await flush();}
    if(exit)tree.backToTitle();else tree.playAgain();await flush();
    await until(()=>tree.read().status===(exit?'ready':'playing'),'7-6 retry/title');
    const board=JSON.stringify(tree.read().board);await advance(5000);
    assert.equal(tree.read().status,exit?'ready':'playing');
    assert.equal(JSON.stringify(tree.read().board),board,'old thunder cannot mutate restarted/exited board');
    assert.equal(tree.read().qa.anchiDefeated,0);
    assert.equal(tree.read().qa.thunderCall,null);assert.equal(tree.read().qa.thunderBolt,null);
    if(!exit){assert.equal(tree.read().mapStage,73);assert.equal(tree.read().missionNow,0);assert.equal(tree.read().qa.anchi.sizeIndex,0);}
    else assert.equal(tree.read().qa.anchi,null);
  }
  assert.equal(storage.get('sainome-story-progress'),'8','Wall 7 never advances legacy linear save');
  console.log('PASS 7-6 thunder pause/resume, active/paused retry/exit and legacy-save isolation');
  console.log('PASS Wall 7 actual-engine boundaries; natural-play difficulty and device presentation remain untested');
})().catch(error=>{console.error(error);process.exitCode=1;});
`;
new Function('require','__dirname',harness+scenarios)(require,__dirname);
