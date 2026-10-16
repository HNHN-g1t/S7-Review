// Map progression is independent of the original linear story and its saves.
// Keep the original key and IDs 20–26 so already-cleared Wall 1 routes survive.
export const WALL_SAVE_KEY = 'sainome-wall1-progress-v1';
export const WALL_LESSON = 23;
export const WALL_BOSS = 26;
export const LEGACY_STAGE_COUNT = 20;

export type WallAbility = 'spa1' | 'sla3' | 'squ4' | 'str6' | 'nico' | 'fever' | 'rainbow' | 'thunder';
export type WallBomb = Extract<WallAbility, 'spa1' | 'sla3' | 'squ4' | 'str6'>;
export type WallMission = {
  stage: number; wall: number; number: string; title: string; theme: string; context: string;
  kind: 'mission' | 'lesson' | 'boss' | 'shortcut'; optional?: boolean;
  requires: number[]; requiresAny?: number[]; requiresAnyGroups?: number[][];
  requiresAbilities?: WallAbility[]; learns?: WallAbility;
  x: number; y: number;
  // sourceStage preserves existing lesson / enemy / wave scripts and enemy rules.
  // Non-lessons clear by scoreTarget alone, or by defeating every enemy if absent.
  // Power counts below are lesson-only; practice support is not a clear requirement.
  sourceStage?: number;
  sevens: number; superOnes: number;
  scoreTarget?: number; chainTarget?: number; nicoTarget?: number;
  bombTargets?: Partial<Record<WallBomb, number>>;
  boardRows?: [number, number]; seed?: WallBomb | 'nico';
  enemyWaveSize?: number;
  // イチニノサンダーを出す回数（ウォール6）
  thunderTarget?: number;
  // アンチクショウメが1体出る（倒すのは目にひっさつメを当てたときだけ）
  anchikushoume?: boolean;
  sanzapparaname?: boolean; sanzTurns?: number; sanzVolley?: number;
  // デタラメを合計何体、同時に何体まで出すか（ウォール6-3・6-4）
  detarameTotal?: number;
  detarameAtOnce?: number;
  // ウラメン（黒い世界）の面
  ura?: boolean;
  // コイツメを全滅させたあと、追加で降ってくるコイツメの数（1回だけ）
  reinforceKoitsume?: number;
  // Only terrain / ordinary die weights change in scripted rematches.
  openingRows?: [number, number]; boostValues?: number[];
  enemies: Array<{ x: number; y?: number; kind: 'koitsume' | 'dame' }>;
};
export type CampaignWall = { wall: number; title: string; subtitle: string; implemented: boolean; ura?: boolean };
export const CAMPAIGN_WALLS: CampaignWall[] = [
  { wall: 1, title: 'サイノメ草原', subtitle: 'セヴン目と、はじめてのひっさつメ', implemented: true },
  { wall: 2, title: '城下への街道', subtitle: 'チェイン・ななめ・四角をつなぐ', implemented: true },
  { wall: 3, title: '城下町', subtitle: 'まっすぐなチカラと黒い笑顔', implemented: true },
  { wall: 4, title: '外壁と城門', subtitle: '覚醒と虹で城門を越える', implemented: true },
  { wall: 5, title: '城内・前庭', subtitle: '大きな敵を越え、城の奥へ', implemented: true },
  { wall: 6, title: '城内・回廊', subtitle: 'イチニノサンダーと最強のサイリアン', implemented: true },
  { wall: 7, title: '城内・上層', subtitle: '取り戻したチカラで上層の守りを越える', implemented: true },
  { wall: 8, title: '王座への道', subtitle: '噴火する岩山をつらぬき王座の門へ', implemented: true },
  { wall: 9, title: '王座の間', subtitle: '最後の決戦', implemented: true },
];
// 最後の面（9-3）。クリアするとエンディング（紙芝居とエンドロール）へ
export const FINAL_STAGE = 86;

