// Exercise the real App pointer handlers with deterministic hooks/DOM geometry.
// This verifies gesture ownership and cleanup, not a physical touch-screen feel.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compile = source => ts.transpileModule(source, {
  fileName: 'test.tsx',
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const helper = { exports: {} };
vm.runInNewContext(compile(fs.readFileSync('src/thunderTrace.ts', 'utf8')), helper);
const { startThunderTrace, moveThunderTrace } = helper.exports;
const keys = ['1,9', '2,9', '2,10'];
const points = [{ x: 1.5, y: 9.5 }, { x: 2.5, y: 9.5 }, { x: 2.5, y: 10.5 }];
for (const key of [null, '2,9', '2,10', '0,0']) {
  assert.equal(startThunderTrace(1, 'run1', keys, key, points[0]), null);
}
let trace = startThunderTrace(1, 'run1', keys, keys[0], points[0]);
assert.equal(trace.reached, 1);
assert.equal(moveThunderTrace(trace, 'run1', keys[2], points[2]).result, 'cancel', 'cannot skip 2');
assert.equal(moveThunderTrace(trace, 'run2', keys[1], points[1]).result, 'cancel', 'cannot cross runs');
let next = moveThunderTrace(trace, 'run1', keys[1], points[1]);
assert.equal(next.tone, 1); assert.equal(next.trace.reached, 2);
assert.equal(moveThunderTrace(next.trace, 'run1', keys[0], points[0]).result, 'cancel', 'cannot backtrack');
assert.equal(moveThunderTrace(next.trace, 'run1', null, points[0]).result, 'cancel', 'board exit cancels');
assert.equal(moveThunderTrace(next.trace, 'run1', keys[2], points[2]).result, 'complete');
assert.equal(moveThunderTrace(next.trace, 'run1', keys[2], points[2]).tone, 2);
for (let i = 0; i < 1000; i++) {
  trace = moveThunderTrace(trace, 'run1', keys[0], { x: 1.2 + (i % 2) * 0.4, y: 9.5 }).trace;
}
assert(trace.points.length <= 160, 'trail work stays bounded');

const app = fs.readFileSync('src/App.tsx', 'utf8');
const start = app.indexOf('  // イチニノサンダー：1→2→3の順');
const end = app.indexOf('  const lastTap', start);
assert(start >= 0 && end > start, 'the tested code must be the real pointer-handler block');
const handlers = app.slice(start, end);

