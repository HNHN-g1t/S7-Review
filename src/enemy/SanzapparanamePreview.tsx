import { useEffect, useState } from 'react';
import {sanzEruptionScale} from './sanzapparanameRules';

const heights = [2, 3, 1, 4, 2, 3];
const mixColor = (from: number[], to: number[], heat: number) => `rgb(${from.map((channel, i) => Math.round(channel + (to[i] - channel) * heat)).join(',')})`;
const bodyCells = [5, 3, 1].flatMap((count, row) => Array.from({ length: count }, (_, i) => ({
  id: `${row}-${i}`, x: (5 - count) * 23 + i * 46, y: 92 - row * 46,
  core: i === (count - 1) / 2,
})));
export function rockOutline(removed: Set<string>) {
  type Point = [number, number];
  const cells = bodyCells.filter(c => !removed.has(c.id));
  const connected = new Set(cells.filter(c => c.core).map(c => c.id));
  for (let pass=0; pass<9; pass++) for (const c of cells) if(cells.some(n=>connected.has(n.id)&&Math.abs(c.x-n.x)+Math.abs(c.y-n.y)===46)) connected.add(c.id);
  const edges = new Map<string, [Point,Point]>();
  const key=(a:Point,b:Point)=>`${a}:${b}`;
  for (const c of cells.filter(c=>connected.has(c.id))) {
    const points:Point[]=[[c.x,c.y],[c.x+46,c.y],[c.x+46,c.y+46],[c.x,c.y+46]];
    points.forEach((a,i)=>{const b=points[(i+1)%4];if(!edges.delete(key(b,a)))edges.set(key(a,b),[a,b]);});
  }
  const first=edges.values().next().value!;
  const points:Point[]=[first[0]];let cursor=first[1];edges.delete(key(...first));
  while(String(cursor)!==String(points[0])) {
    points.push(cursor);const next=[...edges.values()].find(e=>String(e[0])===String(cursor));
    if(!next)break;edges.delete(key(...next));cursor=next[1];
  }
  const corners=points.filter((p,i)=>{const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];return(p[0]-a[0])*(b[1]-p[1])!==(p[1]-a[1])*(b[0]-p[0]);});
  const bevel=corners.flatMap((p,i)=>[corners[(i+corners.length-1)%corners.length],corners[(i+1)%corners.length]].map(q=>{const length=Math.hypot(q[0]-p[0],q[1]-p[1]),cut=Math.min(11,length/3);return[p[0]+(q[0]-p[0])*cut/length,p[1]+(q[1]-p[1])*cut/length];}));
  return `M${bevel.map(p=>p.join(',')).join(' L')} Z`;
}

