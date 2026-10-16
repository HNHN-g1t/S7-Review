/**
 * Execute actual App gameplay in a lightweight React-hook/virtual-clock harness.
 * Only the VM copy replaces rendering with test accessors and disables audio.
 * Board fixtures arrange legal moves; damage, goals and completion run normally.
 * This is NOT a browser, input-device, performance or natural-play balance test.
 * Run: node scripts/check-campaign-engine.cjs
 */
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict'), ts = require('typescript');
const root = require('node:path').resolve(__dirname, '..');
const compile = s => ts.transpileModule(s, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const all = [...Array.from({ length: 44 }, (_, i) => 20 + i), ...Array.from({ length: 8 }, (_, i) => 68 + i)], storage = new Map([['sainome-wall1-progress-v1', JSON.stringify({ cleared: all, gateReached: true })], ['sainome-story-progress', '8'], ['sainome-reset-story-v1', '1']]);
let cells = [], hook = 0, tree, timers = [], now = 0, id = 0, queued = false, ready = false, errors = [];
const hooks = { memo: x => x, useCallback: x => x, useMemo: fn => fn(), useEffect: () => { }, useLayoutEffect: () => { }, useRef: value => { let i = hook++; return cells[i] ?? (cells[i] = { current: value }); }, useState: init => { let i = hook++; if (!(i in cells))
        cells[i] = typeof init === 'function' ? init() : init; return [cells[i], v => { let n = typeof v === 'function' ? v(cells[i]) : v; if (!Object.is(n, cells[i])) {
            cells[i] = n;
            if (ready && !queued) {
                queued = true;
                queueMicrotask(() => { queued = false; render(); });
            }
        } }]; } };
const win = { localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) }, location: { search: '?story=map' }, innerWidth: 390, innerHeight: 844, matchMedia: () => ({ matches: true }), setTimeout: (fn, ms = 0) => { timers.push({ id: ++id, at: now + ms, fn }); return id; }, clearTimeout: i => { timers = timers.filter(t => t.id !== i); }, setInterval: () => ++id, clearInterval: () => { }, addEventListener: () => { }, removeEventListener: () => { } };
const context = { console, window: win, localStorage: win.localStorage, location: win.location, document: { body: { classList: { toggle: () => { }, remove: () => { } } }, hidden: false }, navigator: {}, performance: { now: () => now }, URLSearchParams, Image: class {
    }, Audio: class {
        paused = true;
        load() { }
        play() { return Promise.resolve(); }
        pause() { }
    }, setTimeout: win.setTimeout, clearTimeout: win.clearTimeout, requestAnimationFrame: fn => win.setTimeout(fn, 16), cancelAnimationFrame: win.clearTimeout, crypto: require('crypto').webcrypto, Math };
