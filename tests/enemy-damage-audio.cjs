// Run the real App audio graph and gameplay resolver against deterministic mocks.
// Covers overlap/routing/lifecycle and damage timing, not audible quality or devices.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { harness, actors, attack } = require('../scripts/check-enemy-practice.cjs');
const source = fs.readFileSync(path.join(__dirname, '../src/App.tsx'), 'utf8');
const ast = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const compile = code => ts.transpileModule(code, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;
const names = [
  'gamePaused', 'pauseWaiters', 'delayGeneration', 'setGamePaused', 'dropPauseWaiters',
  'SFX_OUTPUT_GAIN', 'SFX_CEILING_CURVE', 'sfxBuses', 'sfxBusCtx', 'effectMix', 'enemyFocusUntil',
  'getSfxBus', 'focusEnemySound', 'playEnemyTrill', 'playEnemySquash', 'playEnemyFlashSound',
  'DETARAME_DAMAGE_SECONDS', 'DETARAME_DAMAGE_MAX_VOICES',
  'detarameDamageCtx', 'detarameDamageBuffer', 'detarameDamageSources',
  'releaseDetarameDamageSource', 'stopDetarameDamageSounds', 'onDetarameAudioStateChange',
  'playDetarameDamageSound',
];
const declarations = new Map();
for (const node of ast.statements) if (ts.isVariableStatement(node)) {
  for (const declaration of node.declarationList.declarations) {
    if (ts.isIdentifier(declaration.name)) declarations.set(declaration.name.text, node);
  }
}
const extracted = names.map(name => {
  assert(declarations.has(name), `${name} remains declared in App`);
  return declarations.get(name).getText(ast);
}).join('\n');
function makeContext(sampleRate = 48000) {
  const ctx = { state: 'running', currentTime: 10, sampleRate, nodes: [], sources: [], buffers: [], listeners: new Set() };
  const param = (value = 0) => ({ value, events: [],
    setValueAtTime(value, at) { this.events.push(['set', value, at]); },
    exponentialRampToValueAtTime(value, at) { assert(value > 0 && Number.isFinite(value)); this.events.push(['ramp', value, at]); },
    setTargetAtTime(value, at, constant) { this.events.push(['target', value, at, constant]); },
    cancelScheduledValues(at) { this.events.push(['cancel', at]); },
  });
  const node = kind => {
    const result = { kind, outputs: [], disconnects: 0,
      connect(other) { this.outputs.push(other); return other; },
      disconnect() { this.outputs = []; this.disconnects++; },
    };
    ctx.nodes.push(result); return result;
  };
  const scheduled = kind => {
    const result = Object.assign(node(kind), { starts: [], stops: [], onended: null,
      start(at) { assert.equal(at, ctx.currentTime, 'new source starts immediately'); this.starts.push(at); },
      stop(at) { this.stops.push(at); if (this.throwOnStop) throw Error('already stopped'); },
      end() { this.onended?.(); },
    });
    ctx.sources.push(result); return result;
  };
  ctx.destination = node('destination');
  ctx.createGain = () => Object.assign(node('gain'), { gain: param(1) });
  ctx.createDynamicsCompressor = () => Object.assign(node('compressor'), {
    threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(),
  });
  ctx.createWaveShaper = () => node('ceiling');
  ctx.createBiquadFilter = () => Object.assign(node('filter'), { frequency: param(350), Q: param(1), type: '' });
  // Legacy trill/squash/flash intentionally schedule their component layers ahead.
  ctx.createOscillator = () => {
    const result = Object.assign(scheduled('oscillator'), { frequency: param(440), type: '' });
    result.start = at => { assert(at >= ctx.currentTime); result.starts.push(at); }; return result;
  };
  ctx.createBufferSource = () => {
    const result = Object.assign(scheduled('buffer'), { buffer: null, playbackRate: param(1) });
    result.start = at => { assert(at >= ctx.currentTime); result.starts.push(at); }; return result;
  };
  ctx.createBuffer = (channels, length, rate) => {
    assert.equal(channels, 1); assert.equal(rate, sampleRate);
    const data = new Float32Array(length);
    const buffer = { length, data, getChannelData: channel => { assert.equal(channel, 0); return data; } };
    ctx.buffers.push(buffer); return buffer;
  };
  ctx.addEventListener = (event, callback) => { assert.equal(event, 'statechange'); ctx.listeners.add(callback); };
  ctx.removeEventListener = (event, callback) => { assert.equal(event, 'statechange'); ctx.listeners.delete(callback); };
  ctx.changeState = state => { ctx.state = state; [...ctx.listeners].forEach(callback => callback()); };
  return ctx;
}
const reachable = (from, target, seen = new Set()) => {
  if (from === target) return true;
  if (seen.has(from)) return false;
  seen.add(from); return from.outputs.some(next => reachable(next, target, seen));
};
const downstream = (from, seen = new Set()) => {
  if (seen.has(from)) return [];
  seen.add(from); return [from, ...from.outputs.flatMap(next => downstream(next, seen))];
};
function checkGraph() {
  let ctx = makeContext();
  const visibility = new Set();
  const document = { hidden: false,
    addEventListener: (event, callback) => { assert.equal(event, 'visibilitychange'); visibility.add(callback); },
    removeEventListener: (event, callback) => { assert.equal(event, 'visibilitychange'); visibility.delete(callback); },
  };
  const sandbox = vm.createContext({ document, getAudioContext: () => ctx,
    window: { setTimeout() {} }, hidoimeCrushSound: { stop() {} }, stopAnchiThunderSounds() {},
  });
  vm.runInContext(compile(extracted + `\nglobalThis.api = {
    getSfxBus, focusEnemySound, playEnemyTrill, playEnemySquash, playEnemyFlashSound,
    playDetarameDamageSound, stopDetarameDamageSounds, setGamePaused, dropPauseWaiters,
    get active() { return detarameDamageSources; }, get effectMix() { return effectMix; },
  };`), sandbox);
  const { api } = sandbox;
  const channels = ['operation', 'effect', 'enemy', 'enemyHit', 'enemyDefeat', 'detarame', 'impact', 'thunder'];
  const buses = new Map(channels.map(channel => [channel, api.getSfxBus(channel)]));
  assert.equal(new Set(buses.values()).size, 8, 'all eight SFX channels have independent inputs');
  const ceilings = ctx.nodes.filter(node => node.kind === 'ceiling');
  assert.equal(ceilings.length, 1, 'only the final safety ceiling is shared');
  const limiters = new Map();
  for (const [channel, bus] of buses) {
    assert.equal(api.getSfxBus(channel), bus, channel + ' bus is cached');
    assert(reachable(bus, ctx.destination));
    for (const [other, target] of buses) if (other !== channel) assert(!reachable(bus, target), `${channel} never enters ${other}`);
    const compressors = downstream(bus).filter(node => node.kind === 'compressor');
    const compressed = ['effect', 'enemy', 'enemyHit', 'enemyDefeat', 'detarame'].includes(channel);
    assert.equal(compressors.length, Number(compressed), channel + ' compression topology');
    if (compressed) limiters.set(channel, compressors[0]);
  }
  assert.equal(new Set(limiters.values()).size, 5, 'damage, defeat, attacks and effects share no compressor');
  const gainsBefore = [...buses.values()].map(bus => bus.gain.events.length);
  api.focusEnemySound(ctx, 0.3);
  assert(api.effectMix.gain.events.some(event => event[0] === 'target'));
  assert.deepEqual([...buses.values()].map(bus => bus.gain.events.length), gainsBefore, 'ducking changes only effectMix');
  for (const [name, channel, arg] of [['playEnemyTrill', 'enemyHit', false], ['playEnemySquash', 'enemyDefeat', true]]) {
    const before = ctx.sources.length; api[name](arg);
    const voices = ctx.sources.slice(before); assert(voices.length > 0);
    for (const voice of voices) {
      assert(reachable(voice, buses.get(channel)), name + ' reaches its dedicated bus');
      for (const [other, bus] of buses) if (other !== channel) assert(!reachable(voice, bus), name + ' avoids ' + other);
    }
  }
  const beforeFlash = ctx.sources.length; api.playEnemyFlashSound(true);
  const flash = ctx.sources.slice(beforeFlash);
  assert(flash.some(voice => reachable(voice, buses.get('impact'))));
  assert(flash.some(voice => reachable(voice, buses.get('enemyHit'))), 'old flash keeps its trill accompaniment');
  assert(flash.every(voice => !reachable(voice, buses.get('enemyDefeat')) && !reachable(voice, buses.get('detarame'))));

  const play = count => { const before = ctx.sources.length; api.playDetarameDamageSound(count); return ctx.sources.slice(before); };
  const first = play(8), second = play(8);
  assert.equal(first.length, 8); assert.equal(second.length, 8); assert.equal(api.active.size, 16);
  const overlap = [...first, ...second];
  assert.equal(new Set(overlap.map(voice => voice.buffer)).size, 1, 'all simultaneous hits reuse one PCM buffer');
  assert.equal(new Set(overlap.map(voice => api.active.get(voice))).size, 16, 'each voice has its own gain envelope');
  for (const voices of [first, second]) {
    assert.equal(new Set(voices.map(voice => voice.playbackRate.value)).size, 8, 'segments have distinct playback rates');
    voices.forEach(voice => {
      assert.deepEqual(voice.starts, [ctx.currentTime]); assert.equal(voice.stops.length, 0, 'overlap never cuts a current voice');
      assert(Math.abs(api.active.get(voice).gain.value - 0.65 / Math.sqrt(8)) < 1e-12);
      assert(reachable(voice, buses.get('detarame')));
      for (const [channel, bus] of buses) if (channel !== 'detarame') assert(!reachable(voice, bus));
    });
  }
  assert.equal(play(100).length, 0); assert.equal(api.active.size, 16, 'overload is bounded without queuing');
  assert(overlap.every(voice => voice.stops.length === 0), 'overload preserves already playing damage voices');
  const ended = first[0], endedGain = api.active.get(ended), lateEnd = ended.onended;
  ended.end(); assert(!api.active.has(ended)); assert.equal(ended.disconnects, 1); assert.equal(endedGain.disconnects, 1); assert.equal(ended.onended, null);
  const fill = play(8); assert.equal(fill.length, 1, 'only available voice slots are filled');
  assert.equal(api.active.size, 16);
  const bufferCount = ctx.buffers.length;
  const stopped = [...api.active.keys()], stoppedGains = [...api.active.values()];
  stopped[0].throwOnStop = true;
  api.stopDetarameDamageSounds();
  assert.equal(api.active.size, 0); assert(stopped.every(voice => voice.stops.length === 1 && voice.disconnects === 1));
  assert(stoppedGains.every(gain => gain.disconnects === 1));
  api.stopDetarameDamageSounds(); assert(stopped.every(voice => voice.stops.length === 1), 'stop is idempotent');
  lateEnd(); assert.equal(api.active.size, 0, 'late ended callback cannot resurrect a voice');
  assert.equal(play(100).length, 8, 'one event is capped at eight voices');
  assert.equal(ctx.buffers.length, bufferCount, 'normal cleanup retains the PCM cache');
  api.stopDetarameDamageSounds();
  const sequential = Array.from({ length: 16 }, () => play(1));
  assert(sequential.every(voices => voices.length === 1), 'same-time calls are not debounced or coalesced');
  assert.equal(api.active.size, 16);
  api.setGamePaused(true); assert.equal(api.active.size, 0); assert.equal(play(1).length, 0);
  const beforeResume = ctx.sources.length; api.setGamePaused(false);
  assert.equal(ctx.sources.length, beforeResume, 'resume does not replay stopped voices');
  assert.equal(play(1).length, 1); api.dropPauseWaiters(); assert.equal(api.active.size, 0, 'restart generation cleanup stops damage');

  const app = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'App');
  const effects = app.body.statements.filter(node => ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)
    && node.expression.expression.getText(ast) === 'useEffect').map(node => node.expression.arguments[0]);
  const mute = effects.find(node => node.getText(ast).includes("soundMode === 'none'") && node.getText(ast).includes('stopDetarameDamageSounds()'));
  assert(mute, 'mute cleanup is wired in App');
  play(2); sandbox.soundMode = 'none'; vm.runInContext(compile(`(${mute.getText(ast)})();`), sandbox); assert.equal(api.active.size, 0);
  const beforeUnmute = ctx.sources.length; sandbox.soundMode = 'all'; vm.runInContext(compile(`(${mute.getText(ast)})();`), sandbox);
  assert.equal(ctx.sources.length, beforeUnmute);
  const hiddenEffect = effects.find(node => node.getText(ast).includes('visibilitychange') && node.getText(ast).includes('stopDetarameDamageSounds()'));
  assert(hiddenEffect, 'visibility cleanup is wired in App');
  vm.runInContext(compile(`globalThis.unmount = (${hiddenEffect.getText(ast)})();`), sandbox);
  play(2); document.hidden = true; visibility.forEach(fn => fn()); assert.equal(api.active.size, 0); assert.equal(play(1).length, 0);
  document.hidden = false; visibility.forEach(fn => fn()); assert.equal(api.active.size, 0);
  play(2); sandbox.unmount(); assert.equal(api.active.size, 0); assert.equal(visibility.size, 0);
  const reset = app.body.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations])
    .find(node => node.name.getText(ast) === 'resetGame').initializer.arguments[0];
  const resetStop = reset.body.statements.find(node => node.getText(ast) === 'stopDetarameDamageSounds();');
  assert(resetStop, 'reset calls damage cleanup unconditionally');
  play(2); vm.runInContext(resetStop.getText(ast), sandbox); assert.equal(api.active.size, 0);
  for (const state of ['suspended', 'interrupted', 'closed']) {
    play(2); ctx.changeState(state); assert.equal(api.active.size, 0); assert.equal(play(1).length, 0);
    const before = ctx.sources.length; ctx.changeState('running'); assert.equal(ctx.sources.length, before, 'context recovery does not replay');
  }
  for (const count of [0, -1, 0.5, NaN, Infinity]) assert.equal(play(count).length, 0, 'invalid hit count is silent');
  const original = ctx; play(2); const oldSources = [...api.active.keys()]; ctx = makeContext();
  assert.equal(play(1).length, 1); assert(oldSources.every(voice => voice.disconnects === 1));
  assert.equal(original.listeners.size, 0); assert.equal(ctx.listeners.size, 1); assert.equal(ctx.buffers.length, 1);
  api.stopDetarameDamageSounds(); ctx = null;
  assert.doesNotThrow(() => api.playDetarameDamageSound(1)); assert.equal(api.active.size, 0);
  for (const rate of [22050, 44100, 48000, 96000]) {
    ctx = makeContext(rate); const [voice] = play(1), data = voice.buffer.data;
    assert.equal(data.length, Math.ceil(rate * 0.22)); assert(data.every(Number.isFinite)); assert.equal(data[0], 0);
    const peak = data.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
    assert(peak > 0.1 && peak < 0.65, 'damage PCM is non-silent with headroom');
    assert(Math.abs(data.at(-1)) < 1e-6, 'damage PCM tail approaches zero');
    voice.end();
  }
  console.log('PASS damage Web Audio: eight isolated buses, independent compression, preserved legacy routing, 16 same-time voices, capped overload, cached PCM, cleanup, pause/mute/reset/hidden/interruption, four sample rates');
}

