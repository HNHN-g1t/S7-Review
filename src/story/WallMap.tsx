import { useEffect, useRef, useState } from 'react';
import {
  ALL_MISSIONS, ALL_WALLS, CAMPAIGN_MISSIONS, FUTURE_MISSIONS,
  wallAbilities, wallForStage, wallGate, wallLinks, wallMission,
  wallTitle, wallUnlocked, wallUnlockHint, type WallProgress,
} from './wall1';
import './wall-map.css';
import './wall-one-map.css';
import {WALL_ONE_LAYOUT} from './wallOneLayout';
import { zoromeFaceFor } from './zoromeFace';
import { gateLinks, roadBends, smoothPath, terrainFor, type Pt, type TerrainFeature } from './wallTerrain';

// マップの自分のコマ。今いるマスの右上に、ピンクの吹き出しでサイカの顔（画像は後で差し替え予定）
const TRAVELER_FACE = '/images/saika-01.png';

export function ZoromeSage({ mood = 'idle', text = '' }: { mood?: string; text?: string }) {
  const face = zoromeFaceFor(mood, text);
  return <img className="zorome-sage zorome-face-image" src={`/zorome/${face}.png`} alt="仙人" data-face={face} />;
}

const abilityNames: Record<string, string> = {
  spa1: 'スーパー1', sla3: 'スラッシュ3', squ4: 'スクウェア4', str6: 'ストレイト6',
  nico: 'ニコニコボム', fever: 'フィーバー', rainbow: '虹ボム', thunder: 'イチニノサンダー',
};
const abilityMarks: Record<string, string> = { spa1: '1', sla3: '3', squ4: '4', str6: '6', nico: '☺', fever: 'F', rainbow: '虹', thunder: '⚡' };
const missionsIn = (wall: number) => ALL_MISSIONS.filter(mission => mission.wall === wall);
const latestOpenWall = (progress: WallProgress) => Math.max(1, ...CAMPAIGN_MISSIONS.filter(mission => wallUnlocked(mission.stage, progress.cleared)).map(mission => mission.wall));
const startingMission = (wall: number, progress: WallProgress) => {
  const missions = missionsIn(wall);
  return missions.find(mission => !progress.cleared.includes(mission.stage) && wallUnlocked(mission.stage, progress.cleared))
    ?? (missions.some(mission => wallUnlocked(mission.stage, progress.cleared)) ? missions.find(mission => mission.stage === wallGate(wall)) : undefined)
    ?? missions[0];
};
type MapPoint = { stage: number; x: number; y: number };

