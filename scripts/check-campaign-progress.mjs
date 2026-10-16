/** Pure campaign regressions. Run: node scripts/check-campaign-progress.mjs.
 * Enumerates each wall's 8-bit state space rather than the 40-bit campaign.
 * App bindings are selected with the TypeScript AST and evaluated without React.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const compile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const importPure = async path => import(`data:text/javascript;base64,${Buffer.from(compile(read(path))).toString('base64')}`);
const campaign = await importPure('src/story/wall1.ts');
const objectives = await importPure('src/story/objectives.ts');
const {
  CAMPAIGN_MISSIONS, CAMPAIGN_WALLS, FUTURE_MISSIONS, WALL1, WALL_SAVE_KEY,
  WALL_LESSON, WALL_BOSS, LEGACY_STAGE_COUNT, wallMission, isWallStage, wallUnlocked,
  wallUnlockHint, wallAbilities, wallGate, wallLinks, loadWallProgress, saveWallProgress,
} = campaign;
const { emptyWallCounts, wallObjectiveMet, wallObjectiveProgress, wallObjectiveParts } = objectives;
const ids = missions => missions.map(m => m.stage);
const range = (start, count) => Array.from({ length: count }, (_, i) => start + i);
const sorted = values => [...values].sort((a, b) => a - b);
const unique = values => [...new Set(values)];
const plain = value => JSON.parse(JSON.stringify(value));
const allIds = ids(CAMPAIGN_MISSIONS);
const allCleared = [0, ...allIds];
const storage = new Map([
  ['sainome-story-progress', 'legacy-progress-sentinel'],
  ['sainome-story-cleared', 'legacy-cleared-sentinel'],
]);
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
const roundTrip = progress => { saveWallProgress(progress); return loadWallProgress(); };
const loadRaw = value => { storage.set(WALL_SAVE_KEY, value); return loadWallProgress(); };

// Fixed IDs are save identities. Future slots have no runtime mission at all.
assert.equal(LEGACY_STAGE_COUNT, 20);
assert.deepEqual(sorted(allIds), [...range(20, 44), ...range(68, 19)]);
assert.equal(unique(allIds).length, 63);
assert.deepEqual(sorted(ids(FUTURE_MISSIONS)), []);
assert.equal(unique(ids(FUTURE_MISSIONS)).length, 0);
assert.equal(CAMPAIGN_WALLS.length, 9);
assert.equal(CAMPAIGN_WALLS.filter(w => w.implemented).length, 9);
assert.deepEqual(ids(WALL1), range(20, 8));
assert.equal(WALL_LESSON, 23);
assert.equal(WALL_BOSS, 26);
for (let wall = 1; wall <= 9; wall++) {
  const group = (wall <= 9 ? CAMPAIGN_MISSIONS : FUTURE_MISSIONS).filter(m => m.wall === wall);
  // ウォール6はイチニノサンダー講習・アンチクショウメ・デタラメの群れ・門前の4面（2026-10-07）
  // ウォール9（王座の間）は最後の3面（2026-10-14）
  assert.equal(group.length, wall === 6 ? 4 : wall === 9 ? 3 : 8, `wall ${wall}: map slots`);
  assert.equal(CAMPAIGN_WALLS.find(w => w.wall === wall)?.implemented, wall <= 9);
}
// Reserved Wall 7 identities and positions are stable during parallel map work.
assert.deepEqual(CAMPAIGN_MISSIONS.filter(m => m.wall === 7).map(m => [m.stage, m.x, m.y]), [
  [68,50,84], [69,21,65], [70,79,65], [71,50,46],
  [72,21,29], [73,79,29], [74,50,13], [75,88,86],
]);
for (const id of range(64, 4)) assert.equal(wallMission(id), undefined, 'retired Wall 6 slots stay unused');
for (const m of FUTURE_MISSIONS) {
  assert.deepEqual(Object.keys(m).sort(), ['stage', 'wall', 'number', 'title', 'x', 'y', 'implemented'].sort(), 'future slots contain presentation metadata only');
  assert.equal(isWallStage(m.stage), false);
  assert.equal(wallMission(m.stage), undefined, `${m.stage}: future slot is not playable`);
  assert.equal(wallUnlocked(m.stage, allCleared), false);
  for (const key of ['sourceStage', 'sevens', 'superOnes', 'scoreTarget', 'chainTarget', 'nicoTarget', 'bombTargets', 'enemies', 'grants', 'requiresFlags']) {
    assert.equal(m[key], undefined, `${m.stage}: future slot must not invent ${key}`);
  }
}
for (const bad of [-1, 1, 19, 64, 87, 999, NaN, Infinity, 20.5, null]) {
  assert.equal(wallUnlocked(bad, allCleared), false, `invalid map stage ${bad}`);
}
assert(wallUnlocked(0, []), 'tutorial is independent of the campaign');

// AST extraction exercises actual runtime bindings without importing the React UI.
const appText = read('src/App.tsx');
const app = ts.createSourceFile('App.tsx', appText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const descendants = node => {
  const found = [];
  const visit = item => { found.push(item); ts.forEachChild(item, visit); };
  visit(node); return found;
};
const appNodes = descendants(app);
const declaration = name => {
  const matches = appNodes.filter(n => ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name);
  assert.equal(matches.length, 1, `one App declaration named ${name}`);
  return matches[0];
};
const expression = (node, context = {}) => runInNewContext(compile(`globalThis.result = (${node.getText(app)});`), context);
const constants = { ...objectives };
for (const name of ['COLS', 'ROWS', 'KOITSUME', 'DAME', 'SWARM_MAX_COUNT', 'BERABOU_HP', 'SPA_STAGE', 'SLA_STAGE', 'SQU_STAGE', 'STR_STAGE', 'NICO_STAGE', 'FEVER_STAGE']) {
  constants[name] = expression(declaration(name).initializer, constants);
}
const STORY_STAGES = expression(declaration('STORY_STAGES').initializer, constants);
const originalGoals = plain(STORY_STAGES.map(s => s.goal));
assert.deepEqual(originalGoals, [
  { type: 'tutorial', target: 5 }, { type: 'score', target: 2000 }, { type: 'combo', target: 2 },
  { type: 'bomb', kind: 'spa1', target: 3 }, { type: 'koitsume', target: 3 },
  { type: 'bomb', kind: 'sla3', target: 3 }, { type: 'dame', target: 2 },
  { type: 'bomb', kind: 'squ4', target: 3 }, { type: 'defeat' },
  { type: 'bomb', kind: 'str6', target: 3 }, { type: 'hidoime', target: 1 },
  { type: 'bomb', kind: 'nico', target: 2 }, { type: 'hidoime', target: 1 },
  { type: 'fever', target: 3 }, { type: 'waves', target: 5 }, { type: 'rainbow', target: 1 },
  { type: 'hidoime', target: 3 }, { type: 'berabou', target: 9 },
  { type: 'detarame', target: 1 }, { type: 'allstars', target: 3 },
], 'all twenty legacy objectives retain their original thresholds');
// 2026-10-14：ウラメンも同じ台本に入るので、登録は ALL_MISSIONS（表＋ウラ）から
const registration = app.statements.find(n => ts.isForOfStatement(n) && n.expression.getText(app) === 'ALL_MISSIONS');
assert(registration, 'App registers the campaign from its data export');
runInNewContext(compile(registration.getText(app)), { ...constants, STORY_STAGES, CAMPAIGN_MISSIONS, ALL_MISSIONS: campaign.ALL_MISSIONS, WALL_LESSON, missionGoalFor: objectives.missionGoalFor });
assert.deepEqual(plain(STORY_STAGES.slice(0, 20).map(s => s.goal)), originalGoals);
for (const m of CAMPAIGN_MISSIONS) {
  assert(STORY_STAGES[m.stage], `${m.stage}: runtime registration`);
  if (m.sourceStage !== undefined) {
    assert(Number.isInteger(m.sourceStage) && m.sourceStage >= 0 && m.sourceStage < 20);
    if (m.stage === WALL_LESSON) assert.deepEqual(plain(STORY_STAGES[m.stage].goal), originalGoals[m.sourceStage]);
    else assert.equal(STORY_STAGES[m.stage].goal, STORY_STAGES[m.sourceStage].goal, `${m.stage}: reuses complete scripted goal`);
  } else if (m.stage !== WALL_LESSON) {
    assert.equal(STORY_STAGES[m.stage].goal.type, 'wall');
    assert.equal(STORY_STAGES[m.stage].goal.mission, m);
  }
}
for (const m of FUTURE_MISSIONS) assert.equal(STORY_STAGES[m.stage], undefined);

// A campaign's large stable ID must never imply unlocked powers.
const storyAllows = expression(declaration('storyAllows').initializer, constants);
const nicoOpenIn = expression(declaration('nicoOpenIn').initializer, { ...constants, LEGACY_STAGE_COUNT });
const feverOpenIn = expression(declaration('feverOpenIn').initializer, { ...constants, LEGACY_STAGE_COUNT });
for (const id of allIds) {
  for (const kind of ['spa1', 'sla3', 'squ4', 'str6']) {
    assert.equal(storyAllows(id, kind, []), false, `${id}: no numeric-ID power unlock`);
    assert.equal(storyAllows(id, kind, [kind]), true);
  }
  assert.equal(nicoOpenIn(id, []), false);
  assert.equal(feverOpenIn(id, []), false);
}
for (const [kind, threshold] of [['spa1', 3], ['sla3', 5], ['squ4', 7], ['str6', 9]]) {
  assert.equal(storyAllows(threshold - 1, kind), false);
  assert.equal(storyAllows(threshold, kind), true);
}
assert.equal(nicoOpenIn(10), false); assert.equal(nicoOpenIn(11), true);
assert.equal(feverOpenIn(12), false); assert.equal(feverOpenIn(13), true);
const mapPowers = expression(declaration('mapPowers').initializer, {
  enemyPractice: null, wallAbilities, mapRun: { current: true }, wallProgressRef: { current: { cleared: [] } }, mapStageRef: { current: 20 },
});
assert.deepEqual(mapPowers(), [], 'map runtime passes an explicit empty power list before the first lesson');
const powerCalls = appNodes.filter(n => ts.isCallExpression(n) && ts.isIdentifier(n.expression) && ['storyAllows', 'nicoOpenIn', 'feverOpenIn'].includes(n.expression.text));
assert(powerCalls.length > 0);
for (const call of powerCalls) {
  const last = call.arguments.at(-1);
  assert(last && ts.isCallExpression(last) && ts.isIdentifier(last.expression) && last.expression.text === 'mapPowers', `${call.expression.text}: all live runtime callers supply campaign powers`);
}

// Test the real launch prelude up to runtime-ID resolution, without starting UI timers.
const start = declaration('startStage').initializer.arguments[0];
assert(ts.isArrowFunction(start) && ts.isBlock(start.body));
const runtimeIndex = start.body.statements.findIndex(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === 'stageNo'));
assert(runtimeIndex >= 0, 'startStage explicitly resolves sourceStage');
const launchSource = `(requestedStage) => { ${start.body.statements.slice(0, runtimeIndex + 1).map(n => n.getText(app)).join('\n')} return { stageNo, mapStage: mapStageRef.current, isMap: mapRun.current }; }`;
const launch = (id, cleared = []) => runInNewContext(compile(`globalThis.launch = ${launchSource}; launch(input);`), {
  input: id, STORY_STAGES, WALL_LESSON, wallMission, wallUnlocked,
  // 確認ページ（review=story）ではないふだんのゲームとして調べる
  isStoryReview: () => false, enemyPractice: null,
  wallProgressRef: { current: { cleared } }, storyLayoutRef: { current: 'map' },
  mapRun: { current: false }, mapStageRef: { current: null }, storyRunRef: { current: 0 }, setMapStage() {}, setLastMapStage() {},
});
for (const id of [...ids(FUTURE_MISSIONS), -1, 999, 20.1, NaN, Infinity]) assert.equal(launch(id, allCleared), undefined);
assert.equal(launch(23, []), undefined, 'direct launch cannot bypass prerequisites');
for (const m of CAMPAIGN_MISSIONS) {
  const result = launch(m.stage, allCleared);
  assert.equal(result.mapStage, m.stage);
  assert.equal(result.stageNo, m.stage === WALL_LESSON ? WALL_LESSON : m.sourceStage ?? m.stage);
  assert.equal(result.isMap, true);
}

// Every generic objective has a finite, positive reachable target and valid cells.
let genericObjectives = 0;
for (const m of CAMPAIGN_MISSIONS) {
  const cells = new Set();
  for (const enemy of m.enemies) {
    const y = enemy.y ?? constants.ROWS - 2;
    assert(Number.isInteger(enemy.x) && enemy.x >= 0 && enemy.x < constants.COLS, `${m.stage}: enemy column`);
    assert(Number.isInteger(y) && y >= 0 && y < constants.ROWS, `${m.stage}: enemy row`);
    assert(['koitsume', 'dame'].includes(enemy.kind));
    const cell = `${enemy.x},${y}`;
    assert(!cells.has(cell), `${m.stage}: overlapping enemies at ${cell}`);
    cells.add(cell);
  }
  for (const value of [m.sevens, m.superOnes, m.scoreTarget ?? 0, m.chainTarget ?? 0, m.nicoTarget ?? 0, ...Object.values(m.bombTargets ?? {})]) {
    assert(Number.isInteger(value) && value >= 0, `${m.stage}: targets must be finite nonnegative integers`);
  }
  if (m.sourceStage !== undefined || m.stage === WALL_LESSON) continue;
  genericObjectives++;
  const counts = emptyWallCounts();
  // The runtime includes pending reinforcements in enemiesLeft from the start.
  const enemyTotal = m.enemies.length + (m.reinforceKoitsume ?? 0) + ((m.anchikushoume || m.sanzapparaname) ? 1 : 0) + (m.detarameTotal ?? 0);
  const [now, target] = wallObjectiveProgress(m, counts, 0, 0, enemyTotal);
  assert.equal(now, 0);
  assert(target >= 1, `${m.stage}: generic mission needs at least one objective`);
  assert.equal(wallObjectiveMet(m, counts, 0, 0, enemyTotal), false);
  counts.sevens = m.sevens;
  counts.superOnes = m.superOnes;
  counts.nico = m.nicoTarget ?? 0;
  counts.thunder = m.thunderTarget ?? 0;
  counts.enemyKills = enemyTotal;
  for (const kind of Object.keys(counts.bombs)) counts.bombs[kind] = Math.max(m.bombTargets?.[kind] ?? 0, kind === 'spa1' ? m.superOnes : 0);
  assert.equal(wallObjectiveMet(m, counts, m.scoreTarget ?? 0, m.chainTarget ?? 0, 0), true, `${m.stage}: exact thresholds are attainable`);
  assert.deepEqual(wallObjectiveProgress(m, counts, m.scoreTarget ?? 0, m.chainTarget ?? 0, 0), [target, target]);
}
assert(genericObjectives > 0);

// Practice clears have exactly one unit: score OR all enemies, never power counts.
const scoreTargets = { '1-1': 1000, '1-5': 2000, '2-7': 4000, '3-2': 6000, '4-2': 12000, '5-1': 24000, '7-1': 30000, '8-1':35000 };
const lessonNumbers = ['1-4', '1-8', '2-1', '2-2', '2-3', '2-5', '3-1', '3-6', '4-1', '4-6', '6-1'];
assert.deepEqual(CAMPAIGN_MISSIONS.filter(m => m.kind === 'lesson').map(m => m.number), lessonNumbers);
const checkPracticeConfiguration = m => {
  assert.notEqual(m.kind, 'lesson');
  for (const [key, target] of Object.entries({ sevens: m.sevens, superOnes: m.superOnes,
    chainTarget: m.chainTarget ?? 0, nicoTarget: m.nicoTarget ?? 0, ...m.bombTargets })) {
    assert.equal(target, 0, `${m.number}: practice must not include ${key}`);
  }
  assert.equal(m.scoreTarget, scoreTargets[m.number], `${m.number}: score/defeat choice and threshold`);
};
for (const m of CAMPAIGN_MISSIONS.filter(m => m.kind !== 'lesson')) checkPracticeConfiguration(m);
const scoreMission = CAMPAIGN_MISSIONS.find(m => m.number === '1-1');
const defeatMission = CAMPAIGN_MISSIONS.find(m => m.number === '1-6');
for (const key of ['sevens', 'superOnes', 'chainTarget', 'nicoTarget']) {
  assert.throws(() => checkPracticeConfiguration({ ...defeatMission, [key]: 1 }), `${key}: invalid future compound target is rejected`);
}
for (const kind of ['spa1', 'sla3', 'squ4', 'str6']) assert.throws(() => checkPracticeConfiguration({ ...defeatMission, bombTargets: { [kind]: 1 } }));
assert.throws(() => checkPracticeConfiguration({ ...defeatMission, scoreTarget: 1000 }), 'defeat maps must not reintroduce score thresholds');
const full = { ...emptyWallCounts(), sevens: 1e6, superOnes: 1e6, nico: 1e6, enemyKills: 1e6, bombs: { spa1: 1e6, sla3: 1e6, squ4: 1e6, str6: 1e6 } };
assert.equal(wallObjectiveMet(scoreMission, full, 999, 100, 0), false, 'old counters cannot replace score');
assert.equal(wallObjectiveMet(scoreMission, emptyWallCounts(), 1000, 0, 1), true, 'score alone completes even if an enemy remains');
assert.deepEqual(wallObjectiveProgress(scoreMission, full, 2000, 100, 0), [1000, 1000], 'score progress is capped without mixed units');
assert.equal(wallObjectiveMet(defeatMission, full, 1e6, 100, 1), false, 'last enemy prevents clear despite every old counter');
assert.equal(wallObjectiveMet(defeatMission, emptyWallCounts(), 0, 0, 0), true, 'defeat alone completes without points or powers');
assert.deepEqual(wallObjectiveParts(defeatMission, emptyWallCounts(), 0, 0, 3), [{ label: 'サイリアン', now: 3, target: 6 }], 'pending reinforcement is part of the one enemy objective');
const waveMission = CAMPAIGN_MISSIONS.find(m => m.number === '1-2');
assert.equal(wallObjectiveMet(waveMission, { ...emptyWallCounts(), enemyKills: 2 }, 0, 0, 0), false, 'an empty board between waves cannot complete early');
assert.deepEqual(wallObjectiveProgress(waveMission, { ...emptyWallCounts(), enemyKills: 4 }, 0, 0, 2), [4, 6]);
assert.equal(wallObjectiveMet(waveMission, { ...emptyWallCounts(), enemyKills: 6 }, 0, 0, 0), true);
const empty = { ...defeatMission, enemies: [], reinforceKoitsume: 0 };
assert.equal(wallObjectiveMet(empty, emptyWallCounts(), 0, 0, 0), false, 'empty generic mission must not auto-clear');
const oldSuperLesson = { ...scoreMission, kind: 'lesson', scoreTarget: undefined, superOnes: 2 };
const legacyCounts = emptyWallCounts(); legacyCounts.superOnes = 2;
assert(wallObjectiveMet(oldSuperLesson, legacyCounts, 0, 0, 0), 'lesson Super1 count remains accepted');
const modernCounts = emptyWallCounts(); modernCounts.bombs.spa1 = 2;
assert(wallObjectiveMet(oldSuperLesson, modernCounts, 0, 0, 0), 'new per-kind lesson counter remains accepted');
const a = emptyWallCounts(), b = emptyWallCounts(); a.bombs.spa1 = 9;
assert.equal(b.bombs.spa1, 0, 'each run owns an independent counter object');

// Independent prerequisite model; abilities are explicit learned flags, never IDs.
const powers = ['spa1', 'sla3', 'squ4', 'str6', 'nico', 'fever', 'rainbow', 'thunder'];
const powerLessons = [23, 29, 32, 36, 41, 44, 49, 60];
assert.deepEqual(CAMPAIGN_MISSIONS.filter(m => m.learns).map(m => [m.stage, m.learns]), powerLessons.map((id, i) => [id, powers[i]]));
assert.deepEqual(wallAbilities([]), []);
for (const id of powerLessons) assert.deepEqual(wallAbilities([], id), [], `${id}: a locked lesson cannot grant its power`);
for (const id of [...range(76, 8), 999]) assert.deepEqual(wallAbilities([], id), []);
const learnedFrom = cleared => unique(CAMPAIGN_MISSIONS.filter(m => m.learns && cleared.includes(m.stage)).map(m => m.learns));
const modelUnlock = (m, cleared) => m.requires.every(id => cleared.includes(id))
  && (!m.requiresAny?.length || m.requiresAny.some(id => cleared.includes(id)))
  && (m.requiresAnyGroups ?? []).every(group => group.some(id => cleared.includes(id)))
  && (m.requiresAbilities ?? []).every(power => learnedFrom(cleared).includes(power));
const sanitize = incoming => {
  const result = incoming.includes(0) ? [0] : [];
  let changed;
  do {
    changed = false;
    for (const m of CAMPAIGN_MISSIONS) {
      if (incoming.includes(m.stage) && !result.includes(m.stage) && modelUnlock(m, result)) {
        result.push(m.stage); changed = true;
      }
    }
  } while (changed);
  return sorted(result);
};
const roadsReach = (from, to, cleared, wall) => {
  const seen = new Set([from]), queue = [from];
  while (queue.length) {
    const current = queue.shift();
    if (current === to) return true;
    for (const [a, b] of wallLinks(wall)) {
      const next = a === current ? b : b === current ? a : undefined;
      if (next !== undefined && !seen.has(next) && wallUnlocked(next, cleared)) { seen.add(next); queue.push(next); }
    }
  }
  return false;
};
for (const m of CAMPAIGN_MISSIONS) {
  for (const dependency of [...m.requires, ...(m.requiresAny ?? []), ...(m.requiresAnyGroups ?? []).flat()]) {
    assert(wallMission(dependency), `${m.stage}: prerequisite ${dependency} exists`);
    assert.notEqual(dependency, m.stage, 'no self dependency');
    assert(wallMission(dependency).wall <= m.wall, 'no prerequisite in a future wall');
  }
  for (const group of m.requiresAnyGroups ?? []) assert(group.length > 0, 'no impossible empty OR group');
  for (const power of m.requiresAbilities ?? []) assert(powers.includes(power));
  assert(m.x >= 0 && m.x <= 100 && m.y >= 0 && m.y <= 100, 'map coordinates fit their wall');
}

const stats = [];
let shortestCampaign = [];
for (let wall = 1; wall <= 9; wall++) {
  const group = CAMPAIGN_MISSIONS.filter(m => m.wall === wall);
  const prefix = [...shortestCampaign];
  const clearedByMask = mask => [...prefix, ...group.filter((_, i) => mask & (1 << i)).map(m => m.stage)];
  const boss = wallGate(wall);
  assert.equal(group.filter(m => m.kind === 'boss').length, 1);
  assert.equal(wallMission(boss)?.kind, 'boss');
  for (const [a, b] of wallLinks(wall)) {
    assert.equal(wallMission(a)?.wall, wall);
    assert.equal(wallMission(b)?.wall, wall);
    assert.notEqual(a, b);
  }
  const enumerate = (skipShortcuts = false) => {
    const paths = new Map([[0, []]]), queue = [0];
    for (let qi = 0; qi < queue.length; qi++) {
      const mask = queue[qi], cleared = clearedByMask(mask), path = paths.get(mask);
      for (let i = 0; i < group.length; i++) {
        const m = group[i];
        if (mask & (1 << i) || skipShortcuts && m.kind === 'shortcut' || !modelUnlock(m, cleared)) continue;
        if (path.length) assert(roadsReach(path.at(-1), m.stage, cleared, wall), `${wall}: road reaches ${m.stage} from ${path.at(-1)}`);
        const next = mask | (1 << i);
        if (!paths.has(next)) { paths.set(next, [...path, m.stage]); queue.push(next); }
      }
    }
    return paths;
  };
  const reachable = enumerate();
  const normal = enumerate(true);
  const gatePaths = [...reachable.values()].filter(path => path.includes(boss));
  const normalGatePaths = [...normal.values()].filter(path => path.includes(boss));
  assert(gatePaths.length > 0, `wall ${wall}: reachable boss`);
  for (const m of group) assert([...reachable.values()].some(path => path.includes(m.stage)), `${m.stage}: every placed mission is reachable`);
  const shortest = gatePaths.reduce((a, b) => a.length <= b.length ? a : b);
  const shortestNormal = normalGatePaths.reduce((a, b) => a.length <= b.length ? a : b);
  assert.equal(shortest.length, [5, 6, 5, 5, 5, 4, 5, 5, 3][wall - 1], `wall ${wall}: shortest clear count`);
  if (wall >= 3 && wall <= 5) {
    assert.equal(shortestNormal.length - shortest.length, 1, `wall ${wall}: a shortcut replaces two missions with one`);
    assert(shortest.some(id => wallMission(id).kind === 'shortcut'));
    assert(shortestNormal.every(id => wallMission(id).kind !== 'shortcut'));
  }
  const requiredLessons = group.filter(m => m.kind === 'lesson' && !m.optional && (m.learns || m.stage === 28));
  for (const path of gatePaths) for (const lesson of requiredLessons) assert(path.includes(lesson.stage), `${wall}: every gate route includes lesson ${lesson.stage}`);
  const optional = group.filter(m => m.optional);
  for (const m of optional) assert(!shortest.includes(m.stage), `${m.stage}: optional mission stays optional`);

  // All 256 local save combinations, valid and invalid, match the independent model.
  for (let mask = 0; mask < 256; mask++) {
    const cleared = clearedByMask(mask);
    for (const m of group) {
      const expected = modelUnlock(m, cleared);
      assert.equal(wallUnlocked(m.stage, cleared), expected, `${m.stage}: prerequisite truth table mask=${mask}`);
      if (!expected) continue;
      const abilities = wallAbilities(cleared, m.stage);
      for (const kind of powers) assert.equal(abilities.includes(kind), learnedFrom(cleared).includes(kind) || kind === m.learns, `${m.stage}: explicit lesson power only`);
      const needed = unique([
        ...(m.superOnes > 0 ? ['spa1'] : []),
        ...Object.entries(m.bombTargets ?? {}).filter(([, target]) => target > 0).map(([kind]) => kind),
        ...(m.nicoTarget > 0 ? ['nico'] : []),
      ]);
      for (const kind of needed) assert(abilities.includes(kind), `${m.stage}: objective requires available ${kind}`);
    }
    assert.deepEqual(roundTrip({ cleared: [...cleared].reverse(), gateReached: true }).cleared, sanitize(cleared), `wall ${wall}: mask ${mask} save closure`);
    if (reachable.has(mask)) {
      assert.deepEqual(sanitize(cleared), sorted(cleared), `wall ${wall}: generated route survives reload`);
      for (const m of group.filter(m => [17, 18, 19].includes(m.sourceStage))) {
        if (modelUnlock(m, cleared)) for (const lesson of [28, ...powerLessons.filter(id => id < 60)]) assert(cleared.includes(lesson), `${m.stage}: late scripted enemies follow lesson ${lesson}`);
      }
    }
  }
  if (wall > 1) {
    const missingGate = prefix.filter(id => id !== wallGate(wall - 1));
    assert(group.every(m => !wallUnlocked(m.stage, missingGate)), `wall ${wall}: previous gate boss is mandatory`);
  }
  stats.push({ wall, states: reachable.size, shortest: shortest.length, normal: shortestNormal.length });
  shortestCampaign.push(...shortest);
}
assert.equal(shortestCampaign.length, 43);
assert(shortestCampaign.includes(59));
assert.deepEqual(sorted(wallAbilities(shortestCampaign)), sorted(powers));
assert.deepEqual(roundTrip({ cleared: [...allCleared].reverse(), gateReached: true }).cleared, allCleared);

// The old four Wall 1 routes remain five clears, with skipped branches replayable.
for (const first of [21, 22]) for (const practice of [24, 25]) {
  let progress = { cleared: [], gateReached: false };
  let previous = 20;
  for (const stage of [20, first, 23, practice, 26]) {
    assert(wallUnlocked(stage, progress.cleared));
    assert(roadsReach(previous, stage, progress.cleared, 1));
    progress = roundTrip({ ...progress, cleared: [...progress.cleared, stage] });
    assert(progress.cleared.includes(stage)); previous = stage;
  }
  assert.deepEqual(roundTrip({ ...progress, gateReached: true }), { ...progress, gateReached: true });
  for (const stage of [21, 22, 24, 25, 27]) assert(wallUnlocked(stage, progress.cleared));
  assert(wallUnlocked(28, progress.cleared), 'old boss save opens Wall 2 without replaying gate animation');
}

// Exactly the original eight save bits: tutorial 0 and original missions 20–26.
let legacySaves = 0;
const oldRequires = { 20: [], 21: [20], 22: [20], 23: [21, 22], 24: [23], 25: [23], 26: [24, 25] };
for (let mask = 0; mask < 256; mask++) {
  const cleared = [0, ...range(20, 7)].filter((_, i) => mask & (1 << i));
  const loaded = roundTrip({ cleared: [...cleared].reverse().concat(cleared, [27.5, 60, 83, 999, '23', null]), gateReached: true });
  assert.deepEqual(loaded.cleared, sanitize(cleared));
  assert.deepEqual(roundTrip(loaded), loaded);
  assert.equal(loaded.gateReached, loaded.cleared.includes(26));
  if (cleared.every(id => id === 0 || oldRequires[id].every(k => cleared.includes(k)))) {
    assert.deepEqual(roundTrip({ cleared, gateReached: cleared.includes(26) }), { cleared, gateReached: cleared.includes(26) }); legacySaves++;
  }
}
assert.equal(legacySaves, 20);
assert.equal(wallUnlockHint(23, [20]), '1-2／1-3のどちらかをクリア');
assert.equal(wallUnlockHint(26, [20, 21, 23]), '1-5／1-6のどちらかをクリア');
assert.deepEqual(roundTrip({ cleared: [23, 24, 25, 26], gateReached: true }), { cleared: [], gateReached: false });
for (const raw of ['null', '{', 'true', '5', '[]', '{"cleared":"bad","gateReached":true}', '{"cleared":[60,83,999,"20",null,20.5],"reachedWalls":true}']) {
  assert.deepEqual(loadRaw(raw), { cleared: [], gateReached: false }, `corrupt save: ${raw}`);
}
const oldGate = roundTrip({ cleared: shortestCampaign, gateReached: true });
assert.equal(oldGate.gateReached, true);
assert.equal(oldGate.reachedWalls, undefined, 'migration does not force an additive field on old saves');
assert.equal(roundTrip({ cleared: shortestCampaign, gateReached: false }).gateReached, false, 'clearing the boss does not invent a gate visit');
assert.equal(roundTrip({ cleared: shortestCampaign, gateReached: false, reachedWalls: [1] }).gateReached, true);
const reached = roundTrip({ cleared: allCleared, gateReached: true, reachedWalls: [8, 5, 4, 3, 2, 1, 1, -1, 999, '2'] });
assert.deepEqual(reached.reachedWalls, [1, 2, 3, 4, 5, 8]);
assert.deepEqual(roundTrip({ cleared: [20], gateReached: true, reachedWalls: [1, 2, 5, 8] }), { cleared: [20], gateReached: false, reachedWalls: [] });
for (const lesson of [28, ...powerLessons]) {
  const loaded = roundTrip({ cleared: allCleared.filter(id => id !== lesson), gateReached: true, reachedWalls: [1, 2, 3, 4, 5] });
  // ウォール6の講習（60）を抜いた保存は、その先の6-2（61）を通さない
  assert(!loaded.cleared.includes(lesson === 60 ? 61 : 59), `corrupt save cannot bypass lesson ${lesson}`);
}
assert.equal(storage.get('sainome-story-progress'), 'legacy-progress-sentinel');
assert.equal(storage.get('sainome-story-cleared'), 'legacy-cleared-sentinel');
const workingStorage = globalThis.localStorage;
globalThis.localStorage = { getItem() { throw new Error('storage denied'); }, setItem() { throw new Error('quota'); } };
assert.deepEqual(loadWallProgress(), { cleared: [], gateReached: false });
assert.doesNotThrow(() => saveWallProgress({ cleared: [20], gateReached: false }));
globalThis.localStorage = workingStorage;

// Optional AND-of-OR groups must require an alternative from every group.
// Exercise the data-driven helper in isolation without changing any repository file.
const probe = wallMission(20);
const priorGroups = probe.requiresAnyGroups;
try {
  probe.requiresAnyGroups = [[21, 22], [24, 25]];
  assert.equal(wallUnlocked(20, [21]), false);
  assert.equal(wallUnlocked(20, [24]), false);
  assert.equal(wallUnlocked(20, [21, 24]), true);
  assert.equal(wallUnlocked(20, [22, 25]), true);
} finally {
  if (priorGroups === undefined) delete probe.requiresAnyGroups; else probe.requiresAnyGroups = priorGroups;
}

console.log(`PASS: 63 playable / 0 future IDs; ${stats.map(s => `W${s.wall}=${s.states} states, ${s.shortest}/${s.normal} shortcut/normal`).join('; ')}`);
console.log(`PASS: 40-clear shortest campaign; 4 original routes; 1,792 wall-state checks; 256 old-save states (${legacySaves} old-valid); prerequisites, powers, roads, storage migration`);
console.log(`PASS: ${genericObjectives} attainable generic objectives; single-goal thresholds and compound-config rejection; legacy 20 goals; sourceStage routing; future/direct launch guards; explicit ability runtime bindings`);

// Idle dialogue must follow actual mission content, never a broad numeric map range.
// Idle routing only tests lesson membership; derive keys from the actual registry.
const lessonMembership = Object.fromEntries(declaration('BOMB_LESSONS').initializer.properties.map(property =>
  [expression(property.name.expression, { ...constants, WALL_LESSON }), true]));
const idleContext = { ...constants, STORY_STAGES, wallMission, BOMB_LESSONS: lessonMembership,
  RAINBOW_STAGE: expression(declaration('RAINBOW_STAGE').initializer, constants), THUNDER_LESSON: expression(declaration('THUNDER_LESSON').initializer, constants) };
for (const name of ['SAGE_IDLE_LINES', 'SAIKA_STORY_LINES', 'WALL_FIRST_IDLE_LINES', 'IDLE_KOITSUME', 'IDLE_DAME', 'IDLE_HIDOIME', 'IDLE_BERABOU', 'IDLE_DETARAME', 'IDLE_FEVER']) {
  idleContext[name] = expression(declaration(name).initializer, idleContext);
}
const storyIdle = runInNewContext(compile(`const storyIdleLinesFor = ${declaration('storyIdleLinesFor').initializer.getText(app)}; globalThis.result = storyIdleLinesFor;`), idleContext);
for (const id of [1, 20]) {
  assert(!/コイツメ|Koitsume|enemies|FEVER|スーパー1/i.test(JSON.stringify(storyIdle(id))), `enemy-free first stage ${id} has no absent-enemy/power hints`);
}
assert(storyIdle(21).ja.some(line => line.includes('コイツメ')), 'actual Koitsume mission retains its objective');
assert(storyIdle(27).ja.some(line => line.includes('コイツメ')), 'scripted Koitsume lesson retains enemy guidance');
for (const mission of CAMPAIGN_MISSIONS) {
  // 2026-10-05 ユーザー指示：目標の文（「セヴン目を3回」など）はゲーム中のセリフに出さない
  if (mission.sourceStage === undefined) assert(!storyIdle(mission.stage).ja.includes(mission.theme), `mission ${mission.stage} idle lines must not repeat its objective text`);
  else assert.deepEqual(plain(storyIdle(mission.stage)), plain(storyIdle(mission.sourceStage)));
}
console.log('PASS: first-stage idle dialogue has no absent Koitsume; all 40 mission hints follow actual enemies or source lessons, without objective text');

// 2026-10-08 ユーザー指示：出目を出やすくするのは技を覚える習得ステージだけ。ほかは 1〜6 を同じ確率にする
for (const mission of CAMPAIGN_MISSIONS) {
  if (!mission.learns) assert(!mission.boostValues?.length, `${mission.number} is not a lesson but boosts dice ${mission.boostValues}`);
}
assert(read('src/App.tsx').includes('const lessonStage = mission ? !!mission.learns : !!BOMB_LESSONS[stageNo];'), 'dice boosts are limited to lesson stages at runtime');
console.log('PASS: dice weights are flat except lesson stages (' + CAMPAIGN_MISSIONS.filter(m => m.learns).map(m => m.number).join(' ') + ')');
