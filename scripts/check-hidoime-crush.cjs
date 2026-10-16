/**
 * Execute the real App entrance/turn logic in React-hook/virtual-clock VMs.
 * The VM alone replaces rendering with accessors and audio synthesis with call logs.
 * No gameplay, entrance, pause, restart, sound-mode or damage branch is replaced.
 * Actual sample synthesis/source cleanup is covered by tests/hidoime-crush-audio.cjs.
 * Not a browser, listening, CSS-animation or mobile audio-permission test.
 * Run: node scripts/check-hidoime-crush.cjs
 */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const compiled = new Map();
const appSource = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const ast = ts.createSourceFile('App.tsx', appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let crushCalls = 0;
(function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'playHidoimeCrushSound') crushCalls++;
  ts.forEachChild(node, visit);
})(ast);
assert.equal(crushCalls, 1, 'dedicated crush sound has exactly one gameplay call site');

function compile(file) {
  if (compiled.has(file)) return compiled.get(file);
  let source = fs.readFileSync(path.join(root, file), 'utf8')
    .replaceAll('import.meta.env.DEV', 'false').replaceAll('import.meta.env.BASE_URL', "'/'");
  if (file === 'src/App.tsx') {
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const edits = [];
    for (const statement of tree.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const node of statement.declarationList.declarations) {
        const name = node.name.getText(tree);
        if (node.initializer && /^(play.*Sound|playBgm|stopBgm|playFeverBgm|stopFeverBgm)$/.test(name)) {
          edits.push({ start: node.initializer.getStart(tree), end: node.initializer.end,
            text: `(...args) => __record(${JSON.stringify(name)}, args)` });
        }
      }
    }
    const app = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'App');
    const ret = app.body.statements.filter(ts.isReturnStatement).at(-1);
    edits.push({ start: ret.getStart(tree), end: ret.end, text: `return {
      startStage, startEndless, backToTitle, playAgain, togglePause, resume, hardDrop,
      setBoard, setCurrent, setSoundMode, emptyBoard, makeSinglePiece, runHidoimeEntrance,
      read: () => ({ story, status, board, soundMode, pressCells, pressBursts, hidoimeView,
        run: storyRunRef.current, mapStage: mapStageRef.current, wave: waveRef.current,
        swarmSpawned: swarmSpawned.current, allstarPhase: allstarPhase.current,
        hidoimeDefeated: hidoimeDefeated.current })
    };` });
    edits.sort((a, b) => b.start - a.start).forEach(edit => {
      source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
    });
  }
  const output = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  compiled.set(file, output);
  return output;
}

