// ベラボウメの見た目（17メン）。正本は public/enemy-design/beraboume.html（docs/beraboume/DESIGN.md の採用版）。
// 見本の SVG をそのまま React に移したもの。部品は固定数で、毎フレームの JS や乱数は使わない。
// ゲームでは9つの目が HP を表すので、見本の「目が勝手に出たり消えたりする」周期は使わず、
//   ・登場：目が 0 → 0.72 → 1.14 → 1 と均等に広がり、まぶたが閉 → 半円 → 全円へパチッと開く
//   ・生きている目：見本と同じ周期・位相でまばたきし、きょろきょろ視線を動かす
//   ・つぶれた目：まぶたが閉じながら、右下の奥へ 1 → 0.82 → 0.38 → 0.08 → 0 と縮んで消える
// 動きは src/enemy/beraboume.css。
import { memo, useId, type CSSProperties } from "react";
import "./beraboume.css";

export type BeraboumeVariant = "orange" | "lime";

// 144px 基準。9眼の座標は見本と同じ（左上から右下へ、行ごとに3つずつ）
const EYES = [
  { x: 35, y: 34, w: 31, a: -12, cycle: 5.8, offset: -1.9 },
  { x: 75, y: 29, w: 29, a: 8, cycle: 7.1, offset: -4.4 },
  { x: 110, y: 39, w: 30, a: 19, cycle: 6.4, offset: -0.7 },
  { x: 30, y: 74, w: 28, a: 9, cycle: 8.2, offset: -5.1 },
  { x: 73, y: 71, w: 38, a: -4, cycle: 6.9, offset: -3 },
  { x: 112, y: 79, w: 27, a: -17, cycle: 5.6, offset: -4.2 },
  { x: 36, y: 108, w: 30, a: -16, cycle: 7.7, offset: -0.3 },
  { x: 76, y: 114, w: 32, a: 12, cycle: 6.2, offset: -2.7 },
  { x: 108, y: 110, w: 26, a: -7, cycle: 8.6, offset: -6 },
];

// 1辺につき約2回波打つ角丸スライム形
const CONTOUR =
  "M24 7C32 3 40 3 48 7S64 11 72 7S88 3 96 7S112 11 120 7Q137 5 137 24C141 32 141 40 137 48S133 64 137 72S141 88 137 96S133 112 137 120Q139 137 120 137C112 141 104 141 96 137S80 133 72 137S56 141 48 137S32 133 24 137Q7 139 7 120C3 112 3 104 7 96S11 80 7 72S3 56 7 48S11 32 7 24Q5 7 24 7Z";
const INNER = CONTOUR.replace(/\d+/g, (n) =>
  (72 + (Number(n) - 72) * 0.89).toFixed(2),
);
const EYE_SHAPE = "M14 0A14 14 0 1 0-14 0A14 14 0 1 0 14 0Z";

// 残り1つの目に浮かぶ、血走った赤い線。白目のふちから黒目へ向かって、少し曲がりながら伸びる
const VEINS = [18, 74, 128, 196, 248, 306]
  .map((deg, i) => {
    const a = (deg * Math.PI) / 180;
    const p = (r: number, da = 0) =>
      `${(Math.cos(a + da) * r).toFixed(2)} ${(Math.sin(a + da) * r).toFixed(2)}`;
    const bend = i % 2 === 0 ? 0.28 : -0.28;
    // 本筋と、途中から分かれる短い枝
    return `M${p(14.5)}Q${p(11.5, bend)} ${p(9.2, bend * 0.4)}M${p(12.2, bend * 0.8)}L${p(11, bend * 1.9)}`;
  })
  .join("");

const PALETTE = {
  orange: {
    accent: "#ffc04a",
    eyes: ["#ffab32", "#ffd05a", "#ff8524"],
    eyeShadow: "#1d1611",
    bevel: ["#ffd17c", "#f49a2e", "#b65314", "#632e15"],
    facet: ["#ffad32", "#d55914"],
    skin: ["#e88424", "#b8551c", "#71361e"],
    corner: "#ffe6aa",
    innerStroke: "#91400f",
  },
  lime: {
    accent: "#d2ff4b",
    eyes: ["#c4ff32", "#deff69", "#9ff02b"],
    eyeShadow: "#131b11",
    bevel: ["#dcff83", "#8ac52b", "#467f1d", "#244716"],
    facet: ["#b7f33d", "#509b29"],
    skin: ["#75b42b", "#407d24", "#234d23"],
    corner: "#efffb6",
    innerStroke: "#376b20",
  },
} as const;