const mods = {};
function load(path) {
    if (mods[path])
        return mods[path];
    const m = { exports: {} };
    mods[path] = m.exports;
    let source = fs.readFileSync(root + '/' + path, 'utf8').replaceAll('import.meta.env.DEV', 'false').replaceAll('import.meta.env.BASE_URL', "'/'");
    if (path === 'src/App.tsx') {
        source = source.replace("useState<SoundMode>('all')", "useState<SoundMode>('none')");
        const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), app = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'App'), ret = app.body.statements.filter(ts.isReturnStatement).at(-1);
        source = source.slice(0, ret.getStart(ast)) + `return {startStage,backToTitle,playAgain,togglePause,hardDrop,setBoard,setCurrent,setFever,setScore,setWallProgress,emptyBoard,makeSinglePiece,storyRunRef,bombLesson,koiLesson,dameLesson,hidoimeHp,hidoimeDefeated,berabouHp,berabouDefeated,detaramesRef,detarameDefeated,allstarPhase,wallProgressRef,mapStageRef,wallCounts,updateDetarame,setHidoimeView,setBerabouView,storyCombosRef,rainbowAnswer,
read:()=>({story,stageIntro,saika,diceBias:storyDiceBias,boostValues:[...storyBoostValues],idlePool:storyIdlePool,mapStage:mapStageRef.current,status,board,score,wallCounts:wallCounts.current,bombPhase:bombLesson.current.phase,bombSuccess:bombLesson.current.success,demo:demoLock.current,powers:mapPowers(),missionNow,missionGoal,hidoimeDefeated:hidoimeDefeated.current,berabouHp:berabouHp.current,detarame:detaramesRef.current[0]??null,allstarPhase:allstarPhase.current,koiPhase:koiLesson.current.phase,damePhase:dameLesson.current.phase,rainbowAsk,progress:wallProgressRef.current})};` + source.slice(ret.end);
    }
    vm.runInNewContext(compile(source), { ...context, module: m, exports: m.exports, require: name => name === 'react' ? hooks : name === 'react/jsx-runtime' ? { jsx: () => null, jsxs: () => null } : name === './enemyPracticeConfig' ? load('src/enemyPracticeConfig.ts') : name === './enemy/characterNames' ? load('src/enemy/characterNames.ts') : name === './you456' ? load('src/you456.ts') : name === './useYou456Gesture' ? load('src/useYou456Gesture.ts') : name === './thunderTrace' ? load('src/thunderTrace.ts') : name === './thunder' ? load('src/thunder.ts') : name === './story/wall1' ? load('src/story/wall1.ts') : name === './story/objectives' ? load('src/story/objectives.ts') : name === './enemy/hidoimeFx' ? load('src/enemy/hidoimeFx.ts') : name === './enemy/Detarame' ? load('src/enemy/Detarame.tsx') : name === './hidoimeCrushAudio' ? load('src/hidoimeCrushAudio.ts') : name === './haptics' ? { haptics: new Proxy({}, { get: () => () => { } }) } : {} }, { filename: path });
    return m.exports;
}
const App = load('src/App.tsx').default;
function render() { hook = 0; tree = App(); }
;
render();
ready = true;
async function flush() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
async function until(test, label, limit = 3000) { for (let i = 0; i < limit; i++) {
    await flush();
    if (test())
        return;
    timers.sort((a, b) => a.at - b.at);
    let t = timers.shift();
    if (!t) {
        for (let spin = 0; spin < 20; spin++)
            await flush();
        if (test())
            return;
        timers.sort((a, b) => a.at - b.at);
        t = timers.shift();
        if (!t)
            throw Error('No timer while waiting ' + label + ' ' + JSON.stringify(tree.read()));
    }
    now = t.at;
    try {
        t.fn();
    }
    catch (e) {
        errors.push(e);
        throw e;
    }
} throw Error('Timed out ' + label); }
async function fixture(cells, value, x) { const b = tree.emptyBoard(); cells.forEach(([x, y, v], i) => b[y][x] = { id: 'test' + i, value: v, group: 1000 + i }); tree.setBoard(b); tree.setCurrent(tree.makeSinglePiece(++id, value, x)); await flush(); tree.hardDrop(); await until(() => ['playing', 'cleared', 'gameover'].includes(tree.read().status), 'drop'); return tree.read(); }
const DATA = load('src/story/wall1.ts');
const dialogueCatalog = load('src/App.tsx').storyDialogueForReview;
for (const mission of DATA.CAMPAIGN_MISSIONS) {
    const lines = dialogueCatalog(mission.stage);
    assert(lines.length > 20, 'common and dedicated dialogue included: ' + mission.number);
    assert.equal(new Set(lines.map(line => line.text)).size, lines.length, 'no duplicate dialogue: ' + mission.number);
    const sage = lines.some(line => line.speaker === 'ゾロメ仙人');
    assert(lines.some(line => line.text === (sage ? 'よい調子じゃ♪' : [21, 22, 27, 53, 56, 70].includes(mission.stage) ? 'ええ感じでんがな♪' : 'いい感じ いい感じ♪')), 'speaker-specific clear praise included: ' + mission.number);
}
assert(!dialogueCatalog(20).some(line => /コイツメ|ダーメ|ヒドイメ/.test(line.text)), '1-1 dialogue has no absent enemies');
assert(!dialogueCatalog(20).some(line => line.text === '半分まできたよ！'), 'score progress does not use enemy-count dialogue');
assert(dialogueCatalog(59).some(line => line.text.includes('デタラメ')), 'final mission includes actual enemy dialogue');
assert(dialogueCatalog(27).some(line => line.timing === '助っ人登場' && line.speaker === 'フタツメ＋ゴモク（交互）'), 'tutor rescue uses current runtime pair');
assert(dialogueCatalog(30).some(line => line.timing === '敵に出会った時' && line.speaker === 'サイカ'), 'panic remains Saika');
assert(dialogueCatalog(40).some(line => line.text === 'なにか来る…！' && line.speaker === 'サイカ'), 'pre-arrival sense remains Saika');
assert(dialogueCatalog(29).filter(line => line.timing.startsWith('講習')).every(line => line.speaker === 'ゾロメ仙人'), 'later bomb lessons use sage');
const bombs = { spa1: [[[0, 13, 1], [1, 13, 1], [2, 13, 1], [3, 13, 1]], 1, 4], sla3: [[[0, 13, 3], [1, 13, 2], [1, 12, 3], [2, 13, 2], [2, 12, 2]], 3, 2], squ4: [[[1, 13, 4], [2, 13, 4], [1, 12, 4]], 4, 2], str6: [[[0, 13, 6], [1, 13, 6], [2, 13, 6]], 6, 3], nico: [[[0, 13, 0]], 0, 1] };
const seven = [[[0, 13, 1]], 6, 1], chain = [[[0, 13, 1], [1, 13, 3], [1, 12, 6]], 4, 2];
async function start(stage) { tree.startStage(stage); await flush(); }
async function fire(kind, sentinel = false) { let [bd, v, x] = bombs[kind] || seven; return fixture([...bd, ...(sentinel ? [[6, 3, -2]] : [])], v, x); }
async function destroySmall(m) { let enemies = m.enemies.map((e, i) => [i + 1, 12, e.kind === 'dame' ? -2 : -1]); for (let turn = 0; enemies.length; turn++) {
    if (turn > 5)
        throw Error("small enemies stuck " + m.number + " " + JSON.stringify(tree.read()));
    await fixture([...enemies, [1, 13, 1], [2, 13, 1], [3, 13, 1], [4, 13, 1]], 1, 0);
    enemies = tree.read().board.flat().filter(c => c && [-1, -2].includes(c.value)).map((c, i) => [i + 1, 12, c.value]);
} }
async function dropBoard(board, value, x) { tree.setBoard(board); tree.setCurrent(tree.makeSinglePiece(++id, value, x)); await flush(); tree.hardDrop(); await until(() => ['playing', 'cleared', 'gameover'].includes(tree.read().status), 'actor drop'); return tree.read(); }
function actors() { const b = tree.emptyBoard(); tree.read().board.forEach((row, y) => row.forEach((c, x) => { if (c && c.value < 0)
    b[y][x] = { ...c }; })); return b; }
