// Real resolver and pointer hook; physical browser rendering is checked separately.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { harness } = require('./check-enemy-practice.cjs');
function load(file, require = () => ({})) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext('(function(require,exports){' + source + '})')(require, exports);
  return exports;
}
const { findYou456Set, you456Lines } = load('src/you456.ts');
const plain = value => JSON.parse(JSON.stringify(value));
for (const fever of [false, true]) for (let y = 0; y < 14; y++) for (let x = 0; x < 7; x++) {
  const lines = you456Lines(7, 14, { x, y }, fever);
  assert.equal(lines.cells.length, fever ? 38 : 20);
  assert.equal(new Set(lines.cells.map(p => `${p.x},${p.y}`)).size, lines.cells.length);
  assert(lines.columns.includes(x) && lines.rows.includes(y));
  if (fever) { assert.equal(Math.abs(lines.columns[1] - x), 1); assert.equal(Math.abs(lines.rows[1] - y), 1); }
}
function gestures() {
  let slots = [], cursor = 0, effects = [], view, fired = 0;
  const captures = new Set();
  const board = { querySelector: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 40, height: 40 }) }), hasPointerCapture: id => captures.has(id), setPointerCapture: id => captures.add(id), releasePointerCapture: id => captures.delete(id) };
  const options = { set: [{x:2,y:11},{x:3,y:11},{x:4,y:11}], board: Array.from({length:14}, (_,y) => Array.from({length:7}, (_,x) => ({id:`${x},${y}`}))), run: 1, status: 'playing', boardRef: {current:board}, canStart: () => true, fire: () => fired++ };
  const react = { useRef: value => {const i=cursor++; return slots[i] ?? (slots[i]={current:value});}, useCallback: fn => fn, useState: value => {const i=cursor++; if(!(i in slots)) slots[i]=value; return [slots[i], v => { slots[i]=v; }];}, useLayoutEffect: (fn,deps) => {const i=cursor++, old=slots[i]; if(!old || deps.some((v,j)=>v!==old[j])) {slots[i]=deps; effects.push(fn);} } };
  const hook = load('src/useYou456Gesture.ts', name => name==='react' ? react : load('src/thunderTrace.ts')).useYou456Gesture;
  const render = () => {cursor=0; effects=[]; view=hook(options); effects.forEach(fn=>fn());};
  const send = (type, x=2, extra={}) => {const handled=view[type]({pointerId:1,isPrimary:true,button:0,clientX:(x+.5)*40,clientY:11.5*40,currentTarget:board,preventDefault(){},...extra});render(); return handled;};
  render();
  return {options,render,send,captures,get fired(){return fired;}};
}
for (const bad of [[2,4,3],[3,2,4],[4,3,2],[2,3,2,4]]) {
  const g=gestures(); g.send('down',bad[0]); bad.slice(1).forEach(x=>g.send('move',x)); g.send('up',bad.at(-1)); assert.equal(g.fired,0);
}
for (const invalidate of [g=>g.send('up',3),g=>g.send('cancel',3),g=>{g.options.status='paused';g.render();},g=>{g.options.run++;g.render();},g=>{g.options.board[11][2]={id:'replacement'};g.render();}]) {
  const g=gestures();g.send('down');g.send('move',3);invalidate(g);g.send('move',4);g.send('up',4);assert.equal(g.fired,0);assert.equal(g.captures.size,0);
}
const g=gestures();g.send('down');g.send('move',3,{pointerId:2});g.send('move',4,{pointerId:2});assert.equal(g.fired,0);g.send('move',3);g.send('move',4);g.send('move',4);g.send('up',4);assert.equal(g.fired,1);
async function main() {
  for (const fever of [false,true]) {
    const h=harness('koitsume',{location:{search:'?review=enemy&enemy=koitsume&skill=you456'+(fever?'&fever=1':'')}});
    await h.boot();await h.until(()=>h.tree.read().status==='playing'&&!h.tree.read().stageIntro&&!h.tree.read().feverIgniting,'practice ready');
    assert.equal(h.tree.read().feverActive,fever);
    assert.deepEqual(plain(h.tree.read().you456Set),[{x:2,y:11},{x:3,y:11},{x:4,y:11}]);
    const p=h.tree.fireYou456(); await h.until(()=>!!h.tree.read().you456Beam,'beam');
    assert.equal(h.tree.read().you456Beam.columns.length,fever?2:1);assert.equal(h.tree.read().you456Beam.rows.length,fever?2:1);
    await h.until(()=>['playing','cleared'].includes(h.tree.read().status),'resolved');await p;
    assert(h.tree.read().score>0);assert.equal(h.tree.read().missionNow,1,'vertical Koitsume defeated');
    const remainingEnemies=h.tree.read().board.flat().filter(c=>c&&c.value<0);
    assert.equal(remainingEnemies.length,1);assert.equal(remainingEnemies[0].value,-1,'horizontal Dame takes one hit and becomes Koitsume');
    assert.equal(h.tree.read().board.flat().filter(c=>c&&['you456-practice-14','you456-practice-15','you456-practice-16'].includes(c.id)).length,0,'traced dice consumed');
    assert.equal(h.seenRainbow,false);assert.equal(h.seenAward,false);h.assertRealUnchanged();
    console.log('PASS 456You! actual cross strike, fever='+fever);
  }
  for (const ms of [0,200,500]) {
    const h=harness('koitsume',{location:{search:'?review=enemy&enemy=koitsume&skill=you456'}});await h.boot();await h.until(()=>h.tree.read().status==='playing'&&!h.tree.read().stageIntro,'ready');
    void h.tree.fireYou456();await h.advance(ms);h.tree.playAgain();await h.flush();
    await h.until(()=>h.tree.read().status==='playing'&&!h.tree.read().stageIntro,'restarted');await h.advance(2000);
    assert.equal(h.tree.read().score,0);assert.equal(h.tree.read().missionNow,0);assert.equal(h.tree.read().you456Beam,null);assert.equal(h.tree.read().you456Call,false);h.assertRealUnchanged();
  }
  console.log('PASS 456You!: cross/adjacent FEVER geometry, ordered gesture/cancellation, actual damage/consumption, restart and save isolation');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
