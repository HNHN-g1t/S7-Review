export const PRACTICE_ENEMIES = {
  enjo: { name: 'エンジョーボム', stage: 8 },
  hyoketsume: { name: 'ヒョーケツメ', stage: 8 },
  koitsume: { name: 'コイツメ', stage: 8 },
  dame: { name: 'ダーメ', stage: 8 },
  hidoime: { name: 'ヒドイメ', stage: 10 },
  berabou: { name: 'ベラボウメ', stage: 17 },
  detarame: { name: 'デタラメ', stage: 18 },
  anchikushoume: { name: 'アンチクショウメ', stage: 61 },
  sanzapparaname: { name: 'サンザッパラナメ', stage: 61 },
} as const;
export type PracticeEnemy = keyof typeof PRACTICE_ENEMIES;
type Practice = { enemy: PracticeEnemy; name: string; stage: number };
let ready: Practice | null = null;

export function parseEnemyPractice(location: Pick<Location, 'hostname' | 'pathname' | 'search'>): Practice | null {
  if (!['localhost', '127.0.0.1', 's7-review.vercel.app'].includes(location.hostname) || !['/enemy-practice.html', '/enemy-practice'].includes(location.pathname)) return null;
  const enemy = new URLSearchParams(location.search).get('enemy');
  if (!enemy || !Object.hasOwn(PRACTICE_ENEMIES, enemy)) return null;
  return { enemy: enemy as PracticeEnemy, ...PRACTICE_ENEMIES[enemy as PracticeEnemy] };
}

// App and its dependencies must be imported only AFTER this succeeds.
// The iframe receives an empty Storage-compatible store; real saved data is never read.
export function prepareEnemyPracticeStorage(target: Window = window): Practice {
  const practice = parseEnemyPractice(target.location);
  if (!practice) throw new Error('模擬戦はPCの確認用ページから開いてください。');
  const values = new Map<string, string>();
  const memory: Storage = {
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(String(key)) ?? null,
    setItem: (key, value) => { values.set(String(key), String(value)); },
    removeItem: key => { values.delete(String(key)); },
    clear: () => { values.clear(); },
  };
  Object.defineProperty(target, 'localStorage', { value: memory, configurable: false });
  if (target.localStorage !== memory) throw new Error('保存データを分離できないため模擬戦を開始しません。');
  ready = practice;
  return practice;
}

export const getEnemyPractice = () => ready;
