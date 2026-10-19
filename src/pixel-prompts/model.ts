export const presets = [
  { id: 'fc', label: '8bit風', name: 'ファミコン風', description: '少ない色と大きな色面。輪郭をくっきり。', colors: 8, size: 32, shades: 2, outline: '暗色の1px輪郭', dither: '使わない', style: 'ファミコン世代を連想する簡潔なドット絵。少ない色でシルエットを明快にし、大きな色面と意図的なピクセルの塊で描く。厳密なファミコンのハード制約・実機パレットの再現ではない。' },
  { id: 'sixteen', label: '16bit風', name: 'クラシック', description: '整理した色面に、控えめな立体感。', colors: 32, size: 64, shades: 3, outline: '部位の色に合わせた1px輪郭', dither: '使わない', style: '16bit世代を連想する手打ちのドット絵。読みやすい色の塊、節度あるハイライトと段階的な陰影で立体感を付ける。' },
  { id: 'thirtytwo', label: '32bit風', name: 'リッチな陰影', description: '細かな表情と、深みのある色の階段。', colors: 64, size: 96, shades: 4, outline: '部位の色に合わせた1px輪郭', dither: '陰影境界に限定した規則的なディザリング', style: '32bit世代の高密度な2D作品を連想するドット絵。表情と質感を丁寧に残し、色相も変化する段階的な陰影を使う。ピクセルの境界は明確に保つ。' },
  { id: 'modern', label: '現代ドット', name: '高精細', description: '豊かな質感を、明確なピクセルで。', colors: 128, size: 128, shades: 5, outline: '部位の色に合わせた1px輪郭', dither: '陰影境界に限定した規則的なディザリング', style: '現代的で精緻なピクセルアート。豊かな色と多段階の陰影で質感を出す。ただし連続的なグラデーションやぼかしにはせず、ひとつずつ意図を持って配置した色の塊で描く。' },
] as const;

export const backgrounds = [
  { id: 'white', label: '白', hex: '#FFFFFF', rgb: '255, 255, 255' },
  { id: 'green', label: 'G255（純緑）', hex: '#00FF00', rgb: '0, 255, 0' },
  { id: 'gray-light', label: 'グレー・明', hex: '#C0C0C0', rgb: '192, 192, 192' },
  { id: 'gray-medium', label: 'グレー・中', hex: '#808080', rgb: '128, 128, 128' },
  { id: 'gray-dark', label: 'グレー・暗', hex: '#404040', rgb: '64, 64, 64' },
  { id: 'transparent', label: '透明', hex: null, rgb: null },
] as const;

export const fidelityLevels = [
  { id: 'weak', label: '弱' }, { id: 'medium', label: '中' }, { id: 'strong', label: '強' },
] as const;
export const fidelityFields = [
  { key: 'skinFidelity', label: '肌色' }, { key: 'eyeFidelity', label: '目の印象' }, { key: 'faceFidelity', label: '顔の輪郭' },
] as const;
export type Fidelity = typeof fidelityLevels[number]['id'];
export type Background = typeof backgrounds[number]['id'];

const fidelityInstructions: Record<typeof fidelityFields[number]['key'], Record<Fidelity, string>> = {
  skinFidelity: {
    weak: '肌色の大まかな色相・明暗関係と人物らしさを保ち、少数の代表色への簡略化を許容する。',
    medium: '肌色の主要な色相・明度と顔全体の印象を優先して残し、細かな陰影を整理する。',
    strong: '参照画像で確認できる肌の色相・明度・彩度と部位間の色の関係を厳密に参照する。選択したパレット内で最も近い色へ対応付け、ドット化に必要な最小限の減色・省略だけを行う。',
  },
  eyeFidelity: {
    weak: '人物らしい目の印象を保ち、目・瞳・まぶたの細部は読みやすいピクセルの塊へ簡略化してよい。',
    medium: '目の形・傾き・間隔、瞳の大きさと視線が生む主要な印象を優先し、識別に影響しない細部を整理する。',
    strong: '参照画像で確認できる目の縦横比、位置と間隔、まぶた・瞳の形と位置関係、配色を厳密に守る。印象を変えず、ドット化に必要な最小限の省略だけを行う。',
  },
  faceFidelity: {
    weak: '人物の特徴が分かる頭部のシルエットを保ち、頬・顎・額の細かな曲線は簡略化してよい。',
    medium: '頬・顎・額の主要なラインと頭部の印象を優先し、輪郭の細かな凹凸を整理する。',
    strong: '参照画像で確認できる頬・顎・額の輪郭形状、顔の幅と高さの比率、輪郭と目鼻口の位置関係を厳密に守る。ドット化に必要な最小限の段差化・省略だけを行う。',
  },
};