// 大きい三角・矩形・円。見本（採用デザイン）の8個はそのまま残し、
// 柄を回すと見えてくる空いた所に、同じくらいの間隔で同じ形を足す（2026-10-02）。
// 位置は決まった式で作るので、毎回同じ柄になる（乱数は使わない）
type TexturePart = { x: number; y: number; s: number; kind: number; rotate: number };
const TEXTURE_BASE: TexturePart[] = Array.from({ length: 8 }, (_, i) => ({
  x: -24 + ((i * 53) % 150),
  y: -28 + ((i * 71) % 152),
  s: 28 + (i % 4) * 12,
  kind: i % 3,
  rotate: i * 23,
}));
const TEXTURE_GAP = 34; // ほかの形の中心と、これより近い所には足さない（見本と同じくらいの密度になる）
const TEXTURE_REACH = 110; // 回しても本体の四すみまで届くよう、中心からこの半径の中を埋める
const textureCenter = (t: TexturePart) => ({ x: t.x + t.s * 0.6, y: t.y + t.s * 0.6 });
const TEXTURE: TexturePart[] = (() => {
  const parts = [...TEXTURE_BASE];
  for (let row = 0; row < 7; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      const i = row * 7 + col;
      const part: TexturePart = {
        x: -70 + col * 38 + ((i * 37) % 15) - 7,
        y: -70 + row * 38 + ((i * 53) % 15) - 7,
        s: 28 + ((i + row) % 4) * 12,
        kind: (col + row * 2) % 3,
        rotate: i * 23,
      };
      const c = textureCenter(part);
      if (Math.hypot(c.x - 72, c.y - 72) > TEXTURE_REACH) continue;
      const roomy = parts.every((other) => {
        const o = textureCenter(other);
        return Math.hypot(o.x - c.x, o.y - c.y) > TEXTURE_GAP;
      });
      if (roomy) parts.push(part);
    }
  }
  return parts;
})();

type Props = {
  variant: BeraboumeVariant;
  lost: ReadonlySet<number>; // つぶれた目（0〜8）
  entering?: boolean; // 登場の最中（目が広がって開く）
  reopen?: number; // いま開き直った目（放っておかれて回復した）。登場と同じ動きで開く
  hit?: boolean; // ダメージ中。本体と、生きている目を別々に震わせる
};

