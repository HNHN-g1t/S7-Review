import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Vercelはルート直下で配信するので絶対パスでよい。
  // GitHub Pagesのようなサブパス配信に戻す場合は './' に変える。
  base: '/',
  server: { port: 5173 },
  // ゲーム本体に加えて、ヒドイメの確認用ページも書き出す（スマホで /hidoime-preview.html を開く）
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        hidoime: 'hidoime-preview.html',
        // 図鑑は個人確認用。通常の本番ビルドには含めない。
        ...(mode === 'gallery' ? { enemies: 'enemies.html', skills: 'skills.html', sync: 'sync.html', review: 'review.html', storyProgress: 'story-progress.html', enemyPractice: 'enemy-practice.html', reviewGame: 'review-game.html', pixelPrompts: 'pixel-prompts.html' } : {}),
      },
    },
  },
}));

