/**
 * Independent single-objective regression scenarios using actual App gameplay.
 * Reuses only the existing campaign harness and move helpers, not its assertions
 * or campaign success scenarios. No forceClear or replacement victory logic.
 * Legal board arrangements and score fixtures test deterministic boundaries.
 * This is not browser rendering, mobile input, audio, or natural-play balance QA.
 * Run: node scripts/check-single-objective-engine.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const original = fs.readFileSync(path.join(__dirname, 'check-campaign-engine.cjs'), 'utf8');
const prefixEnd = original.indexOf('const dialogueCatalog =');
const helpersStart = original.indexOf('const bombs =');
const scenariosStart = original.indexOf('\n(async () => {');
if ([prefixEnd, helpersStart, scenariosStart].some(index => index < 0)) throw Error('Campaign harness markers changed; update independent harness import.');
let harness = original.slice(0, prefixEnd) + original.slice(helpersStart, scenariosStart);
// Expose read-only engine state in the VM copy. Production code is unchanged.
harness = harness.replace('read:()=>({story,', `read:()=>({qa:{objectiveText,missionDisplayNow,missionDisplayGoal,missionProgressLabel,beams:detarameBeams,wave:waveRef.current,wavePending:typeof wavePending === 'undefined'?0:wavePending.current,swarmSpawned:swarmSpawned.current,swarmPending:swarmPending.current,wallEnemySpawned:wallEnemySpawned.current,wallReinforcePending:wallReinforcePending.current,generated:typeof campaignGeneratedEnemies === 'undefined'?0:campaignGeneratedEnemies.current},story,`);
// Repeatable random choices; optional fixed override isolates spawn boundaries.
harness = `let qaSeed = 94721, qaRandomOverride = null;
const qaMath = Object.create(Math);
qaMath.random = () => qaRandomOverride === null ? ((qaSeed = (Math.imul(qaSeed, 1664525) + 1013904223) >>> 0) / 4294967296) : qaRandomOverride;
` + harness.replace(', Math };', ', Math: qaMath };');
const scenarios = String.raw`
const expectedScores = new Map([['1-1',1000],['1-5',2000],['2-7',4000],['3-2',6000],['4-2',12000],['5-1',24000]]);
const expectedLessons = ['1-4','1-8','2-1','2-2','2-3','2-5','3-1','3-6','4-1','4-6'];
const lessonGoals = new Map([['1-4',['bomb',3]],['1-8',['koitsume',3]],['2-1',['combo',2]],['2-2',['bomb',3]],['2-3',['dame',2]],['2-5',['bomb',3]],['3-1',['bomb',3]],['3-6',['bomb',2]],['4-1',['fever',3]],['4-6',['rainbow',1]]]);
const objective = load('src/story/objectives.ts');
const mission = number => DATA.CAMPAIGN_MISSIONS.find(m => m.number === number);
const small = () => tree.read().board.flat().filter(c => c && [-1,-2].includes(c.value));
const big = value => tree.read().board.flat().filter(c => c?.value === value);
const remaining = () => tree.read().missionGoal - tree.read().missionNow;
async function begin(number) { await start(mission(number).stage); await until(() => tree.read().status === 'playing' && !tree.read().demo, 'begin ' + number); }
async function advance(ms) {
  const end = now + ms;
  for (let n=0;n<5000;n++) {
    await flush(); timers.sort((a,b)=>a.at-b.at);
    if (!timers.length || timers[0].at > end) { now=end; await flush(); return; }
    const timer=timers.shift(); now=timer.at; timer.fn();
  }
  throw Error('timer loop in independent scenarios');
}
async function hitAllSmall(label) {
  for (let turn=0;small().length;turn++) {
    assert(turn<60,'small enemies remain: '+label);
    assert.equal(tree.read().status,'playing','small-enemy phase playable: '+label);
    await attack(small().some(c=>c.value===-2)?-2:-1);
  }
}
function addSentinel(board, avoidX) {
  const candidates = Array.from({length:7},(_,x)=>x).sort((a,b)=>Math.abs(b-avoidX)-Math.abs(a-avoidX));
  const x=candidates.find(x=>!board[13][x] && Math.abs(x-avoidX)>1);
  assert(x !== undefined,'space for the independent remaining small enemy');
  board[13][x]={id:'qa-remaining-small-'+id,value:-2,group:-91000-id++};
}
async function bossHit(value, special=false, sentinel=false) {
  const b=actors(), p=[];
  b.forEach((row,y)=>row.forEach((c,x)=>{if(c?.value===value)p.push({x,y});}));
  assert(p.length,'boss exists '+value);
  const {x,y}=p[0];
  if(sentinel && !small().length)addSentinel(b,x);
  if(special) {
    for(const [xx,yy] of [[x,y-1],[x+1,y-1],[x+2,y-1],[x,y-2]]) b[yy][xx]={id:'qa-bomb-'+id,value:1,group:50000+id++};
    return dropBoard(b,1,x+1);
  }
  b[y-1][x]={id:'qa-hit-'+id,value:1,group:50000+id++};
  return dropBoard(b,6,x);
}
async function beginBeam() {
  await begin('5-6');
  const b=actors(), d=tree.read().detarame;
  const i=d.segs.findIndex(seg=>Math.abs((seg.dir<0?0:6)-d.x)>1);
  assert(i>=0);
  const x=d.segs[i].dir<0?0:6, y=d.top+i;
  for(let row=y;row<14;row++)b[row][x]={id:'qa-interrupt-beam-'+row,value:2,group:72000+id++};
  tree.setBoard(b);tree.setCurrent(tree.makeSinglePiece(++id,2,x===0?6:0));await flush();
  qaRandomOverride=0;tree.hardDrop();
  await until(()=>tree.read().qa.beams.length>0,'beam animation began');
  assert.equal(tree.read().qa.generated,0,'no conversion before beam reaches target');
}
(async()=>{
  assert.equal(DATA.CAMPAIGN_MISSIONS.length,63);
  assert.deepEqual(Array.from(DATA.CAMPAIGN_MISSIONS.filter(m=>m.kind==='lesson'&&m.wall<6),m=>m.number),expectedLessons);
  // ウォール6（イチニノサンダー講習・アンチクショウメ）は専用の確認で
  for(const m of DATA.CAMPAIGN_MISSIONS.filter(m=>m.wall<6)) {
    const text=objective.missionObjectiveText(m);
    if(m.kind==='lesson') {
      const goal=objective.missionGoalFor(m), [type,target]=lessonGoals.get(m.number);
      assert.equal(goal.type,type,'lesson type kept '+m.number);
      assert.equal(goal.target,target,'lesson count kept '+m.number);
    } else {
      assert(!/[＋+]|チェイン|[1-6１-６]回/.test(text),'one objective, no removed action count '+m.number+': '+text);
      assert.equal(m.sevens,0,'no normal seven requirement '+m.number);
      assert.equal(m.superOnes,0,'no normal super-one requirement '+m.number);
      assert(!m.chainTarget && !m.nicoTarget && !Object.values(m.bombTargets||{}).some(Boolean),'no old hidden counters '+m.number);
      if(expectedScores.has(m.number)) {
        assert.equal(m.scoreTarget,expectedScores.get(m.number));
        assert(text.includes(expectedScores.get(m.number).toLocaleString('ja-JP')),'correct score text '+m.number);
      } else {
        assert(!m.scoreTarget,'enemy mission has no hidden score '+m.number);
        assert(/全滅|ぜんぶ倒せ/.test(text),'enemy objective explicit '+m.number);
      }
    }
  }
  console.log('PASS single-objective data: 6 score / 24 enemy / 10 unchanged lessons; no ordinary skill, chain, or seven counts');

  // Reach the exact score with no Seven, chain, or skill events.
  for(const [number,target] of expectedScores) {
    await begin(number);
    tree.setScore(target-1); await flush();
    await fixture([],2,0);
    assert.equal(tree.read().status,'playing',number+' target-1 must not clear');
    assert.equal(tree.read().missionNow,target-1);
    assert.equal(tree.read().missionGoal,target);
    assert(!tree.read().qa.missionProgressLabel.includes('条件'));
    tree.setScore(target); await flush();
    await fixture([],2,0);
    assert.equal(tree.read().status,'cleared',number+' exact target clears with zero actions');
    assert.equal(tree.read().wallCounts.sevens,0);
    assert.equal(tree.storyCombosRef.current,0);
    assert(Object.values(tree.read().wallCounts.bombs).every(n=>n===0));
    assert.equal(tree.read().qa.missionDisplayNow,target);
    assert.equal(tree.read().qa.missionDisplayGoal,target);
    console.log('PASS score boundary',number,target-1,'->',target,'without removed actions');
  }

  // Every ordinary generic enemy mission, including waves, can finish using
  // single ordinary Sevens only. Never manufacture the former required skills.
  for(const m of DATA.CAMPAIGN_MISSIONS.filter(m=>m.kind!=='lesson' && m.sourceStage===undefined && m.wall<6 && !expectedScores.has(m.number))) {
    await begin(m.number);
    let turn=0;
    while(tree.read().status!=='cleared') {
      assert(turn++<80,'generic single goal stuck '+m.number);
      assert(small().length>0,'remaining mission has an actual or newly-spawned enemy '+m.number);
      assert(remaining()>0,'live enemy has nonzero HUD remainder '+m.number);
      await attack(small().some(c=>c.value===-2)?-2:-1);
    }
    assert.equal(small().length,0);
    assert.equal(remaining(),0);
    assert.equal(tree.storyCombosRef.current,0,'no chain required '+m.number);
    assert(Object.values(tree.read().wallCounts.bombs).every(n=>n===0),'no skill required '+m.number);
    assert.equal(tree.read().wallCounts.nico,0,'no Nico required '+m.number);
    if(m.number==='1-2' || m.number==='1-6')assert.equal(tree.read().missionGoal,6,'six individual enemies '+m.number);
    console.log('PASS ordinary enemy objective without skill/chain gates',m.number);
  }

  // 4-5: only one free column means one Dame cannot spawn yet. It remains
  // required, then appears after board space is made on the following turn.
  await begin('4-5');
  const crowded=tree.emptyBoard();
  for(let x=1;x<7;x++)for(let y=5;y<14;y++)crowded[y][x]={id:'qa-stack-'+x+'-'+y,value:5,group:60000+id++};
  crowded[13][0]={id:'qa-wave-koi-1',value:-1,group:-901};
  crowded[12][0]={id:'qa-wave-koi-2',value:-1,group:-902};
  tree.setBoard(crowded);await flush();
  async function hitCrowded() {
    const b=tree.read().board.map(row=>row.map(c=>c?{...c}:null));
    const y=b.findIndex(row=>row[0]?.value===-1);
    b[y-1][0]={id:'qa-crowded-hit-'+id,value:1,group:61000+id++};
    await dropBoard(b,6,0);
  }
  await hitCrowded();await hitCrowded();
  assert.equal(tree.read().status,'playing');
  assert.equal(tree.read().qa.wave,1);
  assert.equal(small().length,1,'only one Dame fits');
  assert.equal(tree.read().qa.wavePending,1,'other planned Dame retained');
  assert.equal(tree.read().missionNow,2,'unspawned Dame is not counted defeated');
  assert.equal(tree.read().missionGoal,5);
  await dropBoard(actors(),2,6);
  assert.equal(tree.read().qa.wavePending,0,'pending Dame spawns when space opens');
  assert.equal(small().length,2);
  assert.equal(tree.read().missionNow,2);
  await hitAllSmall('4-5');
  assert.equal(tree.read().status,'playing','last Hidoime still required');
  assert.equal(remaining(),1);
  while(big(-3).length)await attack(-3);
  assert.equal(tree.read().status,'cleared');
  console.log('PASS 4-5 crowded-board wave: withheld spawn stays required, retries, and all five must die');

  // 4-8 starts with no visible enemies, but all three planned Hidoime count.
  // Force random draws above the usual spawn chance to verify progress cannot
  // wait forever when no enemy is left on the field.
  await begin('4-8');
  assert.equal(big(-3).length,0);
  assert.equal(tree.read().missionGoal,3);
  assert.equal(remaining(),3,'all planned enemies count before appearance');
  qaRandomOverride=0.9;
  for(let turn=0;tree.read().status!=='cleared';turn++) {
    assert(turn<25,'empty-field progression must not depend on favorable random draws');
    if(big(-3).length)await attack(-3);else await fixture(...seven);
    if(tree.read().hidoimeDefeated<3) {
      assert.notEqual(tree.read().status,'cleared','future Hidoime still required');
      assert(remaining()>0);
    }
  }
  qaRandomOverride=null;
  assert.equal(tree.read().hidoimeDefeated,3);
  assert.equal(tree.read().qa.swarmSpawned,3);
  assert.equal(remaining(),0);
  console.log('PASS 4-8 planned three enemies and empty-field continuation with unfavorable random draws');

  // Produce small enemies through Detarame's real beam, rather than only a
  // sentinel fixture. Each successful conversion must grow the total exactly.
  await begin('5-6');
  const laserBoard=actors(), detarame=tree.read().detarame;
  const beamIndex=detarame.segs.findIndex(seg=>Math.abs((seg.dir<0?0:6)-detarame.x)>1);
  assert(beamIndex>=0);
  const beamX=detarame.segs[beamIndex].dir<0?0:6, beamY=detarame.top+beamIndex;
  for(let y=beamY;y<14;y++)laserBoard[y][beamX]={id:'qa-beam-target-'+y,value:2,group:70000+id++};
  qaRandomOverride=0;
  await dropBoard(laserBoard,2,beamX===0?6:0);
  qaRandomOverride=null;
  const converted=tree.read().qa.generated;
  assert(converted>0,'real Detarame beam created small enemies');
  assert.equal(small().length,converted,'one total increment per successful beam conversion');
  assert.equal(tree.read().missionGoal,1+converted,'generated enemies enlarge total');
  assert.equal(tree.read().missionNow,0,'newly generated enemies are not already defeated');
  const dynamicGoal=tree.read().missionGoal;
  while(tree.detarameDefeated.current===0)await bossHit(-5);
  assert.equal(tree.read().status,'playing','real beam-spawned enemy remains after boss defeat');
  assert.equal(tree.read().missionGoal,dynamicGoal,'total does not shrink on boss defeat');
  assert.equal(remaining(),small().length);
  await hitAllSmall('real beam conversion');
  assert.equal(tree.read().status,'cleared');
  assert.equal(tree.read().missionGoal,dynamicGoal,'total remains stable after final kill');
  console.log('PASS real Detarame beam conversion expands total and remains required after boss defeat');

  for(const number of ['5-6','5-8']) {
    await begin(number);
    if(number==='5-8') {
      assert.equal(tree.read().missionGoal,7,'four small, one Hidoime, two final bosses');
      await hitAllSmall(number+' first wave');
      while(big(-3).length)await attack(-3);
      assert.equal(tree.read().allstarPhase,2);
      for(let turns=0;tree.berabouDefeated.current===0;turns++) {
        assert(turns<20);await bossHit(-4,tree.read().berabouHp===1);
      }
    }
    for(let turns=0;tree.detarameDefeated.current===0;turns++) {
      assert(turns<20);await bossHit(-5,false,true);
    }
    assert(small().length>0,number+' preserves an actual remaining small enemy');
    assert.equal(tree.read().status,'playing',number+' boss defeat alone cannot clear');
    assert.equal(remaining(),small().length,number+' HUD counts small enemies after bosses die');
    assert.equal(tree.read().qa.missionDisplayGoal-tree.read().qa.missionDisplayNow,small().length);
    await hitAllSmall(number+' cleanup');
    assert.equal(tree.read().status,'cleared',number+' final small enemy completes mission');
    assert.equal(remaining(),0);
    console.log('PASS',number,'boss-first defeat waits for remaining small enemies');
  }

  // Interruption while a real beam is in flight must not continue its old
  // board writes or increment the new run's generated-enemy count.
  await beginBeam();
  tree.togglePause();await flush();
  const frozenBeam=JSON.stringify({board:tree.read().board,generated:tree.read().qa.generated,beams:tree.read().qa.beams});
  await advance(5000);
  assert.equal(tree.read().status,'paused');
  assert.equal(JSON.stringify({board:tree.read().board,generated:tree.read().qa.generated,beams:tree.read().qa.beams}),frozenBeam,'beam and generated count freeze while paused');
  tree.togglePause();await flush();
  await until(()=>tree.read().status==='playing','beam resumes');
  qaRandomOverride=null;
  assert(tree.read().qa.generated>0,'resumed beam converts enemies');
  for(const paused of [false,true]) {
    await beginBeam();
    if(paused){tree.togglePause();await flush();}
    qaRandomOverride=null;tree.playAgain();await flush();
    await until(()=>tree.read().status==='playing','retry during beam');
    const freshBeamBoard=JSON.stringify(tree.read().board);
    assert.equal(tree.read().mapStage,57);assert.equal(tree.read().qa.generated,0);
    assert.equal(small().length,0);assert.equal(tree.read().missionNow,0);assert.equal(tree.read().missionGoal,1);
    await advance(5000);
    assert.equal(tree.read().qa.generated,0,'old beam does not grow new total');
    assert.equal(JSON.stringify(tree.read().board),freshBeamBoard,'old beam cannot overwrite restarted board');
    await beginBeam();
    if(paused){tree.togglePause();await flush();}
    qaRandomOverride=null;tree.backToTitle();await flush();await advance(5000);
    assert.equal(tree.read().status,'ready');assert.equal(tree.read().qa.generated,0);
    assert.equal(tree.read().board.flat().filter(Boolean).length,0,'old beam cannot restore board after exit');
  }
  console.log('PASS in-flight beam pause/resume, active/paused retry, exit, and new-run counter isolation');

  for(const paused of [false,true]) {
    await begin('4-5');tree.setBoard(crowded.map(row=>row.map(c=>c?{...c}:null)));await flush();
    await hitCrowded();await hitCrowded();
    assert.equal(tree.read().qa.wavePending,1);
    if(paused){tree.togglePause();await flush();await advance(5000);assert.equal(tree.read().qa.wavePending,1);}
    tree.playAgain();await flush();await until(()=>tree.read().status==='playing','retry pending wave');
    const freshWaveBoard=JSON.stringify(tree.read().board);
    assert.equal(tree.read().mapStage,48);assert.equal(tree.read().qa.wavePending,0);
    assert.equal(tree.read().qa.wave,0);assert.equal(tree.read().missionNow,0);assert.equal(tree.read().missionGoal,5);
    assert.equal(small().length,2);await advance(5000);
    assert.equal(JSON.stringify(tree.read().board),freshWaveBoard);
    assert.equal(tree.read().qa.wavePending,0,'pending wave cannot leak across retry');
  }
  console.log('PASS crowded pending-wave active/paused retry resets pending count and initial board');

  // Pending wave must not be changed by pause, nor leak into a retry or exit.
  await begin('1-6');
  await attack(-1);await attack(-1);
  const beforePause=JSON.stringify({board:tree.read().board,now:tree.read().missionNow,goal:tree.read().missionGoal});
  tree.togglePause();await flush();await advance(5000);
  assert.equal(tree.read().status,'paused');
  assert.equal(JSON.stringify({board:tree.read().board,now:tree.read().missionNow,goal:tree.read().missionGoal}),beforePause);
  tree.playAgain();await flush();await until(()=>tree.read().status==='playing','restart 1-6');
  assert.equal(tree.read().mapStage,25);
  assert.equal(tree.read().missionNow,0);assert.equal(tree.read().missionGoal,6);
  assert.equal(small().length,3);assert.equal(tree.read().qa.wallReinforcePending,3);
  tree.backToTitle();await flush();await advance(20000);
  assert.equal(tree.read().status,'ready');assert.equal(tree.read().stageIntro,null);
  assert.equal(tree.read().board.flat().filter(Boolean).length,0);
  assert.equal(storage.get('sainome-story-progress'),'8','campaign changes do not write legacy progress');
  const saved=JSON.parse(storage.get('sainome-wall1-progress-v1'));
  assert.equal(saved.cleared.length,52,'prior cleared save identities preserved');
  assert.equal(saved.gateReached,true);
  console.log('PASS pause/retry/exit, legacy-save isolation, and existing and Wall 7 map progress retained');
  // The old linear story is a different mode: retain its 2,000-point opening
  // and its original Detarame-only victory, including an unrelated small enemy.
  const mapSaveBeforeLegacy=storage.get('sainome-wall1-progress-v1');
  await start(1);await until(()=>tree.read().status==='playing','legacy score');
  assert.equal(tree.read().mapStage,null);assert.equal(tree.read().missionGoal,2000);
  tree.setScore(1999);await flush();await fixture([],2,0);
  assert.equal(tree.read().status,'playing');
  tree.setScore(2000);await flush();await fixture([],2,0);
  assert.equal(tree.read().status,'cleared');
  await start(18);await until(()=>tree.read().status==='playing','legacy Detarame');
  for(let turns=0;tree.detarameDefeated.current===0;turns++){assert(turns<20);await bossHit(-5,false,true);}
  assert.equal(tree.read().mapStage,null);
  assert.equal(tree.read().status,'cleared','legacy boss-only victory remains unchanged');
  assert(small().length>0,'legacy small-enemy exception remains');
  assert.equal(storage.get('sainome-wall1-progress-v1'),mapSaveBeforeLegacy,'legacy play does not write map save');
  console.log('PASS legacy score and boss-only victory retained, with reverse save isolation');
  console.log('PASS independent single-objective actual-engine regressions (no browser or device-rendering claim)');
})().catch(error=>{console.error(error);process.exitCode=1;});
`;
new Function('require','__dirname',harness+scenarios)(require,__dirname);