// Placed missions are not all mandatory clears. Each lesson is a prerequisite
// for its power; shortcuts skip practice routes, never a first power lesson.
export const CAMPAIGN_MISSIONS: WallMission[] = [
  // WALL 1: preserve the seven live missions, with a detached optional enemy lesson.
  { stage: 20, wall: 1, number: '1-1', title: 'セヴン目、はじめの一歩', theme: 'スコア1,000獲得',
    context: 'サイノメ城へ続く草原。まずは合計7で道を開こう。', kind: 'mission',
    requires: [], x: 34, y: 86, sevens: 0, superOnes: 0, scoreTarget: 1000, enemies: [] },
  { stage: 21, wall: 1, number: '1-2', title: 'コイツメを追い払え', theme: 'サイリアンをぜんぶ倒せ！',
    context: '草原の左の道は、小さな見張りたちがふさいでいる。', kind: 'mission',
    requires: [20], x: 12, y: 64, sevens: 0, superOnes: 0,
    enemyWaveSize: 2, enemies: Array.from({ length: 6 }, (_, i) => ({ x: i, kind: 'koitsume' as const })) },
  { stage: 22, wall: 1, number: '1-3', title: 'セヴン目で道を開け', theme: 'サイリアンをぜんぶ倒せ！',
    context: '右の道では、セヴン目を作りながら見張りも追い払う。', kind: 'mission',
    requires: [20], x: 62, y: 80, sevens: 0, superOnes: 0,
    enemies: Array.from({ length: 12 }, (_, i) => ({ x: i % 6, y: 12 - Math.floor(i / 6), kind: 'koitsume' as const })) },
  { stage: 23, wall: 1, number: '1-4', title: 'スーパー1', theme: 'お手本 → ミッション3回（3回目は通常出目）',
    context: 'ゾロメ仙人が、同じ目を集める最初のひっさつメを授ける。', kind: 'lesson',
    requires: [20], requiresAny: [21, 22], learns: 'spa1', sourceStage: 3,
    x: 34, y: 64, sevens: 0, superOnes: 3, enemies: [] },
  { stage: 24, wall: 1, number: '1-5', title: 'ひっさつメ、初仕事', theme: 'スコア2,000獲得',
    context: '覚えたばかりのスーパー1を、落ち着いてもう一度。', kind: 'mission',
    requires: [23], requiresAbilities: ['spa1'], x: 14, y: 40, sevens: 0, superOnes: 0, scoreTarget: 2000, enemies: [] },
  { stage: 25, wall: 1, number: '1-6', title: '門前の腕試し', theme: 'サイリアンをぜんぶ倒せ！',
    context: '見張りのいる盤面で、ひっさつメを実戦につなげる。', kind: 'mission',
    requires: [23], requiresAbilities: ['spa1'], x: 88, y: 58, sevens: 0, superOnes: 0, reinforceKoitsume: 3,
    enemies: [{ x: 0, kind: 'koitsume' }, { x: 3, kind: 'koitsume' }, { x: 6, kind: 'koitsume' }] },
  { stage: 26, wall: 1, number: '1-7', title: '門を守るサイリアン', theme: 'サイリアンをぜんぶ倒せ！',
    context: '草原の出口を守る一団。ひっさつメとセヴン目で突破しよう。', kind: 'boss',
    requires: [23], requiresAny: [24, 25], requiresAbilities: ['spa1'], x: 30, y: 18, sevens: 0, superOnes: 0, reinforceKoitsume: 3,
    enemies: [{ x: 0, kind: 'koitsume' }, { x: 1, kind: 'dame' }, { x: 3, kind: 'koitsume' }, { x: 5, kind: 'dame' }, { x: 6, kind: 'koitsume' }] },
  { stage: 27, wall: 1, number: '1-8', title: '草原の小さな見張り', theme: '倒し方のお手本 → 練習 → コイツメ3体',
    context: '寄り道の原っぱで、敵のとなりに7を作るコツを確かめよう。', kind: 'lesson', optional: true,
    requires: [20], sourceStage: 4, x: 88, y: 86, sevens: 0, superOnes: 0, enemies: [] },

  // WALL 2: chain, slash and square lessons cannot be bypassed.
  { stage: 28, wall: 2, number: '2-1', title: '街道のチェイン目', theme: 'お手本 → 2連鎖以上を2回',
    context: '一度消えた先に、次の7を仕込む。街道の入口でチェインを覚えよう。', kind: 'lesson',
    requires: [26], requiresAbilities: ['spa1'], sourceStage: 2,
    x: 22, y: 86, sevens: 0, superOnes: 0, enemies: [] },
  { stage: 29, wall: 2, number: '2-2', title: 'ななめに走るチカラ', theme: 'スラッシュ3のお手本 → 練習 → ミッション3回',
    context: '街道を斜めに横切る敵へ向けて、新しいひっさつメを覚える。', kind: 'lesson',
    requires: [28], requiresAbilities: ['spa1'], learns: 'sla3', sourceStage: 5,
    x: 50, y: 76, sevens: 0, superOnes: 0, enemies: [] },
  { stage: 30, wall: 2, number: '2-3', title: 'ダーメの二重の守り', theme: '倒し方のお手本 → 練習 → ダーメ2体',
    context: '堅い見張りには2回。安全な道でダーメの倒し方を確かめる。', kind: 'lesson',
    requires: [29], requiresAbilities: ['sla3'], sourceStage: 6,
    x: 16, y: 60, sevens: 0, superOnes: 0, enemies: [] },
  { stage: 31, wall: 2, number: '2-4', title: '斜めの見張り道', theme: 'サイリアンをぜんぶ倒せ！',
    context: '教室の代わりに実戦へ。斜めのひっさつメで二重の守りを崩す。', kind: 'mission',
    requires: [29], requiresAbilities: ['sla3'], x: 84, y: 70, sevens: 0, superOnes: 0, reinforceKoitsume: 1,
    seed: 'sla3',
    enemies: [{ x: 0, kind: 'dame' }, { x: 2, kind: 'koitsume' }, { x: 4, kind: 'koitsume' }, { x: 6, kind: 'dame' }] },
  { stage: 32, wall: 2, number: '2-5', title: '石畳のスクウェア4', theme: 'スクウェア4のお手本 → 練習 → ミッション3回',
    context: '街道の石畳にひそむ四角。4つの目を組み合わせるチカラを覚える。', kind: 'lesson',
    requires: [29], requiresAny: [30, 31], requiresAbilities: ['sla3'], learns: 'squ4', sourceStage: 7,
    x: 54, y: 44, sevens: 0, superOnes: 0, enemies: [] },
  { stage: 33, wall: 2, number: '2-6', title: '四角でひらく石畳', theme: 'サイリアンをぜんぶ倒せ！',
    context: '教わった四角を、街道の見張り相手に使ってみよう。', kind: 'mission',
    requires: [32], requiresAbilities: ['squ4'], x: 18, y: 26, sevens: 0, superOnes: 0, reinforceKoitsume: 2,
    seed: 'squ4',
    enemies: [{ x: 0, kind: 'koitsume' }, { x: 3, kind: 'koitsume' }, { x: 6, kind: 'koitsume' }] },
  { stage: 34, wall: 2, number: '2-7', title: '街道の四角い腕試し', theme: 'スコア4,000獲得',
    context: '敵を追う代わりに、四角を広げて得点を積み上げる道。', kind: 'mission',
    requires: [32], requiresAbilities: ['squ4'], x: 84, y: 32, sevens: 0, superOnes: 0, scoreTarget: 4000,
    seed: 'squ4', enemies: [] },
  { stage: 35, wall: 2, number: '2-8', title: '街道をふさぐダメダ～メ', theme: 'サイリアンをぜんぶ倒せ！',
    context: '街道の出口に見張りが集結。取り戻した3つのひっさつメを使い分ける。', kind: 'boss',
    requires: [32], requiresAny: [33, 34], requiresAbilities: ['spa1', 'sla3', 'squ4'], sourceStage: 8,
    x: 62, y: 16, sevens: 0, superOnes: 0, enemies: [] },

  // WALL 3: the hard route skips two practice missions, not either power lesson.
  { stage: 36, wall: 3, number: '3-1', title: '城下のストレイト6', theme: 'ストレイト6のお手本 → 練習 → ミッション3回',
    context: '長い城下の道を、ひっさつメで端から端までつらぬく。', kind: 'lesson',
    requires: [35], requiresAbilities: ['squ4'], learns: 'str6', sourceStage: 9,
    x: 78, y: 86, sevens: 0, superOnes: 0, enemies: [] },
  { stage: 37, wall: 3, number: '3-2', title: 'まっすぐな裏通り', theme: 'スコア6,000獲得',
    context: '低い足場のある裏通りで、まっすぐ並べるコツを固める。', kind: 'mission',
    requires: [36], requiresAbilities: ['str6'], x: 46, y: 84, sevens: 0, superOnes: 0, scoreTarget: 6000,
    seed: 'str6', enemies: [] },
  { stage: 38, wall: 3, number: '3-3', title: '城下の連なる見張り', theme: 'サイリアンをぜんぶ倒せ！',
    context: '裏通りの先では、チェインで崩した先に残る敵を追い払う。', kind: 'mission',
    requires: [37], x: 16, y: 70, sevens: 0, superOnes: 0, reinforceKoitsume: 2, boardRows: [1, 2],
    enemies: [{ x: 0, kind: 'dame' }, { x: 2, kind: 'koitsume' }, { x: 4, kind: 'koitsume' }, { x: 6, kind: 'dame' }] },
  { stage: 39, wall: 3, number: '3-4', title: '石壁を抜ける近道', theme: 'サイリアンをぜんぶ倒せ！',
    context: '裏通り2面を飛ばす険しい道。高い足場の見張りを追い払おう。', kind: 'shortcut',
    requires: [36], requiresAbilities: ['str6'], x: 86, y: 60, sevens: 0, superOnes: 0, reinforceKoitsume: 3,
    boardRows: [3, 4],
    enemies: [{ x: 0, kind: 'dame' }, { x: 3, kind: 'dame' }, { x: 6, kind: 'dame' }] },
  { stage: 40, wall: 3, number: '3-5', title: '城下に落ちる影', theme: 'サイリアンをぜんぶ倒せ！',
    context: '道が合流した先で、積み上がった盤面に大きな影が落ちる。', kind: 'mission',
    requires: [36], requiresAny: [38, 39], requiresAbilities: ['str6'], sourceStage: 10,
    x: 52, y: 56, sevens: 0, superOnes: 0, enemies: [] },
  { stage: 41, wall: 3, number: '3-6', title: '黒い笑顔のニコニコボム', theme: 'お手本 → 練習 → ニコニコボム2回',
    context: '苦しい盤面で助けになる、黒い笑顔のチカラを取り戻そう。', kind: 'lesson',
    requires: [40], requiresAbilities: ['str6'], learns: 'nico', sourceStage: 11,
    x: 40, y: 34, sevens: 0, superOnes: 0, enemies: [] },
  { stage: 42, wall: 3, number: '3-7', title: '笑顔の寄り道', theme: 'サイリアンをぜんぶ倒せ！',
    context: 'ニコニコメのある足場でひと休み。覚えたチカラを自由に試せる寄り道。', kind: 'mission', optional: true,
    requires: [41], requiresAbilities: ['nico'], x: 82, y: 26, sevens: 0, superOnes: 0, reinforceKoitsume: 3,
    seed: 'nico',
    enemies: [{ x: 0, kind: 'koitsume' }, { x: 3, kind: 'koitsume' }, { x: 6, kind: 'koitsume' }] },
  { stage: 43, wall: 3, number: '3-8', title: '城下のヒドイメ、ふたたび', theme: 'サイリアンをぜんぶ倒せ！',
    context: '城門への出口に、もう一度大きな影。黒い笑顔も味方につけよう。', kind: 'boss',
    requires: [41], requiresAbilities: ['nico'], sourceStage: 12,
    x: 18, y: 17, sevens: 0, superOnes: 0, enemies: [] },

  // WALL 4: fever -> chosen practice route -> waves -> rainbow -> swarm.
  { stage: 44, wall: 4, number: '4-1', title: '外壁でFEVER覚醒', theme: 'FEVERを覚え、コイツメ・ダーメ・ヒドイメを各1体',
    context: '高い外壁を前に、消える範囲を広げる覚醒のチカラを取り戻す。', kind: 'lesson',
    requires: [43], requiresAbilities: ['nico'], learns: 'fever', sourceStage: 13,
    x: 20, y: 86, sevens: 0, superOnes: 0, enemies: [] },
  { stage: 45, wall: 4, number: '4-2', title: '外壁沿いのセヴン目', theme: 'スコア12,000獲得',
    context: '壁沿いの安全な道。7を重ね、覚醒のチャンスをつかもう。', kind: 'mission',
    requires: [44], requiresAbilities: ['fever'], x: 52, y: 84, sevens: 0, superOnes: 0, scoreTarget: 12000,
    boardRows: [2, 3], enemies: [] },
  { stage: 46, wall: 4, number: '4-3', title: '斜めと四角の城壁', theme: 'サイリアンをぜんぶ倒せ！',
    context: '壁沿いの守備隊を、向きの違うひっさつメで崩す。', kind: 'mission',
    requires: [45], requiresAbilities: ['sla3', 'squ4', 'fever'], x: 84, y: 74, sevens: 0, superOnes: 0, reinforceKoitsume: 3,
    boardRows: [2, 3],
    enemies: [{ x: 0, kind: 'dame' }, { x: 2, kind: 'koitsume' }, { x: 4, kind: 'koitsume' }, { x: 6, kind: 'dame' }] },
  { stage: 47, wall: 4, number: '4-4', title: '城壁を駆ける近道', theme: 'サイリアンをぜんぶ倒せ！',
    context: '壁沿い2面を飛ばして城門へ。高い盤面で覚醒のチカラを生かす難路。', kind: 'shortcut',
    requires: [44], requiresAbilities: ['fever'], x: 18, y: 60, sevens: 0, superOnes: 0, reinforceKoitsume: 4,
    boardRows: [3, 5],
    enemies: [{ x: 0, kind: 'dame' }, { x: 2, kind: 'dame' }, { x: 4, kind: 'dame' }, { x: 6, kind: 'dame' }] },
  { stage: 48, wall: 4, number: '4-5', title: '城門守備隊、つぎつぎ現る', theme: 'サイリアンをぜんぶ倒せ！',
    context: '敵を倒すたび、次の守備隊が現れる。盤面を整えながら3段を越えよう。', kind: 'mission',
    requires: [44], requiresAny: [46, 47], requiresAbilities: ['fever'], sourceStage: 14,
    x: 50, y: 58, sevens: 0, superOnes: 0, enemies: [] },
  { stage: 49, wall: 4, number: '4-6', title: '城門前の虹ボム', theme: '絶体絶命から虹ボムを使う',
    context: '連戦を越えた城門前。追い詰められたときに使う虹のチカラを覚える。', kind: 'lesson',
    requires: [48], requiresAbilities: ['fever'], learns: 'rainbow', sourceStage: 15,
    x: 86, y: 42, sevens: 0, superOnes: 0, enemies: [] },
  { stage: 50, wall: 4, number: '4-7', title: '城門脇の最後の稽古', theme: 'サイリアンをぜんぶ倒せ！',
    context: '門の脇に残る稽古場。大きな戦いの前に、まっすぐなチカラを磨ける。', kind: 'mission', optional: true,
    requires: [49], requiresAbilities: ['str6', 'fever', 'rainbow'], x: 58, y: 12, sevens: 0, superOnes: 0, reinforceKoitsume: 5,
    seed: 'str6',
    enemies: [{ x: 0, kind: 'koitsume' }, { x: 3, kind: 'koitsume' }, { x: 6, kind: 'koitsume' }] },
  { stage: 51, wall: 4, number: '4-8', title: '城門のヒドイメ大行進', theme: 'サイリアンをぜんぶ倒せ！',
    context: '城門を守る最後の一団。増えていく大きな敵を越え、城内の前庭へ。', kind: 'boss',
    requires: [49], requiresAbilities: ['rainbow'], sourceStage: 16,
    x: 24, y: 18, sevens: 0, superOnes: 0, enemies: [] },

  // WALL 5: rematches change terrain/support, never enemy rules or invented foes.
  { stage: 52, wall: 5, number: '5-1', title: '前庭の四つのチカラ', theme: 'スコア24,000獲得',
    context: '城内に入っても旅は続く。取り戻したチカラで得点を積み上げよう。', kind: 'mission',
    requires: [51], requiresAbilities: ['spa1', 'sla3', 'squ4', 'str6', 'rainbow'],
    x: 50, y: 88, sevens: 0, superOnes: 0, scoreTarget: 24000, boardRows: [1, 2], enemies: [] },
  { stage: 53, wall: 5, number: '5-2', title: '前庭にベラボウメ現る', theme: 'サイリアンをぜんぶ倒せ！',
    context: '前庭の下から、これまでより大きな守り手が現れる。', kind: 'mission',
    requires: [52], sourceStage: 17,
    x: 50, y: 74, sevens: 0, superOnes: 0, enemies: [] },
  { stage: 54, wall: 5, number: '5-3', title: '庭園の二方向の守り', theme: 'サイリアンをぜんぶ倒せ！',
    context: '庭園を回り込む道。四角と直線で、端と中央の見張りを崩す。', kind: 'mission',
    requires: [53], requiresAbilities: ['squ4', 'str6'], x: 16, y: 62, sevens: 0, superOnes: 0, reinforceKoitsume: 6,
    boardRows: [2, 3],
    enemies: [{ x: 0, kind: 'dame' }, { x: 3, kind: 'dame' }, { x: 6, kind: 'dame' }] },
  { stage: 55, wall: 5, number: '5-4', title: '高い足場のヒドイメ', theme: 'サイリアンをぜんぶ倒せ！',
    context: '庭園の奥は足場が高い。6をまっすぐつなぎ、空間を取り戻そう。', kind: 'mission',
    requires: [54], requiresAbilities: ['str6'], sourceStage: 10, openingRows: [4, 5],
    x: 16, y: 34, sevens: 0, superOnes: 0, enemies: [] },
  { stage: 56, wall: 5, number: '5-5', title: '巨体を越える近道', theme: 'サイリアンをぜんぶ倒せ！',
    context: '庭園2面を飛ばす難路。高い足場と巨体を、斜めと四角で切り開く。', kind: 'shortcut',
    requires: [53], requiresAbilities: ['sla3', 'squ4'], sourceStage: 17, openingRows: [3, 5],
    x: 84, y: 52, sevens: 0, superOnes: 0, enemies: [] },
  { stage: 57, wall: 5, number: '5-6', title: '奥へ伸びるデタラメ', theme: 'サイリアンをぜんぶ倒せ！',
    context: '城の奥へ向かう道で、縦に伸びる新たな守り手と向き合う。', kind: 'mission',
    requires: [53], requiresAny: [55, 56], sourceStage: 18,
    x: 50, y: 30, sevens: 0, superOnes: 0, enemies: [] },
  { stage: 58, wall: 5, number: '5-7', title: '前庭のひっさつメ総稽古', theme: 'サイリアンをぜんぶ倒せ！',
    context: '奥へ進む前の任意の腕試し。7つのチカラを自由に組み合わせよう。', kind: 'mission', optional: true,
    requires: [57], requiresAbilities: ['rainbow'], x: 84, y: 22, sevens: 0, superOnes: 0, reinforceKoitsume: 7,
    boardRows: [3, 4],
    enemies: [{ x: 0, kind: 'dame' }, { x: 1, kind: 'koitsume' }, { x: 3, kind: 'dame' }, { x: 5, kind: 'koitsume' }, { x: 6, kind: 'dame' }] },
  { stage: 59, wall: 5, number: '5-8', title: '前庭のサイリアン総出演', theme: 'サイリアンをぜんぶ倒せ！',
    context: 'いままでの敵が前庭に集結。ここを越えれば城の奥へ。奪還の旅はまだ続く。', kind: 'boss',
    requires: [57], requiresAbilities: ['spa1', 'sla3', 'squ4', 'str6', 'nico', 'fever', 'rainbow'], sourceStage: 19,
    x: 50, y: 16, sevens: 0, superOnes: 0, enemies: [] },

  // WALL 6: ゾロメ仙人がイチニノサンダーを授け、すぐにアンチクショウメで試す。
  { stage: 60, wall: 6, number: '6-1', title: '仙人のイチニノサンダー', theme: 'イチニノサンダーを3回',
    context: '回廊の入口でゾロメ仙人が待っている。1・2・3をつなげて、なぞって落とすイナヅマのチカラ。', kind: 'lesson',
    requires: [59], learns: 'thunder', x: 80, y: 86, sevens: 0, superOnes: 0, thunderTarget: 3,
    boardRows: [1, 2], boostValues: [1, 2, 3], enemies: [] },
  { stage: 61, wall: 6, number: '6-2', title: 'アンチクショウメ現る', theme: 'アンチクショウメの目を撃ち抜け！',
    context: '回廊の奥に最強のサイリアン。目にひっさつメを当てたときだけ倒せる。イチニノサンダーで目を打ち抜け！', kind: 'mission',
    requires: [60], requiresAbilities: ['thunder'], x: 24, y: 80, sevens: 0, superOnes: 0, anchikushoume: true,
    boardRows: [1, 2], enemies: [] },
  { stage: 62, wall: 6, number: '6-3', title: 'デタラメの群れ', theme: 'サイリアンをぜんぶ倒せ！',
    context: '回廊にデタラメが次々わいてくる。同時に2体まで。ビームに気をつけて1体ずつ片づけろ。', kind: 'mission',
    requires: [61], requiresAbilities: ['thunder'], x: 22, y: 40, sevens: 0, superOnes: 0, detarameTotal: 5, detarameAtOnce: 2,
    enemies: [] },
  { stage: 63, wall: 6, number: '6-4', title: '門前の大乱戦', theme: 'アンチクショウメの目を撃ち抜け！',
    context: '門の前でデタラメ2体とアンチクショウメが待ちかまえる。ここを越えれば次のウォールへ。', kind: 'boss',
    requires: [62], requiresAbilities: ['thunder'], x: 66, y: 22, sevens: 0, superOnes: 0, anchikushoume: true,
    detarameTotal: 2, detarameAtOnce: 2, enemies: [] },
  // WALL 7: reuse established foes; branch choices and the side battle stay optional.
  // Keep reserved IDs 68–75 and their map positions; 64–67 remain unused.
  { stage: 68, wall: 7, number: '7-1', title: '上層への長い階段', theme: 'スコア30,000獲得',
    context: '回廊を越えて城の上層へ。広めの足場で得点を積み上げよう。', kind: 'mission',
    requires: [63], requiresAbilities: ['thunder'], x: 50, y: 84, sevens: 0, superOnes: 0, scoreTarget: 30000,
    boardRows: [2, 3], enemies: [] },
  { stage: 69, wall: 7, number: '7-2', title: '上層の交代守備隊', theme: 'サイリアンをぜんぶ倒せ！',
    context: '左の通路は二重の守り。見張りを倒すと次の一団が降ってくる。', kind: 'mission',
    requires: [68], x: 21, y: 65, sevens: 0, superOnes: 0, reinforceKoitsume: 5, boardRows: [3, 4],
    enemies: [{ x: 0, kind: 'dame' }, { x: 1, kind: 'koitsume' }, { x: 3, kind: 'dame' }, { x: 5, kind: 'koitsume' }, { x: 6, kind: 'dame' }] },
  { stage: 70, wall: 7, number: '7-3', title: '高楼のベラボウメ', theme: 'サイリアンをぜんぶ倒せ！',
    context: '右の通路では巨体が待つ。高い足場を整えながら大きな目を崩そう。', kind: 'mission',
    requires: [68], sourceStage: 17, openingRows: [4, 5],
    x: 79, y: 65, sevens: 0, superOnes: 0, enemies: [] },
  { stage: 71, wall: 7, number: '7-4', title: '吹き抜けのデタラメ', theme: 'サイリアンをぜんぶ倒せ！',
    context: '通路の合流先にデタラメが次々現れる。同時に2体まで。ビームの先にも気を配ろう。', kind: 'mission',
    requires: [68], requiresAny: [69, 70], x: 50, y: 46, sevens: 0, superOnes: 0,
    detarameTotal: 6, detarameAtOnce: 2, boardRows: [2, 3], enemies: [] },
  { stage: 72, wall: 7, number: '7-5', title: '天井からのヒドイメ', theme: 'サイリアンをぜんぶ倒せ！',
    context: '左の大広間には上から大きな影。メを消し続けて現れる3体を追い払おう。', kind: 'mission',
    requires: [71], sourceStage: 16, openingRows: [3, 4],
    x: 21, y: 29, sevens: 0, superOnes: 0, enemies: [] },
  { stage: 73, wall: 7, number: '7-6', title: '上層のアンチクショウメ', theme: 'アンチクショウメの目を撃ち抜け！',
    context: '右の大広間では動く目が道をふさぐ。盤面を整えて見えている目をねらおう。', kind: 'mission',
    requires: [71], x: 79, y: 29, sevens: 0, superOnes: 0, anchikushoume: true,
    boardRows: [3, 4], enemies: [] },
  { stage: 74, wall: 7, number: '7-7', title: '王座前の上層守備隊', theme: 'サイリアンをぜんぶ倒せ！',
    context: '上層の出口を守る連戦。小さな見張りから巨体まで越えて王座への道を開こう。', kind: 'boss',
    requires: [71], requiresAny: [72, 73], sourceStage: 19, openingRows: [3, 4],
    x: 50, y: 13, sevens: 0, superOnes: 0, enemies: [] },
  { stage: 75, wall: 7, number: '7-8', title: '階段脇の見張り詰所', theme: 'サイリアンをぜんぶ倒せ！',
    context: '階段脇の任意の寄り道。3体ずつ降ってくる見張りを片づけよう。', kind: 'mission', optional: true,
    requires: [68], x: 88, y: 86, sevens: 0, superOnes: 0, boardRows: [2, 3], enemyWaveSize: 3,
    enemies: Array.from({ length: 12 }, (_, i) => ({ x: i % 7, y: 9 - Math.floor(i / 7), kind: 'koitsume' as const })) },
  {stage:76,wall:8,number:'8-1',title:'王座への足がかり',theme:'スコア35,000獲得',context:'王座への足がかり。覚えたひっさつメで王座への道を開こう。',kind:'mission',requires:[74],requiresAbilities:['thunder','str6','sla3'],x:50,y:84,sevens:0,superOnes:0,scoreTarget:35000,boardRows:[2,3],enemies:[],},
  {stage:77,wall:8,number:'8-2',title:'火山手前の見張り道',theme:'アンチクショウメの目を撃ち抜け！',context:'火山手前の見張り道。アンチクショウメとデタラメが見張りに加わった。目を撃ち抜き、ビームより先に片づけろ。',kind:'mission',requires:[76],requiresAbilities:['thunder','str6','sla3'],x:21,y:65,sevens:0,superOnes:0,boardRows:[2,3],anchikushoume:true,detarameTotal:3,detarameAtOnce:2,enemies:[{x:0,kind:"dame"},{x:6,kind:"dame"},{x:1,kind:"koitsume"},{x:5,kind:"koitsume"}],},
  {stage:78,wall:8,number:'8-3',title:'サンザッパラナメ現る',theme:'サンザッパラナメの目を撃ち抜け！',context:'サンザッパラナメ現る。覚えたひっさつメで王座への道を開こう。',kind:'mission',requires:[76],requiresAbilities:['thunder','str6','sla3'],x:79,y:65,sevens:0,superOnes:0,sanzapparaname:true,sanzTurns:5,sanzVolley:2,enemies:[],},
  {stage:79,wall:8,number:'8-4',title:'噴火を読んで目を撃て',theme:'サンザッパラナメの目を撃ち抜け！',context:'噴火を読んで目を撃て。覚えたひっさつメで王座への道を開こう。',kind:'mission',requires:[76],requiresAbilities:['thunder','str6','sla3'],x:50,y:46,sevens:0,superOnes:0,requiresAny:[77,78],sanzapparaname:true,sanzTurns:5,sanzVolley:2,enemies:[],},
  {stage:80,wall:8,number:'8-5',title:'王座脇の伸びる守り',theme:'サイリアンをぜんぶ倒せ！',context:'王座脇の伸びる守り。覚えたひっさつメで王座への道を開こう。',kind:'mission',requires:[79],requiresAbilities:['thunder','str6','sla3'],x:21,y:29,sevens:0,superOnes:0,detarameTotal:2,detarameAtOnce:1,boardRows:[2,3],enemies:[],},
  {stage:81,wall:8,number:'8-6',title:'火山と左右の見張り',theme:'サンザッパラナメの目を撃ち抜け！',context:'火山と左右の見張り。覚えたひっさつメで王座への道を開こう。',kind:'mission',requires:[79],requiresAbilities:['thunder','str6','sla3'],x:79,y:29,sevens:0,superOnes:0,sanzapparaname:true,sanzTurns:4,sanzVolley:3,enemies:[{x:0,kind:"koitsume"},{x:6,kind:"dame"}],},
  {stage:82,wall:8,number:'8-7',title:'王座の門を守る噴火',theme:'サンザッパラナメの目を撃ち抜け！',context:'王座の門を守る噴火。覚えたひっさつメで王座への道を開こう。',kind:'boss',requires:[79],requiresAbilities:['thunder','str6','sla3'],x:50,y:13,sevens:0,superOnes:0,requiresAny:[80,81],sanzapparaname:true,sanzTurns:3,sanzVolley:3,enemies:[{x:0,kind:"dame"},{x:6,kind:"dame"}],},
  {stage:83,wall:8,number:'8-8',title:'王座前の総稽古',theme:'アンチクショウメの目を撃ち抜け！',context:'王座前の総稽古。アンチクショウメにデタラメ、見張りの増援まで総出の腕試し。',kind:'mission',requires:[76],requiresAbilities:['thunder','str6','sla3'],x:88,y:86,sevens:0,superOnes:0,optional:true,boardRows:[3,4],anchikushoume:true,detarameTotal:4,detarameAtOnce:2,reinforceKoitsume:5,enemies:[{x:0,kind:"dame"},{x:1,kind:"koitsume"},{x:5,kind:"koitsume"},{x:6,kind:"dame"}],},
  // WALL 9: 王座の間。3面で最後の決戦。最後のボスは未制作のため、9-3は既存の強敵を総動員した仮の決戦（2026-10-14）
  { stage: 84, wall: 9, number: '9-1', title: '王座の間の火口', theme: 'サンザッパラナメの目を撃ち抜け！',
    context: '王座の間の入口で、サンザッパラナメが噴火で道をふさぐ。見張りの増援にも気をつけろ。', kind: 'mission',
    requires: [82], requiresAbilities: ['thunder', 'str6', 'sla3'], x: 50, y: 84, sevens: 0, superOnes: 0,
    sanzapparaname: true, sanzTurns: 4, sanzVolley: 3, reinforceKoitsume: 5, boardRows: [2, 3],
    enemies: [{ x: 0, kind: 'dame' }, { x: 1, kind: 'koitsume' }, { x: 5, kind: 'koitsume' }, { x: 6, kind: 'dame' }] },
  { stage: 85, wall: 9, number: '9-2', title: '近衛のデタラメ', theme: 'サイリアンをぜんぶ倒せ！',
    context: '王座を守る近衛隊。デタラメが入れかわりで現れ、ビームで見張りを増やしてくる。', kind: 'mission',
    requires: [84], requiresAbilities: ['thunder', 'str6', 'sla3'], x: 24, y: 52, sevens: 0, superOnes: 0,
    detarameTotal: 6, detarameAtOnce: 2, reinforceKoitsume: 6, boardRows: [2, 3],
    enemies: [{ x: 0, kind: 'koitsume' }, { x: 2, kind: 'dame' }, { x: 4, kind: 'dame' }, { x: 6, kind: 'koitsume' }] },
  { stage: 86, wall: 9, number: '9-3', title: '王座の主（仮）', theme: 'アンチクショウメの目を撃ち抜け！',
    context: '王座の前に、城じゅうのサイリアンが集まる最後の決戦。最後のボスは制作中のため、いまは総力戦で代用。', kind: 'boss',
    requires: [85], requiresAbilities: ['thunder', 'str6', 'sla3'], x: 50, y: 20, sevens: 0, superOnes: 0,
    anchikushoume: true, detarameTotal: 4, detarameAtOnce: 2, reinforceKoitsume: 7, boardRows: [3, 4],
    enemies: [{ x: 0, kind: 'dame' }, { x: 1, kind: 'dame' }, { x: 2, kind: 'koitsume' }, { x: 4, kind: 'koitsume' }, { x: 5, kind: 'dame' }, { x: 6, kind: 'dame' }] },
];
export const WALL1: WallMission[] = CAMPAIGN_MISSIONS.filter(mission => mission.wall === 1);

