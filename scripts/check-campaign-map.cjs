// Component-hook UI tests; no browser layout or device input is simulated.
const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const root = require('node:path').resolve(__dirname, '..');
const ts = require(root + '/node_modules/typescript');
const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const data = {exports:{}};
vm.runInNewContext(compile(root + '/src/story/wall1.ts'), {exports:data.exports, module:data, require, console, localStorage:{getItem:()=>null,setItem:()=>{}}});
const terrain = {exports:{}};
vm.runInNewContext(compile(root + '/src/story/wallTerrain.ts'), {exports:terrain.exports, module:terrain, require, console});
function createHarness(progress, initialStage) {
  let cells = [], index = 0, queue = [], tree, started = [], gates = [];
  const hooks = {
    useState(initial) { const at = index++; if (!(at in cells)) cells[at] = typeof initial === 'function' ? initial() : initial; return [cells[at], value => { cells[at] = typeof value === 'function' ? value(cells[at]) : value; }]; },
    useRef(initial) { const at = index++; if (!(at in cells)) cells[at] = {current:initial}; return cells[at]; },
    useEffect(effect) { const at = index++; if (!(at in cells)) {cells[at] = true; effect();} },
  };
  const jsx = (type, props) => ({type, props});
  const module = {exports:{}};
  vm.runInNewContext(compile(root + '/src/story/WallMap.tsx'), {exports:module.exports,module,require:name=>name==='react'?hooks:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='./wall1'?data.exports:name==='./wallTerrain'?terrain.exports:{},console,window:{matchMedia:()=>({matches:true})},setTimeout:fn=>{queue.push(fn);return queue.length;},clearTimeout:()=>{}});
  const render = () => { index=0; tree=module.exports.WallMap({progress,initialStage,onStart:stage=>started.push(stage),onGate:wall=>{gates.push(wall); progress={...progress,gateReached:progress.gateReached||wall===1,reachedWalls:[...new Set([...(progress.reachedWalls||[]),wall])]};},onLegacy:()=>{},onClose:()=>{}}); return tree; };
  const descend = (node, found=[]) => { if (Array.isArray(node)) node.forEach(child=>descend(child,found)); else if(node && typeof node==='object') {found.push(node); descend(node.props?.children,found);} return found; };
  const nodes = () => descend(tree);
  const text = node => Array.isArray(node) ? node.map(text).join('') : node && typeof node==='object' ? text(node.props?.children) : node == null ? '' : String(node);
  const byLabel = start => nodes().find(n=>n.props?.['aria-label']?.startsWith(start));
  const buttonText = exact => nodes().find(n=>n.type==='button'&&text(n)===exact);
  const click = node => {assert(node, 'requested node exists');assert(!node.props.disabled,'requested node enabled');node.props.onClick();render();};
  const flush = () => {let limit=100;while(queue.length){assert(limit--,'animation settles');queue.shift()();render();}};
  render();return {nodes,text,byLabel,buttonText,click,flush,started,gates,render,heading:()=>nodes().find(n=>n.type==='h1'),detail:()=>nodes().find(n=>n.props?.className==='wall-detail'),traveler:()=>nodes().find(n=>n.props?.className?.startsWith('wall-traveler'))};
}
const d=data.exports;
const assertNoMissionCopy = (h, label) => assert(!h.nodes().some(n=>n.props?.className==='wall-objective'),`${label}: no mission-description paragraph, including an empty one`);
assert.equal(d.CAMPAIGN_MISSIONS.length,63);
assert.equal(d.FUTURE_MISSIONS.length,0);
const fresh=createHarness({cleared:[],gateReached:false});
assert.equal(fresh.text(fresh.heading()),'ウォール1');
const origin=fresh.traveler().props.style;
fresh.click(fresh.byLabel('ウォール1-4'));
assert.equal(fresh.traveler().props.style.left,origin.left);
assert.equal(fresh.traveler().props.style.top,origin.top);
assert(fresh.text(fresh.detail()).includes('🔒'));
assert(fresh.text(fresh.detail()).includes(d.wallUnlockHint(23,[])),'locked-stage requirements remain visible');
assertNoMissionCopy(fresh,'locked lesson');
assert(fresh.buttonText('未解放').props.disabled);
fresh.click(fresh.byLabel('ウォール1-1'));fresh.flush();
fresh.click(fresh.buttonText('挑戦する！'));assert.equal(fresh.started[0],20);
// 2026-10-15：まだ開けていない門の先（ウォール2）は見られない。▲は閉じたまま
assert(fresh.byLabel('ウォール2は門を開けるまで見られない').props.disabled);
assert.equal(fresh.text(fresh.heading()),'ウォール1');
const all=d.CAMPAIGN_MISSIONS.map(m=>m.stage);
for (const mission of d.CAMPAIGN_MISSIONS) {
  const selected=createHarness({cleared:all,gateReached:true,reachedWalls:[1,2,3,4,5]},mission.stage);
  assertNoMissionCopy(selected,mission.number);
  assert(selected.text(selected.detail()).includes(mission.number),`${mission.number}: stage number remains`);
  assert.equal(selected.text(selected.nodes().find(n=>n.type==='h2')),mission.title,`${mission.number}: title remains`);
  selected.click(selected.buttonText('再トライ'));
  assert.equal(selected.started[0],mission.stage,`${mission.number}: replay still starts the selected stage`);
}
const full=createHarness({cleared:all,gateReached:true,reachedWalls:[1,2,3,4,5]},26);
assert.equal(full.traveler().props.children.props.src,'/images/saika-01.png','Saika face traveler remains');
assert.equal(full.text(full.heading()),'ウォール1');
full.click(full.byLabel('ウォール1の門'));full.flush();assert.equal(full.gates.at(-1),1);
full.click(full.buttonText('次のウォールへ →'));
assert.equal(full.text(full.heading()),'ウォール2');
full.click(full.byLabel('ウォール1 '));
full.click(full.byLabel('ウォール1-8'));full.flush();
assert(full.text(full.detail()).includes('任意'));
full.click(full.buttonText('再トライ'));assert.equal(full.started.at(-1),27);
// 2026-10-05：ウォールの移動は前後だけ（▲ 次・▼ 前）。目的のウォールまで1つずつ進む
const stepTo=(h,wall)=>{let guard=10;while(h.text(h.heading())!==`ウォール${wall}`){assert(guard--,'reach wall');const now=Number(h.text(h.heading()).replace('ウォール',''));h.click(h.byLabel(`ウォール${now+(wall>now?1:-1)} `));}};
stepTo(full,8);
assert.equal(full.nodes().filter(n=>n.props?.className==='wall-node future').length,0);
assert(full.traveler());
full.click(full.byLabel('ウォール8-3'));full.flush();
full.click(full.buttonText('再トライ'));assert.equal(full.started.at(-1),78);
full.click(full.byLabel('ウォール8の門'));full.flush();
assert(full.text(full.detail()).includes('ウォール8 突破'));
assert(full.text(full.detail()).includes('ウォール9へ'));
// 2026-10-14：最後のウォール9（王座の間）の門は「王座」。エンディングを見るボタン
stepTo(full,9);
full.click(full.byLabel('ウォール9の門'));full.flush();
assert(full.text(full.detail()).includes('王座の間を突破'));
assert(full.text(full.detail()).includes('サイノメたちの冒険のおわり'));
assert(full.buttonText('エンディングを見る'));
const comeback=createHarness({cleared:all,gateReached:true},45);
assert.equal(comeback.text(comeback.heading()),'ウォール4');
const next=createHarness({cleared:[20,21,23,24,26],gateReached:false});
assert.equal(next.text(next.heading()),'ウォール2');
const tutorial=createHarness({cleared:all,gateReached:true},0);
assert.equal(tutorial.text(tutorial.heading()),'ウォール1');
assert(tutorial.text(tutorial.detail()).includes('チュートリアル'));
assertNoMissionCopy(tutorial,'tutorial');
assert(tutorial.text(tutorial.detail()).includes('0メン'));
tutorial.click(tutorial.buttonText('挑戦する！'));assert.equal(tutorial.started[0],0);
// 前後のないところでは ▲／▼ が押せない
const edge=createHarness({cleared:[],gateReached:false});
assert(edge.nodes().find(n=>n.props?.className==='wall-step is-down').props.disabled);
console.log('PASS: no mission descriptions for all 52 stages, locked lessons or tutorial; preserved numbers/titles/start buttons/Saika face; prev/next wall keys only, locked detail, untouched walk origin, start guard, gate progression, optional replay, all 8 future slots, seven-wall completion copy, initial stage/latest wall/tutorial restoration.');

