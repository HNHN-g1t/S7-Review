import { CAMPAIGN_MISSIONS, WALL_SAVE_KEY } from './story/wall1';

// Review games must not read or write real progress, scores, stock, or settings.
export function prepareReviewGameStorage(target: Window = window): void {
  const { hostname, pathname, search } = target.location;
  const screen = new URLSearchParams(search).get('review');
  if (!['localhost', '127.0.0.1', 's7-review.vercel.app'].includes(hostname) || !['/review-game.html', '/review-game'].includes(pathname) || !['story', 'score', 'map'].includes(screen ?? '')) {
    throw new Error('PCの確認画面から開いてください。');
  }
  const values = new Map<string, string>();
  const memory: Storage = {
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(String(key)) ?? null,
    setItem: (key, value) => { values.set(String(key), String(value)); },
    removeItem: key => { values.delete(String(key)); },
    clear: () => { values.clear(); },
  };
  if (screen === 'story') {
    const requested = Number(new URLSearchParams(search).get('stage') ?? 20);
    const selected = CAMPAIGN_MISSIONS.find(mission => mission.stage === requested)?.stage ?? 20;
    // Seed before App state initializes, rather than only changing a transient ref.
    memory.setItem(WALL_SAVE_KEY, JSON.stringify({ cleared: CAMPAIGN_MISSIONS.filter(mission => mission.stage < selected).map(mission => mission.stage), gateReached: false }));
  }
  Object.defineProperty(target, 'localStorage', { value: memory, configurable: false });
  if (target.localStorage !== memory) throw new Error('保存データを分離できないため確認ゲームを開始しません。');
}
