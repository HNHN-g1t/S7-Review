import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/story/wall1.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
const { WALL1, WALL_SAVE_KEY, wallUnlocked, wallUnlockHint, wallLinks, loadWallProgress, saveWallProgress } =
  await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const storage = new Map([['sainome-story-progress', 'legacy-sentinel']]);
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
const roundTrip = progress => { saveWallProgress(progress); return loadWallProgress(); };

// The rendered map must have a traversable road through either cleared branch.
// The map now shares data-driven roads. Gate nodes use negative UI-only IDs;
// positive ID 27 is the new optional eighth mission, not the old visual gate.
const gate = -1;
const links = [...wallLinks(1), [26, gate]];
const originalMissions = WALL1.filter(mission => mission.stage <= 26);
const reachable = (from, to, cleared) => {
  const queue = [from], seen = new Set(queue);
  while (queue.length) {
    const node = queue.shift();
    if (node === to) return true;
    for (const [a, b] of links) {
      const next = a === node ? b : b === node ? a : null;
      if (next !== null && !seen.has(next) && (next === gate ? cleared.includes(26) : wallUnlocked(next, cleared))) {
        seen.add(next); queue.push(next);
      }
    }
  }
  return false;
};
for (const first of [21, 22]) for (const practice of [24, 25]) {
  let progress = { cleared: [], gateReached: false }, previous = 20;
  for (const stage of [20, first, 23, practice, 26]) {
    assert(wallUnlocked(stage, progress.cleared), `route cannot start ${stage}`);
    assert(reachable(previous, stage, progress.cleared));
    progress.cleared.push(stage);
    progress = roundTrip(progress);
    assert(progress.cleared.includes(stage), `reload lost ${stage}`);
    previous = stage;
  }
  assert(reachable(26, gate, progress.cleared));
  assert.deepEqual(roundTrip({ ...progress, gateReached: true }), { ...progress, gateReached: true });
  // Skipped branches remain available for optional replay after the gate.
  for (const stage of [21, 22, 24, 25]) assert(wallUnlocked(stage, progress.cleared));
}

// Exhaustive combinations, including unordered, duplicate and unknown saved IDs.
let legacySaves = 0;
for (let mask = 0; mask < 256; mask++) {
  const cleared = [0, ...originalMissions.map(s => s.stage)].filter((_, i) => mask & (1 << i));
  assert.equal(wallUnlocked(23, cleared), cleared.includes(20) && [21, 22].some(n => cleared.includes(n)));
  assert.equal(wallUnlocked(26, cleared), cleared.includes(23) && [24, 25].some(n => cleared.includes(n)));
  assert.equal(wallUnlocked(24, cleared), cleared.includes(23));
  assert.equal(wallUnlocked(25, cleared), cleared.includes(23));
  const loaded = roundTrip({ cleared: [...cleared].reverse().concat(cleared, [999, '23']), gateReached: true });
  assert.deepEqual(roundTrip(loaded), loaded);
  assert.equal(loaded.gateReached, loaded.cleared.includes(26));
  for (const stage of loaded.cleared) assert(wallUnlocked(stage, loaded.cleared));
  if (loaded.cleared.includes(26)) {
    assert(loaded.cleared.includes(23));
    assert(loaded.cleared.includes(20));
    assert([21, 22].some(n => loaded.cleared.includes(n)));
    assert([24, 25].some(n => loaded.cleared.includes(n)));
  }
  const oldRequires = { 20: [], 21: [20], 22: [20], 23: [21, 22], 24: [23], 25: [23], 26: [24, 25] };
  if (cleared.every(n => n === 0 || oldRequires[n].every(k => cleared.includes(k)))) {
    assert.deepEqual(roundTrip({ cleared, gateReached: cleared.includes(26) }), { cleared, gateReached: cleared.includes(26) });
    legacySaves++;
  }
}
assert(!wallUnlocked(23, [20]));
assert(!wallUnlocked(26, [20, 21, 23]));
assert(!wallUnlocked(26, [24, 25]));
assert(!wallUnlocked(999, []));
assert(wallUnlocked(0, []));
assert.equal(wallUnlockHint(23, [20]), '1-2／1-3のどちらかをクリア');
assert.equal(wallUnlockHint(26, [20, 21, 23]), '1-5／1-6のどちらかをクリア');
assert.deepEqual(roundTrip({ cleared: [23, 24, 25, 26], gateReached: true }), { cleared: [], gateReached: false });
for (const bad of ['null', '{', '{"cleared":"bad","gateReached":true}']) {
  storage.set(WALL_SAVE_KEY, bad);
  assert.deepEqual(loadWallProgress(), { cleared: [], gateReached: false });
}
assert.equal(storage.get('sainome-story-progress'), 'legacy-sentinel');
console.log(`PASS: 4 routes/roads, 256 progress combinations, ${legacySaves} compatible old saves, hints, corrupt saves, legacy storage isolation`);

