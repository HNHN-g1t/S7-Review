// アンチクショウメの共通描画。正本は public/enemy-design/anchikushoume.html（docs/anchikushoume/DESIGN.md）。
// 目の位置・被弾判定・移動の時刻は呼び出し側が管理し、この部品では補間しない。
// 見本は 1マス80px の座標で描いているので、ここでも 80px 基準で描いてから、渡されたマスの大きさへ縮める。
import { useEffect, useRef } from 'react';

const C = 80; // 見本の1マス
const MARGIN = 1.5; // 触手が伸びるぶんの余白（マス）
const COLORS = ['#ff4f9c', '#30d7e8', '#b28aff', '#ffd44c', '#96e353'];
// キャッシュした形を大小で混ぜる。毎フレーム輪郭を組み立てない。
const SIZES = [5, 9, 16, 30, 46, 7, 22];
const MOTIFS = (() => {
  const oval = new Path2D(); oval.ellipse(0, 0, 1, 0.7, 0, 0, Math.PI * 2);
  const tile = new Path2D(); tile.roundRect(-0.9, -0.65, 1.8, 1.3, 0.3);
  const triangle = new Path2D(); triangle.moveTo(0, -0.9); triangle.quadraticCurveTo(0.15, -1, 0.3, -0.7); triangle.lineTo(0.9, 0.5); triangle.quadraticCurveTo(1, 0.7, 0.7, 0.7); triangle.lineTo(-0.7, 0.7); triangle.quadraticCurveTo(-1, 0.7, -0.85, 0.4); triangle.closePath();
  const bean = new Path2D(); bean.moveTo(-0.9, 0); bean.bezierCurveTo(-0.9, -1, 0.4, -1, 0.8, -0.4); bean.bezierCurveTo(1.3, 0.4, 0.2, 0.1, 0, 0.7); bean.bezierCurveTo(-0.3, 1.1, -1, 0.7, -0.9, 0); bean.closePath();
  return [oval, tile, triangle, bean];
})();

// ぼかしは初期化時の小さな画像だけに適用し、毎フレームのfilterを避ける。
const MOTIF_IMAGES = MOTIFS.map(motif => COLORS.map(color => [false, true].map(() => {
  const image = document.createElement('canvas'); image.width = image.height = 144;
  const ctx = image.getContext('2d')!;
  ctx.translate(72, 72); ctx.scale(48, 48);
  ctx.filter = 'blur(2.5px)'; ctx.fillStyle = color; ctx.fill(motif);
  return image;
})));

function drawTexture(g: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, time: number, salt = 0, recoil = 0) {
  const hash = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  for (let row = -3; row < height / 40 + 4; row++) for (let col = -3; col < width / 40 + 4; col++) {
    const seed = col * 917 + row * 1913 + salt * 101;
    const size = SIZES[Math.floor(hash(seed + 2) * SIZES.length)];
    const speed = (size >= 30 ? 0.65 : 1.4) * (0.75 + hash(seed + 3) * 0.5);
    const layer = Math.floor(hash(seed + 12) * 4);
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const shift = directions[layer];
    const px = x + shift[0] * recoil + col * 40 + (hash(seed + 4) - 0.5) * 38 + Math.sin(time * speed + hash(seed + 5) * 6.28) * 17;
    const py = y + shift[1] * recoil + row * 40 + (hash(seed + 6) - 0.5) * 38 + Math.cos(time * speed * (0.8 + hash(seed + 7) * 0.4) + hash(seed + 8) * 6.28) * 21;
    const colorIndex = Math.floor(hash(seed + 11) * COLORS.length);
    const r = size * 1.16 * (colorIndex === 0 ? 1.5 : 1) * (1 + Math.sin(time * speed + seed) * 0.06);
    g.save(); g.translate(px, py); g.rotate(hash(seed + 9) * 6.28 + Math.sin(time * 0.45 + seed) * 0.12); g.scale(r, r);
    const motifIndex = Math.floor(hash(seed + 10) * MOTIFS.length);
    const soft = 1;
    g.drawImage(MOTIF_IMAGES[motifIndex][colorIndex][soft], -1.5, -1.5, 3, 3); g.restore();
  }
}