function harness(practice = false) {
  const storage = new Map([
    ['sainome-wall1-progress-v1', JSON.stringify({ cleared: Array.from({ length: 40 }, (_, i) => i + 20), gateReached: true })],
    ['sainome-story-progress', '19'], ['sainome-story-cleared', '19'], ['sainome-reset-story-v1', '1'],
  ]);
  const originalStorage = [...storage];
  let slots = [], cursor = 0, tree, timers = [], now = 0, serial = 0, queued = false, effects = [], App;
  let seed = 0x514d017, lastPress = new Map();
  const audio = [], presses = [], landings = [], entrances = [], seen = new Set();
  const math = Object.create(Math);
  math.random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  const win = {
    location: { hostname: 'localhost', pathname: practice ? '/enemy-practice.html' : '/', search: practice ? '?review=enemy&enemy=hidoime' : '?story=map' },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    innerWidth: 390, innerHeight: 844, parent: { postMessage() {} }, matchMedia: () => ({ matches: true }),
    setTimeout: (fn, ms = 0) => { timers.push({ id: ++serial, at: now + ms, fn }); return serial; },
    clearTimeout: id => { timers = timers.filter(timer => timer.id !== id); },
    setInterval: () => ++serial, clearInterval() {}, addEventListener() {}, removeEventListener() {},
  };
  const classList = { add() {}, remove() {}, toggle() {} };
  const context = vm.createContext({ console, window: win, location: win.location,
    get localStorage() { return win.localStorage; },
    document: { hidden: false, body: { classList }, documentElement: { classList }, addEventListener() {}, removeEventListener() {} },
    navigator: {}, performance: { now: () => now }, URLSearchParams, Math: math, crypto: require('node:crypto').webcrypto,
    Image: class {}, Audio: class { paused = true; load() {} play() { return Promise.resolve(); } pause() {} },
    setTimeout: win.setTimeout, clearTimeout: win.clearTimeout,
    requestAnimationFrame: fn => win.setTimeout(fn, 16), cancelAnimationFrame: win.clearTimeout,
    __record: (name, args) => audio.push({ name, at: now, args: [...args] }),
  });
  const hooks = {
    memo: value => value, useCallback: fn => fn, useMemo: fn => fn(), useLayoutEffect() {},
    useRef(value) { const i = cursor++; return slots[i] ?? (slots[i] = { current: value }); },
    useState(init) {
      const i = cursor++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init;
      return [slots[i], update => {
        const next = typeof update === 'function' ? update(slots[i]) : update;
        if (!Object.is(next, slots[i])) { slots[i] = next; if (App && !queued) {
          queued = true; queueMicrotask(() => { queued = false; render(); });
        } }
      }];
    },
    useEffect(fn, deps) {
      // Keep startup and mute cleanup; browser input, RAF/audio effects are out of scope.
      const i = cursor++;
      if (!/reviewStarted|soundMode === 'none'/.test(fn.toString())) return;
      const previous = slots[i];
      if (previous && deps && previous.deps && deps.every((value, j) => Object.is(value, previous.deps[j]))) return;
      effects.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
    },
  };
  const modules = {};
  function load(file) {
    if (modules[file]) return modules[file].exports;
    const mod = { exports: {} }; modules[file] = mod;
    const requireModule = name => {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
      if (name === './haptics') return { haptics: new Proxy({}, { get: () => () => {} }) };
      if (/characterNames|wall1|objectives|hidoimeFx|Detarame|enemyPracticeConfig|hidoimeCrushAudio|thunder/.test(name)) {
        const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), name));
        const child = ['.ts', '.tsx'].map(ext => base + ext).find(candidate => fs.existsSync(path.join(root, candidate)));
        if (child) return load(child);
      }
      return {};
    };
    vm.runInContext('(function(require,module,exports){' + compile(file) + '\n})', context, { filename: file })(requireModule, mod, mod.exports);
    return mod.exports;
  }
  function render() {
    cursor = 0; effects = []; tree = App();
    const state = tree.read();
    for (const [group, item] of state.hidoimeView) {
      const key = `${state.run}:${group}`;
      if (item.entering && !seen.has(key)) { seen.add(key); entrances.push({ at: now, group, run: state.run }); }
      const phase = `${item.move}:${item.pos.y}`;
      if (lastPress.get(key) !== phase) {
        lastPress.set(key, phase);
        if (item.move === 'press') {
          const row = item.pos.y + 1;
          presses.push({ at: now, group, run: state.run, row, moveMs: item.moveMs, mode: state.soundMode,
            cells: [item.pos.x, item.pos.x + 1].filter(x => state.board[row][x]).map(x => `${x},${row}`),
            visible: [...state.pressCells] });
        }
        if (item.move === 'land') landings.push({ at: now, group, run: state.run });
      }
    }
    const pending = effects; effects = []; pending.forEach(fn => fn());
  }
  async function flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
  async function tick() {
    await flush(); timers.sort((a, b) => a.at - b.at); const timer = timers.shift();
    if (!timer) return false; now = timer.at; timer.fn(); await flush(); return true;
  }
  async function until(test, label, limit = 6000) {
    for (let i = 0; i < limit; i++) {
      await flush(); if (test()) return;
      if (!await tick()) throw Error('No timer: ' + label + ' ' + JSON.stringify(tree.read()));
    }
    throw Error('Timed out: ' + label);
  }
  async function advance(ms) {
    const end = now + ms;
    for (let i = 0; i < 6000; i++) {
      await flush(); timers.sort((a, b) => a.at - b.at);
      if (!timers.length || timers[0].at > end) { now = end; await flush(); return; }
      await tick();
    }
    throw Error('Timer loop');
  }
  const api = { get tree() { return tree; }, get now() { return now; }, audio, presses, landings, entrances,
    flush, tick, until, advance,
    sound: name => audio.filter(event => event.name === name),
    clearLogs() { audio.length = presses.length = landings.length = entrances.length = 0; lastPress = new Map(); },
    async start(stage) { tree.startStage(stage); await flush(); await until(() => tree.read().status === 'playing', 'stage ' + stage); },
    async mode(value) { tree.setSoundMode(value); await flush(); },
    async drop(board, value, x) {
      tree.setBoard(board); tree.setCurrent(tree.makeSinglePiece(++serial, value, x)); await flush(); tree.hardDrop();
      await until(() => ['playing', 'cleared', 'gameover'].includes(tree.read().status), 'legal drop');
    },
    assertRealUnchanged() { assert.deepEqual([...storage], originalStorage, 'practice never changes real saved data'); },
  };
  if (practice) load('src/enemyPracticeConfig.ts').prepareEnemyPracticeStorage(win);
  App = load('src/App.tsx').default; render();
  return api;
}

