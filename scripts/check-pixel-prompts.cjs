const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
const code = ts.transpileModule(fs.readFileSync('src/pixel-prompts/model.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(code, { exports: exportsObject });
const { defaults, generatePrompts, validate, exportText } = exportsObject;
const initial = generatePrompts(defaults);
assert.equal(initial.length, 3);
assert(initial[0].summary.includes('最大8色'));
assert(initial[1].summary.includes('64×64px'));
assert(initial[2].summary.includes('陰影4段'));
const customized = generatePrompts({ ...defaults, selected: ['fc', 'sixteen', 'thirtytwo', 'modern'], colors: '16', width: '48', height: '80', shades: '2', transparent: false, frames: '12', fps: '10', loop: false, action: '歩行', motion: 'その場で歩く', notes: '<script>元絵の青いマフラー</script>' }, '参照.png');
assert.equal(customized.length, 4);
for (const pair of customized) {
  assert.equal(pair.summary, '最大16色 · 48×80px · 陰影2段');
  assert(pair.base.includes('ファイル名：参照.png'));
  assert(pair.base.includes('単色の白（#FFFFFF）'));
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
for (const update of [{ selected: [] }, { colors: '1' }, { width: '0' }, { height: '513' }, { shades: '9' }, { frames: '' }, { frames: '2.5' }, { fps: '0' }, { colors: 'NaN' }, { width: ' ' }]) assert(validate({ ...defaults, ...update }));
assert.equal(validate({ ...defaults, colors: '256', width: '512', height: '16', shades: '1', frames: '32', fps: '30' }), null);
const text = exportText(customized);
assert(text.includes('色数・画素寸法とは別'));
assert(text.includes('保証されません'));
assert.equal((text.match(/【基準画像/g) || []).length, 4);
assert.equal((text.match(/【連番アニメ/g) || []).length, 4);
assert(fs.existsSync('dist-gallery/pixel-prompts.html'), 'gallery build includes tool');
assert(!fs.existsSync('dist/pixel-prompts.html'), 'normal build excludes tool');
const normalAssets = fs.readdirSync('dist/assets');
assert(!normalAssets.some(name => name.startsWith('pixelPrompts-')), 'normal build excludes tool assets');
console.log('PASS: four presets, independent color/size/shading overrides, base/reference separation, identity/palette/coordinate locks, animation timing/loop, invalid input, export, gallery-only build.');
