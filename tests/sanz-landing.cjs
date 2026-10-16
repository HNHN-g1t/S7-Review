// Actual App state/resolver + virtual clock. No browser/device rendering claims.
const assert = require('node:assert/strict');
const { harness } = require('../scripts/check-enemy-practice.cjs');
const enemies = b => b.flat().filter(c => c?.id.startsWith('sanz-eject-'));
async function boot(campaign = false) {
  const h = harness('sanzapparaname', campaign ? { campaign: true, location: { pathname: '/', search: '' } } : {});
  await h.boot();
  if (campaign) {
    h.tree.setWallProgress({cleared:Array.from({length:64},(_,i)=>20+i),gateReached:true});
    await h.flush(); h.tree.startStage(78); // Wall 8-3
  }
  await h.until(() => h.tree.read().status === 'playing', 'Sanz entrance');
  return h;
}
async function erupt(h) {
  const a = h.tree.read().anchi;
  h.tree.updateAnchi({ ...a, turn: 14 }); // 次の手（15）で噴火：模擬戦の周期3と8-3の周期5（2026-10-14に4→5）のどちらでも割り切れる
  await h.flush();
  let done = false, result;
  void h.tree.growAnchi(h.tree.read().board).then(b => { result = b; done = true; });
  await h.flush();
  return { get done() { return done; }, get result() { return result; } };
}
(async () => {
  for (const campaign of [false, true]) {
    const h = await boot(campaign), before = h.tree.read();
    const e = await erupt(h);
    await h.until(() => h.tree.read().sanzElapsed >= 1760, 'first physical landing');
    assert(!e.done, 'landing commits before animation cleanup');
    assert(enemies(h.tree.read().board).length > 0, 'board contains landed enemy immediately');
    assert(h.tree.read().sanzShots.some(s => s.landed), 'renderer handed off landed body');
    if (campaign) assert.equal(h.tree.read().missionNow, before.missionNow, 'landing is not a defeat');
    await h.until(() => e.done, 'eruption completion');
    const after = h.tree.read(), ids = enemies(after.board).map(c => c.id);
    assert.equal(after.sanzShots.length, 0);
    assert(ids.length >= 2); assert.deepEqual(after.board, e.result, 'no test-side setBoard masks persistence');
    // A real non-clearing next turn must preserve all spawned enemies.
    const next = await h.drop(after.board, 2, 0);
    for (const id of ids) assert(next.board.flat().some(c => c?.id === id), 'enemy survives resolver and next hand');
    const e2 = await erupt(h); await h.until(() => e2.done, 'repeated eruption');
    const all = enemies(h.tree.read().board);
    assert.equal(new Set(all.map(c => c.id)).size, all.length, 'unique IDs across volleys');
    assert.equal(new Set(all.map(c => c.group)).size, all.length, 'independent gravity groups');
    if (campaign) assert.equal(h.tree.read().missionNow, before.missionNow);
    // Test the same production impact function for occupied and repeated coordinates.
    const b = h.tree.read().board.map(row => [...row]);
    b[5][0] = { id: 'occupied-die', value: 6, group: 999 };
    let placed = h.tree.landSanzShot(b, { x: 0, y: 5, dame: false, delay: 0 }); await h.flush();
    assert.equal(placed[5][0].value, -1, 'occupied die is overwritten');
    const count = h.tree.read().campaignGeneratedEnemies;
    placed = h.tree.landSanzShot(placed, { x: 0, y: 5, dame: true, delay: 12 }); await h.flush();
    assert.equal(placed[5][0].value, -2, 'same-cell later landing wins');
    assert.equal(h.tree.read().campaignGeneratedEnemies, count, 'replacement does not create phantom defeat');
    const protectedBoard = h.tree.read().board;
    assert.strictEqual(h.tree.landSanzShot(protectedBoard, {x:3,y:11,dame:false,delay:0}), protectedBoard, 'boss preserved');
    console.log('PASS Sanz landing, cleanup, next hand, repeat, occupied die and mission: ' + (campaign ? 'Wall 8-3' : 'practice'));
  }
  for (const action of ['resume', 'playAgain', 'backToTitle']) {
    const h = await boot(); const e = await erupt(h);
    await h.until(() => h.tree.read().sanzElapsed >= 1720, 'before landing pause');
    h.tree.togglePause(); await h.flush(); const paused = h.tree.read().sanzElapsed;
    await h.advance(2000);
    assert.equal(h.tree.read().sanzElapsed, paused); assert.equal(enemies(h.tree.read().board).length, 0);
    h.tree[action](); await h.flush();
    if (action === 'resume') { await h.until(() => e.done, 'resume landing'); assert(enemies(h.tree.read().board).length >= 2); }
    else { await h.advance(5000); assert.equal(enemies(h.tree.read().board).length, 0); assert.equal(h.tree.read().sanzShots.length, 0); }
    console.log('PASS Sanz interrupted flight: ' + action);
  }
  for (const action of ['playAgain', 'backToTitle']) {
    const h = await boot();
    h.tree.updateAnchi({ ...h.tree.read().anchi, turn: 11 }); await h.flush();
    h.tree.setCurrent(h.tree.makeSinglePiece(9999, 2, 0)); await h.flush();
    h.tree.hardDrop();
    await h.until(() => h.tree.read().sanzElapsed >= 1760, 'real resolver landing');
    assert(enemies(h.tree.read().board).length > 0);
    h.tree[action](); await h.flush(); await h.advance(5000);
    assert.equal(enemies(h.tree.read().board).length, 0, 'old real resolver cannot restore old enemies');
    assert.equal(h.tree.read().sanzShots.length, 0);
    console.log('PASS Sanz real resolver interruption after landing: ' + action);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