const CRUSH = 'playHidoimeCrushSound';
function assertSynchronized(h, label) {
  const expected = h.presses.filter(press => press.cells.length && press.mode !== 'none');
  assert.deepEqual(h.sound(CRUSH).map(event => event.at), expected.map(press => press.at), label + ': exactly one sound at each occupied row start');
  for (const press of h.presses) {
    assert.equal(press.moveMs, 136, label + ': visual row duration');
    assert.deepEqual(press.visible, press.cells, label + ': sound coincides with pressed cells');
  }
  assert(h.sound(CRUSH).every(event => event.args.length === 0), label + ': no delayed playback argument');
}
function fill(h, points) {
  const board = h.tree.emptyBoard();
  points.forEach(([x, y, value], i) => board[y][x] = { id: 'fixture-' + i, value, group: 1000 + i });
  return board;
}
async function directEntrance(h, board, options = {}) {
  h.tree.setBoard(board); await h.flush();
  let result, done = false;
  h.tree.runHidoimeEntrance(board, h.tree.read().story, [], { midGame: true, drop: { group: -901, x: 2, floor: 14 }, ...options })
    .then(value => { result = value; done = true; });
  await h.until(() => done, 'fixture entrance');
  return result;
}
function actors(h, ballast = true) {
  const board = h.tree.emptyBoard();
  h.tree.read().board.forEach((row, y) => row.forEach((cell, x) => { if (cell && cell.value < 0) board[y][x] = { ...cell }; }));
  if (ballast) for (let x = 0; x < 7; x++) if (!board[13][x]) board[13][x] = { id: 'ballast-' + x, value: 2, group: 7000 + x };
  return board;
}
async function attack(h, value) {
  const board = actors(h), points = [];
  board.forEach((row, y) => row.forEach((cell, x) => { if (cell?.value === value) points.push({ x, y }); }));
  assert(points.length, 'target exists: ' + value);
  const { x, y } = points[0];
  board[y - 1][x] = { id: 'hit-' + h.now, value: 1, group: 8000 };
  await h.drop(board, 6, x);
}
async function seven(h) {
  const board = actors(h);
  let x = board[12].findIndex(cell => !cell);
  if (x < 0) x = 0;
  const top = board.findIndex(row => row[x]);
  board[top - 1][x] = { id: 'seven-' + h.now, value: 1, group: 8100 };
  await h.drop(board, 6, x);
}

