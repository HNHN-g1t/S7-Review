import type { WallMission } from './wall1';
export const emptyWallCounts = () => ({ sevens: 0, superOnes: 0, nico: 0, thunder: 0, you456: 0, hyoketsu: 0, enjo: 0, enemyKills: 0, bombs: { spa1: 0, sla3: 0, squ4: 0, str6: 0 } });
export type WallCounts = ReturnType<typeof emptyWallCounts>;
export type StoryGoal =
  | { type: 'wall'; mission: WallMission }
  | { type: 'score' | 'combo' | 'tutorial' | 'koitsume' | 'dame' | 'hidoime' | 'fever' | 'waves' | 'rainbow' | 'berabou' | 'detarame' | 'allstars'; target: number }
  | { type: 'defeat' }
  | { type: 'bomb'; kind: 'spa1' | 'sla3' | 'squ4' | 'str6' | 'nico'; target: number };

// Shared by the actual clear checks, map, mission banner and review progress sheet.
// Keep these values identical to the original 0–19 story goals.
export const STORY_BERABOU_HP = 9;
export const STORY_SWARM_COUNT = 3;
export const STORY_GOALS: StoryGoal[] = [
  { type: 'tutorial', target: 5 }, { type: 'score', target: 2000 },
  { type: 'combo', target: 2 }, { type: 'bomb', kind: 'spa1', target: 3 },
  { type: 'koitsume', target: 3 }, { type: 'bomb', kind: 'sla3', target: 3 },
  { type: 'dame', target: 2 }, { type: 'bomb', kind: 'squ4', target: 3 },
  { type: 'defeat' }, { type: 'bomb', kind: 'str6', target: 3 },
  { type: 'hidoime', target: 1 }, { type: 'bomb', kind: 'nico', target: 2 },
  { type: 'hidoime', target: 1 }, { type: 'fever', target: 3 },
  { type: 'waves', target: 5 }, { type: 'rainbow', target: 1 },
  { type: 'hidoime', target: STORY_SWARM_COUNT }, { type: 'berabou', target: STORY_BERABOU_HP },
  { type: 'detarame', target: 1 }, { type: 'allstars', target: 3 },
];
export const missionGoalFor = (mission: WallMission): StoryGoal => mission.sourceStage !== undefined
  ? STORY_GOALS[mission.sourceStage] : { type: 'wall', mission };
const extraNames = {you456:'シゴロッキュー',hyoketsu:'ヒョーケツボム',enjo:'エンジョーボム'};
const powerNames = { spa1: 'スーパー1', sla3: 'スラッシュ3', squ4: 'スクウェア4', str6: 'ストレイト6', nico: 'ニコニコボム' };
export type ObjectivePart = { label: string; now: number; target: number };
export function wallObjectiveParts(mission: WallMission, counts: WallCounts, score: number, chains: number, enemiesLeft: number): ObjectivePart[] {
  if (mission.kind !== 'lesson') {
    if (mission.scoreTarget) return [{ label: '得点', now: Math.min(score, mission.scoreTarget), target: mission.scoreTarget }];
    const total = mission.enemies.length + (mission.reinforceKoitsume ?? 0) + ((mission.anchikushoume || mission.sanzapparaname) ? 1 : 0) + (mission.detarameTotal ?? 0);
    const defeated = mission.enemyWaveSize ? counts.enemyKills : Math.max(0, total - enemiesLeft);
    return total > 0 ? [{ label: 'サイリアン', now: Math.min(defeated, total), target: total }] : [];
  }
  const parts: ObjectivePart[] = [];
  const add = (label: string, now: number, target: number) => { if (target > 0) parts.push({ label, now: Math.min(now, target), target }); };
  if(mission.skillTarget) add(extraNames[mission.skillTarget.kind],counts[mission.skillTarget.kind],mission.skillTarget.count);
  add('セヴン目', counts.sevens, mission.sevens);
  add('2チェイン以上', chains, mission.chainTarget ?? 0);
  add('得点', score, mission.scoreTarget ?? 0);
  add('ニコニコボム', counts.nico, mission.nicoTarget ?? 0);
  add('イチニノサンダー', counts.thunder, mission.thunderTarget ?? 0);
  for (const kind of ['spa1', 'sla3', 'squ4', 'str6'] as const) {
    add(powerNames[kind], kind === 'spa1' ? Math.max(counts.superOnes, counts.bombs.spa1) : counts.bombs[kind],
      Math.max(mission.bombTargets?.[kind] ?? 0, kind === 'spa1' ? mission.superOnes : 0));
  }
  const total = mission.enemies.length + (mission.reinforceKoitsume ?? 0);
  add('敵（増援を含む）', mission.enemyWaveSize ? counts.enemyKills : Math.max(0, total - enemiesLeft), total);
  return parts;
}

