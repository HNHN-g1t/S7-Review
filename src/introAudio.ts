// 起動待ちで失われた時間を除き、まだ画面に残っている演出だけを鳴らす。
// resume は必ずタップの呼び出し中に実行し、拒否されてもゲームを止めない。
export function whenIntroAudioRunning(
  ctx: AudioContext,
  durationMs: number,
  play: (remainingMs: number) => void,
  now: () => number = () => performance.now(),
): Promise<void> {
  const started = now();
  const ready = () => {
    const remaining = durationMs - (now() - started);
    if (ctx.state === 'running' && remaining > 0) play(remaining);
  };
  if (ctx.state === 'running') {
    ready();
    return Promise.resolve();
  }
  if (ctx.state === 'closed') return Promise.resolve();
  try {
    return ctx.resume().then(ready, () => undefined);
  } catch {
    return Promise.resolve();
  }
}