export type Settings = {
  selected: string[];
  colors: string;
  width: string;
  height: string;
  shades: string;
  outline: string;
  dither: string;
  background: Background;
  skinFidelity: Fidelity;
  eyeFidelity: Fidelity;
  faceFidelity: Fidelity;
  action: string;
  motion: string;
  frames: string;
  fps: string;
  loop: boolean;
  features: string[];
  notes: string;
};

export const defaults: Settings = {
  selected: ['fc', 'sixteen', 'thirtytwo'], colors: '', width: '', height: '', shades: '', outline: '', dither: '', background: 'white',
  skinFidelity: 'medium', eyeFidelity: 'medium', faceFidelity: 'medium',
  action: '待機', motion: '小さな呼吸と自然なまばたき', frames: '8', fps: '8', loop: true,
  features: ['シルエット・頭身', '顔立ち・表情', '元絵の配色', '衣装・模様', '持ち物・装飾'], notes: '',
};

export function validate(settings: Settings): string | null {
  if (!presets.some(p => settings.selected.includes(p.id))) return '画風を1つ以上選んでください。';
  if (!backgrounds.some(background => background.id === settings.background)) return '背景色を選んでください。';
  if (fidelityFields.some(field => !fidelityLevels.some(level => level.id === settings[field.key]))) return '肌色・目の印象・顔の輪郭の忠実度をそれぞれ選んでください。';
  for (const [label, value, min, max, optional] of [
    ['色数', settings.colors, 2, 256, true], ['幅', settings.width, 16, 512, true], ['高さ', settings.height, 16, 512, true],
    ['陰影段数', settings.shades, 1, 8, true], ['コマ数', settings.frames, 2, 32, false], ['FPS', settings.fps, 1, 30, false],
  ] as const) {
    if (optional && value === '') continue;
    const n = Number(value);
    if (value.trim() === '' || !Number.isInteger(n) || n < min || n > max) return `${label}は${min}〜${max}の整数で指定してください。`;
  }
  return null;
}

export type PromptPair = { id: string; title: string; summary: string; base: string; animation: string };