// ===== ウラメン（2026-10-14）=====
// エンディングのあと「？？？」から入る黒い世界。王座の位置から下へ向かって、ウラ9 → ウラ1 と逆にたどる。
// 内部のウォール番号は 11〜19（11 がウラ9、19 がウラ1）。面の ID は 100〜126。
// 難易度はウラ9（ウォール6くらい）から、ウラ1（ウォール13くらいのつもり）まで上げていく。あとで面ごとに調整する前提の仮配置。
export const URA_FIRST_STAGE = 100;
export const URA_WALLS: CampaignWall[] = Array.from({ length: 9 }, (_, i) => ({
  wall: 11 + i, title: `ウラ${9 - i}`, subtitle: i === 8 ? 'ウラの底' : '黒い世界を下へ', implemented: true, ura: true,
}));
const URA_NAMES: Array<[string, string, string]> = [
  ['裏返った王座', '黒い火口', '影の近衛'],
  ['さかさの回廊', '黒い噴煙', '回廊の影'],
  ['沈む上層', 'くらやみの噴火', '上層の影'],
  ['裏の回廊', '黒煙の中庭', '影の総稽古'],
  ['夜の前庭', '黒い噴水', '前庭の影'],
  ['裏の城門', '影の火口', '城門の影'],
  ['黒い城下町', 'さかさの噴火', '城下の影'],
  ['裏の街道', '暗い火の山', '街道の影'],
  ['ウラの草原', 'ウラの火口', 'ウラの底のサイリアン'],
];
const uraSmalls = (count: number): WallMission['enemies'] =>
  [0, 6, 1, 5, 2, 4, 3].slice(0, count).map((x, k) => ({ x, kind: k % 2 ? 'dame' as const : 'koitsume' as const }));
