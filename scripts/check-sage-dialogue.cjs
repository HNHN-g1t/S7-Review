/** Sage-only delivery copy. Actual App state + review catalog; no browser claims. */
const fs = require('fs'), Module = require('module'), assert = require('node:assert/strict');
const engine = fs.readFileSync(__dirname + '/check-campaign-engine.cjs', 'utf8');
const prefixEnd = engine.indexOf('const dialogueCatalog =');
let harness = engine.slice(0, prefixEnd);
harness = harness.replace('return {startStage,', 'return {setSaika,spokenLine,startStage,');
harness = harness.replace('read:()=>({story,', 'read:()=>({sageSpeaking,displayLine:spokenLine(saika.text),displayClear:spokenLine(clearLine),story,');
harness = harness.replace('    vm.runInNewContext(compile(source)', `    if (path === 'src/App.tsx') source += '\\nexport { SAGE_SHARED_VOICE, sageSpokenLine, BOMB_LESSONS, RAINBOW_LESSON_LINES, RAINBOW_LESSON_ASK, RAINBOW_LESSON_SAVED };';\n    vm.runInNewContext(compile(source)`);
const scenarios = String.raw`
const voice = load('src/App.tsx');
const catalog = voice.storyDialogueForReview;
const sages = new Set([23,29,32,36,41,49,60]);
for (const [sources, alternatives] of voice.SAGE_SHARED_VOICE) {
  assert.equal(sources.length,alternatives.length,'complete source/voice pairing');
  sources.forEach((source,index)=>{
    const expected=alternatives[index];
    assert(expected && !/[、]|ゾロメ仙人/.test(expected),'concise name-free sage copy');
    assert.equal(voice.sageSpokenLine(source,'ja',true),expected);
    assert.equal(voice.sageSpokenLine(source,'ja',false),source,'Saika/tutors unchanged');
    assert.equal(voice.sageSpokenLine(source,'en',true),source,'English is untouched');
    if(source.includes('{n}'))for(const n of [2,7,12,123]) {
      assert.equal(voice.sageSpokenLine(source.replace('{n}',n),'ja',true),expected.replace('{n}',n),'exact dynamic count preserved');
    }
  });
}
const visit=v=>typeof v==='string'?[v]:Array.isArray(v)?v.flatMap(visit):v&&typeof v==='object'?('ja'in v?[v.ja]:Object.values(v).flatMap(visit)):[];
for(const lesson of Object.values(voice.BOMB_LESSONS))for(const line of visit(lesson.lines))assert(!/[、]|ゾロメ仙人/.test(line),'all demo/practice/miss/reset lesson copy');
for(const line of [...voice.RAINBOW_LESSON_LINES.slice(1),voice.RAINBOW_LESSON_ASK,voice.RAINBOW_LESSON_SAVED])assert(!/[、]|ゾロメ仙人/.test(line.ja));
for(const mission of DATA.CAMPAIGN_MISSIONS) {
  assert(!mission.title.includes('ゾロメ仙人'),'no character name in game/map title');
  const lines=catalog(mission.stage), sage=sages.has(mission.stage);
  assert.equal(lines.some(l=>l.speaker==='ゾロメ仙人'),sage,mission.number+' exact teacher');
  for(const line of lines.filter(l=>l.speaker==='ゾロメ仙人')) {
    assert(!/[、]|ゾロメ仙人/.test(line.text),mission.number+' clean sage copy');
    assert(!['いい感じ いい感じ♪','どーだ！','やった〜‼︎','いぇ〜い‼︎','あと1回！'].includes(line.text),'no shared Saika reaction leak');
  }
  assert(lines.some(l=>l.text===(sage?'よい調子じゃ♪':[21,22,27,53,56,70].includes(mission.stage)?'ええ感じでんがな♪':'いい感じ いい感じ♪')),mission.number+' correct shared reaction');
}
assert(catalog(49).some(l=>l.speaker==='サイカ' && l.text===voice.RAINBOW_LESSON_LINES[0].ja),'rainbow alarm is still Saika');
const source=fs.readFileSync(root+'/src/App.tsx','utf8');
assert(!source.includes('<small>ゾロメ仙人</small>'));
assert(fs.readFileSync(root+'/src/story/WallMap.tsx','utf8').includes('alt="仙人"'));
assert(!fs.readFileSync(root+'/src/story/WallMap.tsx','utf8').includes('alt="ゾロメ仙人"')); 
assert(source.includes('{renderLine(dialoguePages[Math.min(dialoguePage, dialoguePages.length - 1)])}'));
assert(source.includes('{[...spokenLine(clearLine)].map'));
assert(source.includes('{renderLine(spokenLine(RAINBOW_HINT_LINE[lang]))}'));
assert(fs.readFileSync(root+'/src/enemy/characterNames.ts','utf8').includes("name: 'ゾロメ仙人'"),'gallery identity retained');
// Explicit first-four catalog entries must agree with current runtime wording.
const review=fs.readFileSync(root+'/src/story/reviewDialogue.ts','utf8');
assert(review.includes("text: 'ひっさつメを授けようぞ！'"));
assert(review.includes("text: 'いったん消すとしようかの'"));
(async()=>{
  for(const mission of DATA.CAMPAIGN_MISSIONS) {
    tree.startStage(mission.stage);await flush();
    tree.setSaika({text:'いい感じ いい感じ♪',mood:'smile'});await flush();
    assert.equal(tree.read().sageSpeaking,sages.has(mission.stage),mission.number+' actual App speaker');
    assert.equal(tree.read().displayLine,sages.has(mission.stage)?'よい調子じゃ♪':[21,22,27,53,56,70].includes(mission.stage)?'ええ感じでんがな♪':'いい感じ いい感じ♪');
    tree.setSaika({text:'いい感じ いい感じ♪',mood:'smile',who:'saika'});await flush();
    assert.equal(tree.read().displayLine,'いい感じ いい感じ♪',mission.number+' explicit Saika override');
    tree.backToTitle();await flush();
    assert.equal(tree.read().sageSpeaking,false,'exit clears sage delivery');
  }
  console.log('PASS: all 40 runtime speakers; dedicated lessons and shared reactions; Saika override/exit; dynamic counts; name-free game/map; review and gallery identity.');
})().catch(e=>{console.error(e);process.exitCode=1;});
`;
assert(prefixEnd>0 && harness.includes('export { SAGE_SHARED_VOICE'),'harness markers');
const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(harness+scenarios,__filename);

