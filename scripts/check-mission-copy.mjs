/** Campaign practice has one clear condition; lessons retain their teaching goals. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const compile = source => ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const load = async path => import(`data:text/javascript;base64,${Buffer.from(compile(readFileSync(path,'utf8'))).toString('base64')}`);
const {CAMPAIGN_MISSIONS: missions} = await load('src/story/wall1.ts');
const o = await load('src/story/objectives.ts');
const by = n => missions.find(m=>m.number===n);
const scores = { '1-1':1000, '1-5':2000, '2-7':4000, '3-2':6000, '4-2':12000, '5-1':24000, '7-1':30000, '8-1':35000 };
const lessons = {
 '1-4':'スーパー1を本番で3回', '1-8':'コイツメを本番で3体倒す',
 '2-1':'2チェイン以上を2回', '2-2':'スラッシュ3を本番で3回', '2-3':'ダーメを本番で2体倒す',
 '2-5':'スクウェア4を本番で3回', '3-1':'ストレイト6を本番で3回', '3-6':'ニコニコボムを本番で2回',
 '4-1':'コイツメ・ダーメ・ヒドイメを各1体倒す', '4-6':'てっぺんで「使う？」が出たら虹ボムを使って助かる',
 '6-1':'イチニノサンダーを3回',
};
assert.equal(missions.length,63);
assert.deepEqual(missions.filter(m=>m.kind==='lesson').map(m=>m.number),Object.keys(lessons),'only the eleven teaching missions retain lesson goals');
assert.equal(missions.filter(m=>m.kind!=='lesson' && !m.scoreTarget).length,44);
for(const m of missions){
 const text=o.missionObjectiveText(m), guide=o.missionObjectiveGuide(m);
 const expected=lessons[m.number] ?? (scores[m.number] ? `スコア${scores[m.number].toLocaleString('ja-JP')}獲得` : m.sanzapparaname ? 'サンザッパラナメの目を撃ち抜け！' : m.anchikushoume ? 'アンチクショウメの目を撃ち抜け！' : 'サイリアンをぜんぶ倒せ！');
 assert.equal(text,expected,`${m.number}: exact single-goal / lesson copy`);
 assert(text.length>0 && text.length<=80,`${m.number}: concise full copy`);
 assert.equal(o.missionObjectiveText({...m,theme:'wrong historical theme'}),text,`${m.number}: ignores stale theme`);
 if(m.kind!=='lesson'){
  assert.equal(m.scoreTarget,scores[m.number],`${m.number}: score only on seven designated missions`);
  assert.equal(m.theme,text,`${m.number}: historical theme synchronized`);
  assert.equal(guide,text,`${m.number}: no extra clear requirement in guide`);
  assert(!/[＋]|残ってもOK|本番で|各\d回/.test(text+guide),`${m.number}: no old compound or lesson requirement`);
  for(const [key,value] of Object.entries({sevens:m.sevens,superOnes:m.superOnes,chainTarget:m.chainTarget??0,nicoTarget:m.nicoTarget??0,...m.bombTargets}))assert.equal(value,0,`${m.number}: rejects compound target ${key}`);
 }
 if(m.sourceStage!==undefined) assert.equal(o.missionGoalFor(m),o.STORY_GOALS[m.sourceStage],`${m.number}: source script identity is preserved`);
 if(m.sourceStage===undefined){
  const total=m.enemies.length+(m.reinforceKoitsume??0)+((m.anchikushoume||m.sanzapparaname)?1:0)+(m.detarameTotal??0);
  const parts=o.wallObjectiveParts(m,o.emptyWallCounts(),0,0,total);
  assert.equal(parts.length,1,`${m.number}: one progress unit`);
  assert.equal(parts[0].now,0);
  const counts={sevens:1e6,superOnes:1e6,nico:1e6,thunder:1e6,enemyKills:total,bombs:{spa1:1e6,sla3:1e6,squ4:1e6,str6:1e6}};
  assert(o.wallObjectiveParts(m,counts,1e6,1e6,0).every(p=>p.now===p.target));
 }
 if([5,7,9,11].includes(m.sourceStage))assert(guide.includes('練習2回') && guide.includes('練習分は本番に数えません'));
 console.log(`PASS ${m.number}: ${text}`);
}
assert(o.missionObjectiveGuide(by('1-4')).includes('3回目は通常の出目'));
assert(!o.missionObjectiveGuide(by('1-4')).includes('練習2回'));
assert(o.missionObjectiveGuide(by('4-1')).includes('FEVER発動回数の条件はありません'));
assert.equal(o.missionObjectiveText({...by('4-2'),scoreTarget:15000}),'スコア15,000獲得','copy follows the actual score target');
assert.equal(o.storyObjectiveText(o.STORY_GOALS[18],by('5-6')),'サイリアンをぜんぶ倒せ！','map context overrides historical special victory copy');
assert.equal(o.storyObjectiveText(o.STORY_GOALS[18]),'デタラメの目を全部消す（小敵は残ってもOK）','legacy linear copy is unchanged');
const appSource=readFileSync('src/App.tsx','utf8'), ast=ts.createSourceFile('App.tsx',appSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const declarations=[];const walk=n=>{if(ts.isVariableDeclaration(n))declarations.push(n);ts.forEachChild(n,walk);};walk(ast);
const stages=declarations.find(d=>d.name.getText(ast)==='STORY_STAGES').initializer.getText(ast);
const result=runInNewContext(compile(`(${stages})`),{STORY_GOALS:o.STORY_GOALS,ROWS:14,DAME:9,KOITSUME:8});
assert.equal(result[8].enemies.filter(e=>e.value===8).length,5,'2-8 actual Koitsume count');
assert.equal(result[8].enemies.filter(e=>e.value===9).length,5,'2-8 actual Dame count');
if(process.argv.includes('--write-audit')){
 let doc='# ミッション表示の照合（2026-10-06）\n\n通常30面は「得点」または「敵全滅」の1条件。習得10面は既存の授業を保持。ステージ帯は特訓中に「特訓中！」のみを表示し、本番からタイトルと目的を4秒ずつ交互表示する。単一目標への変更記録と検証状況は [単一目標化](mission-single-goals-20261006.md) を参照。\n\n|面|帯の目的|開始前の案内|\n|---|---|---|\n';
 for(const m of missions)doc+=`|${m.number}|${o.missionObjectiveText(m)}|${o.missionObjectiveGuide(m)}|\n`;
 doc+='\n## 表示仕様\n\n- 目的の数値は実クリア判定と同じデータから生成。themeは表示の原本にせず、通常面のthemeも同じ単一目標へ同期。\n- 通常面は得点または残敵の1条件。技の発動回数・チェイン回数を追加条件にしない。既習技のseed・出目支援・足場は残す。\n- 1-2の分割出現、1-6/1-7の増援、4-5/5-8の全波、4-8の未出現分、5-6/5-8で生まれた小敵を含めて全滅が必要。\n- 4-1は教室として既存条件を保持し、FEVER回数条件はない。大型敵の耐久力・最後の目の倒し方は従来どおり。\n- pause時はタイマーを解除、resumeで次の4秒を開始。同じ面の再試行・面移動は新しいrunとしてタイトルに戻り、clear・退出・unmount時に解除。\n- 帯の既存レイアウトとスマホの追加余白14pxは維持。\n\n## この表の検証\n\n`node scripts/check-mission-copy.mjs --write-audit` は全40面の正確な文面、習得10面の分類、通常面の追加条件禁止、目標データとの同期、sourceStageの型・target維持を検証してから表を生成する。実エンジン・ブラウザー・本番配信の確認はこのスクリプトに含まれず、[単一目標化の検証欄](mission-single-goals-20261006.md#検証)で別記する。\n';
 writeFileSync('docs/mission-banner-20261006.md',doc);
}
console.log('PASS: all 52 objective copies; 7 score / 34 defeat / 11 lesson goals; source script identity; no compound practice targets or stale theme.');
