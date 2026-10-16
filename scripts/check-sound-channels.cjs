// 図鑑の「サウンドチャネル」表（src/soundChannels.ts）が、App.tsx の実際の振り分けと一致しているか確かめる。
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const src = ts.transpileModule(fs.readFileSync(path.join(root, 'src/soundChannels.ts'), 'utf8'), { compilerOptions: { module: 1, target: 7 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', src)(mod, mod.exports);
const { SOUND_CHANNELS } = mod.exports;

// App.tsx の「const playXxx = ...」ごとに、中で使っている getSfxBus のチャネルを読む
const actual = new Map();
for (const m of app.matchAll(/\nconst (play\w+) = /g)) {
  const start = m.index + m[0].length;
  const next = app.indexOf('\nconst ', start);
  const body = app.slice(start, next < 0 ? undefined : next);
  const buses = [...body.matchAll(/getSfxBus\(\s*'?(\w*)'?\s*\)/g)].map((b) => b[1] || 'effect');
  if (buses.length) actual.set(m[1], new Set(buses));
}
const listed = new Map();
for (const channel of SOUND_CHANNELS) for (const sound of channel.sounds) {
  assert(!listed.has(sound.fn), `${sound.fn} is listed twice`);
  listed.set(sound.fn, channel.id);
  assert(app.includes(`const ${sound.fn} = `), `${sound.fn} exists in App.tsx`);
}
for (const [fn, buses] of actual) {
  assert(listed.has(fn), `${fn} uses ${[...buses].join('/')} but is missing from the table`);
  assert(buses.has(listed.get(fn)), `${fn}: table says ${listed.get(fn)}, App uses ${[...buses].join('/')}`);
}
assert.equal(listed.get('playThunderTraceSound'), 'thunder');
assert.equal(listed.get('playThunderCountSound'), 'thunder');
assert.equal(listed.get('playThunderStrikeSound'), 'thunder');
assert.equal(listed.get('playEnemyTrill'), 'enemyHit');
assert.equal(listed.get('playEnemySquash'), 'enemyDefeat');
assert.equal(listed.get('playDetarameDamageSound'), 'detarame');
for (const fn of ['playBerabouRageSound', 'playHidoimeCrushSound', 'playPaintLaunchSound', 'playPaintSplatSound']) {
  assert.equal(listed.get(fn), 'enemy', fn + ' remains on enemy attacks');
}
assert.deepEqual(SOUND_CHANNELS.map(channel => channel.id).sort(),
  ['operation', 'effect', 'enemy', 'enemyHit', 'enemyDefeat', 'detarame', 'impact', 'thunder', 'bgm'].sort());
console.log(`PASS: ${actual.size} Web Audio sounds match eight SFX channels plus BGM in the review table`);