const DAMAGE = 'playDetarameDamageSound';
const sound = (h, name = DAMAGE) => h.audio.filter(event => event.name === name);
const clearLogs = h => { h.audio.length = h.damageFlashes.length = 0; };
async function boot(mode = 'sfx') {
  const h = harness('detarame', { audio: true }); await h.boot();
  await h.until(() => h.tree.read().status === 'playing', 'Detarame practice startup');
  h.tree.setSoundMode(mode); await h.flush(); clearLogs(h); return h;
}
function assertDamageTiming(h, count, label) {
  const flashes = h.damageFlashes.filter(event => event.hits.length);
  assert.equal(flashes.length, 2, label + ': initial cue and restarted damage flash both exist');
  const [cue, actual] = flashes;
  assert(actual.at > cue.at, label + ': actual damage follows the initial cue');
  const gap = h.damageFlashes.find(event => !event.hits.length && event.at > cue.at);
  assert(gap); assert(actual.at - gap.at >= 34, label + ': flash restarts after its explicit blank frame');
  assert.deepEqual(sound(h).map(event => event.at), [actual.at], label + ': damage sound starts exactly at actual flash, once');
  assert.deepEqual(sound(h)[0].args, [count], label + ': total live struck segments is passed to synth');
  assert.equal(actual.hits.reduce((sum, [, indexes]) => sum + indexes.length, 0), count);
}
async function beginUntilDamageGap(h) {
  const target = h.tree.read().detarame, board = actors(h);
  board[target.top - 1][target.x] = { id: 'gap-one', value: 1, group: 9600 };
  h.tree.setBoard(board); h.tree.setCurrent(h.tree.makeSinglePiece(9601, 6, target.x)); await h.flush(); h.tree.hardDrop();
  await h.until(() => h.damageFlashes.some(event => event.hits.length), 'initial damage cue');
  await h.until(() => h.damageFlashes.at(-1)?.hits.length === 0, 'blank frame before actual damage');
}
async function checkResolver() {
  for (const special of [false, true]) {
    const h = await boot(), before = h.tree.read().detarame.segs.filter(segment => segment.alive).length;
    await attack(h, -5, special);
    assertDamageTiming(h, 1, special ? 'special' : 'seven');
    assert.equal(h.tree.read().detarame.segs.filter(segment => segment.alive).length, before - 1);
    assert.equal(sound(h, 'playHidoimeDefeatSound').length, 0, 'nonlethal hit does not use defeat sound');
    assert.equal(sound(h, 'playEnemyFlashSound').length, 1, 'existing attack cue is preserved');
    h.assertRealUnchanged();
  }
  const multi = await boot(), original = multi.tree.read().detarame;
  for (const [id, x] of [[original.id, 2], [original.id + 1, 4]]) multi.tree.updateDetarameById(id, { ...original, id, x });
  await multi.flush();
  const board = multi.tree.emptyBoard();
  for (const d of multi.tree.read().detarames) for (let i = 0; i < d.segs.length; i++) {
    board[d.top + i][d.x] = { id: `body-${d.id}-${i}`, value: -5, group: -820 - d.id };
  }
  board[13][3] = { id: 'multi-one', value: 1, group: 9901 };
  await multi.drop(board, 6, 3); assertDamageTiming(multi, 4, 'two simultaneous enemies');
  assert.equal(multi.tree.read().detarames.length, 2);
  assert(multi.tree.read().detarames.every(d => d.segs.filter(segment => segment.alive).length === 1));
  assert.equal(sound(multi, 'playHidoimeDefeatSound').length, 0);
  multi.assertRealUnchanged();

  const muted = await boot('none'); await attack(muted, -5);
  assert.equal(sound(muted).length, 0); assert.equal(muted.damageFlashes.filter(event => event.hits.length).length, 2, 'mute still shows real damage');
  assert.equal(muted.tree.read().detarame.segs.filter(segment => segment.alive).length, 2);
  for (const dying of [false, true]) {
    const h = await boot(), d = h.tree.read().detarame;
    h.tree.updateDetarameById(d.id, { ...d, x: 4, dying,
      segs: d.segs.map((segment, i) => ({ ...segment, alive: dying || i !== 1 })) });
    await h.flush();
    const board = actors(h);
    for (const [x, y, value] of [[2, 13, 2], [3, 13, 2], [2, 12, 1]]) board[y][x] = { id: `blank-${x}-${y}`, value, group: 9100 + x + y * 7 };
    await h.drop(board, 6, 3);
    assert(sound(h, 'playClearSound').length > 0, 'a legal seven actually resolved');
    assert.equal(sound(h).length, 0, dying ? 'dying enemy cannot emit damage' : 'blank middle segment cannot emit damage');
    assert.equal(h.damageFlashes.filter(event => event.hits.length).length, 0);
  }
  const empty = await boot(), emptyBoard = empty.tree.emptyBoard();
  emptyBoard[13][0] = { id: 'empty-seven', value: 1, group: 9001 };
  await empty.drop(emptyBoard, 6, 0); assert.equal(sound(empty).length, 0, 'clear away from an enemy is silent on damage bus');

  // Delay the actual 34ms restart timer by 250ms, beyond the old 120ms late-SFX limit.
  const late = await boot(); await beginUntilDamageGap(late);
  const blankAt = late.now;
  await late.advance(33); assert.equal(sound(late).length, 0);
  await late.tick(250);
  await late.until(() => sound(late).length > 0, 'late actual damage');
  assert.equal(sound(late)[0].at - blankAt, 284, 'late sound follows the late flash rather than being suppressed');
  await late.until(() => late.tree.read().status === 'playing', 'late resolver finish');
  assertDamageTiming(late, 1, 'late resumed flash');
  const paused = await boot(); await beginUntilDamageGap(paused);
  paused.tree.togglePause(); await paused.flush(); await paused.advance(1000);
  assert.equal(paused.tree.read().status, 'paused'); assert.equal(sound(paused).length, 0, 'pending damage stays silent while paused');
  const resumedAt = paused.now; paused.tree.resume(); await paused.flush();
  await paused.until(() => paused.tree.read().status === 'playing', 'paused damage resolver resumes');
  assertDamageTiming(paused, 1, 'pause/resume'); assert.equal(sound(paused)[0].at, resumedAt);
  for (const exit of [false, true]) {
    const h = await boot(); await beginUntilDamageGap(h);
    if (exit) h.tree.backToTitle(); else h.tree.playAgain();
    await h.flush(); await h.advance(20000);
    assert.equal(sound(h).length, 0, (exit ? 'exit' : 'restart') + ' cancels the old pending damage sound');
  }
  console.log('PASS real damage resolver: nonlethal seven and special, four segments across two enemies, exact restarted-flash timing, mute/blank/dying/no-target silence, late-frame and pause/resume synchronization, restart/exit cancellation');
}
(async () => { checkGraph(); await checkResolver(); })().catch(error => { console.error(error); process.exitCode = 1; });
