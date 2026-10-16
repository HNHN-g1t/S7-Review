/**
 * Review-only enemy practice regression checks, adapted from check-campaign-engine.cjs.
 * Runs the real App resolver in independent React-hook/virtual-clock VMs.
 * Fixtures arrange legal clears; enemy damage, turns, goals and saving are not mocked.
 * This is not a browser, iframe teardown, input-device, visual or balance test.
 * Run: node scripts/check-enemy-practice.cjs
 */
const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const compile = source => ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const POWERS = ['spa1', 'sla3', 'squ4', 'str6', 'nico', 'fever', 'thunder'];
const realSeed = () => new Map([
  ['seven-dice-best-scores', '[98765,54321]'],
  ['sainome-story-progress', '19'],
  ['sainome-story-cleared', '12'],
  ['sainome-rainbow-stock', '3'],
  ['sainome-rainbow-progress', '44'],
  ['sainome-cleared-total', '12345'],
  ['sainome-total-score', '99999'],
  ['sainome-wall1-progress-v1', '{"cleared":[20,21],"gateReached":false}'],
  ['unrelated-user-setting', 'keep'],
  // Deliberately omit sainome-reset-story-v1: App initialization must not migrate real data.
]);
function storageFor(values) {
  return { get length() { return values.size; }, key: i => [...values.keys()][i] ?? null,
    getItem: key => values.get(String(key)) ?? null,
    setItem: (key, value) => values.set(String(key), String(value)),
    removeItem: key => values.delete(String(key)), clear: () => values.clear() };
}
function harness(enemy = 'koitsume', options = {}) {
  const real = realSeed(), initial = [...real], originalStorage = storageFor(real);
  let slots = [], cursor = 0, tree, timers = [], now = 0, serial = 0, queued = false;
  const listeners = new Map();
  const intervals = new Set();
  // Optional spies leave the real damage resolver and React state transitions intact.
  // Audio synthesis itself is exercised separately by the Web Audio graph tests.
  const audio = [], damageFlashes = [];
  let previousDamageHit;
  let ready = false, effects = [], seenRainbow = false, seenAward = false, App;
  let randomSeed = 0x51a1cafe;
  const math = Object.create(Math);
  math.random = () => { randomSeed ^= randomSeed << 13; randomSeed ^= randomSeed >>> 17; randomSeed ^= randomSeed << 5; return (randomSeed >>> 0) / 4294967296; };
  const win = {
    location: { hostname: 'localhost', pathname: '/enemy-practice.html', search: '?review=enemy&enemy=' + enemy, ...options.location },
    localStorage: originalStorage, innerWidth: 390, innerHeight: 844,
    parent: { postMessage: () => {} },
    matchMedia: () => ({ matches: true }),
    setTimeout: (fn, ms = 0) => { timers.push({ id: ++serial, at: now + ms, fn }); return serial; },
    clearTimeout: id => { timers = timers.filter(t => t.id !== id); },
    setInterval: (fn, ms = 1) => {
      const id = ++serial;
      if (!options.effects) return id;
      intervals.add(id);
      const run = () => { if (!intervals.has(id)) return; fn(); if (intervals.has(id)) timers.push({ id, at: now + ms, fn: run }); };
      timers.push({ id, at: now + ms, fn: run }); return id;
    },
    clearInterval: id => { intervals.delete(id); timers = timers.filter(t => t.id !== id); },
    addEventListener: (name, fn) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener: (name, fn) => listeners.get(name)?.delete(fn),
  };
  if (options.lockStorage) Object.defineProperty(win, 'localStorage', { value: originalStorage, configurable: false, writable: false });
  const classList = { toggle: () => {}, remove: () => {}, add: () => {} };
  const sandbox = vm.createContext({ console, window: win, location: win.location,
    get localStorage() { return win.localStorage; },
    document: { body: { classList }, documentElement: { classList }, hidden: false },
    navigator: {}, performance: { now: () => now }, URLSearchParams,
    Image: class {}, Audio: class { paused = true; load() {} play() { return Promise.resolve(); } pause() {} },
    setTimeout: win.setTimeout, clearTimeout: win.clearTimeout,
    requestAnimationFrame: fn => win.setTimeout(fn, 16), cancelAnimationFrame: win.clearTimeout,
    crypto: require('crypto').webcrypto, Math: math,
    __recordSound: (name, args) => audio.push({ name, at: now, args: [...args] }),
  });
  const hook = {
    memo: value => value, useCallback: fn => fn, useMemo: fn => fn(), useLayoutEffect: () => {},
    useRef: value => { const i = cursor++; return slots[i] ?? (slots[i] = { current: value }); },
    useState: init => { const i = cursor++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init;
      return [slots[i], update => { const next = typeof update === 'function' ? update(slots[i]) : update;
        if (!Object.is(next, slots[i])) { slots[i] = next; if (ready && !queued) {
          queued = true; queueMicrotask(() => { queued = false; render(); });
        } }
      }]; },
    useEffect: (fn, deps) => {
      // Run only startup and the two real FEVER ignition effects. Browser/audio/input effects
      // remain outside this harness, as in the campaign engine tests.
      const source = fn.toString();
      if (!/reviewStarted|practiceStarted|const onKeyDown|feverActive \|\| feverIgniting \|\| fever < 100|if \(!feverIgniting\)/.test(source) && !(options.effects && /if \(!anchiAlive(?: \|\| sanzMode)?\)|if \(!paintsActive\)/.test(source))) return;
      const i = cursor++, previous = slots[i];
      if (previous && deps && previous.deps && deps.every((value, index) => Object.is(value, previous.deps[index]))) return;
      effects.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
    },
  };
  const modules = {};
  function load(file) {
    if (modules[file]) return modules[file].exports;
    const mod = { exports: {} }; modules[file] = mod;
    let source = fs.readFileSync(path.join(root, file), 'utf8')
      .replaceAll('import.meta.env.DEV', 'false').replaceAll('import.meta.env.BASE_URL', "'/'");
    if (file === 'src/App.tsx') {
      if (options.audio) {
        const soundAst = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        const edits = [];
        for (const statement of soundAst.statements) if (ts.isVariableStatement(statement)) {
          for (const declaration of statement.declarationList.declarations) {
            const name = declaration.name.getText(soundAst);
            if (declaration.initializer && /^(play.*Sound|playBgm|stopBgm|playFeverBgm|stopFeverBgm)$/.test(name)) {
              edits.push({ start: declaration.initializer.getStart(soundAst), end: declaration.initializer.end,
                text: `(...args) => __recordSound(${JSON.stringify(name)}, args)` });
            }
          }
        }
        edits.sort((a, b) => b.start - a.start).forEach(edit => {
          source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
        });
      }
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const app = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'App');
      const ret = app.body.statements.filter(ts.isReturnStatement).at(-1);
      source = source.slice(0, ret.getStart(ast)) + `return {
        startStage, setWallProgress, backToTitle, playAgain, togglePause, resume, hardDrop, setBoard, setCurrent, fireThunder,
        updateAnchi, updatePaints, growAnchi, landSanzShot, throwAnchiPaint, anchiEyeIn, setStatus, setSoundMode, soundModeRef, updateDetarameById, resetGame, storyRunRef,
        setFever, setScore, setRainbowStock, rainbowStockRef, totalScoreRef,
        emptyBoard, makeSinglePiece, hidoimeHp, hidoimeDefeated, berabouHp,
        berabouDefeated, detaramesRef, detarameDefeated, rainbowAnswer, resetProgress, changeLang,
        read:()=>({story,status,board,score,current,stageIntro,saika,fever,feverActive,feverIgniting,
          soundMode,powers:mapPowers(),missionNow,missionGoal,demo:demoLock.current,
          thunderOpen,thunderSet,thunderCall,thunderBolt,anchi:anchiRef.current,anchiDefeated:anchiDefeated.current,anchiPaints,absorbCells,
          sanzElapsed,sanzShots,campaignGeneratedEnemies:campaignGeneratedEnemies.current,anchiHit,anchiHitTone,anchiFlash,detarames:detaramesRef.current,detarameHit,
          hidoimeDefeated:hidoimeDefeated.current,berabouHp:berabouHp.current,
          detarame:detaramesRef.current[0]??null,rainbowAsk,rainbowAward,rainbowStock,
          gameoverHint,progress:wallProgressRef.current,
          nicoAllowed:nicoOpenIn(storyRef.current,mapPowers()),
          feverAllowed:feverOpenIn(storyRef.current,mapPowers()),
          bombAllowed:['spa1','sla3','squ4','str6'].filter(kind=>storyAllows(storyRef.current??0,kind,mapPowers())),
          nicoRate:storyNicoRate})};` + source.slice(ret.end);
    }
    const resolver = name => {
      if (name === 'react') return hook;
      if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
      if (name === './haptics') return { haptics: new Proxy({}, { get: () => () => {} }) };
      if (/characterNames|wall1|objectives|hidoimeFx|Detarame|enemyPracticeConfig|hidoimeCrushAudio|thunder|anchiEye/.test(name)) {
        const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), name));
        const resolved = ['.ts', '.tsx'].map(ext => base + ext).find(candidate => fs.existsSync(path.join(root, candidate)));
        if (resolved) return load(resolved);
      }
      return {};
    };
    vm.runInContext('(function(require,module,exports){' + compile(source) + '\n})', sandbox, { filename: file })(resolver, mod, mod.exports);
    return mod.exports;
  }
  function render() {
    cursor = 0; effects = []; tree = App();
    if (options.audio && previousDamageHit !== tree.read().detarameHit) {
      previousDamageHit = tree.read().detarameHit;
      damageFlashes.push({ at: now, hits: Array.from(previousDamageHit, ([id, segments]) => [id, Array.from(segments)]) });
    }
    seenRainbow ||= tree.read().rainbowAsk;
    seenAward ||= tree.read().rainbowAward > 0;
    const pending = effects; effects = []; pending.forEach(fn => fn());
  }
  async function flush() { for (let i = 0; i < 6; i++) await Promise.resolve(); }
  async function tick(lateBy = 0) {
    await flush(); timers.sort((a, b) => a.at - b.at); const timer = timers.shift();
    if (!timer) return false; now = timer.at + lateBy; timer.fn(); await flush(); return true;
  }
  async function until(test, label, limit = 5000) {
    for (let i = 0; i < limit; i++) {
      await flush(); if (test()) return;
      if (!await tick()) { await flush(); if (test()) return; throw Error('No timer: ' + label + ' ' + JSON.stringify(tree?.read())); }
    }
    throw Error('Timed out: ' + label);
  }
  const config = load('src/enemyPracticeConfig.ts');
  return {
    win, real, originalStorage, config, sandbox, get tree() { return tree; },
    audio, damageFlashes,
    get seenRainbow() { return seenRainbow; }, get seenAward() { return seenAward; },
    load, flush, tick, until,
    get now() { return now; },
    async advance(ms) {
      const target = now + ms;
      for (let checks = 0; checks < 100000; checks++) {
        await flush(); timers.sort((a, b) => a.at - b.at);
        if (!timers.length || timers[0].at > target) { now = target; await flush(); return; }
        await tick();
      }
      throw Error('Too many timers in requested clock window');
    },
    key: key => { for (const fn of [...(listeners.get('keydown') ?? [])]) fn({ key, timeStamp: now, repeat: false, preventDefault() {} }); },
    assertRealUnchanged: () => assert.deepEqual([...real], initial, 'real browser save data is untouched'),
    boot: async () => {
      assert.equal(config.getEnemyPractice(), null, 'URL alone does not enable practice');
      const selected = options.campaign ? null : config.prepareEnemyPracticeStorage(win);
      if (!options.campaign) {
        assert.notEqual(win.localStorage, originalStorage);
        assert.equal(win.localStorage.length, 0, 'practice starts from an empty store');
      }
      App = load('src/App.tsx').default; ready = true; render(); await flush();
      return selected;
    },
    drop: async (board, value, x) => {
      tree.setBoard(board); tree.setCurrent(tree.makeSinglePiece(++serial, value, x));
      await flush(); tree.hardDrop();
      await until(() => ['playing', 'cleared', 'gameover'].includes(tree.read().status), 'legal fixture drop');
      return tree.read();
    },
    drain: async () => { for (let i = 0; i < 1000 && await tick(); i++) {} },
  };
}
function boardFixture(h, points) {
  const board = h.tree.emptyBoard();
  points.forEach(([x, y, value], i) => board[y][x] = { id: 'fixture-' + i, value, group: 1000 + i });
  return board;
}
function actors(h) {
  const board = h.tree.emptyBoard(); h.tree.read().board.forEach((row, y) => row.forEach((cell, x) => {
    if (cell && cell.value < 0) board[y][x] = { ...cell };
  })); return board;
}
async function attack(h, value, special = false) {
  const board = actors(h), points = [];
  board.forEach((row, y) => row.forEach((cell, x) => { if (cell?.value === value) points.push({ x, y }); }));
  assert(points.length, 'target enemy exists: ' + value);
  // 2026-10-13：噴火で出た敵は盤面に残るようになったので、上に打つ場所がある敵を選ぶ
  const { x, y } = points.find(point => point.y >= 2 && point.x <= 4) ?? points.find(point => point.y >= 2) ?? points[0];
  if (special) {
    for (const [cx, cy] of [[x, y - 1], [x + 1, y - 1], [x + 2, y - 1], [x, y - 2]]) {
      board[cy][cx] = { id: `strike-${cx}-${cy}`, value: 1, group: 5000 + cx + cy * 7 };
    }
    return h.drop(board, 1, x + 1);
  }
  board[y - 1][x] = { id: 'normal-hit', value: 1, group: 6000 };
  return h.drop(board, 6, x);
}
const bombs = {
  spa1: [[[0, 13, 1], [1, 13, 1], [2, 13, 1], [3, 13, 1]], 1, 4],
  sla3: [[[0, 13, 3], [1, 13, 2], [1, 12, 3], [2, 13, 2], [2, 12, 2]], 3, 2],
  squ4: [[[1, 13, 4], [2, 13, 4], [1, 12, 4]], 4, 2],
  str6: [[[0, 13, 6], [1, 13, 6], [2, 13, 6]], 6, 3],
  nico: [[[0, 13, 0]], 0, 1],
};