export const URA_MISSIONS: WallMission[] = URA_NAMES.flatMap(([a, b, c], i) => {
  const wall = 11 + i, base = 100 + i * 3, label = `ウラ${9 - i}`;
  const smalls = Math.min(7, 4 + Math.floor(i / 2));
  const reinforce = Math.min(7, 4 + i);
  const left = i % 2 === 0;
  const common = { wall, ura: true, sevens: 0, superOnes: 0, requiresAbilities: ['thunder', 'str6', 'sla3'] as WallAbility[] };
  return [
    { ...common, stage: base, number: `${label}-1`, title: a, theme: 'サイリアンをぜんぶ倒せ！', kind: 'mission' as const,
      context: `${label}の入口。黒い世界のサイリアンが待ちかまえる。`,
      requires: [i === 0 ? FINAL_STAGE : base - 1], x: 50, y: 14, boardRows: [2, 3] as [number, number],
      detarameTotal: i >= 1 ? 1 + Math.floor(i / 2) : undefined, detarameAtOnce: i >= 6 ? 3 : 2,
      reinforceKoitsume: reinforce, enemies: uraSmalls(smalls) },
    { ...common, stage: base + 1, number: `${label}-2`, title: b, theme: 'サンザッパラナメの目を撃ち抜け！', kind: 'mission' as const,
      context: `${label}の火口。噴き出すサイリアンに気をつけて目を撃て。`,
      requires: [base], x: left ? 24 : 76, y: 46, boardRows: [2, 3] as [number, number],
      sanzapparaname: true, sanzTurns: Math.max(2, 5 - Math.floor(i / 3)), sanzVolley: Math.min(5, 2 + Math.floor(i / 2)),
      reinforceKoitsume: reinforce, enemies: uraSmalls(Math.max(2, smalls - 2)) },
    { ...common, stage: base + 2, number: `${label}-3`, title: c, theme: 'アンチクショウメの目を撃ち抜け！', kind: 'boss' as const,
      context: i === 8 ? 'ウラの底。黒い世界のサイリアンが総出で待つ、ほんとうの最後。' : `${label}の出口を守る影。倒して、さらに下へ。`,
      requires: [base + 1], x: 50, y: 72, boardRows: [3, 4] as [number, number],
      anchikushoume: true, detarameTotal: 2 + Math.floor(i / 2), detarameAtOnce: i >= 6 ? 3 : 2,
      reinforceKoitsume: Math.min(7, 5 + i), enemies: uraSmalls(Math.min(7, smalls + 1)) },
  ];
});
// ウラの最後の面（ウラ1-3）。クリアでウラエンディング
export const URA_FINAL_STAGE = 126;
export const ALL_MISSIONS: WallMission[] = [...CAMPAIGN_MISSIONS, ...URA_MISSIONS];
export const ALL_WALLS: CampaignWall[] = [...CAMPAIGN_WALLS, ...URA_WALLS];
// 面の番号の見せ方。表は「ウォール3-2」、ウラは「ウラ3-2」
export const wallNumberLabel = (mission: WallMission) => mission.ura ? mission.number : `ウォール${mission.number}`;
// エンディングを見たか（「？？？」＝ウラメンの入口を出す）
const ENDING_SEEN_KEY = 'sainome-ending-seen-v1';
export const loadEndingSeen = () => { try { return localStorage.getItem(ENDING_SEEN_KEY) === '1'; } catch { return false; } };
export const saveEndingSeen = () => { try { localStorage.setItem(ENDING_SEEN_KEY, '1'); } catch { /* 遊べればよい */ } };