async function attack(value, special = false) {
    const b = actors();
    const points = [];
    b.forEach((row, y) => row.forEach((c, x) => { if (c?.value === value)
        points.push({ x, y }); }));
    assert(points.length, 'actor exists ' + value);
    const top = points[0], x = top.x, y = top.y;
    if (special) {
        for (const [xx, yy] of [[x, y - 1], [x + 1, y - 1], [x + 2, y - 1], [x, y - 2]])
            b[yy][xx] = { id: 'strike' + id + '-' + xx + '-' + yy, value: 1, group: 4000 + id++ };
        return dropBoard(b, 1, x + 1);
    }
    b[y - 1][x] = { id: 'hit' + id, value: 1, group: 4000 + id++ };
    return dropBoard(b, 6, x);
}
async function battle(m) {
    await start(m.stage);
    await until(() => tree.read().status === 'playing', 'enemy entrance ' + m.number);
    for (let turn = 0; tree.read().status !== 'cleared'; turn++) {
        assert(turn < 150, 'battle stuck ' + m.number);
        const values = tree.read().board.flat().filter(Boolean).map(c => c.value);
        if (values.includes(-2))
            await attack(-2);
        else if (values.includes(-1))
            await attack(-1);
        else if (values.includes(-3))
            await attack(-3);
        else if (values.includes(-4))
            await attack(-4, tree.read().berabouHp === 1);
        else if (values.includes(-5))
            await attack(-5);
        else
            await fixture(...seven);
    }
    console.log('PASS scripted enemy battle', m.number, m.sourceStage);
}
(async () => {
    // 1-6: three initial Koitsume, then exactly three falling reinforcements.
    const waveEnemies = () => tree.read().board.flat().filter(c => c?.value === -1);
    async function beginSecondWave() {
        await start(25);
        await until(() => tree.read().status === 'playing', '1-6 entrance');
        assert.equal(waveEnemies().length, 3);
        assert.equal(tree.read().missionNow, 0);
        assert.equal(tree.read().missionGoal, 6, 'six enemies, no special-move requirement');
        const b = tree.emptyBoard();
        [1, 2, 3].forEach(x => b[12][x] = { id: 'first-wave-' + x, value: -1, group: -x });
        [0, 1, 2, 3].forEach(x => b[13][x] = { id: 'super-one-' + x, value: 1, group: 100 + x });
        tree.setBoard(b);
        tree.setCurrent(tree.makeSinglePiece(++id, 1, 4));
        await flush();
        tree.hardDrop();
        await until(() => waveEnemies().some(c => c.id.startsWith('campaign-wave-')), 'second wave falling');
        assert.equal(tree.read().status, 'clearing', 'first wipe must not clear the mission');
        assert.equal(waveEnemies().length, 3, 'same type and number as first wave');
        assert(tree.read().board[0].some(c => c?.value === -1), 'reinforcements enter from the top');
    }
    async function advance(ms) {
        const end = now + ms;
        for (let n = 0; n < 3000; n++) {
            await flush();
            timers.sort((a, b) => a.at - b.at);
            if (!timers.length || timers[0].at > end) { now = end; await flush(); return; }
            const timer = timers.shift(); now = timer.at; timer.fn();
        }
        throw Error('timer loop');
    }
    await beginSecondWave();
    tree.togglePause(); await flush();
    const pausedBoard = JSON.stringify(tree.read().board);
    await advance(5000);
    assert.equal(tree.read().status, 'paused');
    assert.equal(JSON.stringify(tree.read().board), pausedBoard, 'falling wave freezes during pause');
    tree.togglePause(); await flush();
    await until(() => tree.read().status === 'playing', 'second wave lands after resume');
    assert.equal(waveEnemies().length, 3);
    assert.equal(tree.read().missionNow, 3, 'three kills, not a premature clear');
    for (let hits = 0; tree.read().status !== 'cleared'; hits++) {
        assert(hits < 10); await attack(-1);
    }
    assert.equal(tree.read().missionNow, 6, 'both waves counted');
    assert.equal(waveEnemies().length, 0);
    await advance(3000);
    assert.equal(tree.read().status, 'cleared', 'no third wave');
    for (const paused of [false, true]) {
        await beginSecondWave();
        if (paused) { tree.togglePause(); await flush(); }
        tree.playAgain(); await flush();
        await until(() => tree.read().status === 'playing', '1-6 restart');
        const restartedBoard = JSON.stringify(tree.read().board);
        await advance(5000);
        assert.equal(tree.read().mapStage, 25);
        assert.equal(tree.read().missionNow, 0);
        assert.equal(waveEnemies().length, 3);
        assert.equal(JSON.stringify(tree.read().board), restartedBoard, 'old wave cannot overwrite restart');
        await beginSecondWave();
        if (paused) { tree.togglePause(); await flush(); }
        tree.backToTitle(); await flush();
        await advance(5000);
        assert.equal(tree.read().status, 'ready');
        assert.equal(tree.read().board.flat().filter(Boolean).length, 0, 'old wave cannot return after exit');
    }
    console.log('PASS 1-6: 3+3 falling enemies, 6/6 HUD, no early clear/third wave, pause/resume, restart/exit with active and paused wave');
    for (const m of DATA.CAMPAIGN_MISSIONS.filter(m => m.sourceStage === undefined && (m.wall < 6 || m.wall === 7 && !m.anchikushoume && !m.detarameTotal))) { // ウォール6（イチニノサンダー・アンチクショウメ）は専用の確認で
        await start(m.stage);
        await until(() => tree.read().status === 'playing', 'generic entrance ' + m.number);
        // 2026-10-05 ユーザー指示：目標の文（「セヴン目を3回」など）はセリフに出さない。敵がいれば倒し方を出す
        assert(!tree.read().idlePool.ja.includes(m.theme), 'map idle does not repeat the objective text: ' + m.number);
        if (m.enemies.length > 0) assert(tree.read().idlePool.ja.some(line => /コイツメ|ダーメ|✕/.test(line)), 'map idle guides the actual enemies: ' + m.number);
        if (m.stage === 20) {
            assert.equal(tree.read().board.flat().filter(c => c && c.value < 0).length, 0, '1-1 has no enemies');
            assert.equal(tree.read().saika.text, 'となり合うサイノメどうしを合計7にして消していこう！');
            assert(!/コイツメ|Koitsume|enemies|FEVER|スーパー1/i.test(JSON.stringify(tree.read().idlePool)), '1-1 does not explain absent enemies or unlearned powers');
        }
        let guarded = m.enemies.length > 0;
        for (let i = 0; i < m.sevens; i++)
            await fixture([...seven[0], ...(guarded ? [[6, 3, -2]] : [])], seven[1], seven[2]);
        for (let i = 0; i < (m.chainTarget || 0); i++)
            await fixture([...chain[0], ...(guarded ? [[6, 3, -2]] : [])], chain[1], chain[2]);
        for (const kind of ['spa1', 'sla3', 'squ4', 'str6'])
            for (let i = 0; i < Math.max(m.bombTargets?.[kind] || 0, kind === 'spa1' ? m.superOnes : 0); i++)
                await fire(kind, guarded);
        for (let i = 0; i < (m.nicoTarget || 0); i++)
            await fire('nico', guarded);
        while (tree.read().score < (m.scoreTarget || 0))
            await fixture(...seven); // A basic seven alone can clear every score mission.
        if (guarded) {
            if (m.enemyWaveSize || m.enemies.length > 6) {
                for (let turn = 0; tree.read().status !== 'cleared'; turn++) {
                    assert(turn < 30, 'small enemy mission must finish');
                    await attack(-1);
                }
                if (m.enemyWaveSize) assert.equal(tree.read().wallCounts.enemyKills, m.enemies.length, 'all waves count toward the total');
            } else await destroySmall(m);
        }
        assert.equal(tree.read().status, 'cleared', 'generic ' + m.number);
        console.log('PASS resolver', m.number, m.theme);
    }
    for (const m of DATA.CAMPAIGN_MISSIONS.filter(m => [3, 5, 7, 9, 11].includes(m.sourceStage))) {
        await start(m.stage);
        await until(() => tree.read().bombPhase === (m.stage === 23 ? 'mission' : 'play') && tree.read().status === 'playing', 'lesson demo ' + m.number);
        const kind = { 3: 'spa1', 5: 'sla3', 7: 'squ4', 9: 'str6', 11: 'nico' }[m.sourceStage];
        if (m.stage !== 23) for (let i = 0; i < 2; i++) await fire(kind);
        assert.equal(tree.read().bombPhase, 'mission', 'practice completed ' + m.number);
        for (let i = 0; i < (kind === 'nico' ? 2 : 3); i++) {
            await fire(kind);
            if (m.stage === 23 && i === 1) {
                assert.equal(tree.read().diceBias, false, 'third attempt uses normal dice probabilities');
                assert.equal(tree.read().boostValues.length, 0);
                assert.equal(tree.read().saika.text, '平時のメの出現カクリツでやってみるのじゃ！');
            }
        }
        assert.equal(tree.read().status, 'cleared', 'lesson ' + m.number);
        console.log('PASS lesson demo/practice/mission', m.number, kind);
    }
    for (const m of DATA.CAMPAIGN_MISSIONS.filter(m => [2, 4, 6].includes(m.sourceStage))) {
        await start(m.stage);
        await until(() => tree.read().status === 'playing' && !tree.read().demo, 'basic lesson ' + m.number);
        if (m.sourceStage === 2) {
            await fixture(...chain);
            await fixture(...chain);
        }
        else
            for (let i = 0; tree.read().status !== 'cleared'; i++) {
                assert(i < 20);
                if (m.sourceStage === 4)
                    await fixture([[0, 13, -1], [1, 13, 1]], 6, 2);
                else {
                    await fixture([[0, 13, -2], [1, 13, 1]], 6, 2);
                    await fixture([[0, 13, -1], [1, 13, 1]], 6, 2);
                }
            }
        assert.equal(tree.read().status, 'cleared');
        console.log('PASS basic lesson', m.number, m.sourceStage);
    }
    for (const m of DATA.CAMPAIGN_MISSIONS.filter(m => [8, 10, 12, 13, 14, 16, 17, 18, 19].includes(m.sourceStage)))
        await battle(m);
    const rainbow = DATA.CAMPAIGN_MISSIONS.find(m => m.sourceStage === 15);
    await start(rainbow.stage);
    await until(() => tree.read().status === 'playing', 'rainbow intro');
    const b = tree.emptyBoard();
    b[0][3] = { id: 'top-fixture', value: 1, group: 1000 };
    tree.setBoard(b);
    tree.setCurrent(tree.makeSinglePiece(++id, 3, 0));
    await flush();
    tree.hardDrop();
    await until(() => tree.read().rainbowAsk, 'rainbow ask');
    tree.rainbowAnswer.current(true);
    await until(() => tree.read().status === 'cleared', 'rainbow saved');
    console.log('PASS rainbow lesson', rainbow.number);
    // Re-enter two different map missions backed by the same old stage (10).
    // An old entrance/intro timer must not write into the newer mission.
    await start(40);
    await start(55);
    assert.equal(tree.read().mapStage, 55);
    await until(() => tree.read().status === 'playing', 'same-source restart');
    assert.equal(tree.read().board.flat().filter(c => c?.value === -3).length, 4);
    tree.togglePause();
    await flush();
    tree.playAgain();
    await flush();
    assert.equal(tree.read().mapStage, 55, 'restart preserves map identity');
    tree.backToTitle();
    await flush();
    assert.equal(tree.read().status, 'ready');
    assert.equal(tree.read().stageIntro, null);
    for (let i = 0; timers.length && i < 200; i++) {
        timers.sort((a, b) => a.at - b.at);
        const timer = timers.shift();
        now = timer.at;
        timer.fn();
        await flush();
    }
    assert.equal(tree.read().status, 'ready', 'old script does not restart after title return');
    assert.equal(tree.read().stageIntro, null, 'old intro does not reappear');
    assert.equal(tree.read().board.flat().filter(Boolean).length, 0);
    console.log('PASS same-source restart, pause/retry map identity, title return and stale timers');
    assert.equal(storage.get('sainome-story-progress'), '8', 'map clears never advance linear progress');
    console.log('PASS: campaign generic missions and source-script rematches resolve through actual App logic; Wall 6/7 special enemies have dedicated tests; legacy save untouched.');
})().catch(e => { console.error(e); process.exitCode = 1; });

