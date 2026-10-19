import {useEffect,useState,useId,useRef,type CSSProperties} from 'react';
import {enjoRange,ENJO_STEPS,ENJO_LABELS,type EnjoPhase} from './enjomeModel';
import './enjome.css';
import {playEnjoWallBreak,playEnjoImpact} from './enjomeAudio';
// 2026-10-19 Claude：一つ目の炎の幽霊が、上下二段の黒い外壁に閉じ込められている姿に描き直し。
// 炎は縦2セルの輪郭、目と口は揺らぐボディとは別の固定座標で描く。
export function EnjomeBomb({walls=2,breaking}:{walls?:0|1|2;breaking?:'top'|'bottom'}){const id=useId().replace(/:/g,'');const g=(n:string)=>'url(#'+id+n+')';return <svg className={'enjo-capsule'+(breaking?' enjo-breaking':'')} viewBox="0 0 100 200" role="img" aria-label="縦2セルの炎の投下ボム・エンジョーメ">
 <defs>
  <linearGradient id={id+'glass'} x1="0" x2="1"><stop stopColor="#d9f6ff" stopOpacity=".34"/><stop offset=".22" stopColor="#bfe9ff" stopOpacity=".08"/><stop offset=".78" stopColor="#bfe9ff" stopOpacity=".06"/><stop offset="1" stopColor="#d9f6ff" stopOpacity=".3"/></linearGradient>
  <radialGradient id={id+'glow'} cx=".5" cy=".62" r=".55"><stop stopColor="#ff9a2e" stopOpacity=".55"/><stop offset="1" stopColor="#ff5a1f" stopOpacity="0"/></radialGradient>
  <radialGradient id={id+'body'} cx=".45" cy=".65" r=".72"><stop stopColor="#ffac1d"/><stop offset=".58" stopColor="#ff6518"/><stop offset=".82" stopColor="#fa360b"/><stop offset="1" stopColor="#ba1709"/></radialGradient>
  <radialGradient id={id+'core'} cx=".5" cy=".68" r=".67"><stop stopColor="#fff56a"/><stop offset=".42" stopColor="#ffe82b"/><stop offset=".72" stopColor="#ffbf0e"/><stop offset="1" stopColor="#ff7810"/></radialGradient>
  <linearGradient id={id+'mouth'} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#220407"/><stop offset="1" stopColor="#8f0b16"/></linearGradient>
  <clipPath id={id+'inside'}><rect x="17" y="16" width="66" height="168" rx="31"/></clipPath>
 </defs>
 {/* 中の光と幽霊（壁が取れた後も炎の本体として描く） */}
 <g clipPath={g('inside')}>
  <rect x="0" y="0" width="100" height="200" fill={g('glow')}/>
  <g className="enjo-ghost">
   <path className="enjo-ghost-body" d="M35 17C29 40 42 47 51 59C62 74 59 94 67 98C75 101 73 80 75 70C83 84 79 105 81 122C84 140 83 159 74 172C65 185 36 188 25 173C16 161 16 144 20 124C24 106 22 91 23 81C31 86 29 106 38 104C49 101 45 83 39 73C29 57 26 35 35 17Z" fill={g('body')}/>
   <path className="enjo-ghost-core" d="M44 63C56 76 47 93 58 108C66 118 73 132 71 148C70 168 61 177 49 177C34 177 25 165 26 148C27 132 36 121 38 108C40 94 44 85 44 63Z" fill={g('core')}/>
   <path d="M33 30C30 53 45 62 49 76" fill="none" stroke="#ff9a38" strokeWidth="2" strokeLinecap="round" opacity=".65"/>
  </g>
  <g className="enjo-face" aria-hidden="true">
   <g className="enjo-eye"><circle cx="50" cy="134" r="11" fill="#080707"/><circle cx="50" cy="134" r="5.4" fill="#fff"/><circle cx="50" cy="134" r="4" fill="#090909"/><circle cx="50" cy="134" r="2.2" fill="#fff"/></g>
   <path className="enjo-mouth" d="M42 152C44 150 45 155 50 155C55 155 56 150 58 152C60 155 56 164 50 164C44 164 40 155 42 152Z" fill={g('mouth')}/>
  </g>
  {/* 幽霊からのぼる火の粉 */}
  {Array.from({length:8},(_,i)=><circle key={i} className="enjo-spark" cx={30+i*17%43} cy={148+i*13%20} r={i%3===0?2.4:1.3} fill={i%2?'#ffc74a':'#fff0bd'} style={{animationDelay:-i*.19+'s','--enjo-drift':(i%2?1:-1)*(5+i*2)+'px'} as CSSProperties}/>)}
 </g>
 {/* Black capsule walls are removed independently, top first. */}
 {walls===2&&<g className="enjo-shell enjo-shell-top"><path d="M17 90V49Q17 16 50 16Q83 16 83 49V90" fill="none" stroke="#03050a" strokeWidth="12" strokeLinecap="round"/><path d="M24 27Q50 9 76 27" fill="none" stroke="#181c25" strokeWidth="2"/></g>}
 {walls>=1&&<g className="enjo-shell enjo-shell-bottom"><path d="M17 110V151Q17 184 50 184Q83 184 83 151V110" fill="none" stroke="#03050a" strokeWidth="12" strokeLinecap="round"/><path d="M24 174Q50 191 76 174" fill="none" stroke="#181c25" strokeWidth="2"/></g>}
 {breaking&&<g className="enjo-shell-fragments" key={breaking} aria-hidden="true">{[[17,90],[17,70],[17,49],[20,30],[32,19],[50,16],[68,19],[80,30],[83,49],[83,70],[83,90]].slice(0,-1).map((p,i)=>{
 const line=[[17,90],[17,70],[17,49],[20,30],[32,19],[50,16],[68,19],[80,30],[83,49],[83,70],[83,90]];
 const q=line[i+1],flip=(y:number)=>breaking==='bottom'?200-y:y;
 const dx=q[0]-p[0],dy=flip(q[1])-flip(p[1]),len=Math.hypot(dx,dy),nx=-dy/len*6,ny=dx/len*6;
 const cx=(p[0]+q[0])/2,cy=(flip(p[1])+flip(q[1]))/2;
 return <polygon key={i} className="enjo-shell-fragment" points={[[p[0]+nx,flip(p[1])+ny],[q[0]+nx,flip(q[1])+ny],[q[0]-nx,flip(q[1])-ny],[p[0]-nx,flip(p[1])-ny]].map(v=>v.join(',')).join(' ')} fill={i%3?'#03050a':'#171c27'} stroke="#252b38" strokeWidth=".8" style={{'--enjo-shard-x':(cx-50)*1.8+'px','--enjo-shard-y':(cy-(breaking==='top'?70:130))*.7-22+'px','--enjo-shard-spin':(i%2?1:-1)*(35+i*11)+'deg',animationDelay:i%3*.015+'s'} as CSSProperties}/>;
 })}</g>}
 </svg>;}
