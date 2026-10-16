// ヒドイメの確認用ページ（/hidoime-preview.html）。
// 本番と同じ盤面CSS（.board-panel / .board-grid / .die）と、同じ置き枠（.hidoime-slot）、
// 同じ段取り（hidoimeFx.ts）で動かすので、ここで見た動きがそのままゲームの動きになる。
// ボタンは確認用で、ゲームには持ち込まない。
import { StrictMode, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { Hidoime } from './Hidoime';
import type { HidoimeVariant } from './Hidoime';
import {
  HIDOIME_HIT_MS,
  HIDOIME_LAND_MS,
  HIDOIME_PRESS_ROW_MS,
  hidoimeFallMs,
  hurryHidoime,
  makePressParticles,
  planHidoimeFall,
} from './hidoimeFx';

const COLS = 7;
const ROWS = 14;
const BOARD_PADDING = 8;
const MAX_HP = 5;
const COLORS = ['#fc6dac', '#8b46d2', '#43ae39', '#43ae39', '#8b46d2', '#fc6dac'];
const PIPS: Record<number, string[]> = {
  1: ['center'],
  2: ['top-left', 'bottom-right'],
  3: ['top-left', 'center', 'bottom-right'],
  4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
  6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right'],
};

// 10メンの始まりに近い、3〜4段積み上がった盤面。ヒドイメは列2・3に降ってくる
const LAYOUT = [
  '.......',
  '.......',
  '.......',
  '.......',
  '.......',
  '.......',
  '.......',
  '.......',
  '.......',
  '.......',
  '5.46...',
  '32346.2',
  '6145236',
  '2453615',
];
const DROP_X = 2;

type Grid = (number | null)[][];
const baseGrid = (): Grid =>
  LAYOUT.map((row) => [...row].map((ch) => (ch >= '1' && ch <= '6' ? Number(ch) : null)));
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

type Move = 'none' | 'fall' | 'press' | 'land';
type Stage = 'idle' | 'fall' | 'press' | 'land' | 'done';

// ページの見た目。ボタンは「いま押すもの」が大きく、補助は小さく。
// スマホでは縦に、広い画面では左に操作・右に盤面を並べる
const PREVIEW_CSS = `
.hp-page { min-height: 100vh; box-sizing: border-box; padding: 16px; display: flex; flex-wrap: wrap;
  gap: 16px; align-items: flex-start; justify-content: center; background: var(--bg); color: var(--text);
  font-family: system-ui, sans-serif; }
.hp-controls { display: grid; gap: 10px; width: min(100%, 360px); }
.hp-head h1 { margin: 0; font-size: 17px; }
.hp-note { margin: 4px 0 0; min-height: 2.6em; font-size: 13px; line-height: 1.3; color: #ffb02e; }
.hp-step { display: grid; gap: 6px; padding: 12px; border-radius: 14px; background: #221d2b;
  border: 1px solid #3a3146; transition: border-color 160ms; }
.hp-step.is-now { border-color: #ffb02e; }
.hp-step h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15px; }
.hp-step h2 b { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%;
  background: #ffb02e; color: #1a1522; font-size: 13px; }
.hp-step p { margin: 0; font-size: 12px; color: #b9aec6; }
.hp-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.hp-main { min-height: 44px; padding: 0 16px; border: 0; border-radius: 12px; background: #ffb02e;
  color: #1a1522; font-size: 15px; font-weight: 800; cursor: pointer; }
.hp-sub { min-height: 36px; padding: 0 12px; border: 1px solid #5b4d6b; border-radius: 10px;
  background: transparent; color: #e6dcef; font-size: 13px; cursor: pointer; }
.hp-sub[aria-pressed='true'] { background: #5b4d6b; }
.hp-main:disabled, .hp-sub:disabled { opacity: 0.35; cursor: default; }
.hp-main:focus-visible, .hp-sub:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.hp-meter { display: inline-flex; align-items: center; gap: 4px; margin-left: 4px; }
.hp-meter i { width: 14px; height: 14px; border-radius: 4px; background: #3a3146; }
.hp-meter i.is-on { background: #e14caa; }
.hp-meter em { margin-left: 4px; font-style: normal; font-size: 13px; font-variant-numeric: tabular-nums; }
.hp-more summary { font-size: 12px; color: #b9aec6; cursor: pointer; }
.hp-more .hp-row { margin-top: 6px; }
.hp-foot { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 13px; color: #b9aec6; }
.hp-reset { margin-left: auto; }
.hp-board { width: min(100%, 320px); }
.hp-face-samples { display: flex; align-items: center; justify-content: space-around; gap: 12px; padding: 12px 0; }
.hp-face-sample { display: grid; justify-items: center; gap: 10px; }
.hp-face-sample small { font-size: 11px; color: #b9aec6; }
`;

function Preview() {
  const panelRef = useRef<HTMLElement>(null);
  const [cell, setCell] = useState(0);
  const [grid, setGrid] = useState<Grid>(baseGrid);
  const [variant, setVariant] = useState<HidoimeVariant>('rose');
  const [hp, setHp] = useState(MAX_HP);
  const [pos, setPos] = useState({ x: DROP_X, y: ROWS - 2 });
  const [move, setMove] = useState<Move>('none');
  const [moveMs, setMoveMs] = useState(0);
  const [pressed, setPressed] = useState<Set<string>>(() => new Set());
  const [sparks, setSparks] = useState<Map<string, ReturnType<typeof makePressParticles>>>(() => new Map());
  const [hit, setHit] = useState(false);
  const [shown, setShown] = useState(true);
  const [stage, setStage] = useState<Stage>('done');
  const [note, setNote] = useState('まず「▶ 登場を見る」を押してください。上から順に 1→2→3 と進めます');
  const [running, setRunning] = useState(false);
  const run = useRef(0); // やり直しで前の段取りを止めるための番号

  // 確認用なので、端末の「動きを減らす」設定があっても泡の動きを見せる
  useEffect(() => {
    document.body.classList.add('hidoime-motion-enabled');
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const apply = () => {
      const size = Math.max(16, Math.floor((panel.clientWidth - BOARD_PADDING * 2) / COLS));
      panel.style.setProperty('--cell-size', `${size}px`);
      setCell(size);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  // 命中：白く6回点滅するあいだ、中の動きを早送りにする（ゲームと同じ）
  useEffect(() => {
    if (!hit) return;
    const root = document.querySelector('.hidoime-slot.is-hit > .hidoime');
    const restore = hurryHidoime(root);
    const timer = window.setTimeout(() => {
      restore();
      setHit(false);
    }, HIDOIME_HIT_MS);
    return () => {
      window.clearTimeout(timer);
      restore();
    };
  }, [hit]);

  const topOf = (g: Grid, col: number) => {
    for (let y = 0; y < ROWS; y += 1) if (g[y][col] !== null) return y;
    return ROWS;
  };

  // 登場。step を渡すと、その段階まで進めたところで止まる（1段ずつ確かめる用）
  const entrance = async (stopAt: Stage | null) => {
    const token = ++run.current;
    setRunning(true);
    const start = baseGrid();
    setGrid(start);
    setHp(MAX_HP);
    setShown(true);
    setPressed(new Set());
    const { fallTo, pressRows } = planHidoimeFall(topOf(start, DROP_X), topOf(start, DROP_X + 1), ROWS);

    setStage('fall');
    setMove('none');
    setMoveMs(0);
    setPos({ x: DROP_X, y: 0 });
    setNote('1. 落下：上から加速して、高いほうの列のてっぺんまで');
    await wait(80);
    if (run.current !== token) return;
    const fallMs = hidoimeFallMs(fallTo);
    setMove('fall');
    setMoveMs(fallMs);
    setPos({ x: DROP_X, y: fallTo });
    await wait(fallMs);
    if (run.current !== token) return;
    if (stopAt === 'fall') {
      setRunning(false);
      return;
    }

    setStage('press');
    setNote(`2. プレス：真下のメを縦につぶしながら1段ずつ沈む（${pressRows.length}段）`);
    let g = start;
    for (const row of pressRows) {
      const squashed = [DROP_X, DROP_X + 1].filter((col) => g[row][col] !== null);
      setPressed(new Set(squashed.map((col) => `${col},${row}`)));
      // ゲームと同じく、つぶれたメの色で粒を散らす
      const rowGrid = g;
      setSparks((prev) => {
        const next = new Map(prev);
        squashed.forEach((col) => next.set(`${col},${row}`, makePressParticles(COLORS[(rowGrid[row][col] ?? 1) - 1])));
        return next;
      });
      window.setTimeout(
        () =>
          setSparks((prev) => {
            const next = new Map(prev);
            squashed.forEach((col) => next.delete(`${col},${row}`));
            return next;
          }),
        900,
      );
      setMove('press');
      setMoveMs(HIDOIME_PRESS_ROW_MS);
      setPos({ x: DROP_X, y: row - 1 });
      await wait(HIDOIME_PRESS_ROW_MS);
      if (run.current !== token) return;
      g = g.map((line) => [...line]);
      squashed.forEach((col) => {
        g[row][col] = null;
      });
      setGrid(g);
      setPressed(new Set());
    }
    if (stopAt === 'press') {
      setRunning(false);
      return;
    }

    setStage('land');
    setNote('3. 着地：最下段で、どすんと横につぶれて戻る');
    setMove('land');
    setMoveMs(0);
    setPos({ x: DROP_X, y: ROWS - 2 });
    await wait(HIDOIME_LAND_MS);
    if (run.current !== token) return;
    setMove('none');
    setStage('done');
    setNote('着地しました。次は 2 の「● 1回当てる」を押してください');
    setRunning(false);
  };

  const damage = () => {
    if (hp <= 0 || hit) return;
    setHit(true);
    window.setTimeout(() => {
      setHp((value) => {
        const next = Math.max(0, value - 1);
        setNote(next === 0 ? '4. 消滅：はじけて消える' : `ダメージ：白く6回点滅して、中がもがく（残り ${next}/${MAX_HP}）`);
        return next;
      });
    }, HIDOIME_HIT_MS);
  };

  const reset = () => {
    run.current += 1;
    setRunning(false);
    setGrid(baseGrid());
    setPos({ x: DROP_X, y: ROWS - 2 });
    setMove('none');
    setMoveMs(0);
    setPressed(new Set());
    setHit(false);
    setHp(MAX_HP);
    setShown(true);
    setStage('done');
    setNote('最初の状態に戻しました');
  };

  const entering = stage === 'fall' || stage === 'press' || stage === 'land';

  return (
    <main className="hp-page">
      <style>{PREVIEW_CSS}</style>

      <div className="hp-controls">
        <header className="hp-head">
          <h1>ヒドイメ 確認用</h1>
          <p className="hp-note" aria-live="polite">
            {note}
          </p>
        </header>

        <section className="hp-step">
          <h2>三日月の目・サイズ確認</h2>
          <div className="hp-face-samples">
            <div className="hp-face-sample">
              <Hidoime variant={variant} hpPercent={100} size={cell > 0 ? cell * 2 : 80} />
              <small>盤面と同じ {cell > 0 ? cell * 2 : 80}px</small>
            </div>
            <div className="hp-face-sample">
              <Hidoime variant={variant} hpPercent={100} size={144} />
              <small>拡大 144px</small>
            </div>
          </div>
        </section>

        <section className={`hp-step ${stage === 'fall' || stage === 'press' || stage === 'land' ? 'is-now' : ''}`}>
          <h2>
            <b>1</b>登場
          </h2>
          <p>上から落ちてきて、2列のメを押しつぶしながら最下段へ</p>
          <div className="hp-row">
            <button className="hp-main" disabled={running} onClick={() => void entrance(null)} type="button">
              ▶ 登場を見る
            </button>
            <button className="hp-sub" disabled={running} onClick={() => void entrance('fall')} type="button">
              落下だけ
            </button>
            <button className="hp-sub" disabled={running} onClick={() => void entrance('press')} type="button">
              プレスまで
            </button>
          </div>
        </section>

        <section className={`hp-step ${hit ? 'is-now' : ''}`}>
          <h2>
            <b>2</b>ダメージ
          </h2>
          <p>白く6回点滅して、中がもがく。泡が1段減る</p>
          <div className="hp-row">
            <button className="hp-main" disabled={hp <= 0 || hit || entering} onClick={damage} type="button">
              ● 1回当てる
            </button>
            <span aria-label={`HP ${hp} / ${MAX_HP}`} className="hp-meter" role="img">
              {Array.from({ length: MAX_HP }, (_, index) => (
                <i className={index < hp ? 'is-on' : ''} key={index} />
              ))}
              <em>
                {hp}/{MAX_HP}
              </em>
            </span>
          </div>
          <details className="hp-more">
            <summary>HPを直接えらぶ</summary>
            <div className="hp-row">
              {[5, 4, 3, 2, 1].map((value) => (
                <button
                  aria-pressed={hp === value}
                  className="hp-sub"
                  key={value}
                  onClick={() => setHp(value)}
                  type="button"
                >
                  {value}
                </button>
              ))}
            </div>
          </details>
        </section>

        <section className={`hp-step ${hp === 0 ? 'is-now' : ''}`}>
          <h2>
            <b>3</b>消滅
          </h2>
          <p>HPが0になると、はじけて花火のように消える</p>
          <div className="hp-row">
            <button className="hp-main" disabled={hp <= 0 || entering} onClick={() => setHp(0)} type="button">
              ✦ とどめを刺す
            </button>
          </div>
        </section>

        <div className="hp-foot">
          <span>色</span>
          {(['rose', 'violet'] as const).map((value) => (
            <button
              aria-pressed={variant === value}
              className="hp-sub"
              key={value}
              onClick={() => setVariant(value)}
              type="button"
            >
              {value === 'rose' ? '赤紫' : '青紫'}
            </button>
          ))}
          <button className="hp-sub hp-reset" onClick={reset} type="button">
            ↺ 最初に戻す
          </button>
        </div>
      </div>

      <section className="board-panel hp-board" ref={panelRef}>
        <div className="board-grid">
          {grid.flatMap((row, y) =>
            row.map((value, x) => {
              const hidden = !entering && shown && x >= pos.x && x <= pos.x + 1 && y >= pos.y;
              return (
                <div className="board-cell" key={`${x}-${y}`}>
                  {value !== null && !hidden ? (
                    <div
                      className={`die ${pressed.has(`${x},${y}`) ? 'die-pressed' : ''}`}
                      style={{ backgroundColor: COLORS[value - 1] }}
                    >
                      {PIPS[value].map((spot, index) => (
                        <span
                          className={`pip ${spot}`}
                          key={index}
                          style={{ backgroundColor: value === 2 || value === 5 ? '#330066' : '#ffffff' }}
                        />
                      ))}
                    </div>
                  ) : null}
                  {sparks.has(`${x},${y}`) ? (
                    <span aria-hidden className="burst-ring">
                      {(sparks.get(`${x},${y}`) ?? []).map((particle, index) => (
                        <span
                          className="burst-particle"
                          key={index}
                          style={
                            {
                              '--dx': `${particle.dx.toFixed(1)}px`,
                              '--dy': `${particle.dy.toFixed(1)}px`,
                              '--size': `${particle.size.toFixed(1)}px`,
                              '--delay': `${Math.round(particle.delay)}ms`,
                              '--dur': `${Math.round(particle.duration)}ms`,
                              backgroundColor: particle.color,
                            } as CSSProperties
                          }
                        />
                      ))}
                    </span>
                  ) : null}
                </div>
              );
            }),
          )}
          {cell > 0 && shown ? (
            <div
              aria-hidden
              className={`hidoime-slot ${entering ? `is-entering is-${move}` : ''} ${hit ? 'is-hit' : ''}`}
              style={{ '--hx': pos.x, '--hy': pos.y, '--move-ms': `${moveMs}ms` } as CSSProperties}
            >
              <Hidoime
                hpPercent={(hp / MAX_HP) * 100}
                onDeathAnimationComplete={() => setNote('消滅の演出が終わりました。「↺ 最初に戻す」でもう一度見られます')}
                size={cell * 2}
                variant={variant}
              />
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