export function WallMap({ progress, initialStage, onStart, onGate, onLegacy, onClose, onEnding, endingSeen, onUra, onUraEnding, reviewMap = false }: {
  reviewMap?: boolean;
  progress: WallProgress; initialStage?: number | null; onStart: (stage: number) => void;
  onGate: (wall: number) => void; onLegacy: () => void; onClose: () => void;
  // 最後のウォールの門（王座）からエンディングを見る
  onEnding?: () => void;
  // エンディングを見たあと、王座に「？？？」（ウラメンの入口）を出す
  endingSeen?: boolean; onUra?: () => void;
  // ウラ1の門からウラエンディングを見る
  onUraEnding?: () => void;
}) {
  const returnMission = wallMission(initialStage ?? -1);
  const initialWall = initialStage === 0 ? 1 : returnMission ? wallForStage(returnMission.stage)! : latestOpenWall(progress);
  const initialMission = initialStage === 0 ? { stage: 0, x: 12, y: 90 }
    : returnMission && wallUnlocked(returnMission.stage, progress.cleared) ? returnMission : startingMission(initialWall, progress);
  const [wall, setWall] = useState(initialWall);
  const [selected, setSelected] = useState(initialMission.stage);
  const [point, setPoint] = useState({ x: initialMission.x, y: initialMission.y });
  const [moving, setMoving] = useState(false);
  const [notice, setNotice] = useState('');
  const location = useRef(initialMission.stage);
  const walking = useRef(false);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { alive.current = true; return () => { alive.current = false; clearTimeout(timer.current); }; }, []);

  const screen = useRef<HTMLElement>(null);
  useEffect(()=>{if(wall === 1)screen.current?.querySelector('.wall-node.selected')?.scrollIntoView({block:'center'});},[wall]);

  const area = ALL_WALLS.find(area => area.wall === wall)!;
  // ウラメン（黒い世界）は表とつながらない。ウラ9 → ウラ1 と下へ進む
  const isUra = !!area.ura;
  const nextArea = ALL_WALLS.find(item => item.wall === wall + 1 && !!item.ura === isUra);
  // 2026-10-15：まだ開けていない門の先（次のウォール）は見られない。このウォールのボスを倒すまで先へ進むボタンを閉じる
  const nextOpen = (() => { const gate = wallGate(wall); return gate !== undefined && progress.cleared.includes(gate); })();
  const prevArea = ALL_WALLS.find(item => item.wall === wall - 1 && !!item.ura === isUra);
  const missions = missionsIn(wall);
  const future = FUTURE_MISSIONS.filter(mission => mission.wall === wall);
  const boss = wallGate(wall);
  // Gates have UI-only negative IDs; positive IDs are exclusively game missions.
  const gateId = -wall;
  const terrain = area.implemented ? terrainFor(wall) : undefined;
  const gatePoint = wall === 1 ? [17, 5.5] : terrain?.gate ?? (isUra ? [50, 97] : [50, 1]);
  const targets: MapPoint[] = area.implemented
    ? [...(wall === 1 ? [{ stage: 0, ...WALL_ONE_LAYOUT[0] }] : []), ...missions.map(m => wall === 1 ? {...m,...WALL_ONE_LAYOUT[m.stage]} : m), { stage: gateId, x: gatePoint[0], y: gatePoint[1] }]
    : future;
  // 道は面と面を、地形の曲がり角を通ってつなぐ
  const roadPoints = (a: number, b: number): Pt[] | null => {
    const start = targets.find(target => target.stage === a), end = targets.find(target => target.stage === b);
    return start && end ? [[start.x, start.y], ...roadBends(terrain, a, b), [end.x, end.y]] : null;
  };
  const links = area.implemented && boss !== undefined ? [...wallLinks(wall), ...gateLinks(wall, boss)] : [];
  const canGo = (stage: number) => area.implemented && (stage === gateId
    ? boss !== undefined && progress.cleared.includes(boss) : wallUnlocked(stage, progress.cleared));
  const reached = (number: number) => progress.reachedWalls?.includes(number) || number === 1 && progress.gateReached;
  const open = missions.some(mission => wallUnlocked(mission.stage, progress.cleared));
  const completed = missions.filter(mission => progress.cleared.includes(mission.stage)).length;
  const abilities = wallAbilities(progress.cleared);
  const mission = wallMission(selected);
  const atGate = selected === gateId;
  const tutorial = selected === 0;
  const lockedHint = area.implemented && !canGo(selected)
    ? atGate ? `${wallMission(boss ?? -1)?.number}をクリア` : wallUnlockHint(selected, progress.cleared) : '';

  const changeWall = (number: number) => {
    if (walking.current || number === wall) return;
    const destination = startingMission(number, progress) ?? FUTURE_MISSIONS.find(mission => mission.wall === number)!;
    setWall(number); setSelected(destination.stage); setPoint({ x: destination.x, y: destination.y });
    location.current = destination.stage;
    setNotice('');
  };

  const visit = (stage: number) => {
    if (walking.current || !area.implemented) return;
    setNotice('');
    if (!canGo(stage)) { setSelected(stage); return; }
    if (wall === 1) {
      const destination = targets.find(target => target.stage === stage);
      if (!destination) return;
      setSelected(stage); setPoint({x:destination.x,y:destination.y}); location.current=stage;
      if (stage === gateId) {
        onGate(1);
        if(nextArea?.implemented){
          walking.current=true;setMoving(true);
          timer.current=setTimeout(()=>{if(!alive.current)return;walking.current=false;setMoving(false);changeWall(2);},450);
        }
      }
      return;
    }
    // Inspecting a locked node does not move the traveler or change the route origin.
    const origin = location.current;
    const queue: number[][] = [[origin]], seen = new Set([origin]);
    let path: number[] | undefined;
    if (stage === 0 || origin === 0) path = [stage]; // The tutorial island is separate.
    else while (queue.length) {
      const route = queue.shift()!;
      const last = route[route.length - 1];
      if (last === stage) { path = route.slice(1); break; }
      for (const [a, b] of links) {
        const next = a === last ? b : b === last ? a : undefined;
        if (next !== undefined && !seen.has(next) && canGo(next)) { seen.add(next); queue.push([...route, next]); }
      }
    }
    if (!path) { setNotice('道がまだつながっていない'); return; }
    const steps = path.length ? path : [stage];
    // 曲がり角も1歩ずつたどる（角では短く止まる）
    const hops: { stage?: number; x: number; y: number }[] = [];
    let from = origin;
    for (const step of steps) {
      const destination = targets.find(target => target.stage === step);
      if (!destination) break;
      roadBends(terrain, from, step).forEach(([x, y]) => hops.push({ x, y }));
      hops.push({ stage: step, x: destination.x, y: destination.y });
      from = step;
    }
    let index = 0;
    walking.current = true; setMoving(true); setSelected(stage);
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const walk = () => {
      if (!alive.current) return;
      const hop = hops[index++];
      if (!hop) { walking.current = false; setMoving(false); return; }
      setPoint({ x: hop.x, y: hop.y });
      if (hop.stage !== undefined) location.current = hop.stage;
      timer.current = setTimeout(() => {
        if (index < hops.length) walk();
        else {
          walking.current = false; setMoving(false);
          if (stage === gateId) onGate(wall);
        }
      }, still ? 0 : hop.stage === undefined ? 220 : 340);
    };
    walk();
  };

  const lastWall = !nextArea?.implemented;
  const finalGate = atGate && lastWall && canGo(gateId);
  const detailTitle = !area.implemented ? '続きは準備中'
    : atGate ? finalGate ? (isUra ? 'ウラの底を突破' : '王座の間を突破') : canGo(gateId) ? `${isUra ? area.title : `ウォール${wall}`} 突破` : '次のウォールへの門'
    : tutorial ? 'チュートリアル草原' : mission?.title;
  const detailText = !area.implemented ? '8枠・未実装'
    : atGate ? finalGate ? (isUra ? 'ほんとうのおわり' : 'サイノメたちの冒険のおわり') : canGo(gateId) ? `${isUra ? nextArea?.title : `ウォール${wall + 1}`}へ` : 'ボスを倒して門へ'
    : '';

  const wallName = isUra ? area.title : `ウォール${wall}`;
  return <section ref={screen} className={`wall-map-screen wall-area-${wall} ${isUra ? 'wall-ura' : ''} ${wall === 1 ? 'wall-illustrated' : ''}`} aria-label={`${wallName} ステージマップ`}>
    <div className="wall-map-shell">
      <header><div><small>{wall === 1 ? 'ハジメマ草原' : isUra ? area.subtitle : area.title}</small><h1>{wallName}</h1></div><button onClick={onClose} aria-label="タイトルへ戻る">✕</button></header>
      <div className="wall-powers">
        <div className="wall-abilities" aria-label={abilities.length ? `習得済み：${abilities.map(ability => abilityNames[ability]).join('、')}` : 'ひっさつメ未習得'}>
          {abilities.length ? abilities.map(ability => <span key={ability} title={abilityNames[ability]} aria-hidden>{abilityMarks[ability]}</span>) : <span aria-hidden>—</span>}
        </div>
        <span>{!area.implemented ? '準備中' : !open ? '🔒 未解放' : <><span aria-hidden>⚑ </span>{completed}/{missionsIn(wall).length}</>}</span>
      </div>
      {reviewMap&&<nav className="wall-review-worlds" aria-label="確認するマップ"><button aria-pressed={!isUra} disabled={moving} onClick={()=>changeWall(1)}>表ステージ</button><button aria-pressed={isUra} disabled={moving} onClick={()=>changeWall(11)}>裏ステージ</button><select aria-label="確認するウォール" value={wall} disabled={moving} onChange={e=>changeWall(Number(e.target.value))}>{ALL_WALLS.map(a=><option key={a.wall} value={a.wall}>{a.ura?a.title:'ウォール'+a.wall}</option>)}</select></nav>}
      {/* ウォールの移動は前後だけ。表は上の ▲ で次・下の ▼ で前。ウラは逆向き（上の ▲ で前・下の ▼ で次） */}
      {isUra ? (prevArea ? (
        <button className="wall-step is-up" disabled={moving} onClick={() => changeWall(wall - 1)} aria-label={`${prevArea.title}へ`}>
          ▲<span>{prevArea.title}</span>
        </button>
      ) : <button className="wall-step is-up" disabled aria-label="これより上のウラはない">▲</button>)
      : nextArea && nextOpen ? (
        <button className="wall-step is-up" disabled={moving} onClick={() => changeWall(wall + 1)} aria-label={`ウォール${wall + 1} ${nextArea.title}へ`}>
          ▲<span>ウォール{wall + 1}</span>
        </button>
      ) : nextArea ? (
        <button className="wall-step is-up" disabled aria-label={`ウォール${wall + 1}は門を開けるまで見られない`}>
          ▲<span>🔒 門を開けると進める</span>
        </button>
      ) : <button className="wall-step is-up" disabled aria-label="この先のウォールはまだない">▲</button>}
      <div className={`wall-land ${!area.implemented ? 'future' : ''}`}>
        {wall === 1 ? <img className="wall-one-art" src="/maps/wall1.png" width="1024" height="1536" alt="ハジメマ草原。草原の広場と門をつなぐ道" draggable={false}/> : terrain ? <TerrainLayer land={terrain.land} features={terrain.features}/> : <div className="wall-meadow"/>}

        {wall !== 1 && <svg className="wall-roads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {wall === 1 && missions[0] && <line className="tutorial-link" x1={12} y1={90} x2={missions[0].x} y2={missions[0].y} vectorEffect="non-scaling-stroke" />}
          {links.map(([a, b]) => {
            const points = roadPoints(a, b);
            return points ? <polyline key={`${a}-${b}`} className={canGo(a) && canGo(b) ? '' : 'locked'}
              points={points.map(([x, y]) => `${x},${y}`).join(' ')} vectorEffect="non-scaling-stroke"/> : null;
          })}
        </svg>}
        {targets.map(target => {
          if (!area.implemented) return <div key={target.stage} className="wall-node future" style={{ left: `${target.x}%`, top: `${target.y}%` }}
            aria-label={`${future.find(slot => slot.stage === target.stage)?.number} 準備中`}><span aria-hidden>…</span><small>{future.find(slot => slot.stage === target.stage)?.number}</small></div>;
          const nodeMission = wallMission(target.stage);
          const gate = target.stage === gateId;
          const isTutorial = target.stage === 0;
          const unlocked = canGo(target.stage);
          const done = gate ? reached(wall) : progress.cleared.includes(target.stage);
          const name = gate ? `ウォール${wall}の門` : wallTitle(target.stage);
          return <button key={target.stage} className={`wall-node ${selected === target.stage ? 'selected' : ''} ${unlocked ? '' : 'locked'} ${done ? 'done' : ''} ${isTutorial ? 'tutorial' : ''} ${gate ? 'gate' : ''} ${nodeMission?.kind === 'lesson' ? 'lesson' : ''} ${nodeMission?.kind === 'shortcut' ? 'shortcut' : ''}`}
            style={{ left: `${target.x}%`, top: `${target.y}%` }} onClick={() => visit(target.stage)} disabled={moving}
            aria-label={`${name}${nodeMission?.optional ? '・任意' : ''}${done ? '・クリア済み' : !unlocked ? '・未解放。条件を見る' : ''}`} aria-pressed={selected === target.stage}>
            <span>{!unlocked ? <i className="wall-lock-icon" aria-hidden/> : gate ? <i className="wall-gate-icon" aria-hidden/>
              : isTutorial ? '0' : nodeMission?.kind === 'lesson' ? <ZoromeSage/> : nodeMission?.number.split('-')[1]}</span>
            {wall !== 1 && nodeMission?.optional && <i className="wall-optional-mark" aria-hidden>＋</i>}
            <small>{isTutorial ? (wall === 1 ? '0' : 'チュートリアル草原') : gate ? (lastWall ? (isUra ? 'ウラの底' : '王座') : '門') : nodeMission?.number}{done ? ' ✓' : ''}</small>
          </button>;
        })}
        {area.implemented && open && <div className={`wall-traveler ${moving ? 'walking' : ''}`} style={{ left: `${wall === 1 ? targets.find(t=>t.stage===location.current)?.x ?? point.x : point.x}%`, top: `${wall === 1 ? targets.find(t=>t.stage===location.current)?.y ?? point.y : point.y}%` }} aria-hidden><img src={TRAVELER_FACE} alt=""/></div>}
      </div>
      {isUra ? (nextArea && nextOpen ? (
        <button className="wall-step is-down" disabled={moving} onClick={() => changeWall(wall + 1)} aria-label={`${nextArea.title}へ`}>
          ▼<span>{nextArea.title}</span>
        </button>
      ) : nextArea ? (
        <button className="wall-step is-down" disabled aria-label={`${nextArea.title}は門を開けるまで見られない`}>
          ▼<span>🔒 門を開けると進める</span>
        </button>
      ) : <button className="wall-step is-down" disabled aria-label="ここがウラの底">▼</button>)
      : prevArea ? (
        <button className="wall-step is-down" disabled={moving} onClick={() => changeWall(wall - 1)} aria-label={`ウォール${wall - 1} ${prevArea.title}へ`}>
          ▼<span>ウォール{wall - 1}</span>
        </button>
      ) : <button className="wall-step is-down" disabled aria-label="これより前のウォールはない">▼</button>}
      <div className="wall-detail" aria-live="polite" aria-busy={moving}>
        <small>{notice || (moving ? '移動中…' : !area.implemented ? `ウォール${wall}` : atGate ? '⚑ 門' : tutorial ? '0メン' : `${mission?.number}${wall !== 1 && mission?.optional ? ' · 任意' : mission?.kind === 'shortcut' ? ' · 近道' : mission?.kind === 'lesson' ? ' · 仙人' : ''}`)}</small>
        <h2>{detailTitle}</h2>{detailText && <p className="wall-objective">{detailText}</p>}
        {lockedHint && <p className="wall-unlock-hint">🔒 {lockedHint}</p>}
        {!area.implemented ? <button onClick={() => changeWall(latestOpenWall(progress))}>冒険にもどる</button>
          : atGate ? <button disabled={moving || !canGo(gateId)} onClick={() => {
            if (!canGo(gateId) || walking.current) return;
            if (!reached(wall)) onGate(wall);
            if (lastWall) (isUra ? onUraEnding : onEnding)?.();
            else changeWall(wall + 1);
          }}>{lastWall ? (isUra ? 'ウラエンディングを見る' : 'エンディングを見る') : isUra ? '下のウラへ ↓' : '次のウォールへ →'}</button>
          : <button className={!canGo(selected) ? undefined : progress.cleared.includes(selected) ? 'wall-retry' : 'wall-challenge'} disabled={moving || !canGo(selected)} onClick={() => { if (canGo(selected) && !walking.current) onStart(selected); }}>
            {!canGo(selected) ? '未解放' : progress.cleared.includes(selected) ? '再トライ' : '挑戦する！'}
          </button>}
        {/* エンディングを見たあとだけ、王座に「？？？」が出る（ウラメンの入口） */}
        {atGate && finalGate && !isUra && endingSeen && onUra ? <button className="wall-ura-entry" disabled={moving} onClick={onUra}>？？？</button> : null}
      </div>
      <footer><button onClick={onLegacy}>順次進行版へ</button><span>{isUra ? `ウラ全${ALL_MISSIONS.length - CAMPAIGN_MISSIONS.length}面` : `全${CAMPAIGN_MISSIONS.length}面`}</span></footer>
    </div>
  </section>;
}