type Tentacle = { angle: number; length: number; delay: number; cycle: number };
type BodyAnimation = {
  tentacles: Tentacle[];
  baseTentacles: number;
  shown: number;
  tentaclePhase: number;
  textureTime: number;
  wasHit: boolean;
  hitTone: 'white' | 'thunder';
  hitStart: number;
};

type Props = {
  w: number; // 横のマス数（1〜4）
  h: number; // 縦のマス数（1〜4）
  eye: { x: number; y: number }; // 身体の左上からの目の中心。移動中は小数（判定と共有）
  cell: number; // 1マスの大きさ（px）
  paused?: boolean;
  hit?: boolean;
  hitTone?: 'white' | 'thunder';
};

export function Anchikushoume({ w, h, eye, cell, paused = false, hit = false, hitTone = 'white' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({ w, h, eye, cell, paused, hit, hitTone });
  propsRef.current = { w, h, eye, cell, paused, hit, hitTone };
  // 目の移動・成長・セルのリサイズで絵の時刻や触手を作り直さない。
  const animationRef = useRef<BodyAnimation>({
    tentacles: [], baseTentacles: 0, shown: 0, tentaclePhase: 0,
    textureTime: 0, wasHit: false, hitTone: 'white', hitStart: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g) return;
    const animation = animationRef.current;
    let frame = 0;
    let last = performance.now();
    let lastDrawn: typeof propsRef.current | null = null;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // 背景タブではRAF自体が止まることがある。非表示中に1フレームも来なくても
    // 復帰の時刻から再開して、模様と触手が一気に先へ飛ばないようにする。
    const syncVisibilityClock = () => { last = performance.now(); };
    document.addEventListener('visibilitychange', syncVisibilityClock);

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const current = propsRef.current;
      const { w, h, eye, cell, paused, hit, hitTone } = current;
      if (document.hidden) {
        last = now;
        return;
      }
      const delta = paused ? 0 : Math.max(0, (now - last) / 1000);
      last = now;
      // 停止中も初回／見本の変更は描く。変わらない停止画面は描き直さない。
      if (paused && lastDrawn && lastDrawn.w === w && lastDrawn.h === h && lastDrawn.cell === cell
        && lastDrawn.eye.x === eye.x && lastDrawn.eye.y === eye.y
        && lastDrawn.hit === hit && lastDrawn.hitTone === hitTone) return;
      lastDrawn = { ...current, eye: { ...eye } };
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = Math.round((w + MARGIN * 2) * cell * dpr);
      const ch = Math.round((h + MARGIN * 2) * cell * dpr);
      if (canvas.width !== cw) canvas.width = cw;
      if (canvas.height !== ch) canvas.height = ch;
      const k = (cell / C) * dpr;
      animation.shown += delta;
      const time = animation.shown;
      if (hit && (!animation.wasHit || animation.hitTone !== hitTone)) animation.hitStart = time;
      animation.wasHit = hit;
      animation.hitTone = hitTone;
      const hurt = hit;
      if (!hurt) animation.textureTime += delta;
      // 被弾の立ち上がりで一度だけ再生。図鑑側が通常／被弾を交互に渡す。
      const hitPhase = time - animation.hitStart;
      const offsets = [[0,0],[-9,0],[9,0],[0,-8],[0,8],[-5,0],[5,0],[0,0]];
      const offset = hurt && !reducedMotion && hitPhase < 0.38 ? offsets[Math.min(7, Math.floor(hitPhase / 0.048))] : offsets[0];
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.setTransform(k, 0, 0, k, 0, 0);

      // 身体と触手は1つの輪郭・同じ模様の座標で描く（付け根で模様が切れない）
      const x = MARGIN * C + 3;
      const y = MARGIN * C + 3;
      const bw = w * C - 6;
      const bh = h * C - 6;
      const silhouette = new Path2D();
      silhouette.roundRect(x, y, bw, bh, Math.min(24, bw * 0.28));
      const growth = Math.max(0, Math.min(3, Math.min(w, h) - 1));
      const period = 1.12 / (1.25 ** growth);
      // 周期で時刻を割り直すと成長時に位相が飛ぶため、位相を積分する。
      animation.tentaclePhase += delta / period;
      if (animation.baseTentacles === 0) animation.baseTentacles = 4 + Math.floor(Math.random() * 2);
      const count = animation.baseTentacles + [0, 1, 2, 4][growth];
      while (animation.tentacles.length < count) {
        const i = animation.tentacles.length;
        animation.tentacles.push({
          angle: i < 4 ? i * Math.PI / 2 : Math.PI / 4 + (i - 4) * Math.PI / 2.5,
          length: 0.5 + Math.random() * 1.5,
          delay: (i % 3) / 3 + Math.random() * 0.025,
          cycle: -1,
        });
      }
      for (let i = 0; i < count; i += 1) {
        const t = animation.tentacles[i];
        const localTime = animation.tentaclePhase + t.delay;
        const localCycle = Math.floor(localTime);
        const p = localTime - localCycle;
        // 個々の触手が縮んでいる境界でだけ更新。3組を同時にリセットしない。
        if (localCycle !== t.cycle) {
          t.cycle = localCycle;
          t.length = 0.5 + Math.random() * 1.5;
        }
        // 素早く出す → 少し止める → シュッと引っ込める → すぐ次
        const reach = p < 0.22 ? 1 - (1 - p / 0.22) ** 3 : p < 0.66 ? 1 : p < 0.84 ? (1 - (p - 0.66) / 0.18) ** 2 : 0;
        const a = t.angle + Math.sin(time * 0.5) * 0.1;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        const edge = Math.min((bw / 2 - 9) / Math.max(0.001, Math.abs(dx)), (bh / 2 - 9) / Math.max(0.001, Math.abs(dy)));
        const ex = x + bw / 2 + dx * edge;
        const ey = y + bh / 2 + dy * edge;
        const len = (5 + reach * 48) * t.length;
        const arm = new Path2D();
        arm.moveTo(-14, -12);
        arm.quadraticCurveTo(len * 0.55, -8, len, 0);
        arm.quadraticCurveTo(len * 0.55, 8, -14, 12);
        arm.closePath();
        silhouette.addPath(arm, new DOMMatrix([dx, dy, -dy, dx, ex, ey]));
      }
      g.save();
      g.shadowColor = '#04081799';
      g.shadowBlur = 18;
      g.shadowOffsetY = 7;
      g.fillStyle = '#f4f1eb';
      g.fill(silhouette);
      g.restore();

      // 疎な大小の色面。大柄はゆっくり、小柄だけ少し動かして白い余白を残す。
      g.save();
      g.clip(silhouette);
      drawTexture(g, x, y, bw, bh, animation.textureTime, 0, offset[0] + offset[1]);
      if (hurt && hitTone === 'thunder' && (reducedMotion || Math.floor(hitPhase / 0.16) % 2 === 0)) {
        g.fillStyle = '#ffe45c'; g.fill(silhouette);
      } else if (hurt && hitTone === 'white' && hitPhase < 0.07) {
        g.fillStyle = '#fff'; g.fill(silhouette);
      }
      g.restore();

      // 一つ目。細めの目でニターッと止まり（3秒）、ぱっと開いて全開で止まる（約3.4秒）
      const ex = (MARGIN + eye.x + 0.5) * C;
      const ey = (MARGIN + eye.y + 0.5) * C;
      g.save();
      g.translate(ex, ey);
      g.shadowBlur = 0;
      g.fillStyle = '#13131d';
      g.beginPath();
      g.ellipse(0, 0, 28, 26, 0, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      const eyeCycle = time % 7.225;
      const smile = eyeCycle < 0.6 ? eyeCycle / 0.6 : eyeCycle < 3.6 ? 1 : eyeCycle < 3.85 ? 1 - (eyeCycle - 3.6) / 0.25 : 0;
      const aperture = 20.8 - 12 * smile;
      g.rotate(Math.PI);
      if (hurt) g.scale(1, 0.2);
      g.beginPath();
      g.moveTo(-20, -3 * smile);
      g.quadraticCurveTo(0, -aperture + 11 * smile, 20, -3 * smile);
      g.quadraticCurveTo(0, aperture + 11 * smile, -20, -3 * smile);
      g.closePath();
      g.fillStyle = '#fff';
      g.fill();
      g.save();
      g.clip();
      g.fillStyle = '#11121c';
      g.beginPath();
      g.ellipse(Math.sin(time * 0.8) * 4, 1, 4, 12, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.restore();
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', syncVisibilityClock);
    };
  }, []);

  return (
    <canvas
      aria-hidden
      ref={canvasRef}
      style={{
        position: 'absolute',
        left: -MARGIN * cell,
        top: -MARGIN * cell,
        width: (w + MARGIN * 2) * cell,
        height: (h + MARGIN * 2) * cell,
        pointerEvents: 'none',
      }}
    />
  );
}

// 同じ多色模様のペンキ。輪郭だけを9例で比較（大小の円・楕円＋中小飛沫）。
export const PAINT_SHAPE_SIZES = ['1×1', '1.5×1', '2×1', '1×1.5', '1.5×1.5', '2×1.5', '1×2', '1.5×2', '2×2'];
export function PaintSample({ shape, cell, showPile = false, paused = false }: { shape: number; cell: number; showPile?: boolean; paused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const box = 4.8;
  useEffect(() => {
    const canvas = canvasRef.current; const g = canvas?.getContext('2d'); if (!canvas || !g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(box * cell * dpr); canvas.height = Math.round(box * cell * dpr);
    g.setTransform(cell / C * dpr, 0, 0, cell / C * dpr, box * cell * dpr / 2, box * cell * dpr / 2);
    const width = [1, 1.5, 2][shape % 3] * C;
    const height = [1, 1.5, 2][Math.floor(shape / 3)] * C;
    if (showPile) {
      const pipSets = [[[0.5,0.5]],[[0.28,0.28],[0.72,0.72]],[[0.28,0.28],[0.5,0.5],[0.72,0.72]],[[0.28,0.28],[0.72,0.28],[0.28,0.72],[0.72,0.72]],[[0.28,0.28],[0.72,0.28],[0.5,0.5],[0.28,0.72],[0.72,0.72]],[[0.28,0.28],[0.72,0.28],[0.28,0.5],[0.72,0.5],[0.28,0.72],[0.72,0.72]]];
      const colors = ['#fc6dac','#8b46d2','#43ae39','#43ae39','#8b46d2','#fc6dac'];
      for (let col = 0; col < 3; col++) for (let row = col === 1 ? 0 : 1; row < 3; row++) {
        const value = (row * 3 + col) % 6;
        const x = (col - 1.5) * C, y = (row - 1.5) * C;
        g.fillStyle = colors[value]; g.beginPath(); g.roundRect(x + 2,y + 2,C - 4,C - 4,19); g.fill();
        g.fillStyle = value === 1 || value === 4 ? '#330066' : '#fff';
        for (const [px,py] of pipSets[value]) { g.beginPath(); g.arc(x + px*C,y + py*C,6,0,Math.PI*2); g.fill(); }
      }
    }
    // 背景とサイは一度だけ描画して保存。ペンキは輪郭が動くので毎フレーム描く
    const base = document.createElement('canvas');
    base.width = canvas.width; base.height = canvas.height;
    base.getContext('2d')!.drawImage(canvas, 0, 0);
    let frame = 0, shown = 0, last = performance.now();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const stopped = pausedRef.current || document.hidden || reduced;
      if (!stopped) shown += (now - last) / 1000;
      last = now;
      if (stopped && shown > 0) return;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height); g.drawImage(base, 0, 0);
      g.setTransform(cell / C * dpr, 0, 0, cell / C * dpr, box * cell * dpr / 2, box * cell * dpr / 2);
      // 1秒ループで、塊がうねうね外へ伸び縮みし、飛沫は粒ごとに距離が変わる
      const blob = paintOutline(width, height, shape, shown % PAINT_LOOP_S);
      g.save(); g.translate(0, 8); g.fillStyle = '#45566c'; g.fill(blob); g.restore();
      g.fillStyle = '#f4f1eb'; g.fill(blob);
      g.save(); g.clip(blob); drawTexture(g, -width / 2, -height / 2, width, height, shown, shape + 3); g.restore();
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [shape, cell, showPile]);
  return <canvas aria-hidden ref={canvasRef} style={{ width: box * cell, height: box * cell, display: 'block' }} />;
}

// ペンキのうねりの1周（秒）。どの動きも1秒で1周するので、ちょうど1秒でループする
const PAINT_LOOP_S = 1;

// t はループの中の時刻（0〜PAINT_LOOP_S）。0 のときが元の形
function paintOutline(width: number, height: number, seed: number, t = 0) {
  const turn = (t / PAINT_LOOP_S) * Math.PI * 2;
  // 2セル枠の主塊が約2セル幅に達するよう拡張（旧外形比1.8倍）。
  const sx = width >= 160 ? 1.8 : width >= 120 ? 1.35 : 1;
  const sy = height >= 160 ? 1.8 : height >= 120 ? 1.35 : 1;
  const blob = new Path2D();
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.399 + seed * 0.73;
    // 塊ごとに位相をずらして、外へ伸びたり縮んだりする（中心の塊はふくらむだけ）
    const reach = 1 + 0.16 * Math.sin(turn + i * 1.31 + seed);
    const swell = 1 + (i === 0 ? 0.04 : 0.09) * Math.sin(turn + i * 2.17 + seed * 0.5 + 1);
    const cx = i === 0 ? 0 : Math.cos(angle) * width * (0.16 + (i % 3) * 0.055) * reach;
    const cy = i === 0 ? 0 : Math.sin(angle) * height * (0.16 + ((i + 1) % 3) * 0.05) * reach;
    const rx = width * (i === 0 ? 0.31 : 0.12 + (i % 3) * 0.055) * swell;
    const ry = height * (i === 0 ? 0.3 : 0.12 + ((i + 1) % 3) * 0.05) * swell;
    blob.moveTo(cx + rx, cy); blob.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  }
  for (let i = 0; i < 10; i++) {
    const angle = i * 2.399 + seed * 0.61;
    const radius = [2.5, 5, 9, 13, 3, 7, 11, 4, 8, 3][i];
    // 飛沫は粒ごとに、離れる距離の幅（4〜12px）と位相を変える
    const drift = (4 + (i * 37 % 9)) * Math.sin(turn + i * 1.73 + seed * 0.9);
    const cx = Math.cos(angle) * (width * 0.48 + 7 + (i % 3) * 5 + drift);
    const cy = Math.sin(angle) * (height * 0.48 + 7 + ((i + 1) % 3) * 5 + drift);
    blob.moveTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)); blob.ellipse(cx, cy, radius, radius * (0.6 + (i % 3) * 0.2), angle, 0, Math.PI * 2);
  }
  const expanded = new Path2D();
  expanded.addPath(blob, new DOMMatrix([sx, 0, 0, sy, 0, 0]));
  return expanded;
}
