import { GimmickDicePreview } from './GimmickDicePreview';
import { SlimeBurst } from './SlimeBurst';
// キャラクター図鑑（/enemies）。現行の部品と、名前のみ確定したキャラクターを並べる。
// 見た目の確認用で、ゲームには持ち込まない。
import { StrictMode, useEffect, useState, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { Hidoime } from './Hidoime';
import { Beraboume } from './Beraboume';
import { Detarame } from './Detarame';
import { Anchikushoume, PAINT_SHAPE_SIZES, PaintSample } from './Anchikushoume';
import { ANCHI_EYE_TRAVEL_MS, anchiEyeCells, sampleAnchiEyePath } from './anchiEye';
import './anchiEffects.css';
import { PRACTICE_ENEMIES, type PracticeEnemy } from '../enemyPracticeConfig';
import { SAI_NAMES, CHARACTER_RESERVATIONS } from './characterNames';
import { SanzapparanamePreview } from './SanzapparanamePreview';
import { SOUND_CHANNELS } from '../soundChannels';

const PIPS = [
  ['center'], ['top-left', 'bottom-right'], ['top-left', 'center', 'bottom-right'],
  ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
  ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right'],
];
// サイノメたちの役目（合計7になる2人1組で、チュートリアルと敵の倒し方を教える）
const SAI_ROLES = [
  '先生：チュートリアル・ヒドイメ・アンチクショウメ（ムツメと組）',
  '先生：コイツメ・ベラボウメ（ゴモクと組）',
  '先生：ダーメ・デタラメ（ヨツメと組）',
  '先生：ダーメ・デタラメ（ミツメと組）',
  '先生：コイツメ・ベラボウメ（フタツメと組）',
  '先生：チュートリアル・ヒドイメ・アンチクショウメ（ピンノメと組）',
];
const SAI_COLORS = ['#fc6dac', '#8b46d2', '#43ae39', '#43ae39', '#8b46d2', '#fc6dac'];

const ENEMY_COLOR = '#2c3446'; // App.tsx と同じ
// ベラボウメの目の減り方（App.tsx の BERABOU_EYE_ORDER と同じ）
const EYE_ORDER = [0, 8, 2, 6, 1, 7, 3, 5, 4];

const SmallEnemy = ({ kind, hit }: { kind: 'koitsume' | 'dame'; hit: boolean }) => (
  <div
    className={`die die-enemy ${hit ? 'die-hit' : ''}`}
    style={{ backgroundColor: ENEMY_COLOR, width: '100%', height: '100%' }}
  >
    <span className="enemy-rim" />
    <span className="enemy-shine" />
    {kind === 'dame' ? (
      <span className="enemy-crosses">
        <span className="enemy-cross" />
        <span className="enemy-cross" />
      </span>
    ) : (
      <span className="enemy-crosses is-koitsume">
        <span className="enemy-cross" />
        <span className="enemy-cross" />
      </span>
    )}
  </div>
);

// 盤面と同じ市松のマスの上に置く。cells は横に何マス、rows は縦に何マスぶんの大きさか
const Stage = ({
  cells,
  rows = cells,
  cell,
  children,
  flash,
  pad = 0.5,
}: {
  cells: number;
  rows?: number;
  cell: number;
  children: ReactNode;
  flash?: boolean;
  pad?: number; // まわりの余白（マス）。触手が伸びる敵は広めにとる
}) => (
  <div
    className="gallery-stage"
    style={
      {
        '--g-cell': `${cell}px`,
        width: cell * (cells + pad * 2),
        height: cell * (rows + pad * 2),
      } as CSSProperties
    }
  >
    <div
      className={`gallery-piece ${flash ? 'is-flash' : ''}`}
      style={{ width: cell * cells, height: cell * rows }}
    >
      {children}
    </div>
  </div>
);

const Card = ({ name, note, children }: { name: string; note: string; children: ReactNode }) => (
  <figure className="gallery-card">
    {children}
    <figcaption>
      <b>{name}</b>
      <span>{note}</span>
    </figcaption>
  </figure>
);

// The preview samples the same open U-shaped path as the game. Its visible eye
// never cuts through the body or travels along the excluded bottom row.
function AnchiPreview({ size, cell, paused, hit }: { size: number; cell: number; paused: boolean; hit: boolean }) {
  const [eye, setEye] = useState(() => anchiEyeCells(size, size)[0]);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  useEffect(() => {
    const cells = anchiEyeCells(size, size);
    if (cells.length < 2) return;
    let frame = 0;
    let elapsed = 0;
    let last = performance.now();
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const delta = Math.min(100, now - last);
      last = now;
      if (pausedRef.current || document.hidden) return;
      elapsed += delta;
      const step = Math.floor(elapsed / 1500);
      // Walk back along the U at its ends instead of wrapping under the body.
      const cycle = (cells.length - 1) * 2;
      const index = (n: number) => {
        const position = ((n % cycle) + cycle) % cycle;
        return position < cells.length ? position : cycle - position;
      };
      const progress = Math.max(0, (elapsed % 1500 - (1500 - ANCHI_EYE_TRAVEL_MS)) / ANCHI_EYE_TRAVEL_MS);
      const next = sampleAnchiEyePath(size, size, cells[index(step)], cells[index(step + 1)], progress);
      setEye(previous => previous.x === next.x && previous.y === next.y ? previous : next);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [size]);
  return <Anchikushoume w={size} h={size} eye={eye} cell={cell} paused={paused} hit={hit} hitTone="thunder" />;
}

// One lifecycle sample complements the nine silhouette comparisons below it.
// The actual game and this sample use the same PaintSample and phase CSS.
function PaintFlightPreview({ cell, paused }: { cell: number; paused: boolean }) {
  const [paint, setPaint] = useState({ phase: 'flying', cycle: 0 });
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  useEffect(() => {
    let elapsed = 0;
    let last = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const delta = Math.min(100, now - last);
      last = now;
      if (pausedRef.current || document.hidden) return;
      elapsed += delta;
      const time = elapsed % 5040;
      const phase = time < 320 ? 'flying' : time < 580 ? 'spreading' : time < 3920 ? 'resting' : time < 4340 ? 'fading' : 'hidden';
      const cycle = Math.floor(elapsed / 5040);
      setPaint(previous => previous.phase === phase && previous.cycle === cycle ? previous : { phase, cycle });
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <Stage cell={cell} cells={6} rows={5} pad={0}>
    <div style={{ position: 'absolute', left: cell, top: cell * 2, width: cell, height: cell }}>
      <Anchikushoume w={1} h={1} eye={{ x: 0, y: 0 }} cell={cell} paused={paused} />
    </div>
    {[3, 4, 5].map((x, index) => <div key={x} className="die" style={{ position: 'absolute', left: x * cell, top: cell * 3, width: cell, height: cell, backgroundColor: SAI_COLORS[index] }}>
      {PIPS[index].map(position => <span key={position} className={`pip ${position}`} style={{ backgroundColor: index === 1 ? '#330066' : '#fff' }} />)}
    </div>)}
    {paint.phase !== 'hidden' ? <div aria-hidden className={`anchi-paint is-${paint.phase}`} key={paint.cycle} style={{
      '--cell-size': `${cell}px`, '--launch-dx': -3, '--launch-dy': -1,
      left: (4 + 0.5 - 2.4) * cell, top: (3 + 0.5 - 2.4) * cell,
    } as CSSProperties}>
      <PaintSample shape={4} cell={cell} paused={paused} />
    </div> : null}
  </Stage>;
}

function Gallery() {
  const [practice, setPractice] = useState<PracticeEnemy | null>(null);
  const [practiceRun, setPracticeRun] = useState(0);
  const [reviewVisible, setReviewVisible] = useState(true);
  const practiceFrame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin) return;
      if (event.source === practiceFrame.current?.contentWindow && event.data?.type === 'sainome-practice-exit') setPractice(null);
      if (event.source === window.parent && event.data?.type === 'sainome-review-visible' && typeof event.data.visible === 'boolean') {
        setReviewVisible(event.data.visible);
        if (!event.data.visible) setPractice(null);
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  const practiceButton = (enemy: PracticeEnemy) => <button className="gallery-practice-button" type="button" onClick={() => setPractice(enemy)} aria-label={`${PRACTICE_ENEMIES[enemy].name}と模擬戦`}>⚔ 模擬戦</button>;
  const [showPaintPile, setShowPaintPile] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [hit, setHit] = useState(false);
  const [defeat, setDefeat] = useState(false);
  const [damageActive, setDamageActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const cell = zoom ? 72 : 48;
  const previewPaused = paused || practice !== null || !reviewVisible;

  // 図鑑全体共通：1秒被弾/撃破→1秒アイドリング。OFF・一時停止・アンマウントでタイマーを解除。
  useEffect(() => {
    if (!hit && !defeat) { setDamageActive(false); return; }
    if (previewPaused) return;
    setDamageActive(true);
    const timer = window.setInterval(() => setDamageActive(value => !value), 1000);
    return () => window.clearInterval(timer);
  }, [hit, defeat, previewPaused]);

  // 動きを減らす設定でも、このページでは動かして見せる（ヒドイメの見本と同じ扱い）
  useEffect(() => {
    document.body.classList.add('hidoime-motion-enabled');
    return () => document.body.classList.remove('hidoime-motion-enabled');
  }, []);

  const lostAll = (count: number) => new Set(EYE_ORDER.slice(0, count));

  return (
    <main className={`gallery ${previewPaused ? 'is-paused' : ''}`}>
      {practice ? <section className="gallery-practice" role="dialog" aria-modal="true" aria-label="エネミー模擬戦">
        <div className="gallery-practice-controls">
          <button type="button" onClick={() => setPractice(null)}>図鑑にもどる</button>
          <select aria-label="模擬戦の相手" value={practice} onChange={event => setPractice(event.target.value as PracticeEnemy)}>
            {Object.entries(PRACTICE_ENEMIES).map(([key, enemy]) => <option key={key} value={key}>{enemy.name}</option>)}
          </select>
          <button type="button" onClick={() => setPracticeRun(run => run + 1)}>再戦</button>
        </div>
        <iframe ref={practiceFrame} key={`${practice}-${practiceRun}`} title={`${PRACTICE_ENEMIES[practice].name}との模擬戦`} src={`/enemy-practice.html?enemy=${practice}`} />
      </section> : null}
      <header>
        <small>SAINOME SEVEN</small>
        <h1>キャラクター図鑑</h1>
        <p>サイとサイリアン、味方のキャラクター。マスは盤面と同じ大きさです。未定の見た目・設定は空欄です。</p>
      </header>
      <div className="gallery-controls">
        <a className="gallery-review-link" href="/review.html" target="_top">← 仕様書に戻る</a>
        <button aria-pressed={hit} onClick={() => { setDefeat(false); setHit((v) => !v); }} type="button">
          {hit ? 'ダメージを止める' : 'ダメージを見る'}
        </button>
        <button aria-pressed={defeat} onClick={() => { setHit(false); setDefeat(v => !v); }} type="button">
          {defeat ? 'やられたアニメを止める' : 'やられたアニメを見る'}
        </button>
        <button aria-pressed={zoom} onClick={() => setZoom((v) => !v)} type="button">
          {zoom ? '実寸にもどす' : '1.5倍で見る'}
        </button>
        <button aria-pressed={paused} onClick={() => setPaused((v) => !v)} type="button">
          {paused ? '動かす' : '一時停止'}
        </button>
      </div>

      <section>
        <h2>サイ</h2>
        <div className="gallery-row">
          {SAI_NAMES.map((name, i) => (
            <Card key={name} name={name} note={`${i + 1}の目　${SAI_ROLES[i]}`}>
              <Stage cell={cell} cells={1}>
                <div className="die" style={{ width: '100%', height: '100%', backgroundColor: SAI_COLORS[i] }}>
                  {PIPS[i].map(position => <span key={position} className={`pip ${position}`} style={{ backgroundColor: i === 1 || i === 4 ? '#330066' : '#fff' }} />)}
                </div>
              </Stage>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2>コメントキャラ（提供画像）</h2>
        <div className="gallery-row">
          {SAI_NAMES.map((name, i) => <Card key={name} name={name} note="会話・コメント用">
            <img src={`/images/sai-comments/fab${String(i + 1).padStart(2, '0')}.png`} alt={name} width="96" height="96" style={{objectFit:'contain',borderRadius:12}}/>
          </Card>)}
        </div>
      </section>
      <section>
        <h2>サイリアン（1マス）</h2>
        <div className="gallery-row">
          <Card name="コイツメ" note="4メン〜／となりで7を作ると倒せる">
            <Stage cell={cell} cells={1}>
              <SmallEnemy hit={hit && damageActive} kind="koitsume" />
            </Stage>
            {practiceButton('koitsume')}
          </Card>
          <Card name="ダーメ" note="6メン〜／1回でコイツメに、2回で倒せる">
            <Stage cell={cell} cells={1}>
              <SmallEnemy hit={hit && damageActive} kind="dame" />
            </Stage>
            {practiceButton('dame')}
          </Card>
        </div>
      </section>

      <section>
        <h2>ヒドイメ（2×2マス・ライフ5）</h2>
        {practiceButton('hidoime')}
        <div className="gallery-row">
          <Card name="ローズ" note="泡が満タン">
            <Stage cell={cell} cells={2} flash={hit && damageActive}>
              <Hidoime hpPercent={100} paused={previewPaused} seed={714} size={cell * 2} variant="rose" />
            </Stage>
          </Card>
          <Card name="バイオレット" note="泡が満タン">
            <Stage cell={cell} cells={2} flash={hit && damageActive}>
              <Hidoime hpPercent={100} paused={previewPaused} seed={321} size={cell * 2} variant="violet" />
            </Stage>
          </Card>
          <Card name="ローズ" note="のこり2（40%）">
            <Stage cell={cell} cells={2} flash={hit && damageActive}>
              <Hidoime hpPercent={40} paused={previewPaused} seed={93} size={cell * 2} variant="rose" />
            </Stage>
          </Card>
        </div>
      </section>

      <section>
        <h2>ベラボウメ（3×3マス・ライフ9）</h2>
        {practiceButton('berabou')}
        <div className="gallery-row">
          <Card name="オレンジ" note="目が9つ">
            <Stage cell={cell} cells={3} flash={hit && damageActive}>
              <div className={`gallery-defeat berabou-slot ${defeat && damageActive ? 'is-dying' : ''}`} style={{ animationPlayState: previewPaused ? 'paused' : 'running' }}><Beraboume hit={hit && damageActive} lost={lostAll(defeat && damageActive ? 9 : 0)} variant="orange" />{defeat && damageActive ? <SlimeBurst kind="orange" paused={previewPaused} /> : null}</div>
            </Stage>
          </Card>
          <Card name="イエローグリーン" note="目が9つ">
            <Stage cell={cell} cells={3} flash={hit && damageActive}>
              <div className={`gallery-defeat berabou-slot ${defeat && damageActive ? 'is-dying' : ''}`} style={{ animationPlayState: previewPaused ? 'paused' : 'running' }}><Beraboume hit={hit && damageActive} lost={lostAll(defeat && damageActive ? 9 : 0)} variant="lime" />{defeat && damageActive ? <SlimeBurst kind="lime" paused={previewPaused} /> : null}</div>
            </Stage>
          </Card>
          <Card name="オレンジ" note="のこり4（四すみと辺から減る）">
            <Stage cell={cell} cells={3} flash={hit && damageActive}>
              <div className={`gallery-defeat berabou-slot ${defeat && damageActive ? 'is-dying' : ''}`} style={{ animationPlayState: previewPaused ? 'paused' : 'running' }}><Beraboume hit={hit && damageActive} lost={lostAll(defeat && damageActive ? 9 : 5)} variant="orange" />{defeat && damageActive ? <SlimeBurst kind="orange" paused={previewPaused} /> : null}</div>
            </Stage>
          </Card>
          <Card name="イエローグリーン" note="のこり1（2倍・血走り。ひっさつメでしか減らせない）">
            <Stage cell={cell} cells={3} flash={hit && damageActive}>
              <div className={`gallery-defeat berabou-slot ${defeat && damageActive ? 'is-dying' : ''}`} style={{ animationPlayState: previewPaused ? 'paused' : 'running' }}><Beraboume hit={hit && damageActive} lost={lostAll(defeat && damageActive ? 9 : 8)} variant="lime" />{defeat && damageActive ? <SlimeBurst kind="lime" paused={previewPaused} /> : null}</div>
            </Stage>
          </Card>
        </div>
      </section>

      <section>
        <h2>デタラメ（1列・段ごとに目が1つ）</h2>
        {practiceButton('detarame')}
        <p className="gallery-note">
          5-6で初登場。ウォール6-3では5体が入れかわりで出てくる（同時に2体まで）。6-4ではアンチクショウメといっしょに2体。
          1体ずつ別々に伸びてビームを撃つ。食べたサイや敵に変えたサイのブロックの残りは、ばらけて下に落ちる。
        </p>
        <div className="gallery-row">
          <Card name="青い目×黄色い瞳" note="3段で出てくる">
            <Stage cell={cell} cells={1} rows={3}>
              <Detarame
                hit={hit && damageActive ? new Set([0]) : undefined}
                segments={[
                  { dir: -1, alive: true },
                  { dir: 1, alive: true },
                  { dir: -1, alive: true },
                ]}
                variant="blue"
              />
            </Stage>
          </Card>
          <Card name="黄色い目×青い瞳" note="伸びて4段。2段目は目が消えた無地、3段目はビームを撃つ目">
            <Stage cell={cell} cells={1} rows={4}>
              <Detarame
                firing={new Set([2])}
                hit={hit && damageActive ? new Set([0]) : undefined}
                segments={[
                  { dir: -1, alive: true },
                  { dir: 1, alive: false },
                  { dir: -1, alive: true },
                  { dir: 1, alive: true },
                ]}
                variant="yellow"
              />
            </Stage>
          </Card>
        </div>
      </section>

      <section>
        <h2>アンチクショウメ（1×1 → 最大4×4・ウォール6-2で登場、6-4ではデタラメ2体と）</h2>
        {practiceButton('anchikushoume')}
        <p className="gallery-note">
          最強のサイリアン。弱点は1つだけの目で、ひっさつメ（イチニノサンダーなど）を目のあるマスに当てたときだけ倒せる。
          2手ごとに隣のサイを食べて広がり、目は1.5秒ごとに上辺・左右の辺を動く（下段には行かない）。4手ごとにペンキを飛ばしてサイを見えにくくする。
          雷が当たると黄色く点滅し、目を細める（「ダメージを見る」）。
        </p>
        <div className="gallery-row">
          <Card name="1×1" note="出てきたところ">
            <Stage cell={cell} cells={1} pad={1.5}>
              <div className={`gallery-defeat anchi-slot ${defeat && damageActive ? 'is-dying' : ''}`} style={{ animationPlayState: previewPaused ? 'paused' : 'running', width: cell * 1, height: cell * 1 }}><AnchiPreview hit={hit && damageActive} cell={cell} size={1} paused={previewPaused} />{defeat && damageActive ? <SlimeBurst kind="paint" paused={previewPaused} /> : null}</div>
            </Stage>
          </Card>
          <Card name="2×2" note="サイを食べて成長">
            <Stage cell={cell} cells={2} pad={1.5}>
              <div className={`gallery-defeat anchi-slot ${defeat && damageActive ? 'is-dying' : ''}`} style={{ animationPlayState: previewPaused ? 'paused' : 'running', width: cell * 2, height: cell * 2 }}><AnchiPreview hit={hit && damageActive} cell={cell} size={2} paused={previewPaused} />{defeat && damageActive ? <SlimeBurst kind="paint" paused={previewPaused} /> : null}</div>
            </Stage>
          </Card>
          <Card name="3×3" note="触手＋2本・動き約1.56倍">
            <Stage cell={cell} cells={3} pad={1.5}>
              <div className={`gallery-defeat anchi-slot ${defeat && damageActive ? 'is-dying' : ''}`} style={{ animationPlayState: previewPaused ? 'paused' : 'running', width: cell * 3, height: cell * 3 }}><AnchiPreview hit={hit && damageActive} cell={cell} size={3} paused={previewPaused} />{defeat && damageActive ? <SlimeBurst kind="paint" paused={previewPaused} /> : null}</div>
            </Stage>
          </Card>
          <Card name="4×4" note="いちばん大きい。目は上辺・左右の辺を動く">
            <Stage cell={cell} cells={4} pad={1.5}>
              <div className={`gallery-defeat anchi-slot ${defeat && damageActive ? 'is-dying' : ''}`} style={{ animationPlayState: previewPaused ? 'paused' : 'running', width: cell * 4, height: cell * 4 }}><AnchiPreview hit={hit && damageActive} cell={cell} size={4} paused={previewPaused} />{defeat && damageActive ? <SlimeBurst kind="paint" paused={previewPaused} /> : null}</div>
            </Stage>
          </Card>
        </div>
        <div className="gallery-row">
          <Card name="ペンキ攻撃" note="飛ばす → 広がる → 消える。模擬戦では吸収・成長も確認できる">
            <PaintFlightPreview cell={cell * 0.75} paused={previewPaused} />
          </Card>
        </div>
        <h2>アンチクショウメのペンキ（共通の模様・外形9例・3〜5秒で消える）</h2>
        <button type="button" aria-pressed={showPaintPile} onClick={() => setShowPaintPile(v => !v)}>
          {showPaintPile ? 'サイノメに重ねる：ON' : 'サイノメに重ねる：OFF'}
        </button>
        <div className="gallery-row gallery-paints">
          {PAINT_SHAPE_SIZES.map((size, i) => (
            <figure className="gallery-paint" key={size}>
              <PaintSample paused={previewPaused} cell={cell * 0.75} shape={i} showPile={showPaintPile} />
              <figcaption>{size}</figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section>
        <h2>サンザッパラナメ（デザイン案）</h2>
        {practiceButton('sanzapparaname')}
        <SanzapparanamePreview paused={paused || !reviewVisible} hit={hit && damageActive} />
      </section>
      <section><h2>エンジョーボム（投下式）</h2>{practiceButton('enjo')}<p>2段/3段・通常/FEVERの切替はヒッサツメ図鑑の模擬戦から確認できます。</p></section><section><h2>ヒョーケツメ（ギミック案）</h2>{practiceButton('hyoketsume')}<GimmickDicePreview paused={previewPaused}/></section>

      <section>
        <h2>名前・設定</h2>
        <div className="gallery-row">
          {CHARACTER_RESERVATIONS.filter(character => character.name !== 'サンザッパラナメ').map(character => (
            <Card key={character.name} name={character.name} note={character.setting}>
              {character.name === 'ゾロメ仙人'
                ? <img alt="ゾロメ仙人" src="/zorome/z01.png" style={{ width: 96, height: 96, objectFit: 'contain', display: 'block' }} />
                : <div className="gallery-blank" aria-label={`${character.name}：見た目未登録`} />}
              <span className="gallery-note">{character.group}</span>
            </Card>
          ))}
        </div>
      </section>

      {/* 音の確認：どのサウンドチャネル（レイヤー）に、どの音を流しているか */}
      <section>
        <h2>サウンドチャネル（効果音のレイヤー）</h2>
        <p className="gallery-note">
          効果音はチャネルごとに分けて鳴らし、最後にまとめて音割れを抑える。チャネルが違えば、ほかの音の圧縮や音量下げに巻き込まれない。
        </p>
        <table className="gallery-sound-table">
          <thead>
            <tr><th>チャネル</th><th>通り道</th><th>割り当てている音</th></tr>
          </thead>
          <tbody>
            {SOUND_CHANNELS.map((channel) => (
              <tr key={channel.id}>
                <th scope="row">{channel.name}<small>{channel.id}</small></th>
                <td>{channel.route}</td>
                <td>
                  <ul>
                    {channel.sounds.map((sound) => <li key={sound.fn}>{sound.label}<small>{sound.fn}</small></li>)}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 図鑑の最後のページ：ゲーム本編へのリンク */}
      <section className="gallery-end">
        <h2>ゲーム本編</h2>
        <p>図鑑のキャラクターたちが出てくる、いま公開中のゲームです。</p>
        <a className="gallery-play" href="https://sainome-seven.vercel.app" rel="noreferrer" target="_blank">
          サイノメ・セヴンをあそぶ
          <small>sainome-seven.vercel.app</small>
        </a>
      </section>
    </main>
  );
}

const style = document.createElement('style');
style.textContent = `
  body { margin: 0; overflow-x: hidden; background: #12141b; color: #e9e6f2; font-family: system-ui, sans-serif; }
  .gallery { max-width: 980px; margin: 0 auto; padding: 24px 16px 48px; }
  .gallery header small { color: #a99ab4; letter-spacing: .15em; font-size: 11px; }
  .gallery h1 { margin: 6px 0 4px; font-size: 26px; }
  .gallery header p { margin: 0; color: #b2a5bd; font-size: 13px; line-height: 1.7; }
  .gallery h2 { font-size: 15px; margin: 28px 0 12px; color: #d8cfe6; }
  .gallery-sound-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .gallery-sound-table th, .gallery-sound-table td { border: 1px solid #2c3040; padding: 8px; vertical-align: top; text-align: left; }
  .gallery-sound-table thead th { background: #1c1f2a; color: #c9bfe0; }
  .gallery-sound-table tbody th { width: 22%; white-space: nowrap; }
  .gallery-sound-table small { display: block; color: #8a8199; font-size: 10px; font-family: ui-monospace, monospace; }
  .gallery-sound-table ul { margin: 0; padding-left: 16px; }
  .gallery-sound-table li { margin-bottom: 4px; }
  .gallery-controls { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; position: sticky; top: 0; padding: 8px 0; background: #12141b; z-index: 10; }
  .gallery-controls button, .gallery-review-link { font: inherit; font-size: 14px; font-weight: 700; color: #dfd2e9; background: #292032; border: 1px solid #55405f; border-radius: 10px; min-height: 44px; padding: 0 14px; cursor: pointer; }
  .gallery-review-link { display: inline-flex; align-items: center; text-decoration: none; background: #30343b; border-color: #636974; color: #fff; }
  .gallery-review-link:hover { background: #414750; }
  .gallery-review-link:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  .gallery-controls button[aria-pressed="true"] { background: #c5dc88; color: #151a10; border-color: #c5dc88; }
  .gallery-practice-button, .gallery-practice-controls button, .gallery-practice-controls select { color: #dfd2e9; background: #292032; border: 1px solid #55405f; border-radius: 8px; min-height: 40px; padding: 6px 12px; font: inherit; cursor: pointer; }
  .gallery-practice-button { margin-bottom: 12px; align-self: flex-start; }
  .gallery-practice { position: fixed; inset: 0; z-index: 1000; background: #171b22; display: flex; flex-direction: column; }
  .gallery-practice-controls { display: flex; gap: 8px; padding: 6px; flex: none; justify-content: center; }
  .gallery-practice iframe { flex: 1; min-height: 0; width: 100%; border: 0; }
  .gallery-row { display: flex; flex-wrap: wrap; gap: 16px; }
  .sanz-preview { max-width: 720px; }
  .sanz-preview svg { width: 100%; display: block; margin-top: 12px; }
  .sanz-preview p { color: #b2baca; font-size: 13px; line-height: 1.7; }
  .sanz-settings { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
  .sanz-settings select, .sanz-settings button { background: #292e39; color: white; border: 1px solid #586071; padding: 8px; border-radius: 8px; font: inherit; }
  .gallery-card { margin: 0; display: flex; flex-direction: column; gap: 8px; max-width: 360px; }
  .gallery-note { margin: -4px 0 12px; color: #b2a5bd; font-size: 12px; line-height: 1.7; }
  .gallery-paints { gap: 4px; }
  .gallery-paint { margin: 0; display: flex; flex-direction: column; align-items: center; font-size: 11px; color: #a99ab4; }
  .gallery-card figcaption { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: #a99ab4; }
  .gallery-card figcaption b { font-size: 14px; color: #fff; }
  .gallery-stage {
    position: relative; display: grid; place-items: center; border-radius: 14px; overflow: visible;
    background-color: #1d2029;
    background-image:
      linear-gradient(45deg, #232733 25%, transparent 25%, transparent 75%, #232733 75%),
      linear-gradient(45deg, #232733 25%, transparent 25%, transparent 75%, #232733 75%);
    background-size: calc(var(--g-cell) * 2) calc(var(--g-cell) * 2);
    background-position: 0 0, var(--g-cell) var(--g-cell);
  }
  .gallery-piece { position: relative; }
  .gallery-blank { width: 120px; height: 96px; border: 1px solid #323542; border-radius: 14px; }
  .gallery-piece.is-flash { animation: hidoime-hit-flash 60ms steps(1, end) infinite; }
  .gallery .gallery-defeat { position: relative; left: auto; top: auto; transform-origin: center; animation-play-state: inherit; }
  .gallery .gallery-defeat.berabou-slot { width: 100%; height: 100%; }
  .gallery.is-paused * { animation-play-state: paused !important; }
  .gallery-end { margin-top: 40px; padding-top: 8px; border-top: 1px solid #323542; }
  .gallery-end p { color: #b2a5bd; font-size: 13px; margin: 0 0 14px; }
  .gallery-play { display: inline-flex; flex-direction: column; align-items: center; gap: 2px; min-width: 240px; padding: 14px 22px; border-radius: 14px; background: #fc6dac; color: #20152b; font-size: 16px; font-weight: 800; text-decoration: none; box-shadow: 0 4px 0 #b9407b; }
  .gallery-play small { font-size: 11px; font-weight: 600; opacity: .8; }
`;
document.head.appendChild(style);

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
