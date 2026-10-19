// サウンドチャネル（レイヤー）と、そこへ流している音の一覧。確認用ページ（キャラクター図鑑）の表に使う。
// 実際の振り分けは App.tsx の getSfxBus('<channel>')。ここを書き換えたら scripts/check-sound-channels.cjs で
// App.tsx と食い違っていないか確かめる（関数名と channel の対応を照合する）。
export type SoundChannelId = 'operation' | 'effect' | 'enemy' | 'enemyHit' | 'enemyDefeat' | 'detarame' | 'impact' | 'thunder' | 'bgm';

export type SoundChannel = {
  id: SoundChannelId;
  name: string;
  route: string; // 音の通り道（圧縮・音量の扱い）
  sounds: Array<{ fn: string; label: string }>;
};

export const SOUND_CHANNELS: SoundChannel[] = [
  {
    id: 'operation',
    name: '操作',
    route: '等倍・圧縮なし → 最終リミッター。指の操作に遅れず、音量を変えない',
    sounds: [
      { fn: 'playRotateSound', label: '回転「カチッ」' },
      { fn: 'playHardDropSound', label: '一気に落とす' },
      { fn: 'playDiceRollSound', label: '起動のサイコロが転がる' },
      { fn: 'playDiceStopSound', label: '起動のサイコロが止まる「コトンッ・ピン」' },
    ],
  },
  {
    id: 'effect',
    name: '演出',
    route: 'コンプレッサー → 演出ミックス（敵の命中の瞬間だけ少し下がる） → 最終リミッター',
    sounds: [
      { fn: 'playHyoketsuIceSound', label: 'ヒョーケツボムの斜めスイープ「ぴきーん」' },
      { fn: 'playLockSound', label: '設置「トッ」（4通りの高さからランダム）' },
      { fn: 'playClearThump', label: '2連鎖以上・ひっさつメの腹に来る「ドン」' },
      { fn: 'playClearSound', label: 'セヴン目・チェインの消去音' },
      { fn: 'playBombLockSound', label: 'ひっさつメ成立の予告音' },
      { fn: 'playBombSound', label: 'ひっさつメの「花火」' },
      { fn: 'playFeverBombSound', label: 'FEVER中のひっさつメ「光の大輪」' },
      { fn: 'playFeverZoneSound', label: 'FEVERに入る「テューン！」' },
      { fn: 'playNicoChargeSound', label: 'ニコニコボムの溜め（悪役の咆哮つき）' },
      { fn: 'playNicoSound', label: 'ニコニコボムの発射' },
      { fn: 'playRainbowAwardSound', label: '虹ボム獲得' },
      { fn: 'playRainbowTickSound', label: '虹ボム「使う？」の秒読み' },
      { fn: 'playRainbowFireSound', label: '虹ボム発動' },
      { fn: 'playRainbowBurstSound', label: '虹ボムの破裂「シュパーン！」' },
      { fn: 'playClearStingSound', label: 'クリア直前の「デュルリリーン」' },
      { fn: 'playFanfareSound', label: 'メンクリアのファンファーレ' },
      { fn: 'playGateUnlockSound', label: '門のカギが開く' },
      { fn: 'playGameOverSound', label: 'ゲームオーバー「ヴェ〜」' },
    ],
  },
  {
    id: 'enemy',
    name: '敵の行動',
    route: 'コンプレッサー（演出とは別） → 最終リミッター。消去音に埋もれないよう独立',
    sounds: [
      { fn: 'playBerabouRageSound', label: 'ベラボウメの暴れ「ゴゴゴッ」' },
      { fn: 'playHidoimeCrushSound', label: 'ヒドイメ登場でサイを押しつぶす' },
      { fn: 'playPaintLaunchSound', label: 'アンチクショウメのペンキ発射「ぷしゅっ」' },
      { fn: 'playDevourSound', label: '敵がサイを食べる「ガブッ…モグモグ」（アンチクショウメ・デタラメ）' },
      { fn: 'playPaintSplatSound', label: 'アンチクショウメのペンキ「べちゃっ」' },
    ],
  },
  {
    id: 'enemyHit',
    name: '敵への命中',
    route: '専用コンプレッサー → 最終リミッター。敵の攻撃・撃破と同時に重ねる',
    sounds: [{ fn: 'playEnemyTrill', label: '命中「チュルルルッ」（ヒドイメ命中も）' }],
  },
  {
    id: 'enemyDefeat',
    name: '敵の撃破',
    route: '専用コンプレッサー → 最終リミッター。命中音の余韻を切らず重ねる',
    sounds: [{ fn: 'playEnemySquash', label: '撃破「ぷちゅん」「ぶちゅちゅんっ！」' }],
  },
  {
    id: 'detarame',
    name: 'デタラメのダメージ',
    route: '専用コンプレッサー → 最終リミッター。1イベント8声・同時16声、音源を共有して多重再生',
    sounds: [{ fn: 'playDetarameDamageSound', label: '目がつぶれる瞬間の「キュパッ」' }],
  },
  {
    id: 'impact',
    name: '白フラッシュ',
    route: '0.9倍・圧縮なし → 最終リミッター。敵が白く光る瞬間の破裂音',
    sounds: [{ fn: 'playEnemyFlashSound', label: '命中の白フラッシュ3連打' }],
  },
  {
    id: 'thunder',
    name: 'イチニノサンダー',
    route: '等倍・圧縮なし → 最終リミッター。ほかの音の圧縮や命中時の音量下げに巻き込まれない専用',
    sounds: [
      { fn: 'playThunderTraceSound', label: '光ったサイに触れる・なぞる「キラン」（3段で上がる）' },
      { fn: 'playThunderCountSound', label: '「イチ・ニノ」のカウント' },
      { fn: 'playThunderStrikeSound', label: '「ダー！」の雷鳴' },
    ],
  },
  {
    id: 'bgm',
    name: 'BGM',
    route: 'audio 要素で再生（効果音の系統とは別）',
    sounds: [
      { fn: 'playTitleBgm', label: 'タイトル曲' },
      { fn: 'switchToMapBgm', label: 'マップの曲（サイコロの目ごとに6曲・タイトルとフェードで切り替え）' },
      { fn: 'playBgm', label: 'プレイ中の曲' },
      { fn: 'playFeverBgm', label: 'FEVER中の曲' },
    ],
  },
];

