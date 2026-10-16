// デタラメの見た目（18メン）。正本は public/enemy-design/detarame.html（docs/detarame/DESIGN.md の採用版）。
// 1列を縦に占める闇のスライム。身体は段どうしがつながった1本のSVG曲線で、左右交互にうねる。
// 各段に下弦の半円の目が1つ。目は横揺れに追従せず、その段の位置にとどまる。
// HP・ビーム・増殖などの段取りは App.tsx が持ち、ここは渡された状態を描くだけ。動きは detarame.css。
import { memo } from 'react';
import type { CSSProperties } from 'react';
import './detarame.css';

export type DetarameVariant = 'blue' | 'yellow'; // 青い目×黄色い瞳／黄色い目×青い瞳

export type DetarameSegment = {
  dir: -1 | 1; // 目の向き（-1 左・1 右）
  alive: boolean; // 目が残っているか。消えた段は無地の身体として残る
};

type Props = {
  segments: DetarameSegment[]; // 上の段から順に
  variant: DetarameVariant;
  hit?: ReadonlySet<number>; // いまダメージを受けている段
  firing?: ReadonlySet<number>; // いまビームを撃っている段
  born?: number; // いま下に生まれた段
  absorbing?: boolean; // いちばん上の段の目へ、サイを吸い込んでいる最中
  dying?: boolean; // ぜんぶの目が消えて、下へ崩れていく最中
};

const SWAY = 8; // 段ごとのうねり（セル幅に対する%）
const STAR_COLORS = ['#d6eeff', '#fff2b9', '#cfbfff'];

// 身体の輪郭。段の中心を左右交互にずらした、なめらかな1本の線（見本の outline と同じ）
const outline = (segments: DetarameSegment[], phase: number) => {
  const h = segments.length * 100;
  const centers = segments.map((s, i) => ({ x: 50 + phase * s.dir * SWAY, y: i * 100 + 50 }));
  const left = centers.map((p) => ({ x: p.x - 48, y: p.y }));
  const right = centers.map((p) => ({ x: p.x + 48, y: p.y }));
  const last = centers.length - 1;
  let d = `M${centers[0].x} 1 Q${right[0].x} 1 ${right[0].x} 50`;
  for (let i = 1; i < right.length; i += 1) {
    const a = right[i - 1];
    const b = right[i];
    d += ` C${a.x} ${a.y + 50} ${b.x} ${b.y - 50} ${b.x} ${b.y}`;
  }
  d += ` Q${right[last].x} ${h - 1} ${centers[last].x} ${h - 1} Q${left[last].x} ${h - 1} ${left[last].x} ${h - 50}`;
  for (let i = left.length - 2; i >= 0; i -= 1) {
    const a = left[i + 1];
    const b = left[i];
    d += ` C${a.x} ${a.y - 50} ${b.x} ${b.y + 50} ${b.x} ${b.y}`;
  }
  return `${d} Q${left[0].x} 1 ${centers[0].x} 1Z`;
};

function DetarameImpl({ segments, variant, hit, firing, born, absorbing = false, dying = false }: Props) {
  if (segments.length === 0) return null;
  const a = outline(segments, 1);
  const b = outline(segments, -1);
  // うねりの位相は、描き直しても途切れないよう時刻からそろえる
  const begin = `-${((performance.now() / 1000) % 2.1).toFixed(2)}s`;
  return (
    <div className={`detarame is-${variant} ${dying ? 'is-dying' : ''}`}>
      <svg
        aria-hidden
        className="detarame-body"
        preserveAspectRatio="none"
        viewBox={`0 0 100 ${segments.length * 100}`}
      >
        <path d={a} fill="#191e29" strokeWidth="1.8">
          <animate
            attributeName="d"
            begin={begin}
            calcMode="spline"
            dur="2.1s"
            keySplines=".42 0 .58 1;.42 0 .58 1"
            keyTimes="0;.5;1"
            repeatCount="indefinite"
            values={`${a};${b};${a}`}
          />
        </path>
      </svg>
      {segments.map((s, i) => (
        <div
          className={[
            'detarame-seg',
            s.alive ? '' : 'is-spent',
            hit?.has(i) ? 'is-hit' : '',
            firing?.has(i) ? 'is-firing' : '',
            born === i ? 'is-born' : '',
            absorbing && i === 0 ? 'is-absorb' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          key={i}
          style={
            {
              top: `${(i * 100) / segments.length}%`,
              height: `${100 / segments.length}%`,
              '--eye-left': s.dir < 0 ? '14%' : '30%',
              '--look': s.dir < 0 ? '35%' : '65%',
              '--blink-time': `${(2.9 + ((i * 1.17) % 2.7)).toFixed(2)}s`,
              '--blink-offset': `${(-i * 0.83).toFixed(2)}s`,
              '--delay': `${i * 80}ms`,
            } as CSSProperties
          }
        >
          {/* 星のまたたき（9個）。目が消えた段では消える */}
          {Array.from({ length: 9 }, (_, k) => (
            <i
              className="detarame-spark"
              key={k}
              style={
                {
                  '--sx': `${8 + ((k * 31 + i * 13) % 80)}%`,
                  '--sy': `${8 + ((k * 43) % 80)}%`,
                  '--ss': `${3 + (k % 3)}px`,
                  '--sc': STAR_COLORS[k % 3],
                  '--sd': `${(0.48 + k * 0.075).toFixed(3)}s`,
                  '--so': `${(-k * 0.41 - i * 0.3).toFixed(2)}s`,
                } as CSSProperties
              }
            />
          ))}
          <div className="detarame-eye">
            <i className="detarame-iris" />
          </div>
        </div>
      ))}
    </div>
  );
}

export const Detarame = memo(DetarameImpl);

// ビームの出どころ（瞳の中心）。段のマスに対する割合。撃つときの目は正円になる
export const DETARAME_PUPIL = { left: 0.336, right: 0.664, y: 0.6 };
// 吸い込む先（いちばん上の段の目）。段のマスに対する割合
export const DETARAME_ABSORB = { left: 0.42, right: 0.58, y: 0.655 };