// Reserved map positions only. Deliberately no goal, enemy, prerequisite or script:
// these slots cannot be looked up by wallMission or unlocked / launched.
export type FutureMission = {
  stage: number; wall: number; number: string; title: string; x: number; y: number; implemented: false;
};
export const FUTURE_MISSIONS: FutureMission[] = [
];

export const wallMission = (stage: number | null | undefined) => CAMPAIGN_MISSIONS.find(mission => mission.stage === stage)
  ?? URA_MISSIONS.find(mission => mission.stage === stage);
export const isWallStage = (stage: number | null): boolean => !!wallMission(stage);
export const wallForStage = (stage: number | null | undefined) => wallMission(stage)?.wall
  ?? FUTURE_MISSIONS.find(mission => mission.stage === stage)?.wall;
export const wallGate = (wall: number) => ALL_MISSIONS.find(mission => mission.wall === wall && mission.kind === 'boss')?.stage;

const POWER_NAMES: Record<WallAbility, string> = {
  spa1: 'スーパー1', sla3: 'スラッシュ3', squ4: 'スクウェア4', str6: 'ストレイト6',
  nico: 'ニコニコボム', fever: 'FEVER', rainbow: '虹ボム', thunder: 'イチニノサンダー',
};
export function wallAbilities(cleared: number[], activeStage?: number | null): WallAbility[] {
  const learned = CAMPAIGN_MISSIONS.filter(mission => mission.learns && cleared.includes(mission.stage))
    .map(mission => mission.learns!);
  const active = wallMission(activeStage);
  // A lesson temporarily enables its own power while teaching it. Starting an
  // unrelated high-numbered mission never grants a power or marks it learned.
  if (active?.learns && wallUnlocked(active.stage, cleared)) learned.push(active.learns);
  return [...new Set(learned)];
}

