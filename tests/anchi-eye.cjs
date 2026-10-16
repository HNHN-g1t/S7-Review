// Shared engine/render coordinate and Canvas lifecycle regressions. No browser
// rendering or device-performance claim is made by these deterministic checks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compile = (path) => ts.transpileModule(fs.readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const helperScope = { exports: {} };
vm.runInNewContext(compile('src/enemy/anchiEye.ts'), helperScope);
const { ANCHI_EYE_TRAVEL_MS, anchiEyeCells, projectAnchiEye, sampleAnchiEyePath, anchiEyeCell, remapAnchiEye } = helperScope.exports;
const plain = (point) => ({ x: point.x, y: point.y });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
assert.equal(ANCHI_EYE_TRAVEL_MS, 450);
for (let w = 1; w <= 4; w++) for (let h = 1; h <= 4; h++) {
  const cells = anchiEyeCells(w, h);
  const valid = (point) => {
    assert(point.x >= 0 && point.x <= w - 1);
    assert(point.y >= 0 && point.y <= Math.max(0, h - 2));
    assert(point.x === 0 || point.x === w - 1 || point.y === 0);
  };
  assert.equal(new Set(cells.map(p => `${p.x},${p.y}`)).size, cells.length, 'no duplicated U corner');
  for (const cell of cells) valid(cell);
  for (const from of cells) for (const to of cells) {
    assert.deepEqual(plain(sampleAnchiEyePath(w, h, from, to, -1)), plain(from));
    assert.deepEqual(plain(sampleAnchiEyePath(w, h, from, to, 2)), plain(to));
    let previous = from;
    for (let step = 0; step <= 100; step++) {
      const eye = sampleAnchiEyePath(w, h, from, to, step / 100);
      valid(eye);
      const cell = anchiEyeCell(w, h, eye);
      valid(cell);
      assert(Number.isInteger(cell.x) && Number.isInteger(cell.y));
      assert.equal(cell.x, Math.floor(eye.x + 0.5), 'hit x follows displayed eye centre');
      assert.equal(cell.y, Math.floor(eye.y + 0.5), 'hit y follows displayed eye centre');
      assert(distance(previous, eye) < 0.12, 'no corner teleport');
      previous = eye;
    }
  }
  for (let x = -1; x <= w; x += 0.25) for (let y = -1; y <= h; y += 0.25) {
    const projected = projectAnchiEye(w, h, { x, y });
    valid(projected);
    assert.deepEqual(plain(projectAnchiEye(w, h, projected)), plain(projected), 'projection is idempotent');
  }
}
// Opposite sides must travel over the top. A straight interpolation would enter
// the forbidden centre at this sample, and a full perimeter would cross below.
assert.deepEqual(plain(sampleAnchiEyePath(4, 4, { x: 0, y: 2 }, { x: 3, y: 2 }, 0.5)), { x: 1.5, y: 0 });
assert.deepEqual(plain(anchiEyeCell(4, 4, { x: 1.499, y: 0 })), { x: 1, y: 0 });
assert.deepEqual(plain(anchiEyeCell(4, 4, { x: 1.5, y: 0 })), { x: 2, y: 0 });
assert.deepEqual(plain(remapAnchiEye({ x: 0.4, y: 0 }, { x: 4, y: 7, w: 2, h: 2 }, { x: 3, y: 7, w: 3, h: 2 })), { x: 1.4000000000000004, y: 0 });
assert.deepEqual(plain(remapAnchiEye({ x: 0, y: 0.4 }, { x: 3, y: 7, w: 2, h: 3 }, { x: 3, y: 6, w: 2, h: 4 })), { x: 0, y: 1.4000000000000004 });
assert.deepEqual(plain(remapAnchiEye({ x: 0, y: 0 }, { x: 4, y: 7, w: 2, h: 2 }, { x: 3, y: 6, w: 3, h: 3 })), { x: 1, y: 0 }, 'growth into interior chooses closest valid perimeter');