// Wall 7 keeps its reserved positions and uses the existing meadow until its
// separately authored terrain arrives. No UI or terrain production changes.
const prior = all.filter(id=>d.wallMission(id).wall<7);
for (const first of [69,70]) for (const second of [72,73]) {
  const cleared=[...prior];
  for (const stage of [68,first,71,second,74]) {
    const h=createHarness({cleared:[...cleared],gateReached:true},stage);
    assert.equal(h.text(h.heading()),'ウォール7');
    if (!terrain.exports.WALL_TERRAIN[7]) {
      assert(h.nodes().some(n=>n.props?.className==='wall-meadow'),'Wall 7 safely renders existing meadow');
      assert(!h.nodes().some(n=>n.props?.className==='wall-terrain'),'no invented dedicated terrain');
    }
    const roads=h.nodes().filter(n=>n.type==='polyline' && n.props?.points);
    assert.equal(roads.length,d.wallLinks(7).length+2,'all prerequisite roads and two gate approaches rendered');
    assert(roads.every(n=>!n.props.points.includes('undefined') && !n.props.points.includes('NaN')),'all road endpoints valid');
    h.click(h.buttonText('挑戦する！'));
    assert.equal(h.started[0],stage,'every branch launches after its real prerequisites');
    cleared.push(stage);
  }
  assert(!cleared.includes(75),'optional side mission never required');
  const h=createHarness({cleared,gateReached:true},74);
  h.click(h.byLabel('ウォール7の門'));h.flush();
  assert.equal(h.gates.at(-1),7,'each route reaches the gate');
  for(const stage of [69,70,72,73,75])assert(d.wallUnlocked(stage,cleared),'unselected branches remain replayable');
}
console.log('PASS: all four Wall 7 five-clear routes, optional replay, rendered roads, meadow fallback, and gate visit');
