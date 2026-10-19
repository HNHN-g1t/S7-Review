// 2026-10-19：本編は公開版を別タブで開き、反映手順は確認サイト内に表示する
const screens = [['キャラクター図鑑', '/enemies.html'], ['ヒッサツメ図鑑', '/skills.html'], ['マップ', '/review-game.html?story=map&review=map'], ['ストーリー進行表', '/story-progress.html'], ['本体へ反映', '/sync.html']];
const RESET_WHEN_HIDDEN = ['マップ'];
const PUBLIC_GAME_URL = 'https://sainome-seven.vercel.app/';
const nav = document.querySelector('nav')!;
const frames: HTMLIFrameElement[] = [];
const buttons: HTMLButtonElement[] = [];
const workshop = document.createElement('a'); workshop.href = '/pixel-prompts.html'; workshop.className = 'review-workshop-link'; workshop.textContent = 'ドット絵プロンプト工房';
nav.append(workshop);
screens.forEach(([label, url], index) => {
 const button = document.createElement('button'); button.textContent = label; button.setAttribute('role', 'tab');
 const frame = document.createElement('iframe'); frame.title = label; frame.setAttribute('role', 'tabpanel'); frame.allow = 'clipboard-read; clipboard-write'; frame.hidden = index !== 0;
 button.setAttribute('aria-selected', String(index === 0));
 button.onclick = () => { frames.forEach((f, i) => { f.hidden = i !== index; if (f.hidden && RESET_WHEN_HIDDEN.includes(screens[i][0])) f.src = 'about:blank'; f.contentWindow?.postMessage({ type: 'sainome-review-visible', visible: i === index }, location.origin); buttons[i].setAttribute('aria-selected', String(i === index)); }); if (!frame.src || frame.src === 'about:blank') frame.src = url; };
 frames.push(frame); buttons.push(button); nav.append(button); document.body.append(frame); if (index === 0) frame.src = url;
});
const publicGame = document.createElement('a'); publicGame.href = PUBLIC_GAME_URL; publicGame.target = '_blank'; publicGame.rel = 'noopener'; publicGame.className = 'review-public-link'; publicGame.textContent = '本編（公開版）↗'; publicGame.title = PUBLIC_GAME_URL;
nav.append(publicGame);
export {};
