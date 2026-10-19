const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
const code = ts.transpileModule(fs.readFileSync('src/pixel-prompts/model.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(code, { exports: exportsObject });
const { backgrounds, defaults, fidelityFields, fidelityLevels, generatePrompts, validate, exportText, presets } = exportsObject;
assert.equal(defaults.background, 'white');
for (const field of fidelityFields) assert.equal(defaults[field.key], 'medium');
const initial = generatePrompts(defaults);
assert.equal(initial.length, 3);
assert(initial[0].summary.includes('最大8色'));
assert(initial[1].summary.includes('64×64px'));
assert(initial[2].summary.includes('陰影4段'));
const customized = generatePrompts({ ...defaults, selected: ['fc', 'sixteen', 'thirtytwo', 'modern'], colors: '16', width: '48', height: '80', shades: '2', background: 'white', frames: '12', fps: '10', loop: false, action: '歩行', motion: 'その場で歩く', notes: '<script>元絵の青いマフラー</script>' }, '参照.png');
assert.equal(customized.length, 4);
for (const pair of customized) {
  assert.equal(pair.summary, '最大16色 · 48×80px · 陰影2段');
  assert(pair.base.includes('ファイル名：参照.png'));
  assert(pair.base.includes('単色の白（#FFFFFF / RGB 255, 255, 255）'));
  assert(pair.animation.includes('全12コマ'));
  assert(pair.animation.includes('10fps（1コマ約100ms）'));
  assert(pair.animation.includes('1回再生'));
  assert(!pair.animation.includes('シームレスループ'));
  assert(pair.animation.includes('全体576×80px'));
  for (const instruction of ['確定済み基準画像を再添付', 'パレット（使用色のHEX値）', '体格、頭身', '座標系を固定', 'アンチエイリアス']) assert(pair.animation.includes(instruction), instruction);
}
assert(initial[0].animation.includes('先頭と同じコマを末尾に重複させない'));
assert(initial[0].animation.includes('位相0/8〜7/8'));
assert(initial[0].base.includes('厳密なファミコンのハード制約・実機パレットの再現ではない'));
for (const update of [{ selected: [] }, { colors: '1' }, { width: '0' }, { height: '513' }, { shades: '9' }, { frames: '' }, { frames: '2.5' }, { fps: '0' }, { colors: 'NaN' }, { width: ' ' }, { background: 'unknown' }, { skinFidelity: 'unknown' }, { eyeFidelity: undefined }, { faceFidelity: '' }]) assert(validate({ ...defaults, ...update }));
assert.equal(validate({ ...defaults, colors: '256', width: '512', height: '16', shades: '1', frames: '32', fps: '30' }), null);
const text = exportText(customized);
assert(text.includes('色数・画素寸法とは別'));
assert(text.includes('保証されません'));
assert.equal((text.match(/【基準画像/g) || []).length, 4);
assert.equal((text.match(/【連番アニメ/g) || []).length, 4);

// All six backgrounds × all 27 independent fidelity combinations × four styles × both prompts.
let combinations = 0;
for (const background of backgrounds) for (const skin of fidelityLevels) for (const eye of fidelityLevels) for (const face of fidelityLevels) {
  const pairs = generatePrompts({ ...defaults, selected: presets.map(preset => preset.id), colors: '2', background: background.id, skinFidelity: skin.id, eyeFidelity: eye.id, faceFidelity: face.id });
  assert.equal(pairs.length, 4);
  for (const pair of pairs) for (const output of [pair.base, pair.animation]) {
    for (const [label, level] of [['肌色', skin.label], ['目の印象', eye.label], ['顔の輪郭', face.label]]) assert(output.includes(`${label}の忠実度：${level}。`));
    assert(output.includes('参照画像で該当部位を確認できる場合だけ適用'));
    assert(output.includes('強でも色数上限を超える新色や元画像の全画素色の完全保持は要求しない'));
    const instruction = output.split('\n').find(line => line.startsWith('背景：'));
    assert(instruction);
    if (background.hex === null) {
      assert(instruction.includes('完全透明のPNG'));
      assert(!output.includes('背景：単色'));
      assert(!/#[0-9A-F]{6}/.test(instruction));
      assert(!output.includes('背景色以外の不透明色は最大1色'));
    } else {
      assert(instruction.includes(background.hex));
      assert(instruction.includes('全域不透明'));
      assert(instruction.includes('背景色以外の不透明色は最大1色'));
      assert(instruction.includes('減色時も背景色を近似色へ置換しない'));
      assert(instruction.includes('背景に影・グラデーション・ディザリング・柄・風景を加えず'));
      assert(!output.includes('完全透明のPNG'));
      for (const other of backgrounds) if (other.hex && other.id !== background.id) assert(!instruction.includes(other.hex));
    }
  }
  const exported = exportText(pairs);
  for (const pair of pairs) assert(exported.includes(pair.base) && exported.includes(pair.animation));
  combinations++;
}
assert.equal(combinations, 162);
for (const field of fidelityFields) {
  const descriptions = fidelityLevels.map(level => generatePrompts({ ...defaults, [field.key]: level.id })[0].base.split('\n').find(line => line.startsWith(`${field.label}の忠実度：`)).split('。').slice(1).join('。'));
  assert.equal(new Set(descriptions).size, 3, `${field.label}: strengths have different instructions`);
}
assert(fs.existsSync('dist-gallery/pixel-prompts.html'), 'gallery build includes tool');
assert(!fs.existsSync('dist/pixel-prompts.html'), 'normal build excludes tool');
const normalAssets = fs.readdirSync('dist/assets');
assert(!normalAssets.some(name => name.startsWith('pixelPrompts-')), 'normal build excludes tool assets');
console.log('PASS: white/medium defaults; six exclusive backgrounds; 162 background/fidelity combinations across all styles and both prompts/exports; palette-budget and reference guards; existing generation and gallery isolation.');
