// Deterministic PCM and source-lifecycle checks; not a listening/device test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const scope = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/hidoimeCrushAudio.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, scope);
const { makeHidoimeCrushSamples, createHidoimeCrushSound, HIDOIME_CRUSH_SECONDS } = scope.exports;
const peak = samples => samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
for (const rate of [22050, 44100, 48000, 96000]) {
  const samples = makeHidoimeCrushSamples(rate);
  assert.equal(samples.length, Math.ceil(rate * HIDOIME_CRUSH_SECONDS));
  assert(samples.every(Number.isFinite));
  assert.equal(samples[0], 0);
  assert(Math.abs(samples.at(-1)) < 0.000001);
  assert(peak(samples) > 0.45 && peak(samples) < 0.6);
  assert(peak(samples.slice(-Math.round(rate * 0.015))) < 0.001);
  assert.deepEqual(samples, makeHidoimeCrushSamples(rate));
  // Thirteen real 136ms rows, and stress at the shortest accepted interval.
  for (const interval of [0.136, 0.06]) {
    const step = Math.round(rate * interval);
    const mix = new Float32Array(step * 12 + samples.length);
    for (let voice = 0; voice < 13; voice++) {
      // The two-voice limit removes each oldest source when the third arrives.
      const length = voice < 11 ? Math.min(samples.length, step * 2) : samples.length;
      for (let i = 0; i < length; i++) mix[voice * step + i] += samples[i];
    }
    assert(peak(mix) * 1.35 < 0.9, 'headroom before the existing enemy bus limiter');
  }
}

function context(state = 'running') {
  const listeners = new Set();
  return {
    state, sampleRate: 48000, currentTime: 0, sources: [], buffers: 0, listeners,
    addEventListener: (event, fn) => { assert.equal(event, 'statechange'); listeners.add(fn); },
    removeEventListener: (event, fn) => listeners.delete(fn),
    changeState(next) { this.state = next; listeners.forEach(fn => fn()); },
    createBuffer(channels, length, rate) {
      this.buffers++;
      assert.equal(channels, 1); assert.equal(rate, this.sampleRate);
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    },
    createBufferSource() {
      const source = {
        onended: null, buffer: null, destination: null, started: null, stopped: false, disconnected: false,
        connect(destination) { this.destination = destination; },
        start(at) { this.started = at; }, stop() { this.stopped = true; },
        disconnect() { this.disconnected = true; }, end() { this.onended?.(); },
      };
      this.sources.push(source); return source;
    },
  };
}
const sound = createHidoimeCrushSound(), ctx = context('suspended'), bus = {};
for (const state of ['suspended', 'interrupted', 'closed']) {
  ctx.state = state; sound.play(ctx, bus);
}
assert.equal(ctx.sources.length, 0); assert.equal(ctx.buffers, 0);
ctx.changeState('running');
assert.equal(ctx.sources.length, 0, 'unlock cannot replay a discarded crush');
sound.play(ctx, bus);
assert.equal(ctx.sources.length, 1); assert.equal(ctx.sources[0].started, 0);
assert.equal(ctx.sources[0].destination, bus);
for (let i = 0; i < 100; i++) sound.play(ctx, bus);
assert.equal(ctx.sources.length, 1, 'simultaneous duplicate calls are coalesced');
ctx.currentTime = 0.136; sound.play(ctx, bus);
ctx.currentTime = 0.272; sound.play(ctx, bus);
assert.equal(ctx.sources.length, 3); assert.equal(ctx.buffers, 1);
assert(ctx.sources[0].stopped && ctx.sources[0].disconnected);
assert.equal(ctx.sources.filter(source => !source.disconnected).length, 2);
ctx.sources[1].end();
assert(ctx.sources[1].disconnected && ctx.sources[1].onended === null);
sound.stop(); sound.stop();
assert(ctx.sources.every(source => source.disconnected));
sound.play(ctx, bus); // A fresh run can start at once, even at the same audio time.
assert.equal(ctx.sources.length, 4);
ctx.changeState('interrupted');
assert(ctx.sources[3].stopped && ctx.sources[3].disconnected);
ctx.changeState('running');
assert.equal(ctx.sources.length, 4, 'interruption recovery has no deferred sound');
const other = context(); sound.play(other, bus);
assert.equal(ctx.listeners.size, 0); assert.equal(other.listeners.size, 1);
assert.equal(other.buffers, 1); assert.equal(other.sources.length, 1);
for (let i = 1; i <= 100; i++) {
  other.currentTime = i * 0.061; sound.play(other, bus);
  assert(other.sources.filter(source => !source.disconnected).length <= 2);
}
sound.stop();
assert(other.sources.every(source => source.disconnected));
console.log('PASS: crush PCM at four sample rates, 136ms/stress headroom, cache, 2-voice cap, cleanup, cancel, no delayed unlock/recovery');
