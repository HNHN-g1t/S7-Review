import { EnjomeBomb, EnjoBlast } from './skills/EnjomePreview';
import { enjoPyramid, enjoWallHits, type EnjoWall } from './skills/enjoRuntime';
import { enjoRange } from './skills/enjomeModel';
import { playEnjoWallBreak, playEnjoImpact } from './skills/enjomeAudio';
import { playIceFreeze, playIceCrash } from './enemy/icePing';
import { HyoketsuBurst } from './enemy/HyoketsuBurst';
import { HYOKETSU_BURST_MS } from './enemy/hyoketsuFireworks';
import { HyoketsumeDice } from './enemy/HyoketsumeDice';
import { SlimeBurst } from './enemy/SlimeBurst';
import { whenIntroAudioRunning } from './introAudio';
import { findThunderSet, thunderColumns } from './thunder';
import { findYou456Set, you456Lines, you456PracticeCells, type You456Strike } from './you456';
import { useYou456Gesture } from './useYou456Gesture';
import './you456.css';
const YOU456_CANCELLED = Symbol('456You! interrupted');
import { moveThunderTrace, startThunderTrace, type ThunderTrace, type ThunderTracePoint } from './thunderTrace';
import './thunderTrace.css';
import { createHidoimeCrushSound } from './hidoimeCrushAudio';
import type React from 'react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Hidoime } from './enemy/Hidoime';
import { SanzShots, Sanzapparaname, type SanzShot } from './enemy/Sanzapparaname';
import { Anchikushoume, PaintSample } from './enemy/Anchikushoume';
import { ANCHI_EYE_TRAVEL_MS, anchiEyeCells, anchiEyeCell, sampleAnchiEyePath, remapAnchiEye } from './enemy/anchiEye';
import './enemy/anchiEffects.css';
import { Beraboume, type BeraboumeVariant } from './enemy/Beraboume';
import { haptics } from './haptics';
import { getEnemyPractice } from './enemyPracticeConfig';
import { SAI_NAMES } from './enemy/characterNames';
import { WallMap, ZoromeSage } from './story/WallMap';
import { Ending, UraFall } from './story/Ending';
import { ALL_MISSIONS, CAMPAIGN_MISSIONS, FINAL_STAGE, URA_FIRST_STAGE, URA_FINAL_STAGE, wallNumberLabel, loadEndingSeen, saveEndingSeen, WALL_LESSON, WALL_SAVE_KEY, LEGACY_STAGE_COUNT, wallMission, wallUnlocked, wallTitle, wallAbilities, wallGate, loadWallProgress, saveWallProgress } from './story/wall1';
import { emptyWallCounts, wallObjectiveMet, wallObjectiveProgress, STORY_GOALS, STORY_BERABOU_HP, STORY_SWARM_COUNT, missionGoalFor, storyObjectiveText, type StoryGoal } from './story/objectives';
import { MissionBanner } from './story/MissionBanner';
import {
  DETARAME_ABSORB,
  DETARAME_PUPIL,
  Detarame,
  type DetarameSegment,
  type DetarameVariant,
} from './enemy/Detarame';
import type { HidoimeVariant } from './enemy/Hidoime';
import {
  HIDOIME_HIT_MS,
  HIDOIME_LAND_MS,
  HIDOIME_PRESS_ROW_MS,
  hidoimeFallMs,
  hurryHidoime,
  makePressParticles,
  planHidoimeFall,
} from './enemy/hidoimeFx';

const COLS = 7;
const ROWS = 14;
const PIECE_SIZE = 3;
// 合計7になる相手どうしが同じ色になっている。
//   1と6 = ピンク / 2と5 = パープル / 3と4 = ライトグリーン
// 同じ色が隣り合っていれば消せる組み合わせ、という手がかりになる。
// 同じ色になる組み合わせが、そのまま合計7の相手（1+6 / 2+5 / 3+4）。
// 色そのものが「隣り合えば消せる」手がかりになっている。
// 明度を落として彩度を上げ、ハイライトで立体を出す方針。
const COLORS = [
  '#fc6dac', // 1 ピンク
  '#8b46d2', // 2 パープル
  '#43ae39', // 3 グリーン
  '#43ae39', // 4 グリーン
  '#8b46d2', // 5 パープル
  '#fc6dac', // 6 ピンク
] as const;

// メの色の反対色（色相を180度回し、明度と彩度はそのまま）。
// ボムの直前に、対象のマスを本来の色とこの色で高速に入れ替えて点滅させる。
// 同系色で明滅させるより、対象がどれかが一目で分かる。
const COMPLEMENT = [
  '#6dfcbd', // 1 ピンクの反対
  '#8dd246', // 2 パープルの反対
  '#a439ae', // 3 グリーンの反対
  '#a439ae', // 4
  '#8dd246', // 5
  '#6dfcbd', // 6
] as const;

// フィーバーで巻き込まれたマスは6色を回す。色そのものは CSS の
// die-charge-fever に置いてある。JSから渡す値が無いので、ここでは持たない。

const NICO = 0;
const NICO_COLOR = '#241a30';
// --- ストーリーモードの敵 ---
// 目の数字は負の値で持つ。1〜6 とは足しても 7 にならないので、セヴン消しには加わらない。
// コイツメ … 無地のザコ。隣でセヴン目が成立すると消える
// ダメ     … 中央に✕のある中ザコ。1回目の命中で✕が消えてコイツメになり、2回目で消える
const KOITSUME = -1;
const DAME = -2;
// ヒドイメ … 2×2マスを占める大物（10メン）。見た目は src/enemy/Hidoime.tsx。
// 4マスとも同じ group を持つので、落ちるときは2×2のまま一緒に落ちる。
// となりでセヴン目（やひっさつメ）が消えるたびに1ダメージ。HIDOIME_HP 回で倒れる。
const HIDOIME = -3;
const HIDOIME_HP = 5; // 泡の量が5段階（100→80→60→40→20→0%）なので、1回で1段ずつ減る
const HIDOIME_BONUS = 1500; // 倒したときの点
// ベラボウメ（17メン）。3×3マスの大きな敵で、目が9つある。
// となりでセヴン目（やひっさつメ）が消えるたびに目が1つつぶれ、9つぜんぶつぶれたら倒れる
const BERABOU = -4;
const BERABOU_HP = STORY_BERABOU_HP;
const BERABOU_BONUS = 3000;
// デタラメ（18メン）。1列を縦に占める闇のスライム。段ごとに目が1つあり、
// となりでセヴン目（やひっさつメ）が消えると、その段の目だけが消える。ぜんぶ消すと倒れる
const DETARAME = -5;
const DETARAME_BONUS = 2500;
// アンチクショウメ（ウォール6-2）。1×1から隣のサイを食べて最大4×4まで広がる最強の敵。
// 弱点は1つだけの目。ひっさつメ（イチニノサンダーなど）の範囲が目のマスに入ったときだけ倒せる。
// 見た目は src/enemy/Anchikushoume.tsx（仕様：docs/anchikushoume/DESIGN.md）
// イチニノサンダーの「イチ」「ニ」「サン」「ダー！」はそれぞれこの長さ（4つで2.8秒）
const THUNDER_CALL_MS = 320;
// 2026-10-14：「イチ・ニノ」のあと、「サンダー！」の前に置くタメ
const THUNDER_TAME_MS = 300;
// 「サンダー！」を見せておく長さ（ダー！が飛び出して止まるまで）
const THUNDER_DAR_HOLD_MS = 520;
const ANCHI = -6;
const ANCHI_GROUP = -6000;
const ANCHI_BONUS = 5000;
const ANCHI_GROW_TURNS = 2; // この手数ごとに1段階広がる
const ANCHI_DEFEAT_HITS = 4; // 通常は白・雷は黄色で点滅して「バシッ」と鳴る回数
const ANCHI_DEFEAT_HIT_MS = 110;
const ANCHI_EYE_MOVE_MS = 1500; // 目はこの時間ごとに外周の別のマスへ動く（操作できるあいだだけ）
// ペンキ：4手に1回（以前の半分）、近くのサイ2〜3か所へ。発射→着弾→3〜5秒→消失。
const ANCHI_PAINT_RANGE = 3; // 身体からこのマス数以内のサイをねらう
const ANCHI_PAINT_SHAPES = [0, 1, 3, 4]; // 1×1〜1.5×1.5の小さめの形（サイの端は見えてよい）
// 広がる順（横×縦）。1×1→2×1→2×2→3×2→3×3→4×3→4×4
const ANCHI_SIZES: Array<[number, number]> = [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3], [4, 3], [4, 4]];
const isStoryReview = () => ['localhost', '127.0.0.1', 's7-review.vercel.app'].includes(location.hostname) && new URLSearchParams(location.search).get('review') === 'story';
const SWARM_MAX_COUNT = STORY_SWARM_COUNT; // 16メンで降ってくるヒドイメの数
const ENEMY_COLOR = '#2c3446';
const isEnemy = (value: number) => value < 0;
const ENEMY_HIT_GAP_MS = 40; // セヴン目が消えてから命中の音と絵まで
const ENEMY_HIT_MS = 220; // 命中の白い弾みを見せてから消すまで
// ひっさつメ・ニコニコボムでは、爆発と同時に敵へダメージの演出を出し、
// メが消えてからこの間を置いて敵が消える（消える音もここで鳴らす）
const ENEMY_VANISH_DELAY_MS = 280;
const ENEMY_BONUS = 300; // コイツメ1体を倒した点

// 企画書の「2と5は黒い吊り目を持つ」に合わせ、目玉は2と5だけ黒、他は白。
const DARK_PIP_VALUES = new Set([2, 5]);
const PIP_DARK = '#330066'; // 2と5の目。黒ではなく、暗いが彩度のあるパープル
const PIP_LIGHT = '#ffffff';
const pipColorFor = (value: number) => (DARK_PIP_VALUES.has(value) ? PIP_DARK : PIP_LIGHT);

// セリフの中に置く、サイノメの小さな絵。「1と6」を数字ではなく目の絵で見せる。
// CSS のメは目の大きさを px で決めているので、字の大きさまで縮めると比率が崩れる。
// そこで一度だけ画面外で PNG に焼き、文字と同じように img で並べる。
// 絵の比率（角丸26%・目の位置28/50/72%・目の大きさ13%）はメと同じ。
// セリフの中では [1]〜[6] と書けば、その目の絵に置き換わる。
const DIE_GLYPH_PX = 96; // 焼く大きさ。表示は字の高さなので、高解像度の画面でもにじまない
const DIE_GLYPH_PIPS: Record<number, Array<[number, number]>> = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.5], [0.72, 0.5], [0.28, 0.72], [0.72, 0.72]],
};
const dieGlyphCache = new Map<number, string>();
const dieGlyph = (value: number): string => {
  const cached = dieGlyphCache.get(value);
  if (cached) {
    return cached;
  }
  const size = DIE_GLYPH_PX;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) {
    return '';
  }
  const r = size * 0.26;
  const body = () => {
    g.beginPath();
    g.roundRect(0, 0, size, size, r);
  };
  body();
  g.fillStyle = COLORS[value - 1];
  g.fill();
  // メと同じ、左上から差すほのかな明るさと、右下の沈み
  const shade = g.createLinearGradient(0, 0, size * 0.55, size);
  shade.addColorStop(0, 'rgba(255,255,255,0.28)');
  shade.addColorStop(1, 'rgba(0,0,0,0.16)');
  body();
  g.fillStyle = shade;
  g.fill();
  g.fillStyle = pipColorFor(value);
  DIE_GLYPH_PIPS[value].forEach(([px, py]) => {
    g.beginPath();
    g.arc(px * size, py * size, size * 0.065, 0, Math.PI * 2);
    g.fill();
  });
  const url = canvas.toDataURL('image/png');
  dieGlyphCache.set(value, url);
  return url;
};

// セリフの折り返し。日本語はどこでも折れてしまうので、CSS では word-break: keep-all で
// 字の途中では折らないようにし、よい区切りにだけゼロ幅スペース（\u200B）を入れて、そこで折らせる。
// よい区切り：、。！？♪～… と閉じかっこのあと／開きかっこの前／空白／
// 「は が を に で と も へ の」のあとで、次が漢字・カタカナ・数字・記号のとき（語の頭が来るところ）
const LINE_BREAK_AFTER = /[、。！？!?♪～…』」）)]/;
const LINE_BREAK_BEFORE = /[『「（(]/;
const LINE_PARTICLE = /[はがをにでともへの]/;
const HIRAGANA = /[\u3041-\u309F]/;
const addLineBreaks = (text: string) => {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    out += char;
    if (!next || next === ' ' || char === ' ') continue;
    if (LINE_BREAK_AFTER.test(char) && !LINE_BREAK_AFTER.test(next)) {
      out += '\u200B';
    } else if (LINE_BREAK_BEFORE.test(next)) {
      out += '\u200B';
    } else if (LINE_PARTICLE.test(char) && i > 0 && !HIRAGANA.test(next) && !LINE_BREAK_AFTER.test(next) && next !== 'ー') {
      out += '\u200B';
    }
  }
  return out;
};

// セリフの文字列を、7 の強調とサイノメの絵を混ぜた並びにする
// 字の並びを、7 の強調だけ付けて返す
const renderSevens = (text: string, key: string) =>
  text.split(/([7７])/).map((part, index) =>
    part === '7' || part === '７' ? (
      <em className="seven-mark" key={`${key}-${index}`}>
        {part}
      </em>
    ) : (
      part
    ),
  );

// 1つの文を組む。サイノメの絵は、すぐあとの字（次の区切りまで）とくっつけて折れないようにし、
// 絵の前でだけ折れるようにする。こうすると「[3]を」の途中で切れず、行が絵から始まる
const renderChunk = (text: string, key: string) => {
  const parts = text.split(/(\[[1-6]\])/).filter(Boolean);
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < parts.length) {
    if (!/^\[[1-6]\]$/.test(parts[i])) {
      nodes.push(...renderSevens(addLineBreaks(parts[i]), `${key}-t${i}`));
      i += 1;
      continue;
    }
    // 絵のかたまり（[1][6] のように続く絵）と、そのあとの字を次の区切りまで
    const group: React.ReactNode[] = [];
    const start = i;
    while (i < parts.length && /^\[[1-6]\]$/.test(parts[i])) {
      const value = Number(parts[i][1]);
      group.push(<img alt={String(value)} className="die-glyph" key={`${key}-g${i}`} src={dieGlyph(value)} />);
      i += 1;
    }
    let rest = '';
    if (i < parts.length) {
      const tail = addLineBreaks(parts[i]);
      const cut = tail.indexOf('\u200B');
      group.push(...renderSevens(cut < 0 ? tail : tail.slice(0, cut), `${key}-h${i}`));
      rest = cut < 0 ? '' : tail.slice(cut);
      i += 1;
    }
    if (nodes.length > 0) nodes.push('\u200B');
    nodes.push(
      <span className="nobr" key={`${key}-n${start}`}>
        {group}
      </span>,
    );
    if (rest) nodes.push(...renderSevens(rest, `${key}-r${i}`));
  }
  return nodes;
};

// セリフを組む。2文以上あるときは、1文目の「！」（？。）までで必ず改行し、残りを2行目にする
// 1文目の終わり（「！」「？」「。」の並びのすぐあと）の位置。かっこの中の「？」では切らない
const firstSentenceEnd = (text: string) => {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if ('『「（('.includes(char)) depth += 1;
    else if ('』」）)'.includes(char)) depth = Math.max(0, depth - 1);
    else if (depth === 0 && /[！？。!?]/.test(char)) {
      let end = i + 1;
      while (end < text.length && /[！？。!?♪～]/.test(text[end])) end += 1;
      const rest = text.slice(end).trim();
      return rest.length > 0 ? end : -1;
    }
  }
  return -1;
};

const renderLine = (text: string) => {
  // セリフの中に \n があれば、そこで必ず改行する（言い回しの切れ目を書き手が決めたいとき）
  const manual = text.indexOf('\n');
  if (manual > 0) {
    return [
      ...renderChunk(text.slice(0, manual), 'a'),
      <br key="br" />,
      ...renderChunk(text.slice(manual + 1), 'b'),
    ];
  }
  const end = firstSentenceEnd(text);
  if (end > 0) {
    return [
      ...renderChunk(text.slice(0, end), 'a'),
      <br key="br" />,
      ...renderChunk(text.slice(end).trim(), 'b'),
    ];
  }
  return renderChunk(text, 'a');
};

const PRE_CLEAR_WAIT_MS = 100; // 消える直前のタメ。セヴン目音はこのぶんだけ先に鳴る
// 自然落下で着地するとき、設置音をどれだけ先に鳴らすか。
// iPhone は鳴らしてから実際に音が出るまでにこれくらい掛かる。
// 着地の音を予約しておく早さ。この時点で「着地まであと何ms」を計って、
// 音そのものは AudioContext の時刻で着地に合わせて鳴らす（TOUCHDOWN_SOUND_AFTER_MS）。
// 予約を早めに入れておくのは、落下の刻みや描画の都合で音が遅れないようにするため。
// 自然落下の速さ（speed の決め方）
const FALL_BASE_MS = 780; // Lv1 の1段の間隔
const FALL_RATIO = 0.93; // 1レベル上がるごとに掛ける割合
const FALL_FLOOR_MS = 180; // これより速くはしない
// ② 着地してから、自然落下で固定されるまでの最低の猶予。
// 以前は「次の1段の刻み」で固定していたので、猶予が落下の間隔と同じになり、
// 速いレベルでは 0.18秒しか横へずらせなかった。落下が速くなっても、
// 着地してからこの時間は必ずずらせるようにする。
// 猶予は最初に着地した時刻から数え、ずらしても延びない（いつまでも粘れないように）。
// ↓で送って固定するのは、これまでどおりすぐ固定する。
const LOCK_GRACE_MS = 400;
// 設置音の予約を、次の落下の刻みのどれだけ前に入れるか。
// LOCK_SOUND_EARLIER_MS ぶん先回りできるよう、それより少し長く取る。
// 以前は 85ms で、設置音を120ms早めた時点で頭打ちになっていた。
const LOCK_SOUND_LEAD_MS = 220;
// 落下の刻みから、着地した絵が実際に出るまでの遅れ（実測でおよそ15ms）
const LANDING_PAINT_LAG_MS = 15;
const FLASH_MS = 300; // 消失時の点滅時間

// ボムは祝福演出のため、タメも消失表示も通常の3倍かける
const BOMB_WAIT_MULTIPLIER = 3;
// ボムのタメは今までどおり240ms。セヴン目のタメだけ変えたので直に書く
const BOMB_PRE_CLEAR_WAIT_MS = 240;
const BOMB_FLASH_MS = FLASH_MS * BOMB_WAIT_MULTIPLIER; // 900ms
// ボムが消える前に、消える範囲を光らせて見せる時間
const BOMB_TELEGRAPH_MS = 300;
// ボムが出る直前、盤面を止めて対象を点滅させる時間
const BOMB_CHARGE_MS = 400;
// ボム音の尺。フラッシュ区間(BOMB_FLASH_MS = 900ms)を覆い切り、
// 弾け飛ぶマスが消えたあとも余韻が残るように、従来の約3倍を取る。
const BOMB_SOUND_MS = 2000;
// ニコニコボムの色反転点滅の長さ。救済技なので通常より長く見せる
const NICO_FLASH_MS = 600;
// ニコニコボムの発動演出。
// 溜め（スポットライト＋反転）→ 完全静止 → 既存の消去、の順に進む。
const NICO_CHARGE_MS = 1200;
const NICO_HOLD_MS = 600;

// 危険領域は盤面の上から7段（y = 0〜6、盤面のちょうど上半分）。
// ここにメが到達すると危険状態に入り、消したときの得点が2倍になり、
// ニコニコメが落下候補に加わる。
const DANGER_ROWS = 7;
const DANGER_LINE_Y = DANGER_ROWS - 1; // 6（この行以下のyが危険領域）
// 虹ボムが消し飛ばす範囲。危険領域の7段に、その下の2段を足した9段。
// 危険の判定（DANGER_ROWS）とは別に持つ。救済としての手応えを上げるために
// 消す範囲だけを広げていて、危険状態に入る高さは変えていない。
const RAINBOW_ROWS = DANGER_ROWS + 2;
const NICO_SPAWN_RATE = 0.05; // 危険状態のときニコニコメが出る確率

// フィーバー
const FEVER_DURATION_MS = 15000; // 発動してから終わるまで
// ゲージは「FEVER」の5文字。1文字あたり20%ずつ溜まる
const FEVER_LETTERS = ['F', 'E', 'V', 'E', 'R'] as const;
const FEVER_SCORE_MULTIPLIER = 4;
const DANGER_SCORE_MULTIPLIER = 2;
const BIG_CLEAR_MIN = 5; // この数以上まとめて消すと
const BIG_CLEAR_MULTIPLIER = 1.5;
const DOUBLE_TAP_MS = 250; // ←→の素早い2回入力とみなす間隔

// スワイプ操作のしきい値
const TAP_MAX_MOVE_PX = 12; // これ以下の指の移動はタップ（回転）とみなす
const TAP_MAX_MS = 300; // これ以上長押しならタップとみなさない
const FLICK_MAX_MS = 220; // フリック（端まで移動 / 一気に落下）と判定する時間
const FLICK_MIN_PX = 48; // フリックとみなす最小の移動量
const AXIS_LOCK_PX = 8; // この距離を超えた時点で縦か横に操作を固定する

// 一気に落下したときの着地の手応え。動かすのはメの並びだけ
const IMPACT_MS = 200;
const IMPACT_DROP_PX = 3; // 沈む量
const IMPACT_RISE_PX = 1.5; // 跳ね返って浮く量

// 2026-10-15：連鎖・ひっさつメの手応え。メの並び（.board-grid）だけを小刻みに揺らす。
// 1連鎖のふつうの7消しでは揺らさない（毎回だと疲れて、大きい技との差が出ない）。
// 動かすのは transform だけ。枠・スコア・HUD は動かさない。動きを減らす設定なら揺らさない
type BoardShake = 'sm' | 'lg';
const SHAKE_SPEC: Record<BoardShake, { px: number; ms: number; steps: number }> = {
  sm: { px: 2, ms: 160, steps: 5 }, // 2連鎖以上
  lg: { px: 4.5, ms: 280, steps: 8 }, // ひっさつメ・5連鎖以上
};
const shakeBoard = (level: BoardShake) => {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const grid = document.querySelector('.board-grid');
  if (!grid || typeof grid.animate !== 'function') return;
  const { px, ms, steps } = SHAKE_SPEC[level];
  // 左右に交互に振り、だんだん小さくする。縦はその半分だけ添える
  const frames: Keyframe[] = [{ transform: 'translate(0, 0)' }];
  for (let i = 0; i < steps; i += 1) {
    const fade = 1 - i / steps;
    const side = i % 2 ? -1 : 1;
    frames.push({ transform: `translate(${(side * px * fade).toFixed(2)}px, ${(-side * px * 0.4 * fade).toFixed(2)}px)` });
  }
  frames.push({ transform: 'translate(0, 0)' });
  grid.animate(frames, { duration: ms, easing: 'linear' });
};

// 盤面の見た目の実寸。CSS の .board-panel / .board-grid と揃えること
const BOARD_PADDING = 8; // .board-panel の padding
const CELL_GAP = 0; // .board-grid の gap。マスは隙間なく敷き詰める
// ゲームオーバー確定後の演出。盤面を下から順に灰へ沈め、そのあと文字を出す。
// --- 虹ボム ---
// 上から9段（危険領域の7段＋その下の2段）を丸ごと消し飛ばす救済。
// 詳しい決定の経緯は docs/虹ボム仕様.md にある。
const RAINBOW_MAX_STOCK = 3; // 持ち越しの上限
// 支給の閾値。仕様では 150〜200 の暫定で、実測して詰める前提。
// 増やすほど渋くなる。ここだけ動かせば効きが変わる。
// 獲得点の累計がこの値に届くごとに1つ支給。ゲームをまたいで貯まり、アプリを閉じると0に戻る
// 累積スコア（全モード・全プレイの合計）。9桁で説明画面に出す。
// この累積が RAINBOW_STEP を1つ越えるごとに、虹ボムを1つ手に入れる（一度に1つまで）
const TOTAL_SCORE_KEY = 'sainome-total-score';
const TOTAL_SCORE_DIGITS = 9;
const RAINBOW_STEP = 100000;
const RAINBOW_AWARD_MS = 1000; // 獲得ワイプが画面を横切りきるまで
// 「使う？」の待ち時間。3秒 → 1.5倍の4.5秒。輪のゲージはこの長さをかけて減るので、
// 待ち時間を延ばしたぶん、ゲージもそのままゆっくり進む。1秒ごとの刻み音は5回になる
const RAINBOW_ASK_MS = 4500;
// ゲームオーバーの沈みを、ここでいったん止めて選択を挟む。
// 危険領域が沈みかけたところで止まるので、消える範囲と灰の範囲が重なる。
const RAINBOW_CUT_IN_MS = 600;
// 使ったあとの流れ。灰を下から戻し、白く弾けさせ、メを外へ飛ばす。
const RAINBOW_RESTORE_MS = 600; // 灰を上から復色するまで。目で追えるよう半分の速さにした
const RAINBOW_HOLD_MS = 400; // 復色しきってから弾けるまでの溜め
const RAINBOW_BURST_MS = 820; // メが飛び切るまで。CSS の rainbow-burst と同じ長さ
// 粒を出すマスの上限。危険領域が埋まっていると最大49マスあり、
// 全部に粒を付けるとスマホで確実にコマが落ちる。
const RAINBOW_DUST_CELLS = 12;

const GAMEOVER_GRAY_MS = 1600; // 上段から下へ、数マスずつ灰にしていく時間
const GAMEOVER_GRAY_TICKS = 20; // 何回に分けて染めるか。1回あたり数マス
const GAMEOVER_TEXT_MS = 400; // 文字がバラバラに出そろうまでの時間

// 消失後の落下は等速ではなく加速させる。
// 1マス目を50msで落とし、1マス進むごとに間隔を0.8倍して33msで頭打ちにする。
// 33msは60fpsでちょうど2フレーム。これより短くすると1フレームに詰まって
// 途中経過が描かれず、瞬間移動に見えてしまう。
const FALL_START_MS = 50;
const FALL_MIN_MS = 33;
const FALL_ACCEL = 0.8;

const fallStepMs = (step: number) =>
  Math.max(FALL_MIN_MS, Math.round(FALL_START_MS * FALL_ACCEL ** step));

type Cell = {
  enjo?: EnjoWall;
  hyoketsu?: 'frozen' | 'active';
  fuse?: number;
  id: string;
  value: number;
  group: number; // 由来のブロックID。同じIDで隣接している間は1つの塊として扱う
};

type Board = Array<Array<Cell | null>>;

// ブロックの形は正方行列で保持する。
// 行列を90度回転させるだけで、一列は「中央マス」、L字は「2×2の中心」が
// そのまま回転の起点になる。
type Matrix = Array<Array<number | null>>;

type Piece = {
  id: number;
  x: number; // 行列の左上が置かれる盤面座標
  y: number;
  matrix: Matrix;
};

type Position = {
  x: number;
  y: number;
};

type GameStatus = 'ready' | 'playing' | 'paused' | 'clearing' | 'gameover' | 'cleared';

type ShapeTemplate = {
  name: string;
  size: number;
  weight: number; // 出現の重み
  slots: Position[]; // 行列内でメを置く位置。values[i] が slots[i] に入る
};

// 出現率は「一列」と「L字」で50%ずつ。L字は4向きに均等配分するので各12.5%。
const SHAPES: ShapeTemplate[] = [
  {
    name: '一列',
    size: 3,
    weight: 4,
    slots: [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
  },
  {
    name: 'L字（右下欠け）',
    size: 2,
    weight: 1,
    slots: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
  },
  {
    name: 'L字（左下欠け）',
    size: 2,
    weight: 1,
    slots: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ],
  },
  {
    name: 'L字（左上欠け）',
    size: 2,
    weight: 1,
    slots: [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
  },
  {
    name: 'L字（右上欠け）',
    size: 2,
    weight: 1,
    slots: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
  },
];

const TOTAL_SHAPE_WEIGHT = SHAPES.reduce((sum, shape) => sum + shape.weight, 0);

const pickShape = (): ShapeTemplate => {
  let ticket = Math.random() * TOTAL_SHAPE_WEIGHT;
  for (const shape of SHAPES) {
    ticket -= shape.weight;
    if (ticket < 0) {
      return shape;
    }
  }
  return SHAPES[0];
};

// 危険領域に1つでもメがあるか（＝下から7段目に到達しているか）
const isDangerBoard = (board: Board): boolean =>
  board.some((row, y) => y <= DANGER_LINE_Y && row.some(Boolean));

const emptyBoard = (): Board =>
  Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));

// ===== デバッグモード（リリース時に丸ごと削除する） =====
// 検証したい役が滅多に出ないので、出現率を持ち上げるための仕掛け。
//
// 有効にするには URL に ?debug=1 を付ける。
//   http://localhost:5187/?debug=1
//
// コードに状態を持たせていないので、うっかり有効のままコミットすることがない。
// リリース時は、この節と DEBUG_BLOCK_END までを消し、
// 参照している箇所（randomValue / pickShape / App の debug パネル）を戻せばよい。
//
// 削除対象:
//   - この定数群と debugRates()
//   - randomValue / pickShape 内の debug 参照
//   - App 内の DebugPanel と、その描画箇所
//   - index.css の .debug-panel 一式

const DEBUG_BOOST = 5; // 出現率の倍率

type DebugState = {
  on: boolean;
  nico: boolean; // ニコニコメを5倍出す
  value: number | null; // この目を5倍出す（null なら偏らせない）
};

const readDebugFlag = (): boolean => {
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    return false;
  }
};

// 生成関数からも読めるよう、モジュール変数に置く。
// React の状態にすると、盤面生成が state を参照することになって配線が増える。
const debugState: DebugState = { on: readDebugFlag(), nico: true, value: null };

const debugNicoRate = () =>
  debugState.on && debugState.nico
    ? Math.min(1, NICO_SPAWN_RATE * DEBUG_BOOST)
    : NICO_SPAWN_RATE;

// 指定した目だけ重みを5倍にした抽選。指定がなければ 1〜6 の均等。
const debugPickValue = (): number => {
  const target = debugState.on ? debugState.value : null;
  if (target === null) {
    return Math.floor(Math.random() * 6) + 1;
  }
  const weights = [1, 2, 3, 4, 5, 6].map((v) => (v === target ? DEBUG_BOOST : 1));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let ticket = Math.random() * total;
  for (let i = 0; i < weights.length; i += 1) {
    ticket -= weights[i];
    if (ticket < 0) {
      return i + 1;
    }
  }
  return 6;
};
// ===== デバッグモードここまで =====

// ストーリー序盤（1〜4メン）では 2 と 5 を出にくくして、合計7を揃えやすくする。
// 2 と 5 は暗い目で、組み合わせの相手が互いしかないぶん詰まりやすい。
let storyDiceBias = false;
const STORY_TWO_FIVE_WEIGHT = 0.45; // 他の目を1としたときの出やすさ
// ひっさつメの教室では、その技をつくる目を3倍出やすくする（3メンは1、5メンは3、6メンは1と3）。
// ミッションで落ちてくるブロックはふつうの乱数なので、その目が来ないとつなげられない。
let storyBoostValues: number[] = [];
const STORY_BOOST_WEIGHT = 3;
const storyPickValue = (boostWeight = STORY_BOOST_WEIGHT): number => {
  const weights = [1, 2, 3, 4, 5, 6].map((v) =>
    storyBoostValues.includes(v) ? boostWeight : v === 2 || v === 5 ? STORY_TWO_FIVE_WEIGHT : 1,
  );
  let ticket = Math.random() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < weights.length; i += 1) {
    ticket -= weights[i];
    if (ticket < 0) {
      return i + 1;
    }
  }
  return 6;
};

// ストーリーでニコニコメを出す確率（危険状態でなくても出す）。11・12メンで使う
let storyNicoRate = 0;
const STORY_NICO_LESSON_RATE = 0.1; // 11メンのミッション
const STORY_NICO_BOOST_RATE = 0.15; // 12メン。ふだん（危険時0.05）より出やすくする

// 2026-10-13：敵を倒すミッションで、デタラメなどに敵を増やされて分母が膨らんだら、
// ニコニコメを出やすくする（分母24超で1.5倍、36超で2倍）。毎回の描画で MISSION の分母から決める
let storyNicoBoost = 1;
const nicoBoostFor = (goal: number) => (goal > 36 ? 2 : goal > 24 ? 1.5 : 1);

const randomValue = (danger: boolean, boostWeight = STORY_BOOST_WEIGHT) =>
  (danger && Math.random() < debugNicoRate() * storyNicoBoost) || Math.random() < storyNicoRate * storyNicoBoost
    ? NICO
    : storyDiceBias
      ? storyPickValue(boostWeight)
      : debugPickValue();

const cloneBoard = (board: Board): Board => board.map((row) => [...row]);

const buildMatrix = (shape: ShapeTemplate, values: number[]): Matrix => {
  const matrix: Matrix = Array.from({ length: shape.size }, () =>
    Array.from({ length: shape.size }, () => null as number | null),
  );
  shape.slots.forEach((slot, index) => {
    matrix[slot.y][slot.x] = values[index];
  });
  return matrix;
};

// 同じブロック内で上下左右に隣り合うメの合計が7になっていないか調べる。
// 隣接関係は回転しても変わらないので、生成時に1度だけ確認すれば足りる。
const hasInnerSeven = (matrix: Matrix): boolean => {
  const size = matrix.length;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = matrix[y][x];
      if (value === null) {
        continue;
      }
      const right = x + 1 < size ? matrix[y][x + 1] : null;
      if (right !== null && value + right === 7) {
        return true;
      }
      const below = y + 1 < size ? matrix[y + 1][x] : null;
      if (below !== null && value + below === 7) {
        return true;
      }
    }
  }
  return false;
};

const createPiece = (id: number, danger = false, boostWeight = STORY_BOOST_WEIGHT): Piece => {
  const shape = pickShape();

  // ニコニコメは1つのブロックに1つまで。2つ以上出ると、置いた瞬間に
  // ブロック内で隣り合ってニコニコボムが確定してしまう。
  const roll = () => {
    const values = Array.from({ length: PIECE_SIZE }, () => randomValue(danger, boostWeight));
    let seen = false;
    return values.map((value) => {
      if (value !== NICO) {
        return value;
      }
      if (seen) {
        return Math.floor(Math.random() * 6) + 1;
      }
      seen = true;
      return value;
    });
  };

  // 落ちた瞬間に自壊しないよう、ブロック内で合計7が成立しない目が出るまで振り直す
  let matrix = buildMatrix(shape, roll());
  while (hasInnerSeven(matrix)) {
    matrix = buildMatrix(shape, roll());
  }

  return {
    id,
    x: Math.floor((COLS - shape.size) / 2),
    y: 0,
    matrix,
  };
};

// 右回り90度。(x, y) -> (size - 1 - y, x)
const rotateMatrixCW = (matrix: Matrix): Matrix => {
  const size = matrix.length;
  const next: Matrix = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null as number | null),
  );
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      next[x][size - 1 - y] = matrix[y][x];
    }
  }
  return next;
};

// 左回り90度。(x, y) -> (y, size - 1 - x)
const rotateMatrixCCW = (matrix: Matrix): Matrix => {
  const size = matrix.length;
  const next: Matrix = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null as number | null),
  );
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      next[size - 1 - x][y] = matrix[y][x];
    }
  }
  return next;
};

const getPieceCells = (piece: Piece): Array<Position & { value: number; key: string }> => {
  const cells: Array<Position & { value: number; key: string }> = [];
  piece.matrix.forEach((row, my) => {
    row.forEach((value, mx) => {
      if (value !== null) {
        cells.push({
          x: piece.x + mx,
          y: piece.y + my,
          value,
          key: `${piece.id}-${my}-${mx}`,
        });
      }
    });
  });
  return cells;
};

// 盤面の上にはみ出した位置（y < 0）は空きとして扱う。
// こうしないと、積みあがった盤面で新しいブロックを出す場所がなくなり、
// 最上段がまだ空いているのにゲームオーバーになってしまう。
const canPlace = (board: Board, piece: Piece) =>
  getPieceCells(piece).every(
    (cell) =>
      cell.x >= 0 &&
      cell.x < COLS &&
      cell.y < ROWS &&
      (cell.y < 0 || !board[cell.y][cell.x]),
  );

// ブロックの出現位置。まずは従来どおり最上段の真ん中から出す。
// 以前は、出口がふさがっていると盤面の上（見えない所）へずらして出していた。
// それだと1つしか見えないブロックが落ちてきて、はみ出たメは置いた瞬間に消えてしまう。
// いまは、ブロック全体が盤面の中に収まる場所を、真ん中から近い順に左右へ探す。
// どこにも収まらなければ積み上がりきり（ゲームオーバー、虹ボムがあれば「使う？」）として扱う。
const spawnAt = (board: Board, piece: Piece): Piece | null => {
  const offsets = [0];
  for (let d = 1; d < COLS; d += 1) offsets.push(-d, d);
  for (const dx of offsets) {
    const candidate = { ...piece, x: piece.x + dx, y: 0 };
    if (canPlace(board, candidate)) {
      return candidate;
    }
  }
  return null;
};

// ゲームオーバー判定：最上段にメが置かれたら終わり。
// 「上から2段目のブロックの上に、さらにブロックが積まれた」状態にあたる。
// ゲームオーバー判定。最上段でも左右の端2マスずつは対象外にして、
// 隅に1つ乗っただけで終わらないようにしている。
const TOP_SAFE_EDGE = 2;

const isTopReached = (board: Board): boolean =>
  board[0].some((cell, x) => Boolean(cell) && x >= TOP_SAFE_EDGE && x < COLS - TOP_SAFE_EDGE);

const placePiece = (board: Board, piece: Piece): Board => {
  const next = cloneBoard(board);
  getPieceCells(piece).forEach((cell) => {
    if (cell.y >= 0 && cell.y < ROWS && cell.x >= 0 && cell.x < COLS) {
      next[cell.y][cell.x] = { id: cell.key, value: cell.value, group: piece.id };
    }
  });
  return next;
};

// 盤面を「塊」に分ける。
// 同じブロック由来（group が同じ）で上下左右につながっているメが1つの塊。
// セヴン消しでブロックの一部が消えると、残りは連結成分ごとに別の塊へ分かれる。
const buildFragments = (board: Board) => {
  const ids = new Int32Array(ROWS * COLS).fill(-1);
  const groups: Position[][] = [];
  const neighbors = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = board[y][x];
      if (!cell || ids[y * COLS + x] !== -1) {
        continue;
      }

      const id = groups.length;
      const members: Position[] = [];
      const stack: Position[] = [{ x, y }];
      ids[y * COLS + x] = id;

      while (stack.length > 0) {
        const point = stack.pop() as Position;
        members.push(point);

        for (const step of neighbors) {
          const nx = point.x + step.x;
          const ny = point.y + step.y;
          if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
            continue;
          }
          const neighbor = board[ny][nx];
          if (!neighbor || ids[ny * COLS + nx] !== -1 || neighbor.group !== cell.group) {
            continue;
          }
          ids[ny * COLS + nx] = id;
          stack.push({ x: nx, y: ny });
        }
      }

      groups.push(members);
    }
  }

  return { ids, groups };
};

// 支えを失った塊を1マスだけ下げる。1ステップずつ描画することで落下を見せる。
// 塊は分解しない。1マスでも支えがあれば宙に張り出したまま残る。
const stepGravity = (board: Board): { board: Board; moved: boolean } => {
  const { ids, groups } = buildFragments(board);
  const falling = new Array<boolean>(groups.length).fill(false);

  // 下にある塊が落ちるなら、その上に乗っている塊も一緒に落ちる。
  // 支持関係は必ず y が増える向きなので、印を付け直すだけで収束する。
  let changed = true;
  while (changed) {
    changed = false;
    for (let id = 0; id < groups.length; id += 1) {
      if (falling[id]) {
        continue;
      }
      const canFall = groups[id].every((point) => {
        if (point.y + 1 >= ROWS) {
          return false; // 床に着いている
        }
        const belowId = ids[(point.y + 1) * COLS + point.x];
        if (belowId === -1 || belowId === id) {
          return true; // 空きマス、または自分自身
        }
        return falling[belowId];
      });
      if (canFall) {
        falling[id] = true;
        changed = true;
      }
    }
  }

  if (!falling.some(Boolean)) {
    return { board, moved: false };
  }

  const next = emptyBoard();
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = board[y][x];
      if (!cell) {
        continue;
      }
      const targetY = falling[ids[y * COLS + x]] ? y + 1 : y;
      next[targetY][x] = cell;
    }
  }

  return { board: next, moved: true };
};

// セヴン消し：上下左右で隣り合う2つのメの合計が7になるペアを検出する。
// 成立するのは 1-6 / 2-5 / 3-4 の3通りのみ。
// 1つのメが複数のペアに属する場合（例: 横に 1,6,1）は、成立した全ペアをまとめて消す。
const findSevenMatches = (board: Board): Set<string> => {
  const clear = new Set<string>();

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = board[y][x];
      if (!cell || cell.hyoketsu || cell.enjo) {
        continue;
      }

      // 右隣と下隣だけを見れば、盤面上の全ペアを重複なく走査できる
      const right = x + 1 < COLS ? board[y][x + 1] : null;
      if (right && !right.enjo && !right.hyoketsu && cell.value + right.value === 7) {
        clear.add(`${x},${y}`);
        clear.add(`${x + 1},${y}`);
      }

      const below = y + 1 < ROWS ? board[y + 1][x] : null;
      if (below && !below.enjo && !below.hyoketsu && cell.value + below.value === 7) {
        clear.add(`${x},${y}`);
        clear.add(`${x},${y + 1}`);
      }
    }
  }

  return clear;
};

// スパ1ボム：1のメが上下左右に4つ以上つながると発動する。
// 通常時は周囲を巻き込まず、つながった1のメだけが消える。
const SPA_ONE_MIN = 5; // 1が5つ以上つながると発動

const findSpaOneBombs = (board: Board): Position[][] => {
  const visited = new Array<boolean>(ROWS * COLS).fill(false);
  const bombs: Position[][] = [];
  const neighbors = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = board[y][x];
      if (!cell || cell.value !== 1 || visited[y * COLS + x]) {
        continue;
      }

      const members: Position[] = [];
      const stack: Position[] = [{ x, y }];
      visited[y * COLS + x] = true;

      while (stack.length > 0) {
        const point = stack.pop() as Position;
        members.push(point);

        for (const step of neighbors) {
          const nx = point.x + step.x;
          const ny = point.y + step.y;
          if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS || visited[ny * COLS + nx]) {
            continue;
          }
          const neighbor = board[ny][nx];
          if (!neighbor || neighbor.value !== 1) {
            continue;
          }
          visited[ny * COLS + nx] = true;
          stack.push({ x: nx, y: ny });
        }
      }

      if (members.length >= SPA_ONE_MIN) {
        bombs.push(members);
      }
    }
  }

  return bombs;
};

// --- ボム技 ---
// スラ3 : 3のメが斜めに3つ  / スク4 : 4のメが2×2  / スト6 : 6のメが縦か横に4つ
const SLA_THREE_MIN = 3;
const SQU_FOUR_MIN = 4;
const STR_SIX_MIN = 4;
const SPA_ONE_DOUBLE = 7; // 1がこの数以上つながるとスコア2倍
const CROSS_MULTIPLIER = 3; // スラ3のX字、スト6の十字はスコア3倍

type BombKind = 'spa1' | 'sla3' | 'squ4' | 'str6';

type BombHit = {
  kind: BombKind;
  cells: Position[]; // 消えるマス全部
  level: number;
  multiplier: number; // 技ごとの倍率（7連結の2倍、X字・十字の3倍）
  // core: 成立の最小形。すきまも埋めてひとつながりに光らせる
  // extra: 同じ目で一緒に消えるマス。すきまは光らせず、マスの中だけ光らせる
  // sweep: 一気通貫で巻き込まれた別の目。白を重ねて巻き添えだと分かるようにする
  core: Position[];
  extra: Position[];
  sweep: Position[];
};

const valueAt = (board: Board, x: number, y: number): number | null => {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) {
    return null;
  }
  const cell = board[y][x];
  return cell ? cell.value : null;
};

const keyOf = (point: Position) => `${point.x},${point.y}`;

const dedupe = (points: Position[]): Position[] => {
  const seen = new Set<string>();
  return points.filter((point) => {
    const key = keyOf(point);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

// ある方向に同じ目が続く「連」を、途切れるまでの最大の長さで拾う。
// 途中から数え始めないよう、1つ手前が同じ目なら始点として扱わない。
const runsOf = (board: Board, value: number, dir: Position, min: number): Position[][] => {
  const runs: Position[][] = [];

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (valueAt(board, x, y) !== value) {
        continue;
      }
      if (valueAt(board, x - dir.x, y - dir.y) === value) {
        continue;
      }
      const run: Position[] = [];
      let cx = x;
      let cy = y;
      while (valueAt(board, cx, cy) === value) {
        run.push({ x: cx, y: cy });
        cx += dir.x;
        cy += dir.y;
      }
      if (run.length >= min) {
        runs.push(run);
      }
    }
  }

  return runs;
};

// その方向のライン全体（盤面の端から端まで）にあるメを集める。
// 一気通貫で巻き込む範囲になる。
const lineThrough = (board: Board, from: Position, dir: Position): Position[] => {
  let sx = from.x;
  let sy = from.y;
  while (sx - dir.x >= 0 && sx - dir.x < COLS && sy - dir.y >= 0 && sy - dir.y < ROWS) {
    sx -= dir.x;
    sy -= dir.y;
  }

  const out: Position[] = [];
  let cx = sx;
  let cy = sy;
  while (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS) {
    const cell = board[cy][cx];
    // ニコニコメはニコニコボム以外では絶対に消えないので、通貫は素通りさせる
    if (cell && cell.value !== NICO) {
      out.push({ x: cx, y: cy });
    }
    cx += dir.x;
    cy += dir.y;
  }
  return out;
};

// 直線・斜めのボム（スラ3・スト6）をまとめて判定する。
// 成立した連を起点に、その方向のラインを端まで一気に消す。
// 2方向の連が交差していれば X字／十字とみなして倍率を上げる。
const findLineBombs = (
  board: Board,
  kind: BombKind,
  value: number,
  dirs: Position[],
  min: number,
): BombHit[] => {
  type Run = { dir: Position; cells: Position[]; keys: Set<string> };

  const runs: Run[] = [];
  dirs.forEach((dir) => {
    runsOf(board, value, dir, min).forEach((cells) => {
      runs.push({ dir, cells, keys: new Set(cells.map(keyOf)) });
    });
  });

  if (runs.length === 0) {
    return [];
  }

  const used = new Array<boolean>(runs.length).fill(false);
  const hits: BombHit[] = [];

  for (let i = 0; i < runs.length; i += 1) {
    if (used[i]) {
      continue;
    }
    // マスを共有する連どうしは1つの技としてまとめる
    const group = [runs[i]];
    used[i] = true;
    let changed = true;
    while (changed) {
      changed = false;
      for (let j = 0; j < runs.length; j += 1) {
        if (used[j]) {
          continue;
        }
        if (group.some((run) => runs[j].cells.some((cell) => run.keys.has(keyOf(cell))))) {
          group.push(runs[j]);
          used[j] = true;
          changed = true;
        }
      }
    }

    const core = dedupe(group.flatMap((run) => run.cells));
    const inCore = new Set(core.map(keyOf));
    const swept = dedupe(group.flatMap((run) => lineThrough(board, run.cells[0], run.dir)));
    const sweep = swept.filter((point) => !inCore.has(keyOf(point)));

    const directions = new Set(group.map((run) => `${run.dir.x},${run.dir.y}`));

    hits.push({
      kind,
      cells: dedupe([...core, ...sweep]),
      level: Math.max(1, core.length - min + 1),
      multiplier: directions.size >= 2 ? CROSS_MULTIPLIER : 1,
      core,
      extra: [],
      sweep,
    });
  }

  return hits;
};

// スパ1ボム：1のメが上下左右に5つ以上つながると発動。7つ以上でスコア2倍。
const findSpaOneHits = (board: Board): BombHit[] =>
  findSpaOneBombs(board).map((cells) => ({
    kind: 'spa1' as const,
    cells,
    level: Math.max(1, cells.length - SPA_ONE_MIN + 1),
    multiplier: cells.length >= SPA_ONE_DOUBLE ? 2 : 1,
    core: cells,
    extra: [],
    sweep: [],
  }));

// スク4ボム：4のメが2×2にそろうと発動。
// 2×2の本体はすきまも埋めて光らせ、そこにつながっている4も一緒に消す。
// つながっている4はすきまを光らせず、マスの中だけを光らせる。
const findSquFourHits = (board: Board, trigger: Set<string>): BombHit[] => {
  const squares: Position[][] = [];
  for (let y = 0; y < ROWS - 1; y += 1) {
    for (let x = 0; x < COLS - 1; x += 1) {
      const square = [
        { x, y },
        { x: x + 1, y },
        { x, y: y + 1 },
        { x: x + 1, y: y + 1 },
      ];
      if (square.every((point) => valueAt(board, point.x, point.y) === 4)) {
        squares.push(square);
      }
    }
  }

  if (squares.length === 0) {
    return [];
  }

  const visited = new Set<string>();
  const hits: BombHit[] = [];
  const steps = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  for (const square of squares) {
    if (square.some((point) => visited.has(keyOf(point)))) {
      continue;
    }

    // 2×2から4方向へ、4のメがつながる限り広げる
    const cells: Position[] = [];
    const stack = [...square];
    square.forEach((point) => visited.add(keyOf(point)));

    while (stack.length > 0) {
      const point = stack.pop() as Position;
      cells.push(point);
      for (const step of steps) {
        const next = { x: point.x + step.x, y: point.y + step.y };
        if (valueAt(board, next.x, next.y) !== 4 || visited.has(keyOf(next))) {
          continue;
        }
        visited.add(keyOf(next));
        stack.push(next);
      }
    }

    // 光らせる本体は、直前に置いたブロックに重なる2×2を優先して選ぶ
    const inCells = new Set(cells.map(keyOf));
    const forms = squares.filter((form) => form.every((point) => inCells.has(keyOf(point))));
    const core =
      forms.find((form) => form.some((point) => trigger.has(keyOf(point)))) ?? forms[0] ?? square;
    const inCore = new Set(core.map(keyOf));

    hits.push({
      kind: 'squ4',
      cells,
      level: Math.max(1, cells.length - SQU_FOUR_MIN + 1),
      multiplier: 1,
      core,
      extra: cells.filter((point) => !inCore.has(keyOf(point))),
      sweep: [],
    });
  }

  return hits;
};

// 4種のボムをまとめて判定する。本体の目は 1 / 3 / 4 / 6 と重ならないので
// 同時に成立しても競合しない。一気通貫の巻き添えは他の目にも及ぶため、
// 消すマスは重複を除いてから使う。
const findAllBombs = (board: Board, trigger: Set<string> = new Set()): BombHit[] => [
  ...findSpaOneHits(board),
  ...findLineBombs(
    board,
    'sla3',
    3,
    [
      { x: 1, y: 1 },
      { x: 1, y: -1 },
    ],
    SLA_THREE_MIN,
  ),
  ...findSquFourHits(board, trigger),
  ...findLineBombs(
    board,
    'str6',
    6,
    [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
    STR_SIX_MIN,
  ),
];

// ニコニコボム：ニコニコメが2つ以上つながると発動し、
// 盤面上のすべての2と5を一斉に消す。危険時の救済技。
// 発動したときは、つながっていないひとりぼっちのニコニコメも一緒に発動し、
// それぞれ自分と周囲8マス（3×3）をまとめて消す。
const findNicoBomb = (board: Board): Position[] | null => {
  const visited = new Array<boolean>(ROWS * COLS).fill(false);
  const neighbors = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  // くっついているニコニコメの塊を集める。2つ以上で発動し、
  // 3つ以上つながっていても扱いは2つのときと同じ。
  const joined: Position[] = [];
  const lone: Position[] = []; // ひとりぼっちのニコニコメ

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = board[y][x];
      if (!cell || cell.value !== NICO || visited[y * COLS + x]) {
        continue;
      }
      const members: Position[] = [];
      const stack: Position[] = [{ x, y }];
      visited[y * COLS + x] = true;
      while (stack.length > 0) {
        const point = stack.pop() as Position;
        members.push(point);
        for (const step of neighbors) {
          const nx = point.x + step.x;
          const ny = point.y + step.y;
          if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS || visited[ny * COLS + nx]) {
            continue;
          }
          const neighbor = board[ny][nx];
          if (!neighbor || neighbor.value !== NICO) {
            continue;
          }
          visited[ny * COLS + nx] = true;
          stack.push({ x: nx, y: ny });
        }
      }
      if (members.length >= 2) {
        joined.push(...members);
      } else {
        lone.push(...members);
      }
    }
  }

  if (joined.length === 0) {
    return null;
  }

  // 発動したら、くっついたニコニコメと、盤面上の 2 と 5 をすべて消す。
  // ひとりぼっちのニコニコメも共に発動し、自分と周囲8マスのメを巻き込む。
  const seen = new Set<string>();
  const cleared: Position[] = [];
  const add = (x: number, y: number) => {
    const key = `${x},${y}`;
    if (seen.has(key) || x < 0 || x >= COLS || y < 0 || y >= ROWS || !board[y][x]) {
      return;
    }
    seen.add(key);
    cleared.push({ x, y });
  };
  joined.forEach((point) => add(point.x, point.y));
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = board[y][x];
      if (cell && (cell.value === 2 || cell.value === 5)) {
        add(x, y);
      }
    }
  }
  lone.forEach((point) => {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        add(point.x + dx, point.y + dy);
      }
    }
  });
  return cleared;
};

// この位置で固定したら何が起きるか。着地の瞬間に鳴らす音を選ぶのに使う。
// セヴン消しなら、設置音の代わりにセヴン目音をその場で鳴らす。
// ボムは発動前の溜めそのものが見せ場なので、ここでは設置音のまま扱う。
const clearKindOnLock = (board: Board, piece: Piece): 'seven' | 'bomb' | null => {
  const placed = placePiece(board, piece);
  if (findNicoBomb(placed)) {
    return 'bomb';
  }
  const triggerKeys = new Set(
    piece.matrix.flatMap((row, my) =>
      row.flatMap((value, mx) =>
        value === null ? [] : [`${piece.x + mx},${piece.y + my}`],
      ),
    ),
  );
  if (findAllBombs(placed, triggerKeys).length > 0) {
    return 'bomb';
  }
  return findSevenMatches(placed).size > 0 ? 'seven' : null;
};


// フィーバー中のボムは周囲1マス（斜めを含む8方向）を巻き込む。
// ただしニコニコメだけは巻き込まない。
const expandForFever = (cells: Position[]): Position[] => {
  const seen = new Set<string>();
  const out: Position[] = [];
  for (const point of cells) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = point.x + dx;
        const ny = point.y + dy;
        const key = `${nx},${ny}`;
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS || seen.has(key)) {
          continue;
        }
        seen.add(key);
        out.push({ x: nx, y: ny });
      }
    }
  }
  return out;
};

// ボム消失時に飛び散る円。1マスにつき4〜8個を、縦横斜めの8方向へばらつかせる。
// 円1つは単色だが、7色のパステルが混ざることで集合が虹色に見える。
// フィーバー中、盤面の外側に散らす円。
// 位置と大きさは一度決めたら変えない。毎回作り直すと、再描画のたびに
// 円が飛び回って落ち着かない。数は 34 個。これ以上増やすと、
// 背景なのに主張しはじめて盤面が見づらくなる。
// 102個から40個へ。1つずつが合成レイヤーを持つので、数がそのまま負荷になる。
// 実測でも数がいちばん効き、58個→40個で秒間コマ数が3割上がった。
// 減らしたぶんは大きさを底上げして、画面の埋まり具合を保っている。
const FEVER_SPARK_COUNT = 40;

// フィーバーの円だけは専用の並び。BURST_COLORS をそのまま使うと暖色に寄るので、
// グリーンとスカイブルーを重ねて入れて、寒色側の出番を増やしている。
const FEVER_SPARK_COLORS = [
  '#ff6f91',
  '#5ecb7a', // グリーン
  '#ffd93d',
  '#3fc7d4', // スカイブルー
  '#a06be0',
  '#7ee081', // ライトグリーン
  '#ffa552',
  '#5b8dee',
  '#4fd6c0', // ミント
  '#ff9ec4',
  '#63c5ff', // 明るいスカイブルー
  '#b6e26a', // 黄みのグリーン
] as const;

type FeverSpark = {
  x: number; // 画面幅に対する位置（%）
  y: number;
  size: number; // px
  delay: number; // 秒
  duration: number;
  color: string;
};

const buildFeverSparks = (): FeverSpark[] =>
  Array.from({ length: FEVER_SPARK_COUNT }, (_, index) => {
    // 見た目の散らばりが欲しいだけなので、乱数ではなく決め打ちで散らす。
    // 黄金比を足していくと、少ない数でも固まらずに散る。
    const golden = (index * 0.6180339887) % 1;
    const spread = ((index * 7) % 31) / 31;
    return {
      x: golden * 100,
      y: spread * 100,
      // 大小を混ぜる。小さい粒を多めにして、大きい粒がたまに混ざる比率
      // 大きさは合成する面積にそのまま効くので、上げすぎない。
      // 見やすさは不透明度と塗りの広さ（グラデーションの止め位置）で稼ぐ。
      size: 14 + ((index * 5) % 7) * 8 + (index % 3 === 0 ? 22 : 0),
      delay: (index % 17) * 0.11,
      // 前は 2.6〜4.6 秒。倍の速さにして、瞬きの回転を上げる
      duration: 1.3 + ((index * 3) % 5) * 0.25,
      color: FEVER_SPARK_COLORS[index % FEVER_SPARK_COLORS.length],
    };
  });

// 虹ボムが弾けた瞬間、画面ぜんたいに散らす虹の粒。
// フィーバーの粒と同じ見た目だが、こちらは一度きりで外へ飛んでいく。
// 数はフィーバー（40個）と同じ水準に収める。増やすとそのまま負荷になる。
const RAINBOW_SPARK_COUNT = 36;

type RainbowSpark = FeverSpark & {
  dx: number; // 飛ぶ先。画面の中心から外向き（%）
  dy: number;
};

const buildRainbowSparks = (): RainbowSpark[] =>
  Array.from({ length: RAINBOW_SPARK_COUNT }, (_, index) => {
    // 画面ぜんたいに散らす。1か所から噴き上げると、大きな塊がひとつ
    // 動いているだけに見えて、量が出ない。
    // 位置は黄金比で散らし、そこから短く外へ弾ける。
    const angle = index * 2.399963; // 黄金角(rad)
    const x = ((index * 0.6180339887) % 1) * 100;
    const y = (((index * 7) % 31) / 31) * 100;
    return {
      x,
      y,
      dx: Math.cos(angle) * 9,
      dy: Math.sin(angle) * 9,
      size: 16 + ((index * 5) % 7) * 9 + (index % 3 === 0 ? 24 : 0),
      delay: ((index % 8) * 0.03),
      duration: 0.72 + ((index * 3) % 5) * 0.09,
      color: FEVER_SPARK_COLORS[index % FEVER_SPARK_COLORS.length],
    };
  });

// フィーバーに入る直前の点火。画面の中心から粒が弾けて外へ広がり、
// その波に乗って地の色が暗→明へ補間される。
// 以前は白を一枚かぶせて切り替わりを隠していたが、白の明滅が
// 画面のチラつきに見えた。いまは白を使わず、粒の広がりと色の補間だけで運ぶ。
const FEVER_IGNITE_MS = 460; // 粒が画面の端まで届くまで。ここでフィーバー本体が始まる
const FEVER_IGNITE_SPARK_COUNT = 32;

type IgniteSpark = RainbowSpark & { fx: number; fy: number };

const buildFeverIgniteSparks = (): IgniteSpark[] =>
  Array.from({ length: FEVER_IGNITE_SPARK_COUNT }, (_, index) => {
    // 中心から噴き上げず、画面ぜんたいに配ってその場で短く弾けさせる。
    // 大きいものをひとつ拡大するより、小さいものを数で出すほうが量が出る。
    //
    // 置き場所は R2 列（2次元版の黄金比）。x と y に別々の無理数を使う。
    // 片方を黄金比、もう片方を「index を素数で割った余り」にすると、
    // 2つの進み方が揃ってしまって粒が斜め1本に並んだ。
    //
    // 行き先は画面ぜんたいに散らすが、出発点はそこから中心へ65%寄せた位置。
    // 全員が中心寄りから外へ走るので、画面が内側から弾けたように見える。
    // 中心から遠いものほど遅れて出るので、広がりが波として読める。
    const x = ((0.5 + index * 0.7548776662466927) % 1) * 100;
    const y = ((0.5 + index * 0.5698402909980532) % 1) * 100;
    const ox = x - 50;
    const oy = y - 50;
    const reach = Math.hypot(ox, oy) / 70; // 0〜約1
    const length = Math.hypot(ox, oy) || 1;
    return {
      x,
      y,
      // 中心側へ戻した出発点（vw / vh）
      fx: -ox * 0.65,
      fy: -oy * 0.65,
      // 着いてからさらに外へ少しだけ抜ける（vmin）
      dx: (ox / length) * 5,
      dy: (oy / length) * 5,
      size: 10 + ((index * 5) % 7) * 5,
      delay: reach * 0.12,
      duration: 0.34 + ((index * 3) % 4) * 0.03,
      color: FEVER_SPARK_COLORS[index % FEVER_SPARK_COLORS.length],
    };
  });

// 獲得ワイプのまわりに散らす花火。フィーバーの粒と同じ動きを速回しするだけ。
// 5つに絞ってあるので、増やすときはここだけ触ればよい。
const RAINBOW_AWARD_SPARKS = [
  { x: 12, y: 18, size: 26, delay: 0, color: '#ff6f91' },
  { x: 84, y: 10, size: 34, delay: 0.09, color: '#ffd93d' },
  { x: 26, y: 82, size: 30, delay: 0.05, color: '#5ecb7a' },
  { x: 70, y: 88, size: 22, delay: 0.14, color: '#3fc7d4' },
  { x: 50, y: 4, size: 30, delay: 0.18, color: '#a06be0' },
] as const;

// ゲームオーバー時に灰へ沈める順番。上の段から下へ向かい、
// 同じ段の中は順不同にする。左から順に並べるとワイパーのように見えて、
// 「上から降りてくる」感じにならない。
// 虹ボムの効果。上から9段（危険領域の7段＋その下の2段）を丸ごと消す。
// 下の段はそのまま残すので、積み上げた地形と仕込みは無駄にならない。
// 大きな敵（ヒドイメ・ベラボウメ・デタラメ）は一部だけ消すと形が崩れるので、ここでは残す。
// ダメージは App の rainbowClear で、ひっさつメと同じように与える
const clearDangerZone = (board: Board): Board =>
  board.map((row, y) =>
    y < RAINBOW_ROWS
      ? row.map((cell) =>
          cell && (cell.value === DETARAME || cell.value === HIDOIME || cell.value === BERABOU) ? cell : null,
        )
      : row,
  );

const buildGrayOrder = (board: Board): string[] => {
  const order: string[] = [];
  for (let y = 0; y < ROWS; y += 1) {
    const row: string[] = [];
    for (let x = 0; x < COLS; x += 1) {
      if (board[y][x]) {
        row.push(`${x},${y}`);
      }
    }
    for (let i = row.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [row[i], row[j]] = [row[j], row[i]];
    }
    order.push(...row);
  }
  return order;
};

// ニコニコボムの溜め中、スポットライトの縁に貼りつく黒い粒。
// 位置は「親の半径ぶん外」ではなく、親に対する % で置く。
// 親（＝円）は縮んでいくので、% で置いておけば粒は縁に貼りついたまま
// 中心へ引き寄せられていく。円の内側へ入り込むこともない。
// ニコニコボムの溜めで、狙いへ集まってくる黒い粒。
// 内と外の2重の輪にして、画面の外寄りからうわっと押し寄せるようにする。
// 以前は縮む円の縁に貼りついていたので、集まってくる距離が短く、
// 最後の一瞬しか粒が目に入らなかった。いまは出発点を画面の外寄りに置き、
// 狙いの縁まで加速しながら一気に詰める。
//
// 軽さのための作り: 向きは粒ごとの「止まった回転」で持たせ、動かすのは
// 出発距離の違う4つの帯（band）ごとに決め打ちした動きだけにしてある。
// 粒ごとの値をアニメーションの中で参照すると、毎コマ計算し直しになって
// 画面が重くなった（64粒で、溜め1.2秒のあいだのスタイル計算が 45ms → 239ms）。
const NICO_SWARM_COUNT = 64;

const NICO_SWARM = Array.from({ length: NICO_SWARM_COUNT }, (_, index) => {
  const outer = index % 2 === 1; // 奇数は外の輪。遅れて、遠くから来る
  // 等間隔だと定規の目盛りに見えるので、黄金角で散らす
  const angle = index * 137.508 + (outer ? 11 : 0);
  return {
    angle,
    band: (outer ? 2 : 0) + (index % 4 < 2 ? 0 : 1), // 0〜3。大きいほど遠くから
    size: 5 + (index % 4) * 2.2,
    delay: (outer ? 0.12 : 0) + (index % 6) * 0.035,
  };
});

const BURST_COLORS = [
  '#ff6f91',
  '#ffa552',
  '#ffd93d',
  '#5ecb7a',
  '#3fc7d4',
  '#5b8dee',
  '#a06be0',
] as const;

type BurstParticle = {
  dx: number; // 飛ぶ先（px）
  dy: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
};

type BurstInfo = {
  dir: Position; // メ本体が弾ける向き
  particles: BurstParticle[];
  rainbow?: boolean; // 虹ボム。通常のボムよりずっと遠くまで飛ばす
  scatter?: boolean; // ミッションの仕切り直し。近くへ軽くはじけて、すばやく消える
};

// ボムの範囲を見せる発光。
// core はすきまも埋めてひとつながりに見せたいので、隣も core の辺だけ
// マスの外側へはみ出させる。extra ははみ出させず、マスの中だけを光らせる。
type GlowInfo = {
  core: boolean;
  sweep: boolean; // 一気通貫やフィーバーの巻き添え。白を重ねて示す
  color: string;
  bleed: { top: number; right: number; bottom: number; left: number };
  delay: number; // 起点から広がって見えるよう、外側ほど遅らせる
};

// ボムの種類ごとの発光色。対象の目の色に合わせる
// --- 有効範囲の軌道 ---
// 消える範囲を、線がサッと走ってなぞることで見せる。
//   セヴン消し・スパ1・スク4 … 消える範囲の輪郭をひと筆でなぞる（スク4なら四角）
//   スラ3・スト6            … 消える範囲の端から端まで、まっすぐ一本走る（斜め／横・縦）
// フィーバー中のボムは、広がった範囲の輪郭を別の線で出す。
// 本来の線より FEVER_TRACE_DELAY_MS 遅れて点滅しながら現れ、
// FEVER_TRACE_LINGER_MS 遅れて消えるので、外へ波及したことが順に読める。
// 座標は盤面のマス単位（左上が0,0、1マスが1）。SVG の viewBox をこれに合わせてある。
const TRACE_DRAW_MS = 200; // 線が走りきるまで
const FEVER_TRACE_DELAY_MS = 300;
const FEVER_TRACE_LINGER_MS = 200;
const SEVEN_TRACE_COLOR = '#ffffff';
const FEVER_TRACE_COLOR = '#ffe27a';

// なぞる形。角の点を順に並べたもの（マス単位）。closed なら最後から最初へ戻る
type TraceShape = { pts: Array<[number, number]>; closed: boolean };
// 実際に描く線。手描き風に揺らした本線と、少しずらした2本目
type TraceSketch = { main: string; echo: string };

type TraceSet = {
  id: number;
  paths: TraceSketch[];
  color: string;
  delay: number; // 出るまでの待ち
  life: number; // 出てから消え終わるまで
  fever: boolean;
  // ボムの線は、本線を 20ms 点灯・20ms 消灯で点滅させる。
  // 消えている瞬間に後ろの2本目の波線が見えて、線が震えているように見える
  blink?: boolean;
};

// マスの集まりの輪郭を、ひと筆書きの閉じた線にする。
// 塗られたマスの辺のうち、隣が塗られていない辺だけを集め、時計回りにつなぐ。
// 左上の角から走り出すので、四角なら上の辺 → 右 → 下 → 左の順になぞる。
const outlinePaths = (cells: Position[]): TraceShape[] => {
  const has = new Set(cells.map((point) => `${point.x},${point.y}`));
  const edges = new Map<string, Array<[number, number]>>();
  const add = (x1: number, y1: number, x2: number, y2: number) => {
    const key = `${x1},${y1}`;
    const list = edges.get(key) ?? [];
    list.push([x2, y2]);
    edges.set(key, list);
  };
  cells.forEach(({ x, y }) => {
    if (!has.has(`${x},${y - 1}`)) add(x, y, x + 1, y);
    if (!has.has(`${x + 1},${y}`)) add(x + 1, y, x + 1, y + 1);
    if (!has.has(`${x},${y + 1}`)) add(x + 1, y + 1, x, y + 1);
    if (!has.has(`${x - 1},${y}`)) add(x, y + 1, x, y);
  });

  const paths: TraceShape[] = [];
  // 上の段・左の列から順に拾うと、どの輪郭も左上から走り出す
  const starts = [...edges.keys()].sort((a, b) => {
    const [ax, ay] = a.split(',').map(Number);
    const [bx, by] = b.split(',').map(Number);
    return ay - by || ax - bx;
  });
  starts.forEach((startKey) => {
    while ((edges.get(startKey)?.length ?? 0) > 0) {
      const [sx, sy] = startKey.split(',').map(Number);
      const points: Array<[number, number]> = [[sx, sy]];
      let cx = sx;
      let cy = sy;
      for (let guard = 0; guard < 400; guard += 1) {
        const list = edges.get(`${cx},${cy}`);
        if (!list || list.length === 0) {
          break;
        }
        [cx, cy] = list.shift() as [number, number];
        if (cx === sx && cy === sy) {
          break;
        }
        points.push([cx, cy]);
      }
      // 一直線上の途中の点は省く。角だけ残すと線がなめらかに走る
      const corners = points.filter((point, index) => {
        const prev = points[(index - 1 + points.length) % points.length];
        const next = points[(index + 1) % points.length];
        return !(
          (prev[0] === point[0] && point[0] === next[0]) ||
          (prev[1] === point[1] && point[1] === next[1])
        );
      });
      if (corners.length >= 3) {
        paths.push({ pts: corners, closed: true });
      }
    }
  });
  return paths;
};

// 一直線に並んだマスを、端から端まで一本の線にする。
// スラ3は斜め、スト6は横か縦。同じ筋に min 個以上並んでいれば一本とみなし、
// 両端のマスの中心から少しはみ出させて「突き抜けた」感じを出す。
const runPaths = (cells: Position[], shape: 'diagonal' | 'straight', min: number): TraceShape[] => {
  const lines = new Map<string, Position[]>();
  const put = (key: string, point: Position) => {
    const list = lines.get(key) ?? [];
    list.push(point);
    lines.set(key, list);
  };
  cells.forEach((point) => {
    if (shape === 'diagonal') {
      put(`d${point.x - point.y}`, point); // ＼
      put(`a${point.x + point.y}`, point); // ／
    } else {
      put(`r${point.y}`, point); // 横
      put(`c${point.x}`, point); // 縦
    }
  });
  const paths: TraceShape[] = [];
  lines.forEach((points) => {
    if (points.length < min) {
      return;
    }
    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const dx = Math.sign(last.x - first.x);
    const dy = Math.sign(last.y - first.y);
    const over = 0.42; // マスの中心からのはみ出し
    const x1 = first.x + 0.5 - dx * over;
    const y1 = first.y + 0.5 - dy * over;
    const x2 = last.x + 0.5 + dx * over;
    const y2 = last.y + 0.5 + dy * over;
    paths.push({
      pts: [
        [x1, y1],
        [x2, y2],
      ],
      closed: false,
    });
  });
  return paths;
};

// 同じ種から同じ乱数列を出す。描き直すたびに線の揺れが変わらないよう、
// 揺れはここで決め打ちにする（Math.random を使うと毎回ちがう線になる）
const seededRandom = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// 定規で引いたような線を、手で引いた線に崩す。
// 辺をおよそ0.45マスごとに刻み、刻み目を線と直角の向きへ少しだけ揺らしてから、
// 刻み目どうしを曲線でつなぐ。角も曲線の中に入るので丸くなる。
const sketchPath = (shape: TraceShape, seed: number, wobble: number): string => {
  const rand = seededRandom(seed);
  const { pts, closed } = shape;
  const count = pts.length;
  const segments = closed ? count : count - 1;
  const out: Array<[number, number]> = [];
  for (let i = 0; i < segments; i += 1) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % count];
    const length = Math.hypot(x2 - x1, y2 - y1) || 1;
    const steps = Math.max(1, Math.round(length / 0.45));
    const nx = -(y2 - y1) / length;
    const ny = (x2 - x1) / length;
    for (let k = 0; k < steps; k += 1) {
      const t = k / steps;
      const offset = (rand() * 2 - 1) * wobble * (k === 0 ? 0.5 : 1);
      out.push([x1 + (x2 - x1) * t + nx * offset, y1 + (y2 - y1) * t + ny * offset]);
    }
  }
  if (!closed) {
    out.push(pts[count - 1]);
  }
  const f = ([x, y]: [number, number]) => `${x.toFixed(3)} ${y.toFixed(3)}`;
  const mid = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];
  if (closed) {
    let d = `M${f(mid(out[out.length - 1], out[0]))}`;
    out.forEach((point, index) => {
      d += `Q${f(point)} ${f(mid(point, out[(index + 1) % out.length]))}`;
    });
    return `${d}Z`;
  }
  if (out.length <= 2) {
    return `M${f(out[0])}L${f(out[out.length - 1])}`;
  }
  let d = `M${f(out[0])}`;
  for (let i = 1; i < out.length - 1; i += 1) {
    d += `Q${f(out[i])} ${f(mid(out[i], out[i + 1]))}`;
  }
  return `${d}L${f(out[out.length - 1])}`;
};

// 形から、本線とずらした2本目を作る。2本がわずかに食い違うのが手描きらしさになる
let traceSeed = 1;
// wavy はスラ3・スト6の一直線用。まっすぐすぎないよう、揺れを強めて波線にする
const sketchShapes = (shapes: TraceShape[], wavy = false): TraceSketch[] =>
  shapes.map((shape) => {
    traceSeed += 1;
    return {
      main: sketchPath(shape, traceSeed * 97, wavy ? 0.1 : 0.05),
      echo: sketchPath(shape, traceSeed * 131 + 7, wavy ? 0.15 : 0.09),
    };
  });

// セヴン消しの線の色。足して7になる目どうしは同じ色の仲間なので、その色に寄せる。
// 盤面の上で沈まないよう、メの色より少し明るくしてある
const SEVEN_TRACE_COLORS: Record<number, string> = {
  1: '#ff8cc0', // 1 と 6 … ピンク
  2: '#b98bff', // 2 と 5 … パープル
  3: '#7fdc6a', // 3 と 4 … グリーン
};
const sevenFamily = (value: number) => Math.min(value, 7 - value);

const BOMB_GLOW_COLORS: Record<BombKind, string> = {
  spa1: '#ffb03a',
  sla3: '#4fc46a',
  squ4: '#35bcd6',
  str6: '#ff6f91',
};

// マス間のすきまを埋めるはみ出し量。マスは隙間なく並んでいるので、
// 小数丸めで細い筋が出るのを防ぐぶんだけあれば足りる
const GLOW_BLEED_PX = 1;

const buildGlow = (
  core: Position[],
  extra: Position[],
  color: string,
  swept: Set<string> = new Set(),
): Map<string, GlowInfo> => {
  const glow = new Map<string, GlowInfo>();
  const inCore = new Set(core.map((point) => `${point.x},${point.y}`));

  // 起点の中心。ここから外へ向かって順に光っていくように遅延をつける
  const cx = core.reduce((sum, point) => sum + point.x, 0) / (core.length || 1);
  const cy = core.reduce((sum, point) => sum + point.y, 0) / (core.length || 1);

  core.forEach((point) => {
    glow.set(`${point.x},${point.y}`, {
      core: true,
      sweep: false,
      color,
      bleed: {
        top: inCore.has(`${point.x},${point.y - 1}`) ? GLOW_BLEED_PX : 0,
        right: inCore.has(`${point.x + 1},${point.y}`) ? GLOW_BLEED_PX : 0,
        bottom: inCore.has(`${point.x},${point.y + 1}`) ? GLOW_BLEED_PX : 0,
        left: inCore.has(`${point.x - 1},${point.y}`) ? GLOW_BLEED_PX : 0,
      },
      delay: 0,
    });
  });

  extra.forEach((point) => {
    const key = `${point.x},${point.y}`;
    if (glow.has(key)) {
      return;
    }
    const distance = Math.hypot(point.x - cx, point.y - cy);
    glow.set(key, {
      core: false,
      sweep: swept.has(key),
      color,
      bleed: { top: 0, right: 0, bottom: 0, left: 0 },
      delay: Math.min(160, Math.round(distance * 45)),
    });
  });

  return glow;
};

const makeParticles = (): BurstParticle[] => {
  const count = 4 + Math.floor(Math.random() * 5); // 4〜8個
  // 8方向を基準に、開始角度と個数で散らし方を変える
  const offset = Math.random() * Math.PI * 2;
  const palette = [...BURST_COLORS].sort(() => Math.random() - 0.5);

  return Array.from({ length: count }, (_, index) => {
    const step = Math.round(((index / count) * 8)) % 8;
    const angle = offset + (step * Math.PI) / 4 + (Math.random() - 0.5) * 0.5;
    const distance = 26 + Math.random() * 34;
    return {
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      size: 5 + Math.random() * 7,
      delay: Math.random() * 90,
      duration: 480 + Math.random() * 320,
      color: palette[index % palette.length],
    };
  });
};

// 虹ボムで消える範囲を、上から下へ流れる光の波で包む。
// メが乗っていないマスも含めて9段ぜんぶを対象にする。
// 空きマスを飛ばすと光が歯抜けになり、「上の9段が消える」という
// 範囲そのものが読めない。
//
// 以前はマスごとに白黒を乱数の位相で点滅させていたが、隣り合うマスが
// ばらばらに反転するので市松模様のチラつきになり、気持ち悪かった。
// いまは値を「段の番号」にして、同じ段は同じ明るさでそろって光り、
// 段ごとに少しずつ遅れて下へ流れる。
const buildRainbowMono = (): Map<string, number> => {
  const mono = new Map<string, number>();
  for (let y = 0; y < RAINBOW_ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      mono.set(`${x},${y}`, y);
    }
  }
  return mono;
};

// 虹ボムで消える9段のメを、範囲の中心から外向きに散らす向きへ割り当てる。
// まず全体がふくらむように外へ押し広げられ、それから回りながら飛び散る。
// 中心から遠いメほど遠くへ飛ぶので、陣形そのものが膨らんで見える。
const buildRainbowBurst = (board: Board): Map<string, BurstInfo> => {
  const targets: Position[] = [];
  board.forEach((row, y) => {
    if (y >= RAINBOW_ROWS) {
      return;
    }
    row.forEach((cell, x) => {
      if (cell) {
        targets.push({ x, y });
      }
    });
  });

  // 粒を付けるマスを間引く。多すぎるとスマホで描き切れない
  const dusty = new Set(
    [...targets]
      .sort(() => Math.random() - 0.5)
      .slice(0, RAINBOW_DUST_CELLS)
      .map((point) => `${point.x},${point.y}`),
  );

  const cx = (COLS - 1) / 2;
  const cy = (RAINBOW_ROWS - 1) / 2;
  // 中心からいちばん遠いマスまでの距離。飛ぶ距離を 0.55〜1 に割り当てる
  const farthest = Math.hypot(cx, cy);
  const bursts = new Map<string, BurstInfo>();
  targets.forEach((point) => {
    const key = `${point.x},${point.y}`;
    const dx = point.x - cx;
    const dy = point.y - cy;
    const length = Math.hypot(dx, dy);
    // ちょうど中心にいるメは向きが決まらないので、真上へ逃がす
    const ux = length > 0.001 ? dx / length : 0;
    const uy = length > 0.001 ? dy / length : -1;
    const reach = 0.55 + 0.45 * (length / farthest);
    bursts.set(key, {
      dir: { x: ux * reach, y: uy * reach },
      particles: dusty.has(key) ? makeParticles() : [],
      rainbow: true,
    });
  });
  return bursts;
};

// --- 案内役サイカ ---
// 顔は32×32のドット絵を2倍(64px)で置く想定。いまは絵文字の仮置き。
const SAIKA_FACE_PLACEHOLDER = '🙂';

// 画像は public/images に置く。ファイルが無い場合は絵文字に戻すので、
// 揃っていなくてもゲームは動く。
const IMAGE_BASE = `${import.meta.env.BASE_URL}images/`;
// タイトル絵は写真的なグラデーションが多くPNGでは重くなるため WebP にしている。
// 透過は使っていないので、アルファを落として品質90で書き出した（915KB → 87KB）。
const TITLE_IMAGE = `${IMAGE_BASE}title.webp`;
// 起動時のサイコロで出た目（1〜6）ごとのタイトル絵。曲も同じ目で選ぶ（bgmSrcFor）。
// 1〜6 は専用の絵（素材 T01-2〜T06-2。アルファを落として品質90の WebP）。
// 絵は 600x1300（縦横比 0.462）。いまのスマホの画面（390x844 など）と同じ比率にしてあり、
// cover で敷いても左右が切れない。9:16 で作ると左右が約9%ずつ切れて拡大して見える。
// title.webp は、目に対応する絵が無いとき・読み込めなかったときの代わり。
const TITLE_IMAGES: readonly string[] = [
  `${IMAGE_BASE}title-1.webp`, // 1
  `${IMAGE_BASE}title-2.webp`, // 2
  `${IMAGE_BASE}title-3.webp`, // 3
  `${IMAGE_BASE}title-4.webp`, // 4
  `${IMAGE_BASE}title-5.webp`, // 5
  `${IMAGE_BASE}title-6.webp`, // 6
];
// 絵を読み込み終えたら解決する。失敗しても止めない（タイトル側の代わりの表示に任せる）。
// decode() は待たない。画面が裏に回っていると解決しないことがあり、
// そのままではサイコロの画面から先へ進めなくなる。
// 回線が極端に遅いときも、PRELOAD_LIMIT_MS で見切ってタイトルへ進む。
const PRELOAD_LIMIT_MS = 4000;
const preloadImage = (src: string): Promise<void> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    window.setTimeout(resolve, PRELOAD_LIMIT_MS);
    img.src = src;
  });

// サイコロの演出の長さ
const INTRO_ROLL_MS = 720; // 転がっているあいだ
const INTRO_FACE_MS = 75; // 転がり中に目が切り替わる間隔
const INTRO_HOLD_MS = 520; // 止まった目を見せてからタイトルへ移るまで

// サイカの表情。通常 / 焦り / フィーバー の3枚を使い分ける。
// 表情は5枚。ふだんの3つと、フィーバー中の2つに分かれる。
// 01/02/03 が通常時、10/11 がフィーバー中。
// 末尾の 1 と 3 がボムを決めた瞬間、0 と 2 がそれ以外、という対応になっている。
const SAIKA_FACES = {
  // --- 通常時 ---
  hello: `${IMAGE_BASE}saika-01.png`, // 元気・歓迎。開幕の第一声だけ
  worry: `${IMAGE_BASE}saika-02.png`, // あせり。危険領域に届いた
  bomb: `${IMAGE_BASE}saika-03.png`, // どや。技が決まった／ほめている
  calm: `${IMAGE_BASE}saika-04.png`, // おだやか。待機の基本
  smile: `${IMAGE_BASE}saika-05.png`, // にこにこ。機嫌がいい
  laugh: `${IMAGE_BASE}saika-06.png`, // 大笑い。2〜3連鎖
  fired: `${IMAGE_BASE}saika-07.png`, // 気合。4連鎖以上
  surprise: `${IMAGE_BASE}saika-08.png`, // おどろき。ニコニコメ出現
  relief: `${IMAGE_BASE}saika-09.png`, // ほっと安心。危険領域を脱した
  // --- フィーバー中 ---
  fever: `${IMAGE_BASE}saika-10.png`, // フィーバー通常
  feverLaugh: `${IMAGE_BASE}saika-11.png`, // 大笑い。ほめている
  feverBomb: `${IMAGE_BASE}saika-12.png`, // どや。技が決まった
  feverPeak: `${IMAGE_BASE}saika-13.png`, // 絶頂。高連鎖・大技
  feverCalm: `${IMAGE_BASE}saika-14.png`, // おだやか。待機の落ち着いた側
} as const;

type SaikaFaceKind = keyof typeof SAIKA_FACES;

// どの顔を出すかを一か所で決める。
// mood と顔はほぼ1対1だが、フィーバー中だけは丸ごと虹色の側へ差し替える。
const FEVER_FACE: Partial<Record<SaikaMood, SaikaFaceKind>> = {
  bomb: 'feverBomb',
  praise: 'feverLaugh',
  chain: 'feverPeak',
  bigChain: 'feverPeak',
  surprise: 'feverPeak',
  // あせりと安堵はフィーバー中に出しても浮くので、通常のフィーバー顔にする
  worry: 'fever',
  relief: 'fever',
  hello: 'fever',
  smile: 'feverCalm',
  idle: 'fever',
};

const NORMAL_FACE: Record<SaikaMood, SaikaFaceKind> = {
  idle: 'calm',
  hello: 'hello',
  smile: 'smile',
  chain: 'laugh',
  bigChain: 'fired',
  surprise: 'surprise',
  relief: 'relief',
  worry: 'worry',
  bomb: 'bomb',
  praise: 'bomb',
};

const faceFor = (mood: SaikaMood, fever: boolean): SaikaFaceKind =>
  (fever ? FEVER_FACE[mood] : undefined) ?? NORMAL_FACE[mood] ?? 'calm';

// --- 表示言語 ---
// 文言はすべてこの1か所にまとめてある。あとから英文を書き換えるときは
// TEXTS.en と SAIKA_LINES.en だけを見ればよい。
type Lang = 'ja' | 'en';

const LANG_KEY = 'sainome-lang';

const loadLang = (): Lang => {
  try {
    const saved = window.localStorage.getItem(LANG_KEY);
    return saved === 'en' ? 'en' : 'ja';
  } catch {
    return 'ja';
  }
};

const saveLang = (lang: Lang) => {
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    // 保存できなくても遊べるので握りつぶす
  }
};

const TEXTS = {
  ja: {
    title: 'サイノメ・セヴン',
    // タイトル画面から外した。戻すときは title-name の下に <p> を足す
    tagline: '合計7で消える落ち物パズル',
    start: 'スコア\nモード',
    resume: '再開',
    restart: 'リスタート',
    playAgain: 'もう一度',
    backToTitle: 'タイトル画面へ',
    paused: '一時停止中',
    gameOver: 'ゲームオーバー',
    thisScore: '今回のスコア',
    best: 'Best',
    noRecords: 'まだ記録はありません',
    bestTitle: '自分のベストスコア',
    howTo: '遊び方',
    howToRule: 'となり合う目の合計を「7」にして消そう。連鎖するとスコアとFEVERが上がります。',
    howToPc: 'PC: ←→移動（素早く2回で端まで） / ↓1マス落下 / Space右回転 / ↑一気に落下 / P一時停止',
    howToTouch:
      'スマホ: 盤面を横になぞって移動（素早くはらうと端まで） / 下になぞって落下（素早くはらうと一気に） / タップで右回転',
    next: 'Next',
    pause: '一時停止',
    pauseTitle: '一時停止 / 再開',
    boardLabel: 'ゲーム盤面',
    touchLabel: 'タッチ操作',
    soundTitle: '音の設定',
    soundHint: '押すたびに切り替わります',
    langLabel: '言語 / Language',
    help: '説明',
    rainbowUse: '使う？',
    rainbowName: '虹ボム',
    clearedTotal: '消したメ',
    helpTitle: 'あそびかた',
    helpClose: '戻る',
  },
  en: {
    title: 'SAINOME SEVEN',
    tagline: 'Match neighbouring dice to 7 and clear them',
    start: 'SCORE\nMODE',
    resume: 'RESUME',
    restart: 'RESTART',
    playAgain: 'PLAY AGAIN',
    backToTitle: 'BACK TO TITLE',
    paused: 'PAUSED',
    gameOver: 'GAME OVER',
    thisScore: 'YOUR SCORE',
    best: 'Best',
    noRecords: 'No records yet',
    bestTitle: 'Your best scores',
    howTo: 'How to play',
    howToRule:
      'Clear dice by making neighbouring faces add up to 7. Chains raise your score and the FEVER gauge.',
    howToPc:
      'PC: ←→ move (tap twice for the wall) / ↓ soft drop / Space rotate / ↑ hard drop / P pause',
    howToTouch:
      'Phone: swipe across the board to move (flick for the wall) / swipe down to drop (flick for a hard drop) / tap to rotate',
    next: 'Next',
    pause: 'Pause',
    pauseTitle: 'Pause / Resume',
    boardLabel: 'Game board',
    touchLabel: 'Touch controls',
    soundTitle: 'Sound',
    soundHint: 'tap to cycle',
    langLabel: '言語 / Language',
    help: 'HOW TO',
    rainbowUse: 'Use it?',
    rainbowName: 'Rainbow Bomb',
    clearedTotal: 'Dice cleared',
    helpTitle: 'How to play',
    helpClose: 'Back',
  },
} as const;

const SOUND_LABELS: Record<Lang, Record<SoundMode, string>> = {
  ja: { all: 'BGMと効果音', se: '効果音のみ', none: '消音' },
  en: { all: 'Music and effects', se: 'Effects only', none: 'Muted' },
};

// 手が空いているときに順番に出るセリフ
// サイカのセリフ。場面ごとに1つの表情がひも付いている。
// 文字数は全角14字以内。セリフ枠は幅およそ290pxで、18pxの文字だと
// それ以上は折り返して枠の高さが変わってしまう。
//
// 書き換えるときは docs/saika-lines.tsv を直してから、こちらへ移す。

// 【01 元気・歓迎】ゲーム開始とタイトル復帰の第一声だけ
const SAIKA_HELLO_LINES: Record<Lang, readonly string[]> = {
  ja: ['やっほー♪ わたしサイカ🎲', 'さあ はじめよっか！', 'きょうも ころがすよ～', 'サイノメ・セヴン！'],
  en: ["Yoo-hoo! I'm Saika 🎲", "Let's get rolling!", 'Dice time again~', 'Sainome Seven!'],
};

// 【04 おだやか】待機の基本。いちばん出番が多い
const SAIKA_IDLE_LINES: Record<Lang, readonly string[]> = {
  ja: [
    'となりどうしで7にするんだよ',
    'あせらず いこ～',
    'ゆっくりで いいからね',
    'つぎ なにが来るかな',
    'ふむふむ なるほど',
  ],
  en: [
    'Make 7 with neighbours!',
    'No rush, no rush~',
    'Take your time, okay?',
    "What's coming next?",
    'Hmm, I see, I see',
  ],
};

// 【05 にこにこ】機嫌がいいとき。セヴン消しが決まった直後
const SAIKA_SMILE_LINES: Record<Lang, readonly string[]> = {
  ja: ['いい感じ いい感じ♪', 'うんうん じょうず～', 'その調子 その調子', 'ふふ～ん♪'],
  en: ['Nice, very nice~♪', 'Mhm, you got it~', "That's the way!", 'La la la~♪'],
};

// 【06 大笑い】2〜3連鎖。{n} は連鎖数
const SAIKA_CHAIN_LINES: Record<Lang, readonly string[]> = {
  ja: ['{n}チェイン！ すごっ', 'わはは 止まらない！', '{n}チェイン きたー！'],
  en: ['{n} chain! Whoa!', 'Haha, unstoppable!', '{n} chain, yesss!'],
};

// 【07 気合】4連鎖以上。踏ん張りどころ
const SAIKA_BIG_CHAIN_LINES: Record<Lang, readonly string[]> = {
  ja: ['{n}チェイン いけー！', 'ここ ふんばって！', 'まだまだ いけるよ！', '勝負どころ だよ'],
  en: ['{n} chain, go go!', 'Hold it together!', "You've still got this!", 'This is the moment'],
};

// 【08 おどろき】ニコニコメが出た
const SAIKA_SURPRISE_LINES: Record<Lang, readonly string[]> = {
  ja: ['ニコニコメ まだかなぁ', 'えっ いまのなに？', 'えっ そこに置いちゃう！？'],
  en: ['Ah, a Niko die!', 'Huh? What was that?', "Huh, you're placing it there?!"],
};

// 【09 ほっと安心】危険領域を脱した
const SAIKA_RELIEF_LINES: Record<Lang, readonly string[]> = {
  ja: ['ふぅ～ 助かった～', 'あぶなかった～', 'よかった もどれた'],
  en: ['Phew~ that was close', 'That was scary~', 'Good, we made it back'],
};

// 【02 あせり】危険領域に届いた瞬間
const SAIKA_WORRY_LINES: Record<Lang, readonly string[]> = {
  ja: ['やばっ 積みすぎだよ！', 'ちょっと 危ないかも', 'うわわ せまい せまい', 'ニコニコメ 来てよぉ'],
  en: ['Eek, too high!', 'This looks risky...', 'Whoa, so tight in here!', 'Come on, Niko die~'],
};

const SAIKA_WORRY_MS = 2600; // 焦りの顔を出しておく時間
const SAIKA_BEAT_MS = 1200; // 単発のひとことを出しておく時間

// 【03 どや】技のあとのほめ言葉
const SAIKA_PRAISE_LINES: Record<Lang, readonly string[]> = {
  ja: ['どーだ！', '決まったぁ～', 'ふっ 計算どおり', 'ナイス～♪'],
  en: ['How about that!', 'Nailed it~', 'Heh, just as planned', 'Nice one~♪'],
};

// 【11 フィーバー大笑い】フィーバー中のほめ言葉
const SAIKA_FEVER_PRAISE_LINES: Record<Lang, readonly string[]> = {
  ja: ['あははっ 決まった！', 'もう 最高～！！', 'やったやった～！'],
  en: ['Ahaha, got it!', 'This is the best!!', 'We did it, we did it!'],
};

// 【10 / 14 フィーバー】フィーバー中の待機
const SAIKA_FEVER_IDLE_LINES: Record<Lang, readonly string[]> = {
  ja: ['フィ～バ～！', 'いまがチャンス♪', 'ぜんぶ光ってる～', 'どんどん行こ～！', 'ノッてきた～！'],
  en: ['Feeeveeer!', 'Now is your chance♪', "Everything's glowing~", 'Keep it coming~!', "I'm fired up~!"],
};

// 【14 フィーバーおだやか】フィーバー中の単発クリア。
// 通常の SAIKA_SMILE_LINES は落ち着きすぎていて、フィーバーの熱が下がる。
const SAIKA_FEVER_SMILE_LINES: Record<Lang, readonly string[]> = {
  ja: ['いいよ いいよ～！', 'その調子～！', 'もっと もっと～！', '熱いね～！'],
  en: ['Yes, yes~!', 'Just like that~!', 'More, more~!', "You're on fire~!"],
};

// 虹ボムまわりの文言。
const rainbowAwardLine = (lang: Lang, count: number) =>
  lang === 'ja' ? '虹ボムをGET！' : `Rainbow Bomb x${count}!`;

// ゲームオーバー直前の「使う？」。焦り顔（02）を優先する場面
const SAIKA_RAINBOW_ASK_LINES: Record<Lang, readonly string[]> = {
  ja: ['虹ボム 使う！？', 'まだ終わらせない！', 'いま 使って！'],
  en: ['Use the Rainbow?!', "It's not over yet!", 'Use it, now!'],
};

// 虹ボムで助かった直後
const SAIKA_RAINBOW_SAVE_LINES: Record<Lang, readonly string[]> = {
  ja: ['助かった～！', 'まだ いける！', '生きかえった～！'],
  en: ['Saved us~!', 'Still in this!', 'Back from the dead~!'],
};

// 【13 フィーバー絶頂】フィーバー中の連鎖
const SAIKA_FEVER_CHAIN_LINES: Record<Lang, readonly string[]> = {
  ja: ['{n}チェイン！！ やば', 'とまらない～っ！！', 'さいこう～！！！'],
  en: ['{n} chain!! Insane', "Can't stooop!!", 'Amaaazing!!!'],
};

// 待機のセリフ。フィーバー中は虹色側の待機セリフへ差し替える。
// ストーリー序盤で多めに出す、「合計7」を強調するひとこと
const SAIKA_STORY_LINES: Record<Lang, string[]> = {
  ja: ['となりと足して7にしよう！', '[1]と[6]で7！\n[2]と[5]や[3]と[4]でも7だよっ', '7になるサイどうしは同じ色だよ！'],
  en: ['Put two dice side by side that add up to 7!', '[1][6], [2][5], [3][4]. Always make 7!', 'Aim for 7! Exactly 7 clears them!'],
};
// ストーリー中かどうか。セリフの出し分けに使う（描画とは関係ないのでモジュールで持つ）
let storyLinesOn = false;

// ストーリーのセリフは、スコアモードのセリフと切り離す（2026-10-01）。
// スコアモードの待機・危険・安心のセリフは、メンの段取りのセリフとつながらず意味が通らないことがあるため、
// ストーリー中は出さない。待機はストーリー用（フィーバー中だけフィーバーの待機）にする
// いまのメンの待機セリフ。startStage で storyIdleLinesFor から差し替える
let storyIdlePool: Record<Lang, string[]> = SAIKA_STORY_LINES;
const idleLines = (lang: Lang, fever: boolean) =>
  fever ? SAIKA_FEVER_IDLE_LINES[lang] : storyLinesOn ? storyIdlePool[lang] : SAIKA_IDLE_LINES[lang];

// 連鎖のセリフ。連鎖数と、フィーバー中かどうかで出し分ける。
const WALL_FIRST_IDLE_LINES: Record<Lang, string[]> = {
  ja: ['となり合うメを足して「7」にして！', '[1]と[6]で7！\n[2]と[5]や[3]と[4]でも7だよっ', 'となり合うメを7にして\nどんどん消そっ！'],
  en: SAIKA_STORY_LINES.en,
};
const WALL_FIRST_CHAIN_LINES: Record<Lang, readonly string[]> = {
  ja: ['{n}チェイン！\n いいね いいねっ！', ...SAIKA_CHAIN_LINES.ja.slice(1)],
  en: SAIKA_CHAIN_LINES.en,
};
const chainLine = (lang: Lang, chain: number, fever: boolean, stage?: number | null) => {
  const pool = fever
    ? SAIKA_FEVER_CHAIN_LINES[lang]
    : chain >= BIG_CHAIN_MIN
      ? SAIKA_BIG_CHAIN_LINES[lang]
      : (stage === 20 ? WALL_FIRST_CHAIN_LINES : SAIKA_CHAIN_LINES)[lang];
  return pickFrom(pool).replace('{n}', String(chain));
};

// 連鎖の見せ方が変わる境目。これ以上は気合の顔になる
const BIG_CHAIN_MIN = 4;

// 技名。フィーバー中は言い回しを一段おおげさにして、顔も 12 に切り替わる。
const BOMB_CALLS: Record<
  string,
  { banner: string; saika: Record<Lang, string>; fever: Record<Lang, string> }
> = {
  spa1: {
    banner: 'SUPER 1',
    saika: { ja: 'スパ1！', en: 'Super One!' },
    fever: { ja: 'スパ1っ！ どーん', en: 'Super One! Boom!' },
  },
  // ニコニコボムはバナーを出さない。溜めの演出そのものが見せ場なので、
  // 文字を重ねると画面が散らかる。サイカのセリフだけで伝える。
  nico: {
    banner: '',
    saika: { ja: 'ニコニコ・フラーッシュ！', en: 'Niko Niko Flaaash!' },
    fever: { ja: 'ニコニコ・フラーッシュ！', en: 'Niko Niko Flaaash!' },
  },
  sla3: {
    banner: 'SLASH 3',
    saika: { ja: 'スラ3！', en: 'Slash Three!' },
    fever: { ja: 'スラ3っ！ ざしゅっ', en: 'Slash Three! Zash!' },
  },
  squ4: {
    banner: 'SQUARE 4',
    saika: { ja: 'スク4！', en: 'Square Four!' },
    fever: { ja: 'スク4っ！ がしっ', en: 'Square Four! Grab!' },
  },
  str6: {
    banner: 'STRAIGHT 6',
    saika: { ja: 'スト6！', en: 'Straight Six!' },
    // 2026-10-05 ユーザー指定：スト6っ！ ずどん → イッキツーカン！（改行）スト6でーっす！
    fever: { ja: 'イッキツーカン！\nスト6でーっす！', en: 'Straight through!\nStraight Six!' },
  },
  you456: {
    banner: '',
    saika: { ja: '456You!', en: '456You!' },
    fever: { ja: '456You!', en: '456You!' },
  },
};

// スコアは下7桁を 0000000 で常に表示し、その上の位だけを SCORE の右に黄色で出す。
// 上の位は9で頭打ちなので、表示できる最大は 99,999,999。
const SCORE_DIGITS = 7;
const SCORE_LOWER_MAX = 10 ** SCORE_DIGITS; // 10,000,000
const SCORE_DISPLAY_MAX = SCORE_LOWER_MAX * 10 - 1; // 99,999,999

const splitScore = (score: number) => {
  const capped = Math.min(Math.max(0, Math.floor(score)), SCORE_DISPLAY_MAX);
  return { millions: Math.floor(capped / SCORE_LOWER_MAX), lower: capped % SCORE_LOWER_MAX };
};
const SAIKA_PRAISE_MS = 1000; // ボム後のひとことを出しておく時間
const BOMB_BANNER_DELAY_MS = 500; // 技名バナーを出すまでの間
const SAIKA_IDLE_ROTATE_MS = 7000; // 手が空いているときにセリフを入れ替える間隔

type SaikaMood =
  | 'idle' // 待機
  | 'hello' // 開幕の第一声
  | 'smile' // 機嫌がいい（セヴン消し成功）
  | 'chain' // 2〜3連鎖
  | 'bigChain' // 4連鎖以上
  | 'surprise' // ニコニコメが出た
  | 'relief' // 危険領域を脱した
  | 'worry' // 危険領域に入った
  | 'bomb' // 技が決まった
  | 'praise'; // 技のあとのほめ言葉

// 音は3段階を順に回す。BGMと効果音 → 効果音のみ → 消音。
type SoundMode = 'all' | 'se' | 'none';

const SOUND_ORDER: SoundMode[] = ['all', 'se', 'none'];
// 音符の数で段階を出す。🎵 はもともと「音符1つ」の絵文字なので、
// BGM+SE は 🎶（2つ）、SEだけは 🎵（1つ）と数がそのまま鳴っている量になる。
// ♪ は絵文字ではなく文字記号で、絵文字と並ぶと線が細く小さく浮いてしまう。
// スピーカーの 🔊 / 🔉 は 18px では波の本数の差が潰れて見分けられない。
const SOUND_ICONS: Record<SoundMode, string> = { all: '🎶', se: '🎵', none: '🔇' };
const pickFrom = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

type ClearKind = 'seven' | 'nico' | 'thunder' | 'you456' | BombKind;

// 得点計算。企画書の倍率を素直に掛け合わせる。
// 上限や計算順序はバランス調整時に決めるとされているため、現状は単純な積。
const scoreFor = (options: {
  kind: ClearKind;
  cells: number;
  bombs: Array<{ level: number; multiplier: number }>;
  chain: number;
  danger: boolean;
  fever: boolean;
}): number => {
  let base: number;
  if (options.kind === 'seven') {
    base = options.cells * 100 * options.chain;
  } else {
    // 2チェイン以降はレベル倍率が1,000点から2,000点へ上がる
    const perLevel = options.chain >= 2 ? 2000 : 1000;
    // 技ごとの倍率（1が7連結で2倍、X字・十字で3倍）はその技のぶんにだけ掛ける
    base = options.bombs.reduce((sum, hit) => sum + hit.level * perLevel * hit.multiplier, 0);
  }

  let multiplier = 1;
  if (options.cells >= BIG_CLEAR_MIN) {
    multiplier *= BIG_CLEAR_MULTIPLIER;
  }
  if (options.danger) {
    multiplier *= DANGER_SCORE_MULTIPLIER;
  }
  if (options.fever) {
    multiplier *= FEVER_SCORE_MULTIPLIER;
  }

  return Math.round(base * multiplier);
};

// 消去に巻き込まれたブロックは結合が壊れ、残ったメは1マスずつ独立して落ちる。
// 一意な負のIDを振ることで、隣り合っていても別々の塊として扱われる。
let dissolveCounter = 0;

const dissolveGroups = (board: Board, affected: Set<number>): Board =>
  board.map((row) =>
    row.map((cell) => {
      if (!cell || !affected.has(cell.group)) {
        return cell;
      }
      dissolveCounter += 1;
      return { ...cell, group: -dissolveCounter };
    }),
  );

// 敵がサイを食べたり別の敵に変えたりして、ブロックの一部だけが消えたら、残りはばらして落とせるようにする
// （ブロックは切り離さない仕様のままだと、支えを失った残りが宙に浮いて残ってしまう）
const dissolveShrunkGroups = (before: Board, after: Board): Board => {
  const count = (board: Board) => {
    const counts = new Map<number, number>();
    board.forEach((row) => row.forEach((cell) => {
      if (cell && cell.value >= 0) counts.set(cell.group, (counts.get(cell.group) ?? 0) + 1);
    }));
    return counts;
  };
  const was = count(before);
  const now = count(after);
  const affected = new Set<number>();
  now.forEach((n, group) => { if (n < (was.get(group) ?? 0)) affected.add(group); });
  return affected.size > 0 ? dissolveGroups(after, affected) : after;
};

const pipPositions: Record<number, string[]> = {
  1: ['center'],
  2: ['top-left', 'bottom-right'],
  3: ['top-left', 'center', 'bottom-right'],
  4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
  6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right'],
};

// 説明画面の中身。見出しと本文だけの素直な構造にしておき、
// 描画側は kind を見て出し分ける。節を足すのはここだけで済む。
// 'pairs' は「合計7になる相手は必ず同じ色」を絵で見せる専用の節。
type HelpBlock =
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'pairs' };

type HelpSection = { heading: string; blocks: HelpBlock[] };

const HELP: Record<Lang, HelpSection[]> = {
  ja: [
    {
      heading: 'あそびかた',
      blocks: [
        { kind: 'p', text: 'となり合ったサイノメの目が、たして 7 になると消えます。' },
        { kind: 'pairs' },
        { kind: 'p', text: '相手はいつも同じ色です。色を見れば、消せる組み合わせがすぐ分かります。' },
      ],
    },
    {
      heading: 'うごかす',
      blocks: [
        {
          kind: 'ul',
          items: [
            '盤面を横になぞると移動。素早くはらうと端まで',
            '下になぞると落下。素早くはらうと一気に',
            'タップで右まわりに回転',
          ],
        },
        {
          kind: 'p',
          text: 'パソコンなら ←→ で移動、↓ で1マス落下、Space で回転、↑ で一気に落下、P で一時停止です。',
        },
      ],
    },
    {
      heading: 'つなげる',
      blocks: [
        {
          kind: 'p',
          text: '続けて消すと連鎖になり、スコアと FEVER ゲージが伸びます。ゲージが満ちるとフィーバーに入り、消える範囲が広がります。',
        },
      ],
    },
    {
      heading: 'ひっさつメ',
      blocks: [
        { kind: 'p', text: '同じ目をたくさんつなげると、7 にしなくても消える大技が出ます。' },
        {
          kind: 'ul',
          items: [
            'スパ1 — 1 を5つ以上。7つ以上ならスコア2倍',
            'スラ3 — 3 を斜めに3つ以上。ななめ一直線を貫きます',
            'スク4 — 4 を四角く4つ',
            'スト6 — 6 を一直線に4つ以上。その列と行を貫きます',
          ],
        },
        { kind: 'p', text: 'スラ3 が X の形に、スト6 が十字に揃うとスコア3倍です。' },
      ],
    },
    {
      heading: 'ニコニコメ',
      blocks: [
        { kind: 'p', text: 'ときどき落ちてくる黒いサイノメ。2 と 5 の顔が交互に光ります。' },
        { kind: 'p', text: '2つくっつけると大きく消えます。それ以外では決して消えません。' },
      ],
    },
    {
      heading: 'おわり',
      blocks: [
        {
          kind: 'p',
          text: 'いちばん上までサイノメが積み上がると終わりです。上から7段目より上に届くとサイカが焦りはじめるので、そこが引き際の目安です。',
        },
      ],
    },
  ],
  en: [
    {
      heading: 'The rule',
      blocks: [
        { kind: 'p', text: 'Neighbouring dice clear when their faces add up to 7.' },
        { kind: 'pairs' },
        {
          kind: 'p',
          text: 'A face and its partner always share a colour, so the colour alone tells you what can be cleared.',
        },
      ],
    },
    {
      heading: 'Controls',
      blocks: [
        {
          kind: 'ul',
          items: [
            'Swipe across the board to move. Flick to reach the wall',
            'Swipe down to drop. Flick for a hard drop',
            'Tap to rotate clockwise',
          ],
        },
        {
          kind: 'p',
          text: 'On a computer: arrow keys to move and soft drop, Space to rotate, up arrow to hard drop, P to pause.',
        },
      ],
    },
    {
      heading: 'Chains',
      blocks: [
        {
          kind: 'p',
          text: 'Clearing again straight away builds a chain, raising your score and the FEVER gauge. A full gauge starts a fever, which widens every clear.',
        },
      ],
    },
    {
      heading: 'Special moves',
      blocks: [
        {
          kind: 'p',
          text: 'Connect enough of the same face and it clears without needing to make 7.',
        },
        {
          kind: 'ul',
          items: [
            'SUPER 1 — five or more 1s. Seven or more doubles the score',
            'SLASH 3 — three or more 3s on a diagonal. It cuts along that diagonal',
            'SQUARE 4 — four 4s in a square',
            'STRAIGHT 6 — four or more 6s in a line. It cuts along that row and column',
          ],
        },
        { kind: 'p', text: 'A SLASH 3 in an X, or a STRAIGHT 6 in a cross, triples the score.' },
      ],
    },
    {
      heading: 'Nico dice',
      blocks: [
        {
          kind: 'p',
          text: 'The black die that turns up now and then. Its 2 and 5 faces blink in turn.',
        },
        { kind: 'p', text: 'Join two of them for a huge clear. Nothing else can ever remove them.' },
      ],
    },
    {
      heading: 'Game over',
      blocks: [
        {
          kind: 'p',
          text: 'The game ends when the dice reach the top row. Saika starts to panic once they pass the seventh row from the top, so treat that as your warning.',
        },
      ],
    },
  ],
};

const BEST_SCORES_KEY = 'seven-dice-best-scores';
// 一時停止のあいだは、待ち時間が明けても先へ進ませない。
// ステージ開始のサイカの語りや消去の段取りは delay で刻んでいるので、ここで止めれば全部止まる。
// 再開したら、止めていた続きをまとめて進める。遊び直し・タイトルへ戻るときは捨てる。
let gamePaused = false;
let pauseWaiters: Array<() => void> = [];
let delayGeneration = 0;
const delay = (ms: number) => {
  const generation = delayGeneration;
  return new Promise<void>((resolve) => {
    window.setTimeout(() => {
      // A restarted mission must not resume an old, not-yet-fired timer.
      if (generation !== delayGeneration) return;
      if (gamePaused) pauseWaiters.push(resolve);
      else resolve();
    }, ms);
  });
};
const setGamePaused = (paused: boolean) => {
  gamePaused = paused;
  if (paused) { hidoimeCrushSound.stop(); stopDetarameDamageSounds(); stopAnchiThunderSounds(); }
  if (!paused) {
    const waiting = pauseWaiters;
    pauseWaiters = [];
    waiting.forEach((resolve) => resolve());
  }
};
const dropPauseWaiters = () => {
  hidoimeCrushSound.stop(); stopDetarameDamageSounds();
  delayGeneration += 1;
  gamePaused = false;
  pauseWaiters = [];
};

// 消失音「ピュン！」
// 高音から一気に落ちる短いスイープ。矩形寄りの三角波に軽いノイズ感を足して抜けを良くする。
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) {
    return null;
  }
  // iPhone はマナーモードのとき、Web Audio を「環境音」扱いにして消してしまう。
  // 起動のサイコロは BGM（audio 要素）が鳴る前なので聞こえなかった。再生扱いにして鳴らす
  try {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session && session.type !== 'playback') session.type = 'playback';
  } catch {
    // 対応していない端末では何もしない
  }
  if (!audioContext) {
    // 既定のままだと出力バッファが大きめに取られ、
    // 見た目より音が一拍遅れて聞こえる。操作音優先で最短に寄せる。
    audioContext = new Ctor({ latencyHint: 'interactive' });
  }
  if (audioContext.state === 'suspended' || (audioContext.state as string) === 'interrupted') {
    void audioContext.resume().catch(() => undefined);
  }
  return audioContext;
};

// 効果音は8系統で多重再生。敵の行動・命中・撃破・デタラメの実ダメージを別々に混ぜる。
const SFX_OUTPUT_GAIN = 1.35; // 0.9 の 1.5倍
// 回転音の大きさ。操作の反応がはっきり聞こえる音量にする。
// リミッターを通さないので、ここがそのまま出口の大きさになる
const ROTATE_SOUND_GAIN = 1.1; // 0.44 → 2倍の0.88 → 2026-10-15に25%上げて1.1

// 0.8 までは直線、その先は tanh で寝かせて 0.98 に漸近させる。
// 小さい音と中くらいの音はきっちり1.5倍になり、大きい音だけが丸まる。
const SFX_CEILING_CURVE = (() => {
  const size = 2049;
  const curve = new Float32Array(size);
  const knee = 0.8;
  const room = 0.18;
  for (let i = 0; i < size; i += 1) {
    const x = (i / (size - 1)) * 2 - 1;
    const ax = Math.abs(x);
    const y = ax <= knee ? ax : knee + room * Math.tanh((ax - knee) / room);
    curve[i] = Math.sign(x) * y;
  }
  return curve;
})();

// 遅れた効果音は鳴らさない。
// 処理が詰まると、効果音を鳴らす処理そのものが予定より遅れて走る。
// 絵のほうは先に動いている（CSS のアニメーションは処理が詰まっても進む）ので、
// 遅れて鳴った音は「ワンテンポずれた音」に聞こえる。ずれた音を鳴らすくらいなら
// 鳴らさないほうが気持ちよいので、予定から SFX_LATE_LIMIT_MS 以上遅れた音は捨てる。
// 120ms は、耳と目が「同じ出来事」とみなせるずれの上限の目安。
const SFX_LATE_LIMIT_MS = 120;
let sfxDropped = 0; // 捨てた数。確認用

const sfxOnTime = (lateMs: number) => {
  if (lateMs > SFX_LATE_LIMIT_MS) {
    sfxDropped += 1;
    return false;
  }
  return true;
};

// ミックス用の8系統。各音は毎回独立したsourceを作り、同じ音の連打も上書きしない。
type SfxChannel = 'operation' | 'effect' | 'enemy' | 'enemyHit' | 'enemyDefeat' | 'detarame' | 'impact' | 'thunder';
let sfxBuses: Record<SfxChannel, GainNode> | null = null;
let sfxBusCtx: AudioContext | null = null;
let effectMix: GainNode | null = null;
let enemyFocusUntil = 0;

const getSfxBus = (channel: SfxChannel = 'effect'): GainNode | null => {
  const ctx = getAudioContext();
  if (!ctx) return null;
  if (sfxBuses && sfxBusCtx === ctx) return sfxBuses[channel];

  // 全系統を混ぜた最後に音割れを抑える。共通コンプレッサーは置かない。
  const ceiling = ctx.createWaveShaper();
  ceiling.curve = SFX_CEILING_CURVE;
  ceiling.oversample = '2x';
  ceiling.connect(ctx.destination);

  const operation = ctx.createGain();
  // 操作音は従来どおり等倍・先読みなし。回転の反応速度と音量を維持する。
  operation.connect(ceiling);

  const compressedChannel = () => {
    const input = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;
    const output = ctx.createGain();
    output.gain.value = SFX_OUTPUT_GAIN;
    input.connect(limiter);
    limiter.connect(output);
    return { input, output };
  };
  const effect = compressedChannel();
  const enemy = compressedChannel();
  const enemyHit = compressedChannel();
  const enemyDefeat = compressedChannel();
  const detarame = compressedChannel();
  effectMix = ctx.createGain();
  effect.output.connect(effectMix);
  effectMix.connect(ceiling);
  enemy.output.connect(ceiling);
  enemyHit.output.connect(ceiling);
  enemyDefeat.output.connect(ceiling);
  detarame.output.connect(ceiling);

  // 白フラッシュの破裂音は独立。コンプレッサーの先読み・音量抑制を避ける。
  const impact = ctx.createGain();
  impact.gain.value = 0.9;
  impact.connect(ceiling);
  // イチニノサンダー専用（2026-10-07）。なぞる音・カウント・雷鳴を、ほかの効果音の圧縮や
  // 敵の命中で下がる処理（focusEnemySound）に巻き込まれない独立した系統で鳴らす
  const thunder = ctx.createGain();
  thunder.gain.value = 1;
  thunder.connect(ceiling);
  sfxBuses = { operation, effect: effect.input, enemy: enemy.input,
    enemyHit: enemyHit.input, enemyDefeat: enemyDefeat.input, detarame: detarame.input, impact, thunder };
  sfxBusCtx = ctx;
  enemyFocusUntil = 0;
  return sfxBuses[channel];
};

// 命中音の短い間だけ演出音を少し下げ、スマホでも打撃の輪郭を聞き取りやすくする。
// 連続命中では復帰時刻を延ばす。BGM・操作音・敵の音量は変えない。
const focusEnemySound = (ctx: AudioContext, seconds: number, level = 0.55) => {
  if (!effectMix || sfxBusCtx !== ctx) return;
  const now = ctx.currentTime;
  enemyFocusUntil = Math.max(enemyFocusUntil, now + seconds);
  effectMix.gain.cancelScheduledValues(now);
  effectMix.gain.setTargetAtTime(level, now, 0.008);
  effectMix.gain.setTargetAtTime(1, enemyFocusUntil, 0.06);
};

// 短いノイズ。アタックの輪郭づけに使う
const makeNoise = (ctx: AudioContext, seconds: number, curve = 2): AudioBufferSourceNode => {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** curve;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  return source;
};

// フィーバー中のセヴン目音に掛ける、浅いリバーブの残響。
// 減衰するノイズを左右別々に作ってたたみ込むだけの簡易な部屋鳴り。
// 作るのは重いので、AudioContext ごとに1つだけ作って使い回す。
let feverReverbIr: AudioBuffer | null = null;
let feverReverbCtx: BaseAudioContext | null = null;

const getFeverReverbIr = (ctx: BaseAudioContext): AudioBuffer => {
  if (feverReverbIr && feverReverbCtx === ctx) {
    return feverReverbIr;
  }
  const seconds = 1.6;
  const length = Math.floor(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = ir.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const t = i / length;
      // 頭の数msは空けて（プリディレイ）、なだらかに消える
      const pre = i < ctx.sampleRate * 0.012 ? 0 : 1;
      data[i] = (Math.random() * 2 - 1) * pre * (1 - t) ** 3.2;
    }
  }
  feverReverbIr = ir;
  feverReverbCtx = ctx;
  return ir;
};

// フィーバー中の余韻づけ。乾いた音はそのまま出しつつ、
// ・コーラス … わずかに揺れる遅延を2本重ねて、音に厚みと揺らぎを足す
// ・リバーブ … 浅く残響を足して、弾けたあとの余韻を長く引く
// どちらも「浅く」が狙い。深くすると輪郭がぼやけて、連鎖の粒が聞き分けられない。
// 戻り値は後片付け用。鳴り終わったころに呼ぶ。
const buildFeverSparkle = (ctx: BaseAudioContext, input: AudioNode, output: AudioNode) => {
  const nodes: AudioNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];

  // コーラス。18ms と 25ms の遅延を、それぞれ別の速さでゆっくり揺らす
  const chorusOut = ctx.createGain();
  chorusOut.gain.value = 0.34;
  chorusOut.connect(output);
  nodes.push(chorusOut);
  [
    { base: 0.018, depth: 0.0022, rate: 0.9 },
    { base: 0.025, depth: 0.0028, rate: 1.3 },
  ].forEach(({ base, depth, rate }) => {
    const delay = ctx.createDelay(0.05);
    delay.delayTime.value = base;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rate;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = depth;
    lfo.connect(lfoDepth);
    lfoDepth.connect(delay.delayTime);
    input.connect(delay);
    delay.connect(chorusOut);
    lfo.start();
    nodes.push(delay, lfoDepth);
    sources.push(lfo);
  });

  // リバーブ。こもらせないよう、たたみ込む前に低音を少し削る
  const reverbIn = ctx.createBiquadFilter();
  reverbIn.type = 'highpass';
  reverbIn.frequency.value = 320;
  const reverb = ctx.createConvolver();
  reverb.buffer = getFeverReverbIr(ctx);
  const reverbOut = ctx.createGain();
  reverbOut.gain.value = 0.26;
  input.connect(reverbIn);
  reverbIn.connect(reverb);
  reverb.connect(reverbOut);
  reverbOut.connect(output);
  nodes.push(reverbIn, reverb, reverbOut);

  return () => {
    sources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // すでに止まっている
      }
      source.disconnect();
    });
    nodes.forEach((node) => node.disconnect());
  };
};

// フィーバーに入るときの「テューン！」。ゾーンに入った感じを出す。
// 前半は、共鳴を強めたフィルターを開きながら音程を駆け上がる「テュー」。
// 点火の粒が広がっているあいだ（riseSec）ずっと昇りつづけ、
// フィーバーが始まるその瞬間に、明るい和音と低い胴鳴りの「ン！」で着地する。
// 着地のあとはセヴン目音と同じコーラスとリバーブで、ふわっと長く残す。
const playFeverZoneSound = (riseSec: number) => {
  const ctx = getAudioContext();
  const bus = getSfxBus();
  if (!ctx || !bus) {
    return;
  }
  const now = ctx.currentTime;
  const hit = now + riseSec;

  const master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(bus);

  // --- テュー（駆け上がり）---
  // わずかにずらした鋸波2本を重ね、共鳴の強いローパスを開いていく。
  // 共鳴が音程と一緒に上がるので「テュー」という母音のように聞こえる。
  const riseFilter = ctx.createBiquadFilter();
  riseFilter.type = 'lowpass';
  riseFilter.Q.value = 7;
  riseFilter.frequency.setValueAtTime(500, now);
  riseFilter.frequency.exponentialRampToValueAtTime(4200, hit);
  const riseGain = ctx.createGain();
  riseGain.gain.setValueAtTime(0.0001, now);
  riseGain.gain.exponentialRampToValueAtTime(0.16, now + riseSec * 0.7);
  riseGain.gain.exponentialRampToValueAtTime(0.22, hit - 0.01);
  riseGain.gain.exponentialRampToValueAtTime(0.0001, hit + 0.05);
  riseFilter.connect(riseGain);
  riseGain.connect(master);
  [-7, 7].forEach((cents) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.detune.value = cents;
    osc.frequency.setValueAtTime(196, now);
    osc.frequency.exponentialRampToValueAtTime(784, hit);
    osc.connect(riseFilter);
    osc.start(now);
    osc.stop(hit + 0.08);
  });

  // --- ン！（着地）---
  // ハ長調に9度を足した明るい和音。正弦波なので刺さらず、響きだけが広がる
  const chordBus = ctx.createGain();
  chordBus.gain.value = 1;
  const releaseSparkle = buildFeverSparkle(ctx, chordBus, master);
  chordBus.connect(master);
  [1047, 1319, 1568, 2349].forEach((freq, index) => {
    const osc = ctx.createOscillator();
    osc.type = index === 0 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, hit);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, hit);
    gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.3 : 0.16, hit + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, hit + 0.9);
    osc.connect(gain);
    gain.connect(chordBus);
    osc.start(hit);
    osc.stop(hit + 0.95);
  });

  // 胴鳴り。短く沈む低音で、着地に重さを足す
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(130, hit);
  sub.frequency.exponentialRampToValueAtTime(58, hit + 0.22);
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.0001, hit);
  subGain.gain.exponentialRampToValueAtTime(0.5, hit + 0.008);
  subGain.gain.exponentialRampToValueAtTime(0.0001, hit + 0.26);
  sub.connect(subGain);
  subGain.connect(master);
  sub.start(hit);
  sub.stop(hit + 0.3);

  // 残響のしっぽまで鳴り終えたら外す
  window.setTimeout(
    () => {
      releaseSparkle();
      chordBus.disconnect();
      master.disconnect();
    },
    (riseSec + 2.6) * 1000,
  );
};

// セヴン目音の鳴り始めの遅らせ。着地の先回りや消去のタメより先に鳴らしているぶん、
// 絵に対して少し早すぎたので、80ms だけ後ろへずらして間合いを合わせる。
const SEVEN_SOUND_DELAY_MS = 120; // 80ms → さらに40ms遅らせた

// 着地の音（設置音か、揃う手ならセヴン目音のどちらか）を、着地の絵から
// どれだけ後に鳴らすか。どちらの音でも同じ瞬間に鳴るようにそろえてある。
// 以前は設置音が着地より約100ms先に鳴っていて、早すぎた。
const TOUCHDOWN_SOUND_AFTER_MS = 20;
// 設置音だけは、そこからさらに 40ms 早める（着地の絵のおよそ20ms前に鳴る）。
// セヴン目音はそのまま。着地したあと横へずらせる区間は変えていない。
// 40ms → 80ms → 120ms → さらに80ms早めて200ms（着地の絵のおよそ180ms前）。
// 自然落下では LOCK_SOUND_LEAD_MS の予約でここまで先回りできる。
// 指で着地させた場合は操作が合図なので、その瞬間より前には鳴らせない。
const LOCK_SOUND_EARLIER_MS = 200;

// 一度に消えた数で、セヴン目音を華やかにしていく。
// 2〜3個は短い「ポリュン」のまま。4個からは上へ駆け上がる粒を足し、
// 最後の音を長く伸ばす。数が多いほど粒が増えて、余韻も長くなる。
//   4〜5個 … ティラリラーン      （4粒・最後の音 0.55秒）
//   6〜9個 … ティラリラリラーン  （6粒・0.9秒）
//   10個〜 … ティラララララーン  （8粒・1.4秒）
const CLEAR_FANFARE: ReadonlyArray<{ min: number; notes: number; ring: number }> = [
  { min: 10, notes: 8, ring: 1.4 },
  { min: 6, notes: 6, ring: 0.9 },
  { min: 4, notes: 4, ring: 0.55 },
];
// 駆け上がりの音程。長3和音を積み上げた並び（ド・ミ・ソ・ド…）で、どこで止めても明るい
const FANFARE_STEPS = [0, 4, 7, 12, 16, 19, 24, 28];
const FANFARE_GAP = 0.042; // 粒の間隔（秒）

// 2026-10-15：2連鎖以上の7消しに足す、腹に来る「ドン」。
// 140Hz から 55Hz へ一気に落とす正弦波。スマホのスピーカーは60Hz付近が出ないので、
// 出だしの高めの部分で聞こえ、イヤホンでは下まで響く。連鎖が増えるほど少し強く長く
const playClearThump = (chain: number, delayMs = SEVEN_SOUND_DELAY_MS) => {
  const ctx = getAudioContext();
  const bus = getSfxBus();
  if (!ctx || !bus || chain < 2) return;
  const now = ctx.currentTime + delayMs / 1000;
  const power = Math.min(1, 0.55 + (chain - 2) * 0.15);
  const len = 0.16 + Math.min(4, chain - 2) * 0.03;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(55, now + len);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.9 * power, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + len);
  osc.connect(gain);
  gain.connect(bus);
  osc.start(now);
  osc.stop(now + len + 0.02);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
};

const playClearSound = (
  chain: number,
  fever = false,
  count = 2,
  delayMs = SEVEN_SOUND_DELAY_MS,
) => {
  const ctx = getAudioContext();
  const bus = getSfxBus();
  if (!ctx || !bus) {
    return;
  }

  // 鳴らし始めを SEVEN_SOUND_DELAY_MS だけ後ろへずらす。
  // 呼び出す時刻（着地や消去の流れ）は変えず、音の予定だけを遅らせるので、
  // 他の音や絵の段取りには影響しない。
  const now = ctx.currentTime + delayMs / 1000;
  // 丸く弾ける「ポリュン」。連鎖の音程は半音ずつ上げ、8連鎖で頭打ち。
  const step = Math.min(8, Math.max(1, chain)) - 1;
  const top = 720 * Math.pow(2, step / 12);

  const master = ctx.createGain();
  master.gain.value = 1.104; // 0.96 をさらに15%上げた
  master.connect(bus);

  // 高域を抑え、正弦波だけで柔らかい輪郭と短い魔法の余韻を作る。
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = fever ? 2800 : 2200; // フィーバー中は少しだけ明るく
  filter.Q.value = 0.5;
  filter.connect(master);

  // フィーバー中は、乾いた音に浅いコーラスとリバーブを重ねる
  const releaseSparkle = fever ? buildFeverSparkle(ctx, filter, master) : null;
  // 通常時の音程は下へ弾ませ、フィーバーは後段の上昇音階で鳴らす
  const bend = 0.55; // 通常時の「ポリュン」の下降幅

  let activeVoices = 0;
  const note = (
    freq: number,
    level: number,
    delay: number,
    duration: number,
    fall = bend,
    from = 0.85, // 出だしの音程（freq に対する比）
    rise = 0.018, // 出だしから freq へ滑り上がるまでの秒数
    vib = 0, // 泡立つような速い揺れの深さ（比）。0 なら揺らさない
    ringOut = duration, // 音量が消えきるまでの秒数。音程の動きは duration で終える
  ) => {
    const start = now + delay;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * from, start);
    osc.frequency.exponentialRampToValueAtTime(freq, start + rise);
    osc.frequency.exponentialRampToValueAtTime(freq * fall, start + duration);
    if (vib > 0) {
      // 速い揺れを、だんだん浅く遅くする。ぷくぷく泡が立って落ち着いていく感じ
      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(16, start);
      lfo.frequency.exponentialRampToValueAtTime(5, start + duration);
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(freq * vib, start + rise);
      depth.gain.exponentialRampToValueAtTime(freq * vib * 0.15, start + duration);
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(start);
      lfo.stop(start + duration + 0.02);
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + ringOut);

    osc.connect(gain);
    gain.connect(filter);
    activeVoices += 1;
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      activeVoices -= 1;
      if (activeVoices === 0) {
        // 残響のしっぽが鳴り終わるのを待ってから外す
        window.setTimeout(
          () => {
            releaseSparkle?.();
            filter.disconnect();
            master.disconnect();
          },
          releaseSparkle ? 1800 : 0,
        );
      }
    };
    osc.start(start);
    osc.stop(start + ringOut + 0.02);
  };

  if (fever) {
    // 「ティルルッ↑」：長3和音を4粒で駆け上がり、最後だけさらに全音上へ抜ける。
    const steps = [0, 4, 7, 12];
    steps.forEach((semitones, index) => {
      const freq = top * Math.pow(2, semitones / 12);
      const last = index === steps.length - 1;
      note(freq, last ? 0.34 : 0.28, index * 0.038,
        last ? 0.16 : 0.095, last ? Math.pow(2, 2 / 12) : 1,
        0.98, 0.008, 0, last ? 0.28 : 0.12);
    });
  } else {
    // 通常時は従来の「ポリュン」と長めの余韻。
    const tailScale = 2.6;
    note(top, 0.48, 0, 0.18, bend, 0.85, 0.018, 0, 0.18 * tailScale);
    note(top * 2 / 3, 0.18, 0, 0.16, bend, 0.85, 0.018, 0, 0.16 * tailScale);
    note(top * 1.5, 0.12, 0.045, 0.16, bend, 0.85, 0.018, 0, 0.16 * tailScale);
  }

  // 4個以上なら、上へ駆け上がる粒と、長く伸びる最後の一音を足す
  const fanfare = CLEAR_FANFARE.find((tier) => count >= tier.min);
  if (fanfare) {
    const tail = fanfare.ring * (fever ? 1.6 : 1);
    const base = top * 0.5;
    for (let i = 0; i < fanfare.notes; i += 1) {
      const freq = base * Math.pow(2, FANFARE_STEPS[i] / 12);
      const at = 0.05 + i * FANFARE_GAP;
      const last = i === fanfare.notes - 1;
      if (last) {
        // 最後の音は音程をほとんど落とさずに伸ばす。ここが「ラーン」
        note(freq, 0.34, at, tail, fever ? 1.12 : 0.97);
        // 1オクターブ下を薄く重ねて、伸びる音に厚みを持たせる
        note(freq / 2, 0.12, at, tail * 0.9, fever ? 1.12 : 0.97);
      } else {
        note(freq, 0.2, at, 0.12, fever ? 1 : 0.9);
      }
    }
  }
};

// ボム成立の音「チュルリルリラーっ」。セヴン目音に相当する、技が決まった合図。
// 置いた瞬間に役が決まったことを、駆け上がる粒（チュルリルリ）で知らせ、
// てっぺんの一音を長く伸ばし（ラーっ）、その上にキラキラを降らせて締める。
// 技ごとに音域と並びを変えてあるので、画面を見なくてもどれが出たか分かる。
// 数字は C からの半音の距離。base がその技の一番低い音になる。
const BOMB_LOCK_TONES: Record<
  string,
  { base: number; steps: number[]; type: OscillatorType; gap: number }
> = {
  // スパ1。いちばん高く、粒も多い。決まったときの派手さを音でも出す
  spa1: { base: 880, steps: [0, 4, 7, 12, 16, 19], type: 'triangle', gap: 0.032 },
  // スラ3。斜めに切る技なので、間隔を広く取って跳ねる並びにする
  sla3: { base: 659, steps: [0, 3, 7, 10, 14], type: 'square', gap: 0.038 },
  // スク4。四角く4つ揃う技。粒も4つに揃えて短く締める
  squ4: { base: 587, steps: [0, 5, 9, 12], type: 'square', gap: 0.045 },
  // スト6。一直線の技なので、半音階に近い等間隔でまっすぐ駆け上がる
  str6: { base: 494, steps: [0, 2, 4, 5, 7, 9], type: 'triangle', gap: 0.03 },
};

// 伸ばす一音の長さと、キラキラを降らせる長さ（秒）
const BOMB_LOCK_RING = 1.1;
const BOMB_LOCK_SPARKLE = 0.95;
const BOMB_LOCK_SPARKLE_GRAINS = 11;

const playBombLockSound = (kind: string) => {
  const ctx = getAudioContext();
  const bus = getSfxBus();
  const tone = BOMB_LOCK_TONES[kind];
  if (!ctx || !bus || !tone) {
    return;
  }

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(bus);

  // 粒が立ちすぎて耳に刺さらないよう、全体をローパスに通す
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 5600;
  filter.Q.value = 0.6;
  filter.connect(master);
  // セヴン目音のフィーバー時と同じ、浅いコーラスとリバーブ。伸ばす音の余韻を長く引く
  const releaseSparkle = buildFeverSparkle(ctx, filter, master);

  const voice = (
    hz: number,
    at: number,
    len: number,
    level: number,
    type: OscillatorType,
    rise = 1.04,
  ) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(hz, at);
    // 粒ごとにわずかに上へ滑らせる。これが「ル」の粘りになる
    osc.frequency.linearRampToValueAtTime(hz * rise, at + len);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + len);

    osc.connect(gain);
    gain.connect(filter);
    osc.start(at);
    osc.stop(at + len + 0.02);
    return osc;
  };

  // チュルリルリ … 粒どうしを重ねて、ぶつ切りではなくつながった連なりにする
  tone.steps.forEach((semi, index) => {
    voice(tone.base * Math.pow(2, semi / 12), now + index * tone.gap, tone.gap * 3, 0.28, tone.type);
  });

  // ラーっ … てっぺんの1オクターブ上を長く伸ばす。矩形波のまま伸ばすと耳に痛いので、
  // 伸ばす音は三角波と正弦波にして、ゆっくり揺らして歌わせる。
  const peakAt = now + tone.steps.length * tone.gap;
  const last = tone.steps[tone.steps.length - 1];
  const peakHz = tone.base * Math.pow(2, (last + 12) / 12);
  const lead = voice(peakHz, peakAt, BOMB_LOCK_RING, 0.26, 'triangle', 1.006);
  const body = voice(peakHz, peakAt, BOMB_LOCK_RING * 0.95, 0.16, 'sine', 1.006);
  voice(peakHz / 2, peakAt, BOMB_LOCK_RING * 0.8, 0.09, 'sine', 1.0);
  // ビブラート。立ち上がりの直後は揺らさず、伸びはじめてから少しずつ深くする
  const vibrato = ctx.createOscillator();
  vibrato.frequency.value = 5.6;
  const vibratoDepth = ctx.createGain();
  vibratoDepth.gain.setValueAtTime(0, peakAt);
  vibratoDepth.gain.linearRampToValueAtTime(peakHz * 0.007, peakAt + 0.35);
  vibrato.connect(vibratoDepth);
  vibratoDepth.connect(lead.frequency);
  vibratoDepth.connect(body.frequency);
  vibrato.start(peakAt);
  vibrato.stop(peakAt + BOMB_LOCK_RING + 0.05);

  // キラキラ … 2オクターブ上の和音の音を、細かく降らせる。
  // 音程は技の並びから拾うので、どの技でも和音から外れない。
  // 後ろほど間隔を広げ、小さくしていくと、光の粒が消えていくように聞こえる。
  for (let i = 0; i < BOMB_LOCK_SPARKLE_GRAINS; i += 1) {
    const progress = i / (BOMB_LOCK_SPARKLE_GRAINS - 1);
    const at = peakAt + 0.03 + BOMB_LOCK_SPARKLE * Math.pow(progress, 1.35);
    // 上下に行き来させる。一方向に並べると音階練習に聞こえる
    const semi = tone.steps[(i * 3) % tone.steps.length] + 24;
    voice(
      tone.base * Math.pow(2, semi / 12),
      at,
      0.2,
      0.1 * (1 - progress * 0.7),
      'sine',
      0.985,
    );
  }

  // 残響のしっぽが鳴り終わってから片付ける
  const total = tone.steps.length * tone.gap + BOMB_LOCK_RING + 1.8;
  window.setTimeout(() => {
    releaseSparkle();
    vibratoDepth.disconnect();
    filter.disconnect();
    master.disconnect();
  }, total * 1000);
};

// 回転音。回すたびに鳴る、さりげなく小さい操作音。
//
// 候補は3つ。ROTATE_VARIANT を書き換えるだけで入れ替わる。
//   koro … 「ころっ」 木の小さな粒が2つ、3度上へ転がる。サイコロが一面ぶん
//           転がったような音。いまの採用
//   poko … 「ぽこ」   丸い木琴を一打ち。いちばん落ち着いている
//   puni … 「ぷに」   やわらかいゴムを押したような、少しだけ上がる粒
//
// 1つ前の「ぷぃっ」は 1.3〜1.8kHz の正弦波に1オクターブ上を重ねていて、
// 小さくても甲高く、何度も聞くと耳に刺さった。3つとも基音を 600〜900Hz に下げ、
// 上の帯域は木琴の倍音（基音の約2.76倍）をうっすら足すだけにしてある。
// スマホでも埋もれない明るさは倍音側に持たせ、耳に痛い純音は使わない。
//
// 立ち上がりは1ms。音程やふくらみで始まる音は、耳が「鳴った」と感じるのが
// 少し遅れる。叩いた瞬間がそのまま鳴り始めになる打楽器の形にしている。
type RotateVariant = 'koro' | 'poko' | 'puni';
const ROTATE_VARIANT: RotateVariant = 'koro';
// 候補ごとの音量合わせ。どれに差し替えても同じ大きさ（出口のピーク約0.16）で鳴る
const ROTATE_TRIM: Record<RotateVariant, number> = { koro: 1, poko: 0.82, puni: 1.04 };

// 木琴のような一打ち。基音と、2.76倍の倍音を短く減衰させる
const woodTick = (
  ctx: BaseAudioContext,
  dest: AudioNode,
  at: number,
  freq: number,
  level: number,
  decay: number,
) => {
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(level, at + 0.001);
  env.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  env.connect(dest);

  const body = ctx.createOscillator();
  body.type = 'sine';
  body.frequency.setValueAtTime(freq, at);
  body.connect(env);

  // 倍音は本体より先に消す。長く残ると金属っぽくなる
  const partialEnv = ctx.createGain();
  partialEnv.gain.setValueAtTime(0.0001, at);
  partialEnv.gain.exponentialRampToValueAtTime(0.28, at + 0.001);
  partialEnv.gain.exponentialRampToValueAtTime(0.0001, at + decay * 0.45);
  partialEnv.connect(env);
  const partial = ctx.createOscillator();
  partial.type = 'sine';
  partial.frequency.setValueAtTime(freq * 2.76, at);
  partial.connect(partialEnv);

  body.start(at);
  partial.start(at);
  body.stop(at + decay + 0.02);
  partial.stop(at + decay + 0.02);
};

const synthRotate = (ctx: BaseAudioContext, dest: AudioNode, at: number, variant: RotateVariant) => {
  if (variant === 'koro') {
    // ころっ … 短い2粒。2つめを長3度上げて、転がって止まった感じにする
    woodTick(ctx, dest, at, 698, 0.62, 0.05);
    woodTick(ctx, dest, at + 0.028, 880, 0.5, 0.06);
    return;
  }
  if (variant === 'poko') {
    // ぽこ … 一打ちだけ。叩いた直後に少しだけ音程が落ちて、丸く聞こえる
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(0.7, at + 0.001);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.085);
    env.connect(dest);
    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(660, at);
    body.frequency.exponentialRampToValueAtTime(590, at + 0.04);
    body.connect(env);
    body.start(at);
    body.stop(at + 0.1);
    woodTick(ctx, dest, at, 660, 0.18, 0.03);
    return;
  }
  // ぷに … 三角波を少しだけ持ち上げ、高いところを丸めて柔らかくする
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1700;
  filter.Q.value = 0.6;
  filter.connect(dest);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(0.75, at + 0.001);
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
  env.connect(filter);
  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(560, at);
  body.frequency.exponentialRampToValueAtTime(720, at + 0.03);
  body.connect(env);
  body.start(at);
  body.stop(at + 0.09);
};

// 起動時のサイコロが転がる音「コロコロコロっ」。
// 木の小さな粒を、転がりが遅くなるのに合わせて間隔を広げながら打ち、
// 止まる瞬間（rollSec）に少し大きめの「コトッ」と、小さな跳ね返りで締める。
// 音程は明るい五音から選ぶので、どこで鳴っても可愛く聞こえる。
const DICE_ROLL_NOTES = [784, 880, 988, 1175, 1319]; // ソ ラ シ レ ミ
// 今回の投射・雷の音は、中断・ミュート時に残響も止める。
const anchiThunderSources = new Set<AudioScheduledSourceNode>();
const trackAnchiThunderSource = <T extends AudioScheduledSourceNode>(source: T): T => {
  anchiThunderSources.add(source);
  source.onended = () => { anchiThunderSources.delete(source); source.disconnect(); };
  return source;
};
const stopAnchiThunderSounds = () => {
  for (const source of anchiThunderSources) { try { source.stop(); } catch { /* already stopped */ } source.disconnect(); }
  anchiThunderSources.clear();
};

// イチニノサンダー：光ったサイに触れたとき・なぞって次のサイへ進んだときの「キラン」。
// step 0〜2 で音が上がっていき、3つ目でそろった感じを出す
const playThunderTraceSound = (step: number) => {
  const ctx = getAudioContext();
  const bus = getSfxBus('thunder');
  if (!ctx || !bus) return;
  const now = ctx.currentTime;
  const freq = [1047, 1319, 1568][step] ?? 1568;
  [freq, freq * 2].forEach((f, i) => {
    const osc = trackAnchiThunderSource(ctx.createOscillator());
    osc.type = i === 0 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(f, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(i === 0 ? 0.3 : 0.12, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g); g.connect(bus);
    osc.start(now); osc.stop(now + 0.2);
  });
  // 電気がはじける小さな「ジッ」
  const zap = trackAnchiThunderSource(makeNoise(ctx, 0.05, 3));
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 3500;
  const zg = ctx.createGain();
  zg.gain.setValueAtTime(0.25, now);
  zg.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  zap.connect(hp); hp.connect(zg); zg.connect(bus);
  zap.start(now); zap.stop(now + 0.06);
};

// イチニノサンダーのカウント「イチ・ニノ」。だんだん高くなる電子音。step は 0〜1（2026-10-14 サンはなくした）
const playThunderCountSound = (step: number) => {
  const ctx = getAudioContext();
  const bus = getSfxBus('thunder');
  if (!ctx || !bus) return;
  const now = ctx.currentTime;
  const osc = trackAnchiThunderSource(ctx.createOscillator());
  osc.type = 'square';
  osc.frequency.value = [660, 880, 1175][step] ?? 880;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.28, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  osc.connect(g);
  g.connect(bus);
  osc.start(now);
  osc.stop(now + 0.25);
};

// 「ダー！」のイナヅマ。バリッと裂けるノイズに、低いドーンを重ねる
const playThunderStrikeSound = () => {
  const ctx = getAudioContext();
  const bus = getSfxBus('thunder');
  if (!ctx || !bus) return;
  const now = ctx.currentTime;
  const crack = trackAnchiThunderSource(makeNoise(ctx, 0.5, 1.4));
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1400;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0.9, now);
  cg.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  crack.connect(hp);
  hp.connect(cg);
  cg.connect(bus);
  crack.start(now);
  crack.stop(now + 0.5);
  const boom = trackAnchiThunderSource(ctx.createOscillator());
  boom.type = 'sine';
  boom.frequency.setValueAtTime(120, now);
  boom.frequency.exponentialRampToValueAtTime(38, now + 0.7);
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.0001, now);
  bg.gain.exponentialRampToValueAtTime(0.8, now + 0.02);
  bg.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  boom.connect(bg);
  bg.connect(bus);
  boom.start(now);
  boom.stop(now + 0.85);
};

// ペンキを飛ばす「ぷしゅっ」。着弾音とは別に発射時に一度だけ鳴らす。
const playPaintLaunchSound = () => {
  const ctx = getAudioContext();
  const bus = getSfxBus('enemy');
  if (!ctx || !bus) return;
  const now = ctx.currentTime;
  const noise = trackAnchiThunderSource(makeNoise(ctx, 0.22, 2));
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(650, now);
  filter.frequency.exponentialRampToValueAtTime(2300, now + 0.1);
  filter.frequency.exponentialRampToValueAtTime(400, now + 0.22);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.45, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  noise.connect(filter); filter.connect(gain); gain.connect(bus);
  noise.start(now); noise.stop(now + 0.23);
};

// ペンキが「べちゃっ」と着く音。こもったノイズを2つ重ねる
const playPaintSplatSound = () => {
  const ctx = getAudioContext();
  const bus = getSfxBus('enemy');
  if (!ctx || !bus) return;
  const now = ctx.currentTime;
  [0, 0.07].forEach((at, i) => {
    const noise = trackAnchiThunderSource(makeNoise(ctx, 0.18, 2));
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(i === 0 ? 1800 : 1200, now + at);
    lp.frequency.exponentialRampToValueAtTime(300, now + at + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now + at);
    g.gain.exponentialRampToValueAtTime(0.7, now + at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, now + at + 0.17);
    noise.connect(lp); lp.connect(g); g.connect(bus);
    noise.start(now + at); noise.stop(now + at + 0.2);
  });
};

// 門のカギが開く音。金属の「カチャ」2打のあと、明るいアルペジオがきらっと上がる
const playHyoketsuFreezeSound = () => {
  const ctx=getAudioContext(),bus=getSfxBus('effect');if(ctx&&bus)playIceFreeze(ctx,bus);
};
const playHyoketsuCrashSound = () => {const ctx=getAudioContext(),bus=getSfxBus('effect');if(ctx&&bus)playIceCrash(ctx,bus);};
const playGateUnlockSound = () => {
  const ctx = getAudioContext();
  const bus = getSfxBus();
  if (!ctx || !bus) return;
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(bus);
  // カチャ：高域だけ通したノイズの短い打撃を2つ
  [0, 0.09].forEach((at, i) => {
    const noise = makeNoise(ctx, 0.05, 3);
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = i === 0 ? 3200 : 4600;
    hp.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, now + at);
    g.gain.exponentialRampToValueAtTime(0.001, now + at + 0.05);
    noise.connect(hp); hp.connect(g); g.connect(master);
    noise.start(now + at); noise.stop(now + at + 0.06);
  });
  // きらっ：C6 E6 G6 C7 を順に
  [1047, 1319, 1568, 2093].forEach((freq, i) => {
    const at = now + 0.2 + i * 0.07;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.35, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, at + (i === 3 ? 0.9 : 0.35));
    osc.connect(g); g.connect(master);
    osc.start(at); osc.stop(at + 1);
  });
};

const playDiceRollSound = (rollSec: number) => {
  const ctx = getAudioContext();
  if (!ctx) return;
  void whenIntroAudioRunning(ctx, rollSec * 1000, (remainingMs) => {
    const bus = getSfxBus('operation');
    if (!bus) return;
    const out = ctx.createGain();
    out.gain.value = 0.64; // 2026-10-07：従来の2倍
    out.connect(bus);
    const now = ctx.currentTime + 0.01;
    const rand = seededRandom(7);
    // 最初は 45ms 間隔、だんだん開いて止まる直前は 110ms ほどになる
    let t = 0;
    let gap = 0.045;
    while (t < remainingMs / 1000 - 0.09) {
      const freq = DICE_ROLL_NOTES[Math.floor(rand() * DICE_ROLL_NOTES.length)];
      // 1粒ずつ余韻（サステイン）を残して、カラカラと響かせる
      woodTick(ctx, out, now + t, freq, 0.34 + rand() * 0.14, 0.16);
      t += gap;
      gap = Math.min(0.11, gap * 1.13);
    }
    // 止まる音は、絵が止まる瞬間に playDiceStopSound で別に鳴らす
    window.setTimeout(() => out.disconnect(), remainingMs + 900);
  });
};

// サイコロが止まる音「コトンッ・ピン」。目が止まった瞬間（絵が潰れて戻る瞬間）に鳴らす。
// 転がる音のタイマーに頼らず、止まる絵と同じタイマーから呼ぶので、絵とずれない。
// 次の1コマで絵が描かれるぶん（約16ms）だけ後ろに置く。
const playDiceStopSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  void whenIntroAudioRunning(ctx, SFX_LATE_LIMIT_MS, () => {
    const bus = getSfxBus('operation');
    if (!bus) return;
    const out = ctx.createGain();
    out.gain.value = 0.72; // 2026-10-07：従来の2倍
    out.connect(bus);
    const at = ctx.currentTime + 0.016;
    // 机に当たる低い「コトン」
    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(260, at);
    thump.frequency.exponentialRampToValueAtTime(110, at + 0.09);
    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0.0001, at);
    thumpGain.gain.exponentialRampToValueAtTime(0.9, at + 0.004);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
    thump.connect(thumpGain);
    thumpGain.connect(out);
    thump.start(at);
    thump.stop(at + 0.45);
    // 木の硬い「コト」と、小さな跳ね返り
    woodTick(ctx, out, at, 659, 0.8, 0.3);
    woodTick(ctx, out, at + 0.075, 988, 0.3, 0.2);
    // 目が決まった合図の「ピン」
    const ping = ctx.createOscillator();
    ping.type = 'triangle';
    ping.frequency.value = 1568;
    const pingGain = ctx.createGain();
    pingGain.gain.setValueAtTime(0.0001, at + 0.03);
    pingGain.gain.exponentialRampToValueAtTime(0.22, at + 0.04);
    pingGain.gain.exponentialRampToValueAtTime(0.0001, at + 1.6); // 余韻を長く
    ping.connect(pingGain);
    pingGain.connect(out);
    ping.start(at + 0.03);
    ping.stop(at + 1.65);
    window.setTimeout(() => out.disconnect(), 1900);
  });
};

// クリアの演出の時刻（ms）。ファンファーレの音と、文字・花火・点数・ボタンが出る時刻をそろえる。
// 以前の約3倍の長さ。ドラムロールで溜めてから、ラーーンと伸ばしながら花火を3回上げる
// 2026-10-08：クリアの前に「BGMを600msでフェードアウト → 400msの間 → デュルリリーン」を入れたので、
// ドラムロールとタ・タ・タはやめて、CLEAR! が出るのと同時にラーーンを鳴らす
const CLEAR_BGM_FADE_MS = 600; // BGMをすっと消す
const CLEAR_HUSH_MS = 400; // 無音の間
const CLEAR_STING_MS = 520; // デュルリリーン（鳴り終わりの「リーン」の頭で CLEAR! を出す）
const CLEAR_ROLL_MS = 0;
const CLEAR_LETTERS_MS = 60; // CLEAR! の文字が1字ずつ出はじめる
const CLEAR_VOLLEYS_MS = [60, 810, 1560]; // 花火を上げる時刻
const CLEAR_SCORE_MS = 1110; // 点数を出す
const CLEAR_BUTTONS_MS = 1710; // 次へ進むボタンを出す（早押しで演出を飛ばさないように）
const CLEAR_CELEBRATION_MS = 2710; // 花火を片付ける

// メンのクリアのファンファーレ。前に鳴らすデュルリリーン（playClearStingSound）に続けて、CLEAR! と同時に鳴らす。
//   0秒〜 … シンバルとラーーン。ド・ミ・ソ・ドの和音を2.6秒伸ばし、ゆっくり揺らして歌わせる
//   その上にキラキラの駆け上がりを2回降らせ、浅いコーラスとリバーブで余韻を広げる
// タイミングは CLEAR_* の定数（文字・花火・点数・ボタンが出る時刻）とそろえてある
const playFanfareSound = () => {
  const ctx = getAudioContext();
  const bus = getSfxBus();
  if (!ctx || !bus) {
    return;
  }
  const now = ctx.currentTime + 0.02;
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(bus);
  const release = buildFeverSparkle(ctx, master, bus);

  const tone = (
    freq: number,
    at: number,
    len: number,
    level: number,
    type: OscillatorType,
    vibrato = 0,
  ) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + at);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now + at);
    gain.gain.exponentialRampToValueAtTime(level, now + at + 0.012);
    gain.gain.setValueAtTime(level, now + at + Math.min(0.5, len * 0.4));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + len);
    osc.connect(gain);
    gain.connect(master);
    if (vibrato > 0) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.2;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, now + at);
      depth.gain.linearRampToValueAtTime(freq * vibrato, now + at + 0.6);
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(now + at);
      lfo.stop(now + at + len + 0.02);
    }
    osc.start(now + at);
    osc.stop(now + at + len + 0.02);
  };

  const hit = CLEAR_ROLL_MS / 1000;
  // 締めのシンバル。ロールの終わりにひと打ち
  const crashLength = 1.2;
  const crashBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * crashLength), ctx.sampleRate);
  const crashData = crashBuffer.getChannelData(0);
  for (let n = 0; n < crashData.length; n += 1) {
    crashData[n] = (Math.random() * 2 - 1) * (1 - n / crashData.length) ** 3;
  }
  const crash = ctx.createBufferSource();
  crash.buffer = crashBuffer;
  const crashFilter = ctx.createBiquadFilter();
  crashFilter.type = 'highpass';
  crashFilter.frequency.value = 3200;
  const crashGain = ctx.createGain();
  crashGain.gain.value = 0.22;
  crash.connect(crashFilter);
  crashFilter.connect(crashGain);
  crashGain.connect(master);
  crash.start(now + hit);

  // ラーーン（ド・ミ・ソ・ド の和音を長く）。前のデュルリリーンに続けてすぐ鳴らす
  const chord = hit;
  [1047, 1319, 1568, 523].forEach((freq, i) => {
    tone(freq, chord, 2.6, i === 0 ? 0.26 : 0.14, i === 3 ? 'triangle' : 'square', i === 0 ? 0.006 : 0);
  });
  // キラキラの駆け上がりを2回
  [0.05, 1.05].forEach((start, round) => {
    [2093, 2349, 2637, 3136, 3520, 4186].forEach((freq, i) => {
      tone(freq * (round === 1 ? 1.122 : 1), chord + start + i * 0.07, 0.34, 0.06, 'sine');
    });
  });
  window.setTimeout(() => {
    release();
    master.disconnect();
  }, (chord + 2.6 + 2) * 1000);
};

// クリアの直前の「デュルリリーン」。細かく駆け上がって（デュルリリ）、高い音を鈴のように伸ばす（リーン）
const playClearStingSound = () => {
  const ctx = getAudioContext();
  const bus = getSfxBus();
  if (!ctx || !bus) return;
  const now = ctx.currentTime + 0.01;
  const out = ctx.createGain();
  out.gain.value = 0.7;
  out.connect(bus);
  const note = (freq: number, at: number, len: number, level: number, type: OscillatorType) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + at);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now + at);
    env.gain.exponentialRampToValueAtTime(level, now + at + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, now + at + len);
    osc.connect(env);
    env.connect(out);
    osc.start(now + at);
    osc.stop(now + at + len + 0.02);
  };
  // デュルリリ：ソ・ラ・シ・レ・ミ・ソ・ラ を 45ms ずつ
  [784, 880, 988, 1175, 1319, 1568, 1760].forEach((freq, i) => {
    note(freq, i * 0.045, 0.09, 0.16 + i * 0.015, 'triangle');
    note(freq * 2, i * 0.045, 0.05, 0.03, 'square');
  });
  // リーン：高いレを、倍音を重ねて長めに鳴らす
  const ring = 0.33;
  note(2349, ring, 1.3, 0.24, 'sine');
  note(4698, ring, 0.8, 0.07, 'sine');
  note(3520, ring + 0.01, 0.6, 0.05, 'triangle');
  window.setTimeout(() => out.disconnect(), 2000);
};

// 敵への命中は高い「チュルルルッ」。短い4粒で、重なった消去音の中でも輪郭を出す。
const playEnemyTrill = (heavy: boolean, finishing = false) => {
  const ctx = getAudioContext();
  const bus = getSfxBus('enemyHit');
  if (!ctx || !bus) return;
  focusEnemySound(ctx, 0.34);
  const at = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = heavy ? 1.05 : 0.95;
  out.connect(bus);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 4200; // 高さは残し、耳に刺さる倍音だけ丸める
  filter.Q.value = 0.5;
  filter.connect(out);

  [1900, 2380, 2100, 2650].forEach((pitch, index) => {
    const time = at + index * 0.052;
    const freq = pitch * (finishing ? 1.06 : 1);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq * 0.78, time);
    osc.frequency.exponentialRampToValueAtTime(freq, time + 0.008);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.53, time + 0.058);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(index === 3 ? 0.62 : 0.54, time + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.073);
    osc.connect(env);
    env.connect(filter);
    osc.start(time);
    osc.stop(time + 0.08);
  });
  // 中低域の芯も添える。大型は少し太くし、スマホでも手応えを残す。
  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(heavy ? 420 : 560, at);
  body.frequency.exponentialRampToValueAtTime(heavy ? 150 : 230, at + 0.12);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(heavy ? 0.38 : 0.2, at + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
  body.connect(env);
  env.connect(filter);
  body.start(at);
  body.stop(at + 0.18);
  window.setTimeout(() => {
    filter.disconnect();
    out.disconnect();
  }, 500);
};

// デタラメの目が実際につぶれる「キュパッ」。PCMはコンテキストごとに1度だけ作る。
// 同じ時刻の命中も独立したsourceで重ねる。1イベント8声・全体16声でスマホ負荷を制限。
const DETARAME_DAMAGE_SECONDS = 0.22;
const DETARAME_DAMAGE_MAX_VOICES = 16;
let detarameDamageCtx: AudioContext | null = null;
let detarameDamageBuffer: AudioBuffer | null = null;
const detarameDamageSources = new Map<AudioBufferSourceNode, GainNode>();
const releaseDetarameDamageSource = (source: AudioBufferSourceNode) => {
  source.onended = null;
  source.disconnect();
  detarameDamageSources.get(source)?.disconnect();
  detarameDamageSources.delete(source);
};
const stopDetarameDamageSounds = () => {
  detarameDamageSources.forEach((_gain, source) => {
    try { source.stop(); } catch { /* 既に終了した音も必ず切断する */ }
    releaseDetarameDamageSource(source);
  });
};
const onDetarameAudioStateChange = () => {
  if (detarameDamageCtx?.state !== 'running') stopDetarameDamageSounds();
};
const playDetarameDamageSound = (hitCount: number) => {
  if (gamePaused || document.hidden || !Number.isFinite(hitCount) || hitCount < 1) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== 'running') return; // 解除後に古いダメージ音をまとめて鳴らさない
  const bus = getSfxBus('detarame');
  if (!bus) return;
  if (detarameDamageCtx !== ctx) {
    stopDetarameDamageSounds();
    detarameDamageCtx?.removeEventListener('statechange', onDetarameAudioStateChange);
    detarameDamageCtx = ctx;
    ctx.addEventListener('statechange', onDetarameAudioStateChange);
    detarameDamageBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * DETARAME_DAMAGE_SECONDS), ctx.sampleRate);
    const data = detarameDamageBuffer.getChannelData(0);
    const tau = Math.PI * 2;
    const phase = (t: number, from: number, to: number, decay: number) =>
      tau * (to * t + (from - to) * decay * (1 - Math.exp(-t / decay)));
    for (let i = 0; i < data.length; i += 1) {
      const t = i / ctx.sampleRate;
      const attack = Math.min(1, t / 0.003) ** 2;
      const tail = Math.min(1, Math.max(0, (DETARAME_DAMAGE_SECONDS - t) / 0.03)) ** 2;
      const body = Math.sin(phase(t, 720, 180, 0.024)) * Math.exp(-t / 0.052) * 0.38;
      const snap = Math.sin(phase(t, 2600, 950, 0.014)) * Math.exp(-t / 0.026) * 0.2;
      data[i] = (body + snap) * attack * tail;
    }
  }
  // 上限でも再生中の音を切らず、予約待ちもしない。通常の2イベント各8声は全て重なる。
  const count = Math.min(8, Math.floor(hitCount), DETARAME_DAMAGE_MAX_VOICES - detarameDamageSources.size);
  if (count <= 0) return;
  focusEnemySound(ctx, 0.25, 0.4);
  for (let i = 0; i < count; i += 1) {
    const source = ctx.createBufferSource();
    source.buffer = detarameDamageBuffer;
    source.playbackRate.value = 1 + i * 0.045;
    const gain = ctx.createGain();
    gain.gain.value = 0.65 / Math.sqrt(count);
    source.connect(gain);
    gain.connect(bus);
    source.onended = () => releaseDetarameDamageSource(source);
    detarameDamageSources.set(source, gain);
    source.start(ctx.currentTime);
  }
};

// 白フラッシュ開始と同じ処理から鳴らす。大型の点滅周期60msに合わせた3連打。
// 1回の消去につき1セットだけ。複数の敵に当たっても重ねて音割れさせない。
const playEnemyFlashSound = (heavy: boolean) => {
  playEnemyTrill(heavy);
  const ctx = getAudioContext();
  const bus = getSfxBus('impact');
  if (!ctx || !bus) return;
  focusEnemySound(ctx, 0.3, 0.3);
  const at = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(bus);
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.045), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  [0, 0.06, 0.12].forEach((offset, index) => {
    const time = at + offset;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2100 + index * 250;
    band.Q.value = 0.65;
    const snap = ctx.createGain();
    snap.gain.setValueAtTime(0.0001, time);
    snap.gain.exponentialRampToValueAtTime(0.95 - index * 0.08, time + 0.0015);
    snap.gain.exponentialRampToValueAtTime(0.0001, time + 0.038);
    noise.connect(band);
    band.connect(snap);
    snap.connect(out);
    noise.start(time);
    noise.stop(time + 0.045);

    // 「パ」の芯。ノイズだけではスマホで痩せるので、中高域の短い打撃も重ねる。
    const pop = ctx.createOscillator();
    pop.type = 'triangle';
    pop.frequency.setValueAtTime(1250 + index * 100, time);
    pop.frequency.exponentialRampToValueAtTime(420, time + 0.03);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(heavy ? 0.48 : 0.4, time + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.043);
    pop.connect(env);
    env.connect(out);
    pop.start(time);
    pop.stop(time + 0.05);
  });
  window.setTimeout(() => out.disconnect(), 400);
};

// ベラボウメの暴れ「ゴゴゴッ」。本体の80ms周期の震えに合わせた低い連打。
// 超低音だけにせず、三角波の倍音と低いノイズでスマホにもざらっとした芯を残す。
const playBerabouRageSound = () => {
  const ctx = getAudioContext();
  const bus = getSfxBus('enemy');
  if (!ctx || !bus) return;
  focusEnemySound(ctx, 0.96, 0.4);
  const at = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = 0.95;
  out.connect(bus);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 950;
  filter.Q.value = 0.6;
  filter.connect(out);
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.085), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;

  for (let i = 0; i < 12; i += 1) {
    const time = at + i * 0.08;
    const level = i < 3 ? 0.65 : 0.42 - (i - 3) * 0.022;
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(150 - (i % 3) * 14, time);
    body.frequency.exponentialRampToValueAtTime(65, time + 0.07);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(level, time + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.085);
    body.connect(env);
    env.connect(filter);
    body.start(time);
    body.stop(time + 0.09);

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(620, time);
    band.frequency.exponentialRampToValueAtTime(180, time + 0.065);
    band.Q.value = 0.8;
    const grit = ctx.createGain();
    grit.gain.setValueAtTime(0.0001, time);
    grit.gain.exponentialRampToValueAtTime(level * 0.7, time + 0.003);
    grit.gain.exponentialRampToValueAtTime(0.0001, time + 0.075);
    noise.connect(band);
    band.connect(grit);
    grit.connect(filter);
    noise.start(time);
    noise.stop(time + 0.085);
  }
  window.setTimeout(() => {
    filter.disconnect();
    out.disconnect();
  }, 1200);
};

const playEnemyHitSound = (kill: boolean) => playEnemyTrill(false, kill);
const playHidoimeHitSound = () => playEnemyTrill(true);

// 登場時にサイを押しつぶす瞬間だけ。既存の敵SEバスの音量制限を通す。
const hidoimeCrushSound = createHidoimeCrushSound();
const playHidoimeCrushSound = () => {
  if (gamePaused || document.hidden) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== 'running') return;
  const bus = getSfxBus('enemy');
  if (bus) hidoimeCrushSound.play(ctx, bus);
};

// 敵がサイを食べる「ガブッ…モグモグ」（2026-10-15）。アンチクショウメの成長、デタラメの登場・伸びるときの吸い込みで鳴らす。
// 低い噛みつき（下がる音程＋短いノイズ）のあと、こもった咀嚼を2回。count が多いほど少し重くする
const playDevourSound = (count = 1) => {
  if (gamePaused || document.hidden) return;
  const ctx = getAudioContext();
  const bus = getSfxBus('enemy');
  if (!ctx || !bus) return;
  const at = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = Math.min(1.15, 0.85 + 0.1 * Math.max(0, count - 1));
  out.connect(bus);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1500;
  filter.Q.value = 0.8;
  filter.connect(out);
  // ガブッ：口を閉じる低い音
  const bite = ctx.createOscillator();
  bite.type = 'square';
  bite.frequency.setValueAtTime(260, at);
  bite.frequency.exponentialRampToValueAtTime(70, at + 0.12);
  const biteEnv = ctx.createGain();
  biteEnv.gain.setValueAtTime(0.0001, at);
  biteEnv.gain.exponentialRampToValueAtTime(0.55, at + 0.006);
  biteEnv.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
  bite.connect(biteEnv);
  biteEnv.connect(filter);
  bite.start(at);
  bite.stop(at + 0.18);
  const crunch = makeNoise(ctx, 0.07, 2);
  const crunchFilter = ctx.createBiquadFilter();
  crunchFilter.type = 'bandpass';
  crunchFilter.frequency.value = 900;
  crunchFilter.Q.value = 1.2;
  const crunchGain = ctx.createGain();
  crunchGain.gain.setValueAtTime(0.7, at);
  crunchGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
  crunch.connect(crunchFilter);
  crunchFilter.connect(crunchGain);
  crunchGain.connect(out);
  crunch.start(at);
  // モグモグ：こもった短い2打
  [0.2, 0.33].forEach((offset, i) => {
    const time = at + offset;
    const munch = ctx.createOscillator();
    munch.type = 'triangle';
    munch.frequency.setValueAtTime(i ? 150 : 175, time);
    munch.frequency.exponentialRampToValueAtTime(i ? 95 : 110, time + 0.08);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(0.4, time + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
    munch.connect(env);
    env.connect(filter);
    munch.start(time);
    munch.stop(time + 0.12);
  });
};

// 潰れる「ぷちゅん」。大型は3粒を詰めた「ぶちゅちゅんっ！」。
// 一瞬ふくらむ音程→急降下と、短い湿った破裂を重ね、長い風音にはしない。
const playEnemySquash = (large: boolean) => {
  const ctx = getAudioContext();
  const bus = getSfxBus('enemyDefeat');
  if (!ctx || !bus) return;
  focusEnemySound(ctx, large ? 0.48 : 0.3);
  const at = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = large ? 1.15 : 1;
  out.connect(bus);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 3400;
  filter.Q.value = 0.6;
  filter.connect(out);
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.1), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;

  const offsets = large ? [0, 0.07, 0.145] : [0];
  offsets.forEach((offset, index) => {
    const time = at + offset;
    const last = index === offsets.length - 1;
    const duration = last ? 0.2 : 0.105;
    const start = large ? [620, 900, 740][index] : 820;
    const pop = ctx.createOscillator();
    pop.type = 'triangle';
    pop.frequency.setValueAtTime(start, time);
    pop.frequency.exponentialRampToValueAtTime(start * 1.7, time + 0.016);
    pop.frequency.exponentialRampToValueAtTime(large ? 135 : 210, time + duration);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(last ? 0.78 : 0.6, time + 0.003);
    env.gain.exponentialRampToValueAtTime(0.16, time + duration * 0.65);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.025);
    pop.connect(env);
    env.connect(filter);
    pop.start(time);
    pop.stop(time + duration + 0.04);

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 1.8;
    band.frequency.setValueAtTime(large ? 1800 : 2600, time);
    band.frequency.exponentialRampToValueAtTime(large ? 480 : 700, time + 0.085);
    const air = ctx.createGain();
    air.gain.setValueAtTime(0.0001, time);
    air.gain.exponentialRampToValueAtTime(large ? 0.48 : 0.32, time + 0.003);
    air.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
    noise.connect(band);
    band.connect(air);
    air.connect(filter);
    noise.start(time);
    noise.stop(time + 0.1);
  });

  if (large) {
    // 最後の「んっ」に太い芯。超低音だけにせず、小さいスピーカーでも潰れ感を出す。
    const thud = ctx.createOscillator();
    thud.type = 'triangle';
    const time = at + 0.145;
    thud.frequency.setValueAtTime(310, time);
    thud.frequency.exponentialRampToValueAtTime(95, time + 0.18);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(0.48, time + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);
    thud.connect(env);
    env.connect(filter);
    thud.start(time);
    thud.stop(time + 0.26);
  }
  window.setTimeout(() => {
    filter.disconnect();
    out.disconnect();
  }, 650);
};

// コイツメ／ダーメ系の最終撃破は「ぷちゅん」。
const playSmallEnemyDefeatSound = () => playEnemySquash(false);
// ヒドイメ・ベラボウメ・デタラメの撃破は「ぶちゅちゅんっ！」。
const playHidoimeDefeatSound = () => playEnemySquash(true);

// 高速落下の「ファオッ」。押した瞬間に鳴らす、風を切る音。
// 白いノイズを帯域フィルターに通し、フィルターを上から下へ一気に振って「ファ→オ」を作る。
// 下に短い低音の沈み込みを重ねて「ッ」で止める。操作に即答させたいので、
// 回転音と同じくリミッターを通さず直接出す（先読みのぶん遅れるため）。
let whooshNoise: AudioBuffer | null = null;
const playHardDropSound = () => {
  const ctx = getAudioContext();
  const bus = getSfxBus('operation');
  if (!ctx || !bus) {
    return;
  }
  if (!whooshNoise || whooshNoise.sampleRate !== ctx.sampleRate) {
    whooshNoise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.3), ctx.sampleRate);
    const data = whooshNoise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  const at = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = 0.5;
  out.connect(bus);

  const noise = ctx.createBufferSource();
  noise.buffer = whooshNoise;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 2.2;
  band.frequency.setValueAtTime(2600, at);
  band.frequency.exponentialRampToValueAtTime(420, at + 0.16);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.9, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
  noise.connect(band);
  band.connect(gain);
  gain.connect(out);
  noise.start(at);
  noise.stop(at + 0.22);

  // 「オッ」の母音。ノコギリ波を低いほうへ滑らせ、フィルターで丸める
  const vowel = ctx.createOscillator();
  vowel.type = 'sawtooth';
  vowel.frequency.setValueAtTime(330, at);
  vowel.frequency.exponentialRampToValueAtTime(140, at + 0.14);
  const vowelFilter = ctx.createBiquadFilter();
  vowelFilter.type = 'lowpass';
  vowelFilter.frequency.setValueAtTime(1600, at);
  vowelFilter.frequency.exponentialRampToValueAtTime(380, at + 0.14);
  const vowelGain = ctx.createGain();
  vowelGain.gain.setValueAtTime(0.0001, at);
  vowelGain.gain.exponentialRampToValueAtTime(0.16, at + 0.02);
  vowelGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
  vowel.connect(vowelFilter);
  vowelFilter.connect(vowelGain);
  vowelGain.connect(out);
  vowel.start(at);
  vowel.stop(at + 0.18);
  window.setTimeout(() => out.disconnect(), 400);
};

// 回転音は小さく、音割れの心配がないので、リミッターを通さず直接出す。
// リミッター（DynamicsCompressor）は頭を押さえるために約6msの先読みを持っていて、
// 通すとそのぶん遅れて鳴る。操作に即答したい音なので、ここだけ迂回している。
const playRotateSound = () => {
  const ctx = getAudioContext();
  const bus = getSfxBus('operation');
  if (!ctx || !bus) {
    return;
  }
  const out = ctx.createGain();
  out.gain.value = ROTATE_SOUND_GAIN * ROTATE_TRIM[ROTATE_VARIANT];
  out.connect(bus);
  synthRotate(ctx, out, ctx.currentTime, ROTATE_VARIANT);
  window.setTimeout(() => out.disconnect(), 400);
};

// 虹ボムの獲得音。短い上昇のきらめき。
const playRainbowAwardSound = () => {
  const ctx = getAudioContext();
  const bus = getSfxBus();
  if (!ctx || !bus) {
    return;
  }
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(bus);
  // 虹にちなんで7粒。上へ駆け上がって余韻を残す
  [0, 4, 7, 12, 16, 19, 24].forEach((semi, index) => {
    const at = now + index * 0.045;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25 * Math.pow(2, semi / 12), at);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.3, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
    osc.connect(gain);
    gain.connect(master);
    osc.start(at);
    osc.stop(at + 0.36);
  });
};

// 「使う？」の3秒ゲージを刻む音。1秒ごとに1回、だんだん高くなる。
// 緊張を作る主役なので、短く硬い音にして時間の減りを耳で分かるようにする。
const playRainbowTickSound = (step: number) => {
  const ctx = getAudioContext();
  const bus = getSfxBus();
  if (!ctx || !bus) {
    return;
  }
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 0.6;
  master.connect(bus);
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(660 * Math.pow(2, step / 12), now);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 3200;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.42, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + 0.14);
};

// 虹ボム発動。低い一撃のうえに、虹色の粒を上から降らせる。
const playRainbowFireSound = () => {
  const ctx = getAudioContext();
  const bus = getSfxBus();
  if (!ctx || !bus) {
    return;
  }
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(bus);

  // 頭の一撃
  const hit = ctx.createOscillator();
  hit.type = 'sine';
  hit.frequency.setValueAtTime(220, now);
  hit.frequency.exponentialRampToValueAtTime(55, now + 0.4);
  const hitGain = ctx.createGain();
  hitGain.gain.setValueAtTime(0.0001, now);
  hitGain.gain.exponentialRampToValueAtTime(0.7, now + 0.02);
  hitGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  hit.connect(hitGain);
  hitGain.connect(master);
  hit.start(now);
  hit.stop(now + 0.52);

  // 上から降る粒。高いところから順に落として、消えていく範囲と向きをそろえる
  for (let i = 0; i < 18; i += 1) {
    const at = now + 0.05 + i * 0.035;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2400 * Math.pow(0.94, i), at);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.16, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
    osc.connect(gain);
    gain.connect(master);
    osc.start(at);
    osc.stop(at + 0.32);
  }
};

// 虹ボムの破裂音「シュパーン！」
// 「シュ」＝ノイズをバンドパスで下から上へ駆け上がらせる息の音。
// 「パーン」＝そのてっぺんで短いノイズを叩き、明るい和音を上へ抜けさせる。
// 息を溜めてから割る形にしないと、ただの破裂音になって痛快さが出ない。
const playRainbowBurstSound = () => {
  const ctx = getAudioContext();
  const bus = getSfxBus();
  if (!ctx || !bus) {
    return;
  }
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 1.25;
  master.connect(bus);

  const noiseAt = (start: number, length: number, build: (t: number, n: number) => number) => {
    const count = Math.floor(ctx.sampleRate * length);
    const buffer = ctx.createBuffer(1, count, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < count; i += 1) {
      data[i] = (Math.random() * 2 - 1) * build(i / count, count);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.start(start);
    return source;
  };

  // シュ … 0.10秒で 500Hz から 6kHz へ駆け上がる
  const swell = noiseAt(now, 0.12, (t) => t ** 0.7);
  const swellFilter = ctx.createBiquadFilter();
  swellFilter.type = 'bandpass';
  swellFilter.Q.value = 1.4;
  swellFilter.frequency.setValueAtTime(500, now);
  swellFilter.frequency.exponentialRampToValueAtTime(6000, now + 0.1);
  const swellGain = ctx.createGain();
  swellGain.gain.setValueAtTime(0.0001, now);
  swellGain.gain.exponentialRampToValueAtTime(0.42, now + 0.1);
  swell.connect(swellFilter);
  swellFilter.connect(swellGain);
  swellGain.connect(master);

  const hit = now + 0.1;

  // パーン … 割れる瞬間の芯。低い正弦波を一瞬で落とす
  const thump = ctx.createOscillator();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(260, hit);
  thump.frequency.exponentialRampToValueAtTime(52, hit + 0.26);
  const thumpGain = ctx.createGain();
  thumpGain.gain.setValueAtTime(0.0001, hit);
  thumpGain.gain.exponentialRampToValueAtTime(0.9, hit + 0.008);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, hit + 0.34);
  thump.connect(thumpGain);
  thumpGain.connect(master);
  thump.start(hit);
  thump.stop(hit + 0.36);

  // 破裂そのもの。高いところを残して一気に落とす
  const crack = noiseAt(hit, 0.42, (t) => (1 - t) ** 2.2);
  const crackFilter = ctx.createBiquadFilter();
  crackFilter.type = 'highpass';
  crackFilter.frequency.setValueAtTime(1400, hit);
  crackFilter.frequency.exponentialRampToValueAtTime(400, hit + 0.4);
  const crackGain = ctx.createGain();
  crackGain.gain.setValueAtTime(0.62, hit);
  crackGain.gain.exponentialRampToValueAtTime(0.0001, hit + 0.42);
  crack.connect(crackFilter);
  crackFilter.connect(crackGain);
  crackGain.connect(master);

  // 抜けていく明るい和音。上へ上がるので「助かった」側に聞こえる
  [880, 1108.73, 1318.51, 1760].forEach((freq, index) => {
    const at = hit + index * 0.012;
    const osc = ctx.createOscillator();
    osc.type = index > 1 ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(freq, at);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, at + 0.42);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.2, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
    osc.connect(gain);
    gain.connect(master);
    osc.start(at);
    osc.stop(at + 0.52);
  });

  // --- 後半の「チュルルル」---
  // 弾けたあと、2つの音をすばやく行き来しながら駆け上がり、最後の音を長く響かせる。
  // コーラスとリバーブ、軽いフランジャーで、虹の粒が舞い上がって消えていく余韻にする。
  const trill = buildShimmerBus(ctx, master, 0.35);
  const trillStart = now + 0.42;
  const steps = 22;
  for (let i = 0; i < steps; i += 1) {
    const climb = Math.pow(2, (i / steps) * (7 / 12)); // 全体で5度ほど上がる
    const freq = (i % 2 === 0 ? 1568 : 1760) * climb;
    const at = trillStart + i * 0.028;
    bellNote(ctx, trill.input, at, freq, 0.085, 0.14);
  }
  // 最後の一音。上がりきったところで長く鳴らす
  const lastAt = trillStart + steps * 0.028;
  bellNote(ctx, trill.input, lastAt, 1760 * Math.pow(2, 7 / 12), 0.12, 1.2);
  bellNote(ctx, trill.input, lastAt + 0.012, 1760 * Math.pow(2, 7 / 12) * 1.5, 0.05, 1.0);
  window.setTimeout(trill.release, 3600);
};

// 設置音「トッ」
// 中音域から低音域へ沈む丸い音に、短いノイズのアタックを重ねる。
// ノイズがあると「置いた瞬間」の位置がはっきりし、音量を上げなくても
// 手応えが出る。ローパスは高めに開けて、こもらせすぎないようにしている。
// 2026-10-15：設置音は4通りの高さからランダムに選ぶ（もとの音＋半音下・半音上・全音上）
const LOCK_PITCHES = [1, 0.944, 1.059, 1.122];
const playLockSound = (delayMs = 0) => {
  const pitch = LOCK_PITCHES[Math.floor(Math.random() * LOCK_PITCHES.length)];
  const ctx = getAudioContext();
  const bus = getSfxBus();
  if (!ctx || !bus) {
    return;
  }

  const now = ctx.currentTime + delayMs / 1000;
  const master = ctx.createGain();
  // セヴン目の消失音と同じか、やや下。設置は毎回鳴るので前に出しすぎない。
  master.gain.value = 0.336; // 0.28 の 1.2 倍
  master.connect(bus);

  // 本体は三角波。倍音があるぶん小型スピーカーでも実体が残る。
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(430 * pitch, now);
  osc.frequency.exponentialRampToValueAtTime(215 * pitch, now + 0.1);

  // 1オクターブ下を重ねて「トッ」の重心を下げる
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(215 * pitch, now);
  sub.frequency.exponentialRampToValueAtTime(104 * pitch, now + 0.12);

  const subGain = ctx.createGain();
  subGain.gain.value = 0.8;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(4200, now);
  filter.Q.value = 0.7;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.95, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

  osc.connect(filter);
  sub.connect(subGain);
  subGain.connect(filter);
  filter.connect(gain);
  gain.connect(master);

  osc.start(now);
  sub.start(now);
  osc.stop(now + 0.34);
  sub.stop(now + 0.34);

  // 当たった瞬間の「コッ」。ごく短いノイズを中高域だけ抜いて重ねる
  const noise = makeNoise(ctx, 0.05, 3);
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 1800 * pitch;
  noiseFilter.Q.value = 0.9;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.5, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(master);
  noise.start(now);
};

// ボム成立時の祝福音「花火」
// 中音のコードが立ち上がったあと、高音のきらめきを時間差で散らし、
// 帯域を絞ったノイズで破裂感を足す。
const playBombSound = () => {
  const ctx = getAudioContext();
  const bus = getSfxBus();
  if (!ctx || !bus) {
    return;
  }

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 1.35;
  master.connect(bus);

  // 打ち上がる瞬間の一撃。低い正弦波を短く落として腹に来る芯を作る。
  // 花火のきらめきだけでは高い音ばかりで、迫力が出ないため。
  const thump = ctx.createOscillator();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(180, now);
  thump.frequency.exponentialRampToValueAtTime(48, now + 0.22);
  const thumpGain = ctx.createGain();
  thumpGain.gain.setValueAtTime(0.0001, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.85, now + 0.012);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
  thump.connect(thumpGain);
  thumpGain.connect(master);
  thump.start(now);
  thump.stop(now + 0.36);

  // 破裂音：短いホワイトノイズをバンドパスで抜く
  const noiseLength = Math.floor(ctx.sampleRate * 0.35);
  const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseLength; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLength) ** 2;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(2600, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(900, now + 0.3);
  noiseFilter.Q.value = 0.8;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.5, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(master);
  noise.start(now);

  // 中音のコード（明るい長三和音）と、高音のきらめき
  const mid = [523.25, 659.25, 783.99]; // C5 E5 G5
  const high = [1046.5, 1318.5, 1568.0, 2093.0]; // C6 E6 G6 C7

  const ping = (freq: number, at: number, length: number, level: number, type: OscillatorType) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + at);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now + at);
    gain.gain.exponentialRampToValueAtTime(level, now + at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + length);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now + at);
    osc.stop(now + at + length + 0.05);
  };

  // 伸ばすのは散らばりと余韻だけ。頭の一撃(thump とノイズ)は元のまま残す。
  // 立ち上がりごと引き延ばすと破裂の鋭さが鈍り、ただ間延びして聞こえるため。
  const span = BOMB_SOUND_MS / 1000;
  mid.forEach((freq, index) => ping(freq, index * 0.05, span * 0.85, 0.3, 'triangle'));
  // 高音は時間差で散らして、火花が広がる感じを出す
  high.forEach((freq, index) => ping(freq, 0.08 + index * 0.22, span * 0.55, 0.22, 'sine'));
  high.forEach((freq, index) => ping(freq * 1.5, 0.35 + index * 0.2, span * 0.45, 0.13, 'sine'));
  // さらに遅れて降ってくる粒。消え際まで音が途切れないようにする。
  high.forEach((freq, index) => ping(freq * 2, 0.7 + index * 0.18, span * 0.35, 0.07, 'sine'));
};

// フィーバー中のボム音「光の大輪」。
// 通常のボム音が打ち上げ花火なら、こちらは降りそそぐ光。
// 低音の一撃は控えめにして、上へ伸びる響きときらめきの粒で尺を埋める。
// 鳴るのはフィーバー中だけなので、通常より派手に散らしてよい。
const playFeverBombSound = () => {
  const ctx = getAudioContext();
  const bus = getSfxBus();
  if (!ctx || !bus) {
    return;
  }

  const now = ctx.currentTime;
  const span = BOMB_SOUND_MS / 1000;

  const master = ctx.createGain();
  master.gain.value = 1.2;
  master.connect(bus);

  let activeVoices = 0;
  const hold = () => {
    activeVoices += 1;
  };
  const release = () => {
    activeVoices -= 1;
    if (activeVoices === 0) {
      master.disconnect();
    }
  };

  // きらめきの粒。減衰だけで輪郭を作り、アタックは立てない。
  // 硬い打撃音を混ぜると「キラキラ」ではなく「ガシャン」に寄ってしまう。
  const bell = (freq: number, at: number, length: number, level: number) => {
    const start = now + at;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);

    // 倍音を1本だけ薄く重ねて、金属的な明るさを足す
    const shine = ctx.createOscillator();
    shine.type = 'sine';
    shine.frequency.setValueAtTime(freq * 2.76, start); // 鐘に近い非整数倍
    const shineGain = ctx.createGain();
    shineGain.gain.value = 0.18;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);

    osc.connect(gain);
    shine.connect(shineGain);
    shineGain.connect(gain);
    gain.connect(master);

    hold();
    osc.onended = () => {
      osc.disconnect();
      shine.disconnect();
      shineGain.disconnect();
      gain.disconnect();
      release();
    };
    osc.start(start);
    shine.start(start);
    osc.stop(start + length + 0.05);
    shine.stop(start + length + 0.05);
  };

  // 土台の和音。C6 の add9 で、濁らずに広がる明るさを作る。
  const chord = [1046.5, 1174.7, 1318.5, 1568.0, 2093.0]; // C6 D6 E6 G6 C7
  chord.forEach((freq, index) => bell(freq, index * 0.035, span * 0.95, 0.26));

  // 降りそそぐ粒。ペンタトニックだけを使い、どこで重なっても濁らせない。
  const grains = [
    1046.5, 1318.5, 1568.0, 1760.0, 2093.0, 2637.0, 3136.0, 3520.0, 4186.0,
  ];
  const grainCount = 22;
  for (let i = 0; i < grainCount; i += 1) {
    const freq = grains[(i * 3 + (i % 2)) % grains.length];
    const at = 0.04 + (i / grainCount) * span * 0.8;
    // 後半ほど小さく、遠ざかりながら降り続けるように聞かせる
    const fade = 1 - (i / grainCount) * 0.55;
    bell(freq, at, span * 0.3, 0.15 * fade);
  }

  // 上へ抜けるスイープ。粒の裏で立ち上がり、視界が開ける感じを作る。
  const sweep = ctx.createOscillator();
  sweep.type = 'triangle';
  sweep.frequency.setValueAtTime(520, now);
  sweep.frequency.exponentialRampToValueAtTime(3400, now + span * 0.45);
  const sweepGain = ctx.createGain();
  sweepGain.gain.setValueAtTime(0.0001, now);
  sweepGain.gain.exponentialRampToValueAtTime(0.14, now + 0.08);
  sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + span * 0.5);
  const sweepTone = ctx.createBiquadFilter();
  sweepTone.type = 'lowpass';
  sweepTone.frequency.value = 5200;
  sweep.connect(sweepTone);
  sweepTone.connect(sweepGain);
  sweepGain.connect(master);
  hold();
  sweep.onended = () => {
    sweep.disconnect();
    sweepTone.disconnect();
    sweepGain.disconnect();
    release();
  };
  sweep.start(now);
  sweep.stop(now + span * 0.55);

  // 空気のきらめき。高いところだけ残したノイズを長く薄く伸ばす。
  const air = makeNoise(ctx, span * 0.9, 1.4);
  const airFilter = ctx.createBiquadFilter();
  airFilter.type = 'highpass';
  airFilter.frequency.value = 4200;
  const airGain = ctx.createGain();
  airGain.gain.setValueAtTime(0.0001, now);
  airGain.gain.exponentialRampToValueAtTime(0.16, now + 0.05);
  airGain.gain.exponentialRampToValueAtTime(0.0001, now + span * 0.9);
  air.connect(airFilter);
  airFilter.connect(airGain);
  airGain.connect(master);
  hold();
  air.onended = () => {
    air.disconnect();
    airFilter.disconnect();
    airGain.disconnect();
    release();
  };
  air.start(now);

  // 足元の芯。フィーバーでも body が無いと軽く聞こえるので、短く一発だけ置く。
  const body = ctx.createOscillator();
  body.type = 'sine';
  body.frequency.setValueAtTime(160, now);
  body.frequency.exponentialRampToValueAtTime(62, now + 0.24);
  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(0.0001, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.5, now + 0.01);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
  body.connect(bodyGain);
  bodyGain.connect(master);
  hold();
  body.onended = () => {
    body.disconnect();
    bodyGain.disconnect();
    release();
  };
  body.start(now);
  body.stop(now + 0.34);
};

// ニコニコボムの音「重いレーザーで撃ち抜く」
// 低音のこもった唸りを土台に、高いところから一気に落ちるノコギリ波の
// スイープを重ねてレーザーの筋を作り、最後に破壊の炸裂と金属的な余韻を足す。
// ニコニコボム発動の合図。
// 高い倍音から一気に低音へ落ち、そのまま尾を引いて沈んでいく。
// 「トゥゥウウウーーー・・・ン」の、落ちる瞬間の速さと余韻の長さを別々に作る。
const playNicoChargeSound = () => {
  const ctx = getAudioContext();
  const bus = getSfxBus();
  if (!ctx || !bus) {
    return;
  }

  const now = ctx.currentTime;
  const master = ctx.createGain();
  // 主音と低音が重なる0.3〜0.8秒あたりが最も大きい。
  // 以前は合計が1.0を超えて割れるため0.72に抑えていたが、
  // 共通バスのリミッターが頭を押さえるようになったので上げられる。
  master.gain.value = 1.15;
  master.connect(bus);

  // 主音。最初の0.18秒で一気に落とし、そこからゆっくり沈める。
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(2600, now);
  osc.frequency.exponentialRampToValueAtTime(340, now + 0.18);
  osc.frequency.exponentialRampToValueAtTime(64, now + 1.05);

  // 共振の強いローパスを一緒に落として、こもっていく感じを出す
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 11;
  filter.frequency.setValueAtTime(7000, now);
  filter.frequency.exponentialRampToValueAtTime(260, now + 1.05);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.38, now + 0.02);
  gain.gain.setValueAtTime(0.38, now + 0.75);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + 1.35);

  // 落ちきったところに置く低い余韻。最後の「ン」にあたる。
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(120, now + 0.15);
  sub.frequency.exponentialRampToValueAtTime(44, now + 1.0);

  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.0001, now + 0.15);
  subGain.gain.exponentialRampToValueAtTime(0.42, now + 0.3);
  subGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);

  sub.connect(subGain);
  subGain.connect(master);
  sub.start(now + 0.15);
  sub.stop(now + 1.55);

  playVillainRoar(ctx, bus, now);
};

// 「ヴァアアアーン」。悪役の必殺技のような重い咆哮。
// 半音ずつ濁らせた低いノコギリ波の塊（短2度＋増4度の不協和）を歪ませ、
// フィルターを「ヴァ」で開いて「アアア」で保ち「ーン」で閉じる。足元に地鳴りと衝撃音、
// 後ろに長い反響を付けて、画面が暗転するような重さを出す。
const playVillainRoar = (ctx: AudioContext, bus: AudioNode, now: number) => {
  const roar = ctx.createGain();
  roar.gain.setValueAtTime(0.0001, now);
  roar.gain.exponentialRampToValueAtTime(0.5, now + 0.04);
  roar.gain.setValueAtTime(0.5, now + 0.7);
  roar.gain.exponentialRampToValueAtTime(0.0001, now + 1.7);

  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i += 1) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 4);
  }
  const drive = ctx.createWaveShaper();
  drive.curve = curve;
  drive.oversample = '2x';

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 6;
  filter.frequency.setValueAtTime(180, now);
  filter.frequency.exponentialRampToValueAtTime(2400, now + 0.12);
  filter.frequency.setValueAtTime(2400, now + 0.55);
  filter.frequency.exponentialRampToValueAtTime(220, now + 1.6);

  const pre = ctx.createGain();
  pre.gain.value = 0.22;
  pre.connect(drive);
  drive.connect(filter);
  filter.connect(roar);
  roar.connect(bus);

  // 長い反響。帰還付きの遅延を2本、左右にずらして洞窟のような広がりに
  const echoSend = ctx.createGain();
  echoSend.gain.value = 0.35;
  roar.connect(echoSend);
  [0.13, 0.21].forEach((time, i) => {
    const delay = ctx.createDelay(0.5);
    delay.delayTime.value = time;
    const fb = ctx.createGain();
    fb.gain.value = 0.5;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 1400;
    const pan = ctx.createStereoPanner();
    pan.pan.value = i === 0 ? -0.6 : 0.6;
    echoSend.connect(delay);
    delay.connect(tone);
    tone.connect(fb);
    fb.connect(delay);
    tone.connect(pan);
    pan.connect(bus);
  });

  // A1を根音に、短2度・増4度・オクターブを濁らせて重ねる。少しずつ音程が沈む
  const root = 55;
  [1, 1.0595, 1.4142, 2, 2.1189].forEach((ratio, i) => {
    [-9, 9].forEach((cents) => {
      const osc = ctx.createOscillator();
      osc.type = i === 2 ? 'square' : 'sawtooth';
      osc.detune.value = cents;
      osc.frequency.setValueAtTime(root * ratio * 1.06, now);
      osc.frequency.exponentialRampToValueAtTime(root * ratio, now + 0.25);
      osc.frequency.exponentialRampToValueAtTime(root * ratio * 0.9, now + 1.7);
      osc.connect(pre);
      osc.start(now);
      osc.stop(now + 1.75);
    });
  });

  // 「ヴ」の頭の衝撃。ノイズを短く叩き、低い正弦波をドンと落とす
  const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 900;
  noiseFilter.Q.value = 0.8;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.55;
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(bus);
  noise.start(now);

  const boom = ctx.createOscillator();
  boom.type = 'sine';
  boom.frequency.setValueAtTime(90, now);
  boom.frequency.exponentialRampToValueAtTime(30, now + 0.9);
  const boomGain = ctx.createGain();
  boomGain.gain.setValueAtTime(0.0001, now);
  boomGain.gain.exponentialRampToValueAtTime(0.7, now + 0.015);
  boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
  boom.connect(boomGain);
  boomGain.connect(bus);
  boom.start(now);
  boom.stop(now + 1.25);
};

// フランジャー。ごく短い遅延（数ms）をゆっくり揺らし、戻しを掛けて元の音と重ねる。
// 重なった音の山と谷が上下に流れて、「シュワー」とうねるきらめきになる。
const buildFlanger = (ctx: BaseAudioContext, input: AudioNode, output: AudioNode, wet = 0.5) => {
  const delay = ctx.createDelay(0.02);
  delay.delayTime.value = 0.0035;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.32;
  const depth = ctx.createGain();
  depth.gain.value = 0.0025;
  lfo.connect(depth);
  depth.connect(delay.delayTime);
  const feedback = ctx.createGain();
  feedback.gain.value = 0.55;
  const mix = ctx.createGain();
  mix.gain.value = wet;
  input.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(mix);
  mix.connect(output);
  lfo.start();
  return () => {
    try {
      lfo.stop();
    } catch {
      // すでに止まっている
    }
    [lfo, depth, delay, feedback, mix].forEach((node) => node.disconnect());
  };
};

// キラキラの余韻を鳴らす入口をつくる。乾いた音そのまま＋フランジャー＋コーラス＋リバーブ。
// 戻り値の input に音をつなぎ、release を鳴り終わったころに呼ぶ。
const buildShimmerBus = (ctx: BaseAudioContext, output: AudioNode, flanger = 0.5) => {
  const input = ctx.createGain();
  input.gain.value = 1;
  input.connect(output);
  const releaseFlanger = buildFlanger(ctx, input, output, flanger);
  const releaseSparkle = buildFeverSparkle(ctx, input, output);
  return {
    input,
    release: () => {
      releaseFlanger();
      releaseSparkle();
      input.disconnect();
    },
  };
};

// 鈴のような一粒。正弦波に、うっすら三角波の倍音を足す
const bellNote = (
  ctx: BaseAudioContext,
  dest: AudioNode,
  at: number,
  freq: number,
  level: number,
  ring: number,
) => {
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(level, at + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, at + ring);
  env.connect(dest);
  const body = ctx.createOscillator();
  body.type = 'sine';
  body.frequency.setValueAtTime(freq, at);
  body.connect(env);
  const shine = ctx.createOscillator();
  shine.type = 'triangle';
  shine.frequency.setValueAtTime(freq * 2, at);
  const shineGain = ctx.createGain();
  shineGain.gain.value = 0.18;
  shine.connect(shineGain);
  shineGain.connect(env);
  body.start(at);
  shine.start(at);
  body.stop(at + ring + 0.02);
  shine.stop(at + ring + 0.02);
};

// ニコニコボムの余韻に散らす音。明るい五音を高いところで使う
const NICO_SPARKLE_NOTES = [1047, 1175, 1319, 1568, 1760, 2093, 2349, 2637];

const playNicoSound = () => {
  const ctx = getAudioContext();
  const bus = getSfxBus();
  if (!ctx || !bus) {
    return;
  }

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 1.1;
  master.connect(bus);

  // 土台のサブベース。腹に来る重さを担当する
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(120, now);
  sub.frequency.exponentialRampToValueAtTime(32, now + 0.5);
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.0001, now);
  subGain.gain.exponentialRampToValueAtTime(0.5, now + 0.03);
  subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
  sub.connect(subGain);
  subGain.connect(master);
  sub.start(now);
  sub.stop(now + 0.7);

  // レーザーの本体。ノコギリ波を高音から急降下させ、
  // ローパスも一緒に閉じていくことで、太く貫くような筋になる
  const laser = ctx.createOscillator();
  laser.type = 'sawtooth';
  laser.frequency.setValueAtTime(1800, now);
  laser.frequency.exponentialRampToValueAtTime(70, now + 0.42);
  const laserFilter = ctx.createBiquadFilter();
  laserFilter.type = 'lowpass';
  laserFilter.frequency.setValueAtTime(4200, now);
  laserFilter.frequency.exponentialRampToValueAtTime(320, now + 0.45);
  laserFilter.Q.value = 9;
  const laserGain = ctx.createGain();
  laserGain.gain.setValueAtTime(0.0001, now);
  laserGain.gain.exponentialRampToValueAtTime(0.34, now + 0.02);
  laserGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  laser.connect(laserFilter);
  laserFilter.connect(laserGain);
  laserGain.connect(master);
  laser.start(now);
  laser.stop(now + 0.55);

  // 少しだけずらした二本目。うなりが出て音が太くなる
  const detune = ctx.createOscillator();
  detune.type = 'sawtooth';
  detune.frequency.setValueAtTime(1790, now);
  detune.frequency.exponentialRampToValueAtTime(69, now + 0.44);
  const detuneGain = ctx.createGain();
  detuneGain.gain.setValueAtTime(0.0001, now);
  detuneGain.gain.exponentialRampToValueAtTime(0.18, now + 0.03);
  detuneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  detune.connect(laserFilter);
  detuneGain.connect(master);
  detune.connect(detuneGain);
  detune.start(now);
  detune.stop(now + 0.55);

  // 着弾の破壊音。帯域を落としていくノイズで瓦礫感を出す
  const noiseLength = Math.floor(ctx.sampleRate * 0.55);
  const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseLength; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLength) ** 1.6;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.setValueAtTime(5200, now + 0.06);
  noiseFilter.frequency.exponentialRampToValueAtTime(260, now + 0.55);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, now + 0.05);
  noiseGain.gain.exponentialRampToValueAtTime(0.3, now + 0.09);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(master);
  noise.start(now + 0.05);

  // 金属的な余韻。break のあとに残る澄んだ響き
  [1244.5, 1661.2, 2489.0].forEach((freq, index) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + 0.14 + index * 0.03);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now + 0.14 + index * 0.03);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.17 + index * 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now + 0.14 + index * 0.03);
    osc.stop(now + 0.8);
  });

  // --- キラキラの余韻 ---
  // 破壊音のあと、明るい音の粒が降ってきて、うねりながら長く残る。
  // フランジャー・コーラス・リバーブを通すので、粒が消えたあともしばらく光っている。
  const shimmer = buildShimmerBus(ctx, master, 0.55);
  const rand = seededRandom(31);
  const start = now + 0.16;
  // 粒は最初に多く、だんだんまばらにする（約1.6秒）
  let t = 0;
  let gap = 0.035;
  while (t < 1.6) {
    const freq = NICO_SPARKLE_NOTES[Math.floor(rand() * NICO_SPARKLE_NOTES.length)];
    bellNote(ctx, shimmer.input, start + t, freq, 0.07 + rand() * 0.05, 0.5 + rand() * 0.5);
    t += gap;
    gap = Math.min(0.16, gap * 1.1);
  }
  // 下に敷く和音。ふくらんでから長く伸び、約2.2秒かけて消える
  [523, 659, 784, 988].forEach((freq, index) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);
    osc.detune.value = (index % 2 === 0 ? -1 : 1) * 6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.05, start + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 2.2);
    osc.connect(gain);
    gain.connect(shimmer.input);
    osc.start(start);
    osc.stop(start + 2.25);
  });
  window.setTimeout(shimmer.release, 4200);
};

// ゲームオーバーの音「ヴェ〜」
// 低いところから力なく下がって、途中でぐにゃりと揺れる。
// のこぎり波を2本わずかにずらして重ね、うなりで「濁った」感じを出す。
// ローパスを閉じながら落とすので、鳴り終わりはこもって沈む。
const playGameOverSound = () => {
  const ctx = getAudioContext();
  const bus = getSfxBus();
  if (!ctx || !bus) {
    return;
  }

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(bus);

  // 音程をぐにゃりと揺らす。一定に下がるだけだと「ダメな感じ」が出ない
  const wobble = ctx.createOscillator();
  wobble.type = 'sine';
  wobble.frequency.setValueAtTime(5.5, now);
  wobble.frequency.linearRampToValueAtTime(2.5, now + 0.9);
  const wobbleDepth = ctx.createGain();
  wobbleDepth.gain.setValueAtTime(11, now);
  wobbleDepth.gain.linearRampToValueAtTime(3, now + 0.9);
  wobble.connect(wobbleDepth);
  wobble.start(now);
  wobble.stop(now + 1);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1500, now);
  filter.frequency.exponentialRampToValueAtTime(260, now + 0.85);
  filter.Q.value = 3;
  filter.connect(master);

  // 本体。2本をわずかにずらして重ね、うなりで濁らせる
  [
    { hz: 196, detune: 0, level: 0.55 },
    { hz: 190, detune: 0, level: 0.4 },
  ].forEach(({ hz, level }) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(hz, now);
    // 力なく下がる。最後は元の半分以下まで落ちる
    osc.frequency.exponentialRampToValueAtTime(hz * 0.42, now + 0.85);
    wobbleDepth.connect(osc.frequency);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + 0.05);
    gain.gain.setValueAtTime(level, now + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);

    osc.connect(gain);
    gain.connect(filter);
    osc.start(now);
    osc.stop(now + 1);
  });

  // 下に敷く低音。沈む重さを足す
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(98, now);
  sub.frequency.exponentialRampToValueAtTime(44, now + 0.9);
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.0001, now);
  subGain.gain.exponentialRampToValueAtTime(0.45, now + 0.06);
  subGain.gain.exponentialRampToValueAtTime(0.0001, now + 1);
  sub.connect(subGain);
  subGain.connect(master);
  sub.start(now);
  sub.stop(now + 1.05);
};

// BGM。public/audio に置いた静的ファイルを HTMLAudioElement で鳴らす。
// 効果音は Web Audio で合成しているが、長い曲は素材を流したほうが素直。

// 起動時のサイコロで出た目（1〜6）ごとに、オープニング曲と本編の曲を組で持つ。
// タイトルと本編は必ず同じ目で揃える。曲が変わったことが遊ぶ前に分かるのと、
// 途中で世界が入れ替わらないのと、両方が要るため。
// 1番だけファイル名に番号が付かない（後から2〜6を足したので、既存名を温存した）。
const bgmSrcFor = (base: string, face: number) =>
  `${import.meta.env.BASE_URL}audio/${base}${face === 1 ? '' : `-${face}`}.mp3`;

// 曲ごとの音量。素材の大きさがそろっていないので、1番の曲の RMS に合わせて
// 個別に決めてある。ここをいじるときは耳ではなく実測で合わせること。
// 実測 RMS … 本編 0.1324 / 0.1220 / 0.1270 / 0.1171 / 0.1040 / 0.1195
//            タイトル 0.1350 / 0.1159 / 0.0981 / 0.1220 / 0.1248 / 0.1201
// 基準の 0.12 は効果音を潰さない程度に抑えた値（0.32 → 0.224 → 0.7倍 → 15%下げ → さらに10%下げ）。
const MAIN_BGM_VOLUMES: readonly number[] = [0.12, 0.1302, 0.1251, 0.1357, 0.1528, 0.133];
const TITLE_BGM_VOLUMES: readonly number[] = [0.12, 0.1398, 0.1651, 0.1328, 0.1298, 0.1349];

// いま選ばれている目。サイコロを振ったときに決まり、本編の曲もこの目で選ぶ
let titleFace = 1;

const mainBgmVolume = () => MAIN_BGM_VOLUMES[titleFace - 1] ?? MAIN_BGM_VOLUMES[0];
const titleBgmVolume = () => TITLE_BGM_VOLUMES[titleFace - 1] ?? TITLE_BGM_VOLUMES[0];

const setTitleFace = (face: number) => {
  titleFace = face;
};

// 同じファイルを指しているあいだは、音源は1つだけ作って使い回す。
// 目が変わって曲が差し替わったら、前の曲は止めておく。
// 本当に鳴らしたい曲の印。playTitleBgm などで付け、止めるときに外す。
// 無音の鍵開けが終わったとき、印のない曲は必ず止めてから音を戻す。
// 以前は「まだ muted なら止める」だけで、曲を差し替えた直後などに、
// 止まりきらないうちに音が戻って別の曲が一瞬鳴ることがあった。
const wantedAudio = new WeakSet<HTMLAudioElement>();

const pickBgm = (
  cache: Map<string, HTMLAudioElement>,
  current: HTMLAudioElement | null,
  src: string,
  volume: number,
): HTMLAudioElement => {
  let audio = cache.get(src);
  if (!audio) {
    audio = new Audio(src);
    audio.loop = true;
    audio.volume = volume;
    audio.preload = 'auto';
    cache.set(src, audio);
  }
  if (current && current !== audio) {
    wantedAudio.delete(current);
    current.pause();
    current.currentTime = 0;
  }
  return audio;
};

let bgm: HTMLAudioElement | null = null;
const bgmCache = new Map<string, HTMLAudioElement>();

const getBgm = (): HTMLAudioElement => {
  bgm = pickBgm(bgmCache, bgm, bgmSrcFor('main-bgm', titleFace), mainBgmVolume());
  return bgm;
};

const playBgm = () => {
  const audio = getBgm();
  wantedAudio.add(audio);
  // 自動再生を弾かれても致命的ではないので、失敗は握りつぶす
  void audio.play().catch(() => undefined);
};

const pauseBgm = () => {
  if (bgm) {
    wantedAudio.delete(bgm);
    bgm.pause();
  }
};

const stopBgm = () => {
  if (bgm) {
    wantedAudio.delete(bgm);
    bgm.pause();
    bgm.currentTime = 0;
  }
};

// クリアの前に、鳴っているBGM（本編・FEVER）を ms かけてすっと消す。消えたら止めて音量を戻しておく
const fadeOutBgms = (ms: number) => {
  clearFeverFade();
  const targets = [bgm, feverBgm].filter((audio): audio is HTMLAudioElement => !!audio && !audio.paused);
  targets.forEach((audio) => {
    const from = audio.volume;
    const base = audio === feverBgm ? FEVER_BGM_VOLUME : mainBgmVolume();
    const started = performance.now();
    const timer = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - started) / ms);
      audio.volume = Math.max(0, from * (1 - t));
      if (t >= 1) {
        window.clearInterval(timer);
        wantedAudio.delete(audio);
        audio.pause();
        audio.currentTime = 0;
        audio.volume = base;
      }
    }, 30);
  });
};

// タイトル画面のBGM。ゲームが始まったら止め、戻ってきたらまた鳴らす。
let titleBgm: HTMLAudioElement | null = null;
const titleBgmCache = new Map<string, HTMLAudioElement>();

const getTitleBgm = (): HTMLAudioElement => {
  titleBgm = pickBgm(titleBgmCache, titleBgm, bgmSrcFor('title-bgm', titleFace), titleBgmVolume());
  return titleBgm;
};

const playTitleBgm = () => {
  const audio = getTitleBgm();
  wantedAudio.add(audio);
  audio.muted = false; // 鍵開けの無音再生の途中でも、ここからは音を出す
  // 自動再生を弾かれても致命的ではないので、失敗は握りつぶす
  void audio.play().catch(() => undefined);
};

const stopTitleBgm = () => {
  if (titleBgm) {
    wantedAudio.delete(titleBgm);
    titleBgm.pause();
    titleBgm.currentTime = 0;
  }
};

// マップ画面のBGM。起動時のサイコロの目ごとに1曲（全ウォール共通）。
// 2026-10-13：ユーザーが用意した本番の曲「MAP BGM v1-F〜v6-F」に差し替え（1〜6の目）。
// 音量は本編1番の実効RMS（0.1338×0.12）にそろえた。実測 RMS … 0.1416 / 0.1869 / 0.1352 / 0.1421 / 0.1623 / 0.1435
const MAP_BGM_VOLUMES: readonly number[] = [0.1134, 0.0859, 0.1187, 0.113, 0.0989, 0.1119];
let mapBgm: HTMLAudioElement | null = null;
const mapBgmCache = new Map<string, HTMLAudioElement>();

const getMapBgm = (): HTMLAudioElement => {
  mapBgm = pickBgm(mapBgmCache, mapBgm, bgmSrcFor('map-bgm', titleFace), MAP_BGM_VOLUMES[titleFace - 1] ?? MAP_BGM_VOLUMES[0]);
  return mapBgm;
};

const stopMapBgm = () => {
  if (mapBgm) {
    wantedAudio.delete(mapBgm);
    mapBgm.pause();
    mapBgm.currentTime = 0;
  }
};

// --- タイトル ⇄ マップの曲の切り替え（2026-10-13）---
// 前の曲をフェードアウトしながら、次の曲を頭からフェードインする（同時に2曲が大きく鳴らない）。
const BGM_SWITCH_FADE_MS = 700;
// マップの曲を鳴らしているあいだは true。最初のタップでタイトル曲を鳴らす処理がこれを見て、マップの上で鳴らさない
let mapBgmOn = false;
const fadeTimers = new Map<HTMLAudioElement, number>();
const fadeAudio = (audio: HTMLAudioElement, to: number, ms: number, done?: () => void) => {
  const running = fadeTimers.get(audio);
  if (running !== undefined) window.clearInterval(running);
  const from = audio.volume;
  const started = performance.now();
  const timer = window.setInterval(() => {
    const t = Math.min(1, (performance.now() - started) / ms);
    audio.volume = Math.max(0, Math.min(1, from + (to - from) * t));
    if (t >= 1) {
      window.clearInterval(timer);
      fadeTimers.delete(audio);
      done?.();
    }
  }, 30);
  fadeTimers.set(audio, timer);
};
// 鳴っていればフェードアウトして止め、音量は元に戻しておく。鳴っていなければそのまま止める
const fadeOutAndStop = (audio: HTMLAudioElement | null, volume: number) => {
  if (!audio) return;
  wantedAudio.delete(audio);
  if (audio.paused) {
    audio.currentTime = 0;
    audio.volume = volume;
    return;
  }
  fadeAudio(audio, 0, BGM_SWITCH_FADE_MS, () => {
    if (wantedAudio.has(audio)) return; // フェード中にまた鳴らすことになった
    audio.pause();
    audio.currentTime = 0;
    audio.volume = volume;
  });
};
// 頭から、音量0でフェードインして鳴らす（すでに鳴っていれば、いまの音量から戻すだけ）
const fadeInPlay = (audio: HTMLAudioElement, volume: number) => {
  wantedAudio.add(audio);
  audio.muted = false;
  if (audio.paused) {
    audio.currentTime = 0;
    audio.volume = 0;
    void audio.play().catch(() => undefined);
  }
  fadeAudio(audio, volume, BGM_SWITCH_FADE_MS);
};
const mapBgmVolume = () => MAP_BGM_VOLUMES[titleFace - 1] ?? MAP_BGM_VOLUMES[0];
const switchToMapBgm = () => {
  mapBgmOn = true;
  fadeOutAndStop(titleBgm, titleBgmVolume());
  fadeInPlay(getMapBgm(), mapBgmVolume());
};
const switchToTitleBgm = () => {
  const fromMap = mapBgmOn;
  mapBgmOn = false;
  fadeOutAndStop(mapBgm, mapBgmVolume());
  if (fromMap) fadeInPlay(getTitleBgm(), titleBgmVolume());
  else playTitleBgm();
};

// 最初のユーザー操作の中で一度だけ呼ぶ、音の鍵開け。
// iPhone は、操作の最中に一度でも再生した音源しか、あとから自由に鳴らせない。
// タイトル曲はその場で本当に鳴らすのでよいが、本編とフィーバーの曲は
// 操作の外（ゲームの進行）から鳴らすことがあるので、ここで無音のまま
// 一度だけ再生して止めておく。効果音の AudioContext もここで起こす。
let audioUnlocked = false;

// 無音のまま一度だけ再生して止める。操作の中で呼べば、あとで操作の外から鳴らせる。
// 止める前に本当に鳴らし始めていた（muted が外れた）ときは、止めずにそのまま流す。

const primeAudio = (audio: HTMLAudioElement) => {
  if (!audio.paused) {
    return;
  }
  audio.muted = true;
  const settle = () => {
    if (!wantedAudio.has(audio)) {
      audio.pause();
      audio.currentTime = 0;
    }
    audio.muted = false;
  };
  void audio.play().then(settle, settle);
};

const unlockAudio = () => {
  getAudioContext();
  if (audioUnlocked) {
    return;
  }
  audioUnlocked = true;
  [getBgm(), getFeverBgm()].forEach(primeAudio);
};

// フィーバー中のBGM。本編と同じく public/audio の音源を流す。
// もとは「よろこびの歌」を Web Audio で合成した仮のものだったが、
// 音源が用意できたので HTMLAudioElement に寄せた。
const FEVER_BGM_SRC = `${import.meta.env.BASE_URL}audio/fever-bgm.mp3`;
let feverBgm: HTMLAudioElement | null = null;
let feverFade: number | null = null;

const FEVER_BGM_VOLUME = 0.128; // 効果音を潰さない程度に抑える（0.34 → 0.238 → 0.7倍 → 15%下げ → さらに10%下げ）

const getFeverBgm = (): HTMLAudioElement => {
  if (!feverBgm) {
    feverBgm = new Audio(FEVER_BGM_SRC);
    feverBgm.loop = true;
    feverBgm.volume = FEVER_BGM_VOLUME;
    feverBgm.preload = 'auto';
  }
  return feverBgm;
};

const clearFeverFade = () => {
  if (feverFade !== null) {
    window.clearInterval(feverFade);
    feverFade = null;
  }
};

const stopFeverBgm = () => {
  const audio = feverBgm;
  clearFeverFade();
  if (!audio) {
    return;
  }
  wantedAudio.delete(audio);
  if (audio.paused) {
    audio.currentTime = 0;
    audio.volume = FEVER_BGM_VOLUME;
    return;
  }
  // ぶつ切りにせず、100ms ほどかけて絞ってから止める。
  // フィーバーの終わりは本編BGMへ戻る場面なので、切れ目が目立つ。
  const steps = 8;
  let done = 0;
  feverFade = window.setInterval(() => {
    done += 1;
    audio.volume = Math.max(0, FEVER_BGM_VOLUME * (1 - done / steps));
    if (done >= steps) {
      clearFeverFade();
      audio.pause();
      audio.currentTime = 0;
      audio.volume = FEVER_BGM_VOLUME;
    }
  }, 12);
};

const playFeverBgm = () => {
  const audio = getFeverBgm();
  // 絞っている途中に入り直すことがあるので、音量を戻してから鳴らす
  clearFeverFade();
  audio.volume = FEVER_BGM_VOLUME;
  audio.currentTime = 0;
  wantedAudio.add(audio);
  // 自動再生を弾かれても致命的ではないので、失敗は握りつぶす
  void audio.play().catch(() => undefined);
};

// 虹ボムの「使う？」が出ているあいだだけ、鳴っているBGMを半分に絞る。
// 3秒で決める場面なので、曲が同じ音量のままだと判断の邪魔になる。
// 効果音側は絞らない。ゲージの刻みと破裂音は前に出したい。
const RAINBOW_DUCK = 0.5;

const setBgmDuck = (on: boolean) => {
  const scale = on ? RAINBOW_DUCK : 1;
  if (bgm) {
    bgm.volume = mainBgmVolume() * scale;
  }
  if (titleBgm) {
    titleBgm.volume = titleBgmVolume() * scale;
  }
  // フィーバーBGMを絞っている最中は、そのフェードに任せる
  if (feverBgm && feverFade === null) {
    feverBgm.volume = FEVER_BGM_VOLUME * scale;
  }
};

// 虹ボムの保存データ。既存ユーザーは値が無いので、すべて 0 から始まる。
const RAINBOW_KEYS = {
  total: 'sainome-cleared-total', // 履歴消去ブロック数（生涯累計・増えるだけ）
  stock: 'sainome-rainbow-stock', // 所持数 0〜3
  progress: 'sainome-rainbow-progress', // 支給用カウンター。支給ごとに閾値ぶん減る
} as const;

const loadNumber = (key: string): number => {
  try {
    const saved = Number(window.localStorage.getItem(key));
    return Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
  } catch {
    return 0;
  }
};

const saveNumber = (key: string, value: number) => {
  try {
    window.localStorage.setItem(key, String(Math.max(0, Math.floor(value))));
  } catch {
    // 保存できなくても遊べる。プライベートモードなどで落とさない
  }
};

// ストーリーモードの追加に合わせて、それまでのスコアと虹ボムを一度だけ初期化する。
// 印を残すので、2回目以降の起動では消さない。
const RESET_FLAG_KEY = 'sainome-reset-story-v1';
try {
  if (!window.localStorage.getItem(RESET_FLAG_KEY)) {
    [BEST_SCORES_KEY, ...Object.values(RAINBOW_KEYS)].forEach((key) =>
      window.localStorage.removeItem(key),
    );
    window.localStorage.setItem(RESET_FLAG_KEY, '1');
  }
} catch {
  // 保存が使えない環境では、そもそも持ち越すものがない
}

// --- ストーリーモード ---
// 失われた7つの「チカラ」（5種の特殊ボム・フィーバー・虹ボム）を集める冒険。
// 序盤の4コロでは特殊ボムもフィーバーも虹ボムも出さず、
// 「7を作る → 7を続けて作る → 敵の隣で7を作る → 敵に何度も7を当てる」を順に覚えてもらう。
// 進み具合。「クリア済みの一番先のメン＋1」を保存する（0 は何もクリアしていない）。
// 0メン（チュートリアル）を足したので、旧キー（1メン始まり）から一度だけ引き継ぐ。
const STORY_PROGRESS_KEY = 'sainome-story-progress';
const STORY_OLD_KEY = 'sainome-story-cleared';
const loadStoryCleared = (): number => {
  const saved = loadNumber(STORY_PROGRESS_KEY);
  if (saved > 0) {
    return saved - 1;
  }
  const old = loadNumber(STORY_OLD_KEY);
  return old > 0 ? old : -1;
};
const saveStoryCleared = (value: number) => saveNumber(STORY_PROGRESS_KEY, value + 1);
type StoryStage = {
  name: { ja: string; en: string };
  goal: StoryGoal;
  enemies: Array<{ x: number; y: number; value: number }>;
};
const STORY_STAGES: StoryStage[] = [
  // 0メン「チュートリアル」。操作をお手本で3回見せてから、自分で5回7を作ればクリア
  { name: { ja: 'チュートリアル', en: 'Tutorial' }, goal: STORY_GOALS[0], enemies: [] },
  // 1コロ「セヴン目」。7を作って消すだけ。セヴン目1回で200点なので、およそ10回
  { name: { ja: 'セヴン目', en: 'Seven' }, goal: STORY_GOALS[1], enemies: [] },
  // 2コロ「チェイン目」。消えて落ちた先でもう一度7ができる（2連鎖以上）を2回
  { name: { ja: 'チェイン目', en: 'Chain' }, goal: STORY_GOALS[2], enemies: [] },
  // 3メン「スーパー1」。ここで習得するチカラ。1を5つつなげると消える。
  // お手本 → やってみて2回 → ミッション（わちゃわちゃした盤面で3回）
  { name: { ja: 'スーパー1', en: 'Super 1' }, goal: STORY_GOALS[3], enemies: [] },
  // 4メン「コイツメ」。コイツメの倒し方のチュートリアル。
  // お手本 → やってみて2回 → ミッション（コイツメを3体倒す）
  { name: { ja: 'コイツメ', en: 'Koitsume' }, goal: STORY_GOALS[4], enemies: [] },
  // 5メン「スラッシュ3ボム」。ひっさつメ・スラッシュ3を伝授される。
  // お手本 → 技の特長をひとこと → やってみて2回 → ミッション（わちゃわちゃした盤面で3回）
  { name: { ja: 'スラッシュ3', en: 'Slash 3' }, goal: STORY_GOALS[5], enemies: [] },
  // 6メン「ダーメ」（旧ダメ）。ダーメの登場と倒し方のチュートリアル。
  // お手本 → やってみて2回 → ミッション（ダーメを2体倒す。盤面には最大2体まで）
  { name: { ja: 'ダーメ', en: 'Dame' }, goal: STORY_GOALS[6], enemies: [] },
  // 7メン「スクウェア4」。ひっさつメ・スクウェア4を習得する。
  // お手本 → 技の特長をひとこと → やってみて2回 → ミッション（わちゃわちゃした盤面で3回）
  { name: { ja: 'スクウェア4', en: 'Square 4' }, goal: STORY_GOALS[7], enemies: [] },
  // 8メン「ダメダ～メ 現る！」。コイツメとダーメがこれまでより多く並ぶ。全部取り除けばクリア
  {
    name: { ja: 'ダメダ～メ 現る！', en: 'Dame Swarm!' },
    goal: STORY_GOALS[8],
    enemies: [
      { x: 0, y: ROWS - 2, value: DAME },
      { x: 1, y: ROWS - 2, value: KOITSUME },
      { x: 2, y: ROWS - 2, value: DAME },
      { x: 3, y: ROWS - 2, value: KOITSUME },
      { x: 4, y: ROWS - 2, value: DAME },
      { x: 5, y: ROWS - 2, value: KOITSUME },
      { x: 6, y: ROWS - 2, value: DAME },
      { x: 1, y: ROWS - 3, value: KOITSUME },
      { x: 3, y: ROWS - 3, value: DAME },
      { x: 5, y: ROWS - 3, value: KOITSUME },
    ],
  },
  // 9メン「ストレイト6」。ひっさつメ・ストレイト6を習得する。
  // お手本 → 技の特長をひとこと → やってみて2回 → ミッション（わちゃわちゃした盤面で3回）
  { name: { ja: 'ストレイト6', en: 'Straight 6' }, goal: STORY_GOALS[9], enemies: [] },
  // 10メン「ヒドイメ 現る！」。ある程度積み上がった盤面から始まり、
  // 積み上がったメ4つを奥からぶち破って、2×2のヒドイメが現れる。倒せばクリア
  { name: { ja: 'ヒドイメ 現る！', en: 'Hidoime Appears!' }, goal: STORY_GOALS[10], enemies: [] },
  // 11メン「ニコニコボム」。チカラ『ニコニコボム』を習得する。
  // 黒いニコニコメを2つくっつけると、盤面の2と5がぜんぶ消える。
  // お手本 → やってみて2回 → ミッション（ニコニコボムを2回）
  { name: { ja: 'ニコニコボム', en: 'Nico Bomb' }, goal: STORY_GOALS[11], enemies: [] },
  // 12メン「ヒドイメ ふたたび！」。ニコニコメが出やすい盤面でヒドイメを倒すミッション
  { name: { ja: 'ヒドイメ ふたたび！', en: 'Hidoime Returns!' }, goal: STORY_GOALS[12], enemies: [] },
  // 13メン「FEVER」。チカラ『FEVER』を習得する。ゲージがたまると消える範囲が広がる。
  // コイツメ・ダーメ・ヒドイメを1体ずつ、ひととおり倒せばクリア
  { name: { ja: 'FEVER', en: 'FEVER' }, goal: STORY_GOALS[13], enemies: [] },
  // 14メン「つぎつぎ 現る！」。応用編。コイツメ → ダーメ → ヒドイメの順に、倒すたびに次が現れる
  { name: { ja: 'つぎつぎ 現る！', en: 'Here They Come!' }, goal: STORY_GOALS[14], enemies: [] },
  // 15メン「虹ボム」。絶体絶命の盤面から始まり、チカラ『虹ボム』を習得する。
  // てっぺんまで積み上がって「使う？」が出たら、虹ボムを押して助かればクリア
  { name: { ja: '虹ボム', en: 'Rainbow Bomb' }, goal: STORY_GOALS[15], enemies: [] },
  // 16メン「ヒドイメ 大行進！」。ある程度積み上がった盤面から始まり、
  // 合計5つ消したあとは、消すたびに30%でヒドイメが1体ずつ降ってくる（全部で3体）。3体とも倒せばクリア
  { name: { ja: 'ヒドイメ 大行進！', en: 'Hidoime Parade!' }, goal: STORY_GOALS[16], enemies: [] },
  // 17メン「ベラボウメ 現る！」。積み上がった盤面の下の3×3を弾き飛ばして、3×3のベラボウメが居座る。
  // 目が9つあり、となりで7を作るたびに1つずつつぶれる。9つぜんぶつぶせばクリア
  { name: { ja: 'ベラボウメ 現る！', en: 'Berabome Appears!' }, goal: STORY_GOALS[17], enemies: [] },
  // 18メン「デタラメ 現る！」。1列を縦に占める闇のスライム。目からビームで通常サイをコイツメ・ダーメに変え、
  // 3手ごとに1段伸びる（上のサイは吸い込む）。すべての段の目を消せばクリア
  { name: { ja: 'デタラメ 現る！', en: 'Detarame Appears!' }, goal: STORY_GOALS[18], enemies: [] },
  // 19メン「みんな 現る！」。いままでの敵が総出演。コイツメ・ダーメ → ヒドイメ →
  // ラストはベラボウメとデタラメのダブル出演。3つの段をぜんぶ越えればクリア
  { name: { ja: 'みんな 現る！', en: 'All Stars!' }, goal: STORY_GOALS[19], enemies: [] },
];
// Campaign IDs are stable save identities. Scripted lessons/enemies keep their
// original runtime IDs, so their complete behavior and recovery flows are reused.
for (const mission of ALL_MISSIONS) { // 表もウラも、面ごとの台本（goal）をここで用意する
  STORY_STAGES[mission.stage] = {
    name: { ja: mission.title, en: mission.title },
    goal: missionGoalFor(mission),
    enemies: mission.enemies.map(e => ({ x: e.x, y: e.y ?? ROWS - 2, value: e.kind === 'dame' ? DAME : KOITSUME })),
  };
}
// This module instance belongs to an isolated, gallery-only practice iframe.
const enemyPractice = getEnemyPractice();
const you456Practice = !!enemyPractice && new URLSearchParams(location.search).get('skill') === 'you456';
const enjoPractice = enemyPractice?.enemy === 'enjo';
const enjoRows:2|3 = new URLSearchParams(location.search).get('walls')==='3'?3:2;
const enjoPracticeFever = enjoPractice && new URLSearchParams(location.search).get('fever')==='1';
const hyoketsuPractice = enemyPractice?.enemy === 'hyoketsume';
const sanzPractice = enemyPractice?.enemy === 'sanzapparaname';
if (enemyPractice && enemyPractice.stage === 8) {
  STORY_STAGES[8] = {
    name: { ja: you456Practice ? '456You!' : enemyPractice.name, en: you456Practice ? '456You!' : enemyPractice.enemy },
    goal: { type: 'defeat' },
    enemies: you456Practice ? [{x:2,y:9,value:KOITSUME},{x:6,y:11,value:DAME}] : hyoketsuPractice ? [{x:1,y:ROWS-3,value:KOITSUME},{x:5,y:ROWS-3,value:DAME},{x:3,y:ROWS-3,value:-7}] : [{ x: 3, y: ROWS - 2, value: enemyPractice.enemy === 'dame' ? DAME : KOITSUME }],
  };
}
const STORY_POWER_COUNT = 7;
// コロえらびの枠の数（横3列×縦8段）。まだないメンの枠は、鍵付きのグレーで埋める
const STAGE_SELECT_SLOTS = 24;
// メンをクリアした瞬間からのサイカのひとこと（ランダムに1つ）
const CLEAR_LINES = ['やった〜‼︎', 'うしっ‼︎', 'いぇ〜い‼︎'];

// --- 3メン：スパ1ボムの練習 ---
const SPA_STAGE = 3;
// 呼び名の決まり：サイノメ同士でつくる技（スーパー1など4種）は「ひっさつメ」と呼ぶ。
// 「ボム」と呼ぶのは虹ボムとニコニコボムの2つだけ。画面に出す文字もこれに従う。
// （コードの中の BombKind・BOMB_CALLS などの名前は、昔の呼び方のまま残している）
// ひっさつメの正式な呼び名。チュートリアルでは略さずにこちらを使う。
// 「ストレイト」はこだわりの表記。ストレートと書かない。
// 遊んでいる最中の掛け声（BOMB_CALLS の スパ1！ など）は短いままでよい。
const BOMB_FULL_NAMES: Record<BombKind, { ja: string; en: string }> = {
  spa1: { ja: 'スーパー1', en: 'Super 1' },
  sla3: { ja: 'スラッシュ3', en: 'Slash 3' },
  squ4: { ja: 'スクウェア4', en: 'Square 4' },
  str6: { ja: 'ストレイト6', en: 'Straight 6' },
};
// ひっさつメの教室の書き出し。吹き出しを区切って順に見せる。
//   ひっさつメのスーパー1を教えるよ！
//   → 同じサイノメの組みあわせで発動する → 『ひっさつメ』があるよ
//   → まずは[1]を5つ合体させる（how：技ごとの作り方）
//   → 『スーパー1』を伝授しちゃうね！
// 最初の技（スーパー1）だけ「ひっさつメの〜」「『スーパー1』」と分けて言う。
// 2つめからは『ひっさつメ・スラッシュ3』とひと続きの名前で呼ぶ。
type Line = { ja: string; en: string };
// ひっさつメの教室は、すべてゾロメ仙人が受け持つ
const bombOpening = (kind: BombKind, how: Line, first: boolean): Line[] => {
  const name = BOMB_FULL_NAMES[kind];
  return [
    first
      ? { ja: 'ひっさつメを授けようぞ！', en: 'Learn a special move from me!' }
      : { ja: `ひっさつメ・${name.ja}を授けようぞ！`, en: `Me again. Learn Special Move: ${name.en}!` },
    { ja: '同じ目の組みあわせが\nひっさつメになるのじゃ', en: 'Matching dice creates a special move.' },
    how,
    { ja: 'まずはワシが手本を見せるかの', en: 'Watch my demonstration.' },
  ];
};

const SPA_LINES: BombLessonLines = {
  opening: bombOpening('spa1', { ja: '[1]を5つつなげば\nひっさつメ・スーパー1じゃ！', en: 'Link five [1] to unleash Super 1!' }, true),
  go: { ja: 'さあ [1]を5つつなげるのじゃ', en: 'Ready? Link five [1]!' },
  again: { ja: 'もう一度 [1]を5つじゃ！', en: 'Once more! Link five [1]!' },
  nice: { ja: 'うむ その調子じゃ！', en: 'Super 1! Keep going!' },
  miss: { ja: '[1]のとなりに[1]をくっつけるのじゃ', en: 'Put the [1] next to the other [1]!' },
  wipe: { ja: 'きれいにするぞい\nもう一度じゃ', en: "Let's clear it and retry!" },
  mission: { ja: '仕上げじゃ\nスーパー1を3回出してみよ！', en: 'Mission! Pull off Super 1 three times!' },
  missionNice: { ja: 'よいぞ\nあと少しじゃ！', en: 'Super 1! Almost there!' },
  reset: { ja: 'いったん消すとしようかの', en: 'Let me clear it and start over!' },
};

// --- 3メン・4メンのミッション ---
const KOI_STAGE = 4;
const KOI_PRACTICE = 2; // 4メンの「やってみて」の回数
// この段（下から数えて7段目）まで積み上がったら、次の落下で盤面を全部消して置き直す。
// ミッションはやり直しではなく続きから。数えた回数はそのまま残す。
const MISSION_RESET_ROW = ROWS - 7;
const stackReachesHeight = (board: Board, height: number) =>
  board.some((row, y) => y <= ROWS - height && row.some((cell) => Boolean(cell)));
const stackTooHigh = (board: Board) => stackReachesHeight(board, ROWS - MISSION_RESET_ROW);
// 2-2だけは9段で救済。5段からは新しく抽選する3の重みを3→4へ。
// NEXTとして既に見せた組は保持し、生成ごとに判定するので他面へ補助が残らない。
const WALL22_STAGE = 29;
const wall22DiceWeight = (stage: number | null, board: Board) =>
  stage === WALL22_STAGE && stackReachesHeight(board, 5) ? 4 : STORY_BOOST_WEIGHT;

// ミッションの「わちゃわちゃ」した盤面。下の段に高さのばらばらな山を作り、
// 山は低めにしておく（3段まで）。高いと、ブロックを1つ縦に置いただけで
// MISSION_RESET_ROW に届いて盤面が置き直されてしまう。
// 上下左右のとなりで7にならないように目を振る。1 は仕込み以外には置かない。
// plant で仕込み（1の並びや敵）を置く。置けなければ振り直す。
const MESSY_FILL = [2, 3, 4, 5, 6];
const buildMessyBoard = (
  heights: () => number[],
  plant: (board: Board, tops: number[]) => void,
  fill: number[] = MESSY_FILL,
): Board => {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const board = emptyBoard();
    const h = heights();
    const tops = h.map((height) => ROWS - height); // 各列の一番上の山の y
    plant(board, tops);
    let ok = true;
    for (let y = ROWS - 1; y >= 0 && ok; y -= 1) {
      for (let x = 0; x < COLS && ok; x += 1) {
        if (y < tops[x] || board[y][x]) continue;
        const near = [board[y + 1]?.[x], board[y - 1]?.[x], board[y][x - 1], board[y][x + 1]]
          .filter((cell) => cell && cell.value > 0)
          .map((cell) => (cell as Cell).value);
        const choices = fill.filter((v) => near.every((n) => n + v !== 7));
        if (choices.length === 0) {
          ok = false;
          break;
        }
        const value = choices[Math.floor(Math.random() * choices.length)];
        board[y][x] = { id: `messy-${attempt}-${x}-${y}`, value, group: -500 - y * COLS - x };
      }
    }
    // 仕込みの隣が先に埋まっていた場合も含めて、盤面ぜんたいで7が無いか確かめ直す
    const sevenLeft = board.some((row, y) =>
      row.some((cell, x) => {
        if (!cell || cell.value <= 0) return false;
        const right = board[y][x + 1];
        const below = board[y + 1]?.[x];
        return (
          (!!right && right.value > 0 && right.value + cell.value === 7) ||
          (!!below && below.value > 0 && below.value + cell.value === 7)
        );
      }),
    );
    // 最初からひっさつメができている並びも捨てる（最初の着地で勝手に発動してしまう）
    if (ok && !sevenLeft && findAllBombs(board).length === 0) {
      return board;
    }
  }
  return emptyBoard();
};

const randomHeights = (min: number, max: number) =>
  Array.from({ length: COLS }, () => min + Math.floor(Math.random() * (max - min + 1)));

// 3メンのミッション。ばらばらの山の上に、1を3〜4つ横に並べた棚を仕込む。
// あと1〜2つ 1 をくっつければスーパー1ボムになる。
const buildSpaMissionBoard = (): Board => {
  const length = 3 + Math.floor(Math.random() * 2);
  const start = Math.floor(Math.random() * (COLS - length + 1));
  const shelf = 2 + Math.floor(Math.random() * 2); // 棚の高さ（1を含む）
  return buildMessyBoard(
    () => {
      const h = randomHeights(1, 3);
      for (let i = 0; i < length; i += 1) h[start + i] = shelf;
      return h;
    },
    (board, tops) => {
      for (let i = 0; i < length; i += 1) {
        const x = start + i;
        board[tops[x]][x] = { id: `spa-seed-${i}`, value: 1, group: -400 - i };
      }
    },
  );
};

// 5メンのミッション。3 をななめに2つ仕込み、3つめが乗る段を用意しておく。
// 埋める目に 3 と 1 は使わない（勝手にスラッシュ3やスーパー1ができないように）。
const buildSlaMissionBoard = (): Board => {
  const d = Math.random() < 0.5 ? 1 : -1;
  const s0 = d === 1 ? Math.floor(Math.random() * (COLS - 2)) : 2 + Math.floor(Math.random() * (COLS - 2));
  const low = 1 + Math.floor(Math.random() * 2); // いちばん低い 3 の段
  return buildMessyBoard(
    () => {
      const h = randomHeights(1, 3);
      h[s0] = low;
      h[s0 + d] = low + 1;
      h[s0 + 2 * d] = low + 1;
      return h;
    },
    (board, tops) => {
      board[tops[s0]][s0] = { id: 'sla-seed-0', value: 3, group: -410 };
      board[tops[s0 + d]][s0 + d] = { id: 'sla-seed-1', value: 3, group: -411 };
    },
    [2, 4, 5, 6],
  );
};

// 4メンのミッション。ばらばらの山の上に、コイツメを3体のせる
const KOI_MISSION_ENEMIES = 3;
const buildKoiMissionBoard = (): Board => {
  const columns = [0, 1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5).slice(0, KOI_MISSION_ENEMIES);
  return buildMessyBoard(
    () => randomHeights(1, 2),
    (board, tops) => {
      columns.forEach((x, index) => {
        // 山のてっぺんの1つ上に乗せる。山そのものは下で埋まる
        const y = tops[x] - 1;
        board[y][x] = { id: `koi-${index}-${Math.random()}`, value: KOITSUME, group: -250 - index };
      });
    },
  );
};

const KOI_LINES = {
  intro: { ja: 'コイツメの倒し方を教えるよ！', en: 'Let me show you how to beat a Koitsume!' },
  demo: { ja: 'コイツメのとなりで7を作ると、いっしょに消えるよ！', en: 'Make 7 next to a Koitsume and it vanishes too!' },
  demoCleared: { ja: 'ねっ！コイツメも消えたでしょ', en: 'See? The Koitsume vanished too!' },
  go: { ja: 'それじゃ いくよ？コイツメのとなりで7を作ろう', en: 'Here we go! Make 7 next to a Koitsume!' },
  again: { ja: 'もう一回！コイツメのとなりで7！', en: 'Once more! Make 7 right beside it!' },
  miss: { ja: 'おしい！コイツメのすぐとなりで7を作って！', en: 'So close! Make 7 right beside the Koitsume!' },
  wipe: { ja: '全部消すね！もう一回！', en: "Let's clear it and retry!" },
  mission: { ja: 'ミッション！コイツメを3体やっつけよう！', en: 'Mission! Beat 3 Koitsume!' },
  nice: { ja: 'やっつけた！その調子！', en: 'Got one! Keep going!' },
  more: { ja: 'コイツメが来たよ！', en: 'Here come more Koitsume!' },
  reset: { ja: 'いったん消すとしよう', en: 'Let me clear it and start over!' },
};


// --- ひっさつメの教室（3メン＝スーパー1、5メン＝スラッシュ3、7メン＝スクウェア4、9メン＝ストレイト6） ---
// どれも「お手本 → やってみて（BOMB_PRACTICE 回）→ ミッション」の同じ段取りで進める。
// 技ごとに違うのは、盤面の仕込み方・落ちてくるブロック・セリフだけ。それを BOMB_LESSONS に並べる。
// スクウェア4・ストレイト6を足すときも、ここに1つ足すだけでよい。
const BOMB_PRACTICE = 2;
const SLA_STAGE = 5;

type BombLessonLines = {
  opening: Line[]; // お手本の前に、吹き出しを区切って順に見せる
  // 技の特長をひとことで。お手本で技が決まった直後に見せる（無い技は飛ばす）
  feature?: { ja: string; en: string };
  go: { ja: string; en: string };
  again: { ja: string; en: string };
  nice: { ja: string; en: string };
  miss: { ja: string; en: string };
  wipe: { ja: string; en: string };
  mission: { ja: string; en: string };
  missionNice: { ja: string; en: string };
  reset: { ja: string; en: string };
};
// 教室で教える技。ひっさつメ4種に、11メンのニコニコボムを加えたもの
type LessonKind = BombKind | 'nico' | 'thunder';
type BombLesson = {
  kind: LessonKind;
  value: number; // この技をつくる目。ミッションでは出やすくする
  lines: BombLessonLines;
  practiceBoard: (demo: boolean) => Board;
  practiceAlive: (board: Board) => boolean; // 仕込みが残っていて、続けて練習できるか
  piece: (id: number, demo: boolean) => Piece;
  missionBoard: () => Board;
};

// 縦一列のブロック。value の目を index の位置に入れ、残りの2つは
// 互いにも value とも7にならない目（pairs から1つずつ）で埋める
const makeLessonPiece = (id: number, value: number, index: number, pairs: number[][]): Piece => {
  const values = pairs.map((pair) => pair[Math.floor(Math.random() * pair.length)]);
  values.splice(index, 0, value);
  return {
    id,
    x: Math.floor((COLS - 3) / 2),
    y: 0,
    matrix: values.map((v) => [null, v, null]),
  };
};

const SPA_LESSON: BombLesson = {
  kind: 'spa1',
  value: 1,
  lines: SPA_LINES,
  // 底に1を4つ並べる。お手本は左端から、やってみては左右のどこかに
  practiceBoard: (demo) => {
    const board = emptyBoard();
    const start = demo ? 0 : Math.floor(Math.random() * (COLS - 3));
    for (let i = 0; i < 4; i += 1) {
      board[ROWS - 1][start + i] = { id: `spa-${i}`, value: 1, group: -400 - i };
    }
    return board;
  },
  practiceAlive: (board) => board.some((row) => row.some((cell) => cell?.value === 1)),
  // 1 と組んで7になる 6 は入れない。お手本は1を一番下に入れて、真下へ落とすだけで5つになる
  piece: (id, demo) => makeLessonPiece(id, 1, demo ? 2 : Math.floor(Math.random() * 3), [[2, 5], [3, 4]]),
  missionBoard: () => buildSpaMissionBoard(),
};

// スラッシュ3の階段。3 をななめに2つ置き、3つめが乗る段まで積んでおく。
//   d=1 なら右上がり、d=-1 なら左上がり。b はいちばん低い 3 の列
// 段の土台は 3 とも互いとも7にならない目（1/6 から1つ、2/5 から1つ）で埋める
const buildSlashStairs = (b: number, d: number): Board => {
  const board = emptyBoard();
  const filler = (x: number, y: number, avoid: number[]) => {
    const choices = [1, 2, 5, 6].filter((v) => avoid.every((n) => n + v !== 7));
    const value = choices[Math.floor(Math.random() * choices.length)];
    board[y][x] = { id: `sla-base-${x}-${y}`, value, group: -420 - y * COLS - x };
    return value;
  };
  board[ROWS - 1][b] = { id: 'sla-seed-0', value: 3, group: -410 };
  const f1 = filler(b + d, ROWS - 1, []);
  board[ROWS - 2][b + d] = { id: 'sla-seed-1', value: 3, group: -411 };
  const f2 = filler(b + 2 * d, ROWS - 1, [f1]);
  filler(b + 2 * d, ROWS - 2, [f2]);
  return board;
};

const SLA_LINES: BombLessonLines = {
  opening: bombOpening(
    'sla3',
    { ja: '[3]をななめに3つつなげば\nスラッシュ3じゃ！', en: 'Link three [3] diagonally for Slash 3!' },
    false,
  ),
  feature: {
    ja: 'ななめの列を\nはしからはしまで切りさくのじゃ！',
    en: 'Slash 3 slices the whole diagonal, edge to edge!',
  },
  go: { ja: '[3]をななめに3つつなげてみよ', en: 'Ready? Line up three [3] diagonally!' },
  again: { ja: 'もう一度 [3]をななめに3つじゃ！', en: 'Once more! Three [3] on a diagonal!' },
  nice: { ja: 'うむ その調子じゃ！', en: 'Slash 3! Keep going!' },
  miss: { ja: '[3]がななめにつながるところへ置くのじゃ', en: 'Put the [3] where it joins the diagonal!' },
  wipe: { ja: 'きれいにするぞい\nもう一度じゃ', en: "Let's clear it and retry!" },
  mission: { ja: '仕上げじゃ\nスラッシュ3を3回出してみよ！', en: 'Mission! Pull off Slash 3 three times!' },
  missionNice: { ja: 'よいぞ\nあと少しじゃ！', en: 'Slash 3! Almost there!' },
  reset: { ja: 'いったん消すとしようかの', en: 'Let me clear it and start over!' },
};

const SLA_LESSON: BombLesson = {
  kind: 'sla3',
  value: 3,
  lines: SLA_LINES,
  // お手本は左から右上がりの階段。やってみては向きも場所もばらばら
  practiceBoard: (demo) => {
    if (demo) return buildSlashStairs(1, 1);
    const d = Math.random() < 0.5 ? 1 : -1;
    const b = d === 1 ? Math.floor(Math.random() * (COLS - 2)) : 2 + Math.floor(Math.random() * (COLS - 2));
    return buildSlashStairs(b, d);
  },
  practiceAlive: (board) =>
    board.reduce((sum, row) => sum + row.filter((cell) => cell?.value === 3).length, 0) >= 2,
  // 3 と組んで7になる 4 は入れない。お手本は3を一番下に入れて、階段のてっぺんへ落とす
  piece: (id, demo) => makeLessonPiece(id, 3, demo ? 2 : Math.floor(Math.random() * 3), [[1, 6], [2, 5]]),
  missionBoard: () => buildSlaMissionBoard(),
};

// スクウェア4のLの字。4 を3つ置き、空いた角に4を落とすと2×2の四角になる。
//   b は左の列。tall に2段目の4を置き、もう片方の列の2段目が落とし先
const SQU_STAGE = 7;
const buildSquareSeed = (b: number, tall: number): Board => {
  const board = emptyBoard();
  const seed = (x: number, y: number, i: number) => {
    board[y][x] = { id: `squ-seed-${i}`, value: 4, group: -430 - i };
  };
  seed(b, ROWS - 1, 0);
  seed(b + 1, ROWS - 1, 1);
  seed(tall, ROWS - 2, 2);
  return board;
};

// 7メンのミッション。低い棚の上に 4 をLの字に3つ仕込む。
// 埋める目に 1・3・4 は使わない（勝手に別のひっさつメができないように）
const buildSquMissionBoard = (): Board => {
  const b = Math.floor(Math.random() * (COLS - 1));
  const tall = Math.random() < 0.5 ? b : b + 1;
  const shelf = 1 + Math.floor(Math.random() * 2); // 4 の並ぶ段（下から数えた高さ）
  return buildMessyBoard(
    () => {
      const h = randomHeights(1, 3);
      h[b] = shelf;
      h[b + 1] = shelf;
      return h;
    },
    (board, tops) => {
      board[tops[b]][b] = { id: 'squ-seed-0', value: 4, group: -430 };
      board[tops[b + 1]][b + 1] = { id: 'squ-seed-1', value: 4, group: -431 };
      board[tops[tall] - 1][tall] = { id: 'squ-seed-2', value: 4, group: -432 };
    },
    [2, 5, 6],
  );
};

const SQU_LINES: BombLessonLines = {
  opening: bombOpening(
    'squ4',
    { ja: '[4]を2×2の四角にすれば\nスクウェア4じゃ！', en: 'Make a 2×2 square of [4] for Square 4!' },
    false,
  ),
  feature: {
    ja: '四角につながる[4]も\nまとめて消すのじゃ！',
    en: 'Square 4 also clears every [4] touching the square!',
  },
  go: { ja: 'さあ [4]で四角を作ってみよ', en: 'Ready? Make a square of [4]!' },
  again: { ja: 'もう一度 [4]で四角じゃ！', en: 'Once more! A square of [4]!' },
  nice: { ja: 'うむ その調子じゃ！', en: 'Square 4! Keep going!' },
  miss: { ja: '[4]が四角になるところへ置くのじゃ', en: 'Put the [4] where it makes a square!' },
  wipe: { ja: 'きれいにするぞい\nもう一度じゃ', en: "Let's clear it and retry!" },
  mission: { ja: '仕上げじゃ\nスクウェア4を3回出してみよ！', en: 'Mission! Pull off Square 4 three times!' },
  missionNice: { ja: 'よいぞ\nあと少しじゃ！', en: 'Square 4! Almost there!' },
  reset: { ja: 'いったん消すとしようかの', en: 'Let me clear it and start over!' },
};

const SQU_LESSON: BombLesson = {
  kind: 'squ4',
  value: 4,
  lines: SQU_LINES,
  // お手本は左の列に2段目。落とし先は真ん中（ブロックが出てくる列）
  practiceBoard: (demo) => {
    if (demo) return buildSquareSeed(2, 2);
    const b = Math.floor(Math.random() * (COLS - 1));
    return buildSquareSeed(b, Math.random() < 0.5 ? b : b + 1);
  },
  practiceAlive: (board) =>
    board.reduce((sum, row) => sum + row.filter((cell) => cell?.value === 4).length, 0) >= 3,
  // 4 と組んで7になる 3 は入れない。お手本は4を一番下に入れて、角へ落とす。
  // 4 を真ん中に入れると、どう回しても角に届かない（横にすると隣の2段目に乗ってしまう）。
  // だから4は上か下の端にだけ入れる。上なら半回転で下に来る
  piece: (id, demo) => makeLessonPiece(id, 4, demo || Math.random() < 0.5 ? 2 : 0, [[1, 6], [2, 5]]),
  missionBoard: () => buildSquMissionBoard(),
};

// ストレイト6の並び。底に 6 を横に3つ置き、その端のとなりへ6を落とすと4つ並ぶ。
//   start は3つ並びの左端。land が落とし先の列
const STR_STAGE = 9;
const buildStraightSeed = (start: number): Board => {
  const board = emptyBoard();
  for (let i = 0; i < 3; i += 1) {
    board[ROWS - 1][start + i] = { id: `str-seed-${i}`, value: 6, group: -440 - i };
  }
  return board;
};
// 3つ並びの右となりか左となり。盤の外になる側は選ばない
const straightLand = (start: number) => {
  const sides = [start - 1, start + 3].filter((x) => x >= 0 && x < COLS);
  return sides[Math.floor(Math.random() * sides.length)];
};

// 9メンのミッション。低い棚の上に 6 を横に3つ並べ、となりの列を1段低くしておく。
// そこへ6を落とすと4つ並ぶ
const buildStrMissionBoard = (): Board => {
  const start = Math.floor(Math.random() * (COLS - 2));
  const land = straightLand(start);
  const shelf = 1 + Math.floor(Math.random() * 2); // 6 の並ぶ段（下から数えた高さ）
  return buildMessyBoard(
    () => {
      const h = randomHeights(1, 3);
      for (let i = 0; i < 3; i += 1) h[start + i] = shelf;
      h[land] = shelf - 1;
      return h;
    },
    (board, tops) => {
      for (let i = 0; i < 3; i += 1) {
        const x = start + i;
        board[tops[x]][x] = { id: `str-seed-${i}`, value: 6, group: -440 - i };
      }
    },
    [2, 3, 4, 5],
  );
};

const STR_LINES: BombLessonLines = {
  opening: bombOpening(
    'str6',
    { ja: '[6]をまっすぐ4つ並べれば\nストレイト6じゃ！', en: 'Line up four [6] for Straight 6!' },
    false,
  ),
  feature: {
    ja: 'ならんだ列を\nはしからはしまでつらぬくのじゃ！',
    en: 'Straight 6 pierces its whole line, edge to edge!',
  },
  go: { ja: '[6]をまっすぐ4つ並べてみよ', en: 'Here we go! Line up four [6]!' },
  again: { ja: 'もう一度 [6]をまっすぐ4つじゃ！', en: 'Once more! Four [6] in a line!' },
  nice: { ja: 'うむ その調子じゃ！', en: 'Straight 6! Keep going!' },
  miss: { ja: '[6]がまっすぐ4つ並ぶところへ置くのじゃ', en: 'Put the [6] where four line up!' },
  wipe: { ja: 'きれいにするぞい\nもう一度じゃ', en: "Let's clear it and retry!" },
  mission: { ja: '仕上げじゃ\nストレイト6を3回出してみよ！', en: 'Mission! Pull off Straight 6 three times!' },
  missionNice: { ja: 'よいぞ\nあと少しじゃ！', en: 'Straight 6! Almost there!' },
  reset: { ja: 'いったん消すとしようかの', en: 'Let me clear it and start over!' },
};

const STR_LESSON: BombLesson = {
  kind: 'str6',
  value: 6,
  lines: STR_LINES,
  // お手本は左端から3つ。落とし先はブロックが出てくる真ん中の列（4つめ）
  practiceBoard: (demo) => buildStraightSeed(demo ? 0 : Math.floor(Math.random() * (COLS - 2))),
  practiceAlive: (board) =>
    board.reduce((sum, row) => sum + row.filter((cell) => cell?.value === 6).length, 0) >= 3,
  // 6 と組んで7になる 1 は入れない。6 を真ん中に入れると、横にしても縦にしても
  // 底の段に届かない（横にすると隣の6に乗ってしまう）。だから上か下の端にだけ入れる
  piece: (id, demo) => makeLessonPiece(id, 6, demo || Math.random() < 0.5 ? 2 : 0, [[2, 5], [3, 4]]),
  missionBoard: () => buildStrMissionBoard(),
};

// --- 11メン：ニコニコボム ---
// 黒いニコニコメを2つくっつけると発動し、くっついた黒と盤面の2・5がぜんぶ消える。
// ひとりぼっちの黒も一緒に発動して、まわり8マスを巻き込む。
// ここで習得するので、11メンからはストーリーでもニコニコボムが使える
const NICO_STAGE = 11;
const NICO_HIDOIME_STAGE = 12;
const nicoOpenIn = (stageNo: number | null, powers?: string[]) => stageNo === null || (powers ? powers.includes('nico') : stageNo >= NICO_STAGE && stageNo < LEGACY_STAGE_COUNT);

const NICO_LINES: BombLessonLines = {
  opening: [
    { ja: 'ニコニコボムを授けようぞ！', en: 'Let me teach you the Nico Bomb!' },
    { ja: '黒いニコニコメを2つくっつけるのじゃ', en: 'Stick two black Nico dice together and' },
    { ja: '盤面の[2]と[5]がぜんぶ消えるのじゃ！', en: 'every [2] and [5] on the board vanishes!' },
  ],
  feature: { ja: 'ひとりぼっちの黒は\nまわりを巻き込むぞい', en: 'A lone black one blasts its neighbors too' },
  go: { ja: 'さあ 黒どうしをくっつけてみよ', en: 'Ready? Stick the black dice together!' },
  again: { ja: 'もう一度 黒どうしをくっつけよ', en: 'Once more! Stick the black ones together!' },
  nice: { ja: 'うむ その調子じゃ！', en: 'Nico Bomb! Keep going!' },
  miss: { ja: '黒のとなりに黒をくっつけるのじゃ', en: 'Put the black one next to the other!' },
  wipe: { ja: 'きれいにするぞい\nもう一度じゃ', en: "Let's clear it and retry!" },
  mission: { ja: '仕上げじゃ\nニコニコボムを2回出してみよ！', en: 'Mission! Set off 2 Nico Bombs!' },
  missionNice: { ja: 'よいぞ\nあと少しじゃ！', en: 'Nico Bomb! Almost there!' },
  reset: { ja: 'いったん消すとしようかの', en: 'Let me clear it and start over!' },
};

// 底に黒を1つ、少し離して[2]と[5]を並べる。黒は他の目と足しても7にならない
const buildNicoLessonBoard = (demo: boolean): Board => {
  const board = emptyBoard();
  const c = demo ? 3 : 1 + Math.floor(Math.random() * (COLS - 2));
  board[ROWS - 1][c] = { id: 'nico-seed', value: NICO, group: -700 };
  // 黒から離れた両側に 2 と 5 を置く（隣どうしにはしないので7にならない）
  const spots = [0, 1, 2, 3, 4, 5, 6].filter((x) => Math.abs(x - c) >= 2);
  spots.forEach((x, index) => {
    const value = index % 2 === 0 ? 2 : 5;
    const left = board[ROWS - 1][x - 1];
    if (left && left.value + value === 7) return;
    board[ROWS - 1][x] = { id: `nico-fill-${x}`, value, group: -710 - x };
  });
  return board;
};

const NICO_LESSON: BombLesson = {
  kind: 'nico',
  value: NICO,
  lines: NICO_LINES,
  practiceBoard: (demo) => buildNicoLessonBoard(demo),
  practiceAlive: (board) => board.some((row) => row.some((cell) => cell?.value === NICO)),
  // お手本は黒を一番下に入れて、真下（黒の上）へ落とすだけでくっつく
  piece: (id, demo) =>
    makeLessonPiece(id, NICO, demo ? 2 : Math.floor(Math.random() * 3), [
      [1, 6],
      [3, 4],
    ]),
  // ミッションは低い山のてっぺんに黒を1つ。落ちてくるブロックにも黒が混ざる
  missionBoard: () =>
    buildMessyBoard(
      () => randomHeights(1, 3),
      (board, tops) => {
        const x = 1 + Math.floor(Math.random() * (COLS - 2));
        board[tops[x] - 1][x] = { id: 'nico-mission-seed', value: NICO, group: -720 };
      },
    ),
};

const BOMB_LESSONS: Partial<Record<number, BombLesson>> = {
  [SPA_STAGE]: SPA_LESSON,
  [WALL_LESSON]: SPA_LESSON,
  [SLA_STAGE]: SLA_LESSON,
  [SQU_STAGE]: SQU_LESSON,
  [STR_STAGE]: STR_LESSON,
  [NICO_STAGE]: NICO_LESSON,
};

// ストーリーで使えるひっさつメ。習得するメンから使える。
// スーパー1は3メン、スラッシュ3は5メン、スクウェア4は7メン、ストレイト6は9メンから。
// それより前のメンでは、目がそろってもひっさつメにはならず、そのまま残る
const storyAllows = (stageNo: number, kind: BombKind, powers?: string[]) =>
  powers ? powers.includes(kind) :
  (kind === 'spa1' && stageNo >= SPA_STAGE) ||
  (kind === 'sla3' && stageNo >= SLA_STAGE) ||
  (kind === 'squ4' && stageNo >= SQU_STAGE) ||
  (kind === 'str6' && stageNo >= STR_STAGE);


// --- 6メン：ダーメの倒し方 ---
// ダーメ（旧ダメ）は2回当てないと倒せない。1回目で✕が取れてコイツメになり、2回目で消える。
// お手本 → やってみて（DAME_PRACTICE 回）→ ミッション（ダーメを2体倒す）
// 盤面に出すダーメは最大2体。倒しやすくするため、同時に3体以上は並べない。
const DAME_STAGE = 6;
const DAME_PRACTICE = 2;
const DAME_MAX_ON_BOARD = 2;

// 1つだけのメを落とすブロック。お手本で、決まった列へまっすぐ落とすのに使う
// --- 2メン：チェイン目のお手本 ---
// 底に [1][3] を並べ、[6] をわざと [1] の横ではなく [3] の上に外して置く。
// 次に [4] で下の [3] を消すと、[6] が落ちて [1] ととなり合い、2回目の7＝チェインになる
const COMBO_STAGE = 2;
const COMBO_DEMO_LINES = {
  intro: { ja: 'チェイン目を教えるよ！', en: "Let me show you a chain!" },
  miss: { ja: 'まず[6]を、わざと[1]のとなりから外して置くよ', en: 'First, place the [6] away from the [1] on purpose' },
  setup: { ja: '次に[4]で、下の[3]を消すと…', en: 'Now clear the [3] below with a [4]...' },
  combo: { ja: 'ねっ！落ちた[6]と[1]で7！これがチェインだよ', en: 'See? The falling [6] meets the [1] for 7. That is a chain!' },
  go: { ja: 'それじゃ いくよ？わざと外して、チェインを作ろう', en: 'Here we go! Set it up and make a chain!' },
};

// 縦3つのブロック（上から values の順）を、決まった列へ出す
const makeColumnPiece = (id: number, values: number[], column: number): Piece => ({
  id,
  x: column - 1,
  y: 0,
  matrix: values.map((v) => [null, v, null]),
});

const makeSinglePiece = (id: number, value: number, column: number): Piece => ({
  id,
  x: column - 1,
  y: 0,
  matrix: [[null, value, null]],
});

// お手本とやってみての盤面。底に「的・ダーメ・的」を並べる。
// 的は同じ目なので、どちらの側で7を作っても当たる。1回目で✕が取れ、2回目で倒せる。
const DAME_TARGET_IDS = ['dame-target-l', 'dame-target-r'];
const buildDameLessonBoard = (start: number, target: number): Board => {
  const board = emptyBoard();
  board[ROWS - 1][start] = { id: DAME_TARGET_IDS[0], value: target, group: -300 };
  board[ROWS - 1][start + 1] = { id: `dame-lesson-${start}-${Math.random()}`, value: DAME, group: -270 };
  board[ROWS - 1][start + 2] = { id: DAME_TARGET_IDS[1], value: target, group: -301 };
  return board;
};

// ミッションの盤面。ばらばらの低い山の上に、ダーメを count 体（最大2体）のせる。
// 埋める目に 1 と 3 は使わない（勝手にスーパー1やスラッシュ3ができないように）
const buildDameMissionBoard = (count: number): Board => {
  const n = Math.max(1, Math.min(DAME_MAX_ON_BOARD, count));
  const columns = [0, 1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5).slice(0, n);
  return buildMessyBoard(
    () => randomHeights(1, 2),
    (board, tops) => {
      columns.forEach((x, index) => {
        board[tops[x] - 1][x] = { id: `dame-${index}-${Math.random()}`, value: DAME, group: -280 - index };
      });
    },
    [2, 4, 5, 6],
  );
};

const DAME_LINES = {
  intro: { ja: 'ダーメの倒し方を教えるよ！', en: 'Let me show you how to beat a Dame!' },
  demo: { ja: 'ダーメは、となりで7を2回作ると倒せるよ！', en: 'Make 7 next to a Dame twice to beat it!' },
  demoHit: { ja: 'ほら、✕が取れたでしょ。あと1回！', en: 'See? The ✕ came off. One more!' },
  demoCleared: { ja: 'ねっ！2回でダーメを倒せたでしょ', en: 'See? Two hits beat the Dame!' },
  go: { ja: 'それじゃ いくよ？ダーメのとなりで7を2回！', en: 'Here we go! Make 7 beside the Dame twice!' },
  hit: { ja: 'いいね！✕が取れた！あと1回！', en: 'Nice! The ✕ is off! One more!' },
  again: { ja: 'もう一回！ダーメを倒してみて！', en: 'Once more! Beat the Dame!' },
  miss: { ja: 'おしい！ダーメのすぐとなりで7を作って！', en: 'So close! Make 7 right beside the Dame!' },
  wipe: { ja: '全部消すね！もう一回！', en: "Let's clear it and retry!" },
  mission: { ja: 'ミッション！ダーメを2体やっつけよう！', en: 'Mission! Beat 2 Dame!' },
  nice: { ja: 'やっつけた！その調子！', en: 'Got one! Keep going!' },
  more: { ja: 'ダーメが来たよ！', en: 'Here comes another Dame!' },
  reset: { ja: 'いったん消すとしよう', en: 'Let me clear it and start over!' },
};

// --- 10メン：ヒドイメ ---
const HIDOIME_STAGE = 10;
// ある程度積み上がった盤面（3〜5段）。最初からひっさつメや7ができている並びは作らない
const buildHidoimeStartBoard = (): Board =>
  buildMessyBoard(
    () => randomHeights(3, 4),
    () => undefined,
  );
// --- 11メン：FEVER ---
// ここからストーリーでも FEVER ゲージがたまる（それまでのメンでは使えないチカラ）
const FEVER_STAGE = 13;
const feverOpenIn = (stageNo: number | null, powers?: string[]) => stageNo === null || (powers ? powers.includes('fever') : stageNo >= FEVER_STAGE && stageNo < LEGACY_STAGE_COUNT);
const FEVER_START = 60; // 11メンは、あと2〜3回消せば FEVER になるところから始める
// 始まりの盤面。低い山の左端にコイツメ、右端にダーメを乗せる。ヒドイメはあとから降ってくる
const buildFeverStartBoard = (): Board =>
  buildMessyBoard(
    () => randomHeights(2, 3),
    (board, tops) => {
      board[tops[0] - 1][0] = { id: 'fever-koitsume', value: KOITSUME, group: -250 };
      board[tops[COLS - 1] - 1][COLS - 1] = { id: 'fever-dame', value: DAME, group: -251 };
    },
  );
const FEVER_LINES: Line[] = [
  { ja: 'チカラ『FEVER』を教えるよ！', en: "Let me teach you the power of FEVER!" },
  { ja: '7を消すたびに、FEVERの文字が光っていくよ', en: 'Each 7 you clear lights up a letter of FEVER' },
  { ja: '5文字ぜんぶ光ると FEVER！消える範囲が広がるんだ', en: 'Light all five for FEVER! Clears spread wider' },
  { ja: 'FEVERで、コイツメもダーメもヒドイメもやっつけよう！', en: 'Use FEVER to beat Koitsume, Dame and Hidoime!' },
];

// --- 12メン：つぎつぎ 現る！（応用編） ---
// いままでの敵が段階的に出てくる。いまの段の敵を全部倒すと、次の段の敵が現れる。
// FEVER もひっさつメも全部使える。count は1段で出す数（ヒドイメは1体）
const WAVES_STAGE = 14;
type Wave = { kind: 'koitsume' | 'dame' | 'hidoime'; count: number; line: Line };
const WAVES: Wave[] = [
  { kind: 'koitsume', count: 2, line: { ja: 'まずはコイツメ！となりで7を作って！', en: 'First, Koitsume! Make 7 beside them!' } },
  { kind: 'dame', count: 2, line: { ja: 'ダーメが来たよ！2回当てて倒そう！', en: 'Here come the Dame! Hit them twice!' } },
  { kind: 'hidoime', count: 1, line: { ja: 'さいごは…ヒドイメが来る！', en: 'And last... Hidoime is coming!' } },
];
const WAVES_INTRO: Line[] = [
  { ja: 'ここからは応用編だよ！', en: "Now for the advanced stage!" },
  { ja: 'いままでの敵が、つぎつぎに出てくるよ', en: 'All the enemies will come, one after another' },
  { ja: 'チカラをぜんぶ使って、やっつけよう！', en: 'Use every power you have!' },
];
// 列のてっぺんに敵を乗せる。上のほうまで積まれている列は避ける
const placeEnemiesOnTops = (board: Board, value: number, count: number): { board: Board; placed: Position[] } => {
  const next = board.map((row) => [...row]);
  const placed: Position[] = [];
  const columns = [1, 2, 3, 4, 5, 0, 6].sort(() => Math.random() - 0.5);
  for (const x of columns) {
    if (placed.length >= count) break;
    let top = ROWS;
    for (let y = 0; y < ROWS; y += 1) {
      if (next[y][x]) {
        top = y;
        break;
      }
    }
    const y = top - 1;
    if (y < 5) continue;
    next[y][x] = { id: `wave-${value}-${x}-${Math.random()}`, value, group: -600 - placed.length - x * 10 };
    placed.push({ x, y });
  }
  return { board: next, placed };
};

// --- 13メン：虹ボム ---
// 危険領域の上のほうまで積み上がった、絶体絶命の盤面から始める。
// このメンでは、持っている虹ボムの数とは別に、教える用の1個を使わせる（保存している数は減らさない）
const RAINBOW_STAGE = 15;
const RAINBOW_LESSON_ASK_MS = 8000; // 教えるときは、押すまでゆっくり待つ
const buildRainbowStartBoard = (): Board =>
  buildMessyBoard(
    () => {
      // 真ん中ほど高く（上から6段目まで）、端は少し低い。あと1〜2個で てっぺんに届く
      const h = [7, 8, 9, 9, 9, 8, 7].map((value) => value - Math.floor(Math.random() * 2));
      return h;
    },
    () => undefined,
  );
const RAINBOW_LESSON_LINES: Line[] = [
  { ja: 'たいへん！もうこんなに積み上がってる…！', en: "Oh no! It's stacked up so high...!" },
  { ja: 'こんなときこそ\n最終兵器『虹ボム』じゃ！', en: "For times like this, here's the ultimate weapon: the Rainbow Bomb!" },
  // \n は、そこで必ず改行する目印
  { ja: 'つみあがりきっても1度だけ\n虹色ボタンのチャンスがあるのじゃ', en: "Even when it's all stacked up,\nyou get one rainbow-button chance!" },
];
// 16メンから先で、虹ボムを持たずにゲームオーバーになったときのひとこと
const RAINBOW_HINT_LINE: Line = {
  ja: 'スコアモードで虹ボムゲットするといいかも！',
  en: 'Try getting a Rainbow Bomb in Score Mode!',
};
const RAINBOW_LESSON_ASK: Line = { ja: 'いまじゃ！虹色の玉を押すのじゃ！', en: 'Now! Tap the rainbow orb!' };

// --- 16メン：ヒドイメ 大行進！ ---
const SWARM_STAGE = 16;
// 合計でこの数だけメを消したあとから、消すたびに SWARM_RATE の確率でヒドイメが1体降ってくる。
// 出るのは全部で SWARM_MAX 体まで。ヒドイメは2段までしか重ねない（3段目になる場所しかなければ、出せるときまで持ち越す）
const SWARM_START_CLEARED = 5;
const SWARM_RATE = 0.3;
const SWARM_MAX = SWARM_MAX_COUNT;
// ヒドイメを落とせる列を探す。落ちる途中のメは押しつぶし、下にヒドイメがいればその上で止まる。
// 止まる先のヒドイメの下にさらにヒドイメがいる（3段目になる）列は選ばない
const pickSwarmDrop = (board: Board): { x: number; floor: number } | null => {
  const columns = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5);
  for (const x of columns) {
    let floor = ROWS;
    for (let y = 0; y < ROWS && floor === ROWS; y += 1) {
      if (board[y][x]?.value === HIDOIME || board[y][x + 1]?.value === HIDOIME) floor = y;
    }
    if (floor < 2) continue;
    if (floor < ROWS) {
      // その下（止まる先のヒドイメより下）にもう1体いれば、3段目になるので不可
      let stacked = false;
      for (let y = floor + 2; y < ROWS && !stacked; y += 1) {
        if (board[y][x]?.value === HIDOIME || board[y][x + 1]?.value === HIDOIME) stacked = true;
      }
      if (stacked) continue;
    }
    return { x, floor };
  }
  return null;
};
const SWARM_LINES = {
  intro: [
    { ja: 'なんだか、いやな予感がする…', en: 'I have a bad feeling about this...' },
    { ja: 'とりあえずGo!', en: 'Just go for it!' },
  ] as Line[],
  sense: { ja: '上から何か来る…！', en: 'Something is coming from above...!' },
  appear: { ja: 'ヒドイメが来た！やっつけよう！', en: 'A Hidoime! Beat it!' },
};
// --- 17メン：ベラボウメ 現る！ ---
const BERABOU_STAGE = 17;
const BERABOU_GROUP = -800;
const BERABOU_FLING_MS = 700; // 下の3×3のメが手前へ飛んでいく長さ（CSS の die-fling と同じ）
// 目のつぶれる順（左上から 0〜8）。四すみ → 辺 → まん中の順で、まん中の目は最後まで残す
const BERABOU_EYE_ORDER = [0, 8, 2, 6, 1, 7, 3, 5, 4];
// --- メンごとの待機セリフ（2026-10-01）---
// そのメンで何をすればいいかを、手が空いたときにひとこと。敵の出るメンは敵の倒し方、
// FEVER が使えるメンからは FEVER のひとことも混ぜる。どれにも当てはまらなければ「7を作ろう」系
const IDLE_KOITSUME: Record<Lang, string[]> = {
  ja: ['コイツメのとなりで7！', 'まとめてやっつけちゃお'],
  en: ['Make 7 next to a Koitsume!', "Let's take them all out!"],
};
const IDLE_DAME: Record<Lang, string[]> = {
  ja: ['✕が取れたら、もう1回！'],
  en: ['Once the ✕ is gone, hit it again!'],
};
const IDLE_HIDOIME: Record<Lang, string[]> = {
  ja: ['泡がなくなるまで、となりで7！', 'ひっさつメなら一気にいけるかも'],
  en: ['Keep making 7 beside it till the bubbles are gone!', 'A special move might do it fast!'],
};
const IDLE_BERABOU: Record<Lang, string[]> = {
  ja: ['目がひらく前に攻めよう！', 'さいごの目はひっさつメでね'],
  en: ['Attack before its eyes reopen!', 'Finish the last eye with a special move!'],
};
const IDLE_FEVER: Record<Lang, string[]> = {
  ja: ['ゲージがたまったらFEVER！'],
  en: ['Fill the gauge for FEVER!'],
};
// ひっさつメの教室で手が空いたときの、ゾロメ仙人のひとこと
const SAGE_IDLE_LINES: Record<Lang, string[]> = {
  ja: ['あわてるでないぞ', 'よく見て置くのじゃ', 'うむ 落ち着くのじゃ', '同じ目を集めるのじゃ'],
  en: ['Do not rush.', 'Look carefully before you drop.', 'Stay calm.', 'Gather matching dice.'],
};
const storyIdleLinesFor = (stageNo: number): Record<Lang, string[]> => {
  if(wallMission(stageNo)?.sanzapparaname) return {
    ja:['サンザッパラナメだ！\n噴火する前に目を狙おう！','となりで7を消すと\n外側の岩を削れるよ！','中央の3マスは無敵！\nひっさつメで目を撃って！'],
    en:['Aim for its eye before it erupts!','Make 7 next to it to chip away its outer rock!','Its middle column is immune! Pierce the eye with Slash 3, Straight 6 or Thunder!'],
  };
  if (BOMB_LESSONS[stageNo] || stageNo === RAINBOW_STAGE || stageNo === THUNDER_LESSON) return SAGE_IDLE_LINES;
  if (stageNo === 20) return WALL_FIRST_IDLE_LINES;
  if (stageNo === 22) return {
    ja: ['サイリアン・コイツメをやっつけよう！\nとなりで7をつくって攻撃！', IDLE_KOITSUME.ja[1], 'となり合うメを7にして！', SAIKA_STORY_LINES.ja[1], SAIKA_STORY_LINES.ja[2]],
    en: [...IDLE_KOITSUME.en, ...SAIKA_STORY_LINES.en],
  };
  // マップ番号から敵や習得技を推測しない。敵のいない1-1でもコイツメを案内してしまうため。
  const mission = wallMission(stageNo);
  if (mission) {
    if (mission.sourceStage !== undefined) return storyIdleLinesFor(mission.sourceStage);
    // ミッションの目標の文（「セヴン目を3回」など）はセリフに出さない（2026-10-05）。
    // そのかわり、実際に盤面にいる敵の倒し方だけを足す
    const parts: Record<Lang, string[]>[] = [];
    const hasKoitsume = mission.enemies.some((enemy) => enemy.kind === 'koitsume');
    if (hasKoitsume) parts.push(IDLE_KOITSUME);
    if (mission.enemies.some((enemy) => enemy.kind === 'dame')) parts.push(IDLE_DAME);
    // 2026-10-05 ユーザー指定（進行表の共通セリフメモ）：「となりと足して7にしよう！」→「となり合うメを7にして（改行）コイツメにくらわせて！」。
    // コイツメのいないメンで言うとおかしいので、コイツメが出るメンだけで差し替える
    parts.push(hasKoitsume
      ? { ja: ['となり合うメを7にして\nコイツメにくらわせて！', ...SAIKA_STORY_LINES.ja.slice(1)], en: ['Make 7 next to it\nand hit the Koitsume!', ...SAIKA_STORY_LINES.en.slice(1)] }
      : SAIKA_STORY_LINES);
    return { ja: parts.flatMap((part) => part.ja), en: parts.flatMap((part) => part.en) };
  }
  const goal = STORY_STAGES[stageNo]?.goal.type;
  const parts: Record<Lang, string[]>[] = [];
  if (goal === 'koitsume' || goal === 'defeat') parts.push(IDLE_KOITSUME);
  if (goal === 'dame' || goal === 'defeat') parts.push(IDLE_DAME);
  if (goal === 'waves') parts.push(IDLE_KOITSUME, IDLE_DAME, IDLE_HIDOIME);
  if (goal === 'hidoime' || goal === 'fever') parts.push(IDLE_HIDOIME);
  if (goal === 'berabou') parts.push(IDLE_BERABOU);
  if (goal === 'detarame') parts.push(IDLE_DETARAME);
  if (parts.length === 0) parts.push(SAIKA_STORY_LINES);
  if (stageNo >= FEVER_STAGE) parts.push(IDLE_FEVER);
  return {
    ja: parts.flatMap((part) => part.ja),
    en: parts.flatMap((part) => part.en),
  };
};

// --- ミッションの進み具合のひとこと（2026-10-01）---
// 敵を倒すミッションは「ラスト1体！」、回数のミッションは「あと1回！」。目標が4以上なら半分でもひとこと
const MISSION_LAST_ENEMY: Line = { ja: 'ラスト1体！', en: 'One more to go!' };
const MISSION_LAST_TRY: Line = { ja: 'あと1回！', en: 'Just one more!' };
const MISSION_HALF: Line = { ja: '半分まできたよ！', en: "You're halfway there!" };
const MISSION_LINE_DELAY_MS = 1300; // 成功のひとことを読み終えてから言う

const BERABOU_LINES = {
  sense: { ja: '下のほうから何か来る…！', en: 'Something is coming from below...!' },
  appear: { ja: 'ベラボウメだ！目が9つもある！', en: "It's a Berabome! It has nine eyes!" },
  howto: { ja: 'となりで7を作るたびに\n目が1つずつ減っていくよ！', en: 'Each 7 next to it\ntakes away one eye!' },
  defeat: { ja: 'やった！ベラボウメをやっつけた！', en: 'Yes! You beat the Berabome!' },
};
const berabouHitLine = (hp: number): Line => ({ ja: `きいてる！のこり${hp}コ！`, en: `It's working! ${hp} left!` });
// 放っておくと目が開き直る：この手数のあいだ一度もダメージを受けないと、つぶれた目が1つ開く。
// 残り1つ（まん中の目だけ）になったら、もう回復しない
const BERABOU_HEAL_TURNS = 10; // 回復までの間隔を従来の2倍に
const BERABOU_HEAL_LINES = {
  warn: { ja: 'はやく攻めないと\n目がひらいちゃう！', en: 'Attack soon or\nan eye will reopen!' },
  heal: { ja: 'あっ！目がひらいちゃった！', en: 'Oh no! An eye reopened!' },
};
// 最後のまん中の目は、ひっさつメでしかつぶせない（ふつうの7ははね返す）。
// ニコニコボム・虹ボムも、ひっさつメと同じ扱いで減らせる
const BERABOU_LAST_LINE: Line = {
  ja: 'のこり1コ！さいごの目は\nひっさつメでしか減らせないよ！',
  en: 'One left! The last eye\nonly goes with a special move!',
};
const BERABOU_GUARD_LINE: Line = {
  ja: 'ふつうの7じゃきかない！\nひっさつメで決めよう！',
  en: "A plain 7 won't work!\nFinish it with a special move!",
};
const isHissatsu = (kind: ClearKind) => kind !== 'seven';
// ベラボウメの目を一度に減らす数。ひっさつメは2つ、ただし残り2つ以下のときは1つだけ
// （残り1つはひっさつメでしか減らせない。そこは別ではね返す）
const berabouDamage = (hp: number, hissatsu: boolean) => (hissatsu && hp > 2 ? 2 : 1);
// 盤面にいるベラボウメの左上のマス
const findBerabou = (board: Board): Position | null => {
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (board[y][x]?.value === BERABOU) return { x, y };
    }
  }
  return null;
};
const BERABOU_RAGE_RATE = 0.4;
const BERABOU_BREAK_RATE = 0.3;
const BERABOU_RAGE_WINDUP_MS = 260;

// 残り1目の手番。発動は1手に1回、その後は隣接する各サイを独立に抽選。
// 上下左右で辺を共有するマスが対象。斜め・空白・敵は含めず、ニコニコメは含める。
const planBerabouRampage = (
  board: Board,
  hp: number,
  random: () => number = Math.random,
): { pos: Position; victims: Position[] } | null => {
  const pos = findBerabou(board);
  if (hp !== 1 || !pos || random() >= BERABOU_RAGE_RATE) return null;
  const adjacent: Position[] = [];
  for (let i = 0; i < 3; i += 1) {
    adjacent.push(
      { x: pos.x + i, y: pos.y - 1 },
      { x: pos.x + i, y: pos.y + 3 },
      { x: pos.x - 1, y: pos.y + i },
      { x: pos.x + 3, y: pos.y + i },
    );
  }
  const victims = adjacent.filter(({ x, y }) => {
    const cell = board[y]?.[x];
    return !!cell && cell.value >= NICO && random() < BERABOU_BREAK_RATE;
  });
  return { pos, victims };
};

// --- 擬音（2026-10-02）---
// 「ゴゴゴ…」などはサイカのセリフに入れず、盤面に大きな文字でかぶせて出す。
// あとでマンガ文字の画像に差し替えやすいよう、擬音ごとに id を持たせ、CSS の .sfx-<id> で見た目を変えられるようにしてある
const SFX = {
  gogogo: { ja: 'ゴゴゴ…', en: 'RUMBLE…' },
  zuzuzu: { ja: 'ズズズ…', en: 'SHHHK…' },
} satisfies Record<string, Line>;
type SfxId = keyof typeof SFX;
const SFX_MS = 1700; // 出してから消えるまで（CSS の sfx-pop と同じ長さ）

// --- 18メン：デタラメ 現る！（docs/detarame/DESIGN.md）---
const DETARAME_STAGE = 18;
const DETARAME_GROUP = -820;
const EMPTY_INDEXES: ReadonlySet<number> = new Set();
const DETARAME_START_SEGMENTS = 3;
const DETARAME_GROW_EVERY = 3; // この手数ごとに1段伸びる
// これより上（y が小さい）には伸びない。ブロックの出口と上の段をふさがないための上限（見本でも上端で止めている）
const DETARAME_TOP_LIMIT = 3;
const DETARAME_FIRE_RATE = 0.5; // 目ごとに、毎手この確率でビームを撃つ
// 当たったサイは、コイツメ45%・ダーメ15%・そのまま40%（強すぎたので、敵に変わる率を2割下げた）
const DETARAME_KOITSUME_RATE = 0.45;
const DETARAME_DAME_RATE = 0.15;
// 伸びる手番が来ても、この確率でしか伸びない（強すぎたので半分に）
const DETARAME_GROW_RATE = 0.5;
// ニコニコメに上をふさがれたときのひとこと
const DETARAME_SEALED_LINES: Line[] = [
  { ja: 'よし！封じこめたよ！', en: 'Yes! Sealed it in!' },
  { ja: 'ナイス！フタしたよ！', en: 'Nice! Put a lid on it!' },
];
const DETARAME_MAX_SEGMENTS = 6; // これより長くは伸びない
const DETARAME_COLUMNS = [1, 2, 4, 5]; // 出てくる列。ブロックの出口（真ん中）は避ける
const DETARAME_HIT_MS = 320; // 目が光って縮んで消えるまで（detarame.css の detarame-eye-hit）
const DETARAME_RISE_MS = 660; // 身体が1段上がる
const DETARAME_ABSORB_MS = 760; // 上のサイを白い3重の線にして吸い込む
const DETARAME_BEAM_GROW_MS = 105; // ビームが伸びて当たるまで
const DETARAME_BEAM_RETRACT_MS = 280; // 当たったあと、目の側から縮んで消える
const DETARAME_REWRITE_MS = 540; // 当たったサイを波で包み、敵に変える
const DETARAME_LINES = {
  sense: { ja: '下から何か伸びてくる…！', en: 'Something is crawling up from below...!' },
  appear: { ja: 'デタラメだ！目からビームで\nサイを敵に変えちゃう！', en: "It's a Detarame! Its beams\nturn dice into enemies!" },
  howto: { ja: '目のある段のとなりで7！\n目を1つずつ減らそう！', en: 'Make 7 next to an eye\nto take it away!' },
  grow: { ja: 'デタラメが伸びた！\n上のサイが飲みこまれちゃう！', en: 'It grew!\nThe die above got swallowed!' },
  laser: { ja: 'ビームに当たったサイが\n敵に変えられちゃった！', en: 'The beam turned\na die into an enemy!' },
  defeat: { ja: 'やった！デタラメをやっつけた！', en: 'Yes! You beat the Detarame!' },
};
const detarameHitLine = (left: number): Line => ({ ja: `きいてる！目があと${left}つ！`, en: `It's working! ${left} eyes left!` });
const IDLE_DETARAME: Record<Lang, string[]> = {
  ja: ['ビームの向きに気をつけて！', '目のある段のとなりで7！'],
  en: ['Watch where the beams point!', 'Make 7 next to a segment with an eye!'],
};
// ある程度積み上がった盤面（2〜4段）。デタラメの出てくる列だけは空けておく
// どの列から出てくるか分からないよう、出てくる列も周りと同じように積んでおく（3段以上）
const buildDetarameStartBoard = (x: number): Board =>
  buildMessyBoard(
    () => {
      const h = randomHeights(2, 4);
      h[x] = Math.max(3, h[x]);
      return h;
    },
    () => undefined,
  );
// --- 19メン：みんな 現る！ ---
const ALLSTAR_STAGE = 19;
const ALLSTAR_LINES = {
  intro: [
    { ja: 'いままでの敵が、みんな来るよ！', en: 'Every enemy so far is coming!' },
    { ja: 'まずはコイツメとダーメから！', en: 'First, Koitsume and Dame!' },
  ] as Line[],
  hidoime: { ja: '次がくる！', en: 'Here comes the next one!' },
  finale: { ja: 'まだくる…！', en: 'More are coming...!' },
};
const DETARAME_DEVOUR_MS = 900; // 登場：下の3つのサイを一気に捕食して現れるまで
const FEVER_AWAKEN_LINE: Line = { ja: '見て！サイカも覚醒‼︎', en: 'Look! Saika has awakened too!!' };
const RAINBOW_LESSON_SAVED: Line = { ja: 'これが虹ボムのチカラじゃ！', en: 'Saved! That is the power of the Rainbow Bomb!' };

const HIDOIME_LINES = {
  sense: { ja: 'なにか来る…！', en: 'Something is coming...!' },
  appear: { ja: 'ヒドイメだ！となりで7を作ってやっつけよう！', en: "It's a Hidoime! Make 7 next to it!" },
  hit: { ja: 'きいてる！その調子！', en: "It's working! Keep going!" },
};

// チュートリアルと敵の倒し方は、合計7になる2人1組のサイノメがかわるがわる教える（目の数で指定）
const TUTOR_PAIRS: Partial<Record<number, [number, number]>> = {
  0: [1, 6], // チュートリアル：基本の7の作り方
  21: [2, 5], // マップ1-2：コイツメ初登場
  22: [2, 5], // マップ1-3：コイツメ初登場
  26: [3, 4], // マップ1-7：ダーメ初登場
  61: [6, 1], // マップ6-2：アンチクショウメ初登場
  [KOI_STAGE]: [2, 5],
  [DAME_STAGE]: [3, 4],
  [HIDOIME_STAGE]: [6, 1],
  [BERABOU_STAGE]: [2, 5],
  [DETARAME_STAGE]: [3, 4],
};
// アンチクショウメの倒し方（6-2）。サイノメの組が教える
const ANCHI_HOWTO_LINES: Line[] = [
  { ja: 'アンチクショウメは\n目にしかきかないよ！', en: 'The Anchikushoume only\nfears a hit to its eye!' },
  { ja: 'イチニノサンダーで\n目のある列を打ちぬこう！', en: 'Use ICHI NINO THUNDER!\non the eye\'s column!' },
  { ja: 'ほうっておくと\nサイを食べて大きくなるよ！', en: 'Leave it alone and\nit eats dice and grows!' },
];
// 6-1：ゾロメ仙人のイチニノサンダー講習
const THUNDER_LESSON = 60;
const THUNDER_LESSON_LINES: Line[] = [
  { ja: 'またワシじゃ。\n最後のひっさつメを授けよう！', en: 'Me again.\nLearn the final special move!' },
  { ja: '[1]・[2]・[3]を順につなげると\nサイが黄色く光るのじゃ', en: 'Line up [1], [2], [3]\nand they glow yellow.' },
  { ja: '光ったサイを指でなぞれば\nイチニノサンダーじゃ！', en: 'Trace the glowing dice\nfor ICHI NINO THUNDER!' },
];
const THUNDER_DEMO_AFTER: Line[] = [
  { ja: 'イナヅマがバラバラの2列を\nまるごと消しとばすのじゃ', en: 'Lightning wipes out\ntwo scattered columns.' },
  { ja: 'FEVER中なら\n4列じゃぞ！', en: 'During FEVER,\nfour columns!' },
  { ja: '仕上げじゃ\nイチニノサンダーを3回出してみよ！', en: 'Final trial: use\nICHI NINO THUNDER! three times!' },
];
const TUTOR_RESCUE: Line = { ja: 'サイカ、たすけに来たよ！', en: "Saika, we're here to help!" };
const TUTOR_PANIC: Partial<Record<number, Line>> = {
  21: { ja: 'わっ、コイツメ！\nどうしよう…', en: 'Whoa, a Koitsume!\nWhat do I do...' },
  22: { ja: 'わっ、コイツメ！\nどうしよう…', en: 'Whoa, a Koitsume!\nWhat do I do...' },
  26: { ja: 'わっ、ダーメまで！\nどうしよう…', en: 'Whoa, a Dame too!\nWhat do I do...' },
  61: { ja: 'な、なにあれ…！\n見たことない敵だよ…', en: "W-what is that...!\nI've never seen that one..." },
  [KOI_STAGE]: { ja: 'わっ、コイツメ！\nどうしよう…', en: 'Whoa, a Koitsume!\nWhat do I do...' },
  [DAME_STAGE]: { ja: 'わっ、ダーメ！\nどうしよう…', en: 'Whoa, a Dame!\nWhat do I do...' },
};

// --- 0メン：チュートリアル ---
// お手本で7ができたとき、消す前に点滅させる長さ。
// 最初の2回はしっかり見せ、3回目からは分かっているはずなので短くする
// サイカがセリフを言い終えたとみなすまで（字数ぶん長く）。「やってみて！」の札はこのあとに出す
const SAIKA_SETTLE_BASE_MS = 900;
const SAIKA_SETTLE_PER_CHAR_MS = 40;
// 0メン（チュートリアル）以外のお手本は、この倍率で速く落とす（2026-10-05：4メン以降1.5倍 → 0メン以外1.25倍）
const DEMO_FALL_SPEEDUP = 1.25;
// 「お手本 → 練習2回 → ミッション3回」のような、進め方を書いた文か（画面には出さない）
// マップのメンの名前を2行で（1行目「ウォール1-1」、2行目にタイトル。『』は付けない）
const wallTitleLines = (stage: number) => {
  const mission = wallMission(stage);
  if (stage === 0) return <>0メン<br />チュートリアル草原</>;
  return mission ? <>{wallNumberLabel(mission)}<br />{mission.title}</> : wallTitle(stage);
};
const DEMO_BLINK_MS = 2000;
const DEMO_BLINK_LATER_MS = 1400;
const DEMO_BLINK_LONG_TIMES = 2;
// 回転・スワイプの段で、落ちたメを残しておける高さ。これより上に届いたら、すっと消して空に戻す
const TUTORIAL_KEEP_LIMIT_ROW = 3;
const TUTORIAL_MISS_LIMIT = 3; // この回数ミスしたら盤面を全部消して仕切り直す
const TUTORIAL_TARGET_ID = 'tutorial-target';

// 縦一列のブロック。comp（的の相方＝足して7）を index の位置に入れ、
// 残りの2つは「的とも相方とも互いとも7にならない」目で埋める。
const makeTutorialPiece = (id: number, target: number, compIndex: number): Piece => {
  const comp = 7 - target;
  const others = [1, 2, 3, 4, 5, 6].filter((v) => v !== target && v !== comp);
  // 残り4つは2組の相方どうし。組ごとに1つずつ選べば、互いに7にならない
  const pairs = new Map<number, number[]>();
  others.forEach((v) => {
    const key = Math.min(v, 7 - v);
    pairs.set(key, [...(pairs.get(key) ?? []), v]);
  });
  const fillers = [...pairs.values()].map((pair) => pair[Math.floor(Math.random() * pair.length)]);
  const values = [...fillers];
  values.splice(compIndex, 0, comp);
  return {
    id,
    x: Math.floor((COLS - 3) / 2),
    y: 0,
    matrix: values.map((value) => [null, value, null]),
  };
};

// チュートリアルの段取り。お手本（demo）と練習（practice）を交互に、最後にミッション。
//   demo     … サイカが説明し、オートで操作して見せる（プレイヤーは触れない）
//   practice … プレイヤーが操作する。label で盤面中央に促しを出す
//   mission  … 7を規定回数つくればクリア
type TutorialStep =
  | {
      kind: 'demo';
      action: 'cw' | 'ccw' | 'seven' | 'up' | 'down';
      target?: number; // 7のお手本で置く的の目
      dir?: 'cw' | 'ccw'; // 7のお手本で回す向き
      ja: string;
      en: string;
    }
  | { kind: 'practice'; needSeven: boolean; label: 'try' | 'seven'; ja: string; en: string }
  | { kind: 'mission'; ja: string; en: string };
const TUTORIAL_STEPS: TutorialStep[] = [
  // 回転：右・左のお手本 → 2回やってみる
  { kind: 'demo', action: 'cw', ja: '右がわタップで右まわり！', en: 'Tap right to turn right!' },
  { kind: 'demo', action: 'ccw', ja: '左がわタップで左まわり！', en: 'Tap left to turn left!' },
  { kind: 'practice', needSeven: false, label: 'try', ja: 'タップで回して落としてみて！', en: 'Tap to turn, then let it land!' },
  { kind: 'practice', needSeven: false, label: 'try', ja: 'もう一回！右も左も回してみて！', en: 'Once more! Try both ways!' },
  // 合計7：1と6、2と5、3と4 をすべてお手本で見せる → やってみる
  { kind: 'demo', action: 'seven', target: 1, dir: 'cw', ja: '[1]と[6]で7！となりどうしで消えるよ！', en: '[1] and [6] make 7. They vanish!' },
  { kind: 'demo', action: 'seven', target: 2, dir: 'ccw', ja: '[2]と[5]でも7！', en: '[2] and [5] make 7 too!' },
  { kind: 'demo', action: 'seven', target: 3, dir: 'cw', ja: '[3]と[4]でも7！', en: '[3] and [4] make 7 as well!' },
  { kind: 'practice', needSeven: true, label: 'seven', ja: 'となりと足して7にしてみて！', en: 'Make 7 with a neighbor!' },
  { kind: 'practice', needSeven: true, label: 'seven', ja: 'もう一回！7を作ってみて！', en: 'Once more! Make another 7!' },
  // 即時落下：上・下スワイプのお手本 → 2回やってみる
  { kind: 'demo', action: 'up', ja: '上にスワイプですぐ落下！', en: 'Swipe up to drop!' },
  { kind: 'demo', action: 'down', ja: '下にスワイプでもすぐ落下！', en: 'Swipe down to drop too!' },
  { kind: 'practice', needSeven: false, label: 'try', ja: 'スワイプでストンと落としてみて！', en: 'Swipe to drop it!' },
  { kind: 'practice', needSeven: false, label: 'try', ja: 'もう一回！上でも下でもOK！', en: 'Again! Up or down works!' },
  { kind: 'mission', ja: 'ミッション！7を5回つくろう！', en: 'Mission! Make 7 five times!' },
];

const TUTORIAL_LINES = {
  demo: [
    { ja: 'となりと足して7で消えるよ！', en: 'Neighbors that add up to 7 vanish!' },
    { ja: '[5]と[2]で7！左まわりで合わせる', en: '[5] and [2] make 7! Turn left to match.' },
    { ja: '[4]と[3]で7！くるっと合わせよう', en: '[4] and [3] make 7! Spin to match.' },
  ],
  go: {
    ja: '準備OK？相方で7を作ろう！',
    en: 'Ready? [6] goes with [1], [5] with [2], [4] with [3]!',
  },
  nice: [
    { ja: 'いいね！ぴったり7！', en: 'Nice! Exactly 7!' },
    { ja: 'その調子！7できた！', en: 'Keep it up! You made 7!' },
  ],
  ok: { ja: 'ナイス！その調子！', en: 'Nice! Keep it up!' },
  // お手本で7が消えた瞬間。操作したのはサイカなので、褒めずに結果を見せる
  demoCleared: { ja: 'ねっ！消えたでしょ', en: 'See? It vanished!' },
  miss: {
    ja: 'おしい！7になる目を下へ！',
    en: 'So close! Turn the die that makes 7 to face down.',
  },
  wipe: {
    ja: '全部消すね！もう一回！',
    en: "No worries! Let's clear it all and try again!",
  },
};

// コロの開始盤面。敵がいるコロは、底の1段を普通のメで埋めてその上に敵を置く。
// 底の段どうしで7ができないよう振り直す。
const buildStageBoard = (stage: StoryStage): Board => {
  const board: Board = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));
  if (stage.enemies.length === 0) {
    return board;
  }
  let row: number[];
  do {
    row = Array.from({ length: COLS }, () => 1 + Math.floor(Math.random() * 6));
  } while (row.some((value, x) => x > 0 && value + row[x - 1] === 7));
  row.forEach((value, x) => {
    board[ROWS - 1][x] = { id: `stage-${x}`, value, group: -100 - x };
  });
  stage.enemies.forEach((enemy, index) => {
    board[enemy.y][enemy.x] = { id: `enemy-${index}`, value: enemy.value, group: -200 - index };
  });
  return board;
};

const countEnemies = (board: Board) => {
  let koitsume = 0;
  let dame = 0;
  board.forEach((row) =>
    row.forEach((cell) => {
      if (cell?.enjo || cell?.hyoketsu || cell?.value === KOITSUME) koitsume += 1;
      if (cell?.value === DAME) dame += 1;
    }),
  );
  return { koitsume, dame };
};

// セヴン目になったマスの上下左右にいる敵。コイツメは消え、ダメはコイツメに変わる
// direct は「そのマス自体が爆発の範囲に入っている」位置。そこにいる敵にも当たる（ニコニコボムの巻き込み）
const findEnemyHits = (board: Board, cells: Position[], direct: Position[] = []) => {
  const seen = new Set<string>();
  const koitsume: Position[] = [];
  const dame: Position[] = [];
  const hidoime = new Set<number>(); // 当たったヒドイメ。1回の消去で1体につき1ダメージ
  const berabou = new Set<number>(); // 当たったベラボウメ。1回の消去で目が1つつぶれる
  const detarame: Position[] = []; // 当たったデタラメの段（マスの位置）。目のある段だけが App 側で効く
  direct.forEach(({ x, y }) => {
    const key = `${x},${y}`;
    const cell = board[y]?.[x];
    if (!cell || !isEnemy(cell.value) || cell.value === ANCHI || cell.hyoketsu || cell.enjo || seen.has(key)) return;
    seen.add(key);
    if (cell.value === HIDOIME) {
      hidoime.add(cell.group);
      return;
    }
    if (cell.value === BERABOU) {
      berabou.add(cell.group);
      return;
    }
    if (cell.value === DETARAME) {
      detarame.push({ x, y });
      return;
    }
    (cell.value === DAME ? dame : koitsume).push({ x, y });
  });
  cells.forEach((point) => {
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].forEach(([dx, dy]) => {
      const x = point.x + dx;
      const y = point.y + dy;
      const key = `${x},${y}`;
      const cell = board[y]?.[x];
      if (!cell || !isEnemy(cell.value) || cell.value === ANCHI || cell.hyoketsu || cell.enjo || seen.has(key)) {
        return;
      }
      seen.add(key);
      if (cell.value === HIDOIME) {
        hidoime.add(cell.group);
        return;
      }
      if (cell.value === BERABOU) {
        berabou.add(cell.group);
        return;
      }
      if (cell.value === DETARAME) {
        detarame.push({ x, y });
        return;
      }
      (cell.value === DAME ? dame : koitsume).push({ x, y });
    });
  });
  return { koitsume, dame, hidoime: [...hidoime], berabou: [...berabou], detarame };
};

const loadBestScores = () => {
  try {
    const saved = window.localStorage.getItem(BEST_SCORES_KEY);
    if (!saved) {
      return [];
    }
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed)
      ? parsed.filter((score): score is number => Number.isFinite(score)).slice(0, 5)
      : [];
  } catch {
    return [];
  }
};

const saveBestScores = (scores: number[]) => {
  window.localStorage.setItem(BEST_SCORES_KEY, JSON.stringify(scores));
};

// Shared reactions keep their original Saika/tutor copy. Only the sage gets these
// hand-written alternatives; lesson-only lines above are already in his voice.
const SAGE_SHARED_VOICE: Array<[readonly string[], readonly string[]]> = [
  [SAIKA_HELLO_LINES.ja, ['よう来たのう', 'さあ 始めるぞい！', '今日も転がすぞい', 'サイノメ・セヴンじゃ！']],
  [SAIKA_SMILE_LINES.ja, ['よい調子じゃ♪', 'うむ 見事じゃ', 'その調子じゃ', 'ほっほっほ♪']],
  [SAIKA_CHAIN_LINES.ja, ['{n}チェイン！ 見事じゃ', 'ほっほ 止まらぬのう！', '{n}チェインじゃ！']],
  [SAIKA_BIG_CHAIN_LINES.ja, ['{n}チェイン！ ゆけい！', 'ここが踏ん張りどころじゃ', 'まだまだゆけるぞい！', '勝負どころじゃぞ']],
  [SAIKA_SURPRISE_LINES.ja, ['ニコニコメはまだかのう', 'むっ 今のは何じゃ？', 'そこに置くのかの！？']],
  [SAIKA_WORRY_LINES.ja, ['積みすぎじゃぞ！', '危ないのう', '狭くなったのう', 'ニコニコメよ 来るのじゃ']],
  [SAIKA_RELIEF_LINES.ja, ['ふう 助かったぞい', '危なかったのう', 'うむ 立て直したのう']],
  [SAIKA_PRAISE_LINES.ja, ['どうじゃ！', '決まったぞよ！', 'ふむ 狙いどおりじゃ', 'お見事じゃ！']],
  [SAIKA_FEVER_PRAISE_LINES.ja, ['ほっほ 決まったぞよ！', 'まことに見事じゃ！', 'やったぞよ！']],
  [SAIKA_FEVER_IDLE_LINES.ja, ['フィーバーじゃ！', '今が好機じゃ', 'みな光っておるのう', 'どんどんゆくぞい！', '調子が出てきたのう！']],
  [SAIKA_FEVER_SMILE_LINES.ja, ['よいぞ よいぞ！', 'その調子じゃ！', 'もっとゆけるぞい！', '熱くなってきたのう！']],
  [SAIKA_FEVER_CHAIN_LINES.ja, ['{n}チェイン！！ 見事じゃ', '止まらぬのう！！', 'あっぱれじゃ！！！']],
  [SAIKA_RAINBOW_ASK_LINES.ja, ['虹ボムを使うかの！？', 'まだ終わらぬぞ！', '今こそ使うのじゃ！']],
  [SAIKA_RAINBOW_SAVE_LINES.ja, ['助かったぞよ！', 'まだゆけるぞい！', '持ち直したのう！']],
  [CLEAR_LINES, ['やったぞよ！', 'あっぱれじゃ！', '見事じゃのう！']],
  [[MISSION_LAST_ENEMY.ja, MISSION_LAST_TRY.ja, MISSION_HALF.ja], ['あと1体じゃ！', 'あと1回じゃ！', '半分まで来たのう！']],
  [[FEVER_AWAKEN_LINE.ja, RAINBOW_HINT_LINE.ja, '虹ボムをGET！'],
    ['見よ！サイカも覚醒じゃ！', 'スコアモードで虹ボムを得るのじゃ', '虹ボムを得たぞよ！']],
  [[BOMB_CALLS.spa1.saika.ja, BOMB_CALLS.spa1.fever.ja, 'スーパー1！'], ['スパ1じゃ！', 'スパ1！ ゆくぞい！', 'スーパー1じゃ！']],
  [[BOMB_CALLS.sla3.saika.ja, BOMB_CALLS.sla3.fever.ja, 'スラッシュ3！'], ['スラ3じゃ！', 'スラ3！ 切りさくぞい！', 'スラッシュ3じゃ！']],
  [[BOMB_CALLS.squ4.saika.ja, BOMB_CALLS.squ4.fever.ja, 'スクウェア4！'], ['スク4じゃ！', 'スク4！ まとめて消すぞい！', 'スクウェア4じゃ！']],
  [[BOMB_CALLS.str6.saika.ja, BOMB_CALLS.str6.fever.ja, 'ストレイト6！'], ['スト6じゃ！', 'イッキツーカン！\nスト6じゃ！', 'ストレイト6じゃ！']],
  [[BOMB_CALLS.nico.saika.ja], ['ニコニコ・フラッシュじゃ！']],
];
const SAGE_SHARED_LINES = new Map(SAGE_SHARED_VOICE.flatMap(([sources, lines]) => sources.map((source, index) => [source, lines[index]] as const)));
const sageSpokenLine = (text: string, lang: Lang, sage: boolean): string => {
  if (!sage || lang !== 'ja') return text;
  const exact = SAGE_SHARED_LINES.get(text);
  if (exact) return exact;
  // Preserve the actual chain count. This is a template lookup, never a
  // blanket suffix replacement that could alter another character's wording.
  const count = /^(\d+)チェイン/.exec(text)?.[1];
  if (!count) return text;
  const template = SAGE_SHARED_LINES.get(text.replace(count, '{n}'));
  return template ? template.replace('{n}', count) : text;
};

// フタツメ（2）とゴモク（5）だけの手書き台詞。共有原文は他の話者のために残す。
const DICE_KANSAI_VOICE: ReadonlyArray<readonly [string, string]> = [
  [TUTOR_RESCUE.ja, 'サイカ 助けに来たで！'],
  [KOI_LINES.intro.ja, 'コイツメの倒し方 教えたる！'],
  [KOI_LINES.demo.ja, 'コイツメのとなりで7や！\nいっしょに消えるで！'],
  [KOI_LINES.demoCleared.ja, 'せやろ？ コイツメも消えたやろ'],
  [KOI_LINES.go.ja, 'ほな コイツメのとなりで7や！'],
  [KOI_LINES.again.ja, 'もっかい！ となりで7や！'],
  [KOI_LINES.miss.ja, '惜しいで！\nコイツメのすぐとなりで7や！'],
  [KOI_LINES.wipe.ja, '全部消すで！ もっかいや！'],
  [KOI_LINES.mission.ja, 'ミッションや！\nコイツメを3体倒すで！'],
  [KOI_LINES.nice.ja, '倒したで！ ええ調子や！'],
  [KOI_LINES.more.ja, 'コイツメのお出ましや！'],
  [KOI_LINES.reset.ja, 'いったん消しまっせ'],
  [IDLE_KOITSUME.ja[0], 'コイツメのとなりで7や！'],
  [IDLE_KOITSUME.ja[1], 'まとめてやっつけたろ！'],
  ['となり合うメを7にして\nコイツメにくらわせて！', 'となり合うメを7にして\nコイツメにくらわせたれ！'],
  ['サイリアン・コイツメをやっつけよう！\nとなりで7をつくって攻撃！', 'サイリアン・コイツメを倒すで！\nとなりで7をつくって攻撃や！'],
  ['となり合うメを7にして！', 'となり合うメを7にするんや！'],
  [SAIKA_STORY_LINES.ja[0], 'となりと足して7やで！'],
  [SAIKA_STORY_LINES.ja[1], '[1]と[6]で7や！\f[2]と[5]でも7やし\n[3]と[4]でも7やで！'],
  [SAIKA_STORY_LINES.ja[2], '7になるサイは同じ色でっせ'],
  [IDLE_BERABOU.ja[0], '目がひらく前に攻めるで！'],
  [IDLE_BERABOU.ja[1], 'さいごの目はひっさつメや！'],
  [IDLE_FEVER.ja[0], 'ゲージがたまればFEVERや！'],
  [BERABOU_LINES.appear.ja, 'ベラボウメや！ 目が9つやて！'],
  [BERABOU_LINES.howto.ja, 'となりで7を作るたび\n目が1つずつ減るんや！'],
  [BERABOU_LINES.defeat.ja, 'よっしゃ！ ベラボウメ退治や！'],
  [BERABOU_HEAL_LINES.warn.ja, 'はよ攻めな\n目がひらいてまうで！'],
  [BERABOU_HEAL_LINES.heal.ja, 'あかん！ 目がひらいてもうた！'],
  [BERABOU_GUARD_LINE.ja, 'ふつうの7はきかへん！\nひっさつメで決めるで！'],
  [BERABOU_LAST_LINE.ja, 'のこり1コ！ さいごの目は\nひっさつメでしか減らへんで！'],
  ['きいてる！のこり{n}コ！', 'きいてるで！ のこり{n}コや！'],
  [SAIKA_HELLO_LINES.ja[0], 'まいど！ 今日もよろしゅう！'],
  [SAIKA_HELLO_LINES.ja[1], 'ほな 始めまっか！'],
  [SAIKA_HELLO_LINES.ja[2], '今日もころがすで～'],
  [SAIKA_HELLO_LINES.ja[3], 'サイノメ・セヴンやで！'],
  [SAIKA_IDLE_LINES.ja[0], 'となりどうしで7にするんや'],
  [SAIKA_IDLE_LINES.ja[1], 'あせらんでええで～'],
  [SAIKA_IDLE_LINES.ja[2], 'ぼちぼちいきまひょ'],
  [SAIKA_IDLE_LINES.ja[3], 'つぎは何が来るんやろ'],
  [SAIKA_IDLE_LINES.ja[4], 'さよけ なるほどな'],
  [SAIKA_SMILE_LINES.ja[0], 'ええ感じでんがな♪'],
  [SAIKA_SMILE_LINES.ja[1], 'やるやんけ～'],
  [SAIKA_SMILE_LINES.ja[2], 'その調子やでしかし'],
  [SAIKA_SMILE_LINES.ja[3], 'ごきげんさんや♪'],
  [SAIKA_CHAIN_LINES.ja[0], '{n}チェイン！ やるやん'],
  [SAIKA_CHAIN_LINES.ja[1], 'わはは 止まらへん！'],
  [SAIKA_CHAIN_LINES.ja[2], '{n}チェイン きたでー！'],
  [SAIKA_BIG_CHAIN_LINES.ja[0], '{n}チェイン いったれ！'],
  [SAIKA_BIG_CHAIN_LINES.ja[1], 'ふんばってや～！'],
  [SAIKA_BIG_CHAIN_LINES.ja[2], 'まだまだいけまっせ！'],
  [SAIKA_BIG_CHAIN_LINES.ja[3], '勝負どころや！'],
  [SAIKA_SURPRISE_LINES.ja[0], 'ニコニコメ まだかいな'],
  [SAIKA_SURPRISE_LINES.ja[1], 'なんや 今の！？'],
  [SAIKA_SURPRISE_LINES.ja[2], 'そこに置くんかいな！？'],
  [SAIKA_WORRY_LINES.ja[0], 'あかん 積みすぎや！'],
  [SAIKA_WORRY_LINES.ja[1], 'ちょい危ないで'],
  [SAIKA_WORRY_LINES.ja[2], 'えらい狭なったなぁ'],
  [SAIKA_WORRY_LINES.ja[3], 'ニコニコメ 来てんか～'],
  [SAIKA_RELIEF_LINES.ja[0], 'ふぅ～ 助かったわ～'],
  [SAIKA_RELIEF_LINES.ja[1], '危ないとこやったなぁ'],
  [SAIKA_RELIEF_LINES.ja[2], '戻れたやんか'],
  [SAIKA_PRAISE_LINES.ja[0], 'どないや！'],
  [SAIKA_PRAISE_LINES.ja[1], 'キマったで～！'],
  [SAIKA_PRAISE_LINES.ja[2], 'ケーサンどおりや♪'],
  [SAIKA_PRAISE_LINES.ja[3], 'ええウデしてまんな♪'],
  [SAIKA_FEVER_PRAISE_LINES.ja[0], 'がははっ 決まったで！'],
  [SAIKA_FEVER_PRAISE_LINES.ja[1], 'もう最高でんがな！'],
  [SAIKA_FEVER_PRAISE_LINES.ja[2], 'やったやないか～！'],
  [SAIKA_FEVER_IDLE_LINES.ja[0], 'フィ～バ～やで！'],
  [SAIKA_FEVER_IDLE_LINES.ja[1], '今がチャンスでっせ♪'],
  [SAIKA_FEVER_IDLE_LINES.ja[2], 'みんな光ってまんがな～'],
  [SAIKA_FEVER_IDLE_LINES.ja[3], 'どんどんいきまひょ！'],
  [SAIKA_FEVER_IDLE_LINES.ja[4], '調子出てきたで～！'],
  [SAIKA_FEVER_SMILE_LINES.ja[0], 'ええで ええで～！'],
  [SAIKA_FEVER_SMILE_LINES.ja[1], 'その調子でっせ～！'],
  [SAIKA_FEVER_SMILE_LINES.ja[2], 'もっといけるで～！'],
  [SAIKA_FEVER_SMILE_LINES.ja[3], '熱いやないか～！'],
  [SAIKA_FEVER_CHAIN_LINES.ja[0], '{n}チェイン！！ えらいこっちゃ'],
  [SAIKA_FEVER_CHAIN_LINES.ja[1], '止まりまへんで～！！'],
  [SAIKA_FEVER_CHAIN_LINES.ja[2], '最高やないか～！！！'],
  [SAIKA_RAINBOW_ASK_LINES.ja[0], '虹ボム 使うか！？'],
  [SAIKA_RAINBOW_ASK_LINES.ja[1], 'まだ終われへんで！'],
  [SAIKA_RAINBOW_ASK_LINES.ja[2], 'いまや！ つこて～っ！'],
  [SAIKA_RAINBOW_SAVE_LINES.ja[0], '助かったで～！'],
  [SAIKA_RAINBOW_SAVE_LINES.ja[1], 'まだいけまっせ！'],
  [SAIKA_RAINBOW_SAVE_LINES.ja[2], '生き返ったわ～！'],
  [RAINBOW_HINT_LINE.ja, '虹ボムGETや！'],
  ['虹ボムをGET！', '虹ボムもろたで！'],
  [FEVER_AWAKEN_LINE.ja, '見てみぃ！ サイカも覚醒や‼︎'],
  [MISSION_LAST_ENEMY.ja, 'あと1体でっせ！'],
  [MISSION_LAST_TRY.ja, 'あと1回やで！'],
  [MISSION_HALF.ja, '半分まで来たで！'],
  [BOMB_CALLS.spa1.saika.ja, 'スパ1や！'],
  [BOMB_CALLS.spa1.fever.ja, 'スパ1！ いてまえ～！'],
  [BOMB_CALLS.sla3.saika.ja, 'スラ3や！'],
  [BOMB_CALLS.sla3.fever.ja, 'スラ3！ ざっくりや！'],
  [BOMB_CALLS.squ4.saika.ja, 'スク4や！'],
  [BOMB_CALLS.squ4.fever.ja, 'スク4！ ガッツリやで！'],
  [BOMB_CALLS.str6.saika.ja, 'スト6や！'],
  [BOMB_CALLS.str6.fever.ja, 'イッキツーカン！\nスト6でんがな！'],
  [BOMB_CALLS.nico.saika.ja, 'ニコニコ・フラッシュや！'],
  ...CLEAR_LINES.map(source => [source, 'よっしゃ‼︎'] as const),
];
const DICE_KANSAI_LINES = new Map(DICE_KANSAI_VOICE);
export const diceSpokenLine = (text: string, lang: Lang, value?: number): string => {
  if (lang !== 'ja' || (value !== 2 && value !== 5)) return text;
  const exact = DICE_KANSAI_LINES.get(text);
  if (exact) return exact;
  // Match only authored templates; preserve the actual count and all other text.
  const count = /^(\d+)チェイン/.exec(text)?.[1]
    ?? /^きいてる！のこり(\d+)コ！$/.exec(text)?.[1];
  if (!count) return text;
  const template = DICE_KANSAI_LINES.get(text.replace(count, '{n}'));
  return template ? template.replace('{n}', count) : text;
};


/** Review uses the actual dialogue constants, including replay with learned powers. */
export function storyDialogueForReview(stage: number): Array<{ timing: string; speaker: string; text: string }> {
  const mission = wallMission(stage);
  if (!mission) return [];
  const script = stage === WALL_LESSON ? WALL_LESSON : mission.sourceStage ?? stage;
  const result: Array<{ timing: string; speaker: string; text: string }> = [];
  const pair = TUTOR_PAIRS[script];
  const defaultSpeaker = BOMB_LESSONS[script] || script === RAINBOW_STAGE || script === THUNDER_LESSON ? 'ゾロメ仙人' : pair ? pair.map(value => SAI_NAMES[value - 1]).join('＋') + '（交互）' : 'サイカ';
  const add = (timing: string, value: unknown, speaker = defaultSpeaker) => {
    const visit = (v: unknown): void => {
      if (typeof v === 'string') result.push({ timing, speaker, text: v });
      else if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === 'object') {
        const obj = v as Record<string, unknown>;
        if ('ja' in obj) visit(obj.ja); else Object.values(obj).forEach(visit);
      }
    }; visit(value);
  };
  if (script === THUNDER_LESSON) add('イチニノサンダー講習', [THUNDER_LESSON_LINES, THUNDER_DEMO_AFTER]);
  if (pair && mission.anchikushoume) add('アンチクショウメの倒し方', ANCHI_HOWTO_LINES);
  if (pair) {
    if (TUTOR_PANIC[script]) add('敵に出会った時', TUTOR_PANIC[script], 'サイカ');
    add('助っ人登場', TUTOR_RESCUE);
    if (mission.sourceStage === undefined) {
      if (mission.enemies.some(enemy => enemy.kind === 'koitsume') && stage !== 26) add('初挑戦：倒し方', KOI_LINES.demo);
      if (mission.enemies.some(enemy => enemy.kind === 'dame')) add('初挑戦：倒し方', DAME_LINES.demo);
    }
  }
  add('待機・開始時', storyIdleLinesFor(stage));
  add('セヴン目消去', SAIKA_SMILE_LINES);
  add('2〜3連鎖（{n}は連鎖数）', stage === 20 ? WALL_FIRST_CHAIN_LINES : SAIKA_CHAIN_LINES);
  add('4連鎖以上（{n}は連鎖数）', SAIKA_BIG_CHAIN_LINES);
  add('ニコニコメ出現', SAIKA_SURPRISE_LINES.ja[0]);
  add('技の成功後', SAIKA_PRAISE_LINES);
  add('クリア結果', script === WALL_LESSON ? 'スーパー1 皆伝じゃ！' : CLEAR_LINES);
  const goal = STORY_STAGES[script].goal;
  if (mission.kind === 'lesson' && !['tutorial', 'score', 'rainbow', 'berabou'].includes(goal.type)) {
    const target = goal.type === 'wall'
      ? wallObjectiveProgress(mission, emptyWallCounts(), 0, 0, mission.enemies.length)[1]
      : 'target' in goal ? goal.target : STORY_STAGES[script].enemies.length;
    if (target >= 2) add('進捗：残り1回・1体', ['koitsume', 'dame', 'defeat', 'hidoime', 'fever', 'waves'].includes(goal.type) ? MISSION_LAST_ENEMY : MISSION_LAST_TRY);
    if (target >= 4) add('進捗：半分', MISSION_HALF);
  }
  // Powers acquired later remain usable when replaying an earlier mission.
  add('技習得後の再プレイ：掛け声', Object.values(BOMB_CALLS).map(call => [call.saika, call.fever]));
  add('FEVER習得後の再プレイ', [SAIKA_FEVER_IDLE_LINES, SAIKA_FEVER_SMILE_LINES, SAIKA_FEVER_CHAIN_LINES, SAIKA_FEVER_PRAISE_LINES, FEVER_AWAKEN_LINE]);
  add('虹ボム習得後：使用確認・救済', [SAIKA_RAINBOW_ASK_LINES, SAIKA_RAINBOW_SAVE_LINES, RAINBOW_HINT_LINE]);
  add('虹ボム獲得', rainbowAwardLine('ja', 1));
  const lesson = BOMB_LESSONS[script];
  if (lesson) {
    add('講習：お手本', lesson.lines.opening);
    if (lesson.kind !== 'nico' && lesson.kind !== 'thunder') add('講習：技の掛け声', `${BOMB_FULL_NAMES[lesson.kind].ja}！`);
    if (script === WALL_LESSON) add('講習：ミッション・救済', [lesson.lines.mission, lesson.lines.missionNice, lesson.lines.reset]);
    else add('講習：練習・ミッション・救済', Object.fromEntries(Object.entries(lesson.lines).filter(([key]) => key !== 'opening')));
  }
  if (script === COMBO_STAGE) add('チェイン講習', COMBO_DEMO_LINES);
  if (script === KOI_STAGE) add('コイツメ講習', KOI_LINES);
  if (script === DAME_STAGE) add('ダーメ講習', DAME_LINES);
  if ([HIDOIME_STAGE, NICO_HIDOIME_STAGE, FEVER_STAGE, WAVES_STAGE, SWARM_STAGE, ALLSTAR_STAGE].includes(script)) add('ヒドイメ：登場・命中', HIDOIME_LINES);
  if (script === FEVER_STAGE) add('FEVER講習', FEVER_LINES);
  if (script === WAVES_STAGE) add('連戦：各波の登場', [WAVES_INTRO, WAVES.map(w => w.line)]);
  if (script === SWARM_STAGE) add('ヒドイメ大群', SWARM_LINES);
  if (script === RAINBOW_STAGE) add('虹ボム講習', [RAINBOW_LESSON_LINES, RAINBOW_LESSON_ASK, RAINBOW_LESSON_SAVED]);
  if ([BERABOU_STAGE, ALLSTAR_STAGE].includes(script)) add('ベラボウメ：登場・攻撃・回復', [BERABOU_LINES, BERABOU_HEAL_LINES, BERABOU_GUARD_LINE, BERABOU_LAST_LINE, { ja: berabouHitLine(7).ja.replace('7', '{n}') }]);
  if ([DETARAME_STAGE, ALLSTAR_STAGE].includes(script)) add('デタラメ：登場・攻撃・封印', [DETARAME_LINES, DETARAME_SEALED_LINES, { ja: detarameHitLine(3).ja.replace('3', '{n}') }]);
  if (script === ALLSTAR_STAGE) add('総出演', ALLSTAR_LINES);
  // 登場前の予感だけは、本体で who: 'saika' を明示している。
  const saikaSenses = new Set([HIDOIME_LINES.sense.ja, BERABOU_LINES.sense.ja, DETARAME_LINES.sense.ja, RAINBOW_LESSON_LINES[0].ja]);
  result.forEach(line => {
    if (saikaSenses.has(line.text)) line.speaker = 'サイカ';
    line.text = sageSpokenLine(line.text, 'ja', line.speaker === 'ゾロメ仙人');
    if (line.speaker === defaultSpeaker) line.text = diceSpokenLine(line.text, 'ja', pair?.[0]);
  });
  const unique = new Map<string, { timing: string; speaker: string; text: string }>();
  result.forEach(line => {
    const pages = line.text.split('\f');
    pages.forEach((text, i) => { if (!unique.has(text)) unique.set(text, { ...line, text, timing: pages.length > 1 ? `${line.timing}・${i + 1}回目` : line.timing }); });
  });
  return [...unique.values()];
}

export default function App() {
  const pieceId = useRef(1);
  const isResolving = useRef(false);
  const [board, setBoard] = useState<Board>(() => emptyBoard());
  const [current, setCurrent] = useState<Piece>(() => createPiece(0));
  const currentRef = useRef(current);
  currentRef.current = current;
  const [nextPiece, setNextPiece] = useState<Piece>(() => createPiece(1));
  const [score, setScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [level, setLevel] = useState(1);
  // レベルはセヴン消しの得点だけで上がる。
  // ボムは1発で万単位入るため、混ぜるとレベルが跳ね上がって難易度が破綻する。
  const [levelScore, setLevelScore] = useState(0);
  const [fever, setFever] = useState(20);
  const [status, setStatus] = useState<GameStatus>('ready');
  // ストーリーモードで遊んでいるコロ（1〜）。null ならエンドレス
  const [story, setStory] = useState<number | null>(null);
  const storyRef = useRef<number | null>(null);
  storyRef.current = story;
  // 敵の倒し方を教えるサイノメの組。セリフが変わるたびに話し手が入れかわる
  const tutorPair = story !== null ? TUTOR_PAIRS[story] : undefined;
  const [tutorTurn, setTutorTurn] = useState(1);
  // このコロで決めたチェイン（2連鎖以上）の回数
  const [storyCombos, setStoryCombos] = useState(0);
  const storyCombosRef = useRef(0);
  // クリア済みの一番先のコロ。次のコロまで遊べる
  const [storyCleared, setStoryCleared] = useState(loadStoryCleared);
  const storyClearedRef = useRef(storyCleared);
  storyClearedRef.current = storyCleared;
  // エンディング（9-3をクリアしたあと、またはマップの王座から）
  const [showEnding, setShowEnding] = useState<false | 'omote' | 'ura'>(false);
  // エンディング（エンドロールの最後まで）を見たか。見たあとは王座に「？？？」（ウラメンの入口）が出る
  const [endingSeen, setEndingSeen] = useState(loadEndingSeen);
  // 「？？？」を押したあとの、サイカが落ちていく演出
  const [uraFall, setUraFall] = useState(false);
  const [showStages, setShowStages] = useState(() => ['map', 'linear'].includes(new URLSearchParams(location.search).get('story') || ''));
  const [storyLayout, setStoryLayout] = useState<'map' | 'linear'>(() => new URLSearchParams(location.search).get('story') === 'linear' ? 'linear' : 'map');
  const storyLayoutRef = useRef(storyLayout); storyLayoutRef.current = storyLayout;
  const mapRun = useRef(false);
  const storyRunRef = useRef(0);
  const runTimeout = (callback: () => void, ms: number) => {
    const run = storyRunRef.current;
    return window.setTimeout(() => {
      if (run === storyRunRef.current) callback();
    }, ms);
  };
  // Keep map identity separate from the old lesson/enemy script identity.
  const mapStageRef = useRef<number | null>(null);
  const [mapStage, setMapStage] = useState<number | null>(null);
  const sanzMode = sanzPractice || !!wallMission(mapStage)?.sanzapparaname;
  const [lastMapStage, setLastMapStage] = useState<number | undefined>(undefined);
  const [wallProgress, setWallProgress] = useState(loadWallProgress);
  const wallProgressRef = useRef(wallProgress); wallProgressRef.current = wallProgress;
  const wallCounts = useRef(emptyWallCounts());
  const wallEnemySpawned = useRef(0);
  const wavePending = useRef(0); // Scheduled small enemies that could not fit yet.
  const campaignGeneratedEnemies = useRef(0); // Each successful Detarame conversion adds one enemy.
  // 追加のコイツメがまだ降っていなければ、その数（残りの敵に数える）
  const wallReinforcePending = useRef(0);
  const [wallCountsView, setWallCountsView] = useState(emptyWallCounts);
  const mapPowers = () => enemyPractice ? ['spa1', 'sla3', 'squ4', 'str6', 'nico', 'fever', 'thunder'] : mapRun.current ? wallAbilities(wallProgressRef.current.cleared, mapStageRef.current ?? undefined) : undefined;
  const activeMission = wallMission(mapStage);
  const mapRainbowOpen = () => mapPowers()?.includes('rainbow') ?? false;
  const [stageIntro, setStageIntro] = useState<number | null>(null);
  const showStageIntro = (stage: number) => {
    setStageIntro(stage);
    runTimeout(() => setStageIntro(null), 1800);
  };
  const [comboFx, setComboFx] = useState<{ n: number; key: number } | null>(null);
  // 命中した敵。一瞬だけ白く弾ませる
  const [hitCells, setHitCells] = useState<Set<string>>(() => new Set());
  // ヒドイメ。見た目（泡の量＝残りHP、倒れたあとの演出）は group ごとに持つ
  type HidoimeItem = {
    variant: HidoimeVariant;
    seed: number;
    hp: number;
    dying: boolean; // HPが0になり、はじけて消える演出の最中
    entering: boolean; // 奥からぶち破って出てくる最中
    pos: Position; // 倒れたあと・出てくるときに使う位置（生きている間は盤面から求める）
    move?: 'none' | 'fall' | 'press' | 'land'; // 出てくるときの動き
    moveMs?: number; // その動きで次の位置まで移る長さ
  };
  const [hidoimeView, setHidoimeView] = useState<Map<number, HidoimeItem>>(() => new Map());
  const [hidoimeHit, setHidoimeHit] = useState<Set<number>>(() => new Set());
  const [pressCells, setPressCells] = useState<Set<string>>(() => new Set()); // ヒドイメに押しつぶされているメ
  // 押しつぶされたメから飛び散る粒。メが盤面から消えたあとも、粒は飛び切るまで残す
  const [pressBursts, setPressBursts] = useState<Map<string, BurstParticle[]>>(() => new Map());
  // 命中のあいだ、ヒドイメの中の動きを早送りにして「もがく」
  useEffect(() => {
    if (hidoimeHit.size === 0) return;
    const restores = [...document.querySelectorAll('.hidoime-slot.is-hit > .hidoime')].map((root) =>
      hurryHidoime(root),
    );
    return () => {
      restores.forEach((restore) => restore());
    };
  }, [hidoimeHit]);
  const hidoimeHp = useRef(new Map<number, number>());
  const hidoimeDefeated = useRef(0);
  // 17メン：ベラボウメ（1体だけ）
  type BerabouItem = {
    hp: number;
    dying: boolean;
    entering: boolean;
    pos: Position;
    variant: BeraboumeVariant;
    reopen?: number; // いま開き直った目（0〜8）
  };
  const [berabouView, setBerabouView] = useState<BerabouItem | null>(null);
  const [berabouHit, setBerabouHit] = useState(false);
  const [berabouRaging, setBerabouRaging] = useState(false);
  const berabouRageRun = useRef(0); // リセット・再登場で古い暴れ処理を無効にする
  const [berabouGuard, setBerabouGuard] = useState(false); // 最後の目が、ひっさつメ以外をはね返した
  const berabouIdle = useRef(0); // ダメージを受けずに過ぎた手数（回復までのカウント）
  const berabouHp = useRef(BERABOU_HP);
  const berabouDefeated = useRef(0);
  const [berabouDefeatedView, setBerabouDefeatedView] = useState(0);
  // ベラボウメに弾き飛ばされているメ（値は飛んでいく向き。3×3のまん中から外へ）
  const [flingCells, setFlingCells] = useState<Map<string, Position>>(() => new Map());
  // 18メン：デタラメ（1体だけ）。段の状態（目の向き・目が残っているか）と、いる列・いちばん上の段を持つ。
  // 盤面のマスには DETARAME を置き、身体のつながった絵は重ねて描く
  type DetarameState = {
    id: number; // 同時に何体も出るので、1体ずつ見分ける（盤面のマスの group にも使う）
    segs: DetarameSegment[]; // 上の段から順に
    x: number;
    top: number;
    variant: DetarameVariant;
    turns: number; // 出てきてからの手数（伸びる間隔に使う）
    born?: number; // いま下に生まれた段
    absorbing?: boolean; // いちばん上の目へ、サイを吸い込んでいる最中
    entering?: boolean; // 下から伸びて出てくる最中
    dying?: boolean;
  };
  // 盤面にかぶせる擬音。x・y は文字の中心（マス単位。x=3.5 が盤面のまん中）
  const [sfx, setSfx] = useState<{ id: SfxId; x: number; y: number; key: number } | null>(null);
  const showSfx = (id: SfxId, x: number, y: number) => {
    const key = performance.now();
    setSfx({ id, x, y, key });
    runTimeout(() => setSfx((prev) => (prev && prev.key === key ? null : prev)), SFX_MS);
  };
  // デタラメは同時に何体も出られる（ウォール6-3・6-4）。1体ずつ id で見分ける
  const [detarameViews, setDetarameViews] = useState<DetarameState[]>([]);
  const detaramesRef = useRef<DetarameState[]>([]);
  const setDetarames = (next: DetarameState[]) => {
    detaramesRef.current = next;
    setDetarameViews(next);
  };
  // その id の1体を置き換える（null で取り除く）。id が無ければ追加する
  const updateDetarameById = (id: number, next: DetarameState | null) => {
    const list = detaramesRef.current;
    const exists = list.some((d) => d.id === id);
    setDetarames(
      next === null ? list.filter((d) => d.id !== id) : exists ? list.map((d) => (d.id === id ? next : d)) : [...list, next],
    );
  };
  // 以前からの呼び方：null ならぜんぶ消す、そうでなければその1体を置き換える
  const updateDetarame = (next: DetarameState | null) => {
    if (next === null) setDetarames([]);
    else updateDetarameById(next.id, next);
  };
  const detarameGroup = (id: number) => DETARAME_GROUP - id;
  const nextDetarameId = useRef(0);
  const detarameSpawned = useRef(0); // このメンで出てきたデタラメの数（6-3は5体まで）
  // 次のデタラメが出てくる列。ほかの大きな敵がいない列から、なるべく離れた列を選ぶ
  const pickDetarameColumn = (b: Board): number | null => {
    const used = detaramesRef.current.map((d) => d.x);
    const ok = DETARAME_COLUMNS.filter((x) => !used.includes(x) && !b.some((row) => row[x] && isEnemy(row[x]!.value) && row[x]!.value !== KOITSUME && row[x]!.value !== DAME));
    if (ok.length === 0) return null;
    const far = ok.filter((x) => used.every((u) => Math.abs(u - x) > 1));
    const pool = far.length > 0 ? far : ok;
    return pool[Math.floor(Math.random() * pool.length)];
  };
  const [detarameHit, setDetarameHit] = useState<Map<number, Set<number>>>(() => new Map());
  const [detarameFiring, setDetarameFiring] = useState<Map<number, Set<number>>>(() => new Map());
  type DetarameBeam = { row: number; from: number; to: number; dir: -1 | 1; retract: boolean; variant: DetarameVariant };
  const [detarameBeams, setDetarameBeams] = useState<DetarameBeam[]>([]);
  const [rewriteCells, setRewriteCells] = useState<Set<string>>(() => new Set()); // ビームで敵に変わるサイ
  const [absorbCell, setAbsorbCell] = useState<{ key: string; dx: number; dy: number } | null>(null);
  // デタラメの登場で、いっぺんに捕食されるサイ
  const [absorbCells, setAbsorbCells] = useState<Map<string, { dx: number; dy: number }>>(() => new Map());
  const detarameTurn = useRef(0); // プレイヤーの手数（伸びる間隔に使う）
  const detarameDefeated = useRef(0);
  // --- アンチクショウメ（ウォール6-2） ---
  type AnchiState = { sizeIndex: number; eye: Position; turn: number; dying: boolean };
  const anchiRef = useRef<AnchiState | null>(null);
  const [anchiView, setAnchiView] = useState<AnchiState | null>(null);
  const [anchiHit, setAnchiHit] = useState(false);
  const [anchiHitTone, setAnchiHitTone] = useState<'white' | 'thunder'>('white');
  const anchiEyeMotion = useRef<{ from: Position; to: Position; elapsed: number } | null>(null);
  const anchiDefeated = useRef(0);
  const [sanzElapsed, setSanzElapsed] = useState(-1);
  const [sanzShots, setSanzShots] = useState<SanzShot[]>([]);
  const sanzPeriod = useRef(3);
  const sanzEnemySerial = useRef(0);
  // 着地は演出の終了とは別。盤面へ確定した敵は飛翔SVGの片付けでは消さない。
  const landSanzShot = (b: Board, shot: SanzShot): Board => {
    const previous = b[shot.y]?.[shot.x];
    if (!b[shot.y] || shot.x < 0 || shot.x >= COLS) return b;
    // 大型敵の身体は壊さない。通常サイは着地した小敵で置き換える。
    if (previous && previous.value < DAME) return b;
    const serial = ++sanzEnemySerial.current;
    const next = b.map(row => [...row]);
    next[shot.y][shot.x] = { id: `sanz-eject-${serial}`, value: shot.dame ? DAME : KOITSUME, group: -1000000 - serial };
    // 同じマスへ続けて着地して小敵を置換しても、撃破数は増やさない。
    if (mapRun.current && previous?.value !== KOITSUME && previous?.value !== DAME) campaignGeneratedEnemies.current += 1;
    setBoard(next);
    return next;
  };
  // 白いダメージの光（当たったマス）と、目を細める合図
  const [anchiFlash, setAnchiFlash] = useState<{ id: number; cells: Position[] } | null>(null);
  const anchiFlashId = useRef(0);
  const anchiHitGeneration = useRef(0);
  const flashAnchi = (points: Position[], b: Board, tone: 'white' | 'thunder' = 'white') => {
    if (points.length === 0) return;
    const id = (anchiFlashId.current += 1);
    setAnchiHitTone(tone);
    setAnchiFlash({ id, cells: points });
    const run = storyRunRef.current;
    void delay(340).then(() => { if (run === storyRunRef.current) setAnchiFlash((prev) => (prev?.id === id ? null : prev)); });
    // 目のマスに当たったら、図鑑と同じく目を細める
    if (sanzMode || anchiEyeIn(points, b)) {
      const hitGeneration = ++anchiHitGeneration.current;
      setAnchiHit(true);
      void delay(520).then(() => { if (run === storyRunRef.current && anchiHitGeneration.current === hitGeneration) setAnchiHit(false); });
    }
  };
  type AnchiPaint = { id: number; x: number; y: number; shape: number; dx: number; dy: number; age: number; life: number; phase: 'flying' | 'spreading' | 'resting' | 'fading' };
  const [anchiPaints, setAnchiPaints] = useState<AnchiPaint[]>([]);
  const anchiPaintsRef = useRef<AnchiPaint[]>([]);
  const anchiPaintId = useRef(0);
  const updatePaints = (next: AnchiPaint[]) => {
    anchiPaintsRef.current = next;
    setAnchiPaints(next);
  };
  // 近くのサイへペンキを飛ばす。前のペンキが残っているあいだは飛ばさない（盤面ぜんぶを覆わない）
  const throwAnchiPaint = (b: Board, rect: { x: number; y: number; w: number; h: number }) => {
    if (anchiPaintsRef.current.length > 0) return;
    const targets: Position[] = [];
    b.forEach((row, y) => row.forEach((cell, x) => {
      if (!cell || cell.value <= 0) return;
      const dx = Math.max(rect.x - x, 0, x - (rect.x + rect.w - 1));
      const dy = Math.max(rect.y - y, 0, y - (rect.y + rect.h - 1));
      if (Math.max(dx, dy) <= ANCHI_PAINT_RANGE) targets.push({ x, y });
    }));
    const count = Math.min(targets.length, 2 + Math.floor(Math.random() * 2));
    if (count === 0) return;
    const picked = targets.sort(() => Math.random() - 0.5).slice(0, count).map((point) => ({
      id: (anchiPaintId.current += 1),
      ...point,
      shape: ANCHI_PAINT_SHAPES[Math.floor(Math.random() * ANCHI_PAINT_SHAPES.length)],
      dx: rect.x + (rect.w - 1) / 2 - point.x,
      dy: rect.y + (rect.h - 1) / 2 - point.y,
      age: 0, life: 3580 + Math.random() * 2000, phase: 'flying' as const,
    }));
    updatePaints(picked);
    if (soundModeRef.current !== 'none') playPaintLaunchSound();
  };
  const updateAnchi = (next: AnchiState | null) => {
    anchiRef.current = next;
    setAnchiView(next);
  };
  // 盤面の上のアンチクショウメの範囲（左上と大きさ）。落下で動くので、毎回盤面から求める
  const anchiRect = (b: Board) => {
    let x0 = COLS, y0 = ROWS, x1 = -1, y1 = -1;
    b.forEach((row, y) => row.forEach((cell, x) => {
      if (cell?.value !== ANCHI) return;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }));
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  };
  // 目の行き先は上辺と左右辺。最下段の角も除外する。
  const pickAnchiEye = (w: number, h: number, prev?: Position): Position => {
    const spots = anchiEyeCells(w, h);
    const moved = spots.filter((spot) => !prev || spot.x !== prev.x || spot.y !== prev.y);
    const pool = moved.length > 0 ? moved : spots;
    return pool[Math.floor(Math.random() * pool.length)];
  };
  // ひっさつメの範囲が目のマスに入っているか
  const anchiEyeIn = (points: Position[], b: Board) => {
    const a = anchiRef.current;
    const rect = a && !a.dying ? anchiRect(b) : null;
    if (!a || !rect) return false;
    if (sanzMode) return points.some(point => point.x === 3 && point.y === rect.y + rect.h - 1);
    const visibleCell = anchiEyeCell(rect.w, rect.h, a.eye);
    const ex = rect.x + visibleCell.x;
    const ey = rect.y + visibleCell.y;
    return points.some((point) => point.x === ex && point.y === ey);
  };
  // ANCHI_GROW_TURNS 手ごとに隣のサイを食べて広がる（食べるサイが無ければ広がらない）。
  const growAnchi = async (b: Board): Promise<Board> => {
    const run = storyRunRef.current;
    const a = anchiRef.current;
    const rect = a ? anchiRect(b) : null;
    if (!a || !rect) return b;
    const turn = a.turn + 1;
    if (sanzMode) {
      updateAnchi({...a,turn});
      if(turn % sanzPeriod.current !== 0)return b;
      const mission=wallMission(mapStageRef.current);
      const count=Math.min(mission?.sanzVolley ?? 6,Math.max(2,2*(sanzPeriod.current-1)-Math.floor(Math.random()*2)));
      const shots:SanzShot[]=[];
      for(let i=0;i<count;i++){
        const x=(i+turn)%COLS;
        const top=b.findIndex(row=>row[x]!==null);
        const y=(top<0?ROWS:top)-1;
        if(y>=0)shots.push({x,y,dame:i%2===1,delay:i*12});
      }
      setSanzShots(shots);
      setSaika({text:langRef.current==='ja'?'また出した！さんざっぱら出てくるね！':'It erupted again!',mood:'surprise',who:'saika'});
      let next = b;
      const landed = new Set<number>();
      for (let ms = 0; ms <= 2280; ms += 40) {
        // SVGの軌道と同じ280ms開始＋1476ms飛行で、着地した個体から確定する。
        shots.forEach((shot, i) => {
          if (landed.has(i) || ms < 280 + shot.delay + 1476) return;
          next = landSanzShot(next, shot);
          landed.add(i);
        });
        setSanzShots(shots.map((shot, i) => ({ ...shot, landed: landed.has(i) })));
        setSanzElapsed(ms);
        await delay(40);
        if (run !== storyRunRef.current) return b;
      }
      setSanzElapsed(-1);setSanzShots([]);sanzPeriod.current=mission?.sanzTurns ?? 2+Math.floor(Math.random()*3);
      updateAnchi({...a,turn:0});return next;
    }
    let next = b;
    let sizeIndex = a.sizeIndex;
    if (turn % ANCHI_GROW_TURNS === 0 && sizeIndex < ANCHI_SIZES.length - 1) {
      const [nw, nh] = ANCHI_SIZES[sizeIndex + 1];
      let best: { x: number; y: number; food: number } | null = null;
      for (let oy = 0; oy <= nh - rect.h; oy += 1) {
        for (let ox = 0; ox <= nw - rect.w; ox += 1) {
          const x = rect.x - ox;
          const y = rect.y - oy;
          if (x < 0 || y < 0 || x + nw > COLS || y + nh > ROWS) continue;
          let food = 0;
          let blocked = false;
          for (let yy = y; yy < y + nh && !blocked; yy += 1) for (let xx = x; xx < x + nw; xx += 1) {
            const cell = b[yy][xx];
            if (!cell || cell.value === ANCHI) continue;
            if (isEnemy(cell.value)) { blocked = true; break; }
            food += 1;
          }
          if (!blocked && food > 0 && (!best || food > best.food)) best = { x, y, food };
        }
      }
      if (best) {
        const area = best;
        const eaten = new Map<string, { dx: number; dy: number }>();
        const eyeX = rect.x + a.eye.x, eyeY = rect.y + a.eye.y;
        for (let yy = area.y; yy < area.y + nh; yy += 1) for (let xx = area.x; xx < area.x + nw; xx += 1) {
          if (b[yy][xx] && b[yy][xx]!.value > 0) eaten.set(`${xx},${yy}`, { dx: eyeX - xx, dy: eyeY - yy });
        }
        // デタラメと同じ白い三重リングで、食べたサイが目へ回転して縮む。
        setAbsorbCells(eaten);
        // サイを食べる「ガブッ…モグモグ」
        if (soundModeRef.current !== 'none') playDevourSound(eaten.size);
        await delay(DETARAME_ABSORB_MS);
        if (run !== storyRunRef.current) return b;
        setAbsorbCells(new Map());
        next = b.map((row, y) => row.map((cell, x) =>
          x >= area.x && x < area.x + nw && y >= area.y && y < area.y + nh
            ? { id: `anchi-${x}-${y}`, value: ANCHI, group: ANCHI_GROUP }
            : cell,
        ));
        sizeIndex += 1;
        setBoard(next);
      }
    }
    // 目の移動は手数ではなく時間（ANCHI_EYE_MOVE_MS ごと）。広がったときだけ、新しい外周に置き直す
    if (sizeIndex !== a.sizeIndex) anchiEyeMotion.current = null;
    const grownRect = anchiRect(next) ?? rect;
    updateAnchi({ ...a, turn, sizeIndex, eye: sizeIndex !== a.sizeIndex ? remapAnchiEye(a.eye, rect, grownRect) : a.eye });
    if (turn % 4 === 1) throwAnchiPaint(next, anchiRect(next) ?? rect);
    return next;
  };
  // 目を撃ち抜いた：白く光ってから、はじけて消える
  const defeatAnchi = async (b: Board, tone: 'white' | 'thunder' = 'white'): Promise<Board> => {
    const run = storyRunRef.current;
    const a = anchiRef.current;
    if (!a) return b;
    // 雷の被弾は黄色の点滅と図鑑と同じ表情。他の攻撃は白いフラッシュを維持。
    anchiHitGeneration.current += 1; // 古い接触フラッシュの解除が今回の被弾表情を消さない
    setAnchiHitTone(tone);
    setAnchiHit(true);
    const body: Position[] = [];
    b.forEach((row, y) => row.forEach((cell, x) => { if (cell?.value === ANCHI) body.push({ x, y }); }));
    for (let i = 0; i < ANCHI_DEFEAT_HITS; i += 1) {
      if (tone === 'white') setAnchiFlash({ id: (anchiFlashId.current += 1), cells: body });
      if (soundModeRef.current !== 'none') {
        if (i === 0) playEnemyFlashSound(true);
        playHidoimeHitSound();
      }
      haptics.bomb();
      await delay(ANCHI_DEFEAT_HIT_MS);
      if (run !== storyRunRef.current) return b;
      setAnchiFlash(null);
      await delay(70);
      if (run !== storyRunRef.current) return b;
    }
    setAnchiHit(false);
    haptics.big();
    if (soundModeRef.current !== 'none') playHidoimeDefeatSound();
    updateAnchi({ ...a, dying: true });
    updatePaints([]);
    const next = b.map((row) => row.map((cell) => (cell?.value === ANCHI ? null : cell)));
    setBoard(next);
    anchiDefeated.current = 1;
    setSaika({ text: langRef.current === 'ja' ? (sanzMode ? 'やった！\nサンザッパラナメをやっつけた！' : 'やった！\nアンチクショウメをやっつけた！') : 'Yes!\nYou beat the Anchikushoume!', mood: 'praise' });
    void delay(700).then(() => {
      if (run === storyRunRef.current && anchiRef.current?.dying) updateAnchi(null);
    });
    return next;
  };
  const [detarameDefeatedView, setDetarameDefeatedView] = useState(0);
  // 19メン：いまの段（0=コイツメ・ダーメ、1=ヒドイメ、2=ベラボウメとデタラメ、3=ぜんぶ越えた）
  const allstarPhase = useRef(0);
  const [allstarView, setAllstarView] = useState(0);
  const detarameSealedBy = useRef<string | null>(null); // フタをしたニコニコメ（同じ1つで何度も言わない）
  const detarameLaserShown = useRef(false); // 初めてビームで変えられたときだけ、サイカが知らせる
  // 当たったマスのうち、目が残っている段（上からの番号）
  // デタラメごとに（id → 上からの段の番号）
  const detarameHitIndexes = (points: Position[]) => {
    const struck = new Map<number, Set<number>>();
    detaramesRef.current.forEach((d) => {
      if (d.dying) return;
      points.forEach((point) => {
        const index = point.y - d.top;
        if (point.x === d.x && d.segs[index]?.alive) {
          if (!struck.has(d.id)) struck.set(d.id, new Set());
          struck.get(d.id)!.add(index);
        }
      });
    });
    return struck;
  };
  // 16メン：ヒドイメの大群がもう降ってきたか
  const swarmCleared = useRef(0); // 16メンで消したメの合計
  const swarmSpawned = useRef(0); // 降らせたヒドイメの数
  const swarmPending = useRef(0); // 当たりが出たのに、置き場所がなくて持ち越している数
  // 13メン：FEVER でサイカが覚醒したことを、最初の1回だけ知らせる
  const awakenShown = useRef(false);
  const [hidoimeDefeatedView, setHidoimeDefeatedView] = useState(0);
  const [cellPx, setCellPx] = useState(48);
  // お手本で7になったマス。消す前に点滅させる
  const [demoBlink, setDemoBlink] = useState<Set<string>>(() => new Set());
  const demoBlinkCount = useRef(0); // このメンで、お手本の7を何回点滅させたか
  const [fadeCells, setFadeCells] = useState<Set<string>>(() => new Set()); // 光らずに消えていくメ
  const [spawnCells, setSpawnCells] = useState<Set<string>>(() => new Set()); // いま現れた敵
  const waveRef = useRef(0); // 12メンの、いまの段
  const [waveView, setWaveView] = useState(0);
  // チュートリアルの進み具合。段取りは ref で持ち、画面に出す数だけ state に写す
  const tutorial = useRef({ step: 0, success: 0, miss: 0, target: 1 });
  const [tutorialView, setTutorialView] = useState({ step: 0, success: 0 });
  // お手本で「ここをタップ」を見せる側
  const [tapHint, setTapHint] = useState<'left' | 'right' | 'up' | 'down' | null>(null);
  // お手本の最中はプレイヤーの操作を受け付けない。台本からの操作だけ通す
  const demoLock = useRef(false);
  const scripted = useRef(false);
  type LessonPhase = 'demo' | 'play' | 'mission';
  const bombLesson = useRef({ phase: 'demo' as LessonPhase, success: 0, miss: 0 });
  const [bombView, setBombView] = useState({ phase: 'demo' as LessonPhase, success: 0 });
  const koiLesson = useRef({ phase: 'demo' as LessonPhase, success: 0, miss: 0, target: 1 });
  const [koiView, setKoiView] = useState({ phase: 'demo' as LessonPhase, success: 0 });
  const dameLesson = useRef({
    phase: 'demo' as LessonPhase,
    success: 0,
    miss: 0,
    target: 1,
    start: 2,
    demoStep: 0,
  });
  const [dameView, setDameView] = useState({ phase: 'demo' as LessonPhase, success: 0 });
  const bombLockRef = useRef<(bd: Board, fired: boolean, sc: number) => Promise<void>>(
    async () => undefined,
  );
  const koiLockRef = useRef<(bd: Board, killed: number, sc: number) => Promise<void>>(
    async () => undefined,
  );
  const dameLockRef = useRef<
    (bd: Board, killed: number, damaged: number, sc: number) => Promise<void>
  >(async () => undefined);
  const tutorialLockRef = useRef<(bd: Board, ok: boolean, sc: number) => Promise<void>>(
    async () => undefined,
  );
  // クリアのクラッカー。短い一度きりの紙吹雪を出す
  const [clearFireworks, setClearFireworks] = useState(false);
  // クリアの瞬間からのサイカのひとこと。クリア画面のあいだは、ほかのセリフより優先して出す
  const [clearLine, setClearLine] = useState(CLEAR_LINES[0]);
  // 2メン：チェイン目のお手本の最中か
  const [comboDemo, setComboDemo] = useState(false);
  // お手本の最後は、次のブロックを出さずに止めておく（spawnNext がここを見る）
  const spawnHold = useRef(false);
  const spawnHeld = useRef(false);
  // ゲームオーバーの画面のあいだ、虹ボムの手に入れ方のひとことを出しておく（16メンから先で持っていないとき）
  const [gameoverHint, setGameoverHint] = useState(false);
  const [clearVolley, setClearVolley] = useState(0); // 何回目の花火か（0 は出していない）

  // メンのクリア。進み具合を保存し、ファンファーレと花火を出す
  const completeStage = (stageNo: number, finished: number) => {
    setClearLine(stageNo === WALL_LESSON ? 'スーパー1 皆伝じゃ！' : pickFrom(CLEAR_LINES));
    if (mapRun.current && mapStageRef.current !== null) {
      const completed = mapStageRef.current;
      if (!enemyPractice && !isStoryReview() && !wallUnlocked(completed, wallProgressRef.current.cleared)) return;
      const prev = wallProgressRef.current;
      const next = { ...prev, cleared: [...new Set([...prev.cleared, completed])] };
      wallProgressRef.current = next;
      if (!isStoryReview()) saveWallProgress(next);
      setWallProgress(next);
    } else {
      setStoryCleared((value) => {
        const next = Math.max(value, stageNo);
        saveStoryCleared(next);
        return next;
      });
    }
    setFinalScore(finished);
    // クリアの瞬間はサイを降らせずに止め、BGMをすっと消す → 間 → デュルリリーン → CLEAR!
    setStatus('clearing');
    const run = storyRunRef.current;
    if (soundModeRef.current === 'all') fadeOutBgms(CLEAR_BGM_FADE_MS);
    void (async () => {
      await delay(CLEAR_BGM_FADE_MS + CLEAR_HUSH_MS);
      if (run !== storyRunRef.current) return;
      if (soundModeRef.current !== 'none') playClearStingSound();
      await delay(CLEAR_STING_MS);
      if (run !== storyRunRef.current) return;
      if (soundModeRef.current !== 'none') {
        playFanfareSound();
      }
      setClearFireworks(true);
      setStatus('cleared');
    })();
  };
  // 説明画面。タイトルの上にかぶせるだけなので、盤面の状態には触らない
  const [showHelp, setShowHelp] = useState(false);
  // 開発用：ベストスコアとストーリーの進み具合を消す。リリース時は消すかもしれない
  const resetProgress = () => {
    try {
      [BEST_SCORES_KEY, STORY_PROGRESS_KEY, STORY_OLD_KEY, TOTAL_SCORE_KEY, WALL_SAVE_KEY].forEach((key) =>
        window.localStorage.removeItem(key),
      );
    } catch {
      // 保存が使えない環境では、消すものがない
    }
    setBestScores([]);
    setStoryCleared(-1);
    setWallProgress({ cleared: [], gateReached: false });
    setTotalScore(0);
    totalScoreRef.current = 0;
  };
  // サイカがいまのセリフを言い終えたか。2行のセリフは下の行が出るまで含めて、読み終わるくらいの間を見る。
  // 「やってみて！」の札は、これが立ってから出す（セリフと札が重なると、どちらも読みにくい）
  const [saikaSettled, setSaikaSettled] = useState(true);
  const tryShownKey = useRef('');
  // 「やってみて！」の札を出してよい回。やってみてのブロックを出したときに立て（armTry）、
  // そのブロックが着地したら下ろす（disarmTry）。n は札を出し直すための通し番号
  const [tryArm, setTryArm] = useState({ n: 0, on: false });
  const armTry = () => setTryArm((prev) => ({ n: prev.n + 1, on: true }));
  const disarmTry = () => setTryArm((prev) => (prev.on ? { ...prev, on: false } : prev));
  const [saika, setSaika] = useState<{ text: string; mood: SaikaMood; who?: 'saika' }>(() => ({
    text: SAIKA_HELLO_LINES[loadLang()][0],
    mood: 'idle',
  }));
  useLayoutEffect(() => setTutorTurn(1), [story]);
  useLayoutEffect(() => {
    if (tutorPair && saika.who !== 'saika') setTutorTurn((t) => 1 - t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saika.text]);
  // サイカのセリフは2行まで。区切りの都合で3行になってしまうときは、字を少しずつ小さくして2行に収める
  const saikaLineRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    setSaikaSettled(false);
    const timer = window.setTimeout(
      () => setSaikaSettled(true),
      SAIKA_SETTLE_BASE_MS + saika.text.length * SAIKA_SETTLE_PER_CHAR_MS,
    );
    return () => window.clearTimeout(timer);
  }, [saika.text]);
  useLayoutEffect(() => {
    const el = saikaLineRef.current;
    if (!el) return;
    el.style.fontSize = '';
    let scale = 1;
    const tooTall = () => {
      const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 20;
      return el.getBoundingClientRect().height > lineHeight * 2.3;
    };
    while (tooTall() && scale > 0.72) {
      scale -= 0.04;
      el.style.fontSize = `${scale.toFixed(2)}em`;
    }
    // 2行になったときは、上の行 → 下の行の順に時間差で出す。
    // 2行が同時に出ると、言いかけの1行目と2行目のつながりが追いにくいため。
    // セリフが変わるたびに出し直す（クラスを外して付け直す）
    const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 20;
    const twoLines = el.getBoundingClientRect().height > lineHeight * 1.5;
    el.classList.remove('is-two-lines');
    if (twoLines) {
      void el.offsetWidth;
      el.classList.add('is-two-lines');
    }
  }, [saika.text, cellPx]);
  // ボム成立時に盤面中段へ出す英字バナー
  const [bombBanner, setBombBanner] = useState<{ label: string; kind: string } | null>(null);
  // リスタートを跨いで古いバナーが出てこないようにするための世代番号
  const bannerToken = useRef(0);
  const [enjoBreaking,setEnjoBreaking]=useState<'top'|'middle'|'bottom'|undefined>();
  const [enjoFlight,setEnjoFlight]=useState<{x:number;phase:'hover'|'drop'}|null>(null);
  const enjoArmed=useRef<number|null>(null);
  const [enjoBlast,setEnjoBlast]=useState<boolean|null>(null);
  const armEnjo=()=>{if(statusNow.current!=='playing')return false;const parts=board.flatMap((row,y)=>row.flatMap((c,x)=>c?.enjo?[{c,x,y}]:[]));if(parts.length!==enjoRows||parts.some(p=>!p.c.enjo!.open))return false;const x=parts[0].x;enjoArmed.current=x;setEnjoFlight({x,phase:'hover'});setBoard(b=>b.map(row=>row.map(c=>c?.enjo?null:c)));return true;};
  const [hyoketsuBlasts,setHyoketsuBlasts]=useState<Array<{x:number;y:number;flashCells:Position[]}>>([]);
  const [clearingCells, setClearingCells] = useState<Set<string>>(() => new Set());
  const [bestScores, setBestScores] = useState<number[]>(() => loadBestScores());
  const [soundMode, setSoundMode] = useState<SoundMode>(() => enemyPractice || new URLSearchParams(location.search).has('review') ? 'none' : 'all');
  useEffect(() => {
    if (soundMode === 'none') { hidoimeCrushSound.stop(); stopDetarameDamageSounds(); stopAnchiThunderSounds(); }
  }, [soundMode]);
  useEffect(() => {
    const stopHiddenCrush = () => { if (document.hidden) { hidoimeCrushSound.stop(); stopDetarameDamageSounds(); stopAnchiThunderSounds(); } };
    document.addEventListener('visibilitychange', stopHiddenCrush);
    return () => {
      document.removeEventListener('visibilitychange', stopHiddenCrush);
      hidoimeCrushSound.stop(); stopDetarameDamageSounds();
      stopAnchiThunderSounds();
    };
  }, []);
  // 起動時のサイコロで出た目。アプリを立ち上げるたびに一度だけ振る。
  // 保存はしない（次に立ち上げたらまた振る）。コンティニューやタイトルへ戻る
  // ときには触らないので、同じ起動のあいだはずっと同じタイトル画面になる。
  const [titleRoll, setTitleRoll] = useState<number | null>(() => ['map', 'linear'].includes(new URLSearchParams(location.search).get('story') || '') ? 1 : null);
  // 振った目のタイトル絵の読み込み。サイコロを振った瞬間に取りに行き、
  // 絵が描ける状態になるまでサイコロの画面を出したままにする。
  // 先にタイトルへ移ると、絵が来るまで下地の単色だけが全面に出てしまう。
  const titleArtReady = useRef<Promise<void>>(Promise.resolve());
  const titleRollRef = useRef(titleRoll);
  titleRollRef.current = titleRoll;
  // 有効範囲の軌道。消える範囲をなぞる線
  const [traces, setTraces] = useState<TraceSet[]>([]);
  // ニコニコボムの溜めのあいだ、くっついたニコニコメを「来るぞ来るぞ」と煽る。
  // 値は交互点滅の位相（0 か 1）。隣り合うメは必ず逆になる
  const [armingCells, setArmingCells] = useState<Map<string, number>>(() => new Map());
  const traceId = useRef(0);
  const showTraces = useCallback((sets: Array<Omit<TraceSet, 'id'>>) => {
    if (sets.length === 0) {
      return;
    }
    const added = sets.map((set) => ({ ...set, id: (traceId.current += 1) }));
    setTraces((prev) => [...prev, ...added]);
    const until = Math.max(...added.map((set) => set.delay + set.life)) + 60;
    const ids = new Set(added.map((set) => set.id));
    runTimeout(() => {
      setTraces((prev) => prev.filter((set) => !ids.has(set.id)));
    }, until);
  }, []);
  // HUDとタイトル画面の2か所から同じ切り替えを呼ぶ
  const toggleSound = useCallback(() => {
    setSoundMode((value) => SOUND_ORDER[(SOUND_ORDER.indexOf(value) + 1) % SOUND_ORDER.length]);
  }, []);
  const [lang, setLang] = useState<Lang>(() => loadLang());

  const sageSpeaking = story !== null && Boolean(BOMB_LESSONS[story] || story === RAINBOW_STAGE || story === THUNDER_LESSON) && saika.who !== 'saika';
  const speakingDie = !sageSpeaking && saika.who !== 'saika' ? tutorPair?.[tutorTurn] : undefined;
  const spokenLine = (line: string) => diceSpokenLine(sageSpokenLine(line, lang, sageSpeaking), lang, speakingDie);
  const dialoguePages = spokenLine(saika.text).split('\f');
  const [dialoguePage, setDialoguePage] = useState(0);
  useEffect(() => {
    setDialoguePage(0);
    if (dialoguePages.length < 2 || status === 'paused') return;
    const timer = window.setTimeout(() => setDialoguePage(1), 2200);
    return () => window.clearTimeout(timer);
  }, [saika.text, speakingDie, lang, status]);
  const text = TEXTS[lang];
  const langRef = useRef(lang);
  langRef.current = lang;

  const changeLang = useCallback((next: Lang) => {
    setLang(next);
    saveLang(next);
    // 待機中のセリフは即座に切り替える。技名や連鎖の途中なら、
    // 次に待機へ戻ったところで新しい言語のセリフになる。
    setSaika((value) =>
      value.mood === 'idle'
        ? { text: pickFrom(idleLines(next, feverActiveRef.current)), mood: 'idle' }
        : value,
    );
  }, []);

  // スコアは下6桁を 000000〜999999 で表示し、百万の位だけを
  // SCORE の右に黄色で出す。百万の位は9で頭打ち（＝9,999,999が上限表示）。
  const { millions: scoreMillions, lower: scoreLower } = splitScore(score);
  const [freezing, setFreezing] = useState(false);
  // 灰に沈めたマス。ゲームオーバー演出のあいだだけ増えていく
  const [grayCells, setGrayCells] = useState<Set<string>>(new Set());
  // --- 虹ボム ---
  const [rainbowStock, setRainbowStock] = useState(() => loadNumber(RAINBOW_KEYS.stock));
  const rainbowStockRef = useRef(rainbowStock);
  rainbowStockRef.current = rainbowStock;
  // 支給用カウンターと生涯累計。描画に使うのは累計だけなので、
  // カウンターは ref で持って再描画を起こさない。
  // 累積スコア。説明画面に9桁で出し、虹ボムの支給にも使う
  const [totalScore, setTotalScore] = useState(() => loadNumber(TOTAL_SCORE_KEY));
  const totalScoreRef = useRef(totalScore);
  // 履歴消去ブロック数。いまは画面に出していないので ref で持つ。
  // 貯めるのは続けておく。表示したくなったときに過去分が無いと困る。
  const clearedTotal = useRef(loadNumber(RAINBOW_KEYS.total));
  // 獲得ワイプ。消去と落下が終わった隙間でだけ出す
  const [rainbowAward, setRainbowAward] = useState(0);
  // ゲームオーバー時の「使う？」。null なら出ていない
  const [rainbowAsk, setRainbowAsk] = useState(false);
  // YES が押されたかを、非同期の流れから受け取るための受け皿
  const rainbowAnswer = useRef<((use: boolean) => void) | null>(null);
  // 虹ボムは1プレイにつき1回まで。持っていても2度目は出さない。
  // 連続で使えると「もうだめだ」が消えて、救済そのものの価値が薄れる。
  const rainbowUsedThisGame = useRef(false);
  const [rainbowAskMs, setRainbowAskMs] = useState(RAINBOW_ASK_MS); // 「使う？」の待ち時間（ゲージの長さ）
  // 支給が決まっても、その場では出さない。連鎖の途中に割り込ませないため、
  // 消去と落下が完全に終わった spawnNext の手前まで持ち越す。
  const pendingAward = useRef(0);
  // ボム直前に点滅させるマス。値は反対色。フィーバーの巻き添えは 'fever'
  const [chargeCells, setChargeCells] = useState<Map<string, string>>(new Map());
  // フィーバーの円は位置を固定しておく。再描画で並びが変わらないように
  const feverSparks = useMemo(() => buildFeverSparks(), []);
  const rainbowSparks = useMemo(() => buildRainbowSparks(), []);
  const feverIgniteSparks = useMemo(() => buildFeverIgniteSparks(), []);
  const [feverActive, setFeverActive] = useState(false);
  // フィーバーに入る直前の点火演出。出ているあいだはまだ feverActive ではない。
  const [feverIgniting, setFeverIgniting] = useState(false);
  // ボムで弾けるマス。key -> メ本体の飛ぶ向きと、飛び散る円の一覧
  const [burstCells, setBurstCells] = useState<Map<string, BurstInfo>>(() => new Map());
  const [monoDice, setMonoDice] = useState(false);
  const [rainbowSparksOn, setRainbowSparksOn] = useState(false);
  const [monoCells, setMonoCells] = useState<Map<string, number>>(() => new Map());
  // ボムが消える直前に、消える範囲を光らせて見せるための情報
  const [glowCells, setGlowCells] = useState<Map<string, GlowInfo>>(() => new Map());
  // ニコニコボムで白黒反転の点滅をさせるマス
  const [blastCells, setBlastCells] = useState<Set<string>>(() => new Set());
  // ニコニコボムの溜め。くっついたニコニコメの位置（盤面に対する％）を持つ。
  const [nicoCharge, setNicoCharge] = useState<{
    x: number;
    y: number;
  } | null>(null);


  const feverActiveRef = useRef(feverActive);
  feverActiveRef.current = feverActive;

  const soundModeRef = useRef(soundMode);
  soundModeRef.current = soundMode;

  // 1段落ちる間隔。レベルごとに同じ「割合」で短くする（0.93倍＝体感7%ずつ速く）。
  // 以前は毎レベル同じ「幅」（45ms）で縮めていたので、間隔が短くなる後半ほど
  // 1レベルの差が大きくなり、Lv13→14 で一気に23%も速くなる壁ができていた。
  // Lv1: 780ms / Lv10: 406ms / Lv14: 304ms / Lv20: 196ms / 下限 180ms
  const baseSpeed = Math.max(FALL_FLOOR_MS, Math.round(FALL_BASE_MS * FALL_RATIO ** (level - 1)));
  // 4メンから先のお手本（サイカが落とすデモ）は、見ているだけで間延びしないよう1.5倍の速さで落とす。
  // 「やってみて」とミッションは、いつもの速さのまま
  const storyGoal = story === null ? null : STORY_STAGES[story].goal.type;
  const inFastDemo =
    story !== null &&
    story !== 0 &&
    ((storyGoal === 'koitsume' && koiView.phase === 'demo') ||
      (storyGoal === 'dame' && dameView.phase === 'demo') ||
      (storyGoal === 'bomb' && bombView.phase === 'demo') ||
      (storyGoal === 'combo' && comboDemo));
  const speed = inFastDemo ? Math.round(baseSpeed / DEMO_FALL_SPEEDUP) : baseSpeed;

  const activeCells = useMemo(() => getPieceCells(current), [current]);

  // 落下ガイド。操作中のブロックの各列で、いちばん下のメより下にある
  // 空セルを、着地をさえぎるものに当たるまで光らせる。
  // 値は上からの並び順で、下へ流れるグラデーションの位相に使う。
  const guideCells = useMemo(() => {
    const guide = new Map<string, number>();
    if (status !== 'playing') {
      return guide;
    }

    // 列ごとに、ブロックのいちばん下のマスを求める
    const bottoms = new Map<number, number>();
    activeCells.forEach((cell) => {
      const current = bottoms.get(cell.x);
      if (current === undefined || cell.y > current) {
        bottoms.set(cell.x, cell.y);
      }
    });

    bottoms.forEach((bottom, x) => {
      let step = 0;
      for (let y = Math.max(bottom + 1, 0); y < ROWS; y += 1) {
        // ふさがっているところより下は落ちていかないので、そこで打ち切る
        if (board[y][x]) {
          break;
        }
        guide.set(`${x},${y}`, step);
        step += 1;
      }
    });

    return guide;
  }, [activeCells, board, status]);

  const mergedCells = useMemo(() => {
    const cells = new Map<string, Cell>();
    board.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) {
          cells.set(`${x},${y}`, cell);
        }
      });
    });
    // 消去処理中は盤面側に駒が確定済みなので、操作駒を重ねて描かない（二重表示の防止）
    if (status === 'playing' || status === 'paused') {
      activeCells.forEach((cell) => {
        if (cell.y >= 0 && cell.y < ROWS && cell.x >= 0 && cell.x < COLS) {
          cells.set(`${cell.x},${cell.y}`, { id: cell.key, value: cell.value, group: current.id });
        }
      });
    }
    return cells;
  }, [activeCells, board, status]);

  // ゲームオーバー確定後の見せ場。
  // まず落胆の音を鳴らし、盤面はそのまま止めて、上の段から順に数マスずつ
  // 灰へ沈めていく。全体を一度に無彩色化していたころより、終わりが
  // 「上から降りてくる」ように見える。
  // 灰へ沈める処理。from から to までの割合ぶんだけ進める。
  // 虹ボムの割り込みのために、600ms のところで一度止められる形にしてある。
  const sinkBoard = useCallback(
    async (order: string[], from: number, to: number, sunk: Set<string>) => {
      if (order.length === 0) {
        await delay(GAMEOVER_GRAY_MS * (to - from));
        return;
      }
      const ticks = Math.min(GAMEOVER_GRAY_TICKS, order.length);
      const chunk = Math.ceil(order.length / ticks);
      const wait = GAMEOVER_GRAY_MS / ticks;
      const start = Math.floor(ticks * from);
      const end = Math.ceil(ticks * to);
      for (let tick = start; tick < end; tick += 1) {
        order.slice(tick * chunk, (tick + 1) * chunk).forEach((key) => sunk.add(key));
        setGrayCells(new Set(sunk));
        await delay(wait);
      }
    },
    [],
  );

  // 虹ボムで上の段を吹き飛ばす。範囲に入った大きな敵には、ひっさつメと同じく1ダメージ
  // （ベラボウメの最後の目・デタラメのてっぺんの目も減らせる）
  const rainbowClear = (board: Board): Board => {
    let next = clearDangerZone(board);
    const inZone = (y: number) => y < RAINBOW_ROWS;
    // ヒドイメ：範囲にかかった個体ごとに1ダメージ
    const hitGroups = new Set<number>();
    board.forEach((row, y) =>
      row.forEach((cell) => {
        if (cell?.value === HIDOIME && inZone(y)) hitGroups.add(cell.group);
      }),
    );
    if (hitGroups.size > 0) {
      const felled = new Set<number>();
      hitGroups.forEach((group) => {
        const hp = Math.max(0, (hidoimeHp.current.get(group) ?? HIDOIME_HP) - 1);
        hidoimeHp.current.set(group, hp);
        if (hp === 0) felled.add(group);
      });
      setHidoimeView((prev) => {
        const map = new Map(prev);
        hitGroups.forEach((group) => {
          const item = map.get(group);
          if (!item) return;
          let pos = item.pos;
          board.forEach((row, y) =>
            row.forEach((cell, x) => {
              if (cell?.group === group && (pos === item.pos)) pos = { x, y };
            }),
          );
          map.set(group, { ...item, hp: hidoimeHp.current.get(group) ?? 0, dying: felled.has(group), pos });
        });
        return map;
      });
      if (felled.size > 0) {
        next = next.map((row) => row.map((cell) => (cell && felled.has(cell.group) ? null : cell)));
        hidoimeDefeated.current += felled.size;
        setHidoimeDefeatedView(hidoimeDefeated.current);
      }
    }
    // ベラボウメ：範囲にかかったら目を1つ減らす（最後の目でも減らせる）
    const berabouInZone = board.some((row, y) => inZone(y) && row.some((cell) => cell?.value === BERABOU));
    if (berabouInZone && berabouHp.current > 0) {
      const hp = Math.max(0, berabouHp.current - berabouDamage(berabouHp.current, true));
      berabouHp.current = hp;
      const lastPos = findBerabou(board);
      setBerabouView((prev) => (prev ? { ...prev, hp, dying: hp === 0, pos: lastPos ?? prev.pos } : prev));
      if (hp === 0) {
        next = next.map((row) => row.map((cell) => (cell && cell.value === BERABOU ? null : cell)));
        berabouDefeated.current = 1;
        setBerabouDefeatedView(1);
        runTimeout(() => setBerabouView(null), 900);
      }
    }
    // デタラメ：範囲に入った段の目をつぶす（てっぺんの目も）。1体ずつ
    for (const d of [...detaramesRef.current]) {
      if (d.dying) continue;
      const segs = d.segs.map((seg, i) => (inZone(d.top + i) ? { ...seg, alive: false } : seg));
      if (segs.some((seg, i) => seg.alive !== d.segs[i].alive)) {
        const left = segs.filter((seg) => seg.alive).length;
        if (left === 0) {
          next = next.map((row) => row.map((cell) => (cell && cell.group === detarameGroup(d.id) ? null : cell)));
          updateDetarameById(d.id, null);
          detarameDefeated.current += 1;
          setDetarameDefeatedView(detarameDefeated.current);
        } else {
          let lead = 0;
          while (lead < segs.length && !segs[lead].alive) lead += 1;
          if (lead > 0) {
            next = next.map((row, y) =>
              y >= d.top && y < d.top + lead ? row.map((cell, x) => (x === d.x ? null : cell)) : row,
            );
          }
          updateDetarameById(d.id, { ...d, segs: segs.slice(lead), top: d.top + lead });
        }
      }
    }
    return next;
  };

  const runGameOverFreeze = useCallback(
    async (finished: Board) => {
    const activeScriptRun = storyRunRef.current;
      if (soundModeRef.current !== 'none') {
        playGameOverSound();
      }
      setFreezing(true);
      const order = buildGrayOrder(finished);
      const sunk = new Set<string>();
      const cut = RAINBOW_CUT_IN_MS / GAMEOVER_GRAY_MS;

      // 持っていない、またはこのプレイで既に使っているなら、
      // これまでどおり最後まで沈めて終わる
      // ストーリーでは13メンで習得してから使える。13メンでは教える用の1個を使わせる
      const lesson = (storyRunRef.current === activeScriptRun && storyRef.current === RAINBOW_STAGE);
      const storyLocked = !!enemyPractice || storyRef.current !== null && (mapRun.current ? !mapRainbowOpen() : storyRef.current < RAINBOW_STAGE);
      if (
        (!lesson && rainbowStockRef.current <= 0) ||
        rainbowUsedThisGame.current ||
        storyLocked
      ) {
        await sinkBoard(order, 0, 1, sunk);
        setFreezing(false);
        // 16メンから先は、持っていれば虹ボムが使える。持っていないときは、手に入れ方をひとこと
        if (
          !enemyPractice && storyRef.current !== null &&
          (mapRun.current ? mapRainbowOpen() && !lesson : storyRef.current > RAINBOW_STAGE) &&
          rainbowStockRef.current <= 0
        ) {
          setGameoverHint(true);
        }
        return false;
      }

      // 危険領域が沈みかけたところで止め、「使う？」を挟む
      await sinkBoard(order, 0, cut, sunk);
      setSaika({
        text: lesson ? RAINBOW_LESSON_ASK[langRef.current] : pickFrom(SAIKA_RAINBOW_ASK_LINES[langRef.current]),
        mood: 'worry',
      });
      setRainbowAskMs(lesson ? RAINBOW_LESSON_ASK_MS : RAINBOW_ASK_MS);
      // 13メンは、待っているあいだ「いまだ！」を出し続ける（待機のひとことに上書きされないように）
      const lessonNag = lesson
        ? window.setInterval(() => {
            if ((storyRunRef.current === activeScriptRun && storyRef.current === RAINBOW_STAGE)) {
              setSaika({ text: RAINBOW_LESSON_ASK[langRef.current], mood: 'worry' });
            }
          }, 250)
        : 0;
      setBgmDuck(true);
      setRainbowAsk(true);

      const use = await new Promise<boolean>((resolve) => {
        rainbowAnswer.current = resolve;
        // 3秒で自動的に「使わない」。押さないほうが手間なので、
        // 迷う時間そのものを演出にする。
        runTimeout(() => {
          if (rainbowAnswer.current === resolve) {
            rainbowAnswer.current = null;
            resolve(false);
          }
        }, lesson ? RAINBOW_LESSON_ASK_MS : RAINBOW_ASK_MS);
      });
      window.clearInterval(lessonNag);
      if (storyRunRef.current !== activeScriptRun) return false;
      setRainbowAsk(false);
      setBgmDuck(false);

      if (!use) {
        // 使わなかった。残りを沈めて終わる。虹ボムは減らさない
        await sinkBoard(order, cut, 1, sunk);
        setFreezing(false);
        return false;
      }

      // 使った。灰を下から戻して、危険領域を消し飛ばす
      haptics.tap();
      if (soundModeRef.current !== 'none') {
        playRainbowFireSound();
      }
      rainbowUsedThisGame.current = true;
      // 教える用の1個を使ったときは、持っている数を減らさない
      if (!lesson) {
        setRainbowStock((value) => {
          const next = Math.max(0, value - 1);
          saveNumber(RAINBOW_KEYS.stock, next);
          return next;
        });
      }
      setFreezing(false);
      setSaika({ text: pickFrom(SAIKA_RAINBOW_SAVE_LINES[langRef.current]), mood: 'bomb' });

      // これから吹き飛ぶメだけ、色を戻さずに白黒で明滅させておく。
      // 助かった盤面と、消える盤面が、同じ画面で見分けられる。
      setMonoCells(buildRainbowMono());
      setMonoDice(true);

      // 灰を上から下へ戻す。沈めた順に入れている sunk を、前（＝上段）から外す。
      // 沈めたときと同じ向きに撫でることで、巻き戻しではなく
      // 「塗り直している」ように見せる。
      const sunkOrder = [...sunk];
      const restoreTicks = 12;
      for (let tick = 1; tick <= restoreTicks; tick += 1) {
        const keep = sunkOrder.slice(Math.round((sunkOrder.length * tick) / restoreTicks));
        setGrayCells(new Set(keep));
        await delay(RAINBOW_RESTORE_MS / restoreTicks);
      }
      setGrayCells(new Set());

      // 色が戻りきってから、ひと呼吸おいて弾けさせる。
      // 間を置かないと復色と破裂が地続きになり、どちらも印象に残らない。
      await delay(RAINBOW_HOLD_MS);

      // 危険領域のメを外へ弾き飛ばす。盤面から実際に消すのは呼び出し側なので、
      // ここでやるのは飛んでいく絵と音だけ。
      const bursts = buildRainbowBurst(finished);
      if (bursts.size > 0) {
        // メだけ本来の色に戻して飛ばす。マスの明滅はそのまま続ける
        setMonoDice(false);
        setRainbowSparksOn(true);
        setBurstCells(bursts);
        haptics.big(); // 虹ボムの破裂
        if (soundModeRef.current !== 'none') {
          playRainbowBurstSound();
        }
        await delay(RAINBOW_BURST_MS);
      }
      // 飛ばし終えたら、盤面から実際に消すのと、飛ばす絵・光の波を外すのを
      // 同じ瞬間にやる。以前は飛ばす絵だけ先に外して 320ms 待ち、盤面から
      // 消すのは呼び出し側に任せていたので、そのあいだ吹き飛んだはずのメが
      // 元の位置に戻って見え、消えた段が一瞬だけ映っていた。
      // 呼び出し側でも同じ盤面をもう一度入れるが、中身が同じなので害はない。
      setBoard(clearDangerZone(finished));
      setBurstCells(new Map());
      setRainbowSparksOn(false);
      setMonoCells(new Map());
      // 13メン：助かったところを見せてから、クリアにする
      if (lesson) {
        // 助かった直後は「ふぅ～ 助かった～」などの決まったひとことが入るので、そのあとに言い直す
        runTimeout(() => {
          if ((storyRunRef.current === activeScriptRun && storyRef.current === RAINBOW_STAGE)) {
            setSaika({ text: RAINBOW_LESSON_SAVED[langRef.current], mood: 'praise' });
          }
        }, 700);
        runTimeout(() => {
          if ((storyRunRef.current === activeScriptRun && storyRef.current === RAINBOW_STAGE)) {
            completeStage(RAINBOW_STAGE, scoreRef.current);
          }
        }, 2600);
      }
      return true;
    },
    [sinkBoard],
  );

  const recordGameOver = useCallback(
    (finishedScore: number) => {
      // ストーリーの得点はエンドレスの記録に混ぜない
      if (storyRef.current !== null) {
        setFinalScore(finishedScore);
        setStatus('gameover');
        return;
      }
      const updated = [...bestScores, finishedScore].sort((a, b) => b - a).slice(0, 5);
      setFinalScore(finishedScore);
      setBestScores(updated);
      saveBestScores(updated);
      setStatus('gameover');
    },
    [bestScores],
  );

  const spawnNext = useCallback(
    async (nextBoard: Board, finishedScore: number) => {
      // 虹ボムの獲得ワイプは、消去も落下も終わったこの隙間でだけ出す。
      // 連鎖の途中やニコニコメの溜めには絶対に重ねない。
      if (pendingAward.current > 0) {
        const count = pendingAward.current;
        pendingAward.current = 0;
        setRainbowAward(count);
        setSaika({ text: rainbowAwardLine(langRef.current, count), mood: 'bomb' });
        if (soundModeRef.current !== 'none') {
          playRainbowAwardSound();
        }
        await delay(RAINBOW_AWARD_MS);
        setRainbowAward(0);
      }

      if (spawnHold.current) {
        spawnHeld.current = true;
        return;
      }
      const incoming = nextPiece;
      // 危険領域に到達していると、次のブロックにニコニコメが混ざるようになる
      const replacement = createPiece(
        pieceId.current + 1,
        nicoOpenIn(storyRef.current, mapPowers()) && isDangerBoard(nextBoard),
        wall22DiceWeight(mapStageRef.current, nextBoard),
      );
      pieceId.current += 1;
      setNextPiece(replacement);

      // NEXT にニコニコメが入ったら、その場で驚いて見せる。
      // めったに出ないので、出た瞬間に気づけたほうが嬉しい。
      const hasNico = replacement.matrix.some((row) => row.some((value) => value === NICO));
      if (hasNico) {
        setSaika({
          text: storyLinesOn ? SAIKA_SURPRISE_LINES[langRef.current][0] : pickFrom(SAIKA_SURPRISE_LINES[langRef.current]),
          mood: 'surprise',
        });
        runTimeout(() => {
          setSaika((value) =>
            value.mood === 'surprise'
              ? { text: pickFrom(idleLines(langRef.current, feverActiveRef.current)), mood: 'idle' }
              : value,
          );
        }, SAIKA_BEAT_MS);
      }

      // 最上段が埋まっていなければ、盤面の上へ逃がしてでも次のブロックを出す
      const placed = isTopReached(nextBoard) ? null : spawnAt(nextBoard, incoming);
      if (placed) {
        setCurrent(placed);
        setStatus('playing');
        return;
      }
      setCurrent(incoming);

      // ゲームオーバーが確定した瞬間に盤面を止め、灰へ沈めていく。
      // 虹ボムを持っていれば途中で「使う？」が挟まり、使えば true が返る。
      // status は 'clearing' のままなので、この間は操作を受け付けない。
      const saved = await runGameOverFreeze(nextBoard);
      if (saved) {
        const cleared = rainbowClear(nextBoard);
        setBoard(cleared);
        const placed = spawnAt(cleared, incoming);
        if (placed) {
          setCurrent(placed);
          setStatus('playing');
          return;
        }
      }
      recordGameOver(finishedScore);
    },
    [nextPiece, recordGameOver],
  );

  // 設置音は「これ以上落ちられなくなった瞬間」に鳴らす。
  // 実際に固定されるのは次の落下タイミングなので、そこまで待って鳴らすと
  // 見た目より音が遅れて聞こえる。先に鳴らしておけば、置いた手応えが
  // すぐ返り、固定までのあいだに横へずらす余地はそのまま残る。
  const lockSoundPiece = useRef(-1);
  // いま走っている処理が、本来の予定からどれだけ遅れているか（ms）。
  // 指やキーの入力なら「入力が起きた時刻」から、自然落下なら「刻むはずだった時刻」から測る。
  // 効果音はこれを見て、遅れすぎていれば鳴らさない（sfxOnTime）。
  const triggerLate = useRef(0);
  // 着地の瞬間にセヴン目音を先に鳴らしたブロック。
  // 消去の処理まで進んだとき、1連鎖ぶんを二重に鳴らさないための目印。
  const earlyClearPiece = useRef(-1);

  // 着地の瞬間に鳴らす音。
  // 揃う手ならセヴン目音をここで出してしまう。設置音を鳴らしてから
  // 消去まで待たせると、実際に固定されるのは次の落下タイミング（レベル1で
  // 780ms後）なので、音が半拍ぶん遅れて聞こえてしまう。
  // untilLandMs は「いまから着地の絵が出るまで」の時間。
  // 操作で着地させた瞬間に呼ぶ場合も、着地の絵が出るのは描画のぶんだけ後なので、
  // 既定値はその描画の遅れ（LANDING_PAINT_LAG_MS）にしてある。
  // 設置音もセヴン目音も、着地の絵から TOUCHDOWN_SOUND_AFTER_MS 後にそろえて鳴らす。
  const playTouchdownSound = useCallback(
    (bd: Board, piece: Piece, untilLandMs = LANDING_PAINT_LAG_MS) => {
    if (soundModeRef.current === 'none' || !sfxOnTime(triggerLate.current)) {
      return;
    }
    const delayMs = Math.max(0, untilLandMs) + TOUCHDOWN_SOUND_AFTER_MS;
    if (clearKindOnLock(bd, piece) === 'seven') {
      earlyClearPiece.current = piece.id;
      playClearSound(
        1,
        feverActiveRef.current,
        findSevenMatches(placePiece(bd, piece)).size,
        delayMs,
      );
      return;
    }
    // 早めても「いま」より前には置けないので、0 で止める
    playLockSound(Math.max(0, delayMs - LOCK_SOUND_EARLIER_MS));
    },
    [],
  );

  // 位置が決まるたびに呼ぶ。着地していれば鳴らし、まだ落ちられるなら
  // 目印を戻して鳴らし直せるようにする。
  // 着地音のあとも固定までは横へ滑らせられる仕様なので、段差から落ちて
  // 落下を再開した駒は「まだ置かれていない」。ここで戻さないと、
  // 実際に置かれた場所では無音のまま終わってしまう。
  const noteTouchdown = useCallback(
    (bd: Board, piece: Piece) => {
      if (soundModeRef.current === 'none') {
        return;
      }
      if (canPlace(bd, { ...piece, y: piece.y + 1 })) {
        if (lockSoundPiece.current === piece.id) {
          lockSoundPiece.current = -1;
          earlyClearPiece.current = -1;
        }
        return;
      }
      if (lockSoundPiece.current === piece.id) {
        return;
      }
      lockSoundPiece.current = piece.id;
      playTouchdownSound(bd, piece);
    },
    [playTouchdownSound],
  );

  const lockPiece = useCallback(
    // thunderCols を渡すと、ブロックは置かずに、その列をイチニノサンダーで消すところから始める
    async (piece: Piece, thunderCols?: number[], youStrike?: You456Strike) => {
    const activeScriptRun = storyRunRef.current;
      const traceStrike = !!thunderCols || !!youStrike;
      if (isResolving.current) {
        return;
      }

      isResolving.current = true;
      setStatus('clearing');
      const enjoLaunch = !traceStrike ? enjoArmed.current : null;
      if(enjoLaunch!==null)enjoArmed.current=null;

      // 待つたびに、予定よりどれだけ遅れて戻ってきたかを控える。
      // 消去の効果音はこの直後に鳴らすので、遅れすぎていれば鳴らさない。
      let late = triggerLate.current;
      const wait = async (ms: number) => {
        const target = performance.now() + ms;
        await delay(ms);
        if (youStrike && activeScriptRun !== storyRunRef.current) throw YOU456_CANCELLED;
        late = Math.max(0, performance.now() - target);
      };
      const onTime = () => sfxOnTime(late);

      // 着地の瞬間にもう鳴らしていれば、ここでは鳴らさない。
      // 一気に落とした場合は着地の検知を通らないので、ここが受け持つ。
      if (soundModeRef.current !== 'none' && !traceStrike) {
        if (earlyClearPiece.current === piece.id) {
          // セヴン目音は着地で先に鳴らしてある。ただしそのあと横へずらして
          // 揃わなくなっていたら、代わりに設置音で締める。
          if (clearKindOnLock(board, piece) !== 'seven') {
            earlyClearPiece.current = -1;
            if (onTime()) {
              playLockSound();
            }
          }
        } else if (lockSoundPiece.current !== piece.id) {
          lockSoundPiece.current = piece.id;
          playTouchdownSound(board, piece);
        }
      }

      let workingBoard = traceStrike ? board : placePiece(board, piece);
      const activeHyoketsu = new Set(workingBoard.flat().filter(c=>c?.hyoketsu==='active').map(c=>c!.id));
      let thunderPending: number[] | null = thunderCols ?? null;
      let youPending = youStrike ?? null;
      // 発光の起点。いま置いたブロックが占めるマス
      const triggerKeys = new Set(
        traceStrike ? [] : piece.matrix.flatMap((row, my) =>
          row.flatMap((value, mx) =>
            value === null ? [] : [`${piece.x + mx},${piece.y + my}`],
          ),
        ),
      );
      let totalCleared = 0;
      let chain = 0;
      let usedBomb = false;
      const firedKinds = new Set<LessonKind>(); // このブロックで出たひっさつメ（教室の数え方に使う）
      let koitsumeKilled = 0; // このブロックで倒したコイツメの数（4メン・6メンの数え方に使う）
      let dameDamaged = 0; // このブロックで✕を取ったダーメの数（6メンの数え方に使う）
      let berabouStruck = false; // このブロックでベラボウメの目をつぶしたか（回復までのカウントに使う）
      let anchiEyeHit = false; // ひっさつメの範囲がアンチクショウメの目に入ったか
      let anchiFelled = false; // このブロックでアンチクショウメを倒したか（消える演出を見せてからクリア）
      let gained = 0;
      let gainedSeven = 0; // このうちセヴン消しで得た分。レベルの計算に使う
      setBoard(workingBoard);

      // 消去で浮いたメを1マスずつ、加速しながら垂直に落とす。
      // 呼ぶのはセヴン消しのあとだけ。設置直後には呼ばない。
      // ブロックは固定されたら切り離さない仕様なので、L字の張り出しは宙に残したままにする。
      const settle = async (
        start: Board,
        withSound: boolean,
        stillCurrent: () => boolean = () => true,
      ): Promise<Board> => {
        let current = start;
        let fallStep = 0;

        while (true) {
          const step = stepGravity(current);
          if (!step.moved) {
            break;
          }
          await wait(fallStepMs(fallStep));
          if (!stillCurrent()) return current;
          fallStep += 1;
          current = step.board;
          setBoard(current);
        }

        if (fallStep > 0 && withSound && soundModeRef.current !== 'none' && onTime()) {
          playLockSound();
        }
        return current;
      };

      while (true) {
        // 消去の優先順位：ニコニコボム > スパ1ボム > セヴン消し。
        // ボム技が成立していればセヴン消しは評価せず、ボムだけを先に消す。
        // ストーリー序盤では特殊ボムもニコニコボムも出さない（まだ取り戻していないチカラ）
        const inStory = storyRef.current !== null;
        // イチニノサンダー：最初の1回だけ、指定の列をまるごと消す（続く連鎖はふつうに数える）
        const thunderNow = thunderPending;
        thunderPending = null;
        const youNow = youPending;
        youPending = null;
        const tracedNow = thunderNow || youNow;
        // ニコニコボムは11メンで習得する。それより前のメンでは発動しない
        const nico = tracedNow || (inStory && !nicoOpenIn(storyRef.current, mapPowers())) ? null : findNicoBomb(workingBoard);
        if (nico) {
          firedKinds.add('nico');
        }
        // ストーリーでは、習得したメンからだけ使える（storyAllows）
        const bombs = nico || tracedNow
          ? []
          : findAllBombs(workingBoard, triggerKeys).filter(
              (hit) => !inStory || storyAllows(storyRef.current ?? 0, hit.kind, mapPowers()),
            );
        bombs.forEach((hit) => firedKinds.add(hit.kind));

        let kind: ClearKind = 'seven';
        // フィーバーで巻き添えになったマス。発動前の点滅を6色にする対象
        const feverCaught = new Set<string>();
        let cells: Position[];
        let bombScores: Array<{ level: number; multiplier: number }> = [];
        let glow: Map<string, GlowInfo> | null = null;
        // アンチクショウメの身体のうち、この消去が当たったマス（白いダメージの光を出す）
        let anchiTouch: Position[] = [];
        const anchiCellsIn = (points: Position[]) => points.filter((point) => workingBoard[point.y]?.[point.x]?.value === ANCHI);
        let enemyHits: {
          koitsume: Position[];
          dame: Position[];
          hidoime: number[];
          berabou: number[];
          detarame: Position[];
        } | null = null;

        if (thunderNow || youNow) {
          kind = youNow ? 'you456' : 'thunder';
          if (thunderNow) firedKinds.add('thunder');
          const struck: Position[] = youNow ? youNow.cells.filter(p => workingBoard[p.y]?.[p.x]) : [];
          thunderNow?.forEach((x) => {
            for (let y = 0; y < ROWS; y += 1) if (workingBoard[y][x]) struck.push({ x, y });
          });
          anchiEyeHit = anchiEyeHit || anchiEyeIn(struck, workingBoard);
          anchiTouch = anchiCellsIn(struck);
          // 大きな敵・ニコニコメ・アンチクショウメの身体は消さず、当たり判定だけ
          cells = struck.filter((point) => {
            const value = workingBoard[point.y][point.x]?.value ?? 0;
            return value > 0 && value !== NICO;
          });
          // 2026-10-14：なぞった1・2・3のサイも消す（イナヅマが敵だけの列・空の列に落ちても、同じ並びが残って
          // 何度も撃てる抜け道をふさぐ）。上にあったサイはこのあとの settle で自然に落ちる
          const used = youNow?.used ?? thunderUsedRef.current ?? [];
          if (!youNow) thunderUsedRef.current = null;
          used.forEach((point, index) => {
            if (workingBoard[point.y]?.[point.x]?.value === index + (youNow ? 4 : 1) && !cells.some((c) => c.x === point.x && c.y === point.y)) cells.push(point);
          });
          enemyHits = findEnemyHits(
            workingBoard,
            cells,
            struck.filter((point) => isEnemy(workingBoard[point.y][point.x]?.value ?? 0)),
          );
          bombScores = [{ level: youNow ? 3 * youNow.columns.length : 3 * thunderNow!.length / 2, multiplier: 1 }];
        } else if (nico) {
          kind = 'nico';
          // 2026-10-14：サンザッパラナメにもニコニコボムが効く（目に当たれば倒れる）
          anchiEyeHit = anchiEyeHit || anchiEyeIn(nico, workingBoard);
          anchiTouch = anchiCellsIn(nico);
          // 敵は巻き込みで直接は消さない。となり・範囲内の敵にはダメージとして当てる
          cells = nico.filter((point) => {
            const value = workingBoard[point.y][point.x]?.value ?? 0;
            return !isEnemy(value);
          });
          if (inStory) {
            enemyHits = findEnemyHits(
              workingBoard,
              cells,
              nico.filter((point) => isEnemy(workingBoard[point.y][point.x]?.value ?? 0)),
            );
          }
          bombScores = [{ level: Math.max(1, nico.length - (SPA_ONE_MIN - 1)), multiplier: 1 }];
        } else if (bombs.length > 0) {
          // 対象の目が重ならないので、成立したボムはすべて同時に消す
          kind = bombs[0].kind;
          // 置いた瞬間に決まったときだけ、設置音に重ねて鳴らす。
          // 連鎖の途中で成立したぶんは、すでに消える音が続いているので鳴らさない。
          if (chain === 0 && soundModeRef.current !== 'none' && onTime()) {
            playBombLockSound(kind);
          }
          bombScores = bombs.map((hit) => ({ level: hit.level, multiplier: hit.multiplier }));
          const base = bombs.flatMap((hit) => hit.cells);
          // フィーバー中は周囲1マスを巻き込む
          const widened = feverActiveRef.current
            ? expandForFever(base).filter((point) => workingBoard[point.y][point.x])
            : base;
          anchiEyeHit = anchiEyeHit || (!sanzMode ? anchiEyeIn(widened, workingBoard) : bombs.some(hit=>(hit.kind==='sla3'||hit.kind==='str6'||hit.kind==='squ4') && anchiEyeIn(hit.cells, workingBoard)));
          anchiTouch = anchiCellsIn(widened);
          // ニコニコメはニコニコボム以外では絶対に消えない。
          // 通貫やフィーバーの巻き添えでも落ちないよう、ここで最後に取り除く。
          // ヒドイメも同じく、巻き添えで4マスの一部だけ消えないようにする。
          // ヒドイメには、となりの消去として当たり判定でダメージが入る
          cells = widened.filter((point) => {
            const value = workingBoard[point.y][point.x]?.value;
            return value !== NICO && value !== HIDOIME && value !== BERABOU && value !== DETARAME && value !== ANCHI;
          });
          // ストーリーでは、ボムの隣にいる敵にも当たる
          if (inStory) {
            enemyHits = findEnemyHits(workingBoard, cells);
          }

          // 消える範囲をプレイヤーに見せるための発光。
          // 最小形（core）はすきまも埋めてひとつながりに、
          // 巻き込まれるだけのマス（extra）はマスの中だけを同じ色で光らせる。
          const inCore = new Set<string>();
          bombs.forEach((hit) => {
            hit.core.forEach((point) => inCore.add(`${point.x},${point.y}`));
          });

          // 一気通貫で巻き込まれたマスと、フィーバーで巻き込まれたマスは
          // 白を重ねて「巻き添え」だと分かるようにする
          const swept = new Set<string>();
          bombs.forEach((hit) => {
            hit.sweep.forEach((point) => swept.add(`${point.x},${point.y}`));
          });
          const owned = new Set<string>();
          bombs.forEach((hit) => {
            hit.cells.forEach((point) => owned.add(`${point.x},${point.y}`));
          });
          cells.forEach((point) => {
            const key = `${point.x},${point.y}`;
            if (!owned.has(key)) {
              swept.add(key); // フィーバーの巻き込み分
              // 発動前の点滅では、一気通貫とフィーバーで色の出し方を変える。
              // swept は両方を含んでいるので、フィーバー分だけ別に控えておく。
              feverCaught.add(key);
            }
          });

          glow = buildGlow(
            bombs.flatMap((hit) => hit.core),
            cells.filter((point) => !inCore.has(`${point.x},${point.y}`)),
            BOMB_GLOW_COLORS[kind],
            swept,
          );
        } else {
          cells = [...findSevenMatches(workingBoard)].map((key) => {
            const [cx, cy] = key.split(',').map(Number);
            return { x: cx, y: cy };
          });
          // セヴン目の隣にいる敵を控えておく。命中はセヴン目が消えた直後に
          // 「ビシュッ」と別に見せる（コイツメは消え、ダメは✕が取れてコイツメになる）
          if (cells.length > 0) {
            enemyHits = findEnemyHits(workingBoard, cells);
            // セヴン目のとなりにあるアンチクショウメの身体。ダメージは無いが白く光る（目なら細める）
            anchiTouch = anchiCellsIn(cells.flatMap((point) => [
              { x: point.x + 1, y: point.y }, { x: point.x - 1, y: point.y },
              { x: point.x, y: point.y + 1 }, { x: point.x, y: point.y - 1 },
            ]));
          }
        }

        // ヒョーケツメは凍結・起動後ともひっさつメの消去対象外。
        cells=cells.filter(p=>!workingBoard[p.y]?.[p.x]?.enjo);
        if (kind !== 'seven') cells = cells.filter(point => !workingBoard[point.y]?.[point.x]?.hyoketsu);
        if (cells.length === 0) {
          break;
        }

        const clear = new Set(cells.map((point) => `${point.x},${point.y}`));
        const isBomb = kind !== 'seven';

        if (mapRun.current && !demoLock.current) {
          if (kind === 'seven') wallCounts.current.sevens += 1;
          for (const hit of bombs) wallCounts.current.bombs[hit.kind] += 1;
          if (kind === 'nico') wallCounts.current.nico += 1;
          if (kind === 'thunder') wallCounts.current.thunder += 1;
          wallCounts.current.superOnes = wallCounts.current.bombs.spa1;
          setWallCountsView({ ...wallCounts.current, bombs: { ...wallCounts.current.bombs } });
        }
        chain += 1;
        totalCleared += clear.size;
        // ストーリーでは、2連鎖目から「CHAIN!」を出す
        if (storyRef.current !== null && chain >= 2) {
          setComboFx({ n: chain, key: performance.now() });
        }

        const points = scoreFor({
          kind,
          cells: clear.size,
          bombs: bombScores,
          chain,
          danger: cells.some((point) => point.y <= DANGER_LINE_Y),
          fever: feverActiveRef.current,
        });
        gained += points;
        if (kind === 'seven') {
          gainedSeven += points;
        }

        if (isBomb) {
          // ボムは英字バナーを盤面中段に出し、サイカが技名を叫ぶ
          const call = BOMB_CALLS[kind];
          if (call) {
            usedBomb = true;
            // ひっさつメを教えるメン（3メン・5メン・7メン・9メン）では、技名を略さずに言う
            const lessonCall = BOMB_LESSONS[storyRef.current ?? -1] !== undefined && kind !== 'nico';
            setSaika({
              text: lessonCall
                ? `${BOMB_FULL_NAMES[kind as BombKind][langRef.current]}！`
                : (feverActiveRef.current ? call.fever : call.saika)[langRef.current],
              mood: 'bomb',
            });
            // バナーは少し遅れて出す。消える範囲が見えたあとに技名が乗るほうが読みやすい。
            // 途中でリスタートされた場合に備え、世代を照合してから表示する。
            const token = bannerToken.current;
            if (call.banner) {
              runTimeout(() => {
                if (bannerToken.current === token) {
                  setBombBanner({ label: call.banner, kind });
                }
              }, BOMB_BANNER_DELAY_MS);
            }
          }
        } else if (chain >= 2 && !demoLock.current) {
          // 連鎖はバッジではなくサイカのセリフで伝える。
          // お手本（demoLock）で起きた連鎖はサイカ自身が出したものなので、はしゃがない
          setSaika({
            text: chainLine(langRef.current, chain, feverActiveRef.current, mapStageRef.current ?? storyRef.current),
            mood: chain >= BIG_CHAIN_MIN ? 'bigChain' : 'chain',
          });
        } else if (kind === 'seven' && demoLock.current) {
          // チュートリアルのお手本。消したのはサイカ自身なので、ここでは褒めない。
          // 「ねっ！消えたでしょ」は、消えきったあとに段取りの側で出す（ここではまだ消えていない）
        } else if (kind === 'seven') {
          // 連鎖になっていない1回きりの消去。小さく褒めておく
          setSaika({
            text: pickFrom(
              (feverActiveRef.current ? SAIKA_FEVER_SMILE_LINES : SAIKA_SMILE_LINES)[
                langRef.current
              ],
            ),
            mood: 'smile',
          });
        }

        if (kind === 'nico') {
          // くっついたニコニコメの中心へスポットライトを当て、
          // その外側を反転させながら白黒を混ぜて煽る。
          // 盤面にあるニコニコメ（くっついた塊と、共に発動するひとりぼっち）
          const nicos = cells.filter((point) => workingBoard[point.y][point.x]?.value === NICO);
          const isNicoAt = (x: number, y: number) => workingBoard[y]?.[x]?.value === NICO;
          // スポットライトは、くっついた塊にだけ当てる
          const joined = nicos.filter(
            (point) =>
              isNicoAt(point.x + 1, point.y) ||
              isNicoAt(point.x - 1, point.y) ||
              isNicoAt(point.x, point.y + 1) ||
              isNicoAt(point.x, point.y - 1),
          );
          const focus = joined.length > 0 ? joined : cells;
          const fx = focus.reduce((sum, point) => sum + point.x, 0) / focus.length;
          const fy = focus.reduce((sum, point) => sum + point.y, 0) / focus.length;
          setNicoCharge({
            x: ((fx + 0.5) / COLS) * 100,
            y: ((fy + 0.5) / ROWS) * 100,
          });
          // くっついたニコニコメ同士を白黒で交互に点滅させ、だんだん速く、
          // 震えもだんだん強くする。位相は市松の偶奇で決めるので、隣とは必ず逆
          // ひとりぼっちのニコニコメも一緒に発動するので、点滅と震えは全部に掛ける
          setArmingCells(
            new Map(nicos.map((point) => [`${point.x},${point.y}`, (point.x + point.y) % 2])),
          );
          if (soundModeRef.current !== 'none' && onTime()) {
            playNicoChargeSound();
          }
          await wait(NICO_CHARGE_MS);

          // 溜めきったら、画面を完全に止めて間を作る
          setNicoCharge(null);
          setArmingCells(new Map());
          await wait(NICO_HOLD_MS);
        }

        // 消える範囲を線でなぞる。ニコニコボムは専用の溜め演出があるので出さない。
        // 本来の線は、セヴン消しなら点滅が終わるまで、ボムなら弾けて少し経つまで残す。
        if (kind !== 'nico') {
          const life = isBomb
            ? BOMB_PRE_CLEAR_WAIT_MS + BOMB_TELEGRAPH_MS + BOMB_CHARGE_MS + 300
            : PRE_CLEAR_WAIT_MS + FLASH_MS;
          const sets: Array<Omit<TraceSet, 'id'>> = [];
          if (isBomb) {
            bombs.forEach((hit) => {
              const owned = hit.cells.filter(
                (point) => workingBoard[point.y][point.x]?.value !== NICO,
              );
              const paths =
                hit.kind === 'sla3'
                  ? sketchShapes(runPaths(owned, 'diagonal', 3), true)
                  : hit.kind === 'str6'
                    ? sketchShapes(runPaths(owned, 'straight', 4), true)
                    : sketchShapes(outlinePaths(owned));
              sets.push({
                paths,
                color: BOMB_GLOW_COLORS[hit.kind],
                delay: 0,
                life,
                fever: false,
                blink: true,
              });
            });
            // フィーバーで広がった範囲。遅れて点滅しながら出て、遅れて消える
            if (feverCaught.size > 0) {
              sets.push({
                paths: sketchShapes(outlinePaths(cells)),
                color: FEVER_TRACE_COLOR,
                delay: FEVER_TRACE_DELAY_MS,
                life: life - FEVER_TRACE_DELAY_MS + FEVER_TRACE_LINGER_MS,
                fever: true,
              });
            }
          } else {
            // 目の色の仲間ごとに分けて、それぞれの色でなぞる
            const families = new Map<number, Position[]>();
            cells.forEach((point) => {
              const value = workingBoard[point.y][point.x]?.value ?? 1;
              const family = sevenFamily(value);
              families.set(family, [...(families.get(family) ?? []), point]);
            });
            families.forEach((members, family) => {
              sets.push({
                paths: sketchShapes(outlinePaths(members)),
                color: SEVEN_TRACE_COLORS[family] ?? SEVEN_TRACE_COLOR,
                delay: 0,
                life,
                fever: false,
              });
            });
          }
          showTraces(sets);
        }

        // セヴン目の音は、消える絵より先に出す。
        // 以前はタメと発光を全部待ってから鳴らしていたので、
        // 揃った手応えが映像に置いていかれていた。
        if (!isBomb && soundModeRef.current !== 'none' && onTime()) {
          if (chain === 1 && earlyClearPiece.current === piece.id) {
            // 着地の瞬間に鳴らしたぶん。ここでは飛ばす
            earlyClearPiece.current = -1;
          } else {
            playClearSound(chain, feverActiveRef.current, clear.size);
            playClearThump(chain);
          }
        }
        // 連鎖の手応え。音の出だし（SEVEN_SOUND_DELAY_MS）に合わせて揺らす
        if (!isBomb && chain >= 2) {
          window.setTimeout(() => shakeBoard(chain >= 5 ? 'lg' : 'sm'), SEVEN_SOUND_DELAY_MS);
        }

        // アンチクショウメ：セヴン目は消える合図と同時に、ひっさつメは爆発と同時に白く光らせる
        if (!isBomb && anchiTouch.length > 0) flashAnchi(anchiTouch, workingBoard);
        // 当たった敵は、セヴン目のエフェクト（なぞり線と音）と同時に反応し始める。
        // 結果（消える・泡が減る・目がつぶれる）は今までどおり、メが消えたワンテンポあと。それまで反応し続ける
        if (!isBomb && enemyHits) {
          const bossDamage =
            enemyHits.hidoime.length > 0 ||
            (enemyHits.berabou.length > 0 && (berabouHp.current > 1)) ||
            detarameHitIndexes(enemyHits.detarame).size > 0;
          if (
            soundModeRef.current !== 'none' &&
            (bossDamage || enemyHits.koitsume.length + enemyHits.dame.length > 0)
          ) {
            playEnemyFlashSound(bossDamage);
          }
          if (enemyHits.koitsume.length + enemyHits.dame.length > 0) {
            setHitCells(
              new Set([...enemyHits.koitsume, ...enemyHits.dame].map((point) => `${point.x},${point.y}`)),
            );
          }
          if (enemyHits.hidoime.length > 0) {
            setHidoimeHit(new Set(enemyHits.hidoime));
          }
          // 最後の目（残り1つ）は、ふつうの7をはね返すので光らせない
          if (enemyHits.berabou.length > 0 && berabouHp.current > 1) {
            setBerabouHit(true);
          }
          if (enemyHits.detarame.length > 0) {
            setDetarameHit(detarameHitIndexes(enemyHits.detarame));
          }
        }

        // お手本の最中は、7になったメをすぐ消さずに点滅させ、反応したことを見せる
        if (demoLock.current && !isBomb) {
          setDemoBlink(clear);
          demoBlinkCount.current += 1;
          // 0メン以外のお手本は、操作の説明より流れを見せたいので半分の長さにする
          const blinkMs = demoBlinkCount.current <= DEMO_BLINK_LONG_TIMES ? DEMO_BLINK_MS : DEMO_BLINK_LATER_MS;
          await wait(storyRef.current === 0 ? blinkMs : blinkMs / 2);
          setDemoBlink(new Set());
        }

        // 消える直前のタメ。ボムは通常の3倍かけて溜める。
        // イチニノサンダーはカウントダウンで溜め終わっているので、すぐ消す
        if (kind !== 'thunder' && kind !== 'you456') await wait(isBomb ? BOMB_PRE_CLEAR_WAIT_MS : PRE_CLEAR_WAIT_MS);

        // ボムはさらに、消える範囲を光らせて見せる時間を置く
        if (glow) {
          setGlowCells(glow);
          await wait(BOMB_TELEGRAPH_MS);
          setGlowCells(new Map());
        }

        // 出る直前の溜め。対象のマスを本来の色と反対色で入れ替えて点滅させる。
        // フィーバーで巻き添えになったマスだけは、3色＋反対色の6色を回して
        // 別扱いだと分かるようにする。
        if (isBomb && kind !== 'thunder' && kind !== 'you456') {
          const charge = new Map<string, string>();
          clear.forEach((key) => {
            const [cx, cy] = key.split(',').map(Number);
            const cell = workingBoard[cy]?.[cx];
            if (!cell) {
              return;
            }
            charge.set(
              key,
              feverCaught.has(key) ? 'fever' : COMPLEMENT[cell.value - 1] ?? 'fever',
            );
          });
          setChargeCells(charge);
          await wait(BOMB_CHARGE_MS);
          setChargeCells(new Map());
        }

        // ひっさつメ・ニコニコボムの爆発で、端末をぶるっと震わせる
        if (isBomb) {
          haptics.bomb();
        }

        // ひっさつメ・ニコニコボムは、爆発と同時に敵へダメージの演出を出す
        if (isBomb && enemyHits) {
          const bossDamage =
            enemyHits.hidoime.length > 0 ||
            (enemyHits.berabou.length > 0 && (berabouHp.current > 1 || isHissatsu(kind))) ||
            detarameHitIndexes(enemyHits.detarame).size > 0;
          if (
            soundModeRef.current !== 'none' &&
            (bossDamage || enemyHits.koitsume.length + enemyHits.dame.length > 0)
          ) {
            playEnemyFlashSound(bossDamage);
          }
          const early = [...enemyHits.koitsume, ...enemyHits.dame];
          if (early.length > 0) {
            setHitCells(new Set(early.map((point) => `${point.x},${point.y}`)));
          }
          if (enemyHits.hidoime.length > 0) {
            setHidoimeHit(new Set(enemyHits.hidoime));
          }
          if (enemyHits.berabou.length > 0 && (berabouHp.current > 1 || isHissatsu(kind))) {
            setBerabouHit(true);
          }
          if (enemyHits.detarame.length > 0) {
            setDetarameHit(detarameHitIndexes(enemyHits.detarame));
          }
        }
        // アンチクショウメ：爆発と同時に、当たった身体を白く光らせる（目に当たっていれば目を細める）
        if (isBomb && kind !== 'thunder' && kind !== 'you456' && anchiTouch.length > 0 && anchiRef.current && !anchiRef.current.dying) {
          flashAnchi(anchiTouch, workingBoard);
        }

        // セヴン目ぶんは上で先に鳴らしている
        if (isBomb && soundModeRef.current !== 'none' && onTime()) {
          if (kind === 'nico') {
            playNicoSound();
          } else if (feverActiveRef.current) {
            playFeverBombSound();
          } else {
            playBombSound();
          }
        }
        // ひっさつメは大きく揺らす（音を消していても揺らす）
        if (isBomb) shakeBoard('lg');

        if (kind === 'nico') {
          // 盤面の2と5がまとめて白黒反転で激しく点滅する
          setBlastCells(clear);
          await wait(NICO_FLASH_MS);
          setBlastCells(new Set());
          setBombBanner(null);
    setNicoCharge(null);
        } else if (isBomb) {
          // ボムの重心から外向きに弾け飛ばす
          const cx = cells.reduce((sum, point) => sum + point.x, 0) / cells.length;
          const cy = cells.reduce((sum, point) => sum + point.y, 0) / cells.length;
          const bursts = new Map<string, BurstInfo>();
          cells.forEach((point) => {
            const dx = point.x - cx;
            const dy = point.y - cy;
            const length = Math.hypot(dx, dy) || 1;
            bursts.set(`${point.x},${point.y}`, {
              dir: { x: dx / length, y: dy / length },
              particles: makeParticles(),
            });
          });
          setBurstCells(bursts);
          await wait(BOMB_FLASH_MS);
          setBurstCells(new Map());
          setBombBanner(null);
        } else {
          setClearingCells(clear);
          await wait(FLASH_MS);
          setClearingCells(new Set());
        }

        if (hyoketsuPractice && !isBomb) {
          const thawKeys = new Set<string>();
          cells.forEach(({x,y})=>[[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{if(workingBoard[y+dy]?.[x+dx]?.hyoketsu==='frozen')thawKeys.add((x+dx)+','+(y+dy));}));
          workingBoard=workingBoard.map((row,y)=>row.map((c,x)=>c&&thawKeys.has(x+','+y)?{...c,value:-7,hyoketsu:'active' as const,fuse:6}:c));
          if(thawKeys.size){setBoard(workingBoard);setSaika({text:'ヒョーケツメが解凍！ あと6手！',mood:'praise'});}
        }
        if(enjoPractice&&!isBomb){const hits=enjoWallHits(workingBoard,cells);if(hits.size){const key=[...hits][0].split(',').map(Number),part=workingBoard[key[1]][key[0]]!.enjo!;setEnjoBreaking(part.part===0?'top':part.part===part.rows-1?'bottom':'middle');runTimeout(()=>setEnjoBreaking(undefined),660);workingBoard=workingBoard.map((row,y)=>row.map((c,x)=>c?.enjo&&hits.has(x+','+y)?{...c,enjo:{...c.enjo,open:true}}:c));setBoard(workingBoard);if(soundModeRef.current!=='none'){const ctx=getAudioContext(),bus=getSfxBus('effect');if(ctx&&bus)playEnjoWallBreak(ctx,bus);}setSaika({text:'壁を解除！ 全段開いたら炎をタップ！',mood:'praise'});}}
        // 消去に巻き込まれたブロックを控えておく。
        // 残ったメはこのあとバラバラになり、1マスずつ独立して落ちる。
        const affected = new Set<number>();
        clear.forEach((key) => {
          const [cx, cy] = key.split(',').map(Number);
          const cell = workingBoard[cy][cx];
          if (cell) {
            affected.add(cell.group);
          }
        });

        workingBoard = workingBoard.map((row, y) =>
          row.map((cell, x) => (clear.has(`${x},${y}`) ? null : cell)),
        );
        workingBoard = dissolveGroups(workingBoard, affected);
        setBoard(workingBoard);

        // 命中・撃破SEは処理が遅れても省かない。ミュート設定は尊重する。
        // 敵への命中。セヴン目が消えたすかさず「ビシュッ」と鳴らし、
        // 当たった敵を一瞬白く弾ませてから、コイツメは消し、ダメはコイツメに変える
        if (enemyHits && enemyHits.koitsume.length + enemyHits.dame.length > 0) {
          if (isBomb) {
            // ダメージの演出は爆発と同時に出してある。メが消えてからワンテンポ置いて消す
            await wait(ENEMY_VANISH_DELAY_MS);
            setHitCells(new Set());
          } else {
            await wait(ENEMY_HIT_GAP_MS);
            // 震えはセヴン目のエフェクトの時点で始まっている。ここまで震えさせてから消す
            await wait(ENEMY_HIT_MS);
            setHitCells(new Set());
          }
          const killed = new Set(enemyHits.koitsume.map((point) => `${point.x},${point.y}`));
          koitsumeKilled += killed.size;
          const damaged = new Set(enemyHits.dame.map((point) => `${point.x},${point.y}`));
          dameDamaged += damaged.size;
          const enemyGroups = new Set<number>();
          workingBoard = workingBoard.map((row, y) =>
            row.map((cell, x) => {
              const key = `${x},${y}`;
              if (!cell) return cell;
              if (killed.has(key)) {
                enemyGroups.add(cell.group);
                return null;
              }
              return damaged.has(key) ? { ...cell, value: KOITSUME } : cell;
            }),
          );
          workingBoard = dissolveGroups(workingBoard, enemyGroups);
          if (killed.size > 0 && soundModeRef.current !== 'none') {
            playSmallEnemyDefeatSound();
          }
          setBoard(workingBoard);
          // 倒したコイツメ1体につき300点
          const bonus = killed.size * ENEMY_BONUS;
          gained += bonus;
        }

        // ヒドイメへの命中。当たった個体ごとに1ダメージ。泡が1段減って、0になったら倒れる
        if (enemyHits && enemyHits.hidoime.length > 0) {
          const groups = enemyHits.hidoime;
          if (isBomb) {
            // 被弾の演出は爆発と同時に出してある。メが消えてからワンテンポ置いて結果を出す
            await wait(ENEMY_VANISH_DELAY_MS);
            setHidoimeHit(new Set());
          } else {
            await wait(ENEMY_HIT_GAP_MS);
            // 白い点滅ともがきは、セヴン目のエフェクトの時点で始まっている
            await wait(HIDOIME_HIT_MS);
            setHidoimeHit(new Set());
          }
          const felled = new Set<number>();
          groups.forEach((group) => {
            const hp = Math.max(0, (hidoimeHp.current.get(group) ?? HIDOIME_HP) - 1);
            hidoimeHp.current.set(group, hp);
            if (hp === 0) felled.add(group);
          });
          // 倒れた個体は、消える演出が終わるまで最後の位置に残して見せる。盤面からはすぐ外す
          const lastPos = new Map<number, Position>();
          workingBoard.forEach((row, y) =>
            row.forEach((cell, x) => {
              if (cell && felled.has(cell.group) && !lastPos.has(cell.group)) {
                lastPos.set(cell.group, { x, y });
              }
            }),
          );
          setHidoimeView((prev) => {
            const next = new Map(prev);
            groups.forEach((group) => {
              const item = next.get(group);
              if (!item) return;
              const hp = hidoimeHp.current.get(group) ?? 0;
              next.set(group, { ...item, hp, dying: felled.has(group), pos: lastPos.get(group) ?? item.pos });
            });
            return next;
          });
          if (felled.size > 0) {
            haptics.big(); // 大きな敵を倒した
            // HPが0になって消滅演出へ入る瞬間。同時撃破でも音は1回にまとめる。
            if (soundModeRef.current !== 'none') {
              playHidoimeDefeatSound();
            }
            workingBoard = workingBoard.map((row) =>
              row.map((cell) => (cell && felled.has(cell.group) ? null : cell)),
            );
            setBoard(workingBoard);
            hidoimeDefeated.current += felled.size;
            setHidoimeDefeatedView(hidoimeDefeated.current);
            gained += felled.size * HIDOIME_BONUS;
          }
        }

        // 18メン：デタラメへの命中。当たった段の目だけが消え、その段は無地の身体として残る。
        // 目がぜんぶ消えたら、下へ崩れて消える（上にあったサイはこのあと自然に落ちる）
        if (enemyHits && enemyHits.detarame.length > 0 && detaramesRef.current.length > 0) {
          const struckAll = detarameHitIndexes(enemyHits.detarame);
          if (struckAll.size > 0) {
            await wait(isBomb ? ENEMY_VANISH_DELAY_MS : ENEMY_HIT_GAP_MS);
            // セヴン目の時点で付けた被弾表示をいったん外し、ダメージの瞬間に図鑑と同じ
            // 「白フラ → 細目」を必ず頭から再生する（同じクラスのままだとアニメーションが再生されない）
            setDetarameHit(new Map());
            await wait(34);
            setDetarameHit(struckAll);
            // この白フラッシュが実ダメージ。最初の消去合図とは別の音を、同じ瞬間に重ねる。
            if (soundModeRef.current !== 'none') {
              playDetarameDamageSound([...struckAll.values()].reduce((sum, indexes) => sum + indexes.size, 0));
            }
            await wait(DETARAME_HIT_MS);
            setDetarameHit(new Map());
          }
          for (const [hitId, struck] of struckAll) {
            const d = detaramesRef.current.find((item) => item.id === hitId);
            if (!d) continue;
            const segs = d.segs.map((s, i) => (struck.has(i) ? { ...s, alive: false } : s));
            const left = segs.filter((s) => s.alive).length;
            if (left === 0) {
              haptics.big(); // 大きな敵を倒した
              if (soundModeRef.current !== 'none') {
                playHidoimeDefeatSound();
              }
              updateDetarameById(d.id, { ...d, segs, dying: true });
              setSaika({ text: DETARAME_LINES.defeat[langRef.current], mood: 'praise' });
              await wait(650 + segs.length * 80);
              workingBoard = workingBoard.map((row) =>
                row.map((cell) => (cell && cell.group === detarameGroup(d.id) ? null : cell)),
              );
              setBoard(workingBoard);
              updateDetarameById(d.id, null);
              detarameDefeated.current += 1;
              setDetarameDefeatedView(detarameDefeated.current);
              gained += DETARAME_BONUS;
            } else {
              // てっぺんから続く無地の段は取り除き、目のある段まで縮める（上にあったサイはこのあと落ちる）
              let lead = 0;
              while (lead < segs.length && !segs[lead].alive) lead += 1;
              if (lead > 0) {
                workingBoard = workingBoard.map((row, y) =>
                  y >= d.top && y < d.top + lead ? row.map((cell, x) => (x === d.x ? null : cell)) : row,
                );
                setBoard(workingBoard);
                updateDetarameById(d.id, { ...d, segs: segs.slice(lead), top: d.top + lead });
              } else {
                updateDetarameById(d.id, { ...d, segs });
              }
              setSaika({ text: detarameHitLine(left)[langRef.current], mood: 'praise' });
            }
          }
        }

        // 最後の目（残り1つ）は、ひっさつメ以外をはね返す
        const berabouGuarded =
          !!enemyHits && enemyHits.berabou.length > 0 && berabouHp.current === 1 && !isHissatsu(kind);
        if (berabouGuarded) {
          await wait(isBomb ? ENEMY_VANISH_DELAY_MS : ENEMY_HIT_GAP_MS);
          setBerabouHit(false);
          setBerabouGuard(true);
          if (soundModeRef.current !== 'none') {
            playEnemyHitSound(false);
          }
          setSaika({ text: BERABOU_GUARD_LINE[langRef.current], mood: 'worry' });
          await wait(420);
          setBerabouGuard(false);
        }

        // ベラボウメへの命中。1回の消去で目が1つつぶれる。9つぜんぶつぶれたら倒れる
        if (enemyHits && enemyHits.berabou.length > 0 && !berabouGuarded) {
          berabouStruck = true;
          if (isBomb) {
            await wait(ENEMY_VANISH_DELAY_MS);
            setBerabouHit(false);
          } else {
            await wait(ENEMY_HIT_GAP_MS);
            // 白い点滅は、セヴン目のエフェクトの時点で始まっている
            await wait(HIDOIME_HIT_MS);
            setBerabouHit(false);
          }
          // ひっさつメ（ニコニコボム含む）は目を2つ減らす。ただし残り2つのときは1つだけ
          const hp = Math.max(0, berabouHp.current - berabouDamage(berabouHp.current, isHissatsu(kind)));
          berabouHp.current = hp;
          const lastPos = findBerabou(workingBoard);
          setBerabouView((prev) =>
            prev ? { ...prev, hp, dying: hp === 0, pos: lastPos ?? prev.pos } : prev,
          );
          if (hp === 0) {
            haptics.big(); // 大きな敵を倒した
            if (soundModeRef.current !== 'none') {
              playHidoimeDefeatSound();
            }
            workingBoard = workingBoard.map((row) =>
              row.map((cell) => (cell && cell.value === BERABOU ? null : cell)),
            );
            setBoard(workingBoard);
            berabouDefeated.current = 1;
            setBerabouDefeatedView(1);
            gained += BERABOU_BONUS;
            setSaika({ text: BERABOU_LINES.defeat[langRef.current], mood: 'praise' });
            // はじけて消える演出（CSS の berabou-die）が終わったら片付ける
            runTimeout(() => setBerabouView(null), 900);
          } else {
            setSaika({
              text: (hp === 1 ? BERABOU_LAST_LINE : berabouHitLine(hp))[langRef.current],
              mood: 'praise',
            });
          }
        }

        if(sanzMode && anchiTouch.length && !anchiEyeHit){
          const removed=new Set(anchiTouch.filter(p=>p.x!==3).map(p=>p.x+','+p.y));
          workingBoard=workingBoard.map((row,y)=>row.map((cell,x)=>cell?.value===ANCHI&&removed.has(x+','+y)?null:cell));
          setBoard(workingBoard);
        }
        // アンチクショウメ：目に当たっていたら、メが消えたその場で倒れる（連鎖の終わりまで待たない）
        if (anchiEyeHit && anchiRef.current && !anchiRef.current.dying) {
          anchiFelled = true;
          workingBoard = await defeatAnchi(workingBoard);
          gained += ANCHI_BONUS;
        }

        // 残ったメを落として詰める
        workingBoard = await settle(workingBoard, true);
      }

      if(enjoPractice&&enjoLaunch!==null){
        setEnjoFlight({x:enjoLaunch,phase:'drop'});await wait(350);if(storyRunRef.current!==activeScriptRun)return;
        const hot=enjoPracticeFever||feverActiveRef.current,area=enjoPyramid(COLS,ROWS,enjoLaunch,hot),keys=new Set(area.map(p=>p.x+','+p.y));
        setEnjoFlight(null);setEnjoBlast(hot);setClearingCells(keys);if(soundModeRef.current!=='none'){const ctx=getAudioContext(),bus=getSfxBus('effect');if(ctx&&bus)playEnjoImpact(ctx,bus);}shakeBoard('lg');
        await wait(1700);if(storyRunRef.current!==activeScriptRun)return;
        const before=workingBoard;workingBoard=workingBoard.map((row,y)=>row.map((c,x)=>keys.has(x+','+y)?null:c));setEnjoBlast(null);setClearingCells(new Set());setBoard(workingBoard);workingBoard=await settle(dissolveShrunkGroups(before,workingBoard),true);
      }
      if (hyoketsuPractice && !traceStrike) {
        const blast = new Set<string>();
        const expiredHyoketsu = new Set<string>();
        workingBoard=workingBoard.map((row,y)=>row.map((c,x)=>{
          if(c?.hyoketsu!=='active'||!activeHyoketsu.has(c.id))return c;
          const fuse=(c.fuse??6)-1;
          if(fuse<=0)expiredHyoketsu.add(c.id);
          if(fuse<=0)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(workingBoard[y+dy]?.[x+dx])blast.add((x+dx)+','+(y+dy));
          return {...c,fuse};
        }));
        if(blast.size){
          const bursts=workingBoard.flatMap((row,y)=>row.flatMap((c,x)=>c&&expiredHyoketsu.has(c.id)?[{x:x-1,y:y-1,flashCells:[...blast].map(key=>{const [bx,by]=key.split(',').map(Number);return {x:bx-(x-1),y:by-(y-1)};}).filter(p=>p.x>=0&&p.x<3&&p.y>=0&&p.y<3)}]:[]));
          setHyoketsuBlasts(bursts);
          if(soundModeRef.current!=='none')playHyoketsuFreezeSound();
          setBoard(workingBoard);setClearingCells(new Set());
          await wait(1000);if(storyRunRef.current!==activeScriptRun)return;
          await wait(800);if(storyRunRef.current!==activeScriptRun)return;
          if(soundModeRef.current!=='none')playHyoketsuCrashSound();
          shakeBoard('sm');await wait(HYOKETSU_BURST_MS-1800);
          if(storyRunRef.current!==activeScriptRun)return;
          const before=workingBoard;
          workingBoard=workingBoard.map((row,y)=>row.map((c,x)=>blast.has(x+','+y)&&(!c?.hyoketsu||expiredHyoketsu.has(c.id))?null:c));
          setHyoketsuBlasts([]);setClearingCells(new Set());setBoard(workingBoard);
          workingBoard=await settle(dissolveShrunkGroups(before,workingBoard),true);
        }else setBoard(workingBoard);
      }
      // アンチクショウメ：目にひっさつメが当たっていたら倒れる。当たらなければ1手ぶん成長する
      if (anchiRef.current && !anchiRef.current.dying) {
        if (!anchiEyeHit && !traceStrike) {
          const beforeGrow = workingBoard;
          workingBoard = await growAnchi(workingBoard);
          if (storyRunRef.current !== activeScriptRun) return;
          // 食べられたサイのブロックの残りが浮かないように落とす
          const loosened = dissolveShrunkGroups(beforeGrow, workingBoard);
          if (loosened !== workingBoard) workingBoard = await settle(loosened, true);
        }
      }

      // お手本（demoLock）でサイカが見せたチェインは数えない。数えると MISSION が進み、
      // 「あと1回！」が説明のセリフを上書きしてしまう
      if (storyRef.current !== null && chain >= 2 && !demoLock.current) {
        storyCombosRef.current += 1;
        setStoryCombos(storyCombosRef.current);
      }

      const nextScore = score + gained;
      const nextLevelScore = levelScore + gainedSeven;
      setScore(nextScore);
      setLevelScore(nextLevelScore);
      setLevel(Math.floor(nextLevelScore / 5000) + 1);

      // ボムが決まったあとはサイカがひとこと。1秒だけ出して、そのあと通常のセリフへ戻す。
      // お手本（demoLock）で決めたぶんはサイカ自身が出したものなので、褒めない。
      if (usedBomb && !demoLock.current) {
        setSaika({
          text: pickFrom(
            (feverActiveRef.current ? SAIKA_FEVER_PRAISE_LINES : SAIKA_PRAISE_LINES)[
              langRef.current
            ],
          ),
          mood: 'praise',
        });
        runTimeout(() => {
          setSaika((value) =>
            value.mood === 'praise'
              ? { text: pickFrom(idleLines(langRef.current, feverActiveRef.current)), mood: 'idle' }
              : value,
          );
        }, SAIKA_PRAISE_MS);
      }

      // 消したマス数を虹ボムの2本のカウンターへ入れる。
      // 履歴は増えるだけ、支給用は閾値に届いたら減算する。
      if (totalCleared > 0) {
        clearedTotal.current += totalCleared;
        saveNumber(RAINBOW_KEYS.total, clearedTotal.current);
      }
      // 累積スコアに足す（どのモードでも）。RAINBOW_STEP を越えたら虹ボムを1つ。
      // 一度にいくつ越えても、手に入るのは1つまで。
      // ストーリーでは、虹ボムを教わる15メンをクリアするまでは手に入らない（スコアモードでは最初から）
      if (gained > 0) {
        const before = totalScoreRef.current;
        const after = before + gained;
        totalScoreRef.current = after;
        setTotalScore(after);
        saveNumber(TOTAL_SCORE_KEY, after);
        const crossed = Math.floor(after / RAINBOW_STEP) > Math.floor(before / RAINBOW_STEP);
        const allowed = !enemyPractice && (storyRef.current === null || (mapRun.current ? wallAbilities(wallProgressRef.current.cleared).includes('rainbow') : storyClearedRef.current >= RAINBOW_STAGE));
        if (crossed && allowed && rainbowStockRef.current < RAINBOW_MAX_STOCK) {
          setRainbowStock((value) => {
            const next = Math.min(RAINBOW_MAX_STOCK, value + 1);
            saveNumber(RAINBOW_KEYS.stock, next);
            return next;
          });
          pendingAward.current = 1;
        }
      }

      // フィーバー中はゲージが減り続けるので、ここでは溜めない
      // ストーリーでは11メンで『FEVER』を習得するまで溜まらない
      if (!feverActiveRef.current && feverOpenIn(storyRef.current, mapPowers())) {
        if (gained > 0) {
          setFever((value) => Math.min(100, value + totalCleared * 4 + chain * 5));
        } else {
          setFever((value) => Math.max(0, value - 4));
        }
      }

      isResolving.current = false;

      // ストーリー：このコロの目標を満たしたらクリア
      const stageNo = storyRef.current;
      if (stageNo !== null) {
        const goal = STORY_STAGES[stageNo].goal;
        let enemies = countEnemies(workingBoard);
        if (goal.type === 'wall' && goal.mission.enemyWaveSize) {
          wallCounts.current.enemyKills += koitsumeKilled;
          setWallCountsView({ ...wallCounts.current });
          if (enemies.koitsume + enemies.dame === 0 && wallEnemySpawned.current < goal.mission.enemies.length) {
            workingBoard = await dropCampaignEnemies(workingBoard, stageNo, Math.min(goal.mission.enemyWaveSize, goal.mission.enemies.length - wallEnemySpawned.current));
            if (storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo) return;
            enemies = countEnemies(workingBoard);
          }
        }
        // コイツメを全滅させたら、同じ数のコイツメが追加で降ってくる（1回だけ）
        if (goal.type === 'wall' && wallReinforcePending.current > 0 && enemies.koitsume === 0) {
          const n = wallReinforcePending.current;
          setSaika({ text: langRef.current === 'ja' ? 'まだ来る！\nコイツメが降ってきた！' : 'More are coming!\nKoitsume incoming!', mood: 'worry' });
          workingBoard = await dropCampaignEnemies(workingBoard, stageNo, n, true);
          if (storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo) return;
          enemies = countEnemies(workingBoard);
        }
        if (goal.type === 'bomb') {
          await bombLockRef.current(workingBoard, firedKinds.has(goal.kind), nextScore);
          return;
        }
        if (goal.type === 'koitsume') {
          await koiLockRef.current(workingBoard, koitsumeKilled, nextScore);
          return;
        }
        if (goal.type === 'dame') {
          await dameLockRef.current(workingBoard, koitsumeKilled, dameDamaged, nextScore);
          return;
        }
        // 16メン：最初に1つ消したら、ヒドイメの大群が降ってくる
        if (stageNo === SWARM_STAGE && chain > 0) {
          const before = swarmCleared.current;
          swarmCleared.current += totalCleared;
          if (before >= SWARM_START_CLEARED && swarmSpawned.current + swarmPending.current < SWARM_MAX) {
            // On the map an empty battlefield always receives the next scheduled enemy.
            const noLiveSwarm = !workingBoard.some(row => row.some(cell => cell?.value === HIDOIME));
            if ((mapRun.current && noLiveSwarm) || Math.random() < SWARM_RATE) swarmPending.current += 1;
          }
          if (swarmPending.current > 0) {
            const slot = pickSwarmDrop(workingBoard);
            if (slot) {
              swarmPending.current -= 1;
              swarmSpawned.current += 1;
              workingBoard = await runHidoimeEntrance(workingBoard, stageNo, [SWARM_LINES.appear], {
                midGame: true,
                sense: SWARM_LINES.sense,
                sfx: { id: 'gogogo', x: slot.x + 1, y: 2.5 },
                drop: { group: -950 - swarmSpawned.current, x: slot.x, floor: slot.floor },
              });
              if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
            }
          }
        }
        let finaleJustStarted = false;
        if (goal.type === 'allstars') {
          const left = countEnemies(workingBoard);
          if (allstarPhase.current === 0 && left.koitsume + left.dame === 0) {
            allstarPhase.current = 1;
            setAllstarView(1);
            workingBoard = await runHidoimeEntrance(workingBoard, stageNo, [HIDOIME_LINES.appear], {
              midGame: true,
              sense: ALLSTAR_LINES.hidoime,
            });
            if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
          } else if (allstarPhase.current === 1 && hidoimeDefeated.current >= 1) {
            allstarPhase.current = 2;
            finaleJustStarted = true;
            setAllstarView(2);
            setSaika({ text: ALLSTAR_LINES.finale[langRef.current], mood: 'worry' });
            await delay(1600);
            if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
            // ベラボウメは左か右の端に、デタラメはそれと重ならない列に出す
            const bx = Math.random() < 0.5 ? 0 : COLS - 3;
            const freeCols = [0, 1, 2, 3, 4, 5, 6].filter((c) => c < bx || c > bx + 2);
            const dx = freeCols[Math.floor(Math.random() * freeCols.length)];
            workingBoard = await runBerabouEntrance(workingBoard, stageNo, { midGame: true, x: bx });
            if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
            workingBoard = await runDetarameEntrance(workingBoard, stageNo, dx, { midGame: true });
            if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
          }
        }
        if (goal.type === 'waves') {
          if (mapRun.current && wavePending.current > 0) {
            const pendingWave = WAVES[waveRef.current];
            const queued = placeEnemiesOnTops(workingBoard, pendingWave.kind === 'dame' ? DAME : KOITSUME, wavePending.current);
            wavePending.current -= queued.placed.length;
            workingBoard = queued.board;
            setBoard(workingBoard);
          }
          const left = countEnemies(workingBoard);
          const current = WAVES[waveRef.current];
          const cleared =
            left.koitsume + left.dame === 0 && wavePending.current === 0 &&
            (current.kind !== 'hidoime' || hidoimeDefeated.current >= 1);
          if (cleared && waveRef.current < WAVES.length - 1) {
            waveRef.current += 1;
            setWaveView(waveRef.current);
            const wave = WAVES[waveRef.current];
            if (wave.kind === 'hidoime') {
              workingBoard = await runHidoimeEntrance(workingBoard, stageNo, [HIDOIME_LINES.appear], {
                midGame: true,
                sense: wave.line,
              });
              if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
            } else {
              const { board: spawned, placed } = placeEnemiesOnTops(
                workingBoard,
                wave.kind === 'dame' ? DAME : KOITSUME,
                wave.count,
              );
              if (mapRun.current) wavePending.current = wave.count - placed.length;
              workingBoard = spawned;
              setBoard(workingBoard);
              setSpawnCells(new Set(placed.map((point) => `${point.x},${point.y}`)));
              setSaika({ text: wave.line[langRef.current], mood: 'worry' });
              if (soundModeRef.current !== 'none') {
                playEnemyHitSound(false);
              }
              await delay(700);
              setSpawnCells(new Set());
              if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
            }
          }
        }
        // 18メン：デタラメの手番。プレイヤーの1手ごとに、伸びる → ビームの順で動く
        // 登場したその手番では、まだ動かない
        const finaleOn = stageNo === ALLSTAR_STAGE && allstarPhase.current === 2 && !finaleJustStarted;
        const detarameMission = mapRun.current ? wallMission(mapStageRef.current)?.detarameTotal : undefined;
        const beforeDetarame = workingBoard;
        if ((stageNo === DETARAME_STAGE || finaleOn || detarameMission) && detaramesRef.current.some((d) => !d.dying)) {
          for (const d of [...detaramesRef.current]) {
            if (d.dying || !detaramesRef.current.some((item) => item.id === d.id)) continue;
            workingBoard = await runDetarameTurn(workingBoard, d.id);
            if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
          }
        }
        // ウォール6-3・6-4：倒した分だけ次のデタラメが出てくる（同時に出るのは detarameAtOnce 体まで）
        if (detarameMission) {
          const m = wallMission(mapStageRef.current)!;
          const live = detaramesRef.current.filter((d) => !d.dying).length;
          if (live < (m.detarameAtOnce ?? 1) && detarameSpawned.current < detarameMission) {
            const x = pickDetarameColumn(workingBoard);
            if (x !== null) {
              workingBoard = await runDetarameEntrance(workingBoard, stageNo, x, { midGame: true, add: true });
              if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
              demoLock.current = false;
            }
          }
        }
        // デタラメが食べた・敵に変えたサイのブロックの残りが浮かないように落とす
        {
          const loosened = dissolveShrunkGroups(beforeDetarame, workingBoard);
          if (loosened !== workingBoard) {
            workingBoard = await settle(loosened, true, () => storyRunRef.current === activeScriptRun && storyRef.current === stageNo);
            if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
          }
        }
        // 17メン：ダメージを受けないまま BERABOU_HEAL_TURNS 手たつと、つぶれた目が1つ開き直る。
        // 残り1つのときと、目がぜんぶそろっているときは回復しない（カウントだけ戻す）
        if ((stageNo === BERABOU_STAGE || finaleOn) && berabouDefeated.current === 0 && findBerabou(workingBoard)) {
          if (berabouStruck) {
            berabouIdle.current = 0;
          } else {
            berabouIdle.current += 1;
            const hp = berabouHp.current;
            const canHeal = hp > 1 && hp < BERABOU_HP;
            if (canHeal && berabouIdle.current === BERABOU_HEAL_TURNS - 1) {
              setSaika({ text: BERABOU_HEAL_LINES.warn[langRef.current], mood: 'worry' });
            }
            if (berabouIdle.current >= BERABOU_HEAL_TURNS) {
              berabouIdle.current = 0;
              if (canHeal) {
                // 最後につぶれた目から開く
                const reopen = BERABOU_EYE_ORDER[BERABOU_HP - hp - 1];
                berabouHp.current = hp + 1;
                setBerabouView((prev) => (prev ? { ...prev, hp: hp + 1, reopen } : prev));
                runTimeout(
                  () => setBerabouView((prev) => (prev ? { ...prev, reopen: undefined } : prev)),
                  700,
                );
                setSaika({ text: BERABOU_HEAL_LINES.heal[langRef.current], mood: 'worry' });
                if (soundModeRef.current !== 'none') {
                  playEnemyHitSound(false);
                }
              }
            }
          }
        }
        // 残り1目は、プレイヤーの1手ごとに40%で暴れる。回復と同じ手番で1回だけ。
        // 通常の消去・スコア計算が終わったあとで直接取り除くので、破壊分は0点。
        if ((stageNo === BERABOU_STAGE || finaleOn) && berabouDefeated.current === 0) {
          const rage = planBerabouRampage(workingBoard, berabouHp.current);
          if (rage) {
            const run = ++berabouRageRun.current;
            const stillCurrent = () =>
              berabouRageRun.current === run && (storyRunRef.current === activeScriptRun && storyRef.current === stageNo);
            isResolving.current = true;
            setBerabouRaging(true);
            if (soundModeRef.current !== 'none') playBerabouRageSound();
            await wait(BERABOU_RAGE_WINDUP_MS);
            if (!stillCurrent()) return;

            const fling = new Map<string, Position>();
            const affected = new Set<number>();
            rage.victims.forEach(({ x, y }) => {
              fling.set(`${x},${y}`, { x: x - (rage.pos.x + 1), y: y - (rage.pos.y + 1) });
              const cell = workingBoard[y][x];
              if (cell) affected.add(cell.group);
            });
            setFlingCells(fling);
            if (rage.victims.length > 0 && soundModeRef.current !== 'none') {
              playSmallEnemyDefeatSound();
            }
            await wait(BERABOU_FLING_MS);
            if (!stillCurrent()) return;
            setFlingCells(new Map());
            if (rage.victims.length > 0) {
              workingBoard = workingBoard.map((row, y) =>
                row.map((cell, x) => (fling.has(`${x},${y}`) ? null : cell)),
              );
              workingBoard = dissolveGroups(workingBoard, affected);
              setBoard(workingBoard);
              // 破壊で浮いたサイを落とす。ここでは連鎖判定も得点加算も行わない。
              workingBoard = await settle(workingBoard, true, stillCurrent);
              if (!stillCurrent()) return;
            }
            setBerabouRaging(false);
            isResolving.current = false;
          }
        }
        if (goal.type === 'tutorial') {
          // チュートリアルは進行を専用の段取りに任せる（お手本・成功・ミスの数え方が違う）
          await tutorialLockRef.current(workingBoard, chain > 0, nextScore);
          return;
        }
        const campaignMission = mapRun.current ? wallMission(mapStageRef.current) : undefined;
        const campaignProgress = campaignMission && campaignMission.kind !== 'lesson' && !campaignMission.scoreTarget
          ? campaignEnemyProgress(campaignMission, workingBoard) : null;
        const met = campaignMission && campaignMission.kind !== 'lesson'
          ? campaignMission.scoreTarget ? nextScore >= campaignMission.scoreTarget
            : !!campaignProgress && campaignProgress[1] > 0 && campaignProgress[0] === campaignProgress[1]
          : goal.type === 'wall'
            ? wallObjectiveMet(goal.mission, wallCounts.current, nextScore, storyCombosRef.current, enemies.koitsume + enemies.dame + wallReinforcePending.current)
            : goal.type === 'score'
            ? nextScore >= goal.target
            : goal.type === 'combo'
              ? storyCombosRef.current >= goal.target
              : goal.type === 'hidoime'
                ? hidoimeDefeated.current >= goal.target
              : goal.type === 'berabou'
                ? berabouDefeated.current >= 1
              : goal.type === 'detarame'
                ? detarameDefeated.current >= 1
              : goal.type === 'allstars'
                ? allstarPhase.current === 2 && berabouDefeated.current >= 1 && detarameDefeated.current >= 1
                : goal.type === 'fever'
                  ? enemies.koitsume + enemies.dame === 0 && hidoimeDefeated.current >= 1
                  : goal.type === 'rainbow'
                    ? false
                  : goal.type === 'waves'
                    ? waveRef.current === WAVES.length - 1 &&
                      countEnemies(workingBoard).koitsume + countEnemies(workingBoard).dame === 0 &&
                      hidoimeDefeated.current >= 1
                    : enemies.koitsume + enemies.dame === 0;
        if (met) {
          // ヒドイメは、はじけて消える演出を見届けてからクリアにする
          if (anchiFelled || goal.type === 'hidoime' || goal.type === 'fever' || goal.type === 'waves' || goal.type === 'berabou' || goal.type === 'detarame' || goal.type === 'allstars') {
            if (goal.type === 'allstars') setAllstarView(3);
            await delay(1700);
            if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
          }
          completeStage(stageNo, nextScore);
          return;
        }
      }

      // 最上段にメが乗った時点で終了。
      // 「上から2段目のブロックの上に、さらにブロックが置かれた」状態にあたる。
      if (isTopReached(workingBoard)) {
        const saved = await runGameOverFreeze(workingBoard);
        if (saved) {
          // 助かった。危険領域を消して、そのまま次のブロックへ進む
          workingBoard = rainbowClear(workingBoard);
          setBoard(workingBoard);
        } else {
          recordGameOver(nextScore);
          return;
        }
      }

      if (traceStrike) {
        // イチニノサンダーは落ちてくる途中のブロックをそのまま残し、続きから操作に戻す
        lastFallAt.current = performance.now();
        setStatus('playing');
        return;
      }
      await spawnNext(workingBoard, nextScore);
    },
    [board, levelScore, playTouchdownSound, recordGameOver, score, showTraces, spawnNext],
  );

  const scoreRef = useRef(0);
  scoreRef.current = score;

  // --- イチニノサンダー ---
  // [1][2][3] がつながると黄色く光り、光ったサイを指でなぞると発動する
  const boardNow = useRef(board);
  boardNow.current = board;
  const lockPieceRef = useRef(lockPiece);
  lockPieceRef.current = lockPiece;
  const thunderOpen = story === null || (mapPowers()?.includes('thunder') ?? false);
  const thunderSet = useMemo(
    () => (thunderOpen && status === 'playing' ? findThunderSet(board) : null),
    [board, status, thunderOpen],
  );
  const thunderKeys = useMemo(
    () => new Set((thunderSet ?? []).map((point) => `${point.x},${point.y}`)),
    [thunderSet],
  );
  // No campaign lesson/unlock has been assigned yet. Available in score mode
  // and all isolated enemy practices, including its own catalogue practice.
  const you456Open = story === null || !!enemyPractice;
  const you456Set = useMemo(() => you456Open && status === 'playing' ? findYou456Set(board) : null, [board, status, you456Open]);
  const you456SetRef = useRef(you456Set); you456SetRef.current = you456Set;
  const you456Keys = useMemo(() => new Set((you456Set ?? []).map(p => `${p.x},${p.y}`)), [you456Set]);
  const [you456Beam, setYou456Beam] = useState<You456Strike | null>(null);
  const [you456Call, setYou456Call] = useState(false);
  const you456Busy = useRef<number | null>(null);
  const fireYou456 = async () => {
    const set = you456SetRef.current;
    if (!set || you456Busy.current !== null || thunderBusy.current || isResolving.current || statusNow.current !== 'playing') return;
    const run = storyRunRef.current;
    you456Busy.current = run;
    const strike: You456Strike = { ...you456Lines(COLS, ROWS, set[0], feverActiveRef.current), used: set.map(p => ({ ...p })) as typeof set };
    setStatus('clearing');
    setYou456Call(true);
    try {
      await delay(180);
      if (run !== storyRunRef.current) return;
      setYou456Beam(strike);
      if (soundModeRef.current !== 'none') playThunderStrikeSound();
      await delay(180);
      if (run !== storyRunRef.current) return;
      runTimeout(() => { setYou456Beam(null); setYou456Call(false); }, 650);
      await lockPieceRef.current(currentRef.current, undefined, strike);
    } catch (error) {
      if (error !== YOU456_CANCELLED) throw error;
    } finally {
      if (run === storyRunRef.current) you456Busy.current = null;
    }
  };
  const fireYou456Ref = useRef(fireYou456); fireYou456Ref.current = fireYou456;
  // 1.5秒の遊べる時間ごとに450msかけて上辺・側辺をたどる。描画と命中判定は同じ位置。
  const anchiAlive = !!anchiView && !anchiView.dying;
  useEffect(() => {
    if (!anchiAlive || sanzMode) return undefined;
    let played = 0;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = Math.min(100, Math.max(0, now - last));
      last = now;
      if (statusNow.current !== 'playing' || document.hidden) return;
      const a = anchiRef.current;
      const rect = a && !a.dying ? anchiRect(boardNow.current) : null;
      if (!a || !rect) return;
      played += elapsed;
      if (!anchiEyeMotion.current && played >= ANCHI_EYE_MOVE_MS) {
        played = 0;
        anchiEyeMotion.current = { from: a.eye, to: pickAnchiEye(rect.w, rect.h, anchiEyeCell(rect.w, rect.h, a.eye)), elapsed: 0 };
      }
      const motion = anchiEyeMotion.current;
      if (!motion) return;
      motion.elapsed += elapsed;
      updateAnchi({ ...a, eye: sampleAnchiEyePath(rect.w, rect.h, motion.from, motion.to, motion.elapsed / ANCHI_EYE_TRAVEL_MS) });
      if (motion.elapsed >= ANCHI_EYE_TRAVEL_MS) anchiEyeMotion.current = null;
    }, 33);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchiAlive]);
  const paintsActive = anchiPaints.length > 0;
  useEffect(() => {
    if (!paintsActive) return undefined;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.min(100, Math.max(0, now - last));
      last = now;
      if (statusNow.current === 'paused' || document.hidden) return;
      if (!['playing', 'clearing'].includes(statusNow.current)) { updatePaints([]); return; }
      let landed = false;
      const next = anchiPaintsRef.current.flatMap((paint): AnchiPaint[] => {
        const age = paint.age + delta;
        if (age >= paint.life + 420) return [];
        const phase = age < 320 ? 'flying' : age < 580 ? 'spreading' : age < paint.life ? 'resting' : 'fading';
        if (paint.phase === 'flying' && phase !== 'flying') landed = true;
        return [{ ...paint, age, phase }];
      });
      updatePaints(next);
      if (landed && soundModeRef.current !== 'none') playPaintSplatSound();
    }, 33);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paintsActive]);
  // アンチクショウメの描く位置（落下で動くので盤面から求める。消えていく最中は最後の位置）
  const anchiLast = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const anchiDrawn = useMemo(() => {
    const rect = anchiRect(board);
    if (rect) anchiLast.current = rect;
    return rect ?? (anchiView?.dying ? anchiLast.current : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, anchiView]);
  const thunderSetRef = useRef(thunderSet);
  thunderSetRef.current = thunderSet;
  const [thunderCall, setThunderCall] = useState<string | null>(null);
  const [thunderBolt, setThunderBolt] = useState<number[] | null>(null);
  const thunderBusy = useRef(false);
  const thunderUsedRef = useRef<Position[] | null>(null);
  const fireThunder = async () => {
    const set = thunderSetRef.current;
    if (!set || thunderBusy.current || isResolving.current || statusNow.current !== 'playing') return;
    thunderBusy.current = true;
    const run = storyRunRef.current;
    const cols = thunderColumns(COLS, feverActiveRef.current);
    setStatus('clearing');
    // なぞった1・2・3のサイは、イナヅマを落とすと同時に消す（同じ並びで何度も撃てないように）
    thunderUsedRef.current = set;
    // 「イチ」「ニノ」→ 300msのタメ →「サンダー！」を一気に（2026-10-14 イチニノサンダー）
    const calls = langRef.current === 'ja' ? ['イチ', 'ニノ'] : ['ICHI', 'NINO'];
    for (let i = 0; i < calls.length; i += 1) {
      setThunderCall(calls[i]);
      if (soundModeRef.current !== 'none') playThunderCountSound(i);
      await delay(THUNDER_CALL_MS + (i === calls.length - 1 ? THUNDER_TAME_MS : 0));
      if (run !== storyRunRef.current) { setThunderCall(null); thunderBusy.current = false; return; }
    }
    setThunderCall(langRef.current === 'ja' ? 'サンダー！' : 'THUNDER!');
    setThunderBolt(cols);
    // アンチクショウメの目にイナヅマが当たったら、落ちたその瞬間に倒れる
    const struckCells = cols.flatMap((x) => Array.from({ length: ROWS }, (_, y) => ({ x, y })));
    const eyeHit = anchiEyeIn(struckCells, boardNow.current);
    if (!eyeHit) flashAnchi(struckCells.filter((point) => boardNow.current[point.y]?.[point.x]?.value === ANCHI), boardNow.current, 'thunder');
    let anchiDefeat: Promise<unknown> | null = null;
    if (anchiRef.current && !anchiRef.current.dying && eyeHit) {
      anchiDefeat = defeatAnchi(boardNow.current, 'thunder').then(() => {
        if (run === storyRunRef.current && storyRef.current !== null) setScore((value) => value + ANCHI_BONUS);
      });
    }
    if (soundModeRef.current !== 'none') playThunderStrikeSound();
    haptics.bomb();
    await delay(THUNDER_DAR_HOLD_MS);
    setThunderCall(null);
    if (run !== storyRunRef.current) { setThunderBolt(null); thunderBusy.current = false; return; }
    runTimeout(() => setThunderBolt(null), 260);
    // アンチクショウメが点滅して消えきってから、盤面を消していく（消えた盤面で続ける）
    if (anchiDefeat) {
      await anchiDefeat;
      await delay(30);
      if (run !== storyRunRef.current) { thunderBusy.current = false; return; }
    }
    await lockPieceRef.current(currentRef.current, cols);
    thunderBusy.current = false;
  };
  const fireThunderRef = useRef(fireThunder);
  fireThunderRef.current = fireThunder;
  const levelScoreRef = useRef(0);
  levelScoreRef.current = levelScore;

  // ゲージの点灯数。20%ごとに1文字、発動中は全点灯
  const feverLit = feverActive ? FEVER_LETTERS.length : Math.floor(fever / 20);

  // Campaign combat counts every scheduled enemy and every generated small enemy.
  // Script IDs still control entrances/AI; they no longer select a different win rule.
  const campaignEnemyProgress = (mission: NonNullable<ReturnType<typeof wallMission>>, currentBoard: Board): [number, number] => {
    const small = countEnemies(currentBoard);
    const liveGroups = (value: number) => new Set(currentBoard.flat().filter(cell => cell?.value === value).map(cell => cell!.group)).size;
    let total = mission.enemies.length + (mission.reinforceKoitsume ?? 0);
    let pendingSmall = wallReinforcePending.current;
    let hidoimeLeft = liveGroups(HIDOIME), berabouLeft = liveGroups(BERABOU), detarameLeft = liveGroups(DETARAME);
    const anchiLeft = (mission.anchikushoume || mission.sanzapparaname) ? Math.max(liveGroups(ANCHI), 1 - anchiDefeated.current) : 0;
    if (mission.anchikushoume || mission.sanzapparaname) total += 1;
    if (mission.detarameTotal) {
      total += mission.detarameTotal;
      detarameLeft = Math.max(detarameLeft, mission.detarameTotal - detarameDefeated.current);
    }
    if (mission.enemyWaveSize) pendingSmall += Math.max(0, mission.enemies.length - wallEnemySpawned.current);
    switch (mission.sourceStage) {
      case 8: total = STORY_STAGES[8].enemies.length; break;
      case 10: case 12:
        total = 1; hidoimeLeft = Math.max(hidoimeLeft, 1 - hidoimeDefeated.current); break;
      case 14:
        total = WAVES.reduce((sum, wave) => sum + wave.count, 0);
        pendingSmall += wavePending.current + WAVES.slice(waveRef.current + 1).filter(wave => wave.kind !== 'hidoime').reduce((sum, wave) => sum + wave.count, 0);
        hidoimeLeft = Math.max(hidoimeLeft, 1 - hidoimeDefeated.current); break;
      case 16:
        total = SWARM_MAX; hidoimeLeft = Math.max(hidoimeLeft, SWARM_MAX - hidoimeDefeated.current); break;
      case 17:
        total = 1; berabouLeft = Math.max(berabouLeft, 1 - berabouDefeated.current); break;
      case 18:
        total = 1; detarameLeft = Math.max(detarameLeft, 1 - detarameDefeated.current); break;
      case 19:
        total = 7; // Four small enemies, one Hidoime, then two bosses.
        hidoimeLeft = Math.max(hidoimeLeft, 1 - hidoimeDefeated.current);
        berabouLeft = Math.max(berabouLeft, 1 - berabouDefeated.current);
        detarameLeft = Math.max(detarameLeft, 1 - detarameDefeated.current); break;
    }
    total += campaignGeneratedEnemies.current;
    const remaining = small.koitsume + small.dame + pendingSmall + hidoimeLeft + berabouLeft + detarameLeft + anchiLeft;
    total = Math.max(total, remaining);
    return [Math.max(0, total - remaining), total];
  };

  // ストーリーのミッション表示（いま / 目標）
  const [missionNow, missionGoal] = (() => {
    if (story === null) return [0, 0];
    const goal = STORY_STAGES[story].goal;
    if (activeMission && activeMission.kind !== 'lesson') {
      if (activeMission.scoreTarget) return [Math.min(score, activeMission.scoreTarget), activeMission.scoreTarget];
      return campaignEnemyProgress(activeMission, board);
    }
    if (goal.type === 'wall') {
      const left = countEnemies(board);
      return wallObjectiveProgress(goal.mission, wallCountsView, score, storyCombos, left.koitsume + left.dame + wallReinforcePending.current);
    }
    if (goal.type === 'score') return [Math.min(score, goal.target), goal.target];
    if (goal.type === 'combo') return [Math.min(storyCombos, goal.target), goal.target];
    if (goal.type === 'tutorial') return [Math.min(tutorialView.success, goal.target), goal.target];
    // お手本とやってみての間は 0。数えるのはミッションに入ってから
    if (goal.type === 'bomb')
      return [bombView.phase === 'mission' ? Math.min(bombView.success, goal.target) : 0, goal.target];
    if (goal.type === 'hidoime') return [Math.min(hidoimeDefeatedView, goal.target), goal.target];
    if (goal.type === 'rainbow') return [status === 'cleared' ? 1 : 0, goal.target];
    // つぶした目の数
    if (goal.type === 'detarame') return [detarameDefeatedView >= 1 ? 1 : 0, goal.target];
    if (goal.type === 'allstars') return [allstarView, goal.target];
    if (goal.type === 'berabou')
      return [berabouDefeatedView >= 1 ? goal.target : berabouView ? BERABOU_HP - berabouView.hp : 0, goal.target];
    if (goal.type === 'waves') {
      // これまでに出した数から、盤面に残っている数を引く
      const shown = WAVES.slice(0, waveView + 1).reduce((sum, wave) => sum + wave.count, 0);
      const left = countEnemies(board);
      const hidoimeAlive = waveView === WAVES.length - 1 && hidoimeDefeatedView < 1 ? 1 : 0;
      return [Math.max(0, shown - left.koitsume - left.dame - hidoimeAlive), goal.target];
    }
    if (goal.type === 'fever') {
      // コイツメ・ダーメ（盤面に残っている数）とヒドイメ（倒したか）を合わせて数える
      const left = countEnemies(board);
      const remaining = left.koitsume + left.dame + (hidoimeDefeatedView >= 1 ? 0 : 1);
      return [Math.max(0, goal.target - remaining), goal.target];
    }
    if (goal.type === 'dame')
      return [dameView.phase === 'mission' ? Math.min(dameView.success, goal.target) : 0, goal.target];
    if (goal.type === 'koitsume')
      return [koiView.phase === 'mission' ? Math.min(koiView.success, goal.target) : 0, goal.target];
    const total = STORY_STAGES[story].enemies.length;
    const left = countEnemies(board);
    return [Math.max(0, total - left.koitsume - left.dame), total];
  })();

  const displayedGoal = story === null ? null : STORY_STAGES[story].goal;
  const objectiveText = sanzMode ? 'サンザッパラナメの目を撃ち抜け！' : displayedGoal ? enemyPractice && displayedGoal.type === 'defeat' ? `${enemyPractice.name}を倒す` : storyObjectiveText(displayedGoal, activeMission) : '';
  const missionDisplayNow = !activeMission && displayedGoal?.type === 'waves' ? status === 'cleared' ? 3 : waveView : missionNow;
  const missionDisplayGoal = !activeMission && displayedGoal?.type === 'waves' ? 3 : missionGoal;
  const missionProgressLabel = `${objectiveText} ${missionDisplayNow}/${missionDisplayGoal}`;
  // 敵の数のミッションだけ、分母に合わせてニコニコメの出やすさを上げる（スコアのミッションは対象外）
  storyNicoBoost = activeMission && activeMission.kind !== 'lesson' && !activeMission.scoreTarget ? nicoBoostFor(missionDisplayGoal) : 1;
  // FEVER習得後のストーリーは、SCORE の文字の場所に FEVER の文字を同じ大きさで置き、MISSION は2段
  const scoreFeverSwap = story !== null && feverOpenIn(story, mapPowers());
  // 桁が多いと入りきらない：1万を超えたら文字を小さく、10万を超えたら分数のように上下2段にする
  const missionMagnitude = Math.max(missionDisplayNow, missionDisplayGoal);
  const missionSize = missionMagnitude >= 100000 ? 'is-fraction' : missionMagnitude >= 10000 ? 'is-long' : '';
  const missionBox = (
    <div className={`mission-wrap ${scoreFeverSwap ? 'is-stacked' : ''} ${missionSize}`} role="img" aria-label={missionProgressLabel} title={missionProgressLabel}>
      <span>MISSION</span>
      {missionSize === 'is-fraction' ? (
        <b className="mission-fraction">
          <span>{missionDisplayNow}</span>
          <i aria-hidden />
          <span>{missionDisplayGoal}</span>
        </b>
      ) : (
        <b>
          {missionDisplayNow}/{missionDisplayGoal}
        </b>
      )}
    </div>
  );
  const feverGauge = (
    <div className={`fever-wrap ${feverActive ? 'is-active' : ''}`} aria-label={`FEVER ${fever}%`} role="img">
      {FEVER_LETTERS.map((letter, index) => (
        <span
          aria-hidden
          className={`fever-letter ${index < feverLit ? 'is-lit' : ''}`}
          key={index}
          style={{ '--i': index } as React.CSSProperties}
        >
          {letter}
        </span>
      ))}
    </div>
  );
  const lessonPhase = displayedGoal?.type === 'bomb' ? bombView.phase
    : displayedGoal?.type === 'koitsume' ? koiView.phase : displayedGoal?.type === 'dame' ? dameView.phase : null;
  // 操作できる練習（play）も特訓。通常面の敵の登場演出は特訓に含めない。
  const bannerTraining = lessonPhase !== null ? lessonPhase !== 'mission'
    : displayedGoal?.type === 'tutorial' ? TUTORIAL_STEPS[tutorialView.step]?.kind !== 'mission'
      : displayedGoal?.type === 'combo' ? comboDemo || demoLock.current
        : (displayedGoal?.type === 'rainbow' || activeMission?.kind === 'lesson') && demoLock.current;
  // 登場・説明中はタイトルを保ち、通常プレイ開始から交互表示を始める。
  const bannerRunning = !bannerTraining && !demoLock.current && (status === 'playing' || status === 'clearing');

  // ミッションの数が進んだら、残り1つ・半分のところでサイカがひとこと。
  // チュートリアル・スコア・虹ボム・ベラボウメ（目の数は専用のセリフがある）は対象外
  const missionSeen = useRef({ story: -1, now: 0 });
  useEffect(() => {
    if (story === null) return;
    const seen = missionSeen.current;
    if (seen.story !== story) {
      missionSeen.current = { story, now: missionNow };
      return;
    }
    // お手本の最中は、数が動いてもひとことは言わない（説明のセリフを上書きしないため）
    if (missionNow <= seen.now || demoLock.current) {
      seen.now = missionNow;
      return;
    }
    const before = seen.now;
    seen.now = missionNow;
    const goal = STORY_STAGES[story].goal.type;
    // Campaign progress is shown directly; avoid stale script-specific progress lines.
    if (activeMission?.kind !== 'lesson' && activeMission) return;
    if (goal === 'wall' || goal === 'waves' || goal === 'allstars') return;
    if (goal === 'tutorial' || goal === 'score' || goal === 'rainbow' || goal === 'berabou') return;
    const left = missionGoal - missionNow;
    const half = Math.ceil(missionGoal / 2);
    const enemyGoal = ['koitsume', 'dame', 'defeat', 'hidoime', 'fever', 'waves'].includes(goal);
    const line =
      left === 1
        ? enemyGoal
          ? MISSION_LAST_ENEMY
          : MISSION_LAST_TRY
        : missionGoal >= 4 && left > 1 && before < half && missionNow >= half
          ? MISSION_HALF
          : null;
    if (!line) return;
    const stageNo = story;
    const timer = runTimeout(() => {
      if (storyRef.current !== stageNo) return;
      setSaika({ text: line[langRef.current], mood: 'praise' });
    }, MISSION_LINE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [missionGoal, missionNow, story]);

  useEffect(() => {
    if (status !== 'playing' || soundMode === 'none') {
      return;
    }
    noteTouchdown(board, current);
  }, [board, current, noteTouchdown, soundMode, status]);

  // いまのブロックが最初に着地した時刻。段差から落ちてまた落下し始めたら消す
  const landedRef = useRef<{ id: number; at: number } | null>(null);
  useEffect(() => {
    if (status !== 'playing') {
      return;
    }
    const resting = !canPlace(board, { ...current, y: current.y + 1 });
    if (!resting) {
      if (landedRef.current?.id === current.id) {
        landedRef.current = null;
      }
      return;
    }
    if (landedRef.current?.id !== current.id) {
      landedRef.current = { id: current.id, at: performance.now() };
    }
  }, [board, current, status]);

  const lockCurrent = useCallback(() => {
    void lockPiece(current);
  }, [current, lockPiece]);

  // 猶予が切れた瞬間に固定するためのタイマー。落下の刻みを待つと、
  // 速いレベルでは猶予が 0.4秒ちょうどではなく刻みのぶんだけ延びてしまう。
  // タイマーが鳴ったときの最新の盤面で確かめるので、関数は毎回差し替える。
  const graceTimer = useRef<number | null>(null);
  const graceLock = useRef<() => void>(() => undefined);
  graceLock.current = () => {
    const landed = landedRef.current;
    if (
      status === 'playing' &&
      !isResolving.current &&
      landed &&
      landed.id === current.id &&
      !canPlace(board, { ...current, y: current.y + 1 })
    ) {
      lockCurrent();
    }
  };
  useEffect(
    () => () => {
      if (graceTimer.current !== null) {
        window.clearTimeout(graceTimer.current);
        graceTimer.current = null;
      }
    },
    [current.id],
  );

  const move = useCallback(
    (dx: number, dy: number, fromGravity = false) => {
      if (status !== 'playing' || isResolving.current) {
        return false;
      }
      if (!fromGravity && demoLock.current && !scripted.current) {
        return false;
      }

      const shifted = { ...current, x: current.x + dx, y: current.y + dy };
      if (canPlace(board, shifted)) {
        setCurrent(shifted);
        // 動かした結果これ以上落ちられなくなったら、その場で鳴らす。
        // 描画のあとの useEffect に任せていたころは、次の入力や落下まで
        // 判定が持ち越されて 60〜100ms 遅れることがあった。
        // ここなら位置が決まったのと同じ処理の中なので、ずれない。
        noteTouchdown(board, shifted);
        return true;
      }

      if (dy > 0) {
        // 自然落下で固定するときは、着地してから LOCK_GRACE_MS 経つまで待つ。
        // 落下の間隔がそれより長いレベルでは、これまでどおり次の刻みで固定される
        if (fromGravity) {
          const landed = landedRef.current;
          const held = landed && landed.id === current.id ? performance.now() - landed.at : 0;
          if (held < LOCK_GRACE_MS) {
            // 猶予が切れる瞬間に固定を予約する（刻みを待たない）
            if (graceTimer.current === null) {
              graceTimer.current = runTimeout(() => {
                graceTimer.current = null;
                graceLock.current();
              }, LOCK_GRACE_MS - held);
            }
            return false;
          }
        }
        lockCurrent();
      }
      return false;
    },
    [board, current, lockCurrent, noteTouchdown, status],
  );

  // ←→を素早く2回入力したときの、その方向の端まで移動
  const moveToEdge = useCallback(
    (dir: number) => {
      if (status !== 'playing' || isResolving.current) {
        return;
      }

      let moved = current;
      while (canPlace(board, { ...moved, x: moved.x + dir })) {
        moved = { ...moved, x: moved.x + dir };
      }
      if (moved !== current) {
        setCurrent(moved);
        // 横へ滑らせた先が着地点なら、そこでも鳴らす
        noteTouchdown(board, moved);
      }
    },
    [board, current, noteTouchdown, status],
  );

  // 右回り90度。壁や既存のメに当たる場合は少しずらして成立させる
  const rotate = useCallback((dir: 'cw' | 'ccw' = 'cw') => {
    if (status !== 'playing' || isResolving.current) {
      return;
    }
    if (demoLock.current && !scripted.current) {
      return;
    }

    const rotated: Piece = { ...current, matrix: (dir === 'ccw' ? rotateMatrixCCW : rotateMatrixCW)(current.matrix) };
    const kicks: Position[] = [
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: -2, y: 0 },
      { x: 2, y: 0 },
    ];
    const candidate = kicks
      .map((kick) => ({ ...rotated, x: rotated.x + kick.x, y: rotated.y + kick.y }))
      .find((piece) => canPlace(board, piece));

    if (candidate) {
      if (soundModeRef.current !== 'none' && sfxOnTime(triggerLate.current)) {
        playRotateSound();
      }
      setCurrent(candidate);
      // 回した結果その場が着地点になることがある。移動と同じくここで判定する。
      // useEffect に任せると描画を1回またぐぶん遅れて聞こえる。
      noteTouchdown(board, candidate);
    }
  }, [board, current, noteTouchdown, status]);

  // 一気に落下したときの着地の手応え。メの並びだけをわずかに沈ませて戻す。
  // クラスの付け外しではアニメーションが再生し直されないので、
  // 呼ぶたびに確実に頭から流れる Web Animations API を使う。
  const shellRef = useRef<HTMLElement | null>(null);

  const playImpact = useCallback(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    // 動かすのはメの並びだけ。盤面の枠もスコアもHUDも動かさない。
    // 拡大縮小はせず、縦方向の移動だけで沈み込みを表す。
    // イージングは各区間に持たせ、全体は linear にする。
    // 効果全体にかけると開始直後に進行が進んでしまい、沈み込みが
    // 一瞬で終わって見えなくなる。
    const grid = shellRef.current?.querySelector('.board-grid');
    grid?.animate(
      [
        { transform: 'translateY(0)', easing: 'ease-out' },
        { transform: `translateY(${IMPACT_DROP_PX}px)`, offset: 0.3, easing: 'ease-in-out' },
        { transform: `translateY(${-IMPACT_RISE_PX}px)`, offset: 0.65, easing: 'ease-out' },
        { transform: 'translateY(0)' },
      ],
      { duration: IMPACT_MS, easing: 'linear' },
    );
  }, []);

  const hardDrop = useCallback(() => {
    if (status !== 'playing' || isResolving.current) {
      return;
    }
    if (demoLock.current && !scripted.current) {
      return;
    }

    let dropped = current;
    while (canPlace(board, { ...dropped, y: dropped.y + 1 })) {
      dropped = { ...dropped, y: dropped.y + 1 };
    }
    if (soundModeRef.current !== 'none' && sfxOnTime(triggerLate.current)) {
      playHardDropSound();
    }
    playImpact();
    void lockPiece(dropped);
  }, [board, current, lockPiece, playImpact, status]);

  // 一時停止からの「再開」。盤面を保持したまま続きから動かす。
  const resume = useCallback(() => {
    getAudioContext();
    setGamePaused(false);
    setStatus((value) => (value === 'paused' ? pauseFrom.current : value));
    if (soundModeRef.current === 'all') {
      playBgm();
    }
  }, []);

  // 一時停止の切り替え。遊んでいる最中だけでなく、ステージ開始の語りや消去の最中（clearing）でも止められる。
  // 止める前の状態を覚えておき、再開ではそこへ戻す
  const pauseFrom = useRef<GameStatus>('playing');
  const statusNow = useRef(status);
  statusNow.current = status;
  const togglePause = () => {
    const status = statusNow.current;
    if (status === 'paused') {
      setGamePaused(false);
      setStatus(pauseFrom.current);
      return;
    }
    if (status === 'playing' || status === 'clearing') {
      pauseFrom.current = status;
      setGamePaused(true);
      setStatus('paused');
    }
  };

  // 盤面とスコアを初期値へ戻す。遊び直すのか、タイトルへ帰るのかだけが違う。
  const resetGame = useCallback((next: GameStatus) => {
    // 止めていた語りや段取りの続きは捨てる（遊び直しで古い続きが動き出さないように）
    dropPauseWaiters();
    setStageIntro(null);
    setGameoverHint(false);
    // 10メンのヒドイメは、ほかのメンや遊び直しへ持ち越さない
    setHidoimeView(new Map());
    hidoimeHp.current = new Map();
    hidoimeDefeated.current = 0;
    setHidoimeDefeatedView(0);
    setBerabouView(null);
    setBerabouHit(false);
    berabouRageRun.current += 1;
    setBerabouRaging(false);
    setFlingCells(new Map());
    setSfx(null);
    updateDetarame(null);
    updateAnchi(null);
    setSanzElapsed(-1);setSanzShots([]);sanzPeriod.current=3;
    stopDetarameDamageSounds();
    stopAnchiThunderSounds();
    setAnchiHit(false);
    setAnchiHitTone('white');
    anchiHitGeneration.current += 1;
    setAnchiFlash(null);
    setThunderCall(null);
    setThunderBolt(null);
    thunderBusy.current = false;
    setYou456Beam(null);
    setYou456Call(false);
    you456Busy.current = null;
    anchiEyeMotion.current = null;
    updatePaints([]);
    anchiDefeated.current = 0;
    setDetarameHit(new Map());
    setDetarameFiring(new Map());
    detarameSpawned.current = 0;
    setDetarameBeams([]);
    setRewriteCells(new Set());
    setAbsorbCell(null);
    setAbsorbCells(new Map());
    detarameTurn.current = 0;
    detarameDefeated.current = 0;
    setDetarameDefeatedView(0);
    berabouHp.current = BERABOU_HP;
    berabouDefeated.current = 0;
    berabouIdle.current = 0;
    setBerabouGuard(false);
    setBerabouDefeatedView(0);
    const first = createPiece(0);
    const second = createPiece(1);
    pieceId.current = 1;
    setBoard(emptyBoard());
    setCurrent(first);
    setNextPiece(second);
    setScore(0);
    setFinalScore(0);
    setLevel(1);
    setLevelScore(0);
    setFever(20);
    bannerToken.current += 1;
    setBombBanner(null);
    setNicoCharge(null);
    setSaika({ text: pickFrom(SAIKA_HELLO_LINES[langRef.current]), mood: 'hello' });
    enjoArmed.current=null;setEnjoBreaking(undefined);setEnjoFlight(null);setEnjoBlast(null);setHyoketsuBlasts([]);setClearingCells(new Set());
    setBurstCells(new Map());
    setMonoDice(false);
    setRainbowSparksOn(false);
    setMonoCells(new Map());
    setGlowCells(new Map());
    setBlastCells(new Set());
    setGrayCells(new Set());
    // 虹ボムはプレイをまたいで持ち越すので、所持数そのものは触らない。
    // 1プレイ1回の使用済み印と、出しかけの表示だけを戻す。
    setRainbowAward(0);
    setRainbowAsk(false);
    rainbowAnswer.current = null;
    pendingAward.current = 0;
    rainbowUsedThisGame.current = false;
    setChargeCells(new Map());
    setFreezing(false);
    setFeverActive(false);
    setFeverIgniting(false);
    setTraces([]);
    setArmingCells(new Map());
    isResolving.current = false;
    setStatus(next);
  }, []);

  const restart = useCallback(() => {
    // ブラウザの自動再生制限を、ユーザー操作のこのタイミングで解除しておく
    getAudioContext();
    resetGame('playing');
    if (soundModeRef.current === 'all') {
      stopBgm();
      playBgm();
    }
  }, [resetGame]);

  // エンドレスを始める（タイトルのスタート）
  const startEndless = useCallback(() => {
    storyRunRef.current += 1;
    mapRun.current = false; mapStageRef.current = null; setMapStage(null);
    setStory(null);
    storyRef.current = null;
    demoLock.current = false;
    spawnHold.current = false;
    storyDiceBias = false;
    storyBoostValues = [];
    storyNicoRate = 0;
    storyLinesOn = false;
    restart();
  }, [restart]);

  // ストーリーのコロを始める。盤面は敵の並んだ開始盤面に差し替える
  const startStage = useCallback(
    (requestedStage: number) => {
      if (enemyPractice && requestedStage !== enemyPractice.stage) return;
      // Unimplemented/future IDs can never be launched, including debug/direct calls.
      if (!Number.isInteger(requestedStage) || requestedStage < 0 || !STORY_STAGES[requestedStage]) return;
      const mission = wallMission(requestedStage);
      if (mission && !enemyPractice && !isStoryReview() && !wallUnlocked(requestedStage, wallProgressRef.current.cleared)) return;
      mapRun.current = !!mission || (requestedStage === 0 && storyLayoutRef.current === 'map');
      mapStageRef.current = mapRun.current ? requestedStage : null;
      setMapStage(mapStageRef.current);
      if (mapRun.current) setLastMapStage(requestedStage);
      storyRunRef.current += 1;
      const stageNo = requestedStage === WALL_LESSON ? WALL_LESSON : mission?.sourceStage ?? requestedStage;
      wallCounts.current = emptyWallCounts();
      wallEnemySpawned.current = 0;
      wavePending.current = 0;
      campaignGeneratedEnemies.current = 0;
      wallReinforcePending.current = mission?.reinforceKoitsume ?? 0;
      setWallCountsView({ ...wallCounts.current });
      setShowStages(false);
      setStory(stageNo);
      storyRef.current = stageNo;
      demoBlinkCount.current = 0;
      // 出目の確率（2026-10-08 ユーザー指示で洗い直し）。
      // 技を覚える「習得ステージ」だけ、その技をつくる目を出やすくする（2と5も少し出にくくする）。
      // それ以外のメンは、どのひっさつメも同じように狙えるよう 1〜6 を同じ確率で出す。
      // resetGame が最初の2つを作る前に立てておく
      const lessonStage = mission ? !!mission.learns : !!BOMB_LESSONS[stageNo];
      storyBoostValues = !lessonStage
        ? []
        : mission?.boostValues
          ? mission.boostValues
          : BOMB_LESSONS[stageNo]
            ? [(BOMB_LESSONS[stageNo] as BombLesson).value]
            : [];
      storyDiceBias = storyBoostValues.some((value) => value >= 1 && value <= 6);
      // 11メン（ミッション）と12メンはニコニコメを出やすくする
      storyNicoRate =
        mission?.nicoTarget || stageNo === NICO_HIDOIME_STAGE
          ? STORY_NICO_BOOST_RATE
          : stageNo === NICO_STAGE
            ? STORY_NICO_LESSON_RATE
            : 0;
      storyLinesOn = true;
      storyIdlePool = storyIdleLinesFor(mission?.stage ?? stageNo);
      storyCombosRef.current = 0;
      setStoryCombos(0);
      setComboFx(null);
      awakenShown.current = false;
      setComboDemo(false);
      spawnHold.current = false;
      restart();
      // 先生が話すメンは、前の画面のサイカのセリフを先生の顔で出さないよう、いったん空にする
      if (TUTOR_PAIRS[requestedStage] || TUTOR_PAIRS[stageNo] || BOMB_LESSONS[stageNo] || stageNo === RAINBOW_STAGE) setSaika({ text: '', mood: 'hello', who: 'saika' });
      setClearFireworks(false);
      setTapHint(null);
      if (stageNo === 0) {
        tutorial.current = { step: 0, success: 0, miss: 0, target: 1 };
        setTutorialView({ step: 0, success: 0 });
        demoLock.current = true;
        void runTutorialWelcome();
        return;
      }
      if (BOMB_LESSONS[stageNo]) {
        bombLesson.current = { phase: 'demo', success: 0, miss: 0 };
        setBombView({ phase: 'demo', success: 0 });
        demoLock.current = true;
        startBombRound(null);
        return;
      }
      if (stageNo === RAINBOW_STAGE) {
        demoLock.current = true;
        setBoard(buildRainbowStartBoard());
        setStatus('clearing');
        showStageIntro(stageNo);
        void (async () => {
    const activeScriptRun = storyRunRef.current;
          await delay(1900);
          for (const line of RAINBOW_LESSON_LINES) {
            if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
            setSaika({ text: line[langRef.current], mood: line === RAINBOW_LESSON_LINES[0] ? 'worry' : 'hello', ...(line === RAINBOW_LESSON_LINES[0] ? { who: 'saika' as const } : {}) });
            await delay(1300 + line.ja.length * 45);
          }
          if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
          demoLock.current = false;
          lastFallAt.current = performance.now();
          setStatus('playing');
        })();
        return;
      }
      if (stageNo === COMBO_STAGE) {
        demoLock.current = true;
        setComboDemo(true);
        const start = emptyBoard();
        start[ROWS - 1][3] = { id: 'combo-1', value: 1, group: -1100 };
        start[ROWS - 1][4] = { id: 'combo-3', value: 3, group: -1101 };
        setBoard(start);
        pieceId.current += 1;
        // お手本もふつうの3つ縦のブロックで見せる。上の2つは [2] にして、どこにも7を作らない
        setCurrent(makeColumnPiece(pieceId.current, [2, 2, 6], 4));
        setNextPiece(makeColumnPiece(pieceId.current + 1, [2, 2, 4], 5));
        setStatus('clearing');
        showStageIntro(stageNo);
        void (async () => {
    const activeScriptRun = storyRunRef.current;
          const alive = () => (storyRunRef.current === activeScriptRun && storyRef.current === stageNo);
          const waitPlaying = async () => {
            for (let i = 0; i < 200 && alive(); i += 1) {
              if (statusNow.current === 'playing') return;
              await delay(100);
            }
          };
          const drop = () => {
            scripted.current = true;
            hardDropRef.current();
            scripted.current = false;
          };
          await delay(1900);
          if (!alive()) return;
          setSaika({ text: COMBO_DEMO_LINES.intro[langRef.current], mood: 'hello' });
          await delay(1600);
          if (!alive()) return;
          setSaika({ text: COMBO_DEMO_LINES.miss[langRef.current], mood: 'hello' });
          lastFallAt.current = performance.now();
          setStatus('playing');
          await delay(2400);
          if (!alive()) return;
          // [6] を [3] の上へ（わざと外す）
          setTapHint('down');
          await delay(700);
          drop();
          await delay(300);
          setTapHint(null);
          await delay(600);
          await waitPlaying();
          if (!alive()) return;
          setSaika({ text: COMBO_DEMO_LINES.setup[langRef.current], mood: 'hello' });
          await delay(2200);
          if (!alive()) return;
          // [4] を [3] のとなりへ。3+4 で消えて、落ちた [6] が [1] と7になる。
          // このあとは次のブロックを出さない（お手本が終わってから出す）
          spawnHold.current = true;
          spawnHeld.current = false;
          setTapHint('down');
          await delay(700);
          drop();
          await delay(300);
          setTapHint(null);
          await delay(600);
          for (let i = 0; i < 200 && alive() && !spawnHeld.current; i += 1) {
            await delay(100);
          }
          if (!alive()) return;
          setSaika({ text: COMBO_DEMO_LINES.combo[langRef.current], mood: 'praise' });
          await delay(2600);
          if (!alive()) return;
          // お手本で出したチェインは数えない
          storyCombosRef.current = 0;
          setStoryCombos(0);
          setComboDemo(false);
          demoLock.current = false;
          setBoard(emptyBoard());
          // ここで初めて次のブロックを出す
          spawnHold.current = false;
          spawnHeld.current = false;
          pieceId.current += 1;
          setCurrent(createPiece(pieceId.current));
          setNextPiece(createPiece(pieceId.current + 1));
          setStatus('playing');
          setSaika({ text: COMBO_DEMO_LINES.go[langRef.current], mood: 'praise' });
          lastFallAt.current = performance.now();
        })();
        return;
      }
      if (stageNo === SWARM_STAGE) {
        demoLock.current = true;
        swarmCleared.current = 0;
        swarmSpawned.current = 0;
        swarmPending.current = 0;
        hidoimeHp.current = new Map();
        hidoimeDefeated.current = 0;
        setHidoimeDefeatedView(0);
        setHidoimeView(new Map());
        // ある程度積み上がった盤面（3〜5段）から始める
        setBoard(mission?.openingRows ? buildMessyBoard(() => randomHeights(...mission.openingRows!), () => undefined) : buildHidoimeStartBoard());
        setStatus('clearing');
        showStageIntro(stageNo);
        void (async () => {
    const activeScriptRun = storyRunRef.current;
          await delay(1900);
          for (const line of SWARM_LINES.intro) {
            if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
            setSaika({ text: line[langRef.current], mood: 'worry' });
            await delay(1200 + line.ja.length * 45);
          }
          if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
          demoLock.current = false;
          lastFallAt.current = performance.now();
          setStatus('playing');
        })();
        return;
      }
      if (stageNo === WAVES_STAGE) {
        demoLock.current = true;
        waveRef.current = 0;
        setWaveView(0);
        hidoimeHp.current = new Map();
        hidoimeDefeated.current = 0;
        setHidoimeDefeatedView(0);
        const base = buildMessyBoard(() => randomHeights(...(mission?.openingRows ?? [2, 3])), () => undefined);
        const { board: start, placed } = placeEnemiesOnTops(base, KOITSUME, WAVES[0].count);
        if (mapRun.current) wavePending.current = WAVES[0].count - placed.length;
        setBoard(start);
        setStatus('clearing');
        showStageIntro(stageNo);
        void (async () => {
    const activeScriptRun = storyRunRef.current;
          await delay(1900);
          for (const line of [...WAVES_INTRO, WAVES[0].line]) {
            if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
            setSaika({ text: line[langRef.current], mood: 'hello' });
            await delay(1200 + line.ja.length * 45);
          }
          if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
          demoLock.current = false;
          lastFallAt.current = performance.now();
          setStatus('playing');
        })();
        return;
      }
      if (stageNo === ALLSTAR_STAGE) {
        demoLock.current = true;
        allstarPhase.current = 0;
        setAllstarView(0);
        hidoimeHp.current = new Map();
        hidoimeDefeated.current = 0;
        setHidoimeDefeatedView(0);
        berabouDefeated.current = 0;
        setBerabouDefeatedView(0);
        setBerabouView(null);
        detarameDefeated.current = 0;
        setDetarameDefeatedView(0);
        updateDetarame(null);
        const base = buildMessyBoard(() => randomHeights(...(mission?.openingRows ?? [2, 3])), () => undefined);
        const withKoi = placeEnemiesOnTops(base, KOITSUME, 2).board;
        const start = placeEnemiesOnTops(withKoi, DAME, 2).board;
        setBoard(start);
        setStatus('clearing');
        showStageIntro(stageNo);
        void (async () => {
    const activeScriptRun = storyRunRef.current;
          await delay(1900);
          for (const line of ALLSTAR_LINES.intro) {
            if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
            setSaika({ text: line[langRef.current], mood: 'hello' });
            await delay(1200 + line.ja.length * 45);
          }
          if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
          demoLock.current = false;
          lastFallAt.current = performance.now();
          setStatus('playing');
        })();
        return;
      }
      if (stageNo === DETARAME_STAGE) {
        // 操作は止めておき、登場が終わってから動かす
        demoLock.current = true;
        const x = DETARAME_COLUMNS[Math.floor(Math.random() * DETARAME_COLUMNS.length)];
        const start = buildDetarameStartBoard(x);
        setBoard(start);
        setStatus('clearing');
        showStageIntro(stageNo);
        void runDetarameEntrance(start, stageNo, x);
        return;
      }
      if (stageNo === BERABOU_STAGE) {
        // 操作は止めておき、登場が終わってから動かす
        demoLock.current = true;
        const start = mission?.openingRows ? buildMessyBoard(() => randomHeights(...mission.openingRows!), () => undefined) : buildHidoimeStartBoard(); // large enemy entry requires >=3 rows
        setBoard(start);
        setStatus('clearing');
        showStageIntro(stageNo);
        void runBerabouEntrance(start, stageNo);
        return;
      }
      if (stageNo === HIDOIME_STAGE || stageNo === NICO_HIDOIME_STAGE || stageNo === FEVER_STAGE) {
        // 操作は止めておき、登場が終わってから動かす
        demoLock.current = true;
        const start = stageNo === FEVER_STAGE ? buildFeverStartBoard() : mission?.openingRows ? buildMessyBoard(() => randomHeights(...mission.openingRows!), () => undefined) : buildHidoimeStartBoard();
        setBoard(start);
        setStatus('clearing');
        showStageIntro(stageNo);
        if (stageNo === FEVER_STAGE) {
          setFever(FEVER_START);
        }
        void runHidoimeEntrance(
          start,
          stageNo,
          stageNo === FEVER_STAGE ? [HIDOIME_LINES.appear, ...FEVER_LINES] : [HIDOIME_LINES.appear],
        );
        return;
      }
      if (stageNo === DAME_STAGE) {
        dameLesson.current = { phase: 'demo', success: 0, miss: 0, target: 1, start: 2, demoStep: 0 };
        setDameView({ phase: 'demo', success: 0 });
        demoLock.current = true;
        startDameRound(null);
        return;
      }
      if (stageNo === KOI_STAGE) {
        koiLesson.current = { phase: 'demo', success: 0, miss: 0, target: 1 };
        setKoiView({ phase: 'demo', success: 0 });
        demoLock.current = true;
        startKoiRound(null);
        return;
      }
      demoLock.current = false;
      const initialBoard = mission?.seed
        ? ({ spa1: SPA_LESSON, sla3: SLA_LESSON, squ4: SQU_LESSON, str6: STR_LESSON, nico: NICO_LESSON }[mission.seed]).practiceBoard(false)
        : mission?.boardRows
          ? buildMessyBoard(() => randomHeights(...mission.boardRows!), () => undefined)
          : buildStageBoard(STORY_STAGES[stageNo]);
      if (mission && (mission.seed || mission.boardRows)) {
        mission.enemies.forEach((enemy, index) => {
          // Place on top of assistance dice, never overwrite the seed itself.
          const occupied = initialBoard.findIndex(row => row[enemy.x] !== null);
          const y = enemy.y ?? Math.max(0, (occupied < 0 ? ROWS : occupied) - 1);
          initialBoard[y][enemy.x] = { id: `campaign-enemy-${index}`, value: enemy.kind === 'dame' ? DAME : KOITSUME, group: -1800 - index };
        });
      }
      if(enjoPractice){
        initialBoard.forEach((row,y)=>row.forEach((_,x)=>{row[x]=y>=ROWS-2?{id:'enjo-floor-'+x+'-'+y,value:2,group:-6200-y*7-x}:null;}));
        for(let part=0;part<enjoRows;part++)initialBoard[ROWS-2-enjoRows+part][3]={id:'enjo-part-'+part,value:-8,group:-6400,enjo:{part,rows:enjoRows,open:false}};
        for(let part=0;part<enjoRows;part++)initialBoard[ROWS-2-enjoRows+part][2]={id:'enjo-unlock-one-'+part,value:1,group:-6450};
        initialBoard[ROWS-3][1]={id:'enjo-koi',value:KOITSUME,group:-6401};initialBoard[ROWS-3][5]={id:'enjo-dame',value:DAME,group:-6402};initialBoard[ROWS-1][0]={id:'enjo-test-bomb',value:-7,hyoketsu:'frozen',group:-6403};if(enjoPracticeFever)setFever(100);
      }
      if (hyoketsuPractice) {
        initialBoard.forEach((row,y)=>row.forEach((_,x)=>{row[x]=y>=ROWS-2?{id:'hyoketsu-floor-'+x+'-'+y,value:2,group:-4200-y*7-x}:null;}));
        initialBoard[ROWS-3][1]={id:'hyoketsu-koi',value:KOITSUME,group:-4401};
        initialBoard[ROWS-3][5]={id:'hyoketsu-dame',value:DAME,group:-4402};
        initialBoard[ROWS-3][3]={id:'hyoketsu-ice',value:-7,hyoketsu:'frozen',group:-4403};
      }
      if (you456Practice) {
        initialBoard.forEach(row => row.fill(null));
        you456PracticeCells().forEach(([x, y, value], i) => { initialBoard[y][x] = { id: `you456-practice-${i}`, value, group: -4600-i }; });
        if (new URLSearchParams(location.search).get('fever') === '1') setFever(100);
      }
      // Practice after the lesson: four 1s form a visible starting point, not an automatic bomb.
      if (stageNo === 24 || stageNo === 25) {
        for (let x = 0; x < COLS; x++) initialBoard[ROWS - 1][x] = { id: `wall-seed-${x}`, value: x >= 1 && x <= 4 ? 1 : 3, group: -1700-x };
      }
      // 6-2：アンチクショウメを1×1で、まん中の山のてっぺんに置く
      if (mission?.anchikushoume) {
        const ax = 3;
        const top = initialBoard.findIndex((row) => row[ax] !== null);
        const ay = Math.max(0, (top < 0 ? ROWS : top) - 1);
        initialBoard[ay][ax] = { id: 'anchi-0', value: ANCHI, group: ANCHI_GROUP };
        updateAnchi({ sizeIndex: 0, eye: { x: 0, y: 0 }, turn: 0, dying: false });
      }
      if(sanzPractice || mission?.sanzapparaname){
        sanzPeriod.current=mission?.sanzTurns ?? 3;
        initialBoard.forEach((row,y)=>row.forEach((_,x)=>{row[x]=y>=ROWS-2?{id:'sanz-floor-'+x+'-'+y,value:(x+y)%6+1,group:-3400-x-y*7}:null;}));
        [5,3,1].forEach((n,row)=>{for(let i=0;i<n;i++){const x=3-(n-1)/2+i,y=ROWS-3-row;initialBoard[y][x]={id:'sanz-body-'+x+'-'+y,value:ANCHI,group:ANCHI_GROUP};}});
        [1,2,3].forEach((value,x)=>{initialBoard[ROWS-1][x]={id:'sanz-thunder-'+x,value,group:-3500-x};});
        updateAnchi({sizeIndex:0,eye:{x:2,y:2},turn:0,dying:false});
        mission?.enemies.forEach((enemy,i)=>{const top=initialBoard.findIndex(row=>row[enemy.x]!==null),y=Math.max(0,top-1);initialBoard[y][enemy.x]={id:'sanz-guard-'+i,value:enemy.kind==='dame'?DAME:KOITSUME,group:-3600-i};});
      }
      if (enemyPractice?.enemy === 'anchikushoume') {
        [1, 2, 3].forEach((value, x) => { initialBoard[ROWS - 1][x] = { id: `practice-thunder-${x}`, value, group: -2300 - x }; });
      }
      // 6-1：ゾロメ仙人のお手本。[1][2][3] が並んだ盤面で、光ったサイをなぞって見せる
      if (requestedStage === THUNDER_LESSON) {
        const demo = emptyBoard();
        const bottom = [4, 1, 2, 3, 5, 6, 5];
        bottom.forEach((value, x) => { demo[ROWS - 1][x] = { id: `thunder-demo-${x}`, value, group: -2100 - x }; });
        [[0, 4], [4, 5], [5, 6], [6, 5]].forEach(([x, value]) => { demo[ROWS - 2][x] = { id: `thunder-demo-u${x}`, value, group: -2200 - x }; });
        setBoard(demo);
        setSaika({ text: '', mood: 'hello', who: 'saika' });
        setStatus('clearing');
        demoLock.current = true;
        showStageIntro(stageNo);
        const run = storyRunRef.current;
        const alive = () => run === storyRunRef.current && storyRef.current === stageNo;
        void (async () => {
          await delay(1900);
          for (const line of THUNDER_LESSON_LINES) {
            if (!alive()) return;
            setSaika({ text: line[langRef.current], mood: 'hello' });
            await delay(1300 + line.ja.length * 45);
          }
          if (!alive()) return;
          // ブロックは止めたまま、光ったサイをワシがなぞる
          fallFrozen.current = true;
          lastFallAt.current = performance.now();
          setStatus('playing');
          await delay(1200);
          if (!alive()) { fallFrozen.current = false; return; }
          await fireThunderRef.current();
          if (!alive()) { fallFrozen.current = false; return; }
          setStatus('clearing');
          for (const line of THUNDER_DEMO_AFTER) {
            if (!alive()) { fallFrozen.current = false; return; }
            setSaika({ text: line[langRef.current], mood: 'praise' });
            await delay(1300 + line.ja.length * 45);
          }
          fallFrozen.current = false;
          if (!alive()) return;
          setBoard(initialBoard);
          pieceId.current += 1;
          setCurrent(createPiece(pieceId.current));
          setNextPiece(createPiece(pieceId.current + 1));
          demoLock.current = false;
          lastFallAt.current = performance.now();
          setStatus('playing');
        })();
        return;
      }
      setBoard(initialBoard);
      setSaika({ text: you456Practice ? '光る4→5→6をなぞろう！' : requestedStage === 20
        ? (langRef.current === 'ja' ? 'さぁ ゲームのはじまり！' : 'Let the game begin!')
        : pickFrom(storyIdlePool[langRef.current]), mood: 'hello' });
      showStageIntro(stageNo);
      if (requestedStage === 20) {
        demoLock.current = true;
        setStatus('clearing');
        const run = storyRunRef.current;
        void (async () => {
          await delay(2000);
          if (run !== storyRunRef.current || storyRef.current !== stageNo) return;
          setSaika({ text: langRef.current === 'ja' ? 'となり合うサイノメどうしを合計7にして消していこう！' : 'Make neighboring dice add up to 7 to clear them!', mood: 'hello' });
          await delay(3500);
          if (run !== storyRunRef.current || storyRef.current !== stageNo) return;
          demoLock.current = false; lastFallAt.current = performance.now(); setStatus('playing');
        })();
      }
      // マップで敵に初めて出会うメン（未クリア）は、サイカの救援にサイノメの組がかけつけて倒し方を教える
      const rescueLines = !enemyPractice && mission && TUTOR_PAIRS[requestedStage] && !wallProgressRef.current.cleared.includes(requestedStage)
        ? mission.anchikushoume ? ANCHI_HOWTO_LINES : [...(mission.enemies.some((e) => e.kind === 'koitsume') && requestedStage !== 26 ? [KOI_LINES.demo] : []), ...(mission.enemies.some((e) => e.kind === 'dame') ? [DAME_LINES.demo] : [])]
        : null;
      if (rescueLines) {
        const wave = mission?.enemyWaveSize;
        const base = wave ? initialBoard.map(row => row.map(cell => cell?.value === KOITSUME ? null : cell)) : initialBoard;
        setBoard(base);
        setSaika({ text: '', mood: 'hello', who: 'saika' });
        setStatus('clearing');
        demoLock.current = true;
        const run = storyRunRef.current;
        void (async () => {
          await delay(1900);
          if (run !== storyRunRef.current || storyRef.current !== stageNo) return;
          if (!(await tutorRescue(stageNo))) return;
          for (const line of rescueLines) {
            setSaika({ text: line[langRef.current], mood: 'hello' });
            await delay(1200 + line.ja.length * 45);
            if (run !== storyRunRef.current || storyRef.current !== stageNo) return;
          }
          const next = wave ? await dropCampaignEnemies(base, stageNo, wave) : base;
          if (run !== storyRunRef.current || storyRef.current !== stageNo) return;
          setBoard(next); demoLock.current = false; lastFallAt.current = performance.now(); setStatus('playing');
        })();
      } else if (mission?.enemyWaveSize) {
        const base = initialBoard.map(row => row.map(cell => cell?.value === KOITSUME ? null : cell));
        setBoard(base);
        setStatus('clearing');
        demoLock.current = true;
        const run = storyRunRef.current;
        void dropCampaignEnemies(base, stageNo, mission.enemyWaveSize).then(next => {
          if (run !== storyRunRef.current || storyRef.current !== stageNo) return;
          setBoard(next); demoLock.current = false; lastFallAt.current = performance.now(); setStatus('playing');
        });
      }
    },
    [restart],
  );

  // 遊び直し。ストーリー中なら同じコロを最初から
  const playAgain = useCallback(() => {
    if (storyRef.current !== null) {
      startStage(mapRun.current ? mapStageRef.current ?? storyRef.current : storyRef.current);
    } else {
      restart();
    }
  }, [restart, startStage]);

  // 台本から呼ぶ操作。非同期の段取りから呼ぶので、いつも最新の関数を指す
  const rotateRef = useRef(rotate);
  rotateRef.current = rotate;
  const hardDropRef = useRef(hardDrop);
  hardDropRef.current = hardDrop;

  // チュートリアルの1回ぶんを並べる。
  // keep を渡すと盤面をそのまま使い（ミスのあと）、なければ新しい的を1つ置く
  // チュートリアルの1回ぶんを並べる。
  // 7を扱う段（7のお手本・7の練習・ミッション）は的を置き、それ以外は空の盤面にブロックだけ。
  // keep を渡すと盤面をそのまま使う（ミスのあと）
  const startTutorialRound = (keep: Board | null, keepFree = false) => {
    const t = tutorial.current;
    const step = TUTORIAL_STEPS[t.step];
    if (!step) return;
    const withTarget =
      (step.kind === 'demo' && step.action === 'seven') ||
      (step.kind === 'practice' && step.needSeven) ||
      step.kind === 'mission';
    const isDemo = step.kind === 'demo';
    demoLock.current = isDemo;
    setTutorialView({ step: t.step, success: t.success });
    if (step.kind === 'practice') armTry();
    pieceId.current += 1;
    if (!withTarget) {
      // 回転・スワイプの段は、前の段で落ちたメを残したまま続ける
      setBoard(keepFree && keep ? keep : emptyBoard());
      setCurrent(makeTutorialPiece(pieceId.current, 1 + (pieceId.current % 3), 1));
      setNextPiece(makeTutorialPiece(pieceId.current + 1, 1, 1));
    } else {
      let next = keep;
      const targetAlive = keep?.some((row) => row.some((cell) => cell?.id === TUTORIAL_TARGET_ID));
      if (!next || !targetAlive) {
        t.target = step.kind === 'demo' ? step.target ?? 1 : 1 + (t.success % 3);
        next = emptyBoard();
        // お手本は真下に、練習とミッションは左右のどこかに的を置く
        const tx = isDemo ? 3 : 1 + Math.floor(Math.random() * (COLS - 2));
        next[ROWS - 1][tx] = { id: TUTORIAL_TARGET_ID, value: t.target, group: -300 };
      }
      // お手本は相方を一番上に置き、2回回して下へ向けて見せる
      const compIndex = isDemo ? 0 : Math.floor(Math.random() * 3);
      setBoard(next);
      setCurrent(makeTutorialPiece(pieceId.current, t.target, compIndex));
      setNextPiece(makeTutorialPiece(pieceId.current + 1, t.target, 1));
    }
    lastFallAt.current = performance.now();
    setStatus('playing');
    setSaika({ text: step[langRef.current], mood: 'hello' });
    if (step.kind === 'demo') {
      void runTutorialDemo(step.action, step.dir);
    }
  };

  // お手本のタップ。白い円を点滅させてから回す
  const demoTap = async (dir: 'cw' | 'ccw') => {
    setTapHint(dir === 'cw' ? 'right' : 'left');
    await delay(450);
    scripted.current = true;
    rotateRef.current(dir);
    scripted.current = false;
    await delay(550);
    setTapHint(null);
    await delay(500);
  };

  // お手本。セリフを読ませてから、その操作だけをゆっくり見せて落とす
  const runTutorialDemo = async (
    action: 'cw' | 'ccw' | 'seven' | 'up' | 'down',
    sevenDir: 'cw' | 'ccw' = 'cw',
  ) => {
    const activeScriptRun = storyRunRef.current;
    await delay(1600);
    if ((storyRunRef.current !== activeScriptRun || storyRef.current !== 0)) return;
    if (action === 'cw' || action === 'ccw' || action === 'seven') {
      const dir = action === 'seven' ? sevenDir : action === 'ccw' ? 'ccw' : 'cw';
      await demoTap(dir);
      if ((storyRunRef.current !== activeScriptRun || storyRef.current !== 0)) return;
      await demoTap(dir);
      await delay(400);
    } else {
      // スワイプは、白い円が上（下）へすべる動きで見せ、すべりきったところで落とす
      setTapHint(action);
      await delay(700);
    }
    if ((storyRunRef.current !== activeScriptRun || storyRef.current !== 0)) return;
    scripted.current = true;
    hardDropRef.current();
    scripted.current = false;
    await delay(250);
    setTapHint(null);
  };

  // 次の段へ。回転やスワイプの段（的のない段）どうしは、落ちたメを残したまま続ける。
  // 的のある段へ移るときと、積み上がりすぎたときは、盤面を光らせずにすっと消してから作り直す
  // 0メンのはじまり。BGMを半分に絞って、サイカが自己紹介してから始める。
  // 「Go！」と同時に音量を戻して、チュートリアルの1段目へ
  // サイカのあいさつのあと、遊び方はサイノメの組（ピンノメ＋ムツメ）が教える
  const TUTORIAL_WELCOME: Array<Line & { ms: number; saika?: boolean }> = [
    { ja: 'サイノメ・セヴンへようこそ！', en: 'Welcome to Sainome Seven!', ms: 1900, saika: true },
    { ja: 'わたしはサイカ よろしく♪', en: "I'm Saika. Nice to meet you!", ms: 1800, saika: true },
    { ja: 'ぼくはピンノメ！', en: "I'm Pinnome!", ms: 1500 },
    { ja: 'ムツメだよ！\n遊び方を伝授するね！', en: "I'm Mutsume!\nLet us show you how to play!", ms: 2000 },
    { ja: 'Go！', en: 'Go!', ms: 700 },
  ];
  const runTutorialWelcome = async () => {
    const activeScriptRun = storyRunRef.current;
    setStatus('clearing');
    setBoard(emptyBoard());
    setBgmDuck(true);
    for (const line of TUTORIAL_WELCOME) {
      if (line.ja === 'Go！') {
        setBgmDuck(false);
      }
      setSaika({ text: line[langRef.current], mood: line.ja === 'Go！' ? 'praise' : 'hello', ...(line.saika ? { who: 'saika' as const } : {}) });
      await delay(line.ms);
      if ((storyRunRef.current !== activeScriptRun || storyRef.current !== 0)) {
        setBgmDuck(false);
        return;
      }
    }
    startTutorialRound(null);
  };

  const nextTutorialStep = async (finished?: Board) => {
    const activeScriptRun = storyRunRef.current;
    const t = tutorial.current;
    t.step += 1;
    t.miss = 0;
    await delay(700);
    if ((storyRunRef.current !== activeScriptRun || storyRef.current !== 0)) return;
    const next = TUTORIAL_STEPS[t.step];
    const keepable =
      !!finished &&
      !!next &&
      !(next.kind === 'demo' && next.action === 'seven') &&
      !(next.kind === 'practice' && next.needSeven) &&
      next.kind !== 'mission' &&
      // ミッションの7段目ルールより手前まで許す。次のブロックが出てこられる高さなら残す
      !(finished as Board).some((row, y) => y <= TUTORIAL_KEEP_LIMIT_ROW && row.some(Boolean));
    if (keepable) {
      startTutorialRound(finished as Board, true);
      return;
    }
    if (finished && finished.some((row) => row.some(Boolean))) {
      await fadeBoard(finished);
      if ((storyRunRef.current !== activeScriptRun || storyRef.current !== 0)) return;
    }
    startTutorialRound(null);
  };

  tutorialLockRef.current = async (finished: Board, ok: boolean, sc: number) => {
    const activeScriptRun = storyRunRef.current;
    disarmTry();
    const t = tutorial.current;
    const step = TUTORIAL_STEPS[t.step];
    if (!step) return;
    // お手本と、7のいらない練習は、置けたら次へ進む
    if (step.kind === 'demo' || (step.kind === 'practice' && !step.needSeven)) {
      if (step.kind === 'practice') {
        setSaika({ text: TUTORIAL_LINES.ok[langRef.current], mood: 'smile' });
      }
      // 7のお手本は、消えきったのを見届けてから「ねっ！消えたでしょ」
      if (step.kind === 'demo' && step.action === 'seven') {
        setSaika({ text: TUTORIAL_LINES.demoCleared[langRef.current], mood: 'smile' });
        await delay(1300);
        if ((storyRunRef.current !== activeScriptRun || storyRef.current !== 0)) return;
      }
      await nextTutorialStep(finished);
      return;
    }
    if (ok) {
      if (step.kind === 'practice') {
        setSaika({ text: pickFrom(TUTORIAL_LINES.nice)[langRef.current], mood: 'smile' });
        await nextTutorialStep(finished);
        return;
      }
      t.success += 1;
      setTutorialView({ step: t.step, success: t.success });
      if (t.success >= (STORY_STAGES[0].goal as { target: number }).target) {
        completeStage(0, sc);
        return;
      }
      setSaika({ text: pickFrom(TUTORIAL_LINES.nice)[langRef.current], mood: 'smile' });
      await delay(500);
      if ((storyRunRef.current !== activeScriptRun || storyRef.current !== 0)) return;
      startTutorialRound(null);
      return;
    }
    t.miss += 1;
    if (t.miss >= TUTORIAL_MISS_LIMIT) {
      // 3回ミスしたら、盤面のメを光らせずにすっと消し、新しい的から仕切り直す
      t.miss = 0;
      setSaika({ text: TUTORIAL_LINES.wipe[langRef.current], mood: 'worry' });
      await fadeBoard(finished);
      if ((storyRunRef.current !== activeScriptRun || storyRef.current !== 0)) return;
      startTutorialRound(null);
      return;
    }
    setSaika({ text: TUTORIAL_LINES.miss[langRef.current], mood: 'worry' });
    await delay(300);
    if ((storyRunRef.current !== activeScriptRun || storyRef.current !== 0)) return;
    startTutorialRound(finished);
  };

  // --- 3メン・4メンで共通の段取り ---
  // 盤面のメを、光らせずにすっと消す（ミスが続いたとき・段の切りかえ）。
  // 白く光ると「消えた＝7ができた」に見えてしまうので、薄くなって沈むだけにする
  const FADE_MS = 420; // CSS の die-fade と同じ長さ
  const fadeBoard = async (finished: Board) => {
    const all = new Set<string>();
    finished.forEach((row, y) => row.forEach((cell, x) => cell && all.add(`${x},${y}`)));
    setFadeCells(all);
    await delay(FADE_MS);
    setFadeCells(new Set());
  };
  const wipeBoard = fadeBoard;

  // ミッションで積み上がったときの仕切り直し。白く光らせず、盤面のまん中から
  // 外へ軽くはじけながら、すばやく消えていく。失敗ではないので、明るく軽い見せ方にする
  const SCATTER_MS = 360; // CSS の scatter-out と同じ長さ
  const scatterBoard = async (finished: Board) => {
    const filled: Position[] = [];
    finished.forEach((row, y) => row.forEach((cell, x) => cell && filled.push({ x, y })));
    if (filled.length === 0) return;
    const cx = filled.reduce((sum, point) => sum + point.x, 0) / filled.length;
    const cy = filled.reduce((sum, point) => sum + point.y, 0) / filled.length;
    const bursts = new Map<string, BurstInfo>();
    filled.forEach((point) => {
      // 少しだけ上へ持ち上げて、下へ沈むより上へ抜けていくように見せる
      const dx = point.x - cx + (Math.random() - 0.5) * 0.4;
      const dy = point.y - cy - 0.6;
      const length = Math.hypot(dx, dy) || 1;
      bursts.set(`${point.x},${point.y}`, {
        dir: { x: dx / length, y: dy / length },
        particles: [],
        scatter: true,
      });
    });
    setBurstCells(bursts);
    await delay(SCATTER_MS);
    setBurstCells(new Map());
  };

  // ミッションを始める／置き直す。落ちてくるのはふつうの乱数のブロック
  const startMission = (build: () => Board) => {
    const next = build();
    pieceId.current += 1;
    setBoard(next);
    const boostWeight = wall22DiceWeight(mapStageRef.current, next);
    setCurrent(createPiece(pieceId.current, false, boostWeight));
    setNextPiece(createPiece(pieceId.current + 1, false, boostWeight));
    lastFallAt.current = performance.now();
    setStatus('playing');
  };

  // A wave falls through empty cells to the top of the existing stack.
  const dropCampaignEnemies = async (base: Board, stageNo: number, count: number, reinforcement = false): Promise<Board> => {
    const run = storyRunRef.current;
    const next = cloneBoard(base);
    const placed: Position[] = [];
    for (const x of [1, 5, 2, 4, 0, 6, 3]) {
      if (placed.length === count) break;
      const top = next.findIndex(row => row[x] !== null);
      const y = (top < 0 ? ROWS : top) - 1;
      if (y < 0) continue;
      next[y][x] = { id: `campaign-wave-${run}-${wallEnemySpawned.current + placed.length}`, value: KOITSUME, group: -1900 - wallEnemySpawned.current - placed.length };
      placed.push({ x, y });
    }
    wallEnemySpawned.current += placed.length;
    if (reinforcement) wallReinforcePending.current = Math.max(0, wallReinforcePending.current - placed.length);
    for (let row = 0; row <= Math.max(0, ...placed.map(p => p.y)); row++) {
      if (run !== storyRunRef.current || storyRef.current !== stageNo) return base;
      const frame = cloneBoard(base);
      placed.forEach(p => { frame[Math.min(row, p.y)][p.x] = next[p.y][p.x]; });
      setBoard(frame);
      await delay(55);
    }
    return next;
  };

  // お手本の最後。下スワイプの指を見せてから、ストンと落とす
  const scriptedDrop = async (stageNo: number) => {
    const activeScriptRun = storyRunRef.current;
    setTapHint('down');
    await delay(700);
    if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
    scripted.current = true;
    hardDropRef.current();
    scripted.current = false;
    await delay(250);
    setTapHint(null);
  };

  // --- 10メン：ヒドイメの登場 ---
  // 上から降ってきて、2列のメを縦にプレスしながら最下段まで沈む。
  // 段取りと長さは src/enemy/hidoimeFx.ts（確認用ページと同じもの）
  const runHidoimeEntrance = async (
    start: Board,
    stageNo: number,
    after: Line[],
    options: {
      midGame?: boolean;
      sense?: Line;
      // 盤面にかぶせる擬音（16メンの「ゴゴゴ…」など）。x・y は文字の中心（マス単位）
      sfx?: { id: SfxId; x: number; y: number };
      // 16メン：ほかのヒドイメを残したまま、決めた列へもう1体落とす。
      // floor はその下で止まる段（下にヒドイメがいれば、そのてっぺん）
      drop?: { group: number; x: number; floor: number };
    } = {},
  ): Promise<Board> => {
    const activeScriptRun = storyRunRef.current;
    if (!options.drop) {
      hidoimeHp.current = new Map();
      hidoimeDefeated.current = 0;
      setHidoimeDefeatedView(0);
      setHidoimeView(new Map());
    }
    if (options.midGame) {
      // 遊んでいる途中から呼ぶとき（12メン）は、操作を止めてすぐ始める
      demoLock.current = true;
      setStatus('clearing');
    } else {
      await delay(1900); // 「10メン」の札が消えるまで
      if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return start;
    }
    setSaika({ text: (options.sense ?? HIDOIME_LINES.sense)[langRef.current], mood: 'worry', who: 'saika' });
    if (!options.midGame && TUTOR_PAIRS[stageNo]) after = [TUTOR_RESCUE, ...after];
    if (options.sfx) showSfx(options.sfx.id, options.sfx.x, options.sfx.y);
    await delay(1100);
    if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return start;

    const group = options.drop?.group ?? -900;
    // 1〜4（右の列は x+1）。端は避ける
    const x = options.drop?.x ?? 1 + Math.floor(Math.random() * (COLS - 3));
    const floor = options.drop?.floor ?? ROWS;
    const topOf = (b: Board, col: number) => {
      for (let y = 0; y < ROWS; y += 1) if (b[y][col]) return y;
      return ROWS;
    };
    const { fallTo, pressRows } = planHidoimeFall(topOf(start, x), topOf(start, x + 1), floor);
    const update = (patch: Partial<HidoimeItem>) =>
      setHidoimeView((prev) => {
        const map = new Map(prev);
        const item = map.get(group);
        if (item) map.set(group, { ...item, ...patch });
        return map;
      });

    // 1. 盤面のいちばん上に出す
    hidoimeHp.current.set(group, HIDOIME_HP);
    setHidoimeView((prev) =>
      new Map([
        ...(options.drop ? [...prev.entries()] : []),
        [
          group,
          {
            variant: Math.random() < 0.5 ? 'rose' : 'violet',
            seed: 100 + Math.floor(Math.random() * 900),
            hp: HIDOIME_HP,
            dying: false,
            entering: true,
            pos: { x, y: 0 },
            move: 'none',
            moveMs: 0,
          },
        ],
      ]),
    );
    await delay(80); // 出た位置が一度描かれてから動かす
    if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return start;

    // 2. 落下。高いほうの列のてっぺんに触れるまで、加速しながら落ちる
    const fallMs = hidoimeFallMs(fallTo);
    update({ pos: { x, y: fallTo }, move: 'fall', moveMs: fallMs });
    await delay(fallMs);
    if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return start;

    // 3. プレス。真下の段のメを縦に押しつぶしながら、1段ずつ沈む
    let board = start;
    for (const row of pressRows) {
      const squashed = [x, x + 1].filter((col) => board[row][col]).map((col) => ({ x: col, y: row }));
      setPressCells(new Set(squashed.map((point) => `${point.x},${point.y}`)));
      if (squashed.length > 0) {
        const keys = squashed.map((point) => `${point.x},${point.y}`);
        setPressBursts((prev) => {
          const next = new Map(prev);
          squashed.forEach((point, index) => {
            const value = board[point.y][point.x]?.value ?? 1;
            next.set(keys[index], makePressParticles(value > 0 ? COLORS[value - 1] : ENEMY_COLOR));
          });
          return next;
        });
        runTimeout(
          () =>
            setPressBursts((prev) => {
              const next = new Map(prev);
              keys.forEach((key) => next.delete(key));
              return next;
            }),
          900,
        );
      }
      update({ pos: { x, y: row - 1 }, move: 'press', moveMs: HIDOIME_PRESS_ROW_MS });
      if (squashed.length > 0) {
        playImpact();
        if (soundModeRef.current !== 'none') {
          playHidoimeCrushSound();
        }
      }
      await delay(HIDOIME_PRESS_ROW_MS);
      if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return start;
      board = board.map((line) => [...line]);
      squashed.forEach((point) => {
        board[point.y][point.x] = null;
      });
      setBoard(board);
      setPressCells(new Set());
    }

    // 4. 着地。最下段で、どすんと横につぶれて戻る
    const landY = floor - 2;
    const landed = board.map((line) => [...line]);
    [
      { x, y: landY },
      { x: x + 1, y: landY },
      { x, y: landY + 1 },
      { x: x + 1, y: landY + 1 },
    ].forEach((point, index) => {
      landed[point.y][point.x] = { id: `hidoime-${index}`, value: HIDOIME, group };
    });
    setBoard(landed);
    update({ pos: { x, y: landY }, move: 'land', moveMs: 0 });
    playImpact();
    if (soundModeRef.current !== 'none') {
      playBombSound();
    }
    await delay(HIDOIME_LAND_MS);
    if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return start;
    update({ entering: false, move: 'none' });
    // 登場のあとのセリフ。10メンはひとこと、11メンは FEVER の説明が続く
    for (let index = 0; index < after.length; index += 1) {
      const line = after[index];
      setSaika({ text: line[langRef.current], mood: index === 0 ? 'praise' : 'hello' });
      if (index < after.length - 1) {
        await delay(1200 + line.ja.length * 45);
        if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return start;
      }
    }
    demoLock.current = false;
    lastFallAt.current = performance.now();
    // 途中から呼んだときは、次のブロックを出すのは呼び出し側（spawnNext）に任せる
    if (!options.midGame) {
      setStatus('playing');
    }
    return landed;
  };

  // --- 17メン：ベラボウメの登場 ---
  // 下の3×3にいるメを、奥から手前（画面のこちら側）へ弾き飛ばし、空いたところにそのまま居座る
  // --- 18メン：デタラメの登場 ---
  // 空けておいた列の下から、3段の身体が伸びてくる
  const runDetarameEntrance = async (
    start: Board,
    stageNo: number,
    x: number,
    // add：ほかのデタラメを残したまま、もう1体出す（ウォール6-3・6-4）
    options: { midGame?: boolean; add?: boolean } = {},
  ): Promise<Board> => {
    const activeScriptRun = storyRunRef.current;
    if (!options.add) {
      detarameTurn.current = 0;
      detarameDefeated.current = 0;
      detarameSpawned.current = 0;
      detarameLaserShown.current = false;
      setDetarameDefeatedView(0);
      updateDetarame(null);
    }
    const id = (nextDetarameId.current += 1);
    detarameSpawned.current += 1;
    if (options.midGame) {
      demoLock.current = true;
      setStatus('clearing');
    } else {
      await delay(1900); // 「18メン」の札が消えるまで
      if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return start;
    }
    setSaika({ text: DETARAME_LINES.sense[langRef.current], mood: 'worry', who: 'saika' });
    // どこから来るか分からないよう、擬音は盤面の真ん中に出す
    showSfx('zuzuzu', COLS / 2, ROWS - 2);
    playImpact();
    await delay(1300);
    if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return start;
    const top = ROWS - DETARAME_START_SEGMENTS;
    // 下の3つのサイを、900msかけて一気に捕食しながら現れる
    const eaten = new Map<string, { dx: number; dy: number }>();
    for (let y = top; y < ROWS; y += 1) {
      if (start[y][x]) eaten.set(`${x},${y}`, { dx: 0, dy: 0 });
    }
    setAbsorbCells(eaten);
    playImpact();
    if (soundModeRef.current !== 'none') {
      // 下のサイを食べて現れる。食べるサイが無ければ、これまでどおりの登場音
      if (eaten.size > 0) playDevourSound(eaten.size);
      else playEnemyHitSound(true);
    }
    await delay(DETARAME_DEVOUR_MS);
    setAbsorbCells(new Map());
    if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return start;
    const board = start.map((line) => [...line]);
    for (let y = top; y < ROWS; y += 1) {
      board[y][x] = { id: `detarame-${id}-${y}`, value: DETARAME, group: detarameGroup(id) };
    }
    setBoard(board);
    // 目は上から左・右・左。配色は青い目／黄色い目のどちらか
    const variant: DetarameVariant = Math.random() < 0.5 ? 'blue' : 'yellow';
    updateDetarameById(id, {
      id,
      x,
      top,
      variant,
      turns: 0,
      entering: true,
      segs: [
        { dir: -1, alive: true },
        { dir: 1, alive: true },
        { dir: -1, alive: true },
      ],
    });
    if (soundModeRef.current !== 'none') {
      playBombSound();
    }
    await delay(500);
    if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return board;
    const entered = detaramesRef.current.find((d) => d.id === id);
    if (entered) updateDetarameById(id, { ...entered, entering: false });
    const after = options.midGame ? [DETARAME_LINES.appear] : [...(TUTOR_PAIRS[stageNo] ? [TUTOR_RESCUE] : []), DETARAME_LINES.appear, DETARAME_LINES.howto];
    for (let index = 0; index < after.length; index += 1) {
      const line = after[index];
      setSaika({ text: line[langRef.current], mood: index === 0 ? 'worry' : 'hello' });
      if (index < after.length - 1) {
        await delay(1200 + line.ja.length * 45);
        if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return board;
      }
    }
    demoLock.current = false;
    lastFallAt.current = performance.now();
    if (!options.midGame) {
      setStatus('playing');
    }
    return board;
  };

  // デタラメの手番（プレイヤーの1手ごと）。
  // 1. DETARAME_GROW_EVERY 手ごとに、身体が1段上がって下に新しい目が生まれる。
  //    新しいてっぺんの場所にサイがあれば、白い3重の線にして、いちばん上の目へ吸い込む
  // 2. 目ごとに独立して50%でビーム。向いている側の同じ行で、いちばん近い通常サイ1個に当て、
  //    コイツメ（45%）かダーメ（15%）に変える（40%はそのまま）。コイツメ・ダーメ・ニコニコメは飛ばしてその奥を探す
  const runDetarameTurn = async (start: Board, id: number): Promise<Board> => {
    const run = storyRunRef.current;
    const alive = () => storyRunRef.current === run;
    let next = start;
    const found = detaramesRef.current.find((item) => item.id === id);
    if (!found) return next;
    detarameTurn.current += 1;
    const d0 = { ...found, turns: found.turns + 1 };
    updateDetarameById(id, d0);
    // ニコニコメがてっぺんの上に乗っていたら、フタをされた状態。伸びず、吸い込みもしない
    const lid = d0.top - 1 >= 0 ? next[d0.top - 1][d0.x] : null;
    const sealed = lid?.value === NICO;
    if (sealed && lid && detarameSealedBy.current !== lid.id) {
      detarameSealedBy.current = lid.id;
      setSaika({ text: pickFrom(DETARAME_SEALED_LINES)[langRef.current], mood: 'praise' });
    }
    if (
      !sealed &&
      d0.turns % DETARAME_GROW_EVERY === 0 &&
      Math.random() < DETARAME_GROW_RATE &&
      d0.top - 1 >= DETARAME_TOP_LIMIT &&
      d0.segs.length < DETARAME_MAX_SEGMENTS
    ) {
      const newTop = d0.top - 1;
      const taken = next[newTop][d0.x];
      const bottomDir = d0.segs[d0.segs.length - 1].dir;
      const grown: DetarameState = {
        ...d0,
        top: newTop,
        segs: [...d0.segs, { dir: bottomDir < 0 ? 1 : -1, alive: true }],
        born: d0.segs.length,
      };
      updateDetarameById(id, grown);
      setSaika({ text: DETARAME_LINES.grow[langRef.current], mood: 'worry' });
      await delay(DETARAME_RISE_MS);
      if (!alive()) return start;
      if (taken) {
        const topDir = grown.segs[0].dir;
        setAbsorbCell({
          key: `${d0.x},${newTop}`,
          dx: (topDir < 0 ? DETARAME_ABSORB.left : DETARAME_ABSORB.right) - 0.5,
          dy: DETARAME_ABSORB.y - 0.5,
        });
        updateDetarameById(id, { ...grown, born: undefined, absorbing: true });
        if (soundModeRef.current !== 'none') playDevourSound(1);
        await delay(DETARAME_ABSORB_MS);
        if (!alive()) return start;
        setAbsorbCell(null);
      }
      next = next.map((line) => [...line]);
      next[newTop][d0.x] = { id: `detarame-${id}-${newTop}-${detarameTurn.current}`, value: DETARAME, group: detarameGroup(id) };
      setBoard(next);
      updateDetarameById(id, { ...grown, born: undefined, absorbing: false });
    }

    const d = detaramesRef.current.find((item) => item.id === id);
    if (!d) return next;
    const shots: { index: number; row: number; tx: number; dir: -1 | 1 }[] = [];
    d.segs.forEach((s, index) => {
      if (!s.alive || Math.random() >= DETARAME_FIRE_RATE) return;
      const row = d.top + index;
      for (let cx = d.x + s.dir; cx >= 0 && cx < COLS; cx += s.dir) {
        const cell = next[row][cx];
        if (!cell) continue;
        if (cell.value > 0 && cell.value !== NICO) {
          shots.push({ index, row, tx: cx, dir: s.dir });
          return;
        }
        if (cell.value === KOITSUME || cell.value === DAME || cell.value === NICO) continue;
        return; // ほかの敵の向こうには届かない
      }
    });
    if (shots.length === 0) return next;

    setDetarameFiring(new Map([[id, new Set(shots.map((shot) => shot.index))]]));
    setDetarameBeams(
      shots.map((shot) => ({
        row: shot.row,
        from: d.x + (shot.dir < 0 ? DETARAME_PUPIL.left : DETARAME_PUPIL.right),
        to: shot.dir < 0 ? shot.tx + 1 - 0.04 : shot.tx + 0.04,
        dir: shot.dir,
        retract: false,
        variant: d.variant,
      })),
    );
    await delay(DETARAME_BEAM_GROW_MS);
    if (!alive()) return start;
    // 当たった。命中点を残したまま、目の側から縮めて消す
    setDetarameBeams((prev) => prev.map((beam) => ({ ...beam, retract: true })));
    setDetarameFiring(new Map());
    setRewriteCells(new Set(shots.map((shot) => `${shot.tx},${shot.row}`)));
    await delay(DETARAME_BEAM_RETRACT_MS);
    if (!alive()) return start;
    next = next.map((line) => [...line]);
    shots.forEach((shot, k) => {
      const cell = next[shot.row][shot.tx];
      if (!cell) return;
      const roll = Math.random();
      if (roll >= DETARAME_KOITSUME_RATE + DETARAME_DAME_RATE) return; // そのまま（波だけかかる）
      if (mapRun.current) campaignGeneratedEnemies.current += 1;
      next[shot.row][shot.tx] = {
        id: cell.id,
        value: roll < DETARAME_KOITSUME_RATE ? KOITSUME : DAME,
        group: -7000 - detarameTurn.current * 10 - k,
      };
    });
    setBoard(next);
    if (soundModeRef.current !== 'none') {
      playEnemyHitSound(false);
    }
    if (!detarameLaserShown.current) {
      detarameLaserShown.current = true;
      setSaika({ text: DETARAME_LINES.laser[langRef.current], mood: 'worry' });
    }
    await delay(DETARAME_REWRITE_MS);
    if (!alive()) return start;
    setDetarameBeams([]);
    setRewriteCells(new Set());
    return next;
  };

  const runBerabouEntrance = async (
    start: Board,
    stageNo: number,
    options: { midGame?: boolean; x?: number } = {},
  ): Promise<Board> => {
    const activeScriptRun = storyRunRef.current;
    berabouRageRun.current += 1;
    setBerabouRaging(false);
    berabouHp.current = BERABOU_HP;
    berabouIdle.current = 0;
    berabouDefeated.current = 0;
    setBerabouDefeatedView(0);
    setBerabouView(null);
    if (options.midGame) {
      demoLock.current = true;
      setStatus('clearing');
    } else {
      await delay(1900); // 「17メン」の札が消えるまで
      if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return start;
    }
    setSaika({ text: BERABOU_LINES.sense[langRef.current], mood: 'worry', who: 'saika' });
    showSfx('gogogo', 3.5, ROWS - 2);
    playImpact();
    await delay(1300);
    if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return start;

    // 1〜3（右の列は x+2）。端は避ける
    const x = options.x ?? 1 + Math.floor(Math.random() * (COLS - 4));
    const top = ROWS - 3;
    const fling = new Map<string, Position>();
    for (let y = top; y < ROWS; y += 1) {
      for (let col = x; col < x + 3; col += 1) {
        if (start[y][col]) fling.set(`${col},${y}`, { x: col - (x + 1), y: y - (top + 1) });
      }
    }
    setFlingCells(fling);
    // 色はオレンジ／イエローグリーンの2種類から、出てくるたびに選ぶ
    const variant: BeraboumeVariant = Math.random() < 0.5 ? 'orange' : 'lime';
    setBerabouView({ hp: BERABOU_HP, dying: false, entering: true, pos: { x, y: top }, variant });
    playImpact();
    if (soundModeRef.current !== 'none') {
      playBombSound();
    }
    await delay(BERABOU_FLING_MS);
    if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return start;

    // 飛んでいったメのあとに居座る。9マスとも同じ group なので、ひとかたまりで動く
    const landed = start.map((line) => [...line]);
    for (let y = top; y < ROWS; y += 1) {
      for (let col = x; col < x + 3; col += 1) {
        landed[y][col] = { id: `berabou-${col}-${y}`, value: BERABOU, group: BERABOU_GROUP };
      }
    }
    setBoard(landed);
    setFlingCells(new Map());
    setBerabouView((prev) => (prev ? { ...prev, entering: false } : prev));
    const after = options.midGame ? [BERABOU_LINES.appear] : [...(TUTOR_PAIRS[stageNo] ? [TUTOR_RESCUE] : []), BERABOU_LINES.appear, BERABOU_LINES.howto];
    for (let index = 0; index < after.length; index += 1) {
      const line = after[index];
      setSaika({ text: line[langRef.current], mood: index === 0 ? 'worry' : 'hello' });
      if (index < after.length - 1) {
        await delay(1200 + line.ja.length * 45);
        if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return landed;
      }
    }
    demoLock.current = false;
    lastFallAt.current = performance.now();
    if (!options.midGame) {
      setStatus('playing');
    }
    return landed;
  };

  // --- 6メン：ダーメの倒し方 ---
  // お手本は3つ縦のブロックを2回落とす。左の的で1回目（✕が取れる）、右の的で2回目（倒す）
  const startDameRound = (keep: Board | null) => {
    const t = dameLesson.current;
    const isDemo = t.phase === 'demo';
    demoLock.current = isDemo;
    if (t.phase === 'play') armTry();
    const alive =
      !!keep &&
      keep.some((row) => row.some((cell) => cell?.value === DAME || cell?.value === KOITSUME)) &&
      keep.some((row) => row.some((cell) => !!cell && DAME_TARGET_IDS.includes(cell.id)));
    let next = alive ? (keep as Board) : null;
    if (!next) {
      t.target = isDemo ? 1 : 1 + (t.success % 3);
      t.demoStep = 0;
      const start = isDemo ? 2 : Math.floor(Math.random() * (COLS - 2));
      next = buildDameLessonBoard(start, t.target);
      t.start = start;
    }
    pieceId.current += 1;
    setBoard(next);
    if (isDemo) {
      // 1回目は左の的へ、2回目は右の的へ、まっすぐ落とす
      const column = t.start + (t.demoStep === 0 ? 0 : 2);
      // ふつうの3つ縦のブロックで見せる。上の2つは [2] にして、どこにも7を作らない
      setCurrent(makeColumnPiece(pieceId.current, [2, 2, 7 - t.target], column));
      setNextPiece(makeColumnPiece(pieceId.current + 1, [2, 2, 7 - t.target], t.start + 2));
    } else {
      setCurrent(makeTutorialPiece(pieceId.current, t.target, Math.floor(Math.random() * 3)));
      setNextPiece(makeTutorialPiece(pieceId.current + 1, t.target, 1));
    }
    lastFallAt.current = performance.now();
    setStatus('playing');
    if (isDemo) {
      void runDameDemo(t.demoStep);
    }
  };

  // サイカが敵に出くわし、サイノメの組がかけつける。中断されたら false
  const tutorRescue = async (stageNo: number) => {
    const activeScriptRun = storyRunRef.current;
    const alive = () => storyRunRef.current === activeScriptRun && storyRef.current === stageNo;
    fallFrozen.current = true;
    try {
      const panic = TUTOR_PANIC[stageNo];
      if (panic) {
        setSaika({ text: panic[langRef.current], mood: 'worry', who: 'saika' });
        await delay(1600);
        if (!alive()) return false;
      }
      setSaika({ text: TUTOR_RESCUE[langRef.current], mood: 'hello' });
      await delay(1500);
      return alive();
    } finally {
      fallFrozen.current = false;
    }
  };

  const runDameDemo = async (step: number) => {
    const activeScriptRun = storyRunRef.current;
    if (step === 0) {
      if (!(await tutorRescue(DAME_STAGE))) return;
      setSaika({ text: DAME_LINES.intro[langRef.current], mood: 'hello' });
      await delay(1900);
      if ((storyRunRef.current !== activeScriptRun || storyRef.current !== DAME_STAGE)) return;
      setSaika({ text: DAME_LINES.demo[langRef.current], mood: 'hello' });
      await delay(2100);
    } else {
      await delay(600);
    }
    if ((storyRunRef.current !== activeScriptRun || storyRef.current !== DAME_STAGE)) return;
    await scriptedDrop(DAME_STAGE);
  };

  dameLockRef.current = async (finished: Board, killed: number, damaged: number, sc: number) => {
    const activeScriptRun = storyRunRef.current;
    disarmTry();
    const t = dameLesson.current;
    const goal = (STORY_STAGES[DAME_STAGE].goal as { target: number }).target;

    if (t.phase === 'demo') {
      if (t.demoStep === 0) {
        // 1回目。✕が取れたところを見せて、同じ盤面のまま2回目へ
        setSaika({ text: DAME_LINES.demoHit[langRef.current], mood: 'smile' });
        t.demoStep = 1;
        await delay(1500);
        if ((storyRunRef.current !== activeScriptRun || storyRef.current !== DAME_STAGE)) return;
        startDameRound(finished);
        return;
      }
      setSaika({ text: DAME_LINES.demoCleared[langRef.current], mood: 'smile' });
      t.phase = 'play';
      demoLock.current = false;
      setDameView({ phase: 'play', success: 0 });
      await delay(1500);
      if ((storyRunRef.current !== activeScriptRun || storyRef.current !== DAME_STAGE)) return;
      setSaika({ text: DAME_LINES.go[langRef.current], mood: 'praise' });
      await delay(800);
      if ((storyRunRef.current !== activeScriptRun || storyRef.current !== DAME_STAGE)) return;
      startDameRound(null);
      return;
    }

    if (t.phase === 'mission') {
      if (killed > 0) {
        t.success += killed;
        setDameView({ phase: 'mission', success: t.success });
        if (t.success >= goal) {
          completeStage(DAME_STAGE, sc);
          return;
        }
        setSaika({ text: DAME_LINES.nice[langRef.current], mood: 'smile' });
      } else if (damaged > 0) {
        setSaika({ text: DAME_LINES.hit[langRef.current], mood: 'smile' });
      }
      const remaining = Math.max(1, goal - t.success);
      if (stackTooHigh(finished)) {
        setSaika({ text: DAME_LINES.reset[langRef.current], mood: 'hello' });
        await scatterBoard(finished);
        if ((storyRunRef.current !== activeScriptRun || storyRef.current !== DAME_STAGE)) return;
        startMission(() => buildDameMissionBoard(remaining));
        return;
      }
      const left = countEnemies(finished);
      if (left.dame + left.koitsume === 0) {
        await delay(400);
        if ((storyRunRef.current !== activeScriptRun || storyRef.current !== DAME_STAGE)) return;
        setSaika({ text: DAME_LINES.more[langRef.current], mood: 'hello' });
        startMission(() => buildDameMissionBoard(remaining));
        return;
      }
      await spawnNext(finished, sc);
      return;
    }

    // やってみて。1回目の命中（✕が取れた）はミスではなく、途中まで進んだ扱い
    if (killed > 0) {
      t.success += 1;
      t.miss = 0;
      if (t.success >= DAME_PRACTICE) {
        t.phase = 'mission';
        t.success = 0;
        setDameView({ phase: 'mission', success: 0 });
        setSaika({ text: DAME_LINES.mission[langRef.current], mood: 'praise' });
        await delay(900);
        if ((storyRunRef.current !== activeScriptRun || storyRef.current !== DAME_STAGE)) return;
        startMission(() => buildDameMissionBoard(goal));
        return;
      }
      setDameView({ phase: 'play', success: t.success });
      setSaika({ text: DAME_LINES.again[langRef.current], mood: 'smile' });
      await delay(600);
      if ((storyRunRef.current !== activeScriptRun || storyRef.current !== DAME_STAGE)) return;
      startDameRound(null);
      return;
    }
    if (damaged > 0) {
      t.miss = 0;
      setSaika({ text: DAME_LINES.hit[langRef.current], mood: 'smile' });
      await delay(300);
      if ((storyRunRef.current !== activeScriptRun || storyRef.current !== DAME_STAGE)) return;
      startDameRound(finished);
      return;
    }
    t.miss += 1;
    if (t.miss >= TUTORIAL_MISS_LIMIT) {
      t.miss = 0;
      setSaika({ text: DAME_LINES.wipe[langRef.current], mood: 'worry' });
      await wipeBoard(finished);
      if ((storyRunRef.current !== activeScriptRun || storyRef.current !== DAME_STAGE)) return;
      startDameRound(null);
      return;
    }
    setSaika({ text: DAME_LINES.miss[langRef.current], mood: 'worry' });
    await delay(300);
    if ((storyRunRef.current !== activeScriptRun || storyRef.current !== DAME_STAGE)) return;
    startDameRound(finished);
  };

  // --- ひっさつメの教室（3メン・5メン・7メン・9メン） ---
  // お手本 → やってみて（BOMB_PRACTICE 回）→ ミッション（わちゃわちゃした盤面で3回）
  const lessonOf = (stageNo: number) => BOMB_LESSONS[stageNo] as BombLesson;

  const startBombRound = (keep: Board | null) => {
    const stageNo = storyRef.current ?? -1;
    const lesson = lessonOf(stageNo);
    const t = bombLesson.current;
    const demo = t.phase === 'demo';
    const next = keep && lesson.practiceAlive(keep) ? keep : lesson.practiceBoard(demo);
    pieceId.current += 1;
    setBoard(next);
    setCurrent(lesson.piece(pieceId.current, demo));
    setNextPiece(lesson.piece(pieceId.current + 1, false));
    if (t.phase === 'play') armTry();
    lastFallAt.current = performance.now();
    setStatus('playing');
    if (demo) {
      void runBombDemo(stageNo);
    }
  };

  const runBombDemo = async (stageNo: number) => {
    const activeScriptRun = storyRunRef.current;
    const { lines } = lessonOf(stageNo);
    // 吹き出しを1つずつ。字数の多いものほど長めに見せる
    for (const line of lines.opening) {
      setSaika({ text: line[langRef.current], mood: 'hello' });
      await delay(1200 + line.ja.length * 45);
      if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
    }
    await scriptedDrop(stageNo);
  };

  bombLockRef.current = async (finished: Board, fired: boolean, sc: number) => {
    const activeScriptRun = storyRunRef.current;
    disarmTry();
    const stageNo = storyRef.current ?? -1;
    const lesson = lessonOf(stageNo);
    const { lines } = lesson;
    const t = bombLesson.current;
    const goal = (STORY_STAGES[stageNo].goal as { target: number }).target;

    if (t.phase === 'demo') {
      if (stageNo === WALL_LESSON) {
        t.phase = 'mission'; t.success = 0; t.miss = 0;
        setBombView({ phase: 'mission', success: 0 });
        setSaika({ text: lines.mission[langRef.current], mood: 'praise' });
        await delay(1200);
        if (storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo) return;
        demoLock.current = false;
        startMission(lesson.missionBoard);
        return;
      }
      t.phase = 'play';
      demoLock.current = false;
      setBombView({ phase: 'play', success: 0 });
      await delay(600);
      // 技の特長をひとこと。技が決まったのを見た直後がいちばん伝わる
      if (lines.feature) {
        setSaika({ text: lines.feature[langRef.current], mood: 'hello' });
        await delay(2600);
        if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
      }
      setSaika({ text: lines.go[langRef.current], mood: 'praise' });
      await delay(900);
      if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
      startBombRound(null);
      return;
    }

    if (t.phase === 'mission') {
      if (fired) {
        t.success += 1;
        setBombView({ phase: 'mission', success: t.success });
        if (t.success >= goal) {
          completeStage(stageNo, sc);
          return;
        }
        // 1回ごとに、新しい仕込みの盤面から
        if (stageNo === WALL_LESSON && t.success === 2) {
          storyDiceBias = false;
          storyBoostValues = [];
          storyIdlePool = { ja: ['平時のメの出現カクリツでやってみるのじゃ！', 'どうした？\nちゃんと考えておるのか！'], en: ['Try with the normal dice probabilities!', 'Are you thinking carefully?'] };
          setSaika({ text: storyIdlePool[langRef.current][0], mood: 'hello' });
        } else setSaika({ text: lines.missionNice[langRef.current], mood: 'smile' });
        await delay(600);
        if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
        startMission(lesson.missionBoard);
        return;
      }
      if (mapStageRef.current === WALL22_STAGE ? stackReachesHeight(finished, 9) : stackTooHigh(finished)) {
        setSaika({ text: lines.reset[langRef.current], mood: 'hello' });
        await scatterBoard(finished);
        if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
        startMission(lesson.missionBoard);
        return;
      }
      if (stageNo === WALL_LESSON && t.success === 2 && ++t.miss % 3 === 0) {
        setSaika({ text: langRef.current === 'ja' ? 'どうした？\nちゃんと考えておるのか！' : 'Are you thinking carefully?', mood: 'worry' });
      }
      await spawnNext(finished, sc);
      return;
    }

    // やってみて
    if (fired) {
      t.success += 1;
      t.miss = 0;
      if (t.success >= BOMB_PRACTICE) {
        t.phase = 'mission';
        t.success = 0;
        setBombView({ phase: 'mission', success: 0 });
        setSaika({ text: lines.mission[langRef.current], mood: 'praise' });
        await delay(900);
        if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
        startMission(lesson.missionBoard);
        return;
      }
      setBombView({ phase: 'play', success: t.success });
      setSaika({ text: lines.again[langRef.current], mood: 'smile' });
      await delay(500);
      if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
      startBombRound(null);
      return;
    }
    t.miss += 1;
    if (mapStageRef.current === WALL22_STAGE ? stackReachesHeight(finished, 9) : t.miss >= TUTORIAL_MISS_LIMIT) {
      t.miss = 0;
      setSaika({ text: lines.wipe[langRef.current], mood: 'worry' });
      await wipeBoard(finished);
      if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
      startBombRound(null);
      return;
    }
    setSaika({ text: lines.miss[langRef.current], mood: 'worry' });
    await delay(300);
    if ((storyRunRef.current !== activeScriptRun || storyRef.current !== stageNo)) return;
    startBombRound(finished);
  };

  // --- 4メン：コイツメの倒し方 ---
  // お手本 → やってみて（KOI_PRACTICE 回）→ ミッション（コイツメを3体倒す）
  // お手本とやってみては、底に的のメとコイツメを並べ、的の相方を落として7を作る。
  const KOI_TARGET_ID = 'koi-target';
  const startKoiRound = (keep: Board | null) => {
    const t = koiLesson.current;
    const isDemo = t.phase === 'demo';
    demoLock.current = isDemo;
    if (t.phase === 'play') armTry();
    let next = keep;
    const alive =
      keep?.some((row) => row.some((cell) => cell?.value === KOITSUME)) &&
      keep?.some((row) => row.some((cell) => cell?.id === KOI_TARGET_ID));
    if (!next || !alive) {
      t.target = isDemo ? 1 : 1 + (t.success % 3);
      next = emptyBoard();
      // お手本は真ん中の的の右どなりに。やってみては左右のどこかに
      const tx = isDemo ? 3 : 1 + Math.floor(Math.random() * (COLS - 2));
      const side = isDemo ? 1 : Math.random() < 0.5 ? -1 : 1;
      next[ROWS - 1][tx] = { id: KOI_TARGET_ID, value: t.target, group: -300 };
      next[ROWS - 1][tx + side] = { id: `koi-lesson-${pieceId.current}`, value: KOITSUME, group: -260 };
    }
    pieceId.current += 1;
    // お手本は相方を一番下に入れて、真下の的へ落とすだけで7になる
    const compIndex = isDemo ? 2 : Math.floor(Math.random() * 3);
    setBoard(next);
    setCurrent(makeTutorialPiece(pieceId.current, t.target, compIndex));
    setNextPiece(makeTutorialPiece(pieceId.current + 1, t.target, 1));
    lastFallAt.current = performance.now();
    setStatus('playing');
    if (isDemo) {
      void runKoiDemo();
    }
  };

  const runKoiDemo = async () => {
    const activeScriptRun = storyRunRef.current;
    if (!(await tutorRescue(KOI_STAGE))) return;
    setSaika({ text: KOI_LINES.intro[langRef.current], mood: 'hello' });
    await delay(1900);
    if ((storyRunRef.current !== activeScriptRun || storyRef.current !== KOI_STAGE)) return;
    setSaika({ text: KOI_LINES.demo[langRef.current], mood: 'hello' });
    await delay(2100);
    if ((storyRunRef.current !== activeScriptRun || storyRef.current !== KOI_STAGE)) return;
    await scriptedDrop(KOI_STAGE);
  };

  koiLockRef.current = async (finished: Board, killed: number, sc: number) => {
    const activeScriptRun = storyRunRef.current;
    disarmTry();
    const t = koiLesson.current;
    const goal = (STORY_STAGES[KOI_STAGE].goal as { target: number }).target;

    if (t.phase === 'demo') {
      setSaika({ text: KOI_LINES.demoCleared[langRef.current], mood: 'smile' });
      t.phase = 'play';
      demoLock.current = false;
      setKoiView({ phase: 'play', success: 0 });
      await delay(1300);
      if ((storyRunRef.current !== activeScriptRun || storyRef.current !== KOI_STAGE)) return;
      setSaika({ text: KOI_LINES.go[langRef.current], mood: 'praise' });
      await delay(700);
      if ((storyRunRef.current !== activeScriptRun || storyRef.current !== KOI_STAGE)) return;
      startKoiRound(null);
      return;
    }

    if (t.phase === 'mission') {
      if (killed > 0) {
        t.success += killed;
        setKoiView({ phase: 'mission', success: t.success });
        if (t.success >= goal) {
          completeStage(KOI_STAGE, sc);
          return;
        }
        setSaika({ text: KOI_LINES.nice[langRef.current], mood: 'smile' });
      }
      if (stackTooHigh(finished)) {
        setSaika({ text: KOI_LINES.reset[langRef.current], mood: 'hello' });
        await scatterBoard(finished);
        if ((storyRunRef.current !== activeScriptRun || storyRef.current !== KOI_STAGE)) return;
        startMission(buildKoiMissionBoard);
        return;
      }
      // 盤面のコイツメを倒しきったら、新しく置き直す
      if (countEnemies(finished).koitsume === 0) {
        await delay(400);
        if ((storyRunRef.current !== activeScriptRun || storyRef.current !== KOI_STAGE)) return;
        setSaika({ text: KOI_LINES.more[langRef.current], mood: 'hello' });
        startMission(buildKoiMissionBoard);
        return;
      }
      await spawnNext(finished, sc);
      return;
    }

    // やってみて
    if (killed > 0) {
      t.success += 1;
      t.miss = 0;
      if (t.success >= KOI_PRACTICE) {
        t.phase = 'mission';
        t.success = 0;
        setKoiView({ phase: 'mission', success: 0 });
        setSaika({ text: KOI_LINES.mission[langRef.current], mood: 'praise' });
        await delay(900);
        if ((storyRunRef.current !== activeScriptRun || storyRef.current !== KOI_STAGE)) return;
        startMission(buildKoiMissionBoard);
        return;
      }
      setKoiView({ phase: 'play', success: t.success });
      setSaika({ text: KOI_LINES.again[langRef.current], mood: 'smile' });
      await delay(600);
      if ((storyRunRef.current !== activeScriptRun || storyRef.current !== KOI_STAGE)) return;
      startKoiRound(null);
      return;
    }
    t.miss += 1;
    if (t.miss >= TUTORIAL_MISS_LIMIT) {
      t.miss = 0;
      setSaika({ text: KOI_LINES.wipe[langRef.current], mood: 'worry' });
      await wipeBoard(finished);
      if ((storyRunRef.current !== activeScriptRun || storyRef.current !== KOI_STAGE)) return;
      startKoiRound(null);
      return;
    }
    setSaika({ text: KOI_LINES.miss[langRef.current], mood: 'worry' });
    await delay(300);
    if ((storyRunRef.current !== activeScriptRun || storyRef.current !== KOI_STAGE)) return;
    startKoiRound(finished);
  };

  // クリアの花火。3回に分けて上げる（時刻は CLEAR_VOLLEYS_MS）
  // 13メン：FEVER になって、サイカの姿が変わった最初の瞬間にひとこと
  useEffect(() => {
    if (!feverActive || storyRef.current !== FEVER_STAGE || awakenShown.current) {
      return;
    }
    awakenShown.current = true;
    setSaika({ text: FEVER_AWAKEN_LINE[langRef.current], mood: 'bomb' });
  }, [feverActive]);

  useEffect(() => {
    if (!clearFireworks) {
      setClearVolley(0);
      return;
    }
    const timers = CLEAR_VOLLEYS_MS.map((ms, index) =>
      runTimeout(() => setClearVolley(index + 1), ms),
    );
    timers.push(runTimeout(() => setClearFireworks(false), CLEAR_CELEBRATION_MS));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [clearFireworks]);

  useEffect(() => {
    if (!comboFx) {
      return;
    }
    const timer = runTimeout(() => setComboFx(null), 900);
    return () => window.clearTimeout(timer);
  }, [comboFx]);

  // タイトル画面へ戻す。BGMは status が ready になった時点で止まる。
  const backToTitle = useCallback(() => {
    storyRunRef.current += 1;
    mapRun.current = false;
    mapStageRef.current = null;
    setMapStage(null);
    setStory(null);
    storyRef.current = null;
    demoLock.current = false;
    spawnHold.current = false;
    setClearFireworks(false);
    setTapHint(null);
    storyDiceBias = false;
    storyBoostValues = [];
    storyNicoRate = 0;
    storyLinesOn = false;
    resetGame('ready');
    if (enemyPractice) {
      if (window.parent !== window) window.parent.postMessage({ type: 'sainome-practice-exit' }, location.origin);
      else location.assign('/enemies.html');
    }
    stopBgm();
    // タイトルの曲は上の useEffect が status を見て鳴らし直す
    stopFeverBgm();
  }, [resetGame]);

  // 音源はタイトルを出している間に取りに行かせる。
  // 開始ボタンを押してから読み込むと、出だしのひと呼吸が無音になる。
  useEffect(() => {
    getTitleBgm().load();
    getMapBgm().load();
    getBgm().load();
    getFeverBgm().load();
  }, []);

  // マップ画面を開いているか（マップの曲に切り替える）
  const mapShown = status === 'ready' && showStages && storyLayout === 'map';
  // BGMはゲームの状態に追従させる。
  // フィーバー中は本編のBGMを止めて、専用の曲に差し替える。
  useEffect(() => {
    // タイトルにいるあいだは専用の曲。それ以外では止める。
    if (status === 'ready' && soundMode === 'all') {
      pauseBgm();
      stopFeverBgm();
      // マップを開いているあいだはマップの曲。タイトルの曲はフェードアウトし、マップの曲をフェードインする
      if (mapShown) {
        switchToMapBgm();
        return;
      }
      // 起動時のサイコロの画面ではまだ鳴らさない。目が止まった瞬間に鳴らし始める。
      // マップから戻ったときは、マップの曲をフェードアウトしてタイトルの曲をフェードインする
      if (titleRoll !== null) {
        switchToTitleBgm();
      } else {
        mapBgmOn = false;
        stopMapBgm();
      }
      return;
    }
    mapBgmOn = false;
    stopTitleBgm();
    stopMapBgm();
    if (soundMode !== 'all' || status === 'ready') {
      pauseBgm();
      stopFeverBgm();
      return;
    }
    if (status === 'paused') {
      pauseBgm();
      stopFeverBgm();
      return;
    }
    if (status === 'gameover' || status === 'cleared') {
      stopBgm();
      stopFeverBgm();
      return;
    }
    if (feverActive) {
      pauseBgm();
      return;
    }
    stopFeverBgm();
    playBgm();
  }, [feverActive, soundMode, status, titleRoll, mapShown]);

  // フィーバーに入った瞬間に専用BGMを流す。
  // 上のBGM側と分けているのは、status が変わるたびに曲が頭から
  // 鳴り直してしまうのを避けるため。
  useEffect(() => {
    if (!feverActive || soundMode !== 'all') {
      return;
    }
    playFeverBgm();
    return () => stopFeverBgm();
  }, [feverActive, soundMode]);

  // ページを開いた直後は、まだ一度も操作していないので play() が弾かれる。
  // ブラウザの自動再生制限は「最初のユーザー操作」で解けるので、
  // タイトルにいるあいだの最初の操作を拾って、そこで鳴らし直す。
  // 言語の切り替えでも、絵を触っただけでも解ける。
  //
  // 拾うイベントが肝心。iPhone（WebKit）は、指で触れた瞬間の pointerdown を
  // 「ユーザー操作」とみなさず、指を離した touchend と click でしか解かない。
  // 以前は pointerdown だけを見ていたので、パソコンのマウスでは鳴るのに
  // iPhone では鳴らず、音ボタン（＝click）を一周させたときだけ鳴っていた。
  // いまは音ボタンを押したときと同じ種類のイベントで、見えないところで解く。
  useEffect(() => {
    if (status !== 'ready' || soundMode !== 'all') {
      return;
    }
    const kick = (event: Event) => {
      // 起動時のサイコロの画面では何もしない。鍵開けはサイコロのタップ（目が決まった後）で行う。
      // ここで先に鍵を開けると、まだ目が決まる前の曲を無音で鳴らし始めてしまい、
      // 目が決まって曲を差し替えたときに、前の曲が一瞬漏れることがあった
      if (titleRollRef.current === null) {
        return;
      }
      unlockAudio();
      // 最初の操作がスタートボタンなら、タイトル曲は鳴らさない。
      // ボタンの処理でゲームが始まるので、ここで鳴らすと本編の曲と一瞬重なる。
      // state はこのイベントの中ではまだ 'ready' のままなので、押された場所で見分ける。
      const target = event.target as Element | null;
      if (target?.closest?.('.title-start')) {
        return;
      }
      // マップを開いた操作（ストーリーモードのボタンなど）では、タイトル曲を鳴らし直さない。
      // ここで鳴らすと、止めたばかりのタイトル曲がマップの曲と重なってしまう（2026-10-13 修正）
      if (mapBgmOn) {
        return;
      }
      if (getTitleBgm().paused) {
        playTitleBgm();
      }
    };
    const events = ['touchend', 'click', 'pointerup', 'keydown'] as const;
    events.forEach((name) => window.addEventListener(name, kick, { passive: true }));
    return () => {
      events.forEach((name) => window.removeEventListener(name, kick));
    };
  }, [soundMode, status]);

  // 「使う？」のあいだ、1秒ごとに刻む。残り時間を耳でも分かるようにする。
  useEffect(() => {
    if (!rainbowAsk || soundMode === 'none') {
      return;
    }
    let step = 0;
    playRainbowTickSound(step);
    const timer = window.setInterval(() => {
      step += 2;
      playRainbowTickSound(step);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [rainbowAsk, soundMode]);

  // 危険領域に届いた瞬間だけ、サイカが焦る。
  // 入りっぱなしのあいだ鳴り続けないよう、入った/出たの切り替わりで判定する。
  const wasDanger = useRef(false);
  useEffect(() => {
    if (status !== 'playing') {
      return;
    }
    const danger = isDangerBoard(board);
    // ストーリーでは出さない。始めから積み上がっているメンが多く、
    // 「よかった もどれた」「ニコニコメ 来てよぉ」などが段取りのセリフに割り込んで意味がつながらない
    if (storyLinesOn) {
      wasDanger.current = danger;
      return;
    }
    if (danger && !wasDanger.current) {
      setSaika({ text: pickFrom(SAIKA_WORRY_LINES[langRef.current]), mood: 'worry' });
      runTimeout(() => {
        setSaika((value) =>
          value.mood === 'worry'
            ? { text: pickFrom(idleLines(langRef.current, feverActiveRef.current)), mood: 'idle' }
            : value,
        );
      }, SAIKA_WORRY_MS);
    } else if (!danger && wasDanger.current) {
      // 危険領域から抜けた。焦りっぱなしで終わらせず、安堵を挟む
      setSaika({ text: pickFrom(SAIKA_RELIEF_LINES[langRef.current]), mood: 'relief' });
      runTimeout(() => {
        setSaika((value) =>
          value.mood === 'relief'
            ? { text: pickFrom(idleLines(langRef.current, feverActiveRef.current)), mood: 'idle' }
            : value,
        );
      }, SAIKA_BEAT_MS);
    }
    wasDanger.current = danger;
  }, [board, status]);

  // 手が空いているときだけ、サイカのセリフを一定間隔で入れ替える。
  // 技名や連鎖を出している最中に上書きしないよう mood を見て判断する。
  useEffect(() => {
    if (status !== 'playing') {
      return;
    }
    const timer = window.setInterval(() => {
      setSaika((value) =>
        value.mood === 'idle'
          ? { text: pickFrom(idleLines(langRef.current, feverActiveRef.current)), mood: 'idle' }
          : value,
      );
    }, SAIKA_IDLE_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [status]);

  // 連鎖のセリフは、次の操作が始まったら通常のセリフに戻す
  useEffect(() => {
    if (status !== 'playing') {
      return;
    }
    setSaika((value) =>
      value.mood === 'chain'
        ? { text: pickFrom(idleLines(langRef.current, feverActiveRef.current)), mood: 'idle' }
        : value,
    );
  }, [current.id, status]);

  // ゲージが満タンになったらフィーバー発動。
  // ただし出だしに点火の演出を挟む。粒が散ってフラッシュが抜けきってから、
  // 地の色ごと明るいほうへ入れ替わる。
  useEffect(() => {
    if (feverActive || feverIgniting || fever < 100) {
      return;
    }
    setFeverIgniting(true);
    // 「テューン！」。駆け上がりを点火の長さに合わせ、フィーバーが始まる瞬間に着地させる
    if (soundModeRef.current !== 'none') {
      playFeverZoneSound(FEVER_IGNITE_MS / 1000);
    }
  }, [fever, feverActive, feverIgniting]);

  // 点火が出ているあいだだけタイマーを張る。
  // 上の効果と分けているのは、同じ効果の中で立てると
  // feverIgniting が変わった時点で後片付けが走り、張ったタイマーが
  // その場で消えてしまうため。
  useEffect(() => {
    if (!feverIgniting) {
      return;
    }
    const timer = runTimeout(() => {
      setFeverIgniting(false);
      setFeverActive(true);
    }, FEVER_IGNITE_MS);
    return () => window.clearTimeout(timer);
  }, [feverIgniting]);

  // フィーバー中だけ地の色を明るいほうへ入れ替える。
  // html に付けるのは、はみ出した部分にも同じ地を敷くため。
  // 点火の頭から切り替える。粒が外へ広がるのと同じ間に、
  // CSS 側の補間で地の色が明るくなっていく。
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('is-fever-theme', feverActive || feverIgniting);
  }, [feverActive, feverIgniting]);

  // アンマウント時だけ外す。上の効果に後片付けを書くと、
  // 点火→本番の切り替えのたびにクラスが一瞬外れて、色の補間が巻き戻る。
  useEffect(() => () => document.documentElement.classList.remove('is-fever-theme'), []);

  // フィーバー中はゲージが時間で減り、0になったら終了
  useEffect(() => {
    if (!feverActive) {
      return;
    }

    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const remaining = 1 - (performance.now() - startedAt) / FEVER_DURATION_MS;
      if (remaining <= 0) {
        window.clearInterval(timer);
        setFever(0);
        setFeverActive(false);
      } else {
        setFever(Math.round(remaining * 100));
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [feverActive]);

  // 落下タイマーは常に最新の move を参照する。
  // move 自体を依存に入れると、移動や回転のたびにタイマーが張り直されて落下が止まってしまう。
  const moveRef = useRef(move);
  moveRef.current = move;
  // 直前に自然落下が1段進んだ時刻。次の1段がいつ来るかを読むのに使う
  const lastFallAt = useRef(0);
  // サイカの救援のセリフのあいだは、お手本のブロックを自然落下させない
  const fallFrozen = useRef(false);

  useEffect(() => {
    if (status !== 'playing') {
      return;
    }

    // 張り直した直後の1段目は speed ぶん先なので、ここを起点にしておく
    lastFallAt.current = performance.now();
    let planned = lastFallAt.current + speed;
    const timer = window.setInterval(() => {
      const now = performance.now();
      triggerLate.current = Math.max(0, now - planned);
      // 大きく詰まったあとは予定を今に合わせ直す。遅れを次の刻みへ持ち越さない
      planned = now - planned > speed ? now + speed : planned + speed;
      lastFallAt.current = now;
      if (fallFrozen.current) return;
      moveRef.current(0, 1, true);
    }, speed);

    return () => window.clearInterval(timer);
  }, [speed, status]);

  // 設置音の先回り。
  // 自然落下で着地するときは、次の1段がいつ来るかが分かっている。
  // そこで「あと1段で着地する」位置に来たら、着地の100ms前に鳴らしておく。
  // iPhone は音が出るまでにそれくらい掛かるので、先に出すと絵とそろって聞こえる。
  //
  // 横へずらす・回す・下に送るなど、位置が変わればこの予約は取り消して
  // 新しい位置で計算し直す（effect の後片付けで消える）。着地したあとに
  // 横へ滑らせられる仕様には触れていない。鳴らす時刻を前へずらしただけ。
  // 指で下へ送って着地させた場合は、操作そのものが着地の合図なので先回りできない。
  // そのときはこれまでどおり着地の瞬間に鳴る。
  useEffect(() => {
    if (status !== 'playing' || soundMode === 'none') {
      return;
    }
    const landed = { ...current, y: current.y + 1 };
    // あと1段で着地する位置にいるときだけ予約する
    if (!canPlace(board, landed) || canPlace(board, { ...current, y: current.y + 2 })) {
      return;
    }
    if (lockSoundPiece.current === current.id) {
      return;
    }
    const nextFallAt = lastFallAt.current + speed;
    const wait = Math.max(0, nextFallAt - LOCK_SOUND_LEAD_MS - performance.now());
    const fireAt = performance.now() + wait;
    const timer = runTimeout(() => {
      // 待っているあいだに鳴らされていたら二重にしない
      if (lockSoundPiece.current === current.id) {
        return;
      }
      lockSoundPiece.current = current.id;
      triggerLate.current = Math.max(0, performance.now() - fireAt);
      // 着地の絵は、次の落下の刻みから LANDING_PAINT_LAG_MS ほど遅れて出る
      playTouchdownSound(
        board,
        landed,
        nextFallAt + LANDING_PAINT_LAG_MS - performance.now(),
      );
    }, wait);
    return () => window.clearTimeout(timer);
  }, [board, current, playTouchdownSound, soundMode, speed, status]);

  // スマホのスワイプ操作。
  // 盤面をなぞると1マスずつ移動し、指を離した時のスピードでフリックを判定する。
  //   横になぞる … 1マスずつ左右移動 / 素早く横フリック … その方向の端まで
  //   下になぞる … 1マスずつ落下     / 素早く下フリック … 一気に落下
  //   タップ     … 右回転
  const touchState = useRef<{
    id: number;
    startX: number;
    startY: number;
    startTime: number;
    axis: 'x' | 'y' | null; // 最初に大きく動いた向きに固定する
    appliedX: number; // これまでに適用した左右の移動量（マス）
    appliedY: number; // 同じく落下量（マス）
    pieceId: number; // 操作を始めた時点のブロック
    suppressTap?: boolean; // なぞりから通常操作へ戻った直後は回転させない
  } | null>(null);
  const boardRef = useRef<HTMLElement | null>(null);

  // 落下操作は「1回の操作につき、そのとき落ちていたブロック1つだけ」に効かせる。
  // 押しっぱなしのまま次のブロックが出てきても、指やキーを離すまでは効かない。
  const currentIdRef = useRef(current.id);
  currentIdRef.current = current.id;
  const dropOwner = useRef<number | null>(null);

  // 落下中のサイの中心の画面上のx座標。タップがこれより左なら左回り
  const pieceCenterX = () => {
    const grid = boardRef.current?.querySelector('.board-grid');
    if (!grid) return window.innerWidth / 2;
    const rect = grid.getBoundingClientRect();
    const cells = getPieceCells(current);
    if (cells.length === 0) return window.innerWidth / 2;
    const cellW = rect.width / COLS;
    const mean = cells.reduce((sum, cell) => sum + cell.x, 0) / cells.length;
    return rect.left + (mean + 0.5) * cellW;
  };

  const canDrop = useCallback((pieceId: number) => pieceId === currentIdRef.current, []);

  // マスの一辺を整数ピクセルに丸めて --cell-size に流し込む。
  // grid を 1fr で等分割すると、盤面幅が小数のとき列ごとに端数の丸め方が変わり、
  // 落下中にマスの隙間が不揃いにガタついて見える。整数で固定すればズレない。
  useEffect(() => {
    const board = boardRef.current;
    if (!board) {
      return;
    }

    const apply = () => {
      // 盤面パネルの内寸から、マス間のすきま6本ぶんを引いて7で割る
      const inner = board.clientWidth - BOARD_PADDING * 2 - CELL_GAP * (COLS - 1);
      const size = Math.max(16, Math.floor(inner / COLS));
      board.style.setProperty('--cell-size', `${size}px`);
      setCellPx(size);
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(board);
    return () => observer.disconnect();
  }, []);

  // 開発時のみ、盤面を直接組み立てられるようにする。
  // ボムやニコニコの演出は狙って出すのが難しいので、確認用の入口を用意しておく。
  // import.meta.env.DEV は本番ビルドで false になり、このブロックごと除去される。
  if (import.meta.env.DEV) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      (window as unknown as { __sainomeDebug?: unknown }).__sainomeDebug = {
        // 今の盤面を残したまま、指定のマスだけ置く（大きな敵の確認用）
        addCells: (cells: [number, number, number][]) => {
          setBoard((prev) => {
            const next = cloneBoard(prev);
            cells.forEach(([x, y, value], index) => {
              next[y][x] = { id: `dbg-add-${Date.now()}-${index}`, value, group: 2000 + index };
            });
            return next;
          });
        },
        // 今の盤面で、支えがなくて落ちるはずの塊が残っていないか（浮いたサイの確認用）
        peekFloating: () =>
          new Promise((resolve) => {
            setBoard((prev) => {
              resolve(stepGravity(prev).moved);
              return prev;
            });
          }),
        // アンチクショウメの今の状態（目の位置など）
        peekAnchi: () => anchiRef.current,
        // 今の盤面の目の数（敵は負の値、空は0）を返す
        peekBoard: () =>
          new Promise((resolve) => {
            setBoard((prev) => {
              resolve(prev.map((row) => row.map((cell) => cell?.value ?? 0)));
              return prev;
            });
          }),
        setBoard: (cells: [number, number, number][]) => {
          const next = emptyBoard();
          cells.forEach(([x, y, value], index) => {
            next[y][x] = { id: `dbg-${index}`, value, group: 1000 + index };
          });
          setBoard(next);
        },
        setFever: (value: number) => setFever(value),
        // 確認用：スコアを直接入れる（MISSION の桁の表示など）
        setScore: (value: number) => setScore(value),
        setSingle: (value: number, x: number) => {
          pieceId.current += 1;
          setCurrent(makeSinglePiece(pieceId.current, value, x));
        },
        startStage: (value: number) => startStage(value),
        // 19メン：ヒドイメを倒したことにして、次の1手でラスト（ベラボウメとデタラメ）を呼ぶ
        allstarSkip: () => {
          allstarPhase.current = 1;
          hidoimeDefeated.current = 1;
        },
        // メンのクリア演出だけを確かめる
        forceClear: () => completeStage(storyRef.current ?? 0, scoreRef.current),
        // レベルを直接指定する（落下の速さの確認用）
        setLevel: (value: number) => {
          setLevelScore((value - 1) * 5000);
          setLevel(value);
        },
        // レベルの元になる得点。セヴン消しの分だけが積まれているか確認する用
        read: () => ({ score: scoreRef.current, levelScore: levelScoreRef.current, board, story,
          status, wallCounts: wallCounts.current, bombPhase: bombLesson.current.phase,
          bombSuccess: bombLesson.current.success, demoLocked: demoLock.current,
          wallProgress: wallProgressRef.current, mapStage: mapStageRef.current,
          powers: mapPowers(), missionNow, missionGoal,
          wallAbilities: ['spa1','sla3','squ4','str6'].filter(kind => story !== null && storyAllows(story, kind as BombKind, mapPowers())),
        }),
      };
    });
  }

  // ゲーム中はページを固定する。スクロールでアドレスバーが伸縮すると
  // 表示領域が変わって盤面が動いてしまうため、遊んでいる間は動かさない
  useEffect(() => {
    document.body.classList.toggle('is-locked', status === 'playing');
    return () => document.body.classList.remove('is-locked');
  }, [status]);

  // 列と列の間隔（マスの一辺 + すきま）。指の移動量をマス数に換算するのに使う
  const stepSize = useCallback(() => {
    const board = boardRef.current;
    if (!board) {
      return 40;
    }
    const size = Number.parseFloat(board.style.getPropertyValue('--cell-size'));
    return Number.isFinite(size) && size > 0 ? size + CELL_GAP : board.clientWidth / COLS;
  }, []);

  const you456Gesture = useYou456Gesture({
    set: you456Set, board, run: storyRunRef.current, status, boardRef,
    canStart: () => !thunderTrace.current && !touchState.current,
    fire: () => { void fireYou456Ref.current(); },
  });
  // イチニノサンダー：1→2→3の順を、1本の指で離さずになぞる。
  // 途中で離した・中断された操作を、回転やフリックへ流用しない。
  const thunderTrace = useRef<ThunderTrace | null>(null);
  const [thunderTrail, setThunderTrail] = useState<readonly ThunderTracePoint[]>([]);
  const clearThunderTrace = useCallback(() => {
    thunderTrace.current = null;
    setThunderTrail([]);
  }, []);
  const releaseBoardPointer = useCallback((id: number) => {
    const board = boardRef.current;
    if (board?.hasPointerCapture(id)) board.releasePointerCapture(id);
  }, []);
  const cancelBoardPointer = useCallback((id: number) => {
    if (thunderTrace.current?.id === id) clearThunderTrace();
    if (touchState.current?.id === id) touchState.current = null;
    releaseBoardPointer(id);
  }, [clearThunderTrace, releaseBoardPointer]);
  const thunderTraceEpochNow = useCallback(() => `${storyRunRef.current}:${
    (thunderSetRef.current ?? []).map(({ x, y }) => `${x},${y}:${boardNow.current[y]?.[x]?.id ?? ''}`).join('|')
  }`, []);
  const thunderTraceEpoch = thunderTraceEpochNow();
  useLayoutEffect(() => {
    const trace = thunderTrace.current;
    if (trace && (status !== 'playing' || trace.epoch !== thunderTraceEpoch)) cancelBoardPointer(trace.id);
    if (status !== 'playing' && touchState.current) cancelBoardPointer(touchState.current.id);
  }, [status, thunderTraceEpoch, cancelBoardPointer]);
  useEffect(() => () => {
    thunderTrace.current = null;
    touchState.current = null;
  }, []);
  const tracePointAt = useCallback((clientX: number, clientY: number): ThunderTracePoint | null => {
    // Use the actual first cell, not the padded/rounded board wrapper.
    const rect = boardRef.current?.querySelector('[data-cell="0,0"]')?.getBoundingClientRect();
    return rect && rect.width > 0 && rect.height > 0
      ? { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height }
      : null;
  }, []);
  const cellKeyAt = (point: ThunderTracePoint) => (
    point.x >= 0 && point.y >= 0 && point.x < COLS && point.y < ROWS
      ? `${Math.floor(point.x)},${Math.floor(point.y)}` : null
  );
  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (statusNow.current !== 'playing' || event.isPrimary === false || event.button !== 0) return;
      if (thunderTrace.current || touchState.current) return;
      const set = thunderSetRef.current;
      const point = tracePointAt(event.clientX, event.clientY);
      const keys = set?.map(({ x, y }) => `${x},${y}`) as [string, string, string] | undefined;
      const trace = point ? startThunderTrace(event.pointerId, thunderTraceEpochNow(), keys ?? null, cellKeyAt(point), point) : null;
      if (trace) {
        thunderTrace.current = trace;
        setThunderTrail(trace.points);
        event.currentTarget.setPointerCapture(event.pointerId);
        if (soundModeRef.current !== 'none') playThunderTraceSound(0);
        return;
      }
      if (event.pointerType === 'mouse') return;
      touchState.current = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTime: performance.now(),
        axis: null,
        appliedX: 0,
        appliedY: 0,
        pieceId: currentIdRef.current,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [thunderTraceEpochNow, tracePointAt],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (statusNow.current !== 'playing') { cancelBoardPointer(event.pointerId); return; }
      const trace = thunderTrace.current;
      if (trace && trace.id === event.pointerId) {
        if (trace.epoch !== thunderTraceEpochNow()) { cancelBoardPointer(event.pointerId); return; }
        const point = tracePointAt(event.clientX, event.clientY);
        const key = point ? cellKeyAt(point) : null;
        const result = moveThunderTrace(trace, thunderTraceEpochNow(), key, point ?? trace.points[trace.points.length - 1]);
        if (result.tone !== null && soundModeRef.current !== 'none') playThunderTraceSound(result.tone);
        if (result.result === 'complete') {
          cancelBoardPointer(event.pointerId);
          void fireThunderRef.current();
          return;
        }
        if (result.trace) {
          thunderTrace.current = result.trace;
          setThunderTrail(result.trace.points);
          return; // なぞっているあいだはブロックを動かさない
        }
        if (key && trace.keys.includes(key)) {
          // 光ったサイ内で順番を飛ばす・戻る操作は失敗として終了する。
          // 同じ指の残りの動きが落下操作へ化けないよう、次の押下まで待つ。
          cancelBoardPointer(event.pointerId);
          return;
        }
        clearThunderTrace();
        // 光った順路を外れた位置を新しい起点にする。なぞった距離では
        // ブロックを動かさず、その後の指の動きから通常操作へ戻す。
        touchState.current = event.pointerType === 'mouse' ? null : {
          id: event.pointerId,
          startX: event.clientX, startY: event.clientY, startTime: performance.now(),
          axis: null, appliedX: 0, appliedY: 0, pieceId: currentIdRef.current,
          suppressTap: true,
        };
        return;
      }
      triggerLate.current = Math.max(0, performance.now() - event.timeStamp);
      const state = touchState.current;
      if (!state || state.id !== event.pointerId) {
        return;
      }

      const step = stepSize();
      // 指を置いた場所からの総移動量で見る。1回ごとの差分を足し込むと
      // 端数が積もって指の位置とブロックがずれていくため。
      const totalX = event.clientX - state.startX;
      const totalY = event.clientY - state.startY;

      // 最初に大きく動いた向きへ操作を固定する。
      // 毎回どちらが大きいか見比べると、横に払っているつもりの縦揺れを
      // 落下として拾ってしまい、横移動の精度が落ちる。
      if (state.axis === null) {
        if (Math.max(Math.abs(totalX), Math.abs(totalY)) < AXIS_LOCK_PX) {
          return;
        }
        state.axis = Math.abs(totalX) >= Math.abs(totalY) ? 'x' : 'y';
      }

      if (state.axis === 'x') {
        // 指の位置に対応する列へ動かす。壁で詰まっても適用済みの量は進めるので、
        // 指を戻せばブロックもきちんと戻ってくる。
        const want = Math.round(totalX / step);
        const diff = want - state.appliedX;
        const dir = Math.sign(diff);
        for (let i = 0; i < Math.abs(diff); i += 1) {
          move(dir, 0);
        }
        state.appliedX = want;
        return;
      }

      if (!canDrop(state.pieceId)) {
        return;
      }

      // 上へなぞっている間は落とさない。離した時にフリックとして判定する
      const want = Math.max(0, Math.floor(totalY / step));
      for (let i = state.appliedY; i < want; i += 1) {
        if (!canDrop(state.pieceId)) {
          break;
        }
        move(0, 1);
      }
      state.appliedY = Math.max(state.appliedY, want);
    },
    [canDrop, move, stepSize, cancelBoardPointer, clearThunderTrace, thunderTraceEpochNow, tracePointAt],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (statusNow.current !== 'playing') { cancelBoardPointer(event.pointerId); return; }
      // 1だけでも2まででも、離したら白線と進捗を捨て、次は1から。
      if (thunderTrace.current?.id === event.pointerId) {
        cancelBoardPointer(event.pointerId);
        return;
      }
      triggerLate.current = Math.max(0, performance.now() - event.timeStamp);
      const state = touchState.current;
      if (!state || state.id !== event.pointerId) {
        return;
      }
      touchState.current = null;
      releaseBoardPointer(event.pointerId);
      if (state.suppressTap && state.axis === null) return;

      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;
      const elapsed = performance.now() - state.startTime;
      const distance = Math.hypot(dx, dy);

      if (state.axis === null && distance < TAP_MAX_MOVE_PX && elapsed < TAP_MAX_MS) {
        // 画面の左半分なら左回り、右半分なら右回り
        rotate(event.clientX < pieceCenterX() ? 'ccw' : 'cw');
        return;
      }

      if (elapsed < FLICK_MAX_MS && distance >= FLICK_MIN_PX) {
        if (state.axis === 'y') {
          // 上下どちらのフリックでも即時落下。
          // 上は「弾いて落とす」感覚、下は指の動きどおりに落とす感覚。
          if (canDrop(state.pieceId)) {
            hardDrop();
          }
        } else {
          moveToEdge(dx > 0 ? 1 : -1);
        }
      }
    },
    [canDrop, hardDrop, moveToEdge, rotate, cancelBoardPointer, releaseBoardPointer],
  );

  const onPointerCancel = useCallback((event: React.PointerEvent<HTMLElement>) => {
    // OS interruption / lost capture never commits a tap or a flick.
    cancelBoardPointer(event.pointerId);
  }, [cancelBoardPointer]);

  const lastTap = useRef({ dir: 0, time: 0 });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      triggerLate.current = Math.max(0, performance.now() - event.timeStamp);
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const dir = event.key === 'ArrowLeft' ? -1 : 1;

        // キーリピートは連続移動として扱い、端まで移動の判定に使わない
        if (event.repeat) {
          move(dir, 0);
          return;
        }

        const now = performance.now();
        if (lastTap.current.dir === dir && now - lastTap.current.time < DOUBLE_TAP_MS) {
          moveToEdge(dir);
          lastTap.current = { dir: 0, time: 0 };
        } else {
          move(dir, 0);
          lastTap.current = { dir, time: now };
        }
        return;
      }

      // ↓と↑は「押している間ずっと」ではなく「1回の押下につきブロック1つ」に効かせる。
      // 押しっぱなしのまま次のブロックが出てきても、キーを離すまでは効かない。
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (dropOwner.current === null) {
          dropOwner.current = current.id;
        }
        if (dropOwner.current !== current.id) {
          return;
        }
        if (event.key === 'ArrowDown') {
          move(0, 1);
        } else {
          hardDrop();
        }
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        rotate();
      }
      // イチニノサンダー（光っているとき）。キーボードでは T で発動
      if (event.key.toLowerCase() === 't') {
        void fireThunderRef.current();
        return;
      }
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        rotate('ccw');
      }
      if (event.key.toLowerCase() === 'p') {
        event.preventDefault();
        togglePause();
      }
      if (event.key === 'Enter' && status !== 'playing') {
        event.preventDefault();
        if (status === 'paused') {
          resume();
        } else if (enemyPractice) {
          playAgain();
        } else {
          restart();
        }
      }
    };

    // キーを離した時点で落下操作の権利を手放す。
    // 次に押し直すまで、新しいブロックには効かない。
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        dropOwner.current = null;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [current.id, hardDrop, move, moveToEdge, restart, playAgain, resume, rotate, status]);

  const reviewStarted = useRef(false);
  useEffect(() => {
    if (reviewStarted.current || !['localhost', '127.0.0.1', 's7-review.vercel.app'].includes(location.hostname)) return;
    if (enemyPractice) {
      reviewStarted.current = true;
      setTitleRoll(1); setShowStages(false); startStage(enemyPractice.stage);
      return;
    }
    const screen = new URLSearchParams(location.search).get('review');
    if (screen !== 'story' && screen !== 'score') return;
    reviewStarted.current = true;
    setTitleRoll(1);
    setShowStages(false);
    if (screen === 'story') {
      const requested = Number(new URLSearchParams(location.search).get('stage') ?? 20);
      const target = CAMPAIGN_MISSIONS.find(m => m.stage === requested)?.stage ?? 20;
      // 前提面の習得状態をメモリー内だけで用意。確認後に通常進捗へ保存しない。
      wallProgressRef.current = { ...wallProgressRef.current, cleared: CAMPAIGN_MISSIONS.filter(m => m.stage < target).map(m => m.stage) };
      startStage(target);
    } else startEndless();
  }, [startStage, startEndless]);

  return (
    <main
      className={`game-shell ${story !== null && !enemyPractice ? 'has-mission-banner' : ''} ${freezing ? 'is-freezing' : ''} ${story !== null ? 'is-story' : ''} ${story !== null && feverOpenIn(story, mapPowers()) ? 'is-fever-open' : ''} ${story !== null && wallMission(mapStage)?.ura ? 'is-ura' : ''}`}
      data-status={status}
      ref={shellRef}
    >
      {/* フィーバー中だけ、盤面の外側に7色の円を散らす。
          盤面そのものには掛けたくないので、下に敷いて盤面側を前に出している。 */}
      {feverActive ? <FeverSparks sparks={feverSparks} /> : null}
      {feverIgniting ? (
        <div aria-hidden className="fever-ignite">
          <div className="fever-ignite-sparks">
            {feverIgniteSparks.map((spark, index) => (
              <span
                key={index}
                style={
                  {
                    '--sx': `${spark.x}%`,
                    '--sy': `${spark.y}%`,
                    '--fx': `${spark.fx}vw`,
                    '--fy': `${spark.fy}vh`,
                    '--dx': `${spark.dx}vmin`,
                    '--dy': `${spark.dy}vmin`,
                    '--size': `${spark.size}px`,
                    '--delay': `${spark.delay}s`,
                    '--dur': `${spark.duration}s`,
                    '--color': spark.color,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        </div>
      ) : null}
      {rainbowSparksOn ? <RainbowSparks sparks={rainbowSparks} /> : null}
      <aside className="left-hud">
        <InfoPanel
          digits={SCORE_DIGITS}
          label={scoreFeverSwap ? <span className="fever-label">{feverGauge}</span> : 'SCORE'}
          millions={scoreMillions}
          value={scoreLower}
        />
        <InfoPanel digits={2} label="LV" value={level} />
        {story !== null ? (
          // ストーリーでは FEVER の代わりに、このメンのミッションの進み具合
          missionBox
        ) : (
          feverGauge
        )}
        <button
          className="icon-button"
          type="button"
          onClick={togglePause}
          aria-label={status === 'paused' ? text.resume : text.pause}
          title={text.pauseTitle}
        >
          {status === 'paused' ? '▶' : '❚❚'}
        </button>
        <button
          className="icon-button is-sound"
          type="button"
          onClick={toggleSound}
          aria-label={`${text.soundTitle}: ${SOUND_LABELS[lang][soundMode]}`}
          title={
            lang === 'ja'
              ? `${text.soundTitle}: ${SOUND_LABELS[lang][soundMode]}（${text.soundHint}）`
              : `${text.soundTitle}: ${SOUND_LABELS[lang][soundMode]} (${text.soundHint})`
          }
        >
          {SOUND_ICONS[soundMode]}
        </button>
      </aside>

      {enjoPractice&&<div className="enjo-live-tools"><button disabled={status!=='playing'} onClick={()=>setCurrent(makeSinglePiece(Date.now(),6,2))}>解除練習：6を用意</button><span>左の1の上に6を落とす → 各段を解除 → 炎をタップ。{enjoPracticeFever?'FEVER：盤外を除く23セル':'通常：16セル'}</span></div>}
      <section
        className={`board-panel ${feverActive ? 'is-fever' : ''}`}
        aria-label={text.boardLabel}
        onPointerCancel={event => { you456Gesture.cancel(event); onPointerCancel(event); }}
        onLostPointerCapture={event => { you456Gesture.cancel(event); onPointerCancel(event); }}
        onPointerDown={event => { if (!you456Gesture.down(event)) onPointerDown(event); }}
        onPointerMove={event => { if (!you456Gesture.move(event)) onPointerMove(event); }}
        onPointerUp={event => { if (!you456Gesture.up(event)) onPointerUp(event); }}
        ref={boardRef}
      >
        <div className={`board-grid ${sanzMode ? 'has-sanz' : ''}`}>
          {Array.from({ length: ROWS * COLS }, (_, index) => {
            const x = index % COLS;
            const y = Math.floor(index / COLS);
            const cell = mergedCells.get(`${x},${y}`);
            return (
              <div
                className={`board-cell ${cell?.hyoketsu?'hyoketsu-layer':''} ${grayCells.has(`${x},${y}`) ? 'is-gray' : ''} ${
                  monoCells.has(`${x},${y}`) ? 'is-mono' : ''
                } ${sanzMode && cell?.id.startsWith('sanz-eject-') ? 'sanz-ejected' : ''} ${demoBlink.has(`${x},${y}`) ? 'is-demo-blink' : ''} ${thunderKeys.has(`${x},${y}`) ? 'is-thunder' : ''} ${you456Keys.has(`${x},${y}`) ? 'is-you456' : ''}`}
                data-cell={`${x},${y}`}
                key={`${x}-${y}`}
                style={
                  monoCells.has(`${x},${y}`)
                    ? ({ '--mi': monoCells.get(`${x},${y}`) } as React.CSSProperties)
                    : undefined
                }
              >
                {!cell && guideCells.has(`${x},${y}`) ? (
                  <span
                    aria-hidden
                    className="cell-guide"
                    style={{ '--gi': guideCells.get(`${x},${y}`) } as React.CSSProperties}
                  />
                ) : null}
                {glowCells.has(`${x},${y}`) ? (
                  <CellGlow info={glowCells.get(`${x},${y}`) as GlowInfo} />
                ) : null}
                {cell?.hyoketsu ? <HyoketsumeDice paused={status==='paused'} detonating={hyoketsuBlasts.some(b=>b.x+1===x&&b.y+1===y)} cell={{value:3,kind:cell.hyoketsu==='frozen'?'ice':'bomb',fuse:cell.fuse}}/> : null}
                {cell && !cell.enjo && !cell.hyoketsu && cell.value !== HIDOIME && cell.value !== BERABOU && cell.value !== DETARAME && cell.value !== ANCHI ? (
                  <Die
                    blast={blastCells.has(`${x},${y}`)}
                    burst={burstCells.get(`${x},${y}`)?.dir}
                    rainbowBurst={burstCells.get(`${x},${y}`)?.rainbow}
                    scatterBurst={burstCells.get(`${x},${y}`)?.scatter}
                    pressed={pressCells.has(`${x},${y}`)}
                    fading={fadeCells.has(`${x},${y}`)}
                    spawning={spawnCells.has(`${x},${y}`)}
                    flung={flingCells.get(`${x},${y}`)}
                    absorb={
                      absorbCell?.key === `${x},${y}` ? absorbCell : absorbCells.get(`${x},${y}`)
                    }
                    mono={monoDice ? monoCells.get(`${x},${y}`) : undefined}
                    arming={armingCells.get(`${x},${y}`)}
                    charge={chargeCells.get(`${x},${y}`)}
                    hit={hitCells.has(`${x},${y}`)}
                    flashing={clearingCells.has(`${x},${y}`)}
                    group={cell.group}
                    value={cell.value}
                  />
                ) : null}
                {(burstCells.get(`${x},${y}`)?.particles.length ?? 0) > 0 ? (
                  <BurstRing particles={(burstCells.get(`${x},${y}`) as BurstInfo).particles} />
                ) : null}
                {pressBursts.has(`${x},${y}`) ? (
                  <BurstRing particles={pressBursts.get(`${x},${y}`) as BurstParticle[]} />
                ) : null}
                {rewriteCells.has(`${x},${y}`) ? (
                  // デタラメのビームで敵に変わるサイを包む波
                  <>
                    <i aria-hidden className={`detarame-wave is-${detarameViews[0]?.variant ?? 'blue'}`} />
                    <i aria-hidden className={`detarame-wave is-second is-${detarameViews[0]?.variant ?? 'blue'}`} />
                  </>
                ) : null}
              </div>
            );
          })}
          {/* 有効範囲の軌道。セルの nth-child で市松を塗っているので、
              セルより前に置くと偶奇がずれて市松が反転する。必ず最後の子にする */}
          {traces.length > 0 ? (
            <svg
              aria-hidden
              className="range-trace"
              preserveAspectRatio="none"
              viewBox={`0 0 ${COLS} ${ROWS}`}
            >
              {traces.map((set) =>
                set.paths.map((sketch, index) => (
                  <g
                    className={`trace ${set.fever ? 'is-fever' : ''} ${set.blink ? 'is-blink' : ''}`}
                    key={`${set.id}-${index}`}
                    style={
                      {
                        '--c': set.color,
                        '--delay': `${set.delay}ms`,
                        '--life': `${set.life}ms`,
                        '--draw': `${TRACE_DRAW_MS}ms`,
                      } as React.CSSProperties
                    }
                  >
                    {/* 外側のにじみ（太く薄い線を2段）→ 本線 → ずらした2本目 → 点々 → 先頭の光 */}
                    <path className="trace-glow trace-glow-wide" d={sketch.main} pathLength={1} />
                    <path className="trace-glow" d={sketch.main} pathLength={1} />
                    <path className="trace-line" d={sketch.main} pathLength={1} />
                    <path className="trace-echo" d={sketch.echo} pathLength={1} />
                    <path className="trace-dots" d={sketch.echo} pathLength={1} />
                    <path className="trace-head" d={sketch.main} pathLength={1} />
                  </g>
                )),
              )}
            </svg>
          ) : null}
          {/* ヒドイメ。2×2マスの上に重ねて描く（盤面のマスには何も描かない）。
              生きている間は盤面から位置を求め、倒れたあとは最後の位置で消える演出を見せる。
              市松がずれないよう、セルより後ろ（最後の子）に置く */}
          {[...hidoimeView.entries()].map(([group, item]) => {
            let pos: Position | null = item.dying || item.entering ? item.pos : null;
            if (!pos) {
              for (let y = 0; y < ROWS && !pos; y += 1) {
                for (let x = 0; x < COLS; x += 1) {
                  const cell = board[y][x];
                  if (cell && cell.value === HIDOIME && cell.group === group) {
                    pos = { x, y };
                    break;
                  }
                }
              }
            }
            if (!pos) return null;
            return (
              <div
                aria-hidden
                className={`hidoime-slot ${item.entering ? `is-entering is-${item.move ?? 'none'}` : ''} ${
                  hidoimeHit.has(group) ? 'is-hit' : ''
                }`}
                key={group}
                style={
                  { '--hx': pos.x, '--hy': pos.y, '--move-ms': `${item.moveMs ?? 0}ms` } as React.CSSProperties
                }
              >
                <Hidoime
                  hpPercent={(item.hp / HIDOIME_HP) * 100}
                  onDeathAnimationComplete={() =>
                    setHidoimeView((prev) => {
                      const next = new Map(prev);
                      next.delete(group);
                      return next;
                    })
                  }
                  paused={status === 'paused'}
                  seed={item.seed}
                  size={cellPx * 2}
                  variant={item.variant}
                />
              </div>
            );
          })}
          {enjoPractice&&(()=>{const parts=board.flatMap((row,y)=>row.flatMap((c,x)=>c?.enjo?[{c,x,y}]:[])).sort((a,b)=>a.c.enjo!.part-b.c.enjo!.part);const first=parts[0];return first?<button className="enjo-game-capsule" style={{left:first.x*cellPx,top:first.y*cellPx,width:cellPx,height:enjoRows*cellPx}} disabled={status!=='playing'||parts.some(p=>!p.c.enjo!.open)} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();armEnjo();}} aria-label="全段の壁を解除したエンジョーボムをタップ"><EnjomeBomb rows={enjoRows} breaking={enjoBreaking} wallMask={parts.map(p=>p.c.enjo!.open)} paused={status==='paused'}/></button>:null;})()}
          {enjoFlight&&<div className={'enjo-game-flight '+(enjoFlight.phase==='drop'?'is-dropping':'')} style={{left:enjoFlight.x*cellPx,width:cellPx,height:cellPx*2,'--enjo-floor':(ROWS-2)*cellPx+'px',animationPlayState:status==='paused'?'paused':'running'} as React.CSSProperties}><EnjomeBomb walls={0} paused={status==='paused'}/></div>}
          {enjoBlast!==null&&<div className="enjo-game-blast" style={{left:-cellPx,bottom:0,width:9*cellPx,height:9*cellPx}}><EnjoBlast range={enjoRange(enjoBlast)} paused={status==='paused'}/></div>}
          {hyoketsuBlasts.map((burst,i)=><div key={i} aria-hidden style={{position:'absolute',left:cellPx*burst.x,top:cellPx*burst.y,width:cellPx*3,height:cellPx*3,zIndex:160,pointerEvents:'none'}}><HyoketsuBurst cell={cellPx} flashCells={burst.flashCells} paused={status==='paused'}/></div>)}
          {/* ベラボウメ。3×3マスの上に重ねて描く（見た目は src/enemy/Beraboume.tsx）。
              目は BERABOU_EYE_ORDER の順に、HPが減るたびに1つずつ消える */}
          {(() => {
            if (!berabouView) return null;
            const pos = berabouView.dying || berabouView.entering ? berabouView.pos : findBerabou(board);
            if (!pos) return null;
            const lost = BERABOU_HP - berabouView.hp;
            return (
              <div
                aria-hidden
                className={`berabou-slot ${berabouView.entering ? 'is-entering' : ''} ${
                  berabouView.dying ? 'is-dying' : ''
                } ${berabouHit ? 'is-hit' : ''} ${berabouGuard ? 'is-guard' : ''} ${berabouRaging ? 'is-raging' : ''}`}
                style={{ '--hx': pos.x, '--hy': pos.y, animationPlayState: status === 'paused' ? 'paused' : 'running' } as React.CSSProperties}
              >
                <Beraboume
                  entering={berabouView.entering}
                  lost={new Set(BERABOU_EYE_ORDER.slice(0, lost))}
                  reopen={berabouView.reopen}
                  hit={berabouHit}
                  variant={berabouView.variant}
                />
                {berabouView.dying ? <SlimeBurst kind={berabouView.variant} paused={status === 'paused'} /> : null}
              </div>
            );
          })()}
          {/* アンチクショウメ。身体と目は Canvas で重ねて描く（盤面のマスには何も描かない） */}
          {sanzMode && anchiView ? <Sanzapparaname cells={board.flatMap((row,y)=>row.flatMap((cell,x)=>cell?.value===ANCHI?[{x,y}]:[]))} elapsed={sanzElapsed} charge={sanzElapsed>=0?sanzPeriod.current:anchiView.turn} hit={anchiHit} paused={status==='paused'}/> : null}
          {sanzMode && anchiView ? <SanzShots cells={board.flatMap((row,y)=>row.flatMap((cell,x)=>cell?.value===ANCHI?[{x,y}]:[]))} elapsed={sanzElapsed} shots={sanzShots}/> : null}
          {!sanzMode && anchiView && anchiDrawn ? (
            <div
              aria-hidden
              className={`anchi-slot ${anchiView.dying ? 'is-dying' : ''}`}
              style={{ '--hx': anchiDrawn.x, '--hy': anchiDrawn.y, width: anchiDrawn.w * cellPx, height: anchiDrawn.h * cellPx, animationPlayState: status === 'paused' ? 'paused' : 'running' } as React.CSSProperties}
            >
              <Anchikushoume cell={cellPx} eye={anchiView.eye} h={anchiDrawn.h} hit={anchiHit} hitTone={anchiHitTone} paused={status === 'paused'} w={anchiDrawn.w} />
              {anchiView.dying ? <SlimeBurst kind="paint" paused={status === 'paused'} /> : null}
            </div>
          ) : null}
          {/* アンチクショウメに当たったマスの白いダメージの光 */}
          {anchiFlash?.cells.map((point) => (
            <i aria-hidden className={`anchi-flash ${anchiHitTone === 'thunder' ? 'is-thunder' : ''}`} key={`${anchiFlash.id}-${point.x}-${point.y}`} style={{ '--px': point.x, '--py': point.y, animationPlayState: status === 'paused' ? 'paused' : 'running' } as React.CSSProperties} />
          ))}
          {/* アンチクショウメのペンキ。サイの上にかぶさって見えにくくする（数字は変わらない） */}
          {anchiPaints.map((paint) => (
            <div aria-hidden className={`anchi-paint is-${paint.phase}`} key={paint.id} style={{ '--px': paint.x, '--py': paint.y, '--launch-dx': paint.dx, '--launch-dy': paint.dy, animationPlayState: status === 'paused' ? 'paused' : 'running' } as React.CSSProperties}>
              <PaintSample cell={cellPx} paused={status === 'paused'} shape={paint.shape} />
            </div>
          ))}
          {status === 'playing' && you456Gesture.trail.length > 0 ? (
            <svg aria-hidden className="thunder-pointer-trail you456-pointer-trail" viewBox={`0 0 ${COLS} ${ROWS}`}>
              <polyline className="thunder-trail-edge" points={you456Gesture.trail.map(p => `${p.x},${p.y}`).join(' ')} />
              <polyline className="thunder-trail-white" points={you456Gesture.trail.map(p => `${p.x},${p.y}`).join(' ')} />
            </svg>
          ) : null}
          {you456Beam ? (
            <svg aria-hidden className="you456-lines" data-columns={you456Beam.columns.join(',')} data-rows={you456Beam.rows.join(',')} viewBox={`0 0 ${COLS} ${ROWS}`}>
              {you456Beam.columns.flatMap(x => [0, ROWS].map(y => (
                <g key={`column-${x}-${y}`}>
                  <line x1={x + .5} y1={you456Beam.used[0].y + .5} x2={x + .5} y2={y} pathLength="1" />
                  <line className="you456-core" x1={x + .5} y1={you456Beam.used[0].y + .5} x2={x + .5} y2={y} pathLength="1" />
                </g>
              )))}
              {you456Beam.rows.flatMap(y => [0, COLS].map(x => (
                <g key={`row-${y}-${x}`}>
                  <line x1={you456Beam.used[0].x + .5} y1={y + .5} x2={x} y2={y + .5} pathLength="1" />
                  <line className="you456-core" x1={you456Beam.used[0].x + .5} y1={y + .5} x2={x} y2={y + .5} pathLength="1" />
                </g>
              )))}
              <circle cx={you456Beam.used[0].x + .5} cy={you456Beam.used[0].y + .5} r=".18" />
            </svg>
          ) : null}
          {you456Call ? <div aria-hidden className="you456-call">456You!</div> : null}
          {/* 指の白い軌跡。サイや敵の上に置き、離す・中断するたびに消す。 */}
          {status === 'playing' && thunderTrail.length > 0 ? (
            <svg aria-hidden className="thunder-pointer-trail" viewBox={`0 0 ${COLS} ${ROWS}`}>
              <polyline className="thunder-trail-edge" points={thunderTrail.map(({ x, y }) => `${x},${y}`).join(' ')} />
              <polyline className="thunder-trail-white" points={thunderTrail.map(({ x, y }) => `${x},${y}`).join(' ')} />
              <circle cx={thunderTrail[thunderTrail.length - 1].x} cy={thunderTrail[thunderTrail.length - 1].y} r="0.10" />
            </svg>
          ) : null}
          {/* イチニノサンダー：「サン」の右へ「ダー！」を同じ行に足す。 */}
          {thunderBolt?.map((x) => (
            <div aria-hidden className={`thunder-bolt ${thunderBolt.length > 3 ? 'is-fever' : ''}`} key={x} style={{ '--tx': x, '--tw': 1 } as React.CSSProperties}>
              <i />
            </div>
          ))}
          {thunderCall ? (
            // 「サンダー！」は一気に出す。「！」は稲妻の形の絵（⚡）にする
            thunderCall === 'サンダー！' || thunderCall === 'THUNDER!' ? (
              <div aria-hidden className="thunder-call is-thunder" key="thunder">
                {thunderCall.slice(0, -1)}
                <svg className="thunder-call-bang" viewBox="0 0 40 100">
                  {/* 「！」の上の棒を稲妻に。下の点はそのまま */}
                  <path d="M25 1 L4 44 L17 44 L9 74 L35 29 L22 29 L31 1 Z" />
                  <circle cx="17" cy="90" r="8" />
                </svg>
              </div>
            ) : (
              <div aria-hidden className="thunder-call" key={thunderCall}>{thunderCall}</div>
            )
          ) : null}
          {/* デタラメ。1列ぶんの身体と目を重ねて描く（盤面のマスには何も描かない） */}
          {detarameViews.map((d) => (
            <div
              aria-hidden
              className={`detarame-slot ${d.entering ? 'is-entering' : ''}`}
              key={d.id}
              style={{ '--hx': d.x, '--hy': d.top, '--rows': d.segs.length } as React.CSSProperties}
            >
              <Detarame
                absorbing={d.absorbing}
                born={d.born}
                dying={d.dying}
                firing={detarameFiring.get(d.id) ?? EMPTY_INDEXES}
                hit={detarameHit.get(d.id) ?? EMPTY_INDEXES}
                segments={d.segs}
                variant={d.variant}
              />
            </div>
          ))}
          {detarameBeams.map((beam, index) => (
            <i
              aria-hidden
              className={`detarame-beam is-${beam.variant ?? 'blue'} ${beam.retract ? 'is-retract' : ''}`}
              key={index}
              style={
                {
                  '--row': beam.row,
                  '--bx': Math.min(beam.from, beam.to),
                  '--bw': Math.abs(beam.to - beam.from),
                  '--origin': beam.dir < 0 ? 'right' : 'left',
                  '--hit-origin': beam.dir < 0 ? 'left' : 'right',
                } as React.CSSProperties
              }
            >
              <i className="detarame-beam-tip is-start" />
              <i className="detarame-beam-tip is-end" />
            </i>
          ))}
          {sfx ? (
            // 擬音。あとで画像にするときは、.sfx-<id> に背景画像を当てて文字を隠す
            <div
              aria-hidden
              className={`sfx-text sfx-${sfx.id}`}
              data-sfx={sfx.id}
              key={sfx.key}
              style={{ '--sx': sfx.x, '--sy': sfx.y } as React.CSSProperties}
            >
              {SFX[sfx.id][lang]}
            </div>
          ) : null}
        </div>
        {nicoCharge ? (
          <div
            aria-hidden
            className="nico-charge"
            style={{
              '--cx': `${nicoCharge.x}%`,
              '--cy': `${nicoCharge.y}%`,
              '--nico-charge-ms': `${NICO_CHARGE_MS}ms`,
            } as React.CSSProperties}
          >
            {/* 狙いの外側だけを、紫・白・黒の3色で叩く薄い幕。穴が狙いへ閉じていく。
                半透明なので、積み上がっている盤面は透けて見えたまま */}
            <span className="nico-veil nico-veil-purple" />
            <span className="nico-veil nico-veil-white" />
            <span className="nico-veil nico-veil-black" />
            {/* 2026-10-11：ひとりぼっちのニコニコメの範囲を示す白い枠はなくした（発光は残す） */}
            {/* 狙いの縁。最後にパッと締まる */}
            <span className="nico-charge-ring" />
            {/* 画面の外寄りから押し寄せる黒い粒 */}
            <span className="nico-swarm">
              {NICO_SWARM.map((dot, index) => (
                // 外側は向きだけを持つ止まった回転。中の粒が帯ごとの決まった動きで詰める
                <b key={index} style={{ transform: `rotate(${dot.angle}deg)` }}>
                  <i
                    className={`band-${dot.band}`}
                    style={
                      {
                        '--size': `${dot.size}px`,
                        animationDelay: `${dot.delay}s`,
                      } as React.CSSProperties
                    }
                  />
                </b>
              ))}
            </span>
          </div>
        ) : null}
        {rainbowAward > 0 ? (
          // 斜めに画面を横切る帯。文字は1字ずつ虹色が流れていく。
          // 1字ごとに span を切るのは、色の流れを遅延だけで作るため。
          <div
            aria-hidden
            className="rainbow-award"
            style={{ '--award-ms': `${RAINBOW_AWARD_MS}ms` } as React.CSSProperties}
          >
            <span className="rainbow-award-sparks">
              {RAINBOW_AWARD_SPARKS.map((spark, index) => (
                <i
                  key={index}
                  style={
                    {
                      left: `${spark.x}%`,
                      top: `${spark.y}%`,
                      '--size': `${spark.size}px`,
                      '--delay': `${spark.delay}s`,
                      '--color': spark.color,
                    } as React.CSSProperties
                  }
                />
              ))}
            </span>
            <span className="rainbow-award-icon" />
            <strong>
              {[...rainbowAwardLine(lang, rainbowAward)].map((char, index) => (
                <i key={index} style={{ '--ci': index } as React.CSSProperties}>
                  {char === ' ' ? ' ' : char}
                </i>
              ))}
            </strong>
          </div>
        ) : null}
        {rainbowAsk ? (
          // ゲームオーバー直前の割り込み。3秒で自動的に閉じる。
          // ボタンの絵は差し替えられるようにクラスを分けてある（課金スキンの受け皿）。
          <div className="rainbow-ask">
            <p>{text.rainbowUse}</p>
            <button
              className="rainbow-ask-button"
              type="button"
              onClick={() => {
                const resolve = rainbowAnswer.current;
                rainbowAnswer.current = null;
                resolve?.(true);
              }}
            >
              <span className="rainbow-ask-skin" />
              <span
                className="rainbow-ask-gauge"
                style={{ '--ask-ms': `${rainbowAskMs}ms` } as React.CSSProperties}
              />
            </button>
          </div>
        ) : null}
        {bombBanner ? (
          <div aria-hidden className="bomb-banner" data-kind={bombBanner.kind}>
            {bombBanner.label}
          </div>
        ) : null}
        {status === 'ready' && titleRoll === null ? (
          // 起動直後だけ出るサイコロ。振った目でタイトル画面が決まる。
          // 振ったタップでそのまま音の制限を解き、タイトル曲を鳴らし始める。
          <DiceIntro
            lang={lang}
            onRolled={(face) => {
              void titleArtReady.current.then(() => setTitleRoll(face));
            }}
            onTap={(face) => {
              // 振った瞬間（＝指の操作の中）でやること:
              // 音の鍵を開け、この目の曲を無音で一度だけ再生して止めておく。
              // 曲を鳴らすのは目が止まってから（操作の外）なので、ここで鍵を開けておかないと
              // iPhone では鳴らせない。転がる音はここで鳴らし始める。
              // 目を先に決めてから鍵を開ける。本編の曲も同じ目で選ぶので、
              // ここで本編の曲も無音で一度だけ鳴らしておかないと、iPhone では
              // ゲーム開始（操作の外）で鳴らせない。unlockAudio は最初の操作で
              // 一度しか働かず、そのときはまだ目が決まっていないことがある。
              setTitleFace(face);
              titleArtReady.current = preloadImage(TITLE_IMAGES[face - 1] ?? TITLE_IMAGE);
              unlockAudio();
              primeAudio(getTitleBgm());
              primeAudio(getBgm());
              primeAudio(getMapBgm());
              if (soundModeRef.current !== 'none') {
                playDiceRollSound(INTRO_ROLL_MS / 1000);
              }
            }}
            onLanded={() => {
              // 目が止まる絵と同じ瞬間に、止まる音を鳴らす。
              // 曲はここでは鳴らさない。タイトル画面に切り替わった瞬間に鳴らし始める
              // （status と titleRoll を見る BGM の useEffect が受け持つ）
              if (soundModeRef.current !== 'none') {
                playDiceStopSound();
              }
            }}
          />
        ) : null}
        {status === 'ready' && titleRoll !== null ? (
          // タイトル画面。絵を画面いっぱいに敷き、文字とボタンだけを上に置く。
          // 操作はすべて下段にまとめ、絵の主役（キャラクター）を空けておく。
          <div className="title-screen">
            <TitleArt roll={titleRoll} />
            {/* 仮置き。起動時に出た目を隅に出しておく。6種類の絵が揃ったら外す */}
            {/* タイトル文字は絵に焼き込まれているので、ここでは出さない。
                読み上げ用にだけ、見えない見出しとして残しておく。 */}
            <h1 className="sr-only">{text.title}</h1>
            {/* デバッグ用：アプリの再起動。キャッシュを避けて最新を読み直す */}
            <button
              aria-label="アプリを再起動"
              className="title-reload"
              type="button"
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.set('r', String(Date.now()));
                window.location.replace(url.toString());
              }}
            >
              ↻
            </button>
            <div className="title-controls">
              <div aria-label={text.langLabel} className="lang-switch" role="group">
                <button
                  aria-pressed={lang === 'ja'}
                  className={lang === 'ja' ? 'is-on' : ''}
                  type="button"
                  onClick={() => changeLang('ja')}
                >
                  日本語
                </button>
                <button
                  aria-pressed={lang === 'en'}
                  className={lang === 'en' ? 'is-on' : ''}
                  type="button"
                  onClick={() => changeLang('en')}
                >
                  English
                </button>
              </div>
              {/* 左右に同じ幅の枠を置いて、スタートを画面中央に保ったまま
                  説明ボタンだけを右へ出す */}
              {/* 虹ボムの所持数。文字は出さず、3つの枠がいくつ埋まっているかだけで示す。
                  何個あるかが分かればよく、名前の説明は要らない。 */}
              <div aria-label={`${text.rainbowName} ${rainbowStock} / ${RAINBOW_MAX_STOCK}`} className="title-stock" role="img">
                {Array.from({ length: RAINBOW_MAX_STOCK }, (_, index) => (
                  <span aria-hidden className={index < rainbowStock ? 'is-on' : ''} key={index} />
                ))}
              </div>
              <div className="title-actions">
                {/* タイトルの絵は盤面ごと覆うので、HUDの音ボタンはこの下に隠れる。
                    ここに置いておけば、始める前でも音を切れる。 */}
                <button
                  className="title-sound"
                  type="button"
                  onClick={toggleSound}
                  aria-label={`${text.soundTitle}: ${SOUND_LABELS[lang][soundMode]}`}
                  title={
                    lang === 'ja'
                      ? `${text.soundTitle}: ${SOUND_LABELS[lang][soundMode]}（${text.soundHint}）`
                      : `${text.soundTitle}: ${SOUND_LABELS[lang][soundMode]} (${text.soundHint})`
                  }
                >
                  {SOUND_ICONS[soundMode]}
                </button>
                <button className="title-start" type="button" onClick={startEndless}>
                  {text.start}
                </button>
                <button className="title-story" type="button" onClick={() => setShowStages(true)}>
                  {lang === 'ja' ? 'ストーリー\nモード' : 'STORY\nMODE'}
                </button>
                <button className="title-help" type="button" onClick={() => setShowHelp(true)}>
                  {text.help}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {mapShown ? <WallMap progress={wallProgress} initialStage={lastMapStage} onStart={startStage} onGate={(wall) => { const gate = wallGate(wall); if (gate === undefined || !wallProgressRef.current.cleared.includes(gate)) return; if (!(wallProgressRef.current.reachedWalls ?? []).includes(wall) && !(wall === 1 && wallProgressRef.current.gateReached)) playGateUnlockSound(); const next = { ...wallProgressRef.current, gateReached: wallProgressRef.current.gateReached || wall === 1, reachedWalls: [...new Set([...(wallProgressRef.current.reachedWalls ?? []), wall])] }; wallProgressRef.current = next; if (!isStoryReview()) saveWallProgress(next); setWallProgress(next); }} onLegacy={() => setStoryLayout('linear')} onClose={() => setShowStages(false)} onEnding={() => { setShowStages(false); setShowEnding('omote'); }} endingSeen={endingSeen} onUra={() => { setShowStages(false); setUraFall(true); }} onUraEnding={() => { setShowStages(false); setShowEnding('ura'); }} /> : null}
        {showEnding ? <Ending variant={showEnding} onSeen={() => { if (showEnding === 'omote' && !endingSeen) { saveEndingSeen(); setEndingSeen(true); } }} onClose={() => setShowEnding(false)} /> : null}
        {uraFall ? <UraFall onDone={() => { setUraFall(false); setLastMapStage(URA_FIRST_STAGE); setShowStages(true); }} /> : null}
        {status === 'ready' && showStages && storyLayout === 'linear' ? (
          // コロえらび。上に7つのチカラの枠（まだ空）、下に遊べるコロ
          <div className="stage-select">
            <div
              aria-label={lang === 'ja' ? '7つのチカラ' : 'Seven powers'}
              className="power-slots"
              role="img"
            >
              {/* 1つめ（スーパー1）は3メン、2つめ（スラッシュ3）は5メン、3つめ（スクウェア4）は7メン…のクリアで埋まる */}
              {Array.from({ length: STORY_POWER_COUNT }, (_, index) => {
                const mark =
                  index === 0 && storyCleared >= SPA_STAGE
                    ? '1'
                    : index === 1 && storyCleared >= SLA_STAGE
                      ? '3'
                      : index === 2 && storyCleared >= SQU_STAGE
                        ? '4'
                        : index === 3 && storyCleared >= STR_STAGE
                          ? '6'
                          : index === 4 && storyCleared >= NICO_STAGE
                            ? '☻'
                          : index === 5 && storyCleared >= FEVER_STAGE
                            ? 'F'
                            : index === 6 && storyCleared >= RAINBOW_STAGE
                              ? '虹'
                              : '';
                return (
                  <span aria-hidden className={mark ? 'is-owned' : ''} key={index}>
                    {mark}
                  </span>
                );
              })}
            </div>
            <div className="stage-grid">
              {STORY_STAGES.slice(0, LEGACY_STAGE_COUNT).map((stage, index) => {
                const no = index;
                const locked = no > storyCleared + 1;
                return (
                  <button
                    aria-label={`${no}${lang === 'ja' ? 'メン' : ''} ${stage.name[lang]}`}
                    className={`stage-card ${no <= storyCleared ? 'is-cleared' : ''}`}
                    disabled={locked}
                    key={no}
                    type="button"
                    onClick={() => startStage(no)}
                  >
                    <b className="stage-no">{no}</b>
                    <span>{lang === 'ja' ? 'メン' : 'STAGE'}</span>
                    {locked ? <i aria-hidden>🔒</i> : no <= storyCleared ? <i aria-hidden>★</i> : null}
                  </button>
                );
              })}
              {/* まだ公開していないメン。数字は出さず、グレーにして鍵だけ見せる（3列×8段＝24枠まで埋める） */}
              {Array.from({ length: Math.max(0, STAGE_SELECT_SLOTS - LEGACY_STAGE_COUNT) }, (_, index) => (
                <div aria-hidden className="stage-card is-unreleased" key={`soon-${index}`}>
                  <i className="stage-lock">🔒</i>
                </div>
              ))}
            </div>
            <button className="wall-mode-toggle" onClick={() => setStoryLayout('map')}>マップ版へ</button>
            <button
              aria-label={enemyPractice ? '図鑑にもどる' : text.backToTitle}
              className="stage-close"
              type="button"
              onClick={() => setShowStages(false)}
            >
              ✕
            </button>
          </div>
        ) : null}

        {stageIntro !== null ? (
          <div className="stage-intro" aria-hidden>
            <div className="stage-intro-band">
            <b>{enemyPractice ? '模擬戦' : mapRun.current ? stageIntro === 0 ? '0メン' : wallMission(mapStage) ? wallNumberLabel(wallMission(mapStage)!) : '' : lang === 'ja' ? `${stageIntro}メン` : `STAGE ${stageIntro}`}</b>
            <span>{mapRun.current ? mapStage === 0 ? 'チュートリアル草原' : activeMission?.title : STORY_STAGES[stageIntro].name[lang]}</span>
            </div>
          </div>
        ) : null}
        {(() => {
          // 盤面中央の表示。お手本中は「デモプレイ」、練習中は黄橙の促しを点滅させる
          // 一時停止中はメニューの上に重なるので出さない
          if (status === 'ready' || status === 'cleared' || status === 'paused') return null;
          if ((story !== null && BOMB_LESSONS[story]) || story === KOI_STAGE || story === DAME_STAGE) {
            const phase =
              story === KOI_STAGE ? koiView.phase : story === DAME_STAGE ? dameView.phase : bombView.phase;
            if (phase === 'demo') {
              return <div className="demo-label" aria-hidden>{lang === 'ja' ? 'デモプレイ' : 'DEMO'}</div>;
            }
            if (phase === 'play') {
              // やってみてのブロックが出て、サイカがセリフを言い終えてから出す
              if (!tryArm.on) return null;
              const tryKey = `try-${tryArm.n}`;
              if (tryShownKey.current !== tryKey) {
                if (!saikaSettled) return null;
                tryShownKey.current = tryKey;
              }
              return (
                <div className="demo-label is-try" aria-hidden key={tryKey}>
                  {lang === 'ja' ? 'やってみて！' : 'Your turn!'}
                </div>
              );
            }
            return null;
          }
          if (story === COMBO_STAGE && comboDemo) {
            return <div className="demo-label" aria-hidden>{lang === 'ja' ? 'デモプレイ' : 'DEMO'}</div>;
          }
          if (story !== 0) return null;
          const step = TUTORIAL_STEPS[tutorialView.step];
          if (!step || step.kind === 'mission') return null;
          if (step.kind === 'demo') {
            return <div className="demo-label" aria-hidden>{lang === 'ja' ? 'デモプレイ' : 'DEMO'}</div>;
          }
          if (!tryArm.on) return null;
          const tutorialTryKey = `try-${tryArm.n}`;
          if (tryShownKey.current !== tutorialTryKey) {
            if (!saikaSettled) return null;
            tryShownKey.current = tutorialTryKey;
          }
          return (
            <div className={`demo-label is-try ${step.label === 'seven' ? 'is-long' : ''}`} aria-hidden key={tutorialTryKey}>
              {step.label === 'seven'
                ? lang === 'ja'
                  ? <>となり合うサイノメを<br />合計<em className="seven-mark">7</em>にしよう</>
                  : <>Make neighbors add up to <em className="seven-mark">7</em></>
                : lang === 'ja'
                  ? 'やってみて！'
                  : 'Your turn!'}
            </div>
          );
        })()}
        {tapHint ? (
          // お手本で「ここをタップ」
          <div className={`tap-hint is-${tapHint}`} aria-hidden />
        ) : null}
        {clearVolley > 0 ? <ClearFireworks key={clearVolley} /> : null}
        {comboFx ? (
          <div className="combo-fx" key={comboFx.key} aria-hidden>
            CHAIN<b>×{comboFx.n}</b>
          </div>
        ) : null}
        {status === 'cleared' && story !== null ? (
          <div
            className="game-overlay stage-clear"
            style={
              {
                '--clear-letters': `${CLEAR_LETTERS_MS}ms`,
                '--clear-score': `${CLEAR_SCORE_MS}ms`,
                '--clear-buttons': `${CLEAR_BUTTONS_MS}ms`,
              } as React.CSSProperties
            }
          >
            <b className={`stage-clear-no ${mapRun.current ? 'wall-clear-no' : ''}`}>{enemyPractice ? enemyPractice.name : mapRun.current ? wallTitleLines(mapStage ?? 0) : lang === 'ja' ? `${story}メン` : `STAGE ${story}`}</b>
            <p className="stage-clear-title">
              <span className="sr-only">CLEAR!</span>
              <span className="clear-title-letters" aria-hidden>
                {Array.from('CLEAR!').map((letter, index) => (
                  <span key={index} style={{ '--delay': `calc(var(--clear-letters) + ${index * 160}ms)` } as React.CSSProperties}>
                    {letter}
                  </span>
                ))}
              </span>
            </p>
            <strong>{finalScore.toLocaleString()}</strong>
            <div className="overlay-actions">
              {mapRun.current && mapStage === FINAL_STAGE ? <button className="overlay-forward" onClick={() => { backToTitle(); setShowEnding('omote'); }}>エンディングへ</button>
                : mapRun.current && mapStage === URA_FINAL_STAGE ? <button className="overlay-forward" onClick={() => { backToTitle(); setShowEnding('ura'); }}>ウラエンディングへ</button>
                : mapRun.current ? <button className="overlay-forward" onClick={() => { backToTitle(); setShowStages(true); }}>{activeMission && wallGate(activeMission.wall) === mapStage ? '門へ進む' : 'マップに進む'}</button> : !enemyPractice && story < LEGACY_STAGE_COUNT - 1 ? (
                <button type="button" onClick={() => startStage(story + 1)}>
                  {lang === 'ja' ? `Next ${story + 1}メン へGo!` : `Next: Stage ${story + 1} — Go!`}
                </button>
              ) : null}
              <button className="overlay-secondary" type="button" onClick={() => startStage(mapRun.current ? mapStageRef.current ?? story : story)}>
                {lang === 'ja' ? 'もう一度' : 'Play again'}
              </button>
              <button className="overlay-secondary" type="button" onClick={backToTitle}>
                {enemyPractice ? '図鑑にもどる' : text.backToTitle}
              </button>
            </div>
          </div>
        ) : null}
        {showHelp ? (
          <HelpScreen
            lang={lang}
            text={text}
            onChangeLang={changeLang}
            onClose={() => setShowHelp(false)}
            onResetProgress={resetProgress}
            totalScore={totalScore}
          />
        ) : null}
        {status === 'paused' || status === 'gameover' ? (
          <div className="game-overlay">
            <h1 className="is-quiet">{text.title}</h1>
            {status === 'gameover' ? (
              <div className="gameover-panel">
                <p><ScatterText text={text.gameOver} /></p>
                <strong>{finalScore.toLocaleString()}</strong>
                <span>{text.thisScore}</span>
                <ol>
                  {bestScores.map((value, index) => (
                    <li key={`${value}-${index}`}>
                      <span>{text.best} {index + 1}</span>
                      <b>{value.toLocaleString()}</b>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p>{text.paused}</p>
            )}
            {status === 'paused' ? (
              // 一時停止中は「続きから」と、盤面を捨てる操作を分けておく。
              // ここで押し間違えると進行中の盤面が消えてしまうため、
              // 再開だけを目立たせ、下の2つは控えめな見た目に揃えている。
              <div className="overlay-actions">
                <button className="overlay-resume" type="button" onClick={resume}>
                  {text.resume}
                </button>
                <button className="overlay-secondary" type="button" onClick={playAgain}>
                  {text.restart}
                </button>
                {mapRun.current ? <button className="overlay-secondary" type="button" onClick={() => { backToTitle(); setShowStages(true); }}>マップにもどる</button> : null}
                <button className="overlay-secondary" type="button" onClick={backToTitle}>
                  {enemyPractice ? '図鑑にもどる' : text.backToTitle}
                </button>
              </div>
            ) : (
              // ゲームオーバーからは、すぐ遊び直すかタイトルへ帰るかを選べる
              <div className="overlay-actions">
                <button type="button" onClick={playAgain}>
                  {text.playAgain}
                </button>
                {mapRun.current ? <button className="overlay-secondary" type="button" onClick={() => { backToTitle(); setShowStages(true); }}>マップにもどる</button> : null}
                <button className="overlay-secondary" type="button" onClick={backToTitle}>
                  {enemyPractice ? '図鑑にもどる' : text.backToTitle}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className="saika-bar" aria-live="polite">
        {sageSpeaking ? <div className="saika-face"><div className="sage-portrait"><ZoromeSage mood={saika.mood} text={spokenLine(saika.text)}/></div></div> : tutorPair && saika.who !== 'saika' ? <TutorFace pair={tutorPair} turn={tutorTurn} /> : <SaikaFace kind={faceFor(saika.mood, feverActive)} />}
        <p className={`saika-bubble ${story !== null && !enemyPractice ? 'has-wall-theme' : ''}`} data-mood={saika.mood}>
          {story !== null && !enemyPractice && status !== 'ready' && status !== 'cleared' ? <MissionBanner key={`${storyRunRef.current}:${mapStage ?? story}`} title={mapRun.current && activeMission ? `${wallNumberLabel(activeMission)} ${activeMission.title}` : story === 0 ? '0メン チュートリアル草原' : `${story}メン ${STORY_STAGES[story].name[lang]}`} objective={objectiveText} training={bannerTraining} running={bannerRunning} /> : null}
          {/* 7 はいつも黄橙で目立たせる。[1]〜[6] はサイノメの絵に置き換える。
              ひとかたまりの span に入れて、絵と字が同じ行の中で折り返すようにする */}
          {/* セリフの吹き出し。ストーリーでは帯の下に、高さ一定の角丸の吹き出しとして出す */}
          <span className="saika-talk">
          {status === 'gameover' && gameoverHint ? (
            <span className="saika-line">{renderLine(spokenLine(RAINBOW_HINT_LINE[lang]))}</span>
          ) : status === 'cleared' && story !== null ? (
            // クリアのひとこと。1文字ずつ左から順に、なめらかに出す
            <span className="saika-line clear-line" key={clearLine}>
              {[...spokenLine(clearLine)].map((char, index) => (
                <span key={index} style={{ '--ci': index } as React.CSSProperties}>
                  {char}
                </span>
              ))}
            </span>
          ) : (
            <span className="saika-line" ref={saikaLineRef}>
              {renderLine(dialoguePages[Math.min(dialoguePage, dialoguePages.length - 1)])}
            </span>
          )}
          </span>
        </p>
      </section>

      <aside className="right-hud">
        <section className="panel next-panel">
          <p>{text.next}</p>
          <div
            className="next-dice"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${nextPiece.matrix.length}, 28px)`,
              gap: '4px',
            }}
          >
            {nextPiece.matrix.flatMap((row, my) =>
              row.map((value, mx) =>
                value === null ? (
                  <span key={`${mx}-${my}`} />
                ) : (
                  <Die compact key={`${mx}-${my}`} value={value} />
                ),
              ),
            )}
          </div>
        </section>

        <section className="panel help-panel">
          <div className="panel-title">
            <strong>{text.howTo}</strong>
            <button
              type="button"
              onClick={togglePause}
            >
              {text.pause}
            </button>
          </div>
          <p>{text.howToRule}</p>
          <p>{text.howToPc}</p>
          <p>{text.howToTouch}</p>
          <div className="touch-controls" aria-label={text.touchLabel}>
            <button type="button" onClick={() => move(-1, 0)}>
              ←
            </button>
            <button type="button" onClick={() => move(0, 1)}>
              ↓
            </button>
            <button type="button" onClick={() => rotate()}>
              ↻
            </button>
            <button type="button" onClick={hardDrop}>
              落
            </button>
          </div>
        </section>

        <section className="panel best-panel">
          <strong>{text.bestTitle}</strong>
          <ol>
            {bestScores.length === 0 ? (
              <li className="empty-best">{text.noRecords}</li>
            ) : (
              bestScores.map((value, index) => (
                <li key={`${value}-${index}`}>
                  <span>{text.best} {index + 1}</span>
                  <b>{value.toLocaleString()}</b>
                </li>
              ))
            )}
          </ol>
        </section>
      </aside>

      {debugState.on ? <DebugPanel /> : null}
    </main>
  );
}

// クリア時は３か所から一度だけ放射状に弾ける。四角い紙吹雪を多めに混ぜる。
const CLEAR_BURSTS = [
  { x: 24, y: 32 },
  { x: 76, y: 38 },
  { x: 50, y: 22 },
] as const;

const CLEAR_PARTICLES = CLEAR_BURSTS.flatMap((origin, burst) =>
  Array.from({ length: 16 }, (_, index) => {
    const angle = (index / 16) * Math.PI * 2 + burst * 0.35;
    const reach = 9 + ((index * 7 + burst * 3) % 9);
    return {
      x: origin.x,
      y: origin.y,
      dx: Math.cos(angle) * reach,
      dy: Math.sin(angle) * reach,
      size: 5 + ((index * 3 + burst) % 7),
      delay: burst * 0.055 + (index % 3) * 0.012,
      duration: 0.48 + ((index + burst) % 4) * 0.05,
      spin: ((index % 2 === 0 ? 1 : -1) * (100 + index * 23)),
      color: FEVER_SPARK_COLORS[(index + burst * 4) % FEVER_SPARK_COLORS.length],
      square: index % 4 !== 0,
    };
  }),
);

const ClearFireworks = memo(function ClearFireworks() {
  return (
    <div className="clear-fireworks" aria-hidden>
      {CLEAR_PARTICLES.map((particle, index) => (
        <span
          key={index}
          className={particle.square ? 'clear-particle is-square' : 'clear-particle is-round'}
          style={
            {
              '--sx': `${particle.x}%`,
              '--sy': `${particle.y}%`,
              '--dx': `${particle.dx.toFixed(1)}vmax`,
              '--dy': `${particle.dy.toFixed(1)}vmax`,
              '--kick-x': `${(particle.dx * 0.22).toFixed(1)}vmax`,
              '--kick-y': `${(particle.dy * 0.22).toFixed(1)}vmax`,
              '--size': `${particle.size}px`,
              '--delay': `${particle.delay}s`,
              '--dur': `${particle.duration}s`,
              '--spin': `${particle.spin}deg`,
              '--color': particle.color,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
});

// フィーバー中に散る円。
// 中身は起動時に決まって以後変わらないのに、親が再描画されるたびに
// 全部の要素を作り直していた。フィーバー中はゲージが100msごとに動くため、
// そのたびに数十個ぶんの生成と差分計算が走り、コマ落ちの原因になっていた。
// memo で包み、props が同じなら丸ごと飛ばす。
const FeverSparks = memo(function FeverSparks({ sparks }: { sparks: FeverSpark[] }) {
  return (
    <div aria-hidden className="fever-sparks">
      {sparks.map((spark, index) => (
        <span
          key={index}
          style={
            {
              '--sx': `${spark.x}%`,
              '--sy': `${spark.y}%`,
              '--size': `${spark.size}px`,
              '--delay': `${spark.delay}s`,
              '--dur': `${spark.duration}s`,
              '--color': spark.color,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
});

// 虹ボムが弾けた一瞬だけ、画面いっぱいに虹の粒を散らす。
// 粒の中身はフィーバーと同じつくりで、動きだけが一度きりの外向き。
const RainbowSparks = memo(function RainbowSparks({ sparks }: { sparks: RainbowSpark[] }) {
  return (
    <div aria-hidden className="rainbow-sparks">
      {sparks.map((spark, index) => (
        <span
          key={index}
          style={
            {
              '--sx': `${spark.x}%`,
              '--sy': `${spark.y}%`,
              '--dx': `${spark.dx.toFixed(1)}vmax`,
              '--dy': `${spark.dy.toFixed(1)}vmax`,
              '--size': `${spark.size}px`,
              '--delay': `${spark.delay}s`,
              '--dur': `${spark.duration}s`,
              '--color': spark.color,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
});

function Die({
  value,
  charge,
  compact = false,
  flashing = false,
  group,
  burst,
  rainbowBurst = false,
  scatterBurst = false,
  pressed = false,
  fading = false,
  spawning = false,
  flung,
  absorb,
  mono,
  arming,
  blast = false,
  hit = false,
}: {
  value: number;
  charge?: string;
  compact?: boolean;
  flashing?: boolean;
  group?: number;
  burst?: Position;
  rainbowBurst?: boolean;
  scatterBurst?: boolean;
  pressed?: boolean;
  fading?: boolean;
  spawning?: boolean;
  flung?: Position;
  absorb?: { dx: number; dy: number }; // デタラメに吸い込まれる（行き先はマスに対する割合）
  mono?: number;
  arming?: number;
  blast?: boolean;
  hit?: boolean;
}) {
  // 反転点滅（blast）の最中だけ、塗りをCSSに任せる。インラインで色を
  // 指定するとキーフレームから上書きできない。
  // 虹ボムの範囲（mono）は、以前は白黒に塗り替えていたのでここに含めていたが、
  // いまは光を重ねるだけでメの色は残すので、本来の色をそのまま塗る。
  const plain = blast;
  const isNico = value === NICO;
  const enemy = isEnemy(value);
  const background = enemy ? ENEMY_COLOR : isNico ? NICO_COLOR : COLORS[value - 1];
  const pipColor = isNico || enemy ? PIP_LIGHT : pipColorFor(value);

  const className = [
    'die',
    compact ? 'die-compact' : '',
    flashing ? 'die-flashing' : '',
    isNico ? 'die-nico' : '',
    enemy ? 'die-enemy' : '',
    hit ? 'die-hit' : '',
    burst ? 'die-burst' : '',
    burst && rainbowBurst ? 'die-burst-rainbow' : '',
    burst && scatterBurst ? 'die-burst-scatter' : '',
    pressed ? 'die-pressed' : '',
    fading ? 'die-fade' : '',
    spawning ? 'die-spawn' : '',
    flung ? 'die-fling' : '',
    absorb ? 'die-absorbing' : '',
    blast ? 'die-blast' : '',
    mono !== undefined ? 'die-mono' : '',
    arming !== undefined ? `die-arming die-arming-${arming}` : '',
    charge ? (charge === 'fever' ? 'die-charge die-charge-fever' : 'die-charge') : '',
  ]
    .filter(Boolean)
    .join(' ');

  // 反転点滅の間は色をCSSのアニメーションに任せる。
  // インラインで色を指定すると、キーフレームからは上書きできない。
  const style = {
    ...(plain ? {} : { backgroundColor: background }),
    ...(mono !== undefined ? { '--mi': mono } : {}),
    ...(burst ? { '--bx': `${burst.x}`, '--by': `${burst.y}` } : {}),
    ...(flung ? { '--fx': `${flung.x}`, '--fy': `${flung.y}` } : {}),
    ...(absorb ? { '--absorb-dx': `${absorb.dx}`, '--absorb-dy': `${absorb.dy}` } : {}),
    // 本来の色と反対色を渡し、CSS 側で交互に入れ替える
    ...(charge && charge !== 'fever' ? { '--base': background, '--flip': charge } : {}),
  } as React.CSSProperties;

  return (
    <div className={className} data-group={group} data-value={value} style={style}>
      {absorb ? (
        // 吸い込まれるとき、サイは白い3重の角丸の線になる。どれも時計回りで、速さと緩急を変える
        <>
          {[0, 1, 2].map((i) => (
            <i
              className="absorb-ring"
              key={i}
              style={
                {
                  '--inset': `${2 + i * 10}%`,
                  '--start': `${i * 12}deg`,
                  '--end': `${[250, 350, 430][i]}deg`,
                  '--tempo': `${[0.72, 0.62, 0.54][i]}s`,
                  '--ease': ['ease-in', 'linear', 'ease-out'][i],
                } as React.CSSProperties
              }
            />
          ))}
        </>
      ) : null}
      {enemy ? (
        // コイツメは逆ハの字の目、ダーメは中央に太い✕。
        <>
          <span className="enemy-rim" />
          <span className="enemy-shine" />
          {value === DAME ? (
            <span className="enemy-crosses">
              <span className="enemy-cross" />
              <span className="enemy-cross" />
            </span>
          ) : value === KOITSUME ? (
            <span className="enemy-crosses is-koitsume">
              <span className="enemy-cross" />
              <span className="enemy-cross" />
            </span>
          ) : null}
        </>
      ) : isNico ? (
        // ニコニコメは 2 と 5 の顔を交互に点滅させる
        <>
          <span className="nico-face nico-face-a">
            {pipPositions[2].map((position, index) => (
              <span
                className={`pip ${position}`}
                key={`a-${position}-${index}`}
                style={plain ? undefined : { backgroundColor: pipColor }}
              />
            ))}
          </span>
          <span className="nico-face nico-face-b">
            {pipPositions[5].map((position, index) => (
              <span
                className={`pip ${position}`}
                key={`b-${position}-${index}`}
                style={plain ? undefined : { backgroundColor: pipColor }}
              />
            ))}
          </span>
        </>
      ) : (
        pipPositions[value].map((position, index) => (
          <span
            className={`pip ${position}`}
            key={`${position}-${index}`}
            style={plain ? undefined : { backgroundColor: pipColor }}
          />
        ))
      )}
    </div>
  );
}

// ボムの範囲を見せる発光。core は隣とつながるよう辺をはみ出させる
function CellGlow({ info }: { info: GlowInfo }) {
  return (
    <span
      aria-hidden
      className={`cell-glow ${info.core ? 'is-core' : 'is-extra'} ${info.sweep ? 'is-sweep' : ''}`}
      style={
        {
          '--glow-color': info.color,
          '--gt': `${info.bleed.top}px`,
          '--gr': `${info.bleed.right}px`,
          '--gb': `${info.bleed.bottom}px`,
          '--gl': `${info.bleed.left}px`,
          '--glow-delay': `${info.delay}ms`,
        } as React.CSSProperties
      }
    />
  );
}

// 画像が用意できていない間は絵文字で代用する。
// onError で一度だけ差し替えるので、404が出続けることはない。
// 敵の倒し方を教えるサイノメの組。話している方を大きく、顔の下に名前を出す
function TutorFace({ pair, turn }: { pair: [number, number]; turn: number }) {
  return (
    <div aria-hidden className="saika-face tutor-face">
      {pair.map((value, i) => (
        <div key={value} className={`tutor ${i === turn ? 'tutor-on' : ''}`}>
          <div className="tutor-die"><img className="tutor-portrait" src={`/images/sai-comments/fab${String(value).padStart(2, '0')}.png`} alt={SAI_NAMES[value - 1]} /></div>
          <small>{SAI_NAMES[value - 1]}</small>
        </div>
      ))}
    </div>
  );
}

function SaikaFace({ kind }: { kind: SaikaFaceKind }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div aria-hidden className="saika-face">
        {SAIKA_FACE_PLACEHOLDER}
      </div>
    );
  }

  return (
    <div aria-hidden className="saika-face">
      <img alt="" src={SAIKA_FACES[kind]} onError={() => setFailed(true)} />
    </div>
  );
}

// 説明画面。タイトルの上に全画面でかぶせる。
// 上部のタブで言語を切り替えられるようにしてあるので、
// タイトルへ戻らずに読み比べられる。
function HelpScreen({
  lang,
  text,
  onChangeLang,
  onClose,
  onResetProgress,
  totalScore,
}: {
  lang: Lang;
  text: (typeof TEXTS)[Lang];
  onChangeLang: (next: Lang) => void;
  onClose: () => void;
  onResetProgress: () => void;
  totalScore: number;
}) {
  // 開発用のリセット。押し間違えないよう、2回押して初めて消す
  const [resetStep, setResetStep] = useState<'idle' | 'confirm' | 'done'>('idle');
  return (
    <div className="help-screen">
      <div className="help-top">
        <button aria-label={text.helpClose} className="help-back" type="button" onClick={onClose}>
          ←
        </button>
        <strong className="help-heading">{text.helpTitle}</strong>
        <div aria-label={text.langLabel} className="lang-switch is-compact" role="group">
          <button
            aria-pressed={lang === 'ja'}
            className={lang === 'ja' ? 'is-on' : ''}
            type="button"
            onClick={() => onChangeLang('ja')}
          >
            日本語
          </button>
          <button
            aria-pressed={lang === 'en'}
            className={lang === 'en' ? 'is-on' : ''}
            type="button"
            onClick={() => onChangeLang('en')}
          >
            English
          </button>
        </div>
      </div>
      <div className="help-body">
        {/* 累積スコア。これまでに稼いだ点の合計を9桁で */}
        <div className="help-total" aria-label={`EXP ${totalScore}`}>
          <span>EXP</span>
          <b>{String(Math.min(totalScore, 10 ** TOTAL_SCORE_DIGITS - 1)).padStart(TOTAL_SCORE_DIGITS, '0')}</b>
          <span>{lang === 'ja' ? 'コロ' : 'KORO'}</span>
        </div>
        {HELP[lang].map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.blocks.map((block, index) => {
              if (block.kind === 'p') {
                return <p key={index}>{block.text}</p>;
              }
              if (block.kind === 'ul') {
                return (
                  <ul key={index}>
                    {block.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                );
              }
              // 合計7になる相手は必ず同じ色、というのは文で書くより見せたほうが早い
              return (
                <div className="help-pairs" key={index}>
                  {[
                    [1, 6],
                    [2, 5],
                    [3, 4],
                  ].map(([a, b]) => (
                    <div className="help-pair" key={a}>
                      <Die value={a} compact />
                      <span>+</span>
                      <Die value={b} compact />
                      <span className="help-pair-sum">= 7</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </section>
        ))}
        {/* ===== 開発用（リリース時に消すかもしれない） ===== */}
        <section className="help-dev">
          <h2>{lang === 'ja' ? '開発用' : 'For development'}</h2>
          <p>
            {lang === 'ja'
              ? 'ベストスコアとストーリーの進み具合を消して、はじめから遊べる状態に戻します。'
              : 'Clears best scores and story progress so you can start over.'}
          </p>
          <button
            className={`help-reset is-${resetStep}`}
            disabled={resetStep === 'done'}
            type="button"
            onClick={() => {
              if (resetStep === 'idle') {
                setResetStep('confirm');
                return;
              }
              onResetProgress();
              setResetStep('done');
            }}
          >
            {resetStep === 'idle'
              ? lang === 'ja'
                ? 'スコアと進行をリセット'
                : 'Reset scores and progress'
              : resetStep === 'confirm'
                ? lang === 'ja'
                  ? '本当に消す？ もう一度押すとリセット'
                  : 'Sure? Tap again to reset'
                : lang === 'ja'
                  ? 'リセットしました'
                  : 'Reset done'}
          </button>
        </section>
      </div>
    </div>
  );
}

// ゲームオーバーの文字を1文字ずつ、散らばった位置から所定の場所へ飛び込ませる。
// 出る順番も入れ替える。左から順に出すと打鍵しているように見えて、
// 「一斉にバラけて現れる」感じにならない。
function ScatterText({ text }: { text: string }) {
  const parts = useMemo(() => {
    const chars = Array.from(text);
    // 出す順番を混ぜる
    const order = chars.map((_, index) => index);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return chars.map((char, index) => ({
      char,
      // 全部が出そろうまでが GAMEOVER_TEXT_MS。最後の文字がちょうど終端に来る
      delay: (order[index] / Math.max(1, chars.length - 1)) * GAMEOVER_TEXT_MS,
      // どこから飛んでくるか。文字ごとに変えたいが、再描画で暴れると困るので
      // 乱数ではなく添え字から決め打ちで散らす
      dx: (((index * 37) % 21) - 10) * 1.6,
      dy: (((index * 53) % 17) - 8) * 1.6,
      rot: ((index * 29) % 25) - 12,
    }));
  }, [text]);

  return (
    <>
      {/* 読み上げと文字列の取り出しはこちらに任せる。
          1文字ずつ span に切ると、行ボックスが分かれて
          innerText に改行が入り、文としては読めなくなる。 */}
      <span className="sr-only">{text}</span>
      <span aria-hidden className="scatter-text">
        {parts.map((part, index) => (
          <span
            key={index}
            style={
              {
                '--delay': `${part.delay}ms`,
                '--dx': `${part.dx}px`,
                '--dy': `${part.dy}px`,
                '--rot': `${part.rot}deg`,
              } as React.CSSProperties
            }
          >
            {part.char === ' ' ? ' ' : part.char}
          </span>
        ))}
      </span>
    </>
  );
}

// 起動したら最初に出る、サイコロを振る画面。
// タップで振って1〜6の目を出す。このタップがBGMを鳴らし始める合図も兼ねる。
// iPhone は指を離した click でしか音の制限を解かないので、onClick で受ける。
function DiceIntro({
  lang,
  onTap,
  onLanded,
  onRolled,
}: {
  lang: Lang;
  onTap: (face: number) => void; // 振った瞬間。出る目はここで決まっている
  onLanded: (face: number) => void; // 目が止まった瞬間
  onRolled: (face: number) => void; // 止まった目を見せ終えて、タイトルへ移るとき
}) {
  const [face, setFace] = useState(() => 1 + Math.floor(Math.random() * 6));
  const [phase, setPhase] = useState<'idle' | 'rolling' | 'landed'>('idle');
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((id) => {
        window.clearTimeout(id);
        window.clearInterval(id);
      });
    },
    [],
  );

  const roll = () => {
    if (phase !== 'idle') {
      return;
    }
    const result = 1 + Math.floor(Math.random() * 6);
    onTap(result);
    setPhase('rolling');
    // 転がっているあいだは、直前と違う目を次々に見せる
    const spin = window.setInterval(() => {
      setFace((prev) => {
        let next = prev;
        while (next === prev) {
          next = 1 + Math.floor(Math.random() * 6);
        }
        return next;
      });
    }, INTRO_FACE_MS);
    const land = window.setTimeout(() => {
      window.clearInterval(spin);
      setFace(result);
      setPhase('landed');
      onLanded(result);
    }, INTRO_ROLL_MS);
    const done = window.setTimeout(() => onRolled(result), INTRO_ROLL_MS + INTRO_HOLD_MS);
    timers.current.push(spin, land, done);
  };

  const label = lang === 'ja' ? 'タップしてサイコロをふる' : 'Tap to roll the die';

  return (
    <div
      aria-label={label}
      className={`dice-intro is-${phase}`}
      role="button"
      tabIndex={0}
      onClick={roll}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          roll();
        }
      }}
    >
      <div className="dice-intro-die">
        {/* 文字や指の絵は出さず、サイから外へ広がる波紋でタップを促す。
            読み上げ用の説明は aria-label に残す */}
        <span aria-hidden className="dice-intro-ripple">
          <i />
          <i />
          <i />
        </span>
        <Die value={face} />
      </div>
    </div>
  );
}

function TitleArt({ roll }: { roll: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <div aria-hidden className="title-logo" />;
  }

  return (
    <>
      <img
        alt=""
        aria-hidden
        className="title-art"
        src={TITLE_IMAGES[roll - 1] ?? TITLE_IMAGE}
        onError={() => setFailed(true)}
      />
    </>
  );
}

// ===== デバッグパネル（リリース時に削除する） =====
// ?debug=1 のときだけ出る。出現率を持ち上げて、狙った役を検証しやすくする。
function DebugPanel() {
  const [, force] = useState(0);
  const redraw = () => force((n) => n + 1);

  const values = [null, 1, 2, 3, 4, 5, 6];

  return (
    <div className="debug-panel">
      <strong>DEBUG</strong>
      <label>
        <input
          checked={debugState.nico}
          type="checkbox"
          onChange={(event) => {
            debugState.nico = event.target.checked;
            redraw();
          }}
        />
        ニコニコメ ×{DEBUG_BOOST}
      </label>
      <div className="debug-values">
        {values.map((value) => (
          <button
            className={debugState.value === value ? 'is-on' : ''}
            key={String(value)}
            type="button"
            onClick={() => {
              debugState.value = value;
              redraw();
            }}
          >
            {value === null ? '均等' : `${value}×${DEBUG_BOOST}`}
          </button>
        ))}
      </div>
      <p>次に出るブロックから反映されます</p>
    </div>
  );
}
// ===== デバッグパネルここまで =====

function BurstRing({ particles }: { particles: BurstParticle[] }) {
  return (
    <span aria-hidden className="burst-ring">
      {particles.map((particle, index) => (
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
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

// 桁数を固定して表示する。まだ到達していない上位の桁は、
// 背景に溶け込むグレーで置いておく。桁数が変わらないので、
// スコアが伸びても右隣のFEVERゲージの位置がずれない。
function DigitValue({ value, digits }: { value: number; digits: number }) {
  const safe = Math.max(0, Math.floor(value));
  const raw = String(safe);
  const text = raw.padStart(digits, '0');
  const dimCount = Math.max(0, text.length - raw.length);

  return (
    <>
      {[...text].map((char, index) => (
        <span className={index < dimCount ? 'digit-dim' : undefined} key={index}>
          {char}
        </span>
      ))}
    </>
  );
}

function InfoPanel({
  label,
  value,
  digits,
  millions,
}: {
  label: React.ReactNode;
  value: number;
  digits: number;
  millions?: number;
}) {
  return (
    <section className="panel info-panel">
      <p>
        {label}
        {millions === undefined ? null : (
          // 0のときも同じ幅を確保しておく。ここが伸び縮みすると
          // 右隣のFEVERゲージの位置がずれてしまうため。
          <span aria-hidden={millions === 0} className="score-millions" data-empty={millions === 0}>
            {`　${millions === 0 ? 0 : millions}`}
          </span>
        )}
      </p>
      <strong>
        <DigitValue digits={digits} value={value} />
      </strong>
    </section>
  );
}

// 開発時のみ、純粋なゲームロジックを検証用に公開する。
// import.meta.env.DEV は本番ビルドで false になり、このブロックごと除去される。
if (import.meta.env.DEV) {
  (window as unknown as { __sainome?: unknown }).__sainome = {
    COLS,
    ROWS,
    emptyBoard,
    splitScore,
    faceFor,
    SCORE_DIGITS,
    SCORE_DISPLAY_MAX,
    findSevenMatches,
    findSpaOneBombs,
    findAllBombs,
    isTopReached,
    TOP_SAFE_EDGE,
    findLineBombs,
    findSpaOneHits,
    findSquFourHits,
    runsOf,
    lineThrough,
    findNicoBomb,
    clearKindOnLock,
    expandForFever,
    scoreFor,
    isDangerBoard,
    NICO,
    DANGER_LINE_Y,
    dissolveGroups,
    stepGravity,
    buildFragments,
    buildGlow,
    createPiece,
    PIECE_SIZE,
    // 音の調整用。実際に鳴らして音量やバランスを確かめられるようにしておく
    getSfxBus,
    playEnemyFlashSound,
    playDetarameDamageSound,
    playEnemyHitSound,
    playSmallEnemyDefeatSound,
    playHidoimeHitSound,
    playHidoimeDefeatSound,
    sfxDropped: () => sfxDropped,
    SFX_CEILING_CURVE,
    playLockSound,
    playRotateSound,
    playRainbowBurstSound,
    playDiceRollSound,
    playFeverZoneSound,
    synthRotate,
    ROTATE_TRIM,
    playBombLockSound,
    BOMB_LOCK_TONES,
    playClearSound,
    playBombSound,
    playFeverBombSound,
    playNicoSound,
    playFeverBgm,
    stopFeverBgm,
  };
}