// 着弾後：落ちた地面の列から、範囲の高さぶんだけ炎の柱が下から吹き上がる（中央から外へ少しずつ遅れて）
function EnjoBlast({range}:{range:{x:number;y:number}[]}){
 const columns=new Map<number,number>();range.forEach(p=>columns.set(p.x,(columns.get(p.x)??0)+1));
 const half=Math.max(...[...columns.keys()].map(x=>Math.abs(x-4)));
 return <div className="enjo-blast" aria-hidden="true">
  <span className="enjo-ground" style={{'--enjo-span':(half*2+1)/9} as CSSProperties}/>
  {[...columns].map(([x,h])=><span key={x} className="enjo-pillar" style={{left:x/9*100+'%',height:h/9*100+'%','--enjo-lag':Math.abs(x-4)*.07+'s'} as CSSProperties}>
   <i className="enjo-pillar-outer"/><i className="enjo-pillar-mid"/><i className="enjo-pillar-inner"/>
   {[0,1,2,3].map(k=><b key={k} className="enjo-ember" style={{'--enjo-ember':k,'--enjo-drift':((k%2?1:-1)*(14+k*11))+'px'} as CSSProperties}/>)}
  </span>)}
 </div>;
}
export function EnjomePreview({paused=false}:{paused?:boolean}){
 const [phase,setPhase]=useState<EnjoPhase>('wall'),[fever,setFever]=useState(false),[auto,setAuto]=useState(false);
 const [sound,setSound]=useState(false);const audio=useRef<AudioContext|null>(null);
 useEffect(()=>()=>{void audio.current?.close();},[]);
 useEffect(()=>{if(!audio.current)return;if(paused||!sound)void audio.current.suspend();else void audio.current.resume();},[paused,sound]);
 useEffect(()=>{const ctx=audio.current;if(!ctx||!sound)return;const bus=ctx.createGain();bus.gain.value=.65;bus.connect(ctx.destination);if(phase==='breakUpper'||phase==='breakLower')playEnjoWallBreak(ctx,bus);if(phase==='blast')playEnjoImpact(ctx,bus);return()=>bus.disconnect();},[phase,sound]);
 const range=enjoRange(fever),keys=new Set(range.map(p=>p.x+','+p.y));
 useEffect(()=>{if(paused)return;if(!auto&&phase!=='breakUpper'&&phase!=='breakLower'&&phase!=='drop'&&phase!=='blast')return;const times={wall:1000,breakUpper:660,lower:1000,breakLower:660,ready:900,hover:1100,drop:450,blast:1700,done:0};if(phase==='done'){setAuto(false);return;}const timer=setTimeout(()=>setPhase(ENJO_STEPS[ENJO_STEPS.indexOf(phase)+1]),times[phase]);return()=>clearTimeout(timer);},[phase,auto,paused]);
 // 2026-10-19：盤面のクラスは enjo-phase-○○。以前の「enjo-wall」は壁の飾りと同じ名前で、最初の段階だけ盤面が浮いて表示されていた
 return <section className="enjo-preview" data-paused={paused}><div className="enjo-tools"><button onClick={()=>{setAuto(true);setPhase('wall');}}>▶ 一連のデモを再生</button><button aria-pressed={fever} onClick={()=>{setFever(v=>!v);setAuto(false);setPhase('wall');}}>{fever?'FEVER：9・7・5・3・1':'通常：7・5・3・1'}</button><button onClick={()=>{setAuto(false);setPhase('wall');}}>リセット</button><label><input type="checkbox" checked={sound} onChange={e=>{if(e.target.checked){audio.current??=new AudioContext();void audio.current.resume();}setSound(e.target.checked);}}/> SEを鳴らす（初期OFF）</label></div>
 <p className="enjo-status" aria-live="polite">{ENJO_LABELS[phase]}</p><div className={'enjo-board enjo-phase-'+phase}>
 {Array.from({length:81},(_,i)=>{const x=i%9,y=Math.floor(i/9),hit=keys.has(x+','+y),occupied=y>=4;return <span key={i} className={'enjo-cell '+(hit?'enjo-target ':'')+(phase==='blast'&&hit?'enjo-hit ':'')+(phase==='done'&&hit?'enjo-cleared':'')} style={{'--enjo-delay':Math.abs(x-4)*.07+(8-y)*.09+'s'} as CSSProperties}>{occupied&&!(phase==='done'&&hit)&&(i%11===0?<span className="enjo-obstacle">💣</span>:i%5===0?<span className="enjo-obstacle enjo-enemy">× ×</span>:<span className={'enjo-die enjo-die-'+i%3}><i/><i/><i/></span>)}</span>;})}
 {phase==='blast'&&<EnjoBlast range={range}/>}
 {phase!=='blast'&&phase!=='done'&&<button className="enjo-bomb" disabled={phase!=='ready'||auto} onClick={()=>setPhase('hover')} aria-label="エンジョーメをタップして上空待機"><EnjomeBomb walls={phase==='wall'?2:phase==='lower'||phase==='breakUpper'?1:0} breaking={phase==='breakUpper'?'top':phase==='breakLower'?'bottom':undefined}/></button>}
 {phase==='hover'&&<span className="enjo-wait">上空待機</span>}
 </div><div className="enjo-tools">{(phase==='wall'||phase==='lower')&&<button disabled={auto} onClick={()=>setPhase(phase==='wall'?'breakUpper':'breakLower')}>{phase==='wall'?'隣接セヴン目 → 上部の壁を除去':'隣接セヴン目 → 下部の壁を除去'}</button>}{phase==='hover'&&<button disabled={auto} onClick={()=>setPhase('drop')}>次のサイを落とす → 発動</button>}</div><small>デザイン・挙動の確認用デモ。範囲内の敵・ボムをすべて破壊する想定。9列の模式盤で通常16セル／FEVER25セルを表示しています。実ゲームへの配置・盤端での扱いは未実装です。</small></section>;
}