// Traverse the actual Gallery JSX tree. Native DOM layout and browser reconciliation
// are deliberately not simulated; iframe key and conditional-tree contracts are asserted.
function galleryHarness(componentName = 'Gallery', props = {}) {
  let slots = [], cursor = 0, tree, pending = [], queued = false, Gallery;
  const listeners = new Set(), refs = [], frames = new Map();
  let frameSerial = 0, now = 0, currentProps = props;
  const document = { hidden: false, body: { classList: { add() {}, remove() {} } } };
  const parent = {}, origin = 'http://localhost:5173';
  const hooks = {
    StrictMode: 'StrictMode',
    useState(init) {
      const i = cursor++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init;
      return [slots[i], update => { const value = typeof update === 'function' ? update(slots[i]) : update;
        if (!Object.is(value, slots[i])) { slots[i] = value; if (!queued) {
          queued = true; queueMicrotask(() => { queued = false; render(); });
        } }
      }];
    },
    useRef(value) { const i = cursor++; if (!(i in slots)) { slots[i] = { current: value }; refs.push(slots[i]); } return slots[i]; },
    useEffect(fn, deps) {
      const i = cursor++, previous = slots[i];
      if (previous && deps && previous.deps && deps.every((value, index) => Object.is(value, previous.deps[index]))) return;
      pending.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
    },
  };
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const config = harness().config;
  const source = fs.readFileSync(path.join(root, 'src/enemy/enemyGallery.tsx'), 'utf8');
  const isolated = source.slice(0, source.indexOf('\nconst style =')) + '\nmodule.exports = { Gallery, AnchiPreview, PaintFlightPreview };';
  const mod = { exports: {} };
  vm.runInNewContext(compile(isolated), {
    module: mod, exports: mod.exports, console, location: { origin },
    performance: { now: () => now }, requestAnimationFrame: fn => { frames.set(++frameSerial, fn); return frameSerial; },
    cancelAnimationFrame: id => frames.delete(id),
    window: { parent, addEventListener: (name, fn) => { if (name === 'message') listeners.add(fn); },
      removeEventListener: (name, fn) => { if (name === 'message') listeners.delete(fn); },
      setInterval: () => 1, clearInterval: () => {} },
    document,
    require: name => name === 'react' ? hooks : name === 'react/jsx-runtime' ? { jsx, jsxs: jsx } :
      name === '../enemyPracticeConfig' ? config : name === './characterNames' ? {
        SAI_NAMES: ['ピンノメ', 'フタツメ', 'ミツメ', 'ヨツメ', 'ゴモク', 'ムツメ'], CHARACTER_RESERVATIONS: [],
      } : name === './anchiEye' ? harness().load('src/enemy/anchiEye.ts') : name === './Anchikushoume' ? { PAINT_SHAPE_SIZES: [], Anchikushoume: 'Anchikushoume', PaintSample: 'PaintSample' } : name === '../soundChannels' ? { SOUND_CHANNELS: [] } : {},
  }, { filename: 'gallery-hook-harness.tsx' });
  Gallery = mod.exports[componentName];
  function render() { cursor = 0; pending = []; tree = Gallery(currentProps); const effects = pending; pending = []; effects.forEach(fn => fn()); }
  function nodes(type) {
    const found = [];
    function visit(node) {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!node || typeof node !== 'object') return;
      if (node.type === type) found.push(node);
      visit(node.props?.children);
    }
    visit(tree); return found;
  }
  async function flush() { for (let i = 0; i < 6; i++) await Promise.resolve(); }
  render();
  return { origin, parent, config, nodes, flush, document,
    async advance(ms) {
      for (let passed = 0; passed < ms;) {
        const delta = Math.min(16, ms - passed); passed += delta; now += delta;
        const pendingFrames = [...frames.values()]; frames.clear(); pendingFrames.forEach(fn => fn(now)); await flush();
      }
    },
    async updateProps(next) { currentProps = { ...currentProps, ...next }; render(); await flush(); },
    get frameCount() { return frames.size; },
    bindFrame(source) { const frame = nodes('iframe')[0]; assert(frame); frame.props.ref.current = { contentWindow: source }; },
    send(data, source, messageOrigin = origin) { for (const fn of [...listeners]) fn({ origin: messageOrigin, source, data }); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); for (const ref of refs) ref.current = null; },
    get listenerCount() { return listeners.size; },
  };
}
async function checkGallery() {
  const g = galleryHarness(); await g.flush();
  const buttons = () => g.nodes('button');
  const openers = () => buttons().filter(node => node.props.className === 'gallery-practice-button');
  const byText = text => buttons().find(node => node.props.children === text);
  assert.equal(openers().length, 8, 'gallery offers every implemented enemy');
  assert.equal(g.nodes('iframe').length, 0, 'practice is initially closed');
  assert.equal(g.listenerCount, 1);
  for (const [enemy, config] of Object.entries(g.config.PRACTICE_ENEMIES)) {
    const button = openers().find(node => node.props['aria-label'] === config.name + 'と模擬戦');
    assert(button, 'named opener: ' + enemy); button.props.onClick(); await g.flush();
    const frame = g.nodes('iframe')[0]; assert(frame);
    assert.equal(frame.props.src, '/enemy-practice.html?enemy=' + enemy);
    assert.equal(frame.props.title, config.name + 'との模擬戦');
    assert.equal(g.nodes('section').filter(node => node.props.role === 'dialog').length, 1);
    const beforeKey = frame.key;
    byText('再戦').props.onClick(); await g.flush();
    assert.notEqual(g.nodes('iframe')[0].key, beforeKey, 'replay forces a fresh iframe key');
    byText('図鑑にもどる').props.onClick(); await g.flush();
    assert.equal(g.nodes('iframe').length, 0, 'close removes iframe from render tree');
  }
  openers()[0].props.onClick(); await g.flush();
  let beforeKey = g.nodes('iframe')[0].key;
  const select = g.nodes('select').find(node => node.props['aria-label'] === '模擬戦の相手');
  assert.equal(g.nodes('option').length, 8);
  select.props.onChange({ target: { value: 'anchikushoume' } }); await g.flush();
  assert.notEqual(g.nodes('iframe')[0].key, beforeKey, 'enemy switch changes iframe key');
  assert.equal(g.nodes('iframe')[0].props.src, '/enemy-practice.html?enemy=anchikushoume');
  const currentFrame = {}, stranger = {};
  g.bindFrame(currentFrame);
  for (const [data, sender, messageOrigin] of [
    [{ type: 'sainome-practice-exit' }, currentFrame, 'https://untrusted.example'],
    [{ type: 'sainome-practice-exit' }, stranger, g.origin],
    [{ type: 'sainome-review-visible', visible: false }, stranger, g.origin],
    [{ type: 'sainome-review-visible', visible: false }, g.parent, 'https://untrusted.example'],
    [{ type: 'sainome-review-visible', visible: true }, g.parent, g.origin],
    [{ type: 'unrelated' }, currentFrame, g.origin],
  ]) {
    g.send(data, sender, messageOrigin); await g.flush();
    assert.equal(g.nodes('iframe').length, 1, 'untrusted/unrelated messages cannot close practice');
  }
  g.send({ type: 'sainome-practice-exit' }, currentFrame); await g.flush();
  assert.equal(g.nodes('iframe').length, 0, 'verified practice exit closes the iframe');
  openers()[0].props.onClick(); await g.flush(); g.bindFrame({});
  g.send({ type: 'sainome-review-visible', visible: false }, g.parent); await g.flush();
  assert.equal(g.nodes('iframe').length, 0, 'review tab hiding closes practice');
  g.unmount(); assert.equal(g.listenerCount, 0, 'Gallery unmount removes message listener');
  console.log('PASS Gallery JSX: six launch buttons, replay/selection keys, close, verified messages and listener cleanup');
}
async function checkPreviews() {
  for (const size of [1, 2, 3, 4]) {
    const g = galleryHarness('AnchiPreview', { size, cell: 48, paused: false, hit: true });
    const actor = () => g.nodes('Anchikushoume')[0].props;
    const positions = new Set();
    for (let step = 0; step < 400; step++) {
      await g.advance(32);
      const { x, y } = actor().eye;
      positions.add(`${x.toFixed(3)},${y.toFixed(3)}`);
      assert(x >= 0 && x <= size - 1 && y >= 0 && y <= Math.max(0, size - 2));
      assert(y === 0 || x === 0 || x === size - 1, 'eye stays on open upper/side path');
    }
    assert.equal(actor().hitTone, 'thunder');
    assert.equal(actor().hit, true);
    assert.equal(size === 1 ? positions.size === 1 : positions.size > 10, true, 'continuous motion for multi-cell previews');
    const before = JSON.stringify(actor().eye);
    await g.updateProps({ paused: true }); await g.advance(2500);
    assert.equal(JSON.stringify(actor().eye), before, 'pause preserves exact sampled eye position');
    await g.updateProps({ paused: false });
    g.document.hidden = true; await g.advance(2500);
    assert.equal(JSON.stringify(actor().eye), before, 'hidden document freezes eye');
    g.unmount(); assert.equal(g.frameCount, 0, 'eye preview RAF cleanup');
  }
  const paint = galleryHarness('PaintFlightPreview', { cell: 36, paused: false });
  const phase = () => paint.nodes('div').find(node => node.props.className?.startsWith('anchi-paint'))?.props.className ?? 'hidden';
  assert.equal(phase(), 'anchi-paint is-flying');
  await paint.advance(320); assert.equal(phase(), 'anchi-paint is-spreading');
  await paint.advance(260); assert.equal(phase(), 'anchi-paint is-resting');
  await paint.updateProps({ paused: true }); await paint.advance(5000);
  assert.equal(phase(), 'anchi-paint is-resting', 'pause freezes paint lifetime');
  await paint.updateProps({ paused: false }); await paint.advance(3340);
  assert.equal(phase(), 'anchi-paint is-fading');
  await paint.advance(420); assert.equal(phase(), 'hidden');
  await paint.advance(700); assert.equal(phase(), 'anchi-paint is-flying', 'next lifecycle restarts cleanly');
  paint.unmount(); assert.equal(paint.frameCount, 0, 'paint preview RAF cleanup');
  console.log('PASS gallery previews: shared continuous eye path, thunder hit, pause/hidden freeze, complete paint lifecycle and RAF cleanup');
}

