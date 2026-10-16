export function zoromeFaceFor(mood = 'idle', text = ''): string {
  if (/ちゃんと考えて|どうした？/.test(text) || mood === 'worry') return 'z03';
  if (mood === 'praise' || mood === 'bigChain') return 'z05';
  if (mood === 'smile' || mood === 'chain' || mood === 'relief') return 'z06';
  if (mood === 'bomb') return 'z04';
  if (mood === 'surprise') return 'z02';
  return 'z01';
}
