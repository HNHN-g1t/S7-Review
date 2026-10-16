import { CAMPAIGN_MISSIONS } from './story/wall1';
const screens = [['ストーリー', '/review-game.html?review=story'], ['スコア', '/review-game.html?review=score'], ['キャラクター図鑑', '/enemies.html'], ['マップ', '/review-game.html?story=map&review=map'], ['ストーリー進行表', '/story-progress.html'], ['ヒッサツメ図鑑', '/skills.html']];
const nav = document.querySelector('nav')!;
const frames: HTMLIFrameElement[] = [];
const controls = document.createElement('div'); controls.className = 'review-story-controls';
let stageIndex = 0;
const select = document.createElement('select'); select.setAttribute('aria-label', 'デバッグするメン');
CAMPAIGN_MISSIONS.forEach(m => { const option = document.createElement('option'); option.value = String(m.stage); option.textContent = m.number + ' ' + m.title; select.append(option); });
const launch = () => { select.selectedIndex = stageIndex; frames[0].src = '/review-game.html?review=story&stage=' + CAMPAIGN_MISSIONS[stageIndex].stage; };
const prev = document.createElement('button'); prev.textContent = '前のメン'; prev.onclick = () => { stageIndex = (stageIndex - 1 + CAMPAIGN_MISSIONS.length) % CAMPAIGN_MISSIONS.length; launch(); };
const next = document.createElement('button'); next.textContent = '次のメン'; next.onclick = () => { stageIndex = (stageIndex + 1) % CAMPAIGN_MISSIONS.length; launch(); };
const retry = document.createElement('button'); retry.textContent = 'やり直す'; retry.onclick = launch;
select.onchange = () => { stageIndex = select.selectedIndex; launch(); };
controls.append(prev, select, next, retry); nav.after(controls);
screens.forEach(([label, url], index) => {
 const button = document.createElement('button'); button.textContent = label; button.setAttribute('role', 'tab');
 const frame = document.createElement('iframe'); frame.title = label; frame.setAttribute('role', 'tabpanel'); frame.allow = 'clipboard-read; clipboard-write'; frame.hidden = index !== 0;
 button.setAttribute('aria-selected', String(index === 0));
 button.onclick = () => { controls.hidden = index !== 0; frames.forEach((f, i) => { f.hidden = i !== index; if (f.hidden && [0, 1, 3].includes(i)) f.src = 'about:blank'; f.contentWindow?.postMessage({ type: 'sainome-review-visible', visible: i === index }, location.origin); nav.children[i].setAttribute('aria-selected', String(i === index)); }); if (!frame.src || frame.src === 'about:blank') { if (index === 0) launch(); else frame.src = url; } };
 frames.push(frame); nav.append(button); document.body.append(frame); if (index === 0) frame.src = url;
});
export {};

