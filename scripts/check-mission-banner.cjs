/** Actual MissionBanner hooks with a deterministic clock; no DOM layout claims. */
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict'), ts = require('typescript');
const source = fs.readFileSync('src/story/MissionBanner.tsx', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: {target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
let cells, index, pending, timers = new Map(), now = 0, nextId = 0, tree, props;
const hooks = {
  useState(initial) { const i = index++; if (!(i in cells)) cells[i] = initial; return [cells[i], v => { const next = typeof v === 'function' ? v(cells[i]) : v; if (!Object.is(next, cells[i])) { cells[i] = next; render(); } }]; },
  useEffect(effect, deps) { const i = index++, old = cells[i]; if (!old || deps.some((d,j) => !Object.is(d,old.deps[j]))) { old?.cleanup?.(); cells[i] = {deps}; pending.push(() => {cells[i].cleanup = effect();}); } },
};
const jsx = (type, props) => ({type, props});
const mod = {exports:{}};
vm.runInNewContext(code, {module:mod,exports:mod.exports, require: name => name === 'react' ? hooks : {jsx,jsxs:jsx}, window:{
 setInterval(fn,ms) { const id=++nextId;timers.set(id,{fn,ms,at:now+ms});return id; }, clearInterval(id) {timers.delete(id);},
}});
function render() {index=0;pending=[];tree=mod.exports.MissionBanner(props);for(const effect of pending) effect();}
function unmount() {for(const c of cells || []) c?.cleanup?.(); cells=[];}
function mount(p={title:'ウォール4-3 斜めと四角の城壁',objective:'スラッシュ3・スクウェア4を各1回 ＋ コイツメ2体・ダーメ2体を倒す',training:false,running:true}) {unmount();props=p;render();}
function advance(ms) {const end=now+ms;while(true) {const next=[...timers.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;const [id,t]=next;now=t.at;t.at+=t.ms;t.fn();}now=end;}
const face=()=>tree.props['data-face'];
mount();assert.equal(face(),'title');assert.equal(timers.size,1);advance(3999);assert.equal(face(),'title');advance(1);assert.equal(face(),'objective');assert.equal(tree.props.children.props.children,props.objective);advance(4000);assert.equal(face(),'title');
// Board updates, score changes, lesson text and clearing/playing do not starve the timer.
for(let i=0;i<40;i++){props={...props,objective:`進捗${i}`};render();advance(100);}assert.equal(face(),'objective');assert.equal(timers.size,1);
props={...props,running:false};render();assert.equal(timers.size,0);advance(12000);assert.equal(face(),'objective');props={...props,running:true};render();advance(3999);assert.equal(face(),'objective');advance(1);assert.equal(face(),'title');
// Restart / same-script next stage remounts with the parent's unique run key.
for(let i=0;i<20;i++){mount({...props,title:`ウォール${i}`,training:false,running:true});assert.equal(face(),'title');assert.equal(timers.size,1);advance(2000);}advance(1999);assert.equal(face(),'title');advance(1);assert.equal(face(),'objective');
unmount();assert.equal(timers.size,0);advance(8000);mount({...props,running:false});assert.equal(face(),'title');assert.equal(timers.size,0);unmount();
// Training is the entire banner, even during playable practice and pause.
for (const running of [true, false]) {
  mount({...props, training:true, running});
  assert.equal(face(),'training');
  assert.equal(tree.props.children.props.children,'特訓中！');
  assert.equal(tree.props['aria-label'],'特訓中！');
  assert.equal(timers.size,0);
  advance(20000);
  assert.equal(face(),'training');
  props={...props,objective:'新しい目標'};render();
  assert.equal(timers.size,0);
}
// Real mission starts on the title with a fresh full four seconds.
props={...props,training:false,running:true};render();
assert.equal(face(),'title');assert.equal(timers.size,1);
advance(3999);assert.equal(face(),'title');advance(1);assert.equal(face(),'objective');
// Returning to training clears the old interval and old objective face.
props={...props,training:true};render();assert.equal(face(),'training');assert.equal(timers.size,0);
advance(9999);props={...props,training:false};render();assert.equal(face(),'title');
advance(3999);assert.equal(face(),'title');advance(1);assert.equal(face(),'objective');
// Ordinary enemy entrances hold the title; they are never labelled training.
mount({...props,training:false,running:false});advance(16000);assert.equal(face(),'title');assert.equal(timers.size,0);
props={...props,running:true};render();advance(3999);assert.equal(face(),'title');advance(1);assert.equal(face(),'objective');
// Retry from a paused mission starts training again, without a stale clock.
props={...props,running:false};render();mount({...props,training:true});
assert.equal(face(),'training');assert.equal(timers.size,0);unmount();assert.equal(timers.size,0);
console.log('PASS: training-only text; no training clock; mission begins on title for a fresh 4000ms; entrance/pause/retry/exit cleanup.');
const app=fs.readFileSync('src/App.tsx','utf8');assert(app.includes('key={`${storyRunRef.current}:${mapStage ?? story}`}'));assert(app.includes("status !== 'ready' && status !== 'cleared' ? <MissionBanner"));assert(app.includes('training={bannerTraining} running={bannerRunning}'));
assert(!app.includes('練習中（本番には数えません）'));
assert(!app.includes('お手本のあと ${objectiveText}'));
assert(app.includes("const bannerRunning = !bannerTraining && !demoLock.current && (status === 'playing' || status === 'clearing')"));
assert(!app.includes('window.setInterval(() => setShowObjective'));
console.log('PASS: exact 0/3999/4000/8000ms cycle; rerenders/lesson text; pause/resume; 20 restart/stage remounts; clear/title/unmount cleanup; one timer maximum.');

const css=fs.readFileSync('src/story/wall-map.css','utf8');
assert(app.includes("${story !== null && !enemyPractice ? 'has-mission-banner' : ''}"));
assert(css.includes('.game-shell.has-mission-banner .board-panel'));
assert(css.includes('calc((100svh - 118px - 14px) * 7 / 14)'));
const oldStrip=11*1.5+4,newStrip=32,extra=14;
assert(extra>=newStrip-oldStrip);
for(const lines of [1,2,3]){const oldBar=Math.max(63,oldStrip+3+14*1.3*lines),newBar=Math.max(63,newStrip+3+14*1.3*lines);assert(newBar-oldBar<=extra);}
console.log('PASS: story-only 14px mobile reserve covers the 11.5px banner increase; score/practice/desktop unchanged (CSS calculation, not device rendering).');

// Actual App phase transitions, using the established virtual-clock gameplay harness.
// Rendering/timer behavior above is tested separately; this is not a browser test.
const engine = fs.readFileSync('scripts/check-campaign-engine.cjs','utf8');
const prefixEnd = engine.indexOf('const dialogueCatalog =');
const helpersStart = engine.indexOf('const bombs =');
const scenariosStart = engine.indexOf('\n(async () => {');
assert([prefixEnd,helpersStart,scenariosStart].every(i=>i>=0),'engine harness markers');
let harness = engine.slice(0,prefixEnd) + engine.slice(helpersStart,scenariosStart);
harness = harness.replace('read:()=>({story,','read:()=>({bannerTraining,bannerRunning,comboDemo,story,');
const scenarios = String.raw`
const mission = number => DATA.CAMPAIGN_MISSIONS.find(m=>m.number===number);
const expectTraining = label => {
  assert.equal(tree.read().bannerTraining,true,label+' training');
  assert.equal(tree.read().bannerRunning,false,label+' timer stopped');
};
const expectMission = label => {
  assert.equal(tree.read().bannerTraining,false,label+' actual mission');
  assert.equal(tree.read().bannerRunning,true,label+' timer running');
};
(async()=>{
  for(const number of ['1-4','2-2','2-5','3-1','3-6']) {
    const m=mission(number),kind={3:'spa1',5:'sla3',7:'squ4',9:'str6',11:'nico'}[m.sourceStage];
    await start(m.stage);expectTraining(number+' demo');
    await until(()=>tree.read().bombPhase===(number==='1-4'?'mission':'play') && tree.read().status==='playing' && !tree.read().demo,'demo complete '+number);
    if(number!=='1-4') {
      expectTraining(number+' playable practice');
      tree.togglePause();await flush();expectTraining(number+' paused practice');
      tree.togglePause();await flush();expectTraining(number+' resumed practice');
      await fire(kind);expectTraining(number+' first practice success');
      await fire(kind);
    }
    expectMission(number+' mission');
    tree.togglePause();await flush();assert.equal(tree.read().bannerRunning,false);
    tree.playAgain();await flush();expectTraining(number+' paused retry');
    tree.backToTitle();await flush();assert.equal(tree.read().bannerRunning,false);
  }
  for(const number of ['1-8','2-3']) {
    await start(mission(number).stage);expectTraining(number+' enemy demo');
    await until(()=>tree.read().status==='playing' && !tree.read().demo,'enemy demo '+number);
    expectTraining(number+' enemy playable practice');
    for(let n=0;n<2;n++) {
      if(number==='2-3')await fixture([[0,13,-2],[1,13,1]],6,2);
      await fixture([[0,13,-1],[1,13,1]],6,2);
      if(n===0)expectTraining(number+' first enemy practice');
    }
    expectMission(number+' enemy mission');
  }
  await start(mission('2-1').stage);expectTraining('chain demo');
  await until(()=>tree.read().status==='playing' && tree.read().comboDemo,'chain scripted play');
  expectTraining('chain scripted playable status');
  await until(()=>tree.read().status==='playing' && !tree.read().demo,'chain real play');
  expectMission('chain real play');
  for(const number of ['4-6','4-1']) {
    await start(mission(number).stage);expectTraining(number+' lesson explanation');
    await until(()=>tree.read().status==='playing' && !tree.read().demo,'lesson start '+number);
    expectMission(number+' real play');
  }
  await start(0);expectTraining('tutorial welcome');
  await until(()=>tree.read().status==='playing','tutorial first demo');expectTraining('tutorial demo');
  // All ordinary opening scripts must keep a title rather than call themselves training.
  for(const number of ['1-1','1-2','1-6','3-5','4-3','4-4','4-5','4-7','5-2','5-6','5-8']) {
    await start(mission(number).stage);
    assert.equal(tree.read().bannerTraining,false,number+' ordinary entrance');
    if(tree.read().demo)assert.equal(tree.read().bannerRunning,false,number+' entrance timer waits');
    await until(()=>tree.read().status==='playing' && !tree.read().demo,'ordinary play '+number);
    expectMission(number+' ordinary play');
  }
  await start(mission('2-1').stage);tree.backToTitle();await flush();
  for(let n=0;timers.length && n<300;n++) {
    timers.sort((a,b)=>a.at-b.at);const t=timers.shift();now=t.at;t.fn();await flush();
  }
  assert.equal(tree.read().status,'ready');assert.equal(tree.read().bannerRunning,false);
  console.log('PASS actual App: five bomb lessons, both enemy demo/play/mission flows, chain demo playing-state, rainbow/FEVER explanation, tutorial, ordinary entrances, pause/retry/exit.');
})().catch(error=>{console.error(error);process.exitCode=1;});
`;
new Function('require','__dirname',harness+scenarios)(require,__dirname);