/** 図鑑専用の動作案。ゲームの出現・ターン処理には接続しない。 */
export function SanzapparanamePreview({ paused, hit = false }: { paused: boolean; hit?: boolean }) {
  const [turns, setTurns] = useState(3);
  const [amount, setAmount] = useState(4);
  const [tick, setTick] = useState(0);
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [defeated, setDefeated] = useState(false);
  const [weapon, setWeapon] = useState('スラ3');
  const [message, setMessage] = useState('外周セルをクリックすると、そのセルを削れます。');
  const outline = rockOutline(removed);
  const [impact, setImpact] = useState(false);
  useEffect(() => { if (!impact) return; const timer = window.setTimeout(() => setImpact(false), 240); return () => window.clearTimeout(timer); }, [impact]);
  const duration = turns * 1000 + 2400;
  useEffect(() => {
    if (paused || defeated) return;
    const timer = window.setInterval(() => setTick(value => (value + 40) % duration), 40);
    return () => window.clearInterval(timer);
  }, [paused, duration, defeated]);
  const firing = tick >= turns * 1000;
  const phase = firing ? Math.min(1, (tick - turns * 1000) / 1800) : 0;
  const heat = Math.min(2, Math.floor(tick / (turns * 1000 / 3)));
  const charge = Math.min(tick, turns * 1000) / 4000;
  const maxCharge = charge >= 1;
  const flightElapsed = tick - turns * 1000;
  const eruptionScale = firing ? sanzEruptionScale(flightElapsed) : 1;
  const restart = () => setTick(0);
  const resetBody = () => { setRemoved(new Set()); setDefeated(false); restart(); setMessage('外周セルをクリックすると、そのセルを削れます。'); };
  const adjacentHit = (id: string) => {
    const cell = bodyCells.find(value => value.id === id)!;
    if (cell.core) { setMessage('中央の縦3セルは無敵。ツラヌキ系ひっさつメを最下段の目へ！'); return; }
    setRemoved(value => new Set([...value, id]));
    setImpact(true);
    setMessage('隣接攻撃が当たった外周セルを削りました。');
  };
  const pierceEye = () => { setDefeated(true); setMessage(`${weapon}が最下段中央の目に命中！ サンザッパラナメ撃破！`); };
  return <div className="sanz-preview">
    <div className="sanz-settings">
      <label>噴火まで <select value={turns} onChange={event => { const value = Number(event.target.value); setTurns(value); setAmount((value - 1) * 2); restart(); }} aria-label="噴火までのターン数">{[2, 3, 4].map(n => <option key={n} value={n}>{n}ターン</option>)}</select></label>
      <label>発射数 <select value={amount} onChange={event => { setAmount(Number(event.target.value)); restart(); }} aria-label="コイツメ発射数">{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}体</option>)}</select></label>
      <button type="button" onClick={restart}>最初から</button>
      <button type="button" onClick={resetBody}>身体をもどす</button>
      <label>ツラヌキ系 <select aria-label="目に当てるひっさつメ" value={weapon} onChange={event => setWeapon(event.target.value)}>{['スラ3', 'スト6', 'イチニノサンダー'].map(value => <option key={value}>{value}</option>)}</select></label>
      <button type="button" disabled={defeated} onClick={pierceEye}>ひっさつメを目に当てる</button>
    </div>
    <style>{`@keyframes sanz-impact {0%,28%,56%{opacity:.95}14%,42%{opacity:.1}100%{opacity:0}}`}</style>
    <svg viewBox="0 0 640 440" aria-label="融合した5・3・1段のサンザッパラナメ。最下段中央に1つの目。外周セルを選択して隣接攻撃を確認できます">
      <defs>
        <pattern id="sanz-grid" width="48" height="48" patternUnits="userSpaceOnUse"><rect width="48" height="48" fill="#242a34"/><rect width="24" height="24" fill="#2b323d"/><rect x="24" y="24" width="24" height="24" fill="#2b323d"/></pattern>
        <linearGradient id="sanz-heat" x1="0" y1="1" x2="0" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0" stopColor={mixColor([25,159,186], [255,65,30], charge)}/>
          <stop offset=".35" stopColor={mixColor([54,195,171], [255,39,22], charge)}/>
          <stop offset=".72" stopColor={mixColor([241,180,67], [255,17,18], charge)}/>
          <stop offset="1" stopColor={mixColor([233,55,66], [255,4,12], charge)}/>
        </linearGradient>
        <linearGradient id="sanz-lava" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#080307"/><stop offset=".5" stopColor="#9e101c"/><stop offset="1" stopColor="#ff3915"/></linearGradient>
        <linearGradient id="sanz-bezel" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".4"/><stop offset=".45" stopColor="#fff" stopOpacity=".1"/><stop offset="1" stopColor="#000" stopOpacity=".4"/></linearGradient>
        <clipPath id="sanz-outline"><path d={outline}/></clipPath>
        <clipPath id="sanz-eye"><path d="M96 112 Q115 121 134 112 Q132 125 115 125 Q98 125 96 112Z"/></clipPath>
        <pattern id="sanz-stripes" width="240" height="10" patternUnits="userSpaceOnUse"><rect width="240" height="3" fill="#142c3e" opacity=".2"/><rect y="6" width="240" height="1" fill="#ff874a" opacity=".16"/></pattern>
      </defs>
      <rect width="640" height="440" rx="16" fill="url(#sanz-grid)"/>
      <text x="24" y="32" fill="#fff" fontSize="15">{defeated ? '撃破！' : firing ? `噴火！ コイツメ${amount}体` : `${Math.min(turns, Math.floor(tick / 1000) + 1)} / ${turns}ターン · ${['平常', '蓄熱', '噴火直前'][heat]}`}</text>
      {heights.map((height, column) => Array.from({ length: height }, (_, row) => <g key={`${column}-${row}`} transform={`translate(${338 + column * 46},${394 - row * 46})`}><rect width="42" height="42" rx="10" fill={['#f568a6', '#8548c9', '#49ac4b'][column % 3]}/><circle cx="21" cy="21" r="5" fill="white"/></g>))}
      {!defeated && <g transform={`translate(35,250) translate(0,138) scale(1,${eruptionScale}) translate(0,-138)`}>
        <g>
          <path data-sanz-body="true" d={outline} fill="url(#sanz-heat)"/>
          <g clipPath="url(#sanz-outline)">
            <rect x="-10" y="-10" width="260" height="160" fill="url(#sanz-stripes)"/>
            {Array.from({length: maxCharge ? 40 : 24}, (_, i) => {
              const multiplier = maxCharge ? 3 : 1;
              const cycle = 3200 * multiplier;
              const life = 704 * multiplier;
              const age = (tick + i * 431 * multiplier) % cycle;
              const visible = age < life;
              return <circle key={i} data-sanz-particle={i} cx={24 + (i * 37) % 184} cy={128 - (i * 19) % 96 - age * (50 / 3200) * multiplier} r={i % 3 === 0 ? 2.5 : 1.5} fill={i % 2 ? '#ffc859' : '#ff643b'} opacity={visible ? Math.sin(age / life * Math.PI) * .8 : 0}/>;
            })}
            <path d={outline} fill="none" stroke="url(#sanz-bezel)" strokeWidth="8" strokeLinejoin="bevel"/>
            {(hit || impact) && <path key={hit ? 'loop-hit' : 'cell-hit'} d={outline} fill="white" style={{animation:'sanz-impact 240ms linear both',animationPlayState:paused?'paused':'running'}}/>}
          </g>
        </g>
        {hit ? <path data-sanz-eye="closed" d="M96 119 Q115 129 134 119 M98 123 L94 125 M132 123 L136 125" fill="none" stroke="#16313d" strokeWidth="3.5" strokeLinecap="round"/> : <g data-sanz-eye="half-open">
          <path d="M96 112 Q115 121 134 112 Q132 125 115 125 Q98 125 96 112Z" fill="#edfaff"/>
          <circle cx="115" cy="119" r="7" fill="#15354b" clipPath="url(#sanz-eye)"/>
          <path d="M96 111 L112 116 M118 116 L134 111" fill="none" stroke="#16313d" strokeWidth="3" strokeLinecap="round"/>
        </g>}
        <path d="M101 9 L127 9 L133 15 L128 24 L103 24 L97 17Z" fill="url(#sanz-lava)"/>
        <path d="M103 11 L126 11 L130 15 L124 19 L105 19 L100 16Z" fill="#050306"/>
        {bodyCells.filter(cell => !removed.has(cell.id)).map(cell => <rect key={cell.id} x={cell.x} y={cell.y} width="46" height="46" fill="transparent" role="button" tabIndex={0} aria-label={cell.core ? `中央無敵セル ${3 - cell.y / 46}段目に隣接攻撃` : `外周セル ${cell.id}に隣接攻撃`} onClick={() => adjacentHit(cell.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); adjacentHit(cell.id); } }} style={{ cursor: 'crosshair' }}/>) }
      </g>}
      {!defeated && firing && Array.from({ length: amount }, (_, i) => {
        const launchDelay = 280 + i * 12;
        if (flightElapsed < launchDelay) return null;
        const landingTime = launchDelay + 1476;
        const p = Math.max(0, Math.min(1, (flightElapsed - launchDelay) / 1476));
        const glowOpacity = Math.max(0, 1 - Math.max(0, flightElapsed - landingTime) / 400);
        const targetX = 359 + i * 46;
        const targetY = 373 - (heights[i] - 1) * 46;
        const x = 150 + (targetX - 150) * p;
        const y = 250 + (targetY - 250) * p - 750 * p * (1 - p);
        return <g key={i} transform={`translate(${x - 20},${y - 20}) rotate(${p < 1 ? p * 360 : 0},20,20)`}>
          <g opacity={glowOpacity} data-sanz-glow={i}>
            <rect x="-8" y="-8" width="56" height="56" rx="18" fill="#ff2020" opacity=".12"/>
            <rect x="-5" y="-5" width="50" height="50" rx="15" fill="#ff2020" opacity=".2"/>
            <rect x="-2" y="-2" width="44" height="44" rx="12" fill="#ff4935" opacity=".65"/>
          </g>
          <rect width="40" height="40" rx="10" fill="#2c3446" stroke="#111824" strokeWidth="2"/>
          <rect width="40" height="40" rx="10" fill="none" stroke="#ff7360" strokeWidth="2" opacity={glowOpacity}/>
          {i % 2 ? <path d="M9 12l8 9m0-9l-8 9m15-9l8 9m0-9l-8 9" stroke="#e4edfc" strokeWidth="3.5" strokeLinecap="round"/> : <path d="M8 14L14 20L20 14M22 14L28 20L34 14" fill="none" stroke="#e4edfc" strokeWidth="3.5" strokeLinecap="round"/>}
        </g>;
      })}
      {!defeated && firing && phase > .12 && <text x="24" y="418" fill="#fff" fontSize="14">サイカ：また出した！さんざっぱら出てくるね！</text>}
    </svg>
    <p role="status">{message}</p>
    <p>下から5・3・1コが融合した身体。下段青緑〜上段赤から蓄熱とともに赤くなり、4ターンMAXで朱色〜R255のほぼ真っ赤なグラデーション。最下段中央の目でにらむ。</p>
    <p>火口は黒い穴と下部の赤い溶岩。噴火したコイツメ・ダーメの赤発光は着地後400msで消える。</p>
    <p>隣接有効範囲の攻撃で当たった外周セルを削る。中央の縦3セルは無敵。スラ3・スト6・スク4・ニコニコボム・イチニノサンダーを目に当てると撃破（スク4・ニコニコボムは2026-10-14追加。この見本のボタンは3種のまま）。</p>
    <p>発射量の案：2ターンで1〜2体／3ターンで3〜4体／4ターンで5〜6体。1秒を1ターンとして繰り返し表示。</p>
  </div>;
}
