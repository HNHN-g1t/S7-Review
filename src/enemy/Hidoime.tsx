// エネミー「ヒドイメ」の見た目。HP・ダメージの計算は持たず、渡された hpPercent を
// 泡の密度で見せるだけ。仕様は docs/hidoime/HIDOIME_HANDOFF.md。
//
// - 部品は seed から生成時に一度だけ組み立てる。HPが変わっても配置は引き直さない
// - HPが正から0になったときだけ消滅演出を始め、終わったら onDeathAnimationComplete を1回呼ぶ
// - 演出が終わるまでは呼び出し側がこのコンポーネントを外さないこと
// - HPを正に戻すと元の姿に戻り、再び0にすれば消滅をもう一度見られる
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import './hidoime.css';
import { HIDOIME_BASE, buildHidoimeParts, hidoimeStage, visibleIndices } from './hidoimeParts';
import type { HidoimeVariant } from './hidoimeParts';

export type { HidoimeVariant };

type Props = {
  variant: HidoimeVariant;
  hpPercent: number;
  // 一辺のピクセル数（2×2マスぶん）。96px の見本を比例で拡大縮小する
  size: number;
  seed?: number;
  paused?: boolean;
  onDeathAnimationComplete?: () => void;
  className?: string;
  style?: CSSProperties;
};

// 消滅の粒の数：本体1＋親6＋家族6＋子24＋火花11。animationend をこの数だけ数える
const BURST_ANIMATIONS = new Set([
  'hidoime-burst-body',
  'hidoime-scatter',
  'hidoime-parent-split',
  'hidoime-child-scatter',
  'hidoime-spark-flight',
]);
const BURST_EVENT_COUNT = 1 + 6 + 6 + 24 + 11;

const cssVars = (vars: Record<string, string | number>) => vars as CSSProperties;

