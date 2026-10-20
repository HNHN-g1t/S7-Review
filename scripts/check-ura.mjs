/** ウラメン（2026-10-14）のデータ確認。Run: node scripts/check-ura.mjs
 * ・ウラ9（内部11）→ ウラ1（内部19）の9ウォール×3面＝27面、ID 100〜126
 * ・最初の面は表の最後（9-3）のクリアが条件。あとは1本道で順に開く
 * ・各ウォールにボスが1つ。習得面3つとテスト用の敵数半減を確認
 * ・保存を読み直してもウラの進み具合が消えない
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
const w = await import(`data:text/javascript;base64,${Buffer.from(compile(read('src/story/wall1.ts'))).toString('base64')}`);
const { URA_MISSIONS, URA_WALLS, CAMPAIGN_MISSIONS, FINAL_STAGE, URA_FIRST_STAGE, URA_FINAL_STAGE, wallMission, wallUnlocked, wallGate, wallNumberLabel, saveWallProgress, loadWallProgress, WALL_SAVE_KEY } = w;

assert.equal(URA_WALLS.length, 9);
assert.deepEqual(URA_WALLS.map(a => a.title), ['ウラ9', 'ウラ8', 'ウラ7', 'ウラ6', 'ウラ5', 'ウラ4', 'ウラ3', 'ウラ2', 'ウラ1']);
assert.equal(URA_MISSIONS.length, 27);
assert.deepEqual(URA_MISSIONS.map(m => m.stage), Array.from({ length: 27 }, (_, i) => 100 + i));
assert.equal(URA_FIRST_STAGE, 100); assert.equal(URA_FINAL_STAGE, 126);
assert(!URA_MISSIONS.some(m => CAMPAIGN_MISSIONS.some(c => c.stage === m.stage)), 'IDs do not collide with the main story');
assert.equal(wallNumberLabel(wallMission(100)), 'ウラ9-1');
assert.equal(wallNumberLabel(wallMission(37)), 'ウォール3-2');
for (const area of URA_WALLS) assert.equal(URA_MISSIONS.filter(m => m.wall === area.wall && m.kind === 'boss').length, 1, `${area.title}: one boss`);
assert.equal(wallGate(19), URA_FINAL_STAGE);

// 1本道で開く
const all = CAMPAIGN_MISSIONS.map(m => m.stage);
assert(!wallUnlocked(100, all.filter(s => s !== FINAL_STAGE)), 'ura needs the final main stage');
const cleared = [...all];
for (const m of URA_MISSIONS) {
  assert(wallUnlocked(m.stage, cleared), `${m.number} opens in order`);
  const later = URA_MISSIONS.find(n => n.stage === m.stage + 1);
  if (later) assert(!wallUnlocked(later.stage, cleared), `${later.number} waits for ${m.number}`);
  cleared.push(m.stage);
}

// 難易度：敵の合計がウラ9からウラ1へ増えていく
const size = m => m.enemies.length + (m.reinforceKoitsume ?? 0) + (m.detarameTotal ?? 0) + (m.anchikushoume || m.sanzapparaname ? 1 : 0);
const perWall = URA_WALLS.map(a => URA_MISSIONS.filter(m => m.wall === a.wall).reduce((t, m) => t + size(m), 0));
// Lessons replace entrance battles, so per-wall totals need not be monotonic.
for(const [stage,ability] of [[100,'you456'],[109,'hyoketsu'],[121,'enjo']]) {
 const m=wallMission(stage);assert.equal(m.kind,'lesson');assert.equal(m.learns,ability);assert.equal(m.skillTarget.count,1);assert.equal(m.enemies.length,0);
 assert(!w.wallAbilities([]).includes(ability));assert(w.wallAbilities(cleared).includes(ability));
}
for(const m of URA_MISSIONS.filter(m=>m.kind!=='lesson')){
 const i=m.wall-11,part=(m.stage-100)%3,small=Math.min(7,4+Math.floor(i/2));
 assert.equal(m.enemies.length,Math.ceil((part===1?Math.max(2,small-2):part===2?Math.min(7,small+1):small)/2));
 assert.equal(m.reinforceKoitsume,Math.ceil(Math.min(7,(part===2?5:4)+i)/2));
 if(m.sanzVolley)assert.equal(m.sanzVolley,Math.ceil(Math.min(5,2+Math.floor(i/2))/2));
 if(m.detarameTotal)assert.equal(m.detarameTotal,Math.ceil((part===2?2+Math.floor(i/2):1+Math.floor(i/2))/2));
}
assert(perWall[8] > perWall[0], 'ura gets harder');

// 保存の読み直し
saveWallProgress({ cleared, gateReached: true });
const loaded = loadWallProgress();
assert(URA_MISSIONS.every(m => loaded.cleared.includes(m.stage)), 'ura progress survives reload');
assert(store.has(WALL_SAVE_KEY));
console.log(`PASS: ura 9 walls x 3 = 27 stages (100-126), opens after 9-3 in one line, difficulty ${perWall.join(' → ')}, progress survives reload`);
