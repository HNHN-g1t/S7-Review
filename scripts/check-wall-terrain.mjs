/** ウォールの地形（src/story/wallTerrain.ts）と面の位置（wall1.ts）の確認。
 * Run: node scripts/check-wall-terrain.mjs
 * ・スタートは下段、門は上段
 * ・面・曲がり角・門は陸地の内側
 * ・道どうしは面以外で交差しない。道は池・建物などを横切らず、川は橋の上でだけ渡る
 * ・面どうし、面と関係のない道とは、指で押し分けられるだけ離れている
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const compile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const importPure = async path => import(`data:text/javascript;base64,${Buffer.from(compile(read(path))).toString('base64')}`);
const { CAMPAIGN_MISSIONS, CAMPAIGN_WALLS, wallLinks, wallGate } = await importPure('src/story/wall1.ts');
const { WALL_TERRAIN, roadBends, gateLinks } = await importPure('src/story/wallTerrain.ts');

// 画面上の大きさ：島の幅をおよそ 350px、高さを 500px とみて、面（直径50px）の半径を割合に直す
const NODE_RX = 25 / 3.5, NODE_RY = 25 / 5;
const norm = (dx, dy) => Math.hypot(dx / NODE_RX, dy / NODE_RY); // 1 で面の半径ちょうど

// 外形をなめらかにした曲線を細かい折れ線にして、内側判定に使う
const smoothPolygon = points => {
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const p0 = mid(points[(i - 1 + points.length) % points.length], points[i]);
    const p1 = points[i];
    const p2 = mid(points[i], points[(i + 1) % points.length]);
    for (let t = 0; t < 1; t += 0.1) {
      out.push([(1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]]);
    }
  }
  return out;
};
const inside = (poly, [x, y]) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
const segDist = ([px, py], [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return [ax + t * dx, ay + t * dy];
};
const cross = (a, b, c, d) => {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
};

// 道が通ってはいけない場所。true なら [x,y] はふさがっている
const blockers = features => {
  const tests = [];
  const ellipse = (cx, cy, rx, ry, pad = 1.2) => p => ((p[0] - cx) / (rx + pad)) ** 2 + ((p[1] - cy) / (ry + pad)) ** 2 < 1;
  const rect = (x, y, w, h, pad = 1.2) => p => p[0] > x - pad && p[0] < x + w + pad && p[1] > y - pad && p[1] < y + h + pad;
  const bridges = features.filter(f => f.kind === 'bridge').map(f => rect(f.x, f.y, f.w, f.h, 0.5));
  const nearLine = (points, half) => p => points.slice(1).some((b, i) => { const q = segDist(p, points[i], b); return Math.hypot(p[0] - q[0], p[1] - q[1]) < half; });
  for (const f of features) {
    if (f.kind === 'pond' || f.kind === 'hill') tests.push([f.kind, ellipse(f.cx, f.cy, f.rx + (f.kind === 'pond' ? 1 : 0), f.ry + (f.kind === 'pond' ? 1 : 0))]);
    if (f.kind === 'house' || f.kind === 'hedge' || f.kind === 'court') tests.push([f.kind, rect(f.x, f.y, f.w, f.h)]);
    if (['trees', 'rocks', 'flowers', 'towers', 'pillars'].includes(f.kind)) f.items.forEach(([x, y, r]) => tests.push([f.kind, ellipse(x, y, r, r * 0.8, 0.8)]));
    if (f.kind === 'rampart') tests.push([f.kind, nearLine(f.points, 2.6)]);
    if (f.kind === 'river') { const near = nearLine(f.points, f.width / 2 + 0.8); tests.push([f.kind, p => near(p) && !bridges.some(b => b(p))]); }
  }
  return p => tests.find(([, test]) => test(p))?.[0];
};

// SOFT=1 で、止めずに全部の食い違いを並べる（配置を直すとき用）
let failures = 0;
const check = (ok, message) => { if (ok) return; if (!process.env.SOFT) assert.fail(message); failures += 1; console.log('X', message); };
let checked = 0;
// Wall 7 gameplay is implemented while its dedicated map is being authored.
// Only this explicit wall may use the existing meadow fallback; keep all
// authored terrain checks and fail for any other missing implementation.
const FALLBACK_WALLS = new Set([7]);
for (const area of CAMPAIGN_WALLS.filter(a => a.implemented)) {
  const wall = area.wall;
  const terrain = WALL_TERRAIN[wall];
  if (!terrain && FALLBACK_WALLS.has(wall)) {
    console.log(`INFO: wall ${wall} uses existing meadow fallback; route/launch coverage: check-campaign-map.cjs`);
    continue;
  }
  check(terrain, `wall ${wall}: has terrain`);
  const missions = CAMPAIGN_MISSIONS.filter(m => m.wall === wall);
  const gateId = -wall;
  const nodes = new Map(missions.map(m => [m.stage, [m.x, m.y]]));
  nodes.set(gateId, terrain.gate);
  const land = smoothPolygon(terrain.land);
  const blocked = blockers(terrain.features);

  // スタートは下段、門は上段、ボスは上のほう
  const start = missions[0];
  check(start.y >= 80, `wall ${wall}: start ${start.number} is on the bottom row (y=${start.y})`);
  check(terrain.gate[1] <= 6, `wall ${wall}: gate on the top row`);
  check(nodes.get(wallGate(wall))[1] <= 25, `wall ${wall}: boss near the top`);

  for (const [stage, p] of nodes) {
    check(inside(land, p), `wall ${wall}: node ${stage} inside land`);
    check(blocked(p) === undefined, `wall ${wall}: node ${stage} is not on ${blocked(p)}`);
  }
  // 面どうしの間隔
  const list = [...nodes];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const [a, pa] = list[i], [b, pb] = list[j];
    check(norm(pa[0] - pb[0], pa[1] - pb[1]) >= 2.4, `wall ${wall}: nodes ${a} and ${b} too close`);
  }
  // 道
  const exits = gateLinks(wall, wallGate(wall));
  check(exits.length === (wall >= 3 && wall <= 8 ? 2 : 1), `wall ${wall}: gate approach count`);
  const links = [...wallLinks(wall), ...exits];
  const roads = links.map(([a, b]) => ({ a, b, points: [nodes.get(a), ...roadBends(terrain, a, b), nodes.get(b)] }));
  for (const road of roads) {
    road.points.slice(1, -1).forEach(p => check(inside(land, p), `wall ${wall}: bend of ${road.a}-${road.b} inside land`));
    for (let i = 1; i < road.points.length; i++) {
      const [ax, ay] = road.points[i - 1], [bx, by] = road.points[i];
      const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.5);
      for (let s = 0; s <= steps; s++) {
        const p = [ax + (bx - ax) * s / steps, ay + (by - ay) * s / steps];
        const what = blocked(p);
        check(what === undefined, `wall ${wall}: road ${road.a}-${road.b} crosses ${what} at ${p.map(v => v.toFixed(1))}`);
      }
    }
    // 関係のない面の上を通らない
    for (const [stage, p] of nodes) {
      if (stage === road.a || stage === road.b) continue;
      for (let i = 1; i < road.points.length; i++) {
        const q = segDist(p, road.points[i - 1], road.points[i]);
        check(norm(p[0] - q[0], p[1] - q[1]) >= 1.45, `wall ${wall}: road ${road.a}-${road.b} runs over node ${stage}`);
      }
    }
  }
  // 道どうしの交差（同じ面から出る道どうしは除く）
  for (let i = 0; i < roads.length; i++) for (let j = i + 1; j < roads.length; j++) {
    const r = roads[i], q = roads[j];
    if ([r.a, r.b].some(s => s === q.a || s === q.b)) continue;
    for (let m = 1; m < r.points.length; m++) for (let n = 1; n < q.points.length; n++) {
      check(!cross(r.points[m - 1], r.points[m], q.points[n - 1], q.points[n]), `wall ${wall}: roads ${r.a}-${r.b} and ${q.a}-${q.b} cross`);
    }
  }
  checked += 1;
}
if (failures) { console.log(`${failures} problems`); process.exit(1); }
console.log(`PASS: ${checked} walls — start on the bottom, gate on top, roads avoid ponds/houses/walls, cross rivers only on bridges, never cross each other`);