// 地形の下絵。陸地の外形と、池・川・建物などの飾り（道や面より下に敷く）
function TerrainLayer({ land, features }: { land: Pt[]; features: TerrainFeature[] }) {
  const d = smoothPath(land);
  return <svg className="wall-terrain" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
    <path className="terrain-shadow" d={d} transform="translate(0 2.2)"/>
    <path className="terrain-land" d={d}/>
    {features.map((feature, index) => <TerrainShape key={index} feature={feature}/>)}
  </svg>;
}

function TerrainShape({ feature: f }: { feature: TerrainFeature }) {
  switch (f.kind) {
    case 'pond':
      return <g className="terrain-pond">
        <ellipse cx={f.cx} cy={f.cy + 0.8} rx={f.rx + 1} ry={f.ry + 1} className="rim"/>
        <ellipse cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} className="water"/>
        {f.fountain && <><ellipse cx={f.cx} cy={f.cy} rx={2.6} ry={1.8} className="basin"/><ellipse cx={f.cx} cy={f.cy - 1.4} rx={0.9} ry={2} className="spray"/></>}
      </g>;
    case 'river':
      return <polyline className="terrain-river" points={f.points.map(([x, y]) => `${x},${y}`).join(' ')} strokeWidth={f.width}/>;
    case 'bridge':
      return <rect className="terrain-bridge" x={f.x} y={f.y} width={f.w} height={f.h} rx={1}/>;
    case 'trees':
      return <g className="terrain-trees">{f.items.map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.8}/>)}</g>;
    case 'rocks':
      return <g className="terrain-rocks">{f.items.map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.7}/>)}</g>;
    case 'flowers':
      return <g className="terrain-flowers">{f.items.map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.7}/>)}</g>;
    case 'hill':
      return <ellipse className="terrain-hill" cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry}/>;
    case 'plaza':
      return <ellipse className="terrain-plaza" cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry}/>;
    case 'house':
      return <g className="terrain-house"><rect x={f.x} y={f.y} width={f.w} height={f.h} rx={0.8}/><rect className="roof" x={f.x} y={f.y} width={f.w} height={f.h * 0.4} rx={0.8}/></g>;
    case 'hedge':
      return <rect className="terrain-hedge" x={f.x} y={f.y} width={f.w} height={f.h} rx={1.5}/>;
    case 'court':
      return <rect className="terrain-court" x={f.x} y={f.y} width={f.w} height={f.h} rx={1}/>;
    case 'rampart':
      return <polyline className="terrain-rampart" points={f.points.map(([x, y]) => `${x},${y}`).join(' ')}/>;
    case 'towers':
      return <g className="terrain-towers">{f.items.map(([x, y, r], i) => <rect key={i} x={x - r} y={y - r} width={r * 2} height={r * 2} rx={0.6}/>)}</g>;
    case 'pillars':
      return <g className="terrain-pillars">{f.items.map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.8}/>)}</g>;
  }
}
