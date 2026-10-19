// 2026-10-19：ストーリーとスコアのタブはやめ、本編は Vercel の公開版を別タブで開くリンクにした
const screens = [['キャラクター図鑑', '/enemies.html'], ['マップ', '/review-game.html?story=map&review=map'], ['ストーリー進行表', '/story-progress.html'], ['ヒッサツメ図鑑', '/skills.html']];
const RESET_WHEN_HIDDEN = ['マップ']; // ゲームを動かすタブは、離れたら止める
const PUBLIC_GAME_URL = 'https://sainome-seven.vercel.app/';
const nav = document.querySelector('nav')!;
const frames: HTMLIFrameElement[] = [];
screens.forEach(([label, url], index) => {
 const button = document.createElement('button'); button.textContent = label; button.setAttribute('role', 'tab');
 const frame = document.createElement('iframe'); frame.title = label; frame.setAttribute('role', 'tabpanel'); frame.allow = 'clipboard-read; clipboard-write'; frame.hidden = index !== 0;
 button.setAttribute('aria-selected', String(index === 0));
 button.onclick = () => { frames.forEach((f, i) => { f.hidden = i !== index; if (f.hidden && RESET_WHEN_HIDDEN.includes(screens[i][0])) f.src = 'about:blank'; f.contentWindow?.postMessage({ type: 'sainome-review-visible', visible: i === index }, location.origin); nav.children[i].setAttribute('aria-selected', String(i === index)); }); if (!frame.src || frame.src === 'about:blank') frame.src = url; };
 frames.push(frame); nav.append(button); document.body.append(frame); if (index === 0) frame.src = url;
});
const publicGame = document.createElement('a'); publicGame.href = PUBLIC_GAME_URL; publicGame.target = '_blank'; publicGame.rel = 'noopener'; publicGame.className = 'review-public-link'; publicGame.textContent = '本編（公開版）↗'; publicGame.title = PUBLIC_GAME_URL;
nav.append(publicGame);
export {};
