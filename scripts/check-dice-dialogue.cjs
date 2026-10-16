/**
 * Futatsume/Gomoku-only delivery copy, using actual App state and review data.
 * Reuses the virtual-clock React-hook harness; this is not browser/layout QA.
 */
const fs = require('fs'), Module = require('module'), assert = require('node:assert/strict');
const engine = fs.readFileSync(__dirname + '/check-campaign-engine.cjs', 'utf8');
const prefixEnd = engine.indexOf('const dialogueCatalog =');
let harness = engine.slice(0, prefixEnd);
harness = harness.replace('return {startStage,', 'return {setSaika,setTutorTurn,setLang,setClearLine,setStatus,completeStage,spokenLine,pendingAward,spawnNext,startEndless,startStage,');
harness = harness.replace('read:()=>({story,', 'read:()=>({speakingDie,sageSpeaking,tutorTurn,rainbowAward,rainbowStock:rainbowStockRef.current,displayLine:spokenLine(saika.text),displayClear:spokenLine(clearLine),displayHint:spokenLine(RAINBOW_HINT_LINE[lang]),story,');
harness = harness.replace("require: name => name === 'react'", "require: name => name === '../App' ? load('src/App.tsx') : name === './wall1' ? load('src/story/wall1.ts') : name === 'react'");
harness = harness.replace('    vm.runInNewContext(compile(source)', `    if (path === 'src/App.tsx') source += '\\nexport { DICE_KANSAI_VOICE, CLEAR_LINES, TUTOR_PAIRS, TUTOR_RESCUE, TUTOR_PANIC, KOI_LINES, BERABOU_LINES, BERABOU_HEAL_LINES, BERABOU_GUARD_LINE, BERABOU_LAST_LINE, berabouHitLine, SAIKA_STORY_LINES, IDLE_KOITSUME, IDLE_BERABOU, IDLE_FEVER, BOMB_CALLS, RAINBOW_HINT_LINE, FEVER_AWAKEN_LINE, MISSION_LAST_ENEMY, MISSION_LAST_TRY, MISSION_HALF, SAGE_SHARED_VOICE, rainbowAwardLine };';\n    vm.runInNewContext(compile(source)`);
const scenarios = String.raw`
const voice = load('src/App.tsx');
const catalog = voice.storyDialogueForReview;
const targetStages = new Set([21,22,27,53,56,70]);
const sages = new Set([23,29,32,36,41,49,60]);
const pairName = 'フタツメ＋ゴモク（交互）';
const originalPraise = 'いい感じ いい感じ♪';
const kansaiPraise = 'ええ感じでんがな♪';
for (const count of [0,1,2,7,12,123]) {
  assert.equal(voice.rainbowAwardLine('ja',count),'虹ボムをGET！','Japanese award has no quantity');
  assert(!/\d|\{n\}/.test(voice.rainbowAwardLine('ja',count)),'no Japanese count or template');
  assert.equal(voice.rainbowAwardLine('en',count),'Rainbow Bomb x'+count+'!','English award quantity unchanged');
}
const dictionary = new Map();
for (const [source, expected] of voice.DICE_KANSAI_VOICE) {
  assert(source && expected, 'nonempty source and authored alternative');
  assert(!/[、]/.test(expected), 'no added Japanese comma: ' + expected);
  assert(expected.split('\n').length <= 2, 'at most two explicit lines');
  if (expected.includes('\f')) assert.deepEqual(expected.match(/\d+/g), ['1','6','7','2','5','7','3','4','7'], 'both pages explain each pair summing to seven');
  else assert.deepEqual(expected.match(/\d+/g), source.match(/\d+/g), 'numeric gameplay meaning preserved: ' + source);
  assert.equal((expected.match(/\{n\}/g) || []).length, (source.match(/\{n\}/g) || []).length, 'count placeholder preserved');
  if (dictionary.has(source)) assert.equal(dictionary.get(source), expected, 'no conflicting mapping');
  dictionary.set(source, expected);
  for (const die of [2,5]) {
    assert.equal(voice.diceSpokenLine(source,'ja',die),expected,'target die voice');
    assert.equal(voice.diceSpokenLine(source,'en',die),source,'English untouched');
    if (source.includes('{n}')) for (const n of [0,1,2,7,12,123]) {
      assert.equal(voice.diceSpokenLine(source.replace('{n}',String(n)),'ja',die),expected.replace('{n}',String(n)),'dynamic value preserved');
    }
  }
  for (const die of [undefined,0,1,3,4,6,7]) assert.equal(voice.diceSpokenLine(source,'ja',die),source,'other speakers untouched');
}
const visit = v => typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(visit) : v && typeof v === 'object' ? ('ja' in v ? visit(v.ja) : Object.values(v).flatMap(visit)) : [];
const dedicated = [voice.TUTOR_RESCUE,voice.KOI_LINES,voice.SAIKA_STORY_LINES,voice.IDLE_KOITSUME,voice.IDLE_BERABOU,voice.IDLE_FEVER,voice.BERABOU_LINES.appear,voice.BERABOU_LINES.howto,voice.BERABOU_LINES.defeat,voice.BERABOU_HEAL_LINES,voice.BERABOU_GUARD_LINE,voice.BERABOU_LAST_LINE,voice.RAINBOW_HINT_LINE,voice.FEVER_AWAKEN_LINE,voice.MISSION_LAST_ENEMY,voice.MISSION_LAST_TRY,voice.MISSION_HALF];
for (const source of visit(dedicated)) assert(dictionary.has(source),'all target intro/tutorial/miss/reset/idle/battle lines covered: ' + source);
for (const call of Object.values(voice.BOMB_CALLS)) for (const line of [call.saika.ja,call.fever.ja]) assert(dictionary.has(line),'replay special move covered');
for (let hp = 1; hp <= 9; hp++) assert.equal(voice.diceSpokenLine(voice.berabouHitLine(hp).ja,'ja',2),'きいてるで！ のこり'+hp+'コや！');
for (const unknown of ['新しいセリフだよ！','12チェイン 未登録文','虹ボムを12コかくとく！ 続き','きいてる！のこり3コ！ 続き']) assert.equal(voice.diceSpokenLine(unknown,'ja',2),unknown,'unregistered text unchanged');
for (const [sources] of voice.SAGE_SHARED_VOICE) for (const source of sources) assert.equal(voice.diceSpokenLine(source,'ja'),source,'sage input remains unchanged');
for (const source of voice.CLEAR_LINES) for (const die of [2,5]) assert.equal(voice.diceSpokenLine(source,'ja',die),'よっしゃ‼︎','all clear candidates match requested text');

for (const mission of DATA.CAMPAIGN_MISSIONS) {
  const lines = catalog(mission.stage), target = targetStages.has(mission.stage);
  const awards = lines.filter(line=>line.timing.startsWith('虹ボム獲得'));
  assert.equal(awards.length,1,'one award row per mission');
  assert.equal(awards[0].timing,'虹ボム獲得','no obsolete count in review timing');
  assert.equal(awards[0].text,target?'虹ボムもろたで！':sages.has(mission.stage)?'虹ボムを得たぞよ！':'虹ボムをGET！','review award follows speaker');
  assert(!/\d|\{n\}/.test(awards[0].text),'no quantity in Japanese review award');
  assert.equal(lines.some(line => line.speaker === pairName),target,mission.number+' exact target pair');
  assert.equal(new Set(lines.map(line => line.text)).size,lines.length,'review deduplication');
  assert(lines.some(line => line.text === (target ? kansaiPraise : sages.has(mission.stage) ? 'よい調子じゃ♪' : originalPraise)),mission.number+' voice matches');
  if (target) {
    const expectedTexts = new Set([...dictionary.values()].flatMap(text => text.split('\f')));
    for (const line of lines.filter(line => line.speaker === pairName)) {
      assert(expectedTexts.has(line.text),'target catalog has no missed shared/scripted line: '+mission.number+' '+line.text);
      assert(!line.text.includes('、'),'target catalog has no comma');
    }
    const clear = lines.filter(line => line.timing === 'クリア結果');
    assert.equal(clear.length,1,'target clear choices collapse to one requested line');
    assert.equal(clear[0].text,'よっしゃ‼︎');
    const panic = voice.TUTOR_PANIC[mission.sourceStage ?? mission.stage];
    if (panic) assert(lines.some(line=>line.speaker==='サイカ' && line.text===panic.ja),'Saika panic is unchanged');
    if (mission.sourceStage === 17) assert(lines.some(line=>line.speaker==='サイカ' && line.text===voice.BERABOU_LINES.sense.ja),'Saika sense is unchanged');
  }
}
const review = load('src/story/reviewDialogue.ts').STORY_REVIEW_DIALOGUE;
for (const stage of [21,22]) {
  const expected = stage===21 ? 'コイツメのとなりで7や！' : 'サイリアン・コイツメを倒すで！\nとなりで7をつくって攻撃や！';
  assert.equal(review[stage].find(line=>line.id==='enemy-hint')?.text,expected,'stable enemy-hint id');
  assert.equal(review[stage].find(line=>line.id==='enemy-cheer')?.text,'まとめてやっつけたろ！','stable enemy-cheer id');
  for (const id of ['enemy-hint','enemy-cheer']) assert.equal(review[stage].find(line=>line.id===id)?.speaker,pairName,'fixed row correct speaker');
  assert.equal(review[stage].filter(line=>line.text===expected).length,1,'no fixed/generated duplicate');
  assert(!review[stage].some(line=>['コイツメのとなりで7！','まとめてやっつけちゃお','サイリアン・コイツメをやっつけよう！\nとなりで7をつくって攻撃！'].includes(line.text)),'old fixed wording removed');
}
for (const mission of DATA.CAMPAIGN_MISSIONS) {
  const current = catalog(mission.stage).find(line=>line.timing==='虹ボム獲得');
  const listed = review[mission.stage].filter(line=>line.timing.startsWith('虹ボム獲得'));
  assert.equal(listed.length,1,'full review contains one award row');
  assert.equal(listed[0].text,current.text,'full review synchronizes award wording');
  assert.equal(listed[0].speaker,current.speaker,'full review synchronizes award speaker');
}
const source = fs.readFileSync(root+'/src/App.tsx','utf8');
assert(source.includes('{[...rainbowAwardLine(lang, rainbowAward)].map'),'award overlay uses the same count-free Japanese helper');
assert(source.includes('setSaika({ text: rainbowAwardLine(langRef.current, count),'),'award dialogue uses the same helper');
assert(source.includes('{renderLine(dialoguePages[Math.min(dialoguePage, dialoguePages.length - 1)])}'),'normal display uses selected speaker');
assert(source.includes('{[...spokenLine(clearLine)].map'),'clear display uses selected speaker');
assert(source.includes('{renderLine(spokenLine(RAINBOW_HINT_LINE[lang]))}'),'gameover display uses selected speaker');

(async()=>{
  // The shared harness predates Wall 6. Unlock the current implemented catalog
  // explicitly so new stages cannot silently fall back to the previous screen.
  const progress = {...tree.wallProgressRef.current,cleared:DATA.CAMPAIGN_MISSIONS.map(m=>m.stage)};
  tree.wallProgressRef.current=progress;
  tree.setWallProgress(progress); await flush();
  const stages = [...DATA.CAMPAIGN_MISSIONS.map(m=>m.stage),0,4,6,10,17,18];
  for (const stage of stages) {
    const target = targetStages.has(stage) || stage===4 || stage===17;
    const sage = sages.has(stage);
    tree.startStage(stage); await flush();
    const mission=DATA.CAMPAIGN_MISSIONS.find(m=>m.stage===stage);
    assert.equal(tree.read().story,stage===23?23:mission?.sourceStage??stage,'requested mission actually launched '+stage);
    assert.equal(tree.read().mapStage,mission?stage:stage===0?0:null,'requested map identity '+stage);
    for (const turn of [0,1]) {
      tree.setTutorTurn(turn);
      tree.setSaika({text:originalPraise,mood:'smile'}); await flush();
      const expectedDie = voice.TUTOR_PAIRS[tree.read().story]?.[turn];
      assert.equal(tree.read().speakingDie,expectedDie,'runtime active face '+stage+'/'+turn);
      assert.equal(tree.read().displayLine,target?kansaiPraise:sage?'よい調子じゃ♪':originalPraise,'runtime scoped praise '+stage+'/'+turn);
      for (const clear of voice.CLEAR_LINES) {
        tree.setClearLine(clear); await flush();
        assert.equal(tree.read().displayClear,target?'よっしゃ‼︎':sage?['やったぞよ！','あっぱれじゃ！','見事じゃのう！'][voice.CLEAR_LINES.indexOf(clear)]:clear,'runtime clear '+stage+'/'+turn);
        if (!target && !sage) assert.equal(tree.read().displayClear,clear,'other dice/Saika clear unchanged');
      }
      for (const count of [1,2,12]) {
        tree.setSaika({text:voice.rainbowAwardLine('ja',count),mood:'bomb'}); await flush();
        const expectedAward=target?'虹ボムもろたで！':sage?'虹ボムを得たぞよ！':'虹ボムをGET！';
        assert.equal(tree.read().displayLine,expectedAward,'runtime Japanese award '+stage+'/'+turn);
        assert(!/\d|\{n\}/.test(tree.read().displayLine),'runtime Japanese count absent');
        tree.setSaika({text:voice.rainbowAwardLine('ja',count),mood:'bomb',who:'saika'}); await flush();
        assert.equal(tree.read().displayLine,'虹ボムをGET！','explicit Saika award');
        tree.setLang('en');
        tree.setSaika({text:voice.rainbowAwardLine('en',count),mood:'bomb'}); await flush();
        assert.equal(tree.read().displayLine,'Rainbow Bomb x'+count+'!','runtime English award unchanged');
        tree.setLang('ja'); await flush();
      }
      tree.setSaika({text:originalPraise,mood:'smile',who:'saika'}); await flush();
      assert.equal(tree.read().speakingDie,undefined,'explicit Saika prevents die identity');
      assert.equal(tree.read().displayLine,originalPraise,'explicit Saika text unchanged');
      tree.setClearLine('うしっ‼︎'); await flush();
      assert.equal(tree.read().displayClear,'うしっ‼︎','explicit Saika clear unchanged');
    }
    if (target) {
      tree.setSaika({text:originalPraise,mood:'smile'}); await flush();
      assert.equal(tree.read().displayHint,'虹ボムGETや！','target gameover hint');
      tree.setLang('en'); await flush();
      assert.equal(tree.read().displayLine,originalPraise,'runtime English gate preserves original');
      assert.equal(tree.read().displayClear,'うしっ‼︎','runtime English clear unchanged');
      tree.setLang('ja'); await flush();
      tree.playAgain(); await flush();
      tree.setSaika({text:originalPraise,mood:'smile'}); await flush();
      assert.equal(tree.read().displayLine,kansaiPraise,'replay retains correct target scope');
    }
    tree.backToTitle(); await flush();
    tree.setSaika({text:originalPraise,mood:'smile'}); await flush();
    assert.equal(tree.read().speakingDie,undefined,'exit clears target identity');
    assert.equal(tree.read().displayLine,originalPraise,'exit restores Saika');
  }
  // Exercise the actual clear setter/status, including the reported 5-2 path.
  for (const stage of [21,22,27,53,56]) {
    tree.startStage(stage); await flush();
    tree.setSaika({text:'いい感じ いい感じ♪',mood:'smile'}); await flush();
    tree.completeStage(tree.read().story,1234); await flush();
    await until(()=>tree.read().status==='cleared','clear presentation (fade → hush → sting → CLEAR!)');
    assert.equal(tree.read().displayClear,'よっしゃ‼︎','actual completion '+stage);
    tree.playAgain(); await flush();
    tree.setSaika({text:originalPraise,mood:'smile'}); await flush();
    assert.equal(tree.read().displayLine,kansaiPraise,'clear to replay target retained');
  }
  tree.startEndless(); await flush();
  tree.setSaika({text:originalPraise,mood:'smile'}); await flush();
  assert.equal(tree.read().speakingDie,undefined,'score mode never adopts a tutor voice');
  assert.equal(tree.read().displayLine,originalPraise,'score Saika unchanged');
  // Actual award-presentation path consumes the pending display count only.
  // Inventory is not mutated here, and the overlay keeps the real count in state.
  for (const stage of [null,23,53]) {
    if(stage===null) tree.startEndless(); else tree.startStage(stage);
    await flush();
    for(const count of [1,2,12]) {
      const stock=tree.read().rainbowStock;
      tree.pendingAward.current=count;
      let finished=false;
      const display=tree.spawnNext(tree.emptyBoard(),0).then(()=>{finished=true;});
      await flush();
      assert.equal(tree.read().rainbowAward,count,'actual award count is retained in state');
      assert.equal(tree.pendingAward.current,0,'pending presentation consumed once');
      assert.equal(tree.read().displayLine,stage===23?'虹ボムを得たぞよ！':stage===53?'虹ボムもろたで！':'虹ボムをGET！','actual award display is count-free');
      assert.equal(tree.read().rainbowStock,stock,'presentation leaves inventory untouched');
      await until(()=>finished,'award presentation finishes'); await display;
      assert.equal(tree.read().rainbowAward,0,'award overlay dismisses normally');
      assert.equal(tree.read().rainbowStock,stock,'inventory remains unchanged after presentation');
    }
    tree.backToTitle(); await flush();
  }
  console.log('PASS: '+dictionary.size+' authored pairs; all '+DATA.CAMPAIGN_MISSIONS.length+' campaign speakers and 6 legacy tutor stages; both faces; Saika overrides; English; dynamic/numeric meaning; clear/hint/replay/exit; four stable review rows; count-free Japanese award/runtime overlay and unchanged English/inventory.');
})().catch(error=>{console.error(error);process.exitCode=1;});
`;
assert(prefixEnd>0 && harness.includes('export { DICE_KANSAI_VOICE'),'harness markers');
const m = new Module(__filename,module); m.filename=__filename; m.paths=module.paths;
m._compile(harness+scenarios,__filename);
