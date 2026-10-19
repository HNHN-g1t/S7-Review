import {useEffect,useState,useId,type CSSProperties} from 'react';
import {enjoRange,ENJO_STEPS,ENJO_LABELS,type EnjoPhase} from './enjomeModel';
import './enjome.css';
// 2026-10-19 Claude：一つ目の炎の幽霊が、上下二段の透明なカプセルに閉じ込められている姿に描き直し。
// 幽霊は下の段に目、炎の先は中央の留め具を越えて上の段まで伸びる（出たがっている）。
export function EnjomeBomb(){const id=useId().replace(/:/g,'');const g=(n:string)=>'url(#'+id+n+')';return <svg className="enjo-capsule" viewBox="0 0 100 200" role="img" aria-label="縦2セルの炎の投下ボム・エンジョーメ">
 <defs>
  <linearGradient id={id+'glass'} x1="0" x2="1"><stop stopColor="#d9f6ff" stopOpacity=".34"/><stop offset=".22" stopColor="#bfe9ff" stopOpacity=".08"/><stop offset=".78" stopColor="#bfe9ff" stopOpacity=".06"/><stop offset="1" stopColor="#d9f6ff" stopOpacity=".3"/></linearGradient>
  <radialGradient id={id+'glow'} cx=".5" cy=".62" r=".55"><stop stopColor="#ff9a2e" stopOpacity=".55"/><stop offset="1" stopColor="#ff5a1f" stopOpacity="0"/></radialGradient>
  <linearGradient id={id+'body'} x1="0" y1="1" x2="0" y2="0"><stop stopColor="#e2301c"/><stop offset=".45" stopColor="#ff7a26"/><stop offset=".8" stopColor="#ffc247"/><stop offset="1" stopColor="#fff1a0"/></linearGradient>
  <linearGradient id={id+'core'} x1="0" y1="1" x2="0" y2="0"><stop stopColor="#ffb13a"/><stop offset="1" stopColor="#fff8d6"/></linearGradient>
  <linearGradient id={id+'metal'} x1="0" x2="0" y2="1"><stop stopColor="#5d6372"/><stop offset=".5" stopColor="#2b2f3a"/><stop offset="1" stopColor="#1b1e26"/></linearGradient>
  <clipPath id={id+'inside'}><rect x="17" y="16" width="66" height="168" rx="31"/></clipPath>
 </defs>
 {/* 中の光と幽霊（ガラスの内側だけに描く） */}
 <g clipPath={g('inside')}>
  <rect x="0" y="0" width="100" height="200" fill={g('glow')}/>
  <g className="enjo-ghost">
   <path className="enjo-ghost-body" d="M50 30C53 44 63 46 61 60C66 52 70 47 69 38C78 52 79 68 77 82C79 100 78 122 76 142C75 156 74 166 71 172L64 165L57 173L50 165L43 173L36 165L29 172C26 166 25 156 24 142C22 122 21 100 23 82C21 68 23 55 31 44C31 52 34 57 39 61C37 50 45 42 50 30Z" fill={g('body')}/>
   <path className="enjo-ghost-core" d="M50 70C54 80 62 86 61 100C64 118 63 140 58 152L50 146L42 152C37 140 36 118 39 100C38 88 46 82 50 70Z" fill={g('core')} opacity=".85"/>
   <g className="enjo-eye">
    <ellipse cx="50" cy="122" rx="15" ry="17" fill="#fffaf0"/>
    <ellipse cx="51" cy="125" rx="8.5" ry="10" fill="#2a0d18"/>
    <circle cx="54" cy="120" r="3" fill="#fff"/>
   </g>
  </g>
  {/* 幽霊からのぼる火の粉 */}
  {[[34,150,'0s'],[62,140,'.5s'],[46,160,'1s']].map(([x,y,d])=><circle key={String(d)} className="enjo-spark" cx={x} cy={y} r="2" fill="#ffe08a" style={{animationDelay:String(d)}}/>)}
 </g>
 {/* ガラス */}
 <rect x="17" y="16" width="66" height="168" rx="31" fill={g('glass')} stroke="#dff6ff" strokeOpacity=".75" strokeWidth="2.5"/>
 <path d="M26 44V156" stroke="#fff" strokeOpacity=".55" strokeWidth="4" strokeLinecap="round"/>
 <path d="M32 36V58" stroke="#fff" strokeOpacity=".35" strokeWidth="2.5" strokeLinecap="round"/>
 {/* 上下のふたと、二段を分ける中央の留め具 */}
 <rect x="24" y="4" width="52" height="16" rx="5" fill={g('metal')} stroke="#ff8a3d" strokeWidth="1.5"/>
 <rect x="40" y="0" width="20" height="6" rx="2" fill="#ff8a3d"/>
 <rect x="24" y="180" width="52" height="16" rx="5" fill={g('metal')} stroke="#ff8a3d" strokeWidth="1.5"/>
 <path d="M18 100H82" stroke="#dff6ff" strokeOpacity=".5" strokeWidth="1.5" strokeDasharray="3 3"/>
 <rect x="9" y="93" width="14" height="14" rx="3" fill={g('metal')} stroke="#ff8a3d" strokeWidth="1.5"/>
 <rect x="77" y="93" width="14" height="14" rx="3" fill={g('metal')} stroke="#ff8a3d" strokeWidth="1.5"/>
 </svg>;}
