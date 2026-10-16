// ヒドイメの「動き」の決まりごと。ゲーム本体（App.tsx）と確認用ページ（hidoimePreview.tsx）の
// 両方がここを使うので、確認用ページで見た動きがそのままゲームの動きになる。
// 見た目（泡・消滅）は Hidoime.tsx、盤面に置く枠の CSS は index.css の .hidoime-slot。

// --- 登場：上から降ってきて、2列のメを縦にプレスしながら最下段まで沈む ---
// 1. 落下：盤面の上から、2列のうち高いほうのてっぺんに触れるまで。重力のように加速する
export const HIDOIME_FALL_ROW_MS = 22; // 1段あたり（最初の55msから2.5倍速に）
export const HIDOIME_FALL_MIN_MS = 168; // 短い距離でも、これより速くは落とさない
// 2. プレス：真下の段のメを押しつぶしながら、1段ずつ沈む。重いので1段ごとに間を取る
export const HIDOIME_PRESS_ROW_MS = 136; // 最初の340msから2.5倍速に。CSS の die-press と同じ長さ
// 3. 着地：最下段に着いたら、どすんと横につぶれて戻る（CSS の hidoime-land と同じ長さ）
export const HIDOIME_LAND_MS = 460;

// --- 被ダメージ：白く6回点滅し、そのあいだ中の泡やうねりが早送りでもがく ---
export const HIDOIME_HIT_MS = 360; // CSS の hidoime-hit-flash と同じ長さ（6回 × 60ms）
export const HIDOIME_HURT_SPEED = 5; // もがくあいだ、中のアニメーションを何倍速にするか

export const hidoimeFallMs = (rows: number) =>
  Math.max(HIDOIME_FALL_MIN_MS, Math.round(rows * HIDOIME_FALL_ROW_MS));

// 2列の高さから、落ちてくる段取りを決める。
//   topA / topB … 各列でいちばん上にあるメの y（空の列は rows）
//   返す値：fallTo … 落下で止まる左上の y（高いほうの列のてっぺんに、下の辺が触れる位置）
//           pressRows … そこから最下段まで、押しつぶしていく段（上から順）
export const planHidoimeFall = (topA: number, topB: number, rows: number) => {
  const contact = Math.min(topA, topB, rows);
  const fallTo = Math.max(0, contact - 2);
  const pressRows: number[] = [];
  for (let row = Math.max(contact, fallTo + 2); row < rows; row += 1) {
    pressRows.push(row);
  }
  return { fallTo, pressRows };
};

// もがく：ヒドイメの中で動いているアニメーションを、しばらくだけ早送りにする。
// 部品ごとに周期がばらばらなので、再生速度をまとめて上げるのがいちばん素直。
// 戻り値は元の速さに戻す関数。
export const hurryHidoime = (root: Element | null, rate = HIDOIME_HURT_SPEED) => {
  if (!root || typeof root.getAnimations !== 'function') {
    return () => undefined;
  }
  const animations = root.getAnimations({ subtree: true });
  animations.forEach((animation) => {
    animation.playbackRate = rate;
  });
  return () => {
    animations.forEach((animation) => {
      animation.playbackRate = 1;
    });
  };
};

// 押しつぶされたメから飛び散る粒。そのメの色で、上から押されたぶん横へ強く散らす。
// 形は App.tsx の BurstParticle と同じ（.burst-ring / .burst-particle で描く）
export const makePressParticles = (color: string) => {
  const count = 7 + Math.floor(Math.random() * 4); // 7〜10個
  return Array.from({ length: count }, (_, index) => {
    // 左右へ振り分け、上向きは浅く。真下へは飛ばさない（床にめり込んで見える）
    const side = index % 2 === 0 ? -1 : 1;
    const angle = Math.PI / 2 - side * (Math.PI / 2) + side * (Math.random() * 0.9 - 0.15);
    const distance = 38 + Math.random() * 46;
    return {
      dx: Math.cos(angle) * distance,
      dy: -Math.abs(Math.sin(angle)) * distance * 0.7,
      size: 5 + Math.random() * 8,
      delay: Math.random() * 40,
      duration: 420 + Math.random() * 280,
      // 3つに1つは白くして、つぶれた瞬間のきらめきを足す
      color: index % 3 === 2 ? '#ffffff' : color,
    };
  });
};
