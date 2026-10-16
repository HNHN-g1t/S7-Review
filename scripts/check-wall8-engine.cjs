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
harness = harness.replace('return {startStage,', 'return {growAnchi,fireThunder,startStage,');
harness = harness.replace('read:()=>({story,', `read:()=>({qa:{detarames:detaramesRef.current,spawned:detarameSpawned.current,defeated:detarameDefeated.current,generated:campaignGeneratedEnemies.current,beams:detarameBeams,wallSpawned:wallEnemySpawned.current,reinforce:wallReinforcePending.current,swarmSpawned:swarmSpawned.current,anchi:anchiRef.current,anchiDefeated:anchiDefeated.current,thunderSet,thunderCall,thunderBolt},story,`);
harness = harness.replace("name === './thunder' ?", "name === './enemy/anchiEye' ? load('src/enemy/anchiEye.ts') : name === './thunder' ?");
harness = `let qaSeed = 741068, qaRandomOverride = null;
const qaMath = Object.create(Math);
qaMath.random = () => qaRandomOverride === null ? ((qaSeed = (Math.imul(qaSeed,1664525)+1013904223)>>>0)/4294967296) : qaRandomOverride;
` + harness.replace(', Math };', ', Math: qaMath };');

const scenarios = "\nconst by=n=>DATA.CAMPAIGN_MISSIONS.find(m=>m.number===n);\nasync function begin(number){\n tree.backToTitle();await flush();\n tree.setWallProgress({cleared:DATA.CAMPAIGN_MISSIONS.map(m=>m.stage),gateReached:true});await flush();\n tree.startStage(by(number).stage);await flush();await until(()=>tree.read().status==='playing','Wall8 entrance '+number);\n}\n(async()=>{\n for(const number of ['8-1','8-2','8-3','8-4','8-5','8-6','8-7','8-8']){\n  await begin(number);const m=by(number),state=tree.read();\n  assert.equal(state.mapStage,m.stage);assert.equal(state.missionNow,0);\n  if(m.sanzapparaname){\n   assert.equal(state.board.flat().filter(c=>c?.value===-6).length,9,'nine-cell volcanic body');\n   let result=state.board;\n   for(let turn=1;turn<=m.sanzTurns;turn++){\n    let done=false;void tree.growAnchi(result).then(b=>{result=b;done=true;});await until(()=>done,'Wall8 eruption');tree.setBoard(result);await flush();\n    const spawned=result.flat().filter(c=>c?.id.startsWith('sanz-eject-'));\n    if(turn<m.sanzTurns)assert.equal(spawned.length,0,'no early eruption');\n    else {assert(spawned.length>=2&&spawned.length<=m.sanzVolley,'balanced volley cap');assert(spawned.some(c=>c.value===-1));assert(spawned.some(c=>c.value===-2));}\n   }\n  }\n  console.log('PASS actual Wall8 entrance, zero goal and balanced eruption: '+number);\n }\n})().catch(error=>{console.error(error);process.exitCode=1;});\n";
new Function("require","__dirname",harness+scenarios)(require,__dirname);