// 着弾後：落ちた地面の列から、範囲の高さぶんだけ炎の柱が下から吹き上がる（中央から外へ少しずつ遅れて）
function EnjoBlast({range}:{range:{x:number;y:number}[]}){
 const columns=new Map<number,number>();range.forEach(p=>columns.set(p.x,(columns.get(p.x)??0)+1));
 const half=Math.max(...[...columns.keys()].map(x=>Math.abs(x-4)));
 return <div className="enjo-blast" aria-hidden="true">
  <span className="enjo-ground" style={{'--enjo-span':(half*2+1)/9} as CSSProperties}/>
  {[...columns].map(([x,h])=><span key={x} className="enjo-pillar" style={{left:x/9*100+'%',height:h/9*100+'%','--enjo-lag':Math.abs(x-4)*.07+'s'} as CSSProperties}>
   <i className="enjo-pillar-outer"/><i className="enjo-pillar-inner"/>
   {[0,1,2].map(k=><b key={k} className="enjo-ember" style={{'--enjo-ember':k} as CSSProperties}/>)}
  </span>)}
 </div>;
}
export function EnjomePreview({paused=false}:{paused?:boolean}){
 const [phase,setPhase]=useState<EnjoPhase>('wall'),[fever,setFever]=useState(false),[auto,setAuto]=useState(false);
 const range=enjoRange(fever),keys=new Set(range.map(p=>p.x+','+p.y));
 useEffect(()=>{if(paused)return;if(!auto&&phase!=='drop'&&phase!=='blast')return;const times={wall:1100,ready:900,hover:1100,drop:450,blast:1700,done:0};if(phase==='done'){setAuto(false);return;}const timer=setTimeout(()=>setPhase(ENJO_STEPS[ENJO_STEPS.indexOf(phase)+1]),times[phase]);return()=>clearTimeout(timer);},[phase,auto,paused]);
 // 2026-10-19：盤面のクラスは enjo-phase-○○。以前の「enjo-wall」は壁の飾りと同じ名前で、最初の段階だけ盤面が浮いて表示されていた
 return <section className="enjo-preview" data-paused={paused}><div className="enjo-tools"><button onClick={()=>{setAuto(true);setPhase('wall');}}>▶ 一連のデモを再生</button><button aria-pressed={fever} onClick={()=>{setFever(v=>!v);setAuto(false);setPhase('wall');}}>{fever?'FEVER：9・7・5・3・1':'通常：7・5・3・1'}</button><button onClick={()=>{setAuto(false);setPhase('wall');}}>リセット</button></div>
 <p className="enjo-status" aria-live="polite">{ENJO_LABELS[phase]}</p><div className={'enjo-board enjo-phase-'+phase}>
 {Array.from({length:81},(_,i)=>{const x=i%9,y=Math.floor(i/9),hit=keys.has(x+','+y),occupied=y>=4;return <span key={i} className={'enjo-cell '+(hit?'enjo-target ':'')+(phase==='blast'&&hit?'enjo-hit ':'')+(phase==='done'&&hit?'enjo-cleared':'')} style={{'--enjo-delay':Math.abs(x-4)*.07+(8-y)*.09+'s'} as CSSProperties}>{occupied&&!(phase==='done'&&hit)&&(i%11===0?<span className="enjo-obstacle">💣</span>:i%5===0?<span className="enjo-obstacle enjo-enemy">× ×</span>:<span className={'enjo-die enjo-die-'+i%3}><i/><i/><i/></span>)}</span>;})}
 {phase==='blast'&&<EnjoBlast range={range}/>}
 {phase!=='blast'&&phase!=='done'&&<button className="enjo-bomb" disabled={phase!=='ready'||auto} onClick={()=>setPhase('hover')} aria-label="エンジョーメをタップして上空待機"><EnjomeBomb/>{phase==='wall'&&<span className="enjo-wall"/>}</button>}
 {phase==='hover'&&<span className="enjo-wait">上空待機</span>}
 </div><div className="enjo-tools">{phase==='wall'&&<button disabled={auto} onClick={()=>setPhase('ready')}>隣接セヴン目を消す（壁解除）</button>}{phase==='hover'&&<button disabled={auto} onClick={()=>setPhase('drop')}>次のサイを落とす → 発動</button>}</div><small>デザイン・挙動の確認用デモ。範囲内の敵・ボムをすべて破壊する想定。9列の模式盤で通常16セル／FEVER25セルを表示しています。実ゲームへの配置・盤端での扱いは未実装です。</small></section>;
}
