import { prepareReviewGameStorage } from './reviewGameStorage';

try {
  prepareReviewGameStorage();
  // App has save migrations at module scope; never statically import it here.
  await import('./main');
} catch (error) {
  document.getElementById('root')!.textContent = error instanceof Error ? error.message : '確認ゲームを開始できませんでした。';
}