export function generatePrompts(settings: Settings, referenceName?: string): PromptPair[] {
  const error = validate(settings);
  if (error) throw new Error(error);
  const background = backgrounds.find(option => option.id === settings.background)!;
  return presets.filter(p => settings.selected.includes(p.id)).map(p => {
    const colors = Number(settings.colors || p.colors);
    const width = Number(settings.width || p.size);
    const height = Number(settings.height || p.size);
    const shades = Number(settings.shades || p.shades);
    const frames = Number(settings.frames);
    const identity = [
      settings.features.length ? `特に維持する特徴：${settings.features.join('、')}。` : '参照画像のキャラクターの同一性を最優先する。',
      settings.notes.trim() ? `元絵の固有特徴・追加指定：${settings.notes.trim()}` : '',
      '参照画像にない服、模様、装飾、手足、文字を加えない。見えない部位は断定せず、元絵と矛盾しない最小限の補完にする。',
      '忠実度の指定は、参照画像で該当部位を確認できる場合だけ適用する。見えない特徴や肌の色を断定せず、該当しない対象に人間の肌や目を追加しない。',
      ...fidelityFields.map(field => `${field.label}の忠実度：${fidelityLevels.find(level => level.id === settings[field.key])!.label}。${fidelityInstructions[field.key][settings[field.key]]}`),
      `どの忠実度でも人物・キャラクターの特徴と同一性を維持する。厳密さは選択した総色数・基準寸法の範囲内で追求し、強でも色数上限を超える新色や元画像の全画素色の完全保持は要求しない。色が不足する場合は${background.hex === null ? '透明を維持し' : '指定背景色を固定し'}、使用可能なパレット枠で顔の主要な色・形・比率を優先する。`,
    ].filter(Boolean).join('\n');
    const backgroundInstruction = background.hex === null
      ? '完全透明のPNG。固定の背景色は使わない。半透明の縁・マット・影のにじみを付けない。市松模様を画像に描き込まない。'
      : `単色の${background.label}（${background.hex} / RGB ${background.rgb}）、全域不透明。背景は必ずこのHEX値の1色に固定し、総色数${colors}色のうち1枠を確保する。背景色以外の不透明色は最大${colors - 1}色。減色時も背景色を近似色へ置換しない。背景に影・グラデーション・ディザリング・柄・風景を加えず、半透明の縁や別色のマットを付けない。`;
    const spec = `画風：${p.label} / ${p.name}。${p.style}\nキャンバス：${width}×${height}px。ここが基準ピクセル寸法。1ドット＝1画素の正方形グリッド。拡大納品する場合は整数倍・ニアレストネイバーのみ。\nパレット：不透明色は全体で最大${colors}色（透明は別枠）。元絵の主要色を優先して減色し、陰影・輪郭・ディザリングもこのパレット内だけで描く。\n陰影：1つの素材・色系統につき基本色を含め最大${shades}段階。総色数の上限を優先する。${shades === 1 ? '陰影を加えずベタ塗りにする。' : '光源は左上に統一する。'}\n輪郭：${settings.outline || p.outline}。\nディザリング：${settings.dither || p.dither}。\n背景：${backgroundInstruction}`;
    const base = `【基準画像 / ${p.label}・${p.name}】\n添付するもの：元の参照画像${referenceName ? `（ファイル名：${referenceName}）` : '1枚'}。この文章だけで元絵を推測せず、画像を参照する。\n目的：元絵の特徴を忠実に残した、連番アニメの基準となるドット絵を1枚作る。\n\n${identity}\n\n${spec}\n\n構図：キャラクター全体をキャンバス内に収め、上下左右に約8%の安全余白を取る。向きと視点は元絵を維持。正面へ勝手に描き直さない。基準ポーズは安定した中立姿勢。接地点は下端から約8%上、体の基準軸は左右中央。元絵の体格・頭身・顔の比率を保つ。\n\nドットの品質：アンチエイリアス、ぼかし、写真調、3Dレンダリング、ベクター風の滑らかな線、連続グラデーション、ランダムな1pxノイズを避ける。輪郭と色面はピクセル単位で整理する。\n出力：基準画像1枚のPNG。文字・枠・見本一覧を画像内に加えない。可能なら、使用した色のHEX一覧と接地点・基準軸の座標を画像外のテキストで記録する。生成後に手動でパレットとピクセルを確認し、この画像を確定版として保存する。`;
    const animation = `【連番アニメ / ${p.label}・${p.name}】\n添付するもの：上の手順で生成・確認した、この画風の確定済み基準画像を再添付する。元の参照画像も併せて添付できるが、画風・色・寸法の正本は確定済み基準画像とする。別の画風の基準画像を混ぜない。\n目的：添付した基準キャラクターを描き直さず、同一個体の${settings.action}アニメを全${frames}コマで作る。\n動作の具体的な指示：${settings.motion.trim() || settings.action}。\n再生速度：${settings.fps}fps（1コマ約${Math.round(1000 / Number(settings.fps))}ms）。${settings.loop ? 'シームレスループ。最後のコマから最初へ自然につながり、先頭と同じコマを末尾に重複させない。' : '1回再生。動作の始まりと終わりが明確につながる。'}\n\n${identity}\n\n${spec}\n\n全コマで固定：\n・確定済み基準画像のパレット（使用色のHEX値）をそのまま使う。新色・色替わり・光源の変化を禁止。\n・1コマは${width}×${height}px、余白と座標系を固定。自動クロップ、コマごとのリサイズ、カメラ移動、ズームは禁止。\n・基準軸と接地点の座標を基準画像から引き継ぐ。歩く・走る動作はその場で行う。ジャンプなど指定動作に必要な移動だけを許し、意図しない位置ずれを出さない。\n・体格、頭身、頭の大きさ、顔・目の配置、衣装、模様、装飾、線幅を固定する。ポーズに必要な変形だけを行い、コマごとの別デザイン化を避ける。\n・輪郭のちらつき、手足や装飾の増減、テクスチャの泳ぎ、半透明の縁、アンチエイリアス、ぼかしを避ける。\n\n${settings.loop ? `動作周期を${frames}分割し、位相0/${frames}〜${frames - 1}/${frames}の順で各コマを作る。` : `動作の開始から終了までを${frames}コマへ順に分割する。`}各コマの意味と順序を保ち、不要な揺れを追加しない。\n出力：frame_001.png〜frame_${String(frames).padStart(3, '0')}.png の同寸法PNG連番。個別ファイル出力ができない場合は、余白・間隔0、横${frames}列×縦1行、全体${width * frames}×${height}pxのシート1枚にする。シート内の各セルは必ず${width}×${height}px、左から時系列。番号・ラベル・枠を画像に描き込まない。最終的な色数・寸法・コマ間一致は人が確認し、必要なら修正する。`;
    return { id: p.id, title: `${p.label} / ${p.name}`, summary: `最大${colors}色 · ${width}×${height}px · 陰影${shades}段`, base, animation };
  });
}

export function exportText(pairs: PromptPair[]): string {
  return `ドット絵プロンプト工房\n使い方：各画風の「基準画像」で1枚を生成・確認 → 確定済み基準画像を再添付して「連番アニメ」を使う。\n8bit / 16bit / 32bit はハード世代のイメージです。色数・画素寸法とは別で、実機制約の再現ではありません。\nAIによる忠実性・厳密なドット・コマ間一致は保証されません。生成結果の確認と修正が必要です。\n\n${pairs.map(pair => `${'='.repeat(48)}\n${pair.title} / ${pair.summary}\n\n${pair.base}\n\n${pair.animation}`).join('\n\n')}\n`;
}
