// ヒドイメの見た目の部品を、生成時に一度だけ組み立てる。
// 乱数の呼び出し順は見本（docs/hidoime/preview/poison.js）と同じにしてあり、
// seed=714 なら見本とまったく同じ配置・時間差になる。
// 寸法はすべて 96px 基準。実際の大きさはコンポーネント側で拡大縮小する。

export type HidoimeVariant = 'rose' | 'violet';

export const HIDOIME_BASE = 96;

const INK: Record<HidoimeVariant, string[]> = {
  rose: ['#e14caa', '#cf387b', '#a744d6', '#dc62bc', '#ad388e'],
  violet: ['#735bea', '#4b65dc', '#954ce0', '#7974ed', '#6649c8'],
};
// 青紫の泡は一度明るくし過ぎたため調整済みの値。赤紫は奥の円と同じ
const BUBBLE_INK: Record<HidoimeVariant, string[]> = {
  rose: INK.rose,
  violet: ['#9382df', '#6e87df', '#a37bdf', '#949bdf', '#806bce'],
};

const DEPTHS: [number, number, number][] = [
  [-12, 4, 54],
  [28, -14, 64],
  [59, 17, 43],
  [8, 36, 48],
  [36, 29, 59],
  [-8, 66, 39],
  [43, 67, 51],
  [70, 54, 34],
];
const INK_POSITIONS: [number, number][] = [
  [12, 12],
  [21, 17],
  [43, 5],
  [50, 12],
  [72, 16],
  [78, 24],
  [5, 38],
  [13, 43],
  [34, 30],
  [42, 37],
  [65, 42],
  [73, 47],
  [17, 64],
  [24, 70],
  [43, 57],
  [51, 64],
  [72, 73],
  [78, 80],
  [7, 82],
  [34, 83],
  [55, 83],
  [84, 53],
  [29, 49],
  [59, 22],
  [46, 46],
];

export type DepthCircle = {
  x: number;
  y: number;
  size: number;
  ink: string;
  duration: number;
  delay: number;
  dx: number;
};
export type InkBubble = {
  x: number;
  y: number;
  size: number;
  ink: string;
  angle: number;
  duration: number;
  delay: number;
};
export type Mote = { x: number; y: number; size: number; duration: number; delay: number };
export type BurstChild = { size: number; lag: number; cx: number; cy: number };
export type BurstFamily = {
  sx: number;
  sy: number;
  size: number;
  start: number;
  tx: number;
  ty: number;
  ink: string;
  flight: number;
  children: BurstChild[];
};
export type Spark = {
  tx: number;
  ty: number;
  size: number;
  ink: string;
  start: number;
  flight: number;
};

export type HidoimeParts = {
  depths: DepthCircle[];
  inks: InkBubble[];
  motes: Mote[];
  families: BurstFamily[];
  sparks: Spark[];
  rimPath: string;
};

// 不規則によれた内側の細線。96点から滑らかな曲線を作る（固定形状なので一度だけ）
const RIM_PATH = (() => {
  const points = Array.from({ length: 96 }, (_, i) => {
    const a = (i * Math.PI * 2) / 96;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const ripple =
      0.55 * Math.sin(a * 17) + 0.32 * Math.sin(a * 29 + 1.3) + 0.22 * Math.cos(a * 11);
    return [
      48 + (43 + ripple) * Math.sign(c) * Math.pow(Math.abs(c), 0.48),
      48 + (43 + ripple) * Math.sign(s) * Math.pow(Math.abs(s), 0.48),
    ];
  });
  const mid = (a: number[], b: number[]) =>
    `${((a[0] + b[0]) / 2).toFixed(2)},${((a[1] + b[1]) / 2).toFixed(2)}`;
  return (
    `M${mid(points[95], points[0])}` +
    points
      .map((p, i) => `Q${p[0].toFixed(2)},${p[1].toFixed(2)} ${mid(p, points[(i + 1) % 96])}`)
      .join('') +
    'Z'
  );
})();