function game() {
  let slots = [], cursor = 0, effects = [], dirty = false, time = 100;
  const captures = new Set();
  const output = { tones: [], fired: 0, moves: [], drops: 0, edges: [], rotations: [] };
  const board = {
    querySelector: () => ({ getBoundingClientRect: () => ({ left: 10, top: 20, width: 40, height: 40 }) }),
    hasPointerCapture: id => captures.has(id),
    setPointerCapture: id => captures.add(id),
    releasePointerCapture: id => captures.delete(id),
  };
  const effect = (fn, deps) => {
    const i = cursor++, prior = slots[i];
    if (!prior || deps.some((value, at) => value !== prior.deps[at])) {
      effects.push(() => { prior?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
    }
  };
  const context = {
    ...helper.exports, COLS: 7, ROWS: 14,
    status: 'playing', statusNow: { current: 'playing' },
    storyRunRef: { current: 1 },
    thunderSetRef: { current: [{ x: 1, y: 9 }, { x: 2, y: 9 }, { x: 2, y: 10 }] },
    boardNow: { current: Array.from({ length: 14 }, (_, y) => Array.from({ length: 7 }, (_, x) => ({ id: `${x}-${y}` }))) },
    boardRef: { current: board }, touchState: { current: null }, currentIdRef: { current: 9 },
    soundModeRef: { current: 'all' }, fireThunderRef: { current: () => { output.fired++; } },
    triggerLate: { current: 0 }, performance: { now: () => time },
    AXIS_LOCK_PX: 8, TAP_MAX_MOVE_PX: 12, TAP_MAX_MS: 250, FLICK_MAX_MS: 220, FLICK_MIN_PX: 28,
    useRef: initial => { const i = cursor++; return slots[i] ?? (slots[i] = { current: initial }); },
    useState: initial => {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { slots[i] = value; dirty = true; }];
    },
    useCallback: fn => fn, useEffect: effect, useLayoutEffect: effect,
    playThunderTraceSound: tone => output.tones.push(tone),
    stepSize: () => 40, canDrop: id => id === context.currentIdRef.current,
    move: (x, y) => output.moves.push([x, y]), hardDrop: () => output.drops++,
    moveToEdge: dir => output.edges.push(dir), rotate: dir => output.rotations.push(dir),
    pieceCenterX: () => 150,
  };
  vm.createContext(context);
  vm.runInContext(compile(`function renderHandlers() { ${handlers}
    return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel,
      getTrace: () => thunderTrace.current, trail: thunderTrail };
  }`), context);
  let view;
  const render = () => {
    do {
      dirty = false; cursor = 0; effects = [];
      view = context.renderHandlers(); effects.forEach(fn => fn());
    } while (dirty);
    return view;
  };
  render();
  const send = (type, point = points[0], extra = {}) => {
    time += 15;
    const event = { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0,
      clientX: 10 + point.x * 40, clientY: 20 + point.y * 40,
      currentTarget: board, timeStamp: time, ...extra };
    view[type](event); render();
  };
  const noControls = () => {
    assert.equal(output.moves.length + output.drops + output.edges.length + output.rotations.length, 0);
  };
  const complete = () => { send('onPointerDown'); send('onPointerMove', points[1]); send('onPointerMove', points[2]); };
  return { context, output, captures, render, send, noControls, complete, read: () => view };
}

// Releasing on 2 clears both progress and the white trail; tapping 3 later cannot finish it.
let g = game();
g.send('onPointerDown'); g.send('onPointerMove', points[1]);
assert.equal(g.read().getTrace().reached, 2); assert(g.read().trail.length >= 2);
g.send('onPointerUp', points[1]);
assert.equal(g.read().getTrace(), null); assert.equal(g.read().trail.length, 0);
assert.equal(g.captures.size, 0); g.noControls();
g.send('onPointerMove', points[2]); assert.equal(g.output.fired, 0);
g.complete(); assert.equal(g.output.fired, 1); g.noControls();
assert.deepEqual(g.output.tones, [0, 1, 0, 1, 2]);
assert.equal(g.read().trail.length, 0);

// Bare tap on 1 and pointer-up on 3 without a move neither rotate nor commit a trace.
for (const releaseAt of [points[0], points[2]]) {
  g = game(); g.send('onPointerDown'); g.send('onPointerUp', releaseAt);
  assert.equal(g.output.fired, 0); g.noControls(); assert.equal(g.read().trail.length, 0);
}

// Cancellation and lost capture share a non-committing handler, including duplicate cleanup.
assert(app.includes('onPointerCancel={onPointerCancel}') && app.includes('onLostPointerCapture={onPointerCancel}'));
for (const progressed of [false, true]) {
  g = game(); g.send('onPointerDown'); if (progressed) g.send('onPointerMove', points[1]);
  g.send('onPointerCancel', points[1]); g.send('onPointerCancel', points[1]);
  g.send('onPointerUp', points[1]);
  assert.equal(g.read().trail.length, 0); assert.equal(g.read().getTrace(), null); g.noControls();
  g.complete(); assert.equal(g.output.fired, 1);
}

// Out-of-order, reverse, and backtracking attempts never produce three ascending tones/strikes.
for (const order of [[0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 1, 0], [2, 0, 1], [0, 1, 0, 2]]) {
  g = game(); g.send('onPointerDown', points[order[0]]);
  order.slice(1).forEach(i => g.send('onPointerMove', points[i]));
  g.send('onPointerCancel', points[order.at(-1)]);
  assert.equal(g.output.fired, 0, `order ${order} must not fire`);
  assert.equal(g.read().trail.length, 0);
  if (order[0] === 0) g.noControls();
}

// Leaving the route rebases normal controls instead of applying the trace's large movement.
g = game(); g.send('onPointerDown'); g.send('onPointerMove', { x: 4.5, y: 9.5 });
g.noControls(); assert.equal(g.read().trail.length, 0);
g.send('onPointerUp', { x: 4.5, y: 9.5 }); g.noControls();
g = game(); g.send('onPointerDown'); g.send('onPointerMove', { x: 4.5, y: 9.5 });
g.send('onPointerMove', { x: 5.5, y: 9.5 }); assert.deepEqual(g.output.moves, [[1, 0]]);
g.send('onPointerCancel'); assert.equal(g.output.edges.length + g.output.drops + g.output.rotations.length, 0);
g = game(); g.send('onPointerDown'); g.send('onPointerMove', { x: -1, y: 9.5 });
g.send('onPointerUp', { x: -1, y: 9.5 }); g.noControls(); assert.equal(g.read().trail.length, 0);

// Another pointer cannot reset, progress, or complete an owned trace.
g = game(); g.send('onPointerDown');
g.send('onPointerDown', points[0], { pointerId: 2, isPrimary: false });
g.send('onPointerMove', points[1], { pointerId: 2 }); g.send('onPointerCancel', points[1], { pointerId: 2 });
assert.equal(g.read().getTrace().reached, 1); assert.equal(g.read().getTrace().id, 1);
g.send('onPointerMove', points[1]); g.send('onPointerMove', points[2]); assert.equal(g.output.fired, 1);

// Pause/status exit, restart/run replacement, and target-die replacement invalidate stale progress.
for (const invalidate of [
  h => { h.context.status = 'paused'; h.context.statusNow.current = 'paused'; },
  h => { h.context.status = 'gameover'; h.context.statusNow.current = 'gameover'; },
  h => { h.context.storyRunRef.current++; },
  h => { h.context.boardNow.current[9][1] = { id: 'replacement' }; },
  h => { h.context.thunderSetRef.current = null; },
]) {
  g = game(); g.send('onPointerDown'); g.send('onPointerMove', points[1]); invalidate(g); g.render();
  assert.equal(g.read().getTrace(), null); assert.equal(g.read().trail.length, 0); assert.equal(g.captures.size, 0);
  g.send('onPointerMove', points[2]); g.send('onPointerUp', points[2]); g.noControls(); assert.equal(g.output.fired, 0);
  g.context.status = 'playing'; g.context.statusNow.current = 'playing';
  g.context.thunderSetRef.current = [{ x: 1, y: 9 }, { x: 2, y: 9 }, { x: 2, y: 10 }]; g.render();
  g.complete(); assert.equal(g.output.fired, 1);
}

// Normal controls still work, but cancellation never synthesizes a normal tap/flick.
g = game(); g.send('onPointerDown', { x: 5, y: 5 }); g.send('onPointerUp', { x: 5, y: 5 });
assert.deepEqual(g.output.rotations, ['cw']);
g = game(); g.send('onPointerDown', { x: 5, y: 5 }); g.send('onPointerCancel', { x: 5, y: 5 });
g.send('onPointerUp', { x: 5, y: 5 }); g.noControls();
g = game(); g.send('onPointerDown', points[0], { pointerType: 'mouse' });
g.send('onPointerMove', points[1], { pointerType: 'mouse' });
g.send('onPointerMove', points[2], { pointerType: 'mouse' }); assert.equal(g.output.fired, 1);

// 2026-10-14 イチニノサンダー：「サンダー！」は一気に出し、「！」は稲妻の絵（svg）
const chantMatch = app.match(/\{(thunderCall \? \([\s\S]*?\n\s*\) : null)\}/);
assert(chantMatch);
const jsx = (type, props, key) => ({ type, props, key });
const chantScope = { exports: {}, require: () => ({ jsx, jsxs: jsx, Fragment: 'fragment' }) };
vm.runInNewContext(compile(`function chant(thunderCall: string | null) { return (${chantMatch[1]}); }`), chantScope);
const nino = chantScope.chant('ニノ'), thunder = chantScope.chant('サンダー！');
assert.equal(nino.props.children, 'ニノ');
assert(thunder.props.className.includes('is-thunder'));
assert.equal(thunder.props.children[0], 'サンダー');
assert.equal(thunder.props.children[1].type, 'svg');
assert(app.includes('const THUNDER_TAME_MS = 300;'));
assert(app.includes('const THUNDER_CALL_MS = 320;'));
assert(app.includes("setThunderCall(langRef.current === 'ja' ? 'サンダー！' : 'THUNDER!')"));
const css = fs.readFileSync('src/thunderTrace.css', 'utf8');
assert(/\.thunder-pointer-trail\s*\{[^}]*z-index:\s*42;[^}]*pointer-events:\s*none/s.test(css));
assert(/\.thunder-trail-white\s*\{[^}]*stroke:\s*#fff;/s.test(css));
assert(!css.includes('filter:'), 'no blur/filter work is needed for the white trail');
console.log('Thunder trace: ordered gestures, partial release, cancellation, retry, control handoff, lifecycle, and joined chant passed.');