async function checkAnchiInterruptions() {
  const h = harness('anchikushoume'); await h.boot();
  await h.until(() => h.tree.read().status === 'playing', 'Anchi interrupt startup');
  void h.tree.fireThunder(); await h.flush();
  assert.equal(h.tree.read().status, 'clearing');
  h.tree.togglePause(); await h.flush();
  const pausedCall = h.tree.read().thunderCall;
  await h.drain();
  assert.equal(h.tree.read().status, 'paused');
  assert.equal(h.tree.read().thunderCall, pausedCall, 'paused thunder countdown does not advance');
  h.tree.resume(); await h.flush();
  await h.until(() => ['playing', 'cleared'].includes(h.tree.read().status), 'resumed thunder');
  h.tree.playAgain(); await h.flush();
  await h.until(() => h.tree.read().status === 'playing', 'Anchi replay');
  assert(h.tree.read().thunderSet, 'replay restores usable 1-2-3 seed');
  assert.equal(h.tree.read().anchi.sizeIndex, 0);
  void h.tree.fireThunder(); await h.flush();
  h.tree.playAgain(); await h.flush(); await h.drain();
  assert.equal(h.tree.read().status, 'playing', 'restart cancels old thunder');
  assert.equal(h.tree.read().anchi.sizeIndex, 0);
  assert.equal(h.tree.read().anchiDefeated, 0);
  assert.equal(h.tree.read().thunderCall, null);
  assert.equal(h.tree.read().thunderBolt, null);
  assert.equal(h.tree.read().anchiPaints.length, 0);
  void h.tree.fireThunder(); await h.flush();
  h.tree.backToTitle(); await h.flush(); await h.drain();
  assert.equal(h.tree.read().status, 'ready');
  assert.equal(h.tree.read().anchi, null);
  assert.equal(h.tree.read().thunderCall, null);
  assert.equal(h.tree.read().thunderBolt, null);
  assert.equal(h.tree.read().board.flat().filter(Boolean).length, 0);
  h.assertRealUnchanged();
  console.log('PASS Anchi thunder pause/resume, seeded replay, restart/exit cancellation and save isolation');
}