export const buildHidoimeParts = (variant: HidoimeVariant, seed = 714): HidoimeParts => {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const ink = INK[variant];
  const bubbleInk = BUBBLE_INK[variant];

  const depths = DEPTHS.map(([x, y, size], i) => ({
    x,
    y,
    size,
    ink: ink[i % ink.length],
    duration: 5 + i * 0.63,
    delay: -i * 0.87,
    dx: i % 2 ? 8 : -7,
  }));

  const inks = INK_POSITIONS.map(([x, y], i) => {
    const size = 9 + random() * 8;
    random(); // 見本の --thick（未使用）。乱数の並びを見本と揃えるために消費する
    const angle = random() * 360;
    const duration = 1.6 + random() * 2.2;
    const delay = -random() * 7;
    return { x, y, size, ink: bubbleInk[i % bubbleInk.length], angle, duration, delay };
  });

  const motes = Array.from({ length: 6 }, () => {
    const x = 10 + random() * 70;
    const y = 20 + random() * 70;
    const size = 2 + random() * 3;
    const duration = 2 + random() * 3;
    const delay = -random() * 5;
    return { x, y, size, duration, delay };
  });

  // 周辺へ散る親5個＋中央の親1個。それぞれ子4個に分裂する
  const families = Array.from({ length: 6 }, (_, i) => {
    const center = i === 5;
    const angle = (i * Math.PI * 2) / 5 - 0.8 + random() * 0.2;
    const distance = center ? 10 : 58 + random() * 32;
    const size = (center ? 29 : 19.2) * (0.85 + random() * 0.3);
    const start = 0.1 + random() * 0.12;
    const flight = 1.15 + random() * 0.4;
    const children = Array.from({ length: 4 }, (_, j) => {
      const spread = center
        ? (j * Math.PI) / 2 + random() * 0.5
        : angle + (j - 1.5) * 0.8 + random() * 0.3;
      const reach = 18 + random() * 18;
      const childSize = 8 * (0.85 + random() * 0.3);
      const lag = random() * 0.07;
      return { size: childSize, lag, cx: Math.cos(spread) * reach, cy: Math.sin(spread) * reach };
    });
    return {
      sx: center ? 0 : Math.cos(angle) * 18,
      sy: center ? 0 : Math.sin(angle) * 18,
      size,
      start,
      tx: Math.cos(angle) * distance,
      ty: Math.sin(angle) * distance,
      ink: bubbleInk[i % bubbleInk.length],
      flight,
      children,
    };
  });

  const sparks = Array.from({ length: 11 }, (_, i) => {
    const a = random() * Math.PI * 2;
    const distance = 45 + random() * 65;
    const size = 15 + random() * 12;
    const start = 0.14 + random() * 0.2;
    const flight = 0.55 + random() * 0.45;
    return {
      tx: Math.cos(a) * distance,
      ty: Math.sin(a) * distance,
      size,
      ink: bubbleInk[i % bubbleInk.length],
      start,
      flight,
    };
  });

  return { depths, inks, motes, families, sparks, rimPath: RIM_PATH };
};

// HPの段階 → 満タン比の密度係数。線形ではなく調整済みの値（仕様書 4章）
const DENSITY = [0, 0.1, 0.2, 0.54, 0.8, 1];

// 1〜20 は20%段階、21〜40 は40%段階…（暫定方式。仕様書 4章）
export const hidoimeStage = (hpPercent: number) =>
  Math.ceil(Math.max(0, Math.min(100, hpPercent)) / 20);

// 表示する粒の添字の集合。7 と互いに素な並びで間引き、一か所だけ空かないようにする。
// HPが変わっても配置は動かさず、表示・非表示だけを切り替える
export const visibleIndices = (length: number, stage: number) => {
  const count = Math.round(length * DENSITY[stage]);
  const order = Array.from({ length }, (_, i) => ({ i, rank: (i * 7) % length })).sort(
    (a, b) => a.rank - b.rank,
  );
  return new Set(order.slice(0, count).map((item) => item.i));
};
