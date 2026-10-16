// 端末を振動させる（ハプティクス）。
// Android などは navigator.vibrate で震える。
//
// iPhone（Safari）は navigator.vibrate が無く、Web からは震わせられない。
// 2026-10-02 に iPhone 15 / iOS 26 で確かめた結果：
//   ・スイッチ型チェックボックス（<input type="checkbox" switch>）を指で直接切り替えると震える
//   ・同じスイッチをプログラムから押す（label.click / input.click）と震えない
// ゲームの出来事（爆発・撃破）に合わせて震わせるには、指で触れた瞬間でないといけないので無理。
// iPhone で震わせたいときは、iOS アプリにして本来の振動の仕組みを使う。

const vibrate = (steps: number | number[]) => {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(steps);
    }
  } catch {
    // 振動できなくても遊びには関係ないので黙って続ける
  }
};

export const haptics = {
  // ひっさつメ・ニコニコボムの爆発
  bomb: () => vibrate([40, 70, 40]),
  // ヒドイメ・ベラボウメなど大きな敵を倒した、虹ボムの破裂
  big: () => vibrate([60, 80, 60, 80, 60]),
  // 虹ボムの「使う？」を押した瞬間
  tap: () => vibrate(30),
};