function BeraboumeImpl({
  variant,
  lost,
  entering = false,
  reopen,
  hit = false,
}: Props) {
  // 残り1つになった目は、2倍に大きくなって血走る
  const lastEye =
    lost.size === EYES.length - 1 ? EYES.findIndex((_, i) => !lost.has(i)) : -1;
  // 同じ色の個体が並んでも defs の ID がぶつからないよう、個体ごとに一意にする
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `bera-${uid}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;
  const lime = variant === "lime";
  const c = PALETTE[variant];

  return (
    <svg
      className={`beraboume ${entering ? "is-entering" : ""} ${hit ? "is-hit" : ""}`}
      viewBox="0 0 144 144"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter
          colorInterpolationFilters="sRGB"
          height="180%"
          id={id("eye-shadow")}
          width="180%"
          x="-40%"
          y="-40%"
        >
          <feGaussianBlur stdDeviation="1.7" />
        </filter>
        <linearGradient id={id("bevel")} x2=".8" y2="1">
          <stop stopColor={c.bevel[0]} />
          <stop offset=".43" stopColor={c.bevel[1]} />
          <stop offset=".6" stopColor={c.bevel[2]} />
          <stop offset="1" stopColor={c.bevel[3]} />
        </linearGradient>
        <linearGradient id={id("facet")} x2="1" y2="1">
          <stop stopColor={c.facet[0]} stopOpacity=".7" />
          <stop offset="1" stopColor={c.facet[1]} stopOpacity=".2" />
        </linearGradient>
        <radialGradient id={id("pool")}>
          <stop stopColor={c.accent} stopOpacity=".4" />
          <stop offset="1" stopColor={c.accent} stopOpacity="0" />
        </radialGradient>
        <radialGradient cx="38%" cy="30%" id={id("skin")} r="85%">
          <stop stopColor={c.skin[0]} />
          <stop offset=".56" stopColor={c.skin[1]} />
          <stop offset="1" stopColor={c.skin[2]} />
        </radialGradient>
        <radialGradient cx="35%" cy="25%" id={id("sclera")}>
          <stop stopColor="#fff9ff" />
          <stop offset=".75" stopColor="#f0e1f7" />
          <stop offset="1" stopColor="#c9b2df" />
        </radialGradient>
        <clipPath id={id("body-clip")}>
          <path d={INNER} />
        </clipPath>
        <clipPath id={id("eye-clip")}>
          <path d={EYE_SHAPE} />
        </clipPath>
      </defs>
      {/* 本体。ダメージのときはここだけが震える（目の層は外に分けてあるので動かない） */}
      <g className="bera-body">
        <path
          d={CONTOUR}
          fill="#090911"
          opacity=".8"
          transform="translate(1 3)"
        />
        <path
          d={CONTOUR}
          fill={url("bevel")}
          stroke="#292e2b"
          strokeWidth=".8"
        />
        <path d="M7 24Q5 7 24 7L29 14Q15 13 14 29Z" fill={c.corner} />
        <path
          d={INNER}
          fill={url("skin")}
          stroke={c.innerStroke}
          strokeWidth=".6"
        />
        <g clipPath={url("body-clip")}>
          {/* 下地の柄は、ゆっくり回して動きを出す（部品は8個だけ。回すのは外側の1グループ） */}
          <g className="bera-texture">
            {/* グリーンは模様を180度回してトリミングを変える（目は回さない） */}
            <g
              transform={
                lime
                  ? "translate(144 151) rotate(180) translate(-10 7)"
                  : undefined
              }
            >
              {TEXTURE.map((t, i) => (
                <g
                  key={i}
                  transform={`translate(${t.x} ${t.y}) rotate(${t.rotate})`}
                >
                  {t.kind === 0 ? (
                    <path
                      d={`M0 ${t.s}L${t.s} 0L${t.s * 1.6} ${t.s * 1.4}Z`}
                      fill={url("facet")}
                    />
                  ) : t.kind === 1 ? (
                    <rect fill={url("facet")} height={t.s} width={t.s * 1.4} />
                  ) : (
                    <circle fill={url("pool")} r={t.s * 0.7} />
                  )}
                </g>
              ))}
            </g>
          </g>
        </g>
      </g>
      {/* 目の層。本体の外に置き、本体が揺れても座標をとどめる */}
      <g className="bera-eyes">
        {EYES.map((e, i) => {
          const iris = c.eyes[i % 3];
          const offset = e.offset - (lime ? 1.7 + i * 0.07 : 0);
          return (
            <g
              key={i}
              transform={`translate(${e.x} ${e.y}) rotate(${e.a}) scale(${e.w / 34})`}
            >
              <g
                className={`bera-eye ${lost.has(i) ? "is-lost" : reopen === i ? "is-reopen" : ""} ${
                  lastEye === i ? "is-last" : ""
                }`}
                style={
                  {
                    "--cycle": `${e.cycle}s`,
                    "--offset": `${offset}s`,
                    "--gaze": `${3.7 + i * 0.23}s`,
                    "--in-delay": `${80 + i * 45}ms`,
                  } as CSSProperties
                }
              >
                {/* 残り1つのときは、この中身ごと2倍にする（登場・消える動きの拡大縮小とは別の層） */}
                <g className="bera-eye-jolt">
                <g className="bera-eye-size">
                  {/* 目の奥の影。目と一緒に拡大縮小し、まぶたのクリップの外に置く */}
                  <circle
                    cx="3"
                    cy="5"
                    fill={c.eyeShadow}
                    filter={url("eye-shadow")}
                    r="16.5"
                  />
                  <g className="bera-lid">
                    <path
                      d={EYE_SHAPE}
                      fill="#321c4b"
                      opacity=".35"
                      transform="translate(0 1.5)"
                    />
                    <path
                      d={EYE_SHAPE}
                      fill={url("sclera")}
                      stroke="#e9cff7"
                      strokeWidth=".6"
                    />
                    <g clipPath={url("eye-clip")}>
                      {/* 血走った線。残り1つのときだけ見せる */}
                      <path
                        className="bera-veins"
                        d={VEINS}
                        fill="none"
                        stroke="#e0162f"
                        strokeLinecap="round"
                        strokeWidth=".9"
                      />
                      <g className="bera-iris">
                        <circle fill="#21182e" r="10.5" />
                        <circle cx="1" cy="1.2" fill={iris} r="6.3" />
                        <circle
                          className="bera-pupil"
                          cx="1"
                          cy=".5"
                          fill="#382544"
                          r="3.1"
                        />
                        <circle cx="-3.4" cy="-4.3" fill="#fffafc" r="2.8" />
                        <circle
                          cx="4.3"
                          cy="5"
                          fill="#ffffff"
                          opacity=".75"
                          r="1.2"
                        />
                      </g>
                    </g>
                    <path
                      className="bera-rim"
                      d={EYE_SHAPE}
                      fill="none"
                      stroke={iris}
                      strokeWidth="1.5"
                    />
                  </g>
                </g>
                </g>
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export const Beraboume = memo(BeraboumeImpl);
