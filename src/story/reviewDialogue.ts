import { diceSpokenLine, storyDialogueForReview } from '../App';
import { CAMPAIGN_MISSIONS } from './wall1';
// Dedicated dialogue reviewed with the first four missions. Keep IDs stable
// when changing wording so feedback remains attached to the same utterance.
export const STORY_REVIEW_DIALOGUE: Record<number, Array<{ id: string; timing: string; speaker: string; text: string }>> = {
  20: [
    { id: 'start', timing: '開始時・1回目', speaker: 'サイカ', text: 'さぁ ゲームのはじまり！' },
    { id: 'start-second', timing: '開始時・2回目', speaker: 'サイカ', text: 'となり合うサイノメどうしを合計7にして消していこう！' },
  ],
  21: [
    { id: 'enemy-hint', timing: '待機時', speaker: 'フタツメ＋ゴモク（交互）', text: diceSpokenLine('コイツメのとなりで7！', 'ja', 2) },
    { id: 'enemy-cheer', timing: '待機時', speaker: 'フタツメ＋ゴモク（交互）', text: diceSpokenLine('まとめてやっつけちゃお', 'ja', 2) },
  ],
  22: [
    { id: 'enemy-hint', timing: '待機時', speaker: 'フタツメ＋ゴモク（交互）', text: diceSpokenLine('サイリアン・コイツメをやっつけよう！\nとなりで7をつくって攻撃！', 'ja', 2) },
    { id: 'enemy-cheer', timing: '待機時', speaker: 'フタツメ＋ゴモク（交互）', text: diceSpokenLine('まとめてやっつけちゃお', 'ja', 2) },
  ],
  23: [
    { id: 'opening-1', timing: 'お手本前', speaker: 'ゾロメ仙人', text: 'ひっさつメを授けようぞ！' },
    { id: 'opening-2', timing: 'お手本前', speaker: 'ゾロメ仙人', text: '同じ目の組みあわせが\nひっさつメになるのじゃ' },
    { id: 'opening-3', timing: 'お手本前', speaker: 'ゾロメ仙人', text: '[1]を5つつなげば\nひっさつメ・スーパー1じゃ！' },
    { id: 'opening-4', timing: 'お手本前', speaker: 'ゾロメ仙人', text: 'まずはワシが手本を見せるかの' },
    { id: 'mission', timing: 'ミッション開始', speaker: 'ゾロメ仙人', text: '仕上げじゃ\nスーパー1を3回出してみよ！' },
    { id: 'mission-nice', timing: '1回目達成後', speaker: 'ゾロメ仙人', text: 'よいぞ\nあと少しじゃ！' },
    { id: 'normal-dice', timing: '3回目開始・待機時', speaker: 'ゾロメ仙人', text: '平時のメの出現カクリツでやってみるのじゃ！' },
    { id: 'think', timing: '3回目の待機時・3手ごと', speaker: 'ゾロメ仙人', text: 'どうした？\nちゃんと考えておるのか！' },
    { id: 'reset', timing: '積み上がり時（共通の救済セリフ）', speaker: 'ゾロメ仙人', text: 'いったん消すとしようかの' },
  ],
};
for (const mission of CAMPAIGN_MISSIONS) {
  const lines = STORY_REVIEW_DIALOGUE[mission.stage] || [];
  for (const line of storyDialogueForReview(mission.stage)) {
    const existing = lines.find(existing => existing.text === line.text);
    if (existing) { existing.speaker = line.speaker; continue; }
    // Stable text hash keeps existing feedback attached when list order changes.
    let hash = 2166136261;
    for (const char of line.text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    lines.push({ id: `runtime-${(hash >>> 0).toString(16)}`, timing: line.timing, speaker: line.speaker, text: line.text });
  }
  STORY_REVIEW_DIALOGUE[mission.stage] = lines;
}
export function commonDialogueKey(text: string): string | undefined {
  const stages = CAMPAIGN_MISSIONS.filter(m => STORY_REVIEW_DIALOGUE[m.stage].some(line => line.text === text));
  if (stages.length < 2) return undefined;
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `dialogue:common:${(hash >>> 0).toString(16)}`;
}


// 共通文でもメンによって話者が違うため、まとめ一覧では全員を表示する。
export function commonDialogueSpeakers(text: string): string {
  return [...new Set(Object.values(STORY_REVIEW_DIALOGUE).flatMap(lines => lines.filter(line => line.text === text).map(line => line.speaker)))].join('／');
}