/** Campaign practice has one goal; lessons and the legacy linear story keep their scripts. */
export function storyObjectiveText(goal: StoryGoal, mission?: WallMission): string {
  const activeMission = mission ?? (goal.type === 'wall' ? goal.mission : undefined);
  if (activeMission && activeMission.kind !== 'lesson') return activeMission.scoreTarget
    ? `スコア${activeMission.scoreTarget.toLocaleString('ja-JP')}獲得` : activeMission.sanzapparaname ? 'サンザッパラナメの目を撃ち抜け！' : activeMission.anchikushoume ? 'アンチクショウメの目を撃ち抜け！' : 'サイリアンをぜんぶ倒せ！';
  if (goal.type === 'wall') {
    const m = goal.mission;
    const parts: string[] = [];
    if(m.skillTarget) parts.push(`${extraNames[m.skillTarget.kind]}を${m.skillTarget.count}回発動`);
    if (m.sevens) parts.push(`セヴン目を${m.sevens}回`);
    if (m.chainTarget) parts.push(`2チェイン以上を${m.chainTarget}回`);
    if (m.scoreTarget) parts.push(`${m.scoreTarget.toLocaleString('ja-JP')}点`);
    if (m.nicoTarget) parts.push(`ニコニコボムを${m.nicoTarget}回`);
    if (m.thunderTarget) parts.push(`イチニノサンダーを${m.thunderTarget}回`);
    const bombs = (['spa1', 'sla3', 'squ4', 'str6'] as const).map(kind => ({ kind, target: Math.max(m.bombTargets?.[kind] ?? 0, kind === 'spa1' ? m.superOnes : 0) })).filter(b => b.target > 0);
    if (bombs.length > 1 && bombs.every(b => b.target === bombs[0].target)) parts.push(`${bombs.map(b => powerNames[b.kind]).join('・')}を各${bombs[0].target}回`);
    else for (const b of bombs) parts.push(`${powerNames[b.kind]}を${b.target}回`);
    const koi = m.enemies.filter(e => e.kind === 'koitsume').length;
    const dame = m.enemies.filter(e => e.kind === 'dame').length;
    if (m.enemyWaveSize) parts.push(`コイツメ${koi}体を倒す（${m.enemyWaveSize}体ずつ）`);
    else if (m.reinforceKoitsume && !dame) parts.push(`コイツメ${koi}体→増援${m.reinforceKoitsume}体を倒す`);
    else {
      const enemies = [koi ? `コイツメ${koi + (m.reinforceKoitsume ?? 0)}体` : '', dame ? `ダーメ${dame}体` : ''].filter(Boolean);
      if (enemies.length) parts.push(`${enemies.join('・')}を倒す${m.reinforceKoitsume ? '（増援込み）' : ''}`);
    }
    return parts.join(' ＋ ');
  }
  switch (goal.type) {
    case 'tutorial': return `合計7を${goal.target}回作る`;
    case 'score': return `スコア${goal.target.toLocaleString('ja-JP')}獲得`;
    case 'combo': return `2チェイン以上を${goal.target}回`;
    case 'bomb': return `${powerNames[goal.kind]}を本番で${goal.target}回`;
    case 'koitsume': return `コイツメを本番で${goal.target}体倒す`;
    case 'dame': return `ダーメを本番で${goal.target}体倒す`;
    case 'hidoime': return goal.target > 1 ? `メを消し続けて現れるヒドイメを${goal.target}体倒す` : `ヒドイメを${goal.target}体倒す`;
    case 'fever': return 'コイツメ・ダーメ・ヒドイメを各1体倒す';
    case 'waves': return '3つの波を順に全滅させる';
    case 'rainbow': return 'てっぺんで「使う？」が出たら虹ボムを使って助かる';
    case 'berabou': return `ベラボウメの${goal.target}つの目を消す（最後はひっさつメ・ボム）`;
    case 'detarame': return 'デタラメの目を全部消す（小敵は残ってもOK）';
    case 'allstars': return '3つの波を突破 最後は大きな敵2体とも倒す';
    case 'defeat': return 'コイツメ5体・ダーメ5体を全滅させる';
  }
}
export function missionObjectiveText(mission: WallMission): string { return storyObjectiveText(missionGoalFor(mission), mission); }
export function missionObjectiveGuide(mission: WallMission): string {
  const goal = missionGoalFor(mission), text = missionObjectiveText(mission);
  if (mission.kind !== 'lesson') return text;
  if (goal.type === 'bomb') return mission.learns === 'spa1'
    ? `お手本のあと ${text}。3回目は通常の出目。`
    : `お手本と練習2回のあと ${text}。練習分は本番に数えません。`;
  if (goal.type === 'koitsume' || goal.type === 'dame') return `お手本と練習のあと ${text}。練習分は本番に数えません。`;
  if (goal.type === 'fever') return `${text}。FEVER発動回数の条件はありません。`;
  if (goal.type === 'waves') return `${text}。コイツメ→ダーメ→ヒドイメの順に現れます。`;
  if (goal.type === 'combo') return `お手本のあと ${text}。1回の落下で2回以上続く消去を1回と数えます。`;
  if (goal.type === 'wall' && mission.reinforceKoitsume) return `${text}。最初のコイツメが全滅すると増援が出ます。`;
  return text;
}
/** Single-goal progress for campaign practice; legacy lesson counters remain separate. */
export function wallObjectiveProgress(mission: WallMission, counts: WallCounts, score: number, chains: number, enemiesLeft: number): [number, number] {
  return wallObjectiveParts(mission, counts, score, chains, enemiesLeft)
    .reduce<[number, number]>(([now, target], part) => [now + part.now, target + part.target], [0, 0]);
}
export function wallObjectiveMet(mission: WallMission, counts: WallCounts, score: number, chains: number, enemiesLeft: number): boolean {
  const [now, target] = wallObjectiveProgress(mission, counts, score, chains, enemiesLeft);
  return target > 0 && now >= target && ((mission.kind !== 'lesson' && !!mission.scoreTarget) || enemiesLeft === 0);
}