// Hook/Canvas harness: prop updates and resize retain the same RAF, clocks,
// tentacles, and immediately use the authoritative fractional eye coordinate.
const refs = [], effects = [], pendingEffects = [], frames = new Map(), operations = [];
const visibilityListeners = new Set();
let hook = 0, frameId = 0, rafCancels = 0, time = 0;
const g = new Proxy({}, {
  get: (object, key) => key in object ? object[key] : (...args) => operations.push([key, ...args]),
  set: (object, key, value) => { object[key] = value; operations.push(['set', key, value]); return true; },
});
const canvas = { width: 0, height: 0, getContext: () => g };
class FakePath { ellipse() {} roundRect() {} moveTo() {} quadraticCurveTo() {} lineTo() {} closePath() {} bezierCurveTo() {} addPath() {} }
const scope = {
  exports: {}, Path2D: FakePath, DOMMatrix: class {},
  performance: { now: () => time },
  document: {
    hidden: false, createElement: () => ({ width: 0, height: 0, getContext: () => g }),
    addEventListener: (type, callback) => { assert.equal(type, 'visibilitychange'); visibilityListeners.add(callback); },
    removeEventListener: (type, callback) => { assert.equal(type, 'visibilitychange'); visibilityListeners.delete(callback); },
  },
  window: { devicePixelRatio: 1, matchMedia: () => ({ matches: false }) },
  requestAnimationFrame: (callback) => { frames.set(++frameId, callback); return frameId; },
  cancelAnimationFrame: (id) => { rafCancels++; frames.delete(id); },
  require: (name) => {
    if (name === 'react') return {
      useRef(initial) { const index = hook++; return refs[index] ?? (refs[index] = { current: initial }); },
      useEffect(callback, deps) {
        const index = hook++, old = effects[index];
        if (!old || deps.some((value, i) => !Object.is(value, old.deps[i])) || deps.length !== old.deps.length) {
          old?.cleanup?.(); effects[index] = { callback, deps }; pendingEffects.push(index);
        }
      },
    };
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    throw new Error(`Unexpected module ${name}`);
  },
};
vm.runInNewContext(compile('src/enemy/Anchikushoume.tsx'), scope);
const render = (props) => {
  hook = 0;
  const element = scope.exports.Anchikushoume(props);
  element.props.ref.current = canvas;
  while (pendingEffects.length) { const effect = effects[pendingEffects.shift()]; effect.cleanup = effect.callback(); }
};
const tick = (now) => {
  time = now; operations.length = 0;
  const batch = Array.from(frames.values()); frames.clear();
  batch.forEach(callback => callback(now));
  assert.equal(frames.size, 1, 'exactly one live RAF');
};
const props = { w: 3, h: 3, cell: 40, eye: { x: 0, y: 1 } };
render(props); tick(100);
const animation = refs[2].current;
const originalTentacles = [...animation.tentacles];
const firstTextureTime = animation.textureTime;
tick(200);
const beforeMove = animation.shown;
render({ ...props, eye: { x: 1.375, y: 0 } }); tick(216);
assert.equal(rafCancels, 0, 'eye changes never restart effect');
assert.equal(animation.shown, beforeMove + 0.016);
assert(animation.textureTime > firstTextureTime);
assert.deepEqual(operations.filter(op => op[0] === 'translate').at(-1), ['translate', 270, 160], 'fractional eye consumed with no second interpolation');
const beforeGrowthPhase = animation.tentaclePhase;
render({ ...props, w: 4, h: 4, cell: 50, eye: { x: 1.375, y: 0 } }); tick(232);
assert.equal(rafCancels, 0, 'growth/resize never restart effect');
assert.equal(canvas.width, 350); assert.equal(canvas.height, 350);
originalTentacles.forEach((tentacle, i) => assert.equal(animation.tentacles[i], tentacle));
assert(Math.abs(animation.tentaclePhase - beforeGrowthPhase - 0.016 / (1.12 / 1.25 ** 3)) < 1e-12, 'growth integrates faster phase without jumping');
render({ ...props, hit: true, hitTone: 'thunder' }); tick(248);
assert(operations.some(op => op[0] === 'set' && op[1] === 'fillStyle' && op[2] === '#ffe45c'));
assert(operations.some(op => op[0] === 'scale' && op[1] === 1 && op[2] === 0.2), 'thunder keeps gallery hit squint');
const frozenTexture = animation.textureTime;
tick(420);
assert.equal(animation.textureTime, frozenTexture, 'hit freezes texture phase');
assert(!operations.some(op => op[0] === 'set' && op[1] === 'fillStyle' && op[2] === '#ffe45c'), 'yellow blink has a visible off phase');
render({ ...props, paused: true }); tick(500);
const pausedTime = animation.shown;
tick(1500); assert.equal(operations.length, 0, 'unchanged paused Canvas does not repaint');
render({ ...props, paused: true, eye: { x: 0.5, y: 0 } }); tick(1600);
assert.equal(animation.shown, pausedTime, 'paused prop edits do not advance clocks');
assert.deepEqual(operations.filter(op => op[0] === 'translate').at(-1), ['translate', 200, 160]);
render(props); tick(1616);
assert.equal(animation.shown, pausedTime + 0.016, 'resume excludes paused duration');
scope.document.hidden = true; tick(2616);
scope.document.hidden = false; tick(2632);
assert.equal(animation.shown, pausedTime + 0.032, 'hidden duration excluded');
const beforeSuspension = { shown: animation.shown, texture: animation.textureTime, phase: animation.tentaclePhase };
time = 2700; scope.document.hidden = true; visibilityListeners.forEach(callback => callback());
// No RAF callbacks run at all during the suspended period.
time = 32700; scope.document.hidden = false; visibilityListeners.forEach(callback => callback());
tick(32716);
assert.equal(animation.shown, beforeSuspension.shown + 0.016, 'browser-suspended RAF does not fast-forward body time');
assert.equal(animation.textureTime, beforeSuspension.texture + 0.016, 'texture clock resumes from its last phase');
assert(Math.abs(animation.tentaclePhase - beforeSuspension.phase - 0.016 / (1.12 / 1.25 ** 2)) < 1e-12, 'tentacle phase excludes fully suspended period');
effects.forEach(effect => effect?.cleanup?.());
assert.equal(frames.size, 0, 'unmount cancels RAF');
assert.equal(visibilityListeners.size, 0, 'unmount removes visibility clock listener');
console.log('PASS: 1–4 cell eye paths/targets, no bottom or interior travel, origin-aware growth, shared hit cells, persistent Canvas clocks/phase, fractional eye, thunder/squint, pause/hidden/suspended-RAF/cleanup');