// All prerequisites AND one alternative in EVERY specified alternative group.
export function wallUnlocked(stage: number, cleared: number[]): boolean {
  if (stage === 0) return true;
  const mission = wallMission(stage);
  if (!mission) return false;
  return mission.requires.every(n => cleared.includes(n))
    && (!mission.requiresAny?.length || mission.requiresAny.some(n => cleared.includes(n)))
    && (!mission.requiresAnyGroups?.length || mission.requiresAnyGroups.every(group => group.some(n => cleared.includes(n))))
    && (!mission.requiresAbilities?.length || mission.requiresAbilities.every(ability => wallAbilities(cleared).includes(ability)));
}
export function wallUnlockHint(stage: number, cleared: number[]): string {
  const mission = wallMission(stage);
  if (!mission) return FUTURE_MISSIONS.some(slot => slot.stage === stage) ? '準備中' : '';
  const number = (n: number) => wallMission(n)?.number ?? String(n);
  const missing = mission.requires.filter(n => !cleared.includes(n)).map(number);
  const alternatives = [mission.requiresAny ?? [], ...(mission.requiresAnyGroups ?? [])];
  for (const group of alternatives) if (group.length && !group.some(n => cleared.includes(n))) {
    missing.push(`${group.map(number).join('／')}の${group.length === 2 ? 'どちらか' : 'いずれか'}`);
  }
  // Power lessons normally appear in the ancestry above; avoid repeating their
  // requirement unless it is the only missing condition (e.g. malformed input).
  if (!missing.length) for (const ability of mission.requiresAbilities ?? []) {
    if (!wallAbilities(cleared).includes(ability)) {
      const lesson = CAMPAIGN_MISSIONS.find(candidate => candidate.learns === ability);
      missing.push(lesson?.number ?? POWER_NAMES[ability]);
    }
  }
  return missing.length ? `${missing.join(' ＋ ')}をクリア` : '';
}

