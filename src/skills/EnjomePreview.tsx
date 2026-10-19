import {useEffect,useState,useId,type CSSProperties} from 'react';
import {enjoRange,ENJO_STEPS,ENJO_LABELS,type EnjoPhase} from './enjomeModel';
import './enjome.css';
export function EnjomeBomb(){const id=useId();return <svg viewBox="0 0 100 200" role="img" aria-label="縦2セルの炎の投下ボム・エンジョーメ">
 <defs><linearGradient id={id} x2="1" y2=".6"><stop stopColor="#ffb535"/><stop offset=".22" stopColor="#ff6029"/><stop offset=".65" stopColor="#a61e20"/><stop offset="1" stopColor="#ff8432"/></linearGradient></defs>
 <path d="M35 35L22 7L42 19L50 0L58 19L78 7L65 35" fill="#ffc34b"/><path d="M29 40L10 52L7 92L24 83M71 40L90 52L93 92L76 83" fill="#ea4b28"/>
 <path d="M28 35L38 28H62L72 35L80 116Q81 154 50 188Q19 154 20 116Z" fill={'url(#'+id+')'}/>
 <path d="M29 40L38 33H62L70 40M27 48L24 117Q25 146 41 165" fill="none" stroke="#ffe496" strokeWidth="4"/>
 <path d="M20 111H80L78 130H22Z" fill="#50232a"/><path d="M24 115H76" stroke="#ffbd60" strokeWidth="3"/>
 {[36,64].map(x=><g key={x}><path d={'M'+(x-10)+' 65L'+(x+10)+' 70L'+(x+7)+' 82H'+(x-7)+'Z'} fill="#301b27"/><path d={'M'+(x-6)+' 72H'+(x+5)} stroke="#ffea9c" strokeWidth="3"/></g>)}
 <path d="M39 95L45 91L50 96L55 91L61 95" fill="none" stroke="#ffdf8b" strokeWidth="3"/><path d="M31 143L18 177L36 166L50 194L64 166L82 177L69 143" fill="#ff7324"/><path d="M38 151L32 174L50 185L68 174L62 151" fill="#ffd36b"/>
 </svg>;}
export function EnjomePreview({paused=false}:{paused?:boolean}){
 const [phase,setPhase]=useState<EnjoPhase>('wall'),[fever,setFever]=useState(false),[auto,setAuto]=useState(false);
 const range=enjoRange(fever),keys=new Set(range.map(p=>p.x+','+p.y));
 useEffect(()=>{if(paused)return;if(!auto&&phase!=='drop'&&phase!=='blast')return;const times={wall:1100,ready:900,hover:1100,drop:450,blast:1600,done:0};if(phase==='done'){setAuto(false);return;}const timer=setTimeout(()=>setPhase(ENJO_STEPS[ENJO_STEPS.indexOf(phase)+1]),times[phase]);return()=>clearTimeout(timer);},[phase,auto,paused]);
 return <section className="enjo-preview" data-paused={paused}><div className="enjo-tools"><button onClick={()=>{setAuto(true);setPhase('wall');}}>▶ 一連のデモを再生</button><button aria-pressed={fever} onClick={()=>{setFever(v=>!v);setAuto(false);setPhase('wall');}}>{fever?'FEVER：9・7・5・3・1':'通常：7・5・3・1'}</button><button onClick={()=>{setAuto(false);setPhase('wall');}}>リセット</button></div>
 <p className="enjo-status" aria-live="polite">{ENJO_LABELS[phase]}</p><div className={'enjo-board enjo-'+phase}>
 {Array.from({length:81},(_,i)=>{const x=i%9,y=Math.floor(i/9),hit=keys.has(x+','+y),occupied=y>=4;return <span key={i} className={'enjo-cell '+(hit?'enjo-target ':'')+(phase==='blast'&&hit?'enjo-hit ':'')+(phase==='done'&&hit?'enjo-cleared':'')} style={{'--enjo-delay':(8-y)*.065+'s'} as CSSProperties}>{occupied&&!(phase==='done'&&hit)&&(i%11===0?<span className="enjo-obstacle">💣</span>:i%5===0?<span className="enjo-obstacle enjo-enemy">× ×</span>:<span className={'enjo-die enjo-die-'+i%3}><i/><i/><i/></span>)}{phase==='blast'&&hit&&<span className="enjo-flame">♨</span>}</span>;})}
 {phase!=='blast'&&phase!=='done'&&<button className="enjo-bomb" disabled={phase!=='ready'||auto} onClick={()=>setPhase('hover')} aria-label="エンジョーメをタップして上空待機"><EnjomeBomb/>{phase==='wall'&&<span className="enjo-wall"/>}</button>}
 {phase==='hover'&&<span className="enjo-wait">上空待機</span>}
 </div><div className="enjo-tools">{phase==='wall'&&<button disabled={auto} onClick={()=>setPhase('ready')}>隣接セヴン目を消す（壁解除）</button>}{phase==='hover'&&<button disabled={auto} onClick={()=>setPhase('drop')}>次のサイを落とす → 発動</button>}</div><small>デザイン・挙動の確認用デモ。範囲内の敵・ボムをすべて破壊する想定。9列の模式盤で通常16セル／FEVER25セルを表示しています。実ゲームへの配置・盤端での扱いは未実装です。</small></section>;
}
