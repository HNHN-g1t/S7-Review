import { prepareEnemyPracticeStorage } from './enemyPracticeConfig';

try {
  prepareEnemyPracticeStorage();
  // main statically imports App, which has startup save migrations.
  // Keep this dynamic import after isolation, including every transitive dependency.
  await import('./main');
} catch (error) {
  document.getElementById('root')!.textContent = error instanceof Error ? error.message : '模擬戦を開始できませんでした。';
}