export function Hidoime({
  variant,
  hpPercent,
  size,
  seed = 714,
  paused = false,
  onDeathAnimationComplete,
  className,
  style,
}: Props) {
  const parts = useMemo(() => buildHidoimeParts(variant, seed), [variant, seed]);
  const stage = hidoimeStage(hpPercent);
  // 目に渡すHP（0〜1）
  const eyeHp = Math.max(0, Math.min(100, hpPercent)) / 100;

  // 'alive' → HPが正から0へ → 'dying'（演出中）→ 'dead'（演出後）
  // はじめから0で置かれたときは演出せず 'gone'
  const [phase, setPhase] = useState<'alive' | 'dying' | 'dead' | 'gone'>(() =>
    stage === 0 ? 'gone' : 'alive',
  );
  const [deathCount, setDeathCount] = useState(0);
  const prevStageRef = useRef(stage);
  const endedRef = useRef(0);
  // 完了通知は消滅1回につき1回だけ。state の更新関数の中では呼ばない（StrictMode で二重に走る）
  const notifiedRef = useRef(true);
  const burstRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onDeathAnimationComplete);
  onCompleteRef.current = onDeathAnimationComplete;

  useEffect(() => {
    const prev = prevStageRef.current;
    prevStageRef.current = stage;
    if (prev > 0 && stage === 0) {
      endedRef.current = 0;
      notifiedRef.current = false;
      setDeathCount((n) => n + 1);
      setPhase('dying');
    } else if (stage > 0) {
      // 演出の途中で戻されたときは、完了を通知しない
      notifiedRef.current = true;
      setPhase('alive');
    }
  }, [stage]);

  const finish = () => {
    if (notifiedRef.current) {
      return;
    }
    notifiedRef.current = true;
    setPhase('dead');
    onCompleteRef.current?.();
  };

  // 動きを減らす設定などで消滅の粒が出ないときは、待たずに終わったことにする
  useEffect(() => {
    if (phase !== 'dying') {
      return;
    }
    const burst = burstRef.current;
    if (!burst || getComputedStyle(burst).display === 'none') {
      finish();
    }
  }, [phase, deathCount]);

  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  const showInk = useMemo(() => visibleIndices(parts.inks.length, stage), [parts, stage]);
  const showMote = useMemo(() => visibleIndices(parts.motes.length, stage), [parts, stage]);
  const showDepth = useMemo(() => visibleIndices(parts.depths.length, stage), [parts, stage]);

  const depleted = phase === 'dying' || phase === 'dead';
  const rootClass = ['hidoime', paused || hidden ? 'is-paused' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  const stageClass = [
    'hidoime-stage',
    variant === 'rose' ? 'is-rose' : 'is-violet',
    depleted ? 'is-depleted' : '',
    phase === 'gone' ? 'is-gone' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      aria-hidden
      className={rootClass}
      style={{
        width: size,
        height: size,
        ...cssVars({ '--hidoime-scale': size / HIDOIME_BASE }),
        ...style,
      }}
    >
      <div
        className={stageClass}
        onAnimationEnd={(event) => {
          if (phase !== 'dying' || !BURST_ANIMATIONS.has(event.animationName)) {
            return;
          }
          endedRef.current += 1;
          if (endedRef.current >= BURST_EVENT_COUNT) {
            finish();
          }
        }}
      >
        <div className="hidoime-body">
          <div className="hidoime-shape is-back" />
          <div className="hidoime-shape">
            <div className="hidoime-skin">
              <div className="hidoime-depths">
                {parts.depths.map((d, i) => (
                  <i
                    className="hidoime-depth"
                    hidden={!showDepth.has(i)}
                    key={i}
                    style={cssVars({
                      '--x': `${d.x}%`,
                      '--y': `${d.y}%`,
                      '--size': `${d.size}px`,
                      '--ink': d.ink,
                      '--duration': `${d.duration}s`,
                      '--delay': `${d.delay}s`,
                      '--dx': `${d.dx}px`,
                    })}
                  />
                ))}
              </div>
              <svg className="hidoime-rim" viewBox="0 0 96 96">
                <path d={parts.rimPath} />
              </svg>
              <div className="hidoime-bubbles">
                <div className="hidoime-orbit">
                  {parts.inks.map((b, i) => (
                    <i
                      className="hidoime-ink"
                      hidden={!showInk.has(i)}
                      key={i}
                      style={cssVars({
                        '--x': `${b.x}%`,
                        '--y': `${b.y}%`,
                        '--size': `${b.size}px`,
                        '--ink': b.ink,
                        '--angle': `${b.angle}deg`,
                        '--duration': `${b.duration}s`,
                        '--delay': `${b.delay}s`,
                      })}
                    />
                  ))}
                </div>
                {parts.motes.map((m, i) => (
                  <i
                    className="hidoime-mote"
                    hidden={!showMote.has(i)}
                    key={i}
                    style={cssVars({
                      '--x': `${m.x}%`,
                      '--y': `${m.y}%`,
                      '--size': `${m.size}px`,
                      '--duration': `${m.duration}s`,
                      '--delay': `${m.delay}s`,
                    })}
                  />
                ))}
              </div>
            </div>
          </div>
          {/* 正円から上寄りの小円を引いた厚い三日月。内側が高い「ハ」の向き。 */}
          {/* 目の大きさと動きはHPしだい。満タンで大きく元気に、減るほど小さく、ゆっくりおとなしくなる */}
          <svg
            aria-hidden
            className="hidoime-eyes"
            style={cssVars({
              '--eye-base': (0.68 + 0.32 * eyeHp).toFixed(3),
              '--eye-amp': (0.2 + 0.8 * eyeHp).toFixed(3),
              '--eye-slow': (1 + (1 - eyeHp) * 0.9).toFixed(3),
            })}
            viewBox="0 0 96 96"
          >
            {/* 置く位置は外側の g、ふくらみの動きは内側の path（CSS の transform が位置を上書きしないように） */}
            <g transform="translate(26.5 43.5) rotate(-12)">
              <path className="hidoime-eye is-left" d="M -7.179840505313266 -7.661585365853659 A 10.5 10.5 0 1 0 7.179840505313266 -7.661585365853659 A 7.2 7.2 0 0 1 -7.179840505313266 -7.661585365853659 Z" />
            </g>
            <g transform="translate(69.5 43.5) rotate(12)">
              <path className="hidoime-eye is-right" d="M -7.179840505313266 -7.661585365853659 A 10.5 10.5 0 1 0 7.179840505313266 -7.661585365853659 A 7.2 7.2 0 0 1 -7.179840505313266 -7.661585365853659 Z" />
            </g>
          </svg>
        </div>
        {/* 消滅のたびに key を変えて、アニメーションを頭から流し直す */}
        <div className="hidoime-burst" key={deathCount} ref={burstRef}>
          {parts.families.map((f, i) => (
            <span
              className="hidoime-family"
              key={i}
              style={cssVars({
                '--sx': `${f.sx}px`,
                '--sy': `${f.sy}px`,
                '--size': `${f.size}px`,
                '--start': `${f.start}s`,
                '--tx': `${f.tx}px`,
                '--ty': `${f.ty}px`,
                '--ink': f.ink,
                '--flight': `${f.flight}s`,
              })}
            >
              <i className="hidoime-parent" />
              {f.children.map((c, j) => (
                <i
                  className="hidoime-child"
                  key={j}
                  style={cssVars({
                    '--child-size': `${c.size}px`,
                    '--split-lag': `${c.lag}s`,
                    '--cx': `${c.cx}px`,
                    '--cy': `${c.cy}px`,
                  })}
                />
              ))}
            </span>
          ))}
          {parts.sparks.map((s, i) => (
            <i
              className="hidoime-spark"
              key={i}
              style={cssVars({
                '--tx': `${s.tx}px`,
                '--ty': `${s.ty}px`,
                '--size': `${s.size}px`,
                '--ink': s.ink,
                '--start': `${s.start}s`,
                '--flight': `${s.flight}s`,
              })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
