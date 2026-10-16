// Execute the real App synth/bus/lifecycle functions in a Web Audio graph mock.
// Checks scheduling, noise data, routing and cleanup, NOT audible quality,
// perceived loudness, browser audio output, or mobile-device listening.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/App.tsx', 'utf8');
const ast = ts.createSourceFile('src/App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const compile = code => ts.transpileModule(code, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;
const names = [
  'gamePaused', 'pauseWaiters', 'setGamePaused',
  'SFX_OUTPUT_GAIN', 'SFX_CEILING_CURVE', 'sfxBuses', 'sfxBusCtx', 'effectMix', 'enemyFocusUntil',
  'getSfxBus', 'focusEnemySound', 'makeNoise', 'anchiThunderSources',
  'trackAnchiThunderSource', 'stopAnchiThunderSounds',
  'playThunderTraceSound', 'playThunderCountSound', 'playThunderStrikeSound',
  'playPaintLaunchSound', 'playPaintSplatSound',
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
let serial = 0;
function makeContext() {
  const context = { state: 'running', currentTime: 10, sampleRate: 48000, nodes: [], sources: [], buffers: [] };
  const param = (value = 0) => ({
    value, events: [],
    setValueAtTime(value, at) { this.events.push(['set', value, at]); },
    exponentialRampToValueAtTime(value, at) {
      assert(value > 0 && Number.isFinite(value), 'exponential targets are positive finite');
      this.events.push(['ramp', value, at]);
    },
    setTargetAtTime(value, at, constant) { this.events.push(['target', value, at, constant]); },
    cancelScheduledValues(at) { this.events.push(['cancel', at]); },
  });
  const node = kind => {
    const result = {
      id: ++serial, kind, outputs: [], disconnects: 0,
      connect(other) { this.outputs.push(other); return other; },
      disconnect() { this.disconnects++; this.outputs = []; },
    };
    context.nodes.push(result); return result;
  };
  const scheduled = kind => {
    const result = Object.assign(node(kind), {
      onended: null, starts: [], stops: [], throwOnStop: false,
      start(at) { assert(Number.isFinite(at) && at >= context.currentTime); this.starts.push(at); },
      stop(at) { this.stops.push(at); if (this.throwOnStop) throw new Error('already stopped'); },
      end() { this.onended?.(); },
    });
    context.sources.push(result); return result;
  };
  context.destination = node('destination');
  context.createGain = () => Object.assign(node('gain'), { gain: param(1) });
  context.createBiquadFilter = () => Object.assign(node('filter'), { frequency: param(350), Q: param(1), type: '' });
  context.createWaveShaper = () => node('ceiling');
  context.createDynamicsCompressor = () => Object.assign(node('compressor'), {
    threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(),
  });
  context.createOscillator = () => Object.assign(scheduled('oscillator'), { frequency: param(440), type: '' });
  context.createBufferSource = () => Object.assign(scheduled('noise'), { buffer: null });
  context.createBuffer = (channels, length, rate) => {
    assert.equal(channels, 1); assert.equal(rate, context.sampleRate);
    const data = new Float32Array(length);
    const buffer = { length, data, getChannelData: channel => { assert.equal(channel, 0); return data; } };
    context.buffers.push(buffer); return buffer;
  };
  return context;
}
const context = makeContext();
let currentContext = context, crushStops = 0;
const sandbox = vm.createContext({
  getAudioContext: () => currentContext,
  hidoimeCrushSound: { stop: () => crushStops++ },
  stopDetarameDamageSounds: () => {}, // Its lifecycle is covered by enemy-damage-audio.cjs.
});
vm.runInContext(compile(extracted + `\nglobalThis.api = {
  ${names.filter(name => name.startsWith('play')).join(',')},
  stopAnchiThunderSounds, setGamePaused, getSfxBus, focusEnemySound,
  get active() { return anchiThunderSources; },
  get effectMix() { return effectMix; },
  get paused() { return gamePaused; },
};`), sandbox);
const { api } = sandbox;
const sounds = [
  ['playPaintLaunchSound', 'enemy', 1], ['playPaintSplatSound', 'enemy', 2],
  ['playThunderTraceSound', 'thunder', 3], ['playThunderCountSound', 'thunder', 1],
  ['playThunderStrikeSound', 'thunder', 2],
];
const graphContains = (from, target, visited = new Set()) => {
  if (from === target) return true;
  if (visited.has(from)) return false;
  visited.add(from); return from.outputs.some(next => graphContains(next, target, visited));
};
const graphKinds = (from, seen = new Set()) => {
  if (seen.has(from)) return [];
  seen.add(from); return [from.kind, ...from.outputs.flatMap(next => graphKinds(next, seen))];
};
const play = (name, step = 0) => {
  const previous = context.sources.length; api[name](step); return context.sources.slice(previous);
};
for (const [name, channel, count] of sounds) {
  const created = play(name);
  assert.equal(created.length, count, `${name} schedules all expected voices`);
  assert.equal(api.active.size, count, `${name} registers every voice`);
  const intended = api.getSfxBus(channel);
  const other = api.getSfxBus(channel === 'enemy' ? 'thunder' : 'enemy');
  for (const voice of created) {
    assert(api.active.has(voice)); assert.equal(voice.starts.length, 1); assert.equal(voice.stops.length, 1);
    assert(voice.stops[0] > voice.starts[0] && voice.stops[0] - voice.starts[0] <= 0.86);
    assert(graphContains(voice, intended), `${name} reaches its ${channel} bus`);
    assert(!graphContains(voice, other), `${name} does not cross-route into the other bus`);
    assert(graphContains(voice, context.destination), `${name} reaches output`);
    assert.equal(graphKinds(voice).includes('compressor'), channel === 'enemy', 'thunder avoids enemy/effect compression');
    if (voice.buffer) {
      assert(voice.buffer.data.every(Number.isFinite));
      assert(voice.buffer.data.some(value => Math.abs(value) > 0.1), 'noise is not silent');
      assert(Math.max(...voice.buffer.data.slice(-20).map(Math.abs)) < 0.005, 'noise tails decay');
    }
    voice.end();
    assert(!api.active.has(voice), 'natural onended unregisters the voice');
    assert.equal(voice.disconnects, 1, 'natural onended disconnects the voice');
  }
  assert.equal(api.active.size, 0);
}
// Each trace/count step actually changes the real oscillator parameter.
for (const [index, expected] of [1047, 1319, 1568].entries()) {
  const trace = play('playThunderTraceSound', index);
  assert.equal(trace[0].frequency.events[0][1], expected);
  assert.equal(trace[1].frequency.events[0][1], expected * 2);
  trace.forEach(voice => voice.end());
}
for (const [index, expected] of [660, 880, 1175].entries()) {
  const count = play('playThunderCountSound', index);
  assert.equal(count[0].frequency.value, expected); count.forEach(voice => voice.end());
}
const splat = play('playPaintSplatSound');
assert(Math.abs(splat[1].starts[0] - splat[0].starts[0] - 0.07) < 1e-12, 'splat has its second wet hit after 70ms');
splat.forEach(voice => voice.end());
const thunder = api.getSfxBus('thunder'), enemy = api.getSfxBus('enemy');
assert.notEqual(thunder, enemy); assert.equal(api.getSfxBus('thunder'), thunder, 'bus is cached');
const thunderGainEvents = thunder.gain.events.length;
api.focusEnemySound(context, 0.3);
assert(api.effectMix.gain.events.some(event => event[0] === 'target'));
assert.equal(thunder.gain.events.length, thunderGainEvents, 'enemy ducking leaves thunder untouched');

const allPlaying = () => {
  const result = sounds.flatMap(([name]) => play(name));
  assert.equal(result.length, 9); assert.equal(api.active.size, 9); return result;
};
const assertStopped = voices => {
  assert.equal(api.active.size, 0);
  voices.forEach(voice => { assert.equal(voice.stops.at(-1), undefined, 'immediate stop requested'); assert(voice.disconnects > 0); });
};
let voices = allPlaying();
voices[2].throwOnStop = true;
api.stopAnchiThunderSounds(); assertStopped(voices);
const counts = voices.map(voice => voice.stops.length);
api.stopAnchiThunderSounds();
assert.deepEqual(voices.map(voice => voice.stops.length), counts, 'repeated stop is idempotent');
voices.forEach(voice => voice.end()); // A late natural event after stop is harmless.
assert.equal(api.active.size, 0);
voices = allPlaying(); api.setGamePaused(true); assertStopped(voices);
assert.equal(api.paused, true); assert(crushStops > 0);
const beforeResume = context.sources.length;
api.setGamePaused(false);
assert.equal(api.paused, false); assert.equal(context.sources.length, beforeResume, 'resume does not replay stopped audio');
voices = allPlaying(); // Fresh intentional sound after resume still works.
voices.forEach(voice => voice.end());

// Exercise the real mute effect, and verify/execute the direct reset cleanup
// statement. The full gameplay reset is covered by check-enemy-practice.cjs.
const app = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'App');
const effects = app.body.statements.filter(node => ts.isExpressionStatement(node)
  && ts.isCallExpression(node.expression) && node.expression.expression.getText(ast) === 'useEffect');
const muteEffect = effects.map(node => node.expression.arguments[0]).find(node => {
  const text = node.getText(ast); return text.includes("soundMode === 'none'") && text.includes('stopAnchiThunderSounds()');
});
assert(muteEffect, 'mute effect is wired to cleanup');
voices = allPlaying(); sandbox.soundMode = 'none';
vm.runInContext(compile(`(${muteEffect.getText(ast)})();`), sandbox); assertStopped(voices);
sandbox.soundMode = 'all'; const beforeUnmute = context.sources.length;
vm.runInContext(compile(`(${muteEffect.getText(ast)})();`), sandbox);
assert.equal(context.sources.length, beforeUnmute, 'unmute does not replay previous audio');
const resetDeclaration = app.body.statements.filter(ts.isVariableStatement)
  .flatMap(node => [...node.declarationList.declarations]).find(node => node.name.getText(ast) === 'resetGame');
const resetCallback = resetDeclaration.initializer.arguments[0];
const resetStop = resetCallback.body.statements.find(node => node.getText(ast) === 'stopAnchiThunderSounds();');
assert(resetStop, 'reset calls sound cleanup unconditionally');
voices = allPlaying(); vm.runInContext(resetStop.getText(ast), sandbox); assertStopped(voices);
const beforeMissing = context.sources.length;
currentContext = null;
sounds.forEach(([name]) => api[name](0));
assert.equal(context.sources.length, beforeMissing, 'missing Web Audio context schedules nothing');
currentContext = context;
voices = allPlaying(); voices.forEach(voice => voice.end());
assert.equal(api.active.size, 0);

console.log('PASS: paint launch/splat + thunder trace/count/strike scheduling, non-silent noise, 9 registered voices, separate enemy/thunder graphs, duck isolation, onended, stop/throw/idempotence, pause/resume, mute/unmute, reset cleanup wiring, no-context safety. Mock graph test only; no listening/device verification.');