// The visible roads follow the same prerequisites used for unlocking. Cross-wall
// prerequisites are represented by the separate exit / next-wall control in UI.
export function wallLinks(wall: number): [number, number][] {
  const links: [number, number][] = [];
  const seen = new Set<string>();
  for (const mission of ALL_MISSIONS.filter(candidate => candidate.wall === wall)) {
    for (const from of [...mission.requires, ...(mission.requiresAny ?? []), ...(mission.requiresAnyGroups ?? []).flat()]) {
      if (wallMission(from)?.wall !== wall) continue;
      const key = `${from}:${mission.stage}`;
      if (!seen.has(key)) { links.push([from, mission.stage]); seen.add(key); }
    }
  }
  return links;
}

export type WallProgress = { cleared: number[]; gateReached: boolean; reachedWalls?: number[] };
export function loadWallProgress(): WallProgress {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(WALL_SAVE_KEY) || '{}');
    if (!raw || typeof raw !== 'object') return { cleared: [], gateReached: false };
    const saved = raw as { cleared?: unknown; gateReached?: unknown; reachedWalls?: unknown };
    const incoming = new Set(Array.isArray(saved.cleared) ? saved.cleared.filter((id): id is number => typeof id === 'number' && Number.isInteger(id)) : []);
    const cleared: number[] = incoming.has(0) ? [0] : [];
    // Resolve the prerequisite closure instead of trusting save order or stage ID.
    let changed = true;
    while (changed) {
      changed = false;
      for (const mission of ALL_MISSIONS) {
        if (incoming.has(mission.stage) && !cleared.includes(mission.stage) && wallUnlocked(mission.stage, cleared)) {
          cleared.push(mission.stage); changed = true;
        }
      }
    }
    cleared.sort((a, b) => a - b);
    const reached = Array.isArray(saved.reachedWalls) ? saved.reachedWalls : undefined;
    const gateReached = cleared.includes(WALL_BOSS) && (saved.gateReached === true || !!reached?.includes(1));
    const progress: WallProgress = { cleared, gateReached };
    // Do not rewrite old saves or require the additive field to advance.
    if (reached) progress.reachedWalls = CAMPAIGN_WALLS.filter(wall => wall.implemented
      && (reached.includes(wall.wall) || wall.wall === 1 && gateReached)
      && cleared.includes(wallGate(wall.wall)!)).map(wall => wall.wall);
    return progress;
  } catch { return { cleared: [], gateReached: false }; }
}
export function saveWallProgress(progress: WallProgress) {
  try { localStorage.setItem(WALL_SAVE_KEY, JSON.stringify(progress)); } catch { /* session still playable */ }
}
export const wallTitle = (stage: number) => stage === 0 ? '0メン『チュートリアル草原』'
  : wallMission(stage) ? `${wallNumberLabel(wallMission(stage)!)}『${wallMission(stage)!.title}』`
  : FUTURE_MISSIONS.some(slot => slot.stage === stage) ? `ウォール${FUTURE_MISSIONS.find(slot => slot.stage === stage)!.number}（準備中）`
  : '未実装のステージ';
