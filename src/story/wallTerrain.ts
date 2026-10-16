// ウォールごとの地形（マップの土台）。2026-10-11
// ゆくゆくは絵に差し替えるが、そのときのラフにもなるよう「構造」をここで決めておく。
//   ・スタート（各ウォールの最初の面）は下段のどこか、門は上段のどこか
//   ・まん中の池や川・建物などをよけて、道がぐるりと回り込む
// 座標はマップの島（wall-land）の左上を 0、右下を 100 とする割合（面の x・y と同じ）。
// 面の位置そのものは wall1.ts の x・y。ここは陸地の形・飾り・門の位置・道の曲がり角だけを持つ。
// 確認：scripts/check-wall-terrain.mjs（道どうしが交差しない、池や建物を横切らない、など）

export type Pt = [number, number];

export type TerrainFeature =
  // 池（fountain: まん中に噴水）
  | { kind: 'pond'; cx: number; cy: number; rx: number; ry: number; fountain?: boolean }
  // 川（道は bridge を置いたところでだけ渡る）
  | { kind: 'river'; points: Pt[]; width: number }
  | { kind: 'bridge'; x: number; y: number; w: number; h: number }
  // 木立・岩・花壇（[x, y, 半径]）
  | { kind: 'trees'; items: [number, number, number][] }
  | { kind: 'rocks'; items: [number, number, number][] }
  | { kind: 'flowers'; items: [number, number, number][] }
  // 丘・広場（楕円）
  | { kind: 'hill'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'plaza'; cx: number; cy: number; rx: number; ry: number }
  // 建物・生け垣・中庭（四角）
  | { kind: 'house'; x: number; y: number; w: number; h: number }
  | { kind: 'hedge'; x: number; y: number; w: number; h: number }
  | { kind: 'court'; x: number; y: number; w: number; h: number }
  // 城壁（折れ線）と塔・柱（[x, y, 半径]）
  | { kind: 'rampart'; points: Pt[] }
  | { kind: 'towers'; items: [number, number, number][] }
  | { kind: 'pillars'; items: [number, number, number][] };

export type WallTerrain = {
  name: string; // 地形の呼び名（絵を描くときのメモ）
  land: Pt[]; // 陸地の外形（なめらかにつないで描く）
  gate: Pt; // 門の位置（上段）
  bends?: Record<string, Pt[]>; // 道の曲がり角。キーは "小さいステージ番号-大きいステージ番号"
  features: TerrainFeature[];
};