async function main() {
  const rejected = [
    { hostname: 'sainome-seven.vercel.app' }, { pathname: '/' },
    { search: '?enemy=unimplemented' }, { search: '?enemy=__proto__' }, { search: '' },
  ];
  for (const location of rejected) {
    const h = harness('koitsume', { location });
    assert.equal(h.config.parseEnemyPractice(h.win.location), null);
    assert.throws(() => h.config.prepareEnemyPracticeStorage(h.win));
    assert.equal(h.config.getEnemyPractice(), null);
    assert.equal(h.win.localStorage, h.originalStorage); h.assertRealUnchanged();
  }
  const blocked = harness('koitsume', { lockStorage: true });
  assert.throws(() => blocked.config.prepareEnemyPracticeStorage(blocked.win));
  assert.equal(blocked.config.getEnemyPractice(), null, 'failed isolation never marks the app ready');
  blocked.assertRealUnchanged();
  console.log('PASS localhost/path/enemy validation and fail-closed storage isolation');

  for (const [enemy, expectedStage] of Object.entries({ koitsume: 8, dame: 8, hidoime: 10, berabou: 17, detarame: 18, anchikushoume: 61, sanzapparaname: 61 })) {
    const h = harness(enemy), selected = await h.boot();
    assert.equal(selected.stage, expectedStage);
    await h.until(() => h.tree.read().status === 'playing', enemy + ' startup');
    assert.equal(h.tree.read().story, expectedStage, 'automatic practice launch');
    assert.equal(h.tree.read().soundMode, 'none', 'review starts silent');
    assert.deepEqual(Array.from(h.tree.read().powers), POWERS);
    assert.deepEqual(Array.from(h.tree.read().bombAllowed), POWERS.slice(0, 4));
    assert(h.tree.read().nicoAllowed && h.tree.read().feverAllowed);
    assert(!h.tree.read().powers.includes('rainbow'));
    assert(h.tree.read().thunderOpen, 'thunder is available in isolated practice');
    if (enemy === 'anchikushoume') {
      assert(h.tree.read().anchi, 'Anchi state initialized');
      assert(h.tree.read().thunderSet, 'opening board offers a legal 1-2-3 chain');
      assert.equal(h.tree.read().anchi.sizeIndex, 0);
    }
    if(enemy === 'sanzapparaname') {
      assert.equal(h.tree.read().board.flat().filter(cell=>cell?.value===-6).length,9,'5/3/1 opening body');
      for(let t=0;t<3;t++) {
        let done=false,result;
        void h.tree.growAnchi(h.tree.read().board).then(board=>{result=board;done=true;});
        await h.until(()=>done,'Sanz eruption turn');h.tree.setBoard(result);await h.flush();
      }
      assert(h.tree.read().board.flat().some(cell=>cell?.value===-1),'eruption spawns Koitsume');
      assert(h.tree.read().board.flat().some(cell=>cell?.value===-2),'eruption spawns Dame');
      console.log('PASS Sanz actual engine: nine-cell opening and mixed eruption');
    }
    const initialEnemies = h.tree.read().board.flat().filter(cell => cell?.value < 0);
    if (enemy === 'koitsume' || enemy === 'dame') {
      assert.equal(initialEnemies.length, 1, 'only the selected small enemy is placed');
      assert.equal(initialEnemies[0].value, enemy === 'koitsume' ? -1 : -2);
      assert.equal(h.tree.read().demo, false, 'small practice skips tutorial');
    }
    h.assertRealUnchanged();
    for (let turn = 0; h.tree.read().status !== 'cleared'; turn++) {
      assert(turn < 150, 'battle must finish: ' + enemy);
      const values = h.tree.read().board.flat().filter(Boolean).map(cell => cell.value);
      // サンザッパラナメは噴火で敵を出し続けるので、先に本体を倒して噴火を止めてから残りを片づける（2026-10-13）
      const sanzFirst = enemy === 'sanzapparaname' && values.includes(-6);
      if (!sanzFirst && values.includes(-2)) await attack(h, -2);
      else if (!sanzFirst && values.includes(-1)) await attack(h, -1);
      else if (values.includes(-3)) await attack(h, -3);
      else if (values.includes(-4)) await attack(h, -4, h.tree.read().berabouHp === 1);
      else if (values.includes(-5)) await attack(h, -5);
      else if (values.includes(-6)) {
        const board = actors(h);
        [1, 2, 3].forEach((value, x) => { board[13][x] = { id: 'thunder-' + x, value, group: 8000 + x }; });
        h.tree.setBoard(board); await h.flush();
        assert(h.tree.read().thunderSet, 'legal thunder fixture');
        void h.tree.fireThunder();
        await h.until(() => ['playing', 'cleared'].includes(h.tree.read().status), 'thunder resolve');
      }
      else throw Error('No enemy before completion: ' + enemy);
    }
    h.assertRealUnchanged();
    h.tree.playAgain(); await h.flush();
    await h.until(() => h.tree.read().status === 'playing', enemy + ' replay');
    assert.equal(h.tree.read().story, expectedStage);
    assert(h.tree.read().board.flat().some(cell => cell?.value < 0));
    // Even nonzero practice-local stock must never offer or spend the forbidden rainbow.
    h.tree.setRainbowStock(3); h.tree.rainbowStockRef.current = 3; await h.flush();
    await h.drop(boardFixture(h, [[3, 0, -2]]), 3, 0);
    assert.equal(h.tree.read().status, 'gameover');
    assert.equal(h.seenRainbow, false, 'rainbow prompt is impossible: ' + enemy);
    assert.equal(h.tree.read().rainbowStock, 3, 'forbidden rainbow stock is not consumed');
    assert.equal(h.tree.read().gameoverHint, false, 'no suggestion to obtain a forbidden rainbow');
    h.key('Enter'); await h.flush();
    await h.until(() => h.tree.read().status === 'playing', enemy + ' Enter replay');
    assert(h.tree.read().board.flat().some(cell => cell?.value < 0), 'Enter replay restores the chosen enemy');
    h.assertRealUnchanged();
    console.log('PASS real enemy battle, powers, replay and rainbow ban:', enemy);
  }

  const h = harness('koitsume'); await h.boot();
  await h.until(() => h.tree.read().status === 'playing', 'ability fixture start');
  for (const [kind, [points, value, x]] of Object.entries(bombs)) {
    h.tree.startStage(8); await h.flush();
    h.tree.totalScoreRef.current = 99999; // force reward threshold crossing without touching real storage
    const result = await h.drop(boardFixture(h, [...points, [6, 3, -2]]), value, x);
    assert(result.score > 0, kind + ' resolves through the real bomb code');
    assert(result.fever > 20, 'FEVER gauge can charge after ' + kind);
    assert.equal(result.rainbowStock, 0, 'practice does not earn rainbow stock');
    assert.equal(h.seenAward, false, 'practice does not show rainbow awards');
    h.assertRealUnchanged();
  }
  h.tree.setFever(100); await h.flush();
  await h.until(() => h.tree.read().feverActive, 'real FEVER ignition');
  assert(h.tree.read().feverActive);
  h.tree.changeLang('en'); h.tree.resetProgress(); await h.flush(); h.assertRealUnchanged();
  console.log('PASS all five bomb types, FEVER charging/ignition, reward ban and settings/reset isolation');

  const interrupted = harness('detarame'); await interrupted.boot();
  interrupted.tree.togglePause(); await interrupted.flush();
  assert.equal(interrupted.tree.read().status, 'paused');
  await interrupted.drain(); assert.equal(interrupted.tree.read().status, 'paused');
  interrupted.tree.resume(); await interrupted.flush();
  await interrupted.until(() => interrupted.tree.read().status === 'playing', 'resume interrupted entrance');
  interrupted.tree.playAgain(); await interrupted.flush();
  interrupted.tree.playAgain(); await interrupted.flush();
  await interrupted.until(() => interrupted.tree.read().status === 'playing', 'repeated restart');
  assert.equal(interrupted.tree.read().board.flat().filter(cell => cell?.value === -5).length, 3);
  interrupted.tree.togglePause(); await interrupted.flush();
  interrupted.tree.playAgain(); await interrupted.flush();
  await interrupted.until(() => interrupted.tree.read().status === 'playing', 'paused restart');
  interrupted.tree.playAgain(); await interrupted.flush();
  interrupted.tree.backToTitle(); await interrupted.flush();
  await interrupted.drain();
  assert.equal(interrupted.tree.read().status, 'ready', 'cancelled entrance does not resume');
  assert.equal(interrupted.tree.read().stageIntro, null);
  assert.equal(interrupted.tree.read().board.flat().filter(Boolean).length, 0);
  interrupted.assertRealUnchanged();
  console.log('PASS pause/resume entrance, repeated restart, paused restart and stale-timer cancellation');
  await checkGallery();
  await checkPreviews();
  await checkAnchiInterruptions();
  console.log('PASS: enemy-practice engine, storage and Gallery JSX checks. Browser rendering/iframe teardown remain separate checks.');
}

module.exports = { harness, boardFixture, actors, attack, galleryHarness };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });

