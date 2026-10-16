import { CAMPAIGN_MISSIONS, CAMPAIGN_WALLS } from './story/wall1';
import { missionObjectiveGuide } from './story/objectives';
import { STORY_REVIEW_DIALOGUE, commonDialogueKey, commonDialogueSpeakers } from './story/reviewDialogue';

const key = 'sainome-story-review-notes-v1';
const status = document.querySelector<HTMLDivElement>('#status')!;
let notes: Record<string, string> = {};
try {
  const saved: unknown = JSON.parse(localStorage.getItem(key) || '{}');
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    notes = Object.fromEntries(Object.entries(saved).filter(([, value]) => typeof value === 'string'));
  }
} catch { status.textContent = '保存メモを読み込めませんでした。入力後はコピーかファイル保存をご利用ください。'; }
// Add the exact feedback text here after implementing it. Only matching notes
// are cleared, so a newer request for the same stage survives a page update.
const appliedNotes: Record<string, string[]> = {
  "dialogue:common:f712ef12": ["[1]と[6]で7や！"],
  "dialogue:common:f712ef12:second": ["[2]と[5]でも7やし\n[3]と[4]でも7やで！"],
  "dialogue:common:d87aff92": ["やるやんけ～"],
  "dialogue:common:628bddc1": ["その調子やでしかし"],
  "dialogue:common:d292a2c4": ["ふんばってや～！"],
  "dialogue:common:6722d046": ["勝負どころや！"],
  "dialogue:common:421f517a": ["どないや！"],
  "dialogue:common:5401f406": ["キマったで～！"],
  "dialogue:common:6875c053": ["ケーサンどおりや♪"],
  "dialogue:common:77cf9ede": ["ええウデしてまんな♪"],
  "dialogue:common:c675ebf6": ["いまや！ つこて～っ！"],
  "dialogue:common:8eac966e": ["虹ボムGETや！"],
  "dialogue:common:dcdcb150": ["スパ1！ いてまえ～！"],
  "dialogue:common:55ec6217": ["スク4！ ガッツリやで！"],

  // 2026-10-05：共通「となりと足して7にしよう！」→ コイツメが出るメンだけ「となり合うメを7にして（改行）コイツメにくらわせて！」
  'dialogue:common:18f7d9f': ['となり合うメを7にして⏎コイツメにくらわせて！', 'となり合うメを7にして\nコイツメにくらわせて！'],
  // 2026-10-05：スト6っ！ ずどん → イッキツーカン！（改行）スト6でーっす！（チャットで指定）
  'dialogue:common:fe0580b4': ['イッキツーカン！⏎スト6でーっす！', 'イッキツーカン！\nスト6でーっす！', 'イッキツーカン！⏎スト6でーっす！　に修正'],
  'dialogue:common:7764e5e': ['ニコニコメ まだかなぁ'],
  'dialogue:20:runtime-e5e4ee0b': ['となり合うメを7にして\nどんどん消そっ！　※「」はつかわず7のみオレンジで記載'],
  'dialogue:20:start': ['さぁ ゲームのはじまり！'],
  'dialogue:20:start-second': ['となり合うサイノメどうしを合計7にして消していこう！', 'となり合うサイノメどうしを合計7にして消していこう！\n　※「」はつかわず7のみオレンジで記載'],
  'dialogue:common:6cdcca21': ['7になるサイどうしは同じ色だよ！'],
  'dialogue:common:7f628b18': ['いったん消すとしよう'],
  'dialogue:23:opening-3': ['[1]を5つつなげば\nひっさつメ・スーパー1じゃ！'],
  'dialogue:23:opening-4': ['まずはワシが手本を見せるかの'],
  'dialogue:23:mission': ['仕上げじゃ\nスーパー1を3回出してみよ！'],
  'dialogue:23:mission-nice': ['よいぞ\nあと少しじゃ！'],
  'dialogue:23:think': ['どうした？\nちゃんと考えておるのか！'],
  'dialogue:22:enemy-hint': ['サイリアン・コイツメをやっつけよう！\nとなりで7をつくって攻撃！'],
  'dialogue:22:runtime-18f7d9f': ['となり合うメを7にして！'],
  'dialogue:22:runtime-9d0f96fb': ['[1]と[6]で7！\n[2]と[5]や[3]と[4]でも7だよっ'],
  'dialogue:20:runtime-18f7d9f': ['となり合うメを足して「7」にして！'],
  'dialogue:20:runtime-9d0f96fb': ['[1]と[6]で7！\n[2]と[5]や[3]と[4]でも7だよっ'],
  'dialogue:20:runtime-6cdcca21': ['となり合うメを「7」にして\nどんどん消そっ！'],
  'dialogue:20:runtime-c82f1ef': ['{n}チェイン！\n いいね いいねっ！'],
  '20': ['以下スタート時にサイカのセリフを追加。さぁ、ゲームのはじまり！となり合うサイノメどうしを合計「7」にして消していこう！'],
  '21': ['コイツメを合計6体倒すように変更。\n2体→2体→2体の順に登場。いずれも上から落下して登場させてください。'],
  '22': ['コイツメを合計12体倒すように変更。'],
  '23': ['お手本→ミッション3回で、3回目は通常出目（1の目ブロック確率が通常設定）で仙人のセリフ「平時のメの出現カクリツでやってみるのじゃ！」「どうした？ちゃんと考えておるのか！」などセリフ追加。'],
};
const normalize = (text: string) => text.replace(/\s+/g, '');
const cleared = Object.keys(notes).filter(stage => appliedNotes[stage]?.some(text => normalize(text) === normalize(notes[stage])));
if (cleared.length) {
  cleared.forEach(stage => { delete notes[stage]; });
  try {
    localStorage.setItem(key, JSON.stringify(notes));
    status.textContent = `反映済みのメモ${cleared.length}件をクリアしました。新しい修正希望を入力できます。`;
  } catch { status.textContent = '反映済みメモを画面からクリアしましたが、ブラウザーへの保存に失敗しました。'; }
}
// 敵の数の内わけ（はじめの敵・増援・デタラメ・アンチクショウメ）。数を見直したときに一覧で確かめる
const missionSize = (m: typeof CAMPAIGN_MISSIONS[number]) => {
  if (m.kind === 'lesson' || m.scoreTarget || m.sourceStage !== undefined) return '';
  const parts: string[] = [];
  if (m.enemies.length) parts.push(`はじめ${m.enemies.length}体`);
  if (m.reinforceKoitsume) parts.push(`コイツメ増援${m.reinforceKoitsume}体`);
  if (m.detarameTotal) parts.push(`デタラメ${m.detarameTotal}体（同時${m.detarameAtOnce ?? 1}体まで）`);
  if (m.anchikushoume) parts.push('アンチクショウメ1体');
  const total = m.enemies.length + (m.reinforceKoitsume ?? 0) + (m.detarameTotal ?? 0) + (m.anchikushoume ? 1 : 0);
  return parts.length ? `\n全${total}体：${parts.join('＋')}` : '';
};
const tbody = document.querySelector('tbody')!;
CAMPAIGN_WALLS.forEach(wall => {
  const heading = tbody.insertRow(); heading.className = 'wall-row';
  const cell = heading.insertCell(); cell.colSpan = 5;
  cell.textContent = `ウォール${wall.wall}：${wall.title}${wall.implemented ? '' : '（準備中：各メンの設定は未定）'}`;
  CAMPAIGN_MISSIONS.filter(m => m.wall === wall.wall).forEach(m => {
    const row = tbody.insertRow();
    [m.number, m.title, m.context, `${missionObjectiveGuide(m)}${missionSize(m)}`].forEach(text => { row.insertCell().textContent = text; });
    row.cells[3].style.whiteSpace = 'pre-line';
    const themeCell = row.cells[2];
    const theme = document.createElement('div'); theme.textContent = m.context;
    const toggle = document.createElement('button'); toggle.textContent = 'セリフを見る';
    toggle.onclick = () => showDialogue(m.stage);
    themeCell.replaceChildren(toggle, theme);
    const textarea = document.createElement('textarea');
    textarea.setAttribute('aria-label', `${m.number} ${m.title}のフィードバック`);
    textarea.placeholder = '例：タイトルが切れる → 全文を表示したい';
    textarea.value = notes[String(m.stage)] || '';
    textarea.oninput = () => {
      notes[String(m.stage)] = textarea.value;
      try { localStorage.setItem(key, JSON.stringify(notes)); status.textContent = `${m.number} のメモを保存しました`; }
      catch { status.textContent = 'ブラウザーに保存できません。コピーかファイル保存でメモを残してください。'; }
    };
    row.insertCell().append(textarea);
  });
});
const tableWrap = document.querySelector<HTMLElement>('.table-wrap')!;
const dialogueSection = document.createElement('section'); dialogueSection.id = 'dialogue-list'; dialogueSection.style.padding = '16px'; dialogueSection.hidden = true;
const dialogueHeading = document.createElement('h2');
dialogueSection.append(dialogueHeading);
const dialogueNav = document.createElement('div'); dialogueNav.className = 'actions';
let dialogueIndex = 0;
const previous = document.createElement('button'); previous.textContent = '← 前のメン';
const next = document.createElement('button'); next.textContent = '次のメン →';
const returnTable = document.createElement('button'); returnTable.textContent = '進行表へ戻る';
previous.onclick = () => showDialogue(CAMPAIGN_MISSIONS[dialogueIndex - 1].stage);
next.onclick = () => showDialogue(CAMPAIGN_MISSIONS[dialogueIndex + 1].stage);
returnTable.onclick = () => { dialogueSection.hidden = true; tableWrap.hidden = false; tableWrap.scrollIntoView(); };
dialogueNav.append(previous, returnTable, next); dialogueSection.append(dialogueNav);
const dialogueIntro = document.createElement('p'); dialogueIntro.textContent = 'このメンで出現しうるセリフを表示します。技の習得後に再プレイした場合のセリフも含みます。{n}は連鎖数・残数などで変わります。個別メモも一括コピーできます。'; dialogueSection.append(dialogueIntro);
const stageLists = new Map<number, HTMLElement>();
function showDialogue(stage: number) {
  dialogueIndex = CAMPAIGN_MISSIONS.findIndex(m => m.stage === stage);
  const mission = CAMPAIGN_MISSIONS[dialogueIndex];
  buildStageList(mission);
  dialogueHeading.textContent = `${mission.number} ${mission.title}：セリフリスト`;
  stageLists.forEach((list, id) => { list.hidden = id !== stage; });
  previous.disabled = dialogueIndex === 0; next.disabled = dialogueIndex === CAMPAIGN_MISSIONS.length - 1;
  tableWrap.hidden = true; dialogueSection.hidden = false; dialogueSection.scrollIntoView();
}
// 40メン分（のべ2千行以上）を最初に全部作ると重いので、そのメンを開いたときに初めて作る（2026-10-05）
const buildStageList = (m: (typeof CAMPAIGN_MISSIONS)[number]) => {
  if (stageLists.has(m.stage)) return;
  const lines = STORY_REVIEW_DIALOGUE[m.stage]; if (!lines) return;
  const stageList = document.createElement('div'); stageList.hidden = true; stageLists.set(m.stage, stageList); dialogueSection.append(stageList);
  lines.forEach(line => {
    const article = document.createElement('article'); article.id = `dialogue-${m.stage}-${line.id}`; article.tabIndex = -1;
    const label = document.createElement('p'); label.textContent = `${line.timing} ／ ${line.speaker}`;
    const commonKey = commonDialogueKey(line.text);
    if (commonKey) {
      const badge = document.createElement('strong'); badge.textContent = ' 共通'; badge.style.color = '#ffd24a'; badge.style.display = 'inline'; label.append(badge);
    }
    const quote = document.createElement('blockquote');
    line.text.split('7').forEach((part, i) => {
      if (i) { const seven = document.createElement('span'); seven.textContent = '7'; seven.style.color = '#ffb02e'; quote.append(seven); }
      quote.append(document.createTextNode(part));
    });
    article.append(label, quote);
    const tabs = document.createElement('div'); tabs.className = 'actions'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'セリフ修正の回数'); article.append(tabs);
    const fields: HTMLTextAreaElement[] = []; const buttons: HTMLButtonElement[] = [];
    for (const take of [1, 2]) {
    const suffix = take === 1 ? '' : ':second';
    const textarea = document.createElement('textarea'); const stageKey = `dialogue:${m.stage}:${line.id}${suffix}`;
    const noteKey = commonKey ? commonKey + suffix : stageKey;
    textarea.setAttribute('aria-label', `${m.number} ${line.timing}「${line.text}」のフィードバック・${take}回目`);
    textarea.hidden = take !== 1;
    textarea.placeholder = commonKey ? '共通セリフ全体への修正希望（同じセリフがある全メンに適用）' : 'このセリフの修正希望'; textarea.value = notes[noteKey] || notes[stageKey] || '';
    if (commonKey) textarea.dataset.commonNote = noteKey;
    textarea.oninput = () => {
      notes[noteKey] = textarea.value;
      if (commonKey) {
        delete notes[stageKey];
        dialogueSection.querySelectorAll<HTMLTextAreaElement>('textarea[data-common-note]').forEach(field => {
          if (field.dataset.commonNote === noteKey) field.value = textarea.value;
        });
      }
      try { localStorage.setItem(key, JSON.stringify(notes)); status.textContent = `${m.number} のセリフメモを保存しました`; }
      catch { status.textContent = '保存できません。コピーかファイル保存でメモを残してください。'; }
    };
    const button = document.createElement('button'); button.textContent = `${take}回目`; button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(take === 1));
    button.onclick = () => { fields.forEach((field, i) => { field.hidden = i !== take - 1; buttons[i].setAttribute('aria-selected', String(i === take - 1)); }); };
    fields.push(textarea); buttons.push(button); tabs.append(button); article.append(textarea);
    }
    stageList.append(article);
  });
};
document.body.append(dialogueSection);
// コピー。navigator.clipboard が使えない環境（確認用ページの枠の中など）では、
// 見えない入力欄を選んで execCommand('copy') でコピーする。それも失敗したら手でコピーできる欄を出す（2026-10-05）
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* 下の方法を試す */ }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed'; area.style.top = '0'; area.style.left = '0'; area.style.opacity = '0';
  document.body.append(area);
  area.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  area.remove();
  return ok;
};
// どちらの方法でもコピーできなかったときは、文を選んだ状態の欄を出して、Ctrl+C で写せるようにする
const showManualCopy = (text: string) => {
  let box = document.querySelector<HTMLTextAreaElement>('#manual-copy');
  if (!box) {
    box = document.createElement('textarea'); box.id = 'manual-copy'; box.readOnly = true;
    box.style.width = '100%'; box.style.minHeight = '160px'; box.style.marginTop = '8px';
    status.after(box);
  }
  box.value = text; box.focus(); box.select();
};
const feedback = () => {
  const items: string[] = [];
  const copiedCommon = new Set<string>();
  CAMPAIGN_MISSIONS.forEach(m => {
    if (notes[String(m.stage)]?.trim()) items.push(`${m.number}：${notes[String(m.stage)].trim()}`);
    (STORY_REVIEW_DIALOGUE[m.stage] || []).forEach(line => {
      const commonKey = commonDialogueKey(line.text);
      for (const take of [1, 2]) {
      const suffix = take === 1 ? '' : ':second';
      const sharedKey = commonKey ? commonKey + suffix : undefined;
      if (sharedKey && notes[sharedKey]?.trim() && !copiedCommon.has(sharedKey)) {
        copiedCommon.add(sharedKey);
        const targets = CAMPAIGN_MISSIONS.filter(mission => STORY_REVIEW_DIALOGUE[mission.stage].some(item => item.text === line.text)).map(mission => mission.number).join('、');
        items.push(`共通：セリフ「${line.text}」\n対象メン：${targets}\nフィードバック（${take}回目）：${notes[sharedKey].trim()}`);
      }
      const note = notes[`dialogue:${m.stage}:${line.id}${suffix}`]?.trim();
      if (note) items.push(`${m.number}：セリフ［${line.timing}／${line.speaker}］「${line.text}」\nフィードバック（${take}回目）：${note}`);
      }
    });
  });
  return items.join('\n\n');
};
document.querySelector<HTMLButtonElement>('#copy')!.onclick = async () => {
  const text = feedback();
  if (!text) { status.textContent = 'まずメモ欄に修正希望を入力してください。'; return; }
  if (await copyToClipboard(text)) { status.textContent = 'メン番号付きで修正メモを一括コピーしました。チャットへ貼り付けてください。'; return; }
  showManualCopy(text);
  status.textContent = '自動でコピーできなかったので、下の欄に出しました。選ばれた状態なので Ctrl+C（Mac は Cmd+C）でコピーしてください。';
};
document.querySelector<HTMLButtonElement>('#download')!.onclick = () => {
  const text = feedback();
  if (!text) { status.textContent = 'まずメモ欄に修正希望を入力してください。'; return; }
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = 'ストーリー修正メモ.txt'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = '修正メモをファイル保存しました。';
};

// ===== 指定まとめ一覧（2026-10-05）=====
// いま採用されているセリフを、1行に1セリフの形で並べる。
//   ⚠ 1-1｜20:start｜開始時・1回目｜サイカ｜さぁ ゲームのはじまり！
// 最後の欄（セリフの文）を書き換えて「変更分をコピー」を押すと、変えたセリフだけが
// 旧／新の形でコピーされる。チャットに貼れば、そのまま一括で反映できる。
// 改行は ⏎ で書く。読点「、」はなるべく使わない決まりなので、含むセリフには ⚠ を付ける。
const SPEC_DRAFT_KEY = 'sainome-dialogue-spec-draft-v1';
const BREAK = '⏎';
type SpecLine = { key: string; number: string; timing: string; speaker: string; text: string };
const specLines: SpecLine[] = [];
const commonSeen = new Set<string>();
CAMPAIGN_MISSIONS.forEach(m => {
  (STORY_REVIEW_DIALOGUE[m.stage] || []).forEach(line => {
    const common = commonDialogueKey(line.text);
    if (common) {
      if (commonSeen.has(common)) return;
      commonSeen.add(common);
      const targets = CAMPAIGN_MISSIONS.filter(x => STORY_REVIEW_DIALOGUE[x.stage]?.some(item => item.text === line.text)).map(x => x.number);
      specLines.push({ key: common.replace('dialogue:', ''), number: `共通(${targets.length}メン)`, timing: line.timing, speaker: commonDialogueSpeakers(line.text), text: line.text });
      return;
    }
    specLines.push({ key: `${m.stage}:${line.id}`, number: m.number, timing: line.timing, speaker: line.speaker, text: line.text });
  });
});
const toRow = (line: SpecLine) => `${line.text.includes('、') ? '⚠ ' : ''}${line.number}｜${line.key}｜${line.timing}｜${line.speaker}｜${line.text.replace(/\n/g, BREAK)}`;
const baseText = () => {
  const rows: string[] = [];
  let lastGroup = '';
  // メンごとのセリフを先に、共通セリフは最後にまとめる
  const ordered = [...specLines.filter(line => !line.number.startsWith('共通')), ...specLines.filter(line => line.number.startsWith('共通'))];
  ordered.forEach(line => {
    const group = line.number.startsWith('共通') ? '■共通セリフ（同じ文を使う全メンに効く）' : `■${line.number} ${CAMPAIGN_MISSIONS.find(m => m.number === line.number)?.title ?? ''}`;
    if (group !== lastGroup) { if (rows.length) rows.push(''); rows.push(group); lastGroup = group; }
    rows.push(toRow(line));
  });
  return rows.join('\n');
};
const parseRows = (text: string) => {
  const map = new Map<string, string>();
  text.split('\n').forEach(row => {
    const parts = row.replace(/^⚠\s*/, '').split('｜');
    if (parts.length < 5) return;
    map.set(parts[1].trim(), parts.slice(4).join('｜').trim());
  });
  return map;
};
const specSection = document.createElement('section'); specSection.id = 'dialogue-spec'; specSection.style.padding = '16px'; specSection.hidden = true;
const specHeading = document.createElement('h2'); specHeading.textContent = '指定まとめ一覧（いま採用されているセリフ）';
const commaCount = specLines.filter(line => line.text.includes('、')).length;
const specIntro = document.createElement('p');
specIntro.textContent = `1行に1セリフ。最後の欄の文を書き換えて「変更分をコピー」を押すと、変えたセリフだけが旧→新でコピーされます。改行は ${BREAK} で書きます。読点「、」を含むセリフ（${commaCount}件）には ⚠ が付いています。書き換えはこのブラウザーに自動保存されます。`;
const specArea = document.createElement('textarea'); specArea.setAttribute('aria-label', '指定まとめ一覧'); specArea.spellcheck = false;
specArea.style.minHeight = '60vh'; specArea.style.fontFamily = 'ui-monospace, Menlo, Consolas, monospace'; specArea.style.fontSize = '13px'; specArea.style.whiteSpace = 'pre'; specArea.style.overflowX = 'auto';
let draft = '';
try { draft = localStorage.getItem(SPEC_DRAFT_KEY) || ''; } catch { /* 保存できなくても表示はする */ }
specArea.value = draft || baseText();
specArea.oninput = () => { try { localStorage.setItem(SPEC_DRAFT_KEY, specArea.value); } catch { /* 無視 */ } };
const specActions = document.createElement('div'); specActions.className = 'actions';
const copyChanges = document.createElement('button'); copyChanges.textContent = '変更分をコピー';
const copyAll = document.createElement('button'); copyAll.textContent = '一覧を全部コピー';
const resetSpec = document.createElement('button'); resetSpec.textContent = '書き換えを元に戻す';
const backFromSpec = document.createElement('button'); backFromSpec.textContent = '進行表へ戻る';
const changes = () => {
  const edited = parseRows(specArea.value);
  const out: string[] = [];
  specLines.forEach(line => {
    const next = edited.get(line.key);
    if (next === undefined || next === line.text.replace(/\n/g, BREAK)) return;
    out.push(`${line.number}［${line.timing}／${line.speaker}］${line.key}\n旧：${line.text.replace(/\n/g, BREAK)}\n新：${next}`);
  });
  return out.length ? `セリフ指定（${out.length}件）※${BREAK}は改行\n\n${out.join('\n\n')}` : '';
};
const copyText = async (text: string, done: string) => {
  if (await copyToClipboard(text)) { status.textContent = done; return; }
  showManualCopy(text);
  status.textContent = '自動でコピーできなかったので、下の欄に出しました。Ctrl+C（Mac は Cmd+C）でコピーしてください。';
};
copyChanges.onclick = () => { const text = changes(); if (!text) { status.textContent = 'まだ書き換えたセリフがありません。'; return; } void copyText(text, '変更したセリフをコピーしました。チャットへ貼り付けてください。'); };
copyAll.onclick = () => { void copyText(specArea.value, '指定まとめ一覧を全部コピーしました。'); };
resetSpec.onclick = () => { specArea.value = baseText(); try { localStorage.removeItem(SPEC_DRAFT_KEY); } catch { /* 無視 */ } status.textContent = '書き換えを元に戻しました（いま採用されているセリフの一覧）。'; };
backFromSpec.onclick = () => { specSection.hidden = true; tableWrap.hidden = false; tableWrap.scrollIntoView(); };
specActions.append(copyChanges, copyAll, resetSpec, backFromSpec);
specSection.append(specHeading, specIntro, specActions, specArea);
document.body.append(specSection);
// 反映が済んで一覧の元の文が書き換え後と同じになったら、書き換えの保存は消して最新の一覧に戻す
if (draft && !changes()) { specArea.value = baseText(); try { localStorage.removeItem(SPEC_DRAFT_KEY); } catch { /* 無視 */ } }
const openSpec = document.createElement('button'); openSpec.textContent = '指定まとめ一覧';
openSpec.onclick = () => { tableWrap.hidden = true; dialogueSection.hidden = true; specSection.hidden = false; specSection.scrollIntoView(); };
document.querySelector('header .actions')!.append(openSpec);

// ===== 改行の印「⏎」を入れるボタン（2026-10-05）=====
// メモ欄・指定まとめ一覧のどの入力欄にも、押すとカーソルの位置に ⏎ を入れるボタンを付ける。
// キーボードでは Ctrl+Enter（Mac は Cmd+Enter）でも入る。ふつうの Enter はそのまま改行
const insertBreak = (field: HTMLTextAreaElement) => {
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? start;
  field.setRangeText(BREAK, start, end, 'end');
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.focus();
};
// 全部の入力欄に先に付けると重いので、入力欄を触ったときに、その欄にだけボタンを出す
const breakButton = document.createElement('button');
breakButton.type = 'button';
breakButton.className = 'break-key';
breakButton.textContent = `${BREAK} 改行の印`;
breakButton.title = 'カーソルの位置に ⏎ を入れる（Ctrl+Enter でも入る）';
let breakTarget: HTMLTextAreaElement | null = null;
// ボタンを押してもカーソルの位置を失わないよう、フォーカスを入力欄に残す
breakButton.onmousedown = event => event.preventDefault();
breakButton.onclick = () => { if (breakTarget) insertBreak(breakTarget); };
document.addEventListener('focusin', event => {
  const field = event.target;
  if (!(field instanceof HTMLTextAreaElement)) return;
  breakTarget = field;
  field.after(breakButton);
});
document.addEventListener('keydown', event => {
  const field = event.target;
  if (field instanceof HTMLTextAreaElement && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    insertBreak(field);
  }
});
const breakStyle = document.createElement('style');
breakStyle.textContent = '.break-key{margin:4px 0 8px;padding:4px 10px;font-size:13px;background:#2b3a4f;border-color:#7d93b3}';
document.head.append(breakStyle);