export const WALL_TERRAIN: Record<number, WallTerrain> = {
  // 王座の間：柱の並ぶ広間を、下の入口からジグザグに上って奥の王座（門）へ
  9: {
    name: '柱の並ぶ王座の間',
    land: [[4, -2], [50, -4], [96, -2], [98, 50], [96, 96], [50, 98], [4, 96], [2, 50]],
    gate: [50, 4],
    bends: { '84-85': [[26, 74]], '85-86': [[30, 30]] },
    features: [
      { kind: 'plaza', cx: 50, cy: 8, rx: 16, ry: 6 },
      { kind: 'court', x: 40, y: 36, w: 20, h: 30 },
      { kind: 'pillars', items: [[8, 20, 2.4], [92, 20, 2.4], [8, 70, 2.4], [92, 70, 2.4], [80, 44, 2.4], [70, 88, 2.4], [6, 40, 2], [92, 90, 2]] },
    ],
  },
  8: {
    name:'王座前の火山回廊',
    land:[[0,0],[50,0],[100,0],[100,50],[100,100],[50,100],[0,100],[0,50]],
    gate:[50,1],features:[],
    bends:{'-8-82':[[38,1],[38,13]],'-8-81':[[62,1],[78,4],[90,29]]},
  },
  // 草原：左下から入り、まん中の噴水の池をぐるりと回って左上の門へ
  1: {
    name: '噴水の池のある草原',
    land: [[6, -2], [32, -2], [60, 1], [90, 6], [98, 30], [96, 62], [98, 90], [70, 98], [34, 97], [26, 80], [4, 76], [2, 44], [2, 10]],
    gate: [18, 4],
    bends: {
      '20-27': [[46, 94], [76, 94]],
      '23-25': [[58, 66]],
      '25-26': [[88, 28], [62, 18]],
    },
    features: [
      { kind: 'pond', cx: 63, cy: 45, rx: 15, ry: 10, fountain: true },
      { kind: 'trees', items: [[74, 8, 4], [84, 11, 4.5], [93, 18, 3.5], [47, 7, 3.5], [8, 56, 3.5], [92, 74, 3.5]] },
      { kind: 'flowers', items: [[48, 76, 3], [80, 66, 2.5], [7, 28, 2.5]] },
    ],
  },
  // 街道：川の上の宿場（2-5）を通り抜けて、右上の門へ
  2: {
    name: '川を渡る街道',
    land: [[8, 6], [40, 2], [70, -2], [94, -2], [98, 20], [98, 46], [94, 78], [80, 96], [44, 98], [10, 94], [2, 66], [4, 30]],
    gate: [82, 4],
    features: [
      { kind: 'river', points: [[0, 38], [20, 40], [40, 44], [54, 45], [70, 47], [86, 50], [100, 48]], width: 6 },
      { kind: 'bridge', x: 43, y: 40, w: 22, h: 11 },
      { kind: 'trees', items: [[8, 12, 3.5], [20, 9, 4], [33, 8, 3.5], [92, 22, 3.5], [6, 82, 3.5]] },
      { kind: 'hill', cx: 74, cy: 88, rx: 11, ry: 5 },
      { kind: 'rocks', items: [[36, 92, 2.5], [70, 62, 2]] },
    ],
  },
  // 城下：右下から入り、家並みのあいだを抜けて左上の門へ
  3: {
    name: '家並みの城下町',
    land: [[2, -2], [30, -2], [46, 2], [94, 6], [98, 40], [96, 72], [98, 96], [52, 98], [8, 94], [2, 60], [2, 20]],
    gate: [16, 4],
    bends: {
      '-3-43': [[4, 4], [4, 17]],
      '-3-42': [[34, 4], [44, 18], [82, 18]],
    },
    features: [
      { kind: 'house', x: 24, y: 44, w: 12, h: 8 },
      { kind: 'house', x: 64, y: 38, w: 16, h: 11 },
      { kind: 'house', x: 56, y: 5, w: 15, h: 10 },
      { kind: 'house', x: 4, y: 38, w: 10, h: 16 },
      { kind: 'house', x: 24, y: 88, w: 14, h: 6 },
      { kind: 'trees', items: [[92, 14, 3.5], [92, 46, 3]] },
    ],
  },
  // 外壁：左下から入り、堀と城壁の切れ目（右）を回って左上の門へ
  4: {
    name: '堀と城壁の外まわり',
    land: [[4, 6], [40, 2], [82, 4], [98, 18], [96, 56], [98, 92], [60, 98], [6, 96], [2, 66], [6, 34]],
    gate: [22, 4],
    bends: {
      '49-51': [[60, 30]],
      '-4-51': [[14, 6], [10, 20]],
      '-4-50': [[34, 4], [44, 6]],
    },
    features: [
      { kind: 'river', points: [[0, 46], [24, 46], [48, 45], [66, 46]], width: 5 },
      { kind: 'rampart', points: [[0, 41], [24, 41], [48, 40], [68, 41]] },
      { kind: 'towers', items: [[10, 40, 3], [38, 40, 3], [66, 40, 3]] },
      { kind: 'rocks', items: [[90, 88, 2.5], [6, 74, 2]] },
      { kind: 'trees', items: [[88, 10, 3.5], [92, 70, 3]] },
    ],
  },
  // 前庭：まん中の噴水広場を左から回り込み、上段まん中の門へ
  5: {
    name: '噴水広場の前庭',
    land: [[6, 4], [50, 1], [94, 4], [98, 34], [96, 66], [94, 96], [50, 98], [6, 96], [2, 64], [4, 30]],
    gate: [50, 3],
    bends: {
      '53-57': [[34, 52]],
      '-5-59': [[44, 3], [44, 16]],
      '-5-58': [[62, 3], [80, 4]],
    },
    features: [
      { kind: 'plaza', cx: 54, cy: 52, rx: 13, ry: 9 },
      { kind: 'pond', cx: 54, cy: 52, rx: 7, ry: 4.5, fountain: true },
      { kind: 'hedge', x: 4, y: 76, w: 8, h: 14 },
      { kind: 'hedge', x: 88, y: 66, w: 8, h: 18 },
      { kind: 'hedge', x: 26, y: 6, w: 14, h: 5 },
      { kind: 'hedge', x: 62, y: 6, w: 14, h: 5 },
      { kind: 'flowers', items: [[28, 84, 3], [72, 84, 3], [30, 22, 2.5], [92, 36, 2.5]] },
    ],
  },
  // 回廊：右下から入り、中庭のまわりをコの字に回って右上の門へ
  6: {
    name: '中庭を囲む回廊',
    land: [[4, 4], [50, 2], [70, -2], [96, -2], [98, 50], [96, 96], [50, 98], [4, 96], [2, 50]],
    gate: [82, 4],
    bends: {
      '-6-63': [[90, 4], [90, 22]],
      '-6-62': [[72, 4], [62, 10], [22, 10]],
    },
    features: [
      { kind: 'court', x: 38, y: 38, w: 40, h: 30 },
      { kind: 'pond', cx: 58, cy: 53, rx: 8, ry: 5 },
      { kind: 'pillars', items: [[38, 38, 2], [78, 38, 2], [38, 68, 2], [78, 68, 2], [58, 38, 2], [58, 68, 2], [8, 60, 2], [8, 24, 2], [40, 92, 2], [92, 70, 2]] },
    ],
  },
};

export const terrainFor = (wall: number): WallTerrain | undefined => WALL_TERRAIN[wall];

// 門への2本の道。解放条件は従来のボス撃破を保つ（面は増やさない）。
export const gateLinks = (wall: number, boss: number): [number, number][] => {
  const second: Record<number, number> = {3:42,4:50,5:58,6:62,7:73,8:81};
  return [[boss, -wall], ...(second[wall] === undefined ? [] : [[second[wall], -wall] as [number, number]])];
};

// 道の曲がり角（a から b へ向かう順）
export const roadBends = (terrain: WallTerrain | undefined, a: number, b: number): Pt[] => {
  const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
  const fallback: Record<string, Pt[]> = {'-7-74': [[38, 1], [38, 13]], '-7-73': [[62, 1], [90, 1], [90, 29]]};
  const bends = terrain?.bends?.[key] ?? fallback[key] ?? [];
  return a <= b ? bends : [...bends].reverse();
};

// 外形の点をなめらかにつないだ SVG パス（辺の中点を通り、角を制御点にする）
export const smoothPath = (points: Pt[]): string => {
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const n = points.length;
  const start = mid(points[n - 1], points[0]);
  let d = `M${start[0]},${start[1]}`;
  for (let i = 0; i < n; i += 1) {
    const m = mid(points[i], points[(i + 1) % n]);
    d += ` Q${points[i][0]},${points[i][1]} ${m[0]},${m[1]}`;
  }
  return `${d} Z`;
};