(async () => {
  const precise = harness(); await precise.start(20); precise.clearLogs();
  const board = fill(precise, [[2, 9, 1], [3, 9, 2], [2, 11, 3], [2, 12, 4], [3, 12, 5], [3, 13, 6], [0, 13, 2]]);
  const landed = await directEntrance(precise, board);
  assert.deepEqual(precise.presses.map(press => press.row), [9, 10, 11, 12, 13]);
  assert.deepEqual(precise.presses.map(press => press.cells.length), [2, 0, 1, 2, 1]);
  assert.equal(precise.sound(CRUSH).length, 4, 'two dice in one row still make one sound; empty row is silent');
  for (let i = 1; i < precise.presses.length; i++) assert.equal(precise.presses[i].at - precise.presses[i - 1].at, 136);
  assert.equal(precise.landings[0].at - precise.presses.at(-1).at, 136, 'landing follows final complete press');
  assert.equal(precise.sound('playLockSound').length, 0, 'entrance no longer reuses ordinary lock audio');
  assert.equal(precise.sound('playBombSound').length, 1, 'existing final landing sound remains');
  assert.equal(landed[13][0].value, 2, 'outside columns are unchanged');
  assertSynchronized(precise, 'asymmetric and empty rows');
  console.log('PASS one/two-cell rows, empty gaps, exact 136ms visual/audio synchronization and separate landing');

  // Second drop explicitly preserves the first body and stops on top of it.
  precise.clearLogs();
  landed[9][2] = { id: 'second-crush', value: 4, group: 9000 };
  const stacked = await directEntrance(precise, landed, { drop: { group: -902, x: 2, floor: 12 } });
  assert.equal(precise.sound(CRUSH).length, 1);
  assert.equal(stacked[12][2].group, -901); assert.equal(stacked[10][2].group, -902);
  assertSynchronized(precise, 'stacked enemies');
  console.log('PASS repeated/stacked enemies preserve earlier bodies and sound only occupied new rows');

  for (const stage of [10, 12, 13, 40, 43, 44, 55]) {
    const h = harness(); await h.start(stage);
    assert(h.sound(CRUSH).length > 0, 'initial entrance has crush sound: ' + stage);
    assert.equal(h.entrances.length, 1); assertSynchronized(h, 'initial stage ' + stage);
  }
  console.log('PASS initial entrances: legacy 10/12/13 and map 3-5/3-8/4-1/5-4');

  for (const stage of [14, 48, 19, 59]) {
    const h = harness(); await h.start(stage);
    assert.equal(h.sound(CRUSH).length, 0, 'no crush before Hidoime enters');
    for (let turn = 0; !h.entrances.length; turn++) {
      assert(turn < 24, 'wave/allstar entrance reached: ' + stage);
      const values = h.tree.read().board.flat().filter(Boolean).map(cell => cell.value);
      if (values.includes(-2)) await attack(h, -2);
      else if (values.includes(-1)) await attack(h, -1);
      else await seven(h);
    }
    assert(h.sound(CRUSH).length > 0); assertSynchronized(h, 'mid-game stage ' + stage);
  }
  console.log('PASS real wave and allstar turn transitions: legacy 14/19 and map 4-5/5-8');

  for (const stage of [16, 51]) {
    const h = harness(); await h.start(stage);
    for (let turn = 0; h.entrances.length < 2; turn++) {
      assert(turn < 60, 'multiple swarm entrances reached: ' + stage);
      if (h.tree.read().board.flat().some(cell => cell?.value === -3)) await attack(h, -3);
      else await seven(h);
    }
    assert.equal(new Set(h.entrances.map(event => event.group)).size, 2);
    assert(h.sound(CRUSH).length > 0); assertSynchronized(h, 'swarm stage ' + stage);
  }
  console.log('PASS multiple actual swarm arrivals: legacy 16 and map 4-8');

  const pause = harness(); pause.tree.startStage(55); await pause.until(() => pause.sound(CRUSH).length === 1, 'first crush');
  pause.tree.togglePause(); await pause.flush(); const pausedAt = pause.now, count = pause.sound(CRUSH).length;
  const pausedBoard = JSON.stringify(pause.tree.read().board);
  await pause.advance(5000);
  assert.equal(pause.tree.read().status, 'paused'); assert.equal(pause.sound(CRUSH).length, count);
  assert.equal(JSON.stringify(pause.tree.read().board), pausedBoard);
  pause.tree.resume(); await pause.flush(); await pause.until(() => pause.tree.read().status === 'playing', 'resume');
  assert(pause.sound(CRUSH).at(-1).at >= pausedAt + 5000); assertSynchronized(pause, 'pause/resume');
  console.log('PASS pause freezes future crushes and board progress; resume continues without duplicated rows');

  for (const paused of [false, true]) for (const exit of [false, true]) {
    const h = harness(); h.tree.startStage(55); await h.until(() => h.sound(CRUSH).length === 1, 'interrupt first crush');
    if (paused) { h.tree.togglePause(); await h.flush(); await h.advance(500); }
    const at = h.now;
    if (exit) h.tree.backToTitle(); else h.tree.playAgain();
    await h.flush();
    if (exit) {
      const count = h.sound(CRUSH).length; await h.advance(20000);
      assert.equal(h.sound(CRUSH).length, count); assert.equal(h.tree.read().status, 'ready');
      assert.equal(h.tree.read().board.flat().filter(Boolean).length, 0);
    } else {
      await h.advance(3000); assert.equal(h.sound(CRUSH).filter(event => event.at > at).length, 0, 'old entrance cannot continue during new intro');
      await h.until(() => h.tree.read().status === 'playing', 'restart entrance');
      const count = h.sound(CRUSH).length; await h.advance(20000); assert.equal(h.sound(CRUSH).length, count);
    }
    assertSynchronized(h, `${paused ? 'paused' : 'active'} ${exit ? 'exit' : 'restart'}`);
  }
  console.log('PASS active/paused restart and exit discard every stale entrance continuation');

  const mute = harness(); mute.tree.startStage(55); await mute.until(() => mute.sound(CRUSH).length === 1, 'mute during entrance');
  await mute.mode('none'); await mute.until(() => mute.tree.read().status === 'playing', 'muted entrance completes');
  assert.equal(mute.sound(CRUSH).length, 1); assertSynchronized(mute, 'mute during entrance');
  mute.clearLogs(); await mute.start(55); assert.equal(mute.sound(CRUSH).length, 0); assertSynchronized(mute, 'muted restart');
  await mute.mode('sfx'); mute.clearLogs(); await mute.start(55); assert(mute.sound(CRUSH).length > 0); assertSynchronized(mute, 'sfx-only');
  console.log('PASS mute during entry, muted new entry and SFX-only mode');

  const practice = harness(true); await practice.until(() => practice.tree.read().status === 'playing', 'practice auto-start');
  assert.equal(practice.tree.read().soundMode, 'none'); assert.equal(practice.sound(CRUSH).length, 0);
  assertSynchronized(practice, 'default-muted practice');
  await practice.mode('sfx'); practice.clearLogs(); practice.tree.playAgain(); await practice.flush();
  await practice.until(() => practice.tree.read().status === 'playing', 'practice restart');
  assert(practice.sound(CRUSH).length > 0); assertSynchronized(practice, 'audible practice');
  const afterEntry = practice.sound(CRUSH).length;
  for (let hits = 0; practice.tree.read().hidoimeDefeated === 0; hits++) {
    assert(hits < 8); await attack(practice, -3);
  }
  assert.equal(practice.sound(CRUSH).length, afterEntry, 'hit and defeat do not replay entrance crush');
  assert(practice.sound('playEnemyFlashSound').some(event => event.args[0] === true)); assert(practice.sound('playHidoimeDefeatSound').length > 0);
  practice.assertRealUnchanged();
  console.log('PASS practice defaults, enabled replay, real-save isolation and unchanged hit/defeat audio');

  const ordinary = harness(); ordinary.tree.startEndless(); await ordinary.flush();
  await ordinary.drop(ordinary.tree.emptyBoard(), 1, 0);
  await ordinary.drop(fill(ordinary, [[0, 13, 1]]), 6, 1);
  assert.equal(ordinary.sound(CRUSH).length, 0);
  assert(ordinary.sound('playLockSound').length > 0); assert(ordinary.sound('playClearSound').length > 0);
  console.log('PASS ordinary lock/clear audio remains separate; Hidoime crush is entrance-only');
  console.log('All Hidoime crush gameplay checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
