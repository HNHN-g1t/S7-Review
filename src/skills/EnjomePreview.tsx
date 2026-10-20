import {useEffect,useState,useId,useRef,type CSSProperties} from 'react';
import {enjoRange,enjoDemoOccupied,enjoSteps,ENJO_LABELS,type EnjoPhase} from './enjomeModel';
import './enjome.css';
import {playEnjoWallBreak,playEnjoImpact} from './enjomeAudio';
// 2026-10-19 Claude：一つ目の炎の幽霊が、上下二段の黒い外壁に閉じ込められている姿に描き直し。
// 炎は縦2セルの輪郭、目と口は揺らぐボディとは別の固定座標で描く。
export function EnjomeBomb({walls=2,rows=2,wallMask,breaking,paused=false}:{wallMask?:boolean[];paused?:boolean;walls?:0|1|2|3;rows?:2|3;breaking?:'top'|'middle'|'bottom'}){const svg=useRef<SVGSVGElement|null>(null);useEffect(()=>{if(paused)svg.current?.pauseAnimations();else svg.current?.unpauseAnimations();},[paused]);const id=useId().replace(/:/g,'');const g=(n:string)=>'url(#'+id+n+')';return <svg ref={svg} className={'enjo-capsule'+(breaking?' enjo-breaking':'')} viewBox={'0 0 100 '+rows*100} role="img" aria-label="縦2セルのエンジョーボム（炎本体2セル）">
 <defs>
  <radialGradient id={id+'heat'}><stop stopColor="#ffda65" stopOpacity=".9"/><stop offset=".42" stopColor="#ffad35" stopOpacity=".6"/><stop offset="1" stopColor="#ff771c" stopOpacity="0"/></radialGradient>
  <clipPath id={id+'flame-clip'}><use href={'#'+id+'flame-shape'}/></clipPath>
  <clipPath id={id+'cage-clip'}><rect x="12" y="10" width="76" height={rows*100-20} rx="28"/></clipPath>
  {Array.from({length:rows},(_,row)=><clipPath key={row} id={id+'cage-row-'+row}><rect x="0" y={row*100} width="100" height="100"/></clipPath>)}
  <linearGradient id={id+'glass'} x1="0" x2="1"><stop stopColor="#d9f6ff" stopOpacity=".34"/><stop offset=".22" stopColor="#bfe9ff" stopOpacity=".08"/><stop offset=".78" stopColor="#bfe9ff" stopOpacity=".06"/><stop offset="1" stopColor="#d9f6ff" stopOpacity=".3"/></linearGradient>
  <radialGradient id={id+'glow'} cx=".5" cy=".62" r=".55"><stop stopColor="#ff9a2e" stopOpacity=".55"/><stop offset="1" stopColor="#ff5a1f" stopOpacity="0"/></radialGradient>
  <radialGradient id={id+'body'} cx=".45" cy=".65" r=".72"><stop stopColor="#ff6516"/><stop offset=".58" stopColor="#ff6518"/><stop offset=".82" stopColor="#ff2507"/><stop offset="1" stopColor="#ff1205"/></radialGradient>
  <radialGradient id={id+'core'} cx=".5" cy=".68" r=".67"><stop stopColor="#ffe77a"/><stop offset=".42" stopColor="#ffc327"/><stop offset=".72" stopColor="#ffbf0e"/><stop offset="1" stopColor="#ff7810"/></radialGradient>
  <linearGradient id={id+'mouth'} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#220407"/><stop offset="1" stopColor="#8f0b16"/></linearGradient>
  <clipPath id={id+'blink'}><rect x="37" y="121" width="26" height="26"><animate attributeName="height" values="26;26;1;26;26;1;26;26" keyTimes="0;.72;.75;.78;.81;.84;.87;1" dur="3.4s" repeatCount="indefinite"/><animate attributeName="y" values="121;121;133.5;121;121;133.5;121;121" keyTimes="0;.72;.75;.78;.81;.84;.87;1" dur="3.4s" repeatCount="indefinite"/></rect></clipPath>
  <clipPath id={id+'inside'}><rect x="17" y="16" width="66" height="168" rx="31"/></clipPath>
 </defs>
 {/* 中の光と幽霊（壁が取れた後も炎の本体として描く） */}
 <g className="enjo-inner" transform={'translate(0 '+(rows===3?50:0)+')'}>
  <rect x="0" y="0" width="100" height="200" fill={g('glow')}/>
  <g className="enjo-ghost">
   <path id={id+'flame-shape'} className="enjo-ghost-body" d="M35 17C29 40 42 47 51 59C62 74 59 94 67 98C75 101 73 80 75 70C83 84 79 105 81 122C85 143 80 167 69 179C59 191 40 190 29 179C18 167 15 145 20 124C24 106 22 91 23 81C31 86 29 106 38 104C49 101 45 83 39 73C29 57 26 35 35 17Z" fill={g('body')}><animate attributeName="d" values="M35 17C29 40 42 47 51 59C62 74 59 94 67 98C75 101 73 80 75 70C83 84 79 105 81 122C85 143 80 167 69 179C59 191 40 190 29 179C18 167 15 145 20 124C24 106 22 91 23 81C31 86 29 106 38 104C49 101 45 83 39 73C29 57 26 35 35 17Z;M46 12C29 40 42 47 56 56C62 74 59 94 67 98C75 101 73 80 69 64C83 84 79 105 81 122C85 143 80 167 69 179C59 191 40 190 29 179C18 167 15 145 20 124C24 106 22 91 28 76C31 86 29 106 38 104C49 101 45 83 39 73C29 57 26 35 46 12Z;M27 23C29 40 42 47 47 63C62 74 59 94 67 98C75 101 73 80 79 77C83 84 79 105 81 122C85 143 80 167 69 179C59 191 40 190 29 179C18 167 15 145 20 124C24 106 22 91 19 85C31 86 29 106 38 104C49 101 45 83 39 73C29 57 26 35 27 23Z;M35 17C29 40 42 47 51 59C62 74 59 94 67 98C75 101 73 80 75 70C83 84 79 105 81 122C85 143 80 167 69 179C59 191 40 190 29 179C18 167 15 145 20 124C24 106 22 91 23 81C31 86 29 106 38 104C49 101 45 83 39 73C29 57 26 35 35 17Z" dur="2.6s" repeatCount="indefinite"/></path>
   <path className="enjo-ghost-core" d="M44 63C56 76 47 93 58 108C66 118 73 132 71 148C70 168 61 177 49 177C34 177 25 165 26 148C27 132 36 121 38 108C40 94 44 85 44 63Z" fill={g('core')}><animate attributeName="d" values="M44 63C56 76 47 93 58 108C66 118 73 132 71 148C70 168 61 177 49 177C34 177 25 165 26 148C27 132 36 121 38 108C40 94 44 85 44 63Z;M51 58C56 76 47 93 61 106C66 118 73 132 71 148C70 168 61 177 49 177C34 177 25 165 26 148C27 132 36 121 38 108C40 94 44 85 51 58Z;M38 69C56 76 47 93 54 111C66 118 73 132 71 148C70 168 61 177 49 177C34 177 25 165 26 148C27 132 36 121 38 108C40 94 44 85 38 69Z;M44 63C56 76 47 93 58 108C66 118 73 132 71 148C70 168 61 177 49 177C34 177 25 165 26 148C27 132 36 121 38 108C40 94 44 85 44 63Z" dur="2.6s" repeatCount="indefinite"/></path>
   <g className="enjo-heat-pockets" clipPath={g('flame-clip')} aria-hidden="true">
    {[0,1].map(i=>{const seed=Array.from(id).reduce((n,c)=>n+c.charCodeAt(0),0)+i*37;const x=38+seed%21,y=68+seed%28;return <ellipse key={i} cx={x} cy={y} rx={12+seed%7} ry={21+seed%10} fill={g('heat')} opacity="0"><animate attributeName="opacity" values="0;.55;.38;0;0" keyTimes="0;.25;.55;.8;1" dur={i?'3.7s':'2.9s'} begin={i?'-1.8s':'-.6s'} repeatCount="indefinite"/><animate attributeName="cx" values={x+';'+(x-6)+';'+(x+4)+';'+x} dur={i?'4.1s':'3.3s'} repeatCount="indefinite"/><animate attributeName="cy" values={(y+12)+';'+(y-10)+';'+(y-18)+';'+(y+12)} dur={i?'3.7s':'2.9s'} repeatCount="indefinite"/></ellipse>;})}
   </g>
  </g>
  <g className="enjo-face" aria-hidden="true">
   <g className="enjo-eye" clipPath={g('blink')}><circle cx="50" cy="134" r="12.5" fill="#050505"/><circle cx="50" cy="134" r="5.7" fill="#fff"/></g>
   <path className="enjo-mouth" d="M42 152C44 150 45 155 50 155C55 155 56 150 58 152C60 155 56 164 50 164C44 164 40 155 42 152Z" fill={g('mouth')}/>
  </g>
  {/* 幽霊からのぼる火の粉 */}
  {Array.from({length:48},(_,i)=><circle key={i} className="enjo-spark" cx={24+i*17%53} cy={96+i*13%25} r={i%9===0?2.2:.6+i%3*.3} fill={i%2?'#ffc74a':'#fff0bd'} style={{animationDelay:-((i*37%48)/48)*(1.8+i%7*.13)+'s','--enjo-spark-duration':(1.8+i%7*.13)+'s','--enjo-drift':(i%2?1:-1)*(5+i%9)+'px'} as CSSProperties}/>)}
 </g>
 <g className="enjo-cage" clipPath={g('cage-clip')} aria-hidden="true">
 {Array.from({length:rows},(_,row)=>{if(wallMask?wallMask[row]:row<rows-walls)return null;return <g key={row} className="enjo-cage-row" clipPath={g('cage-row-'+row)} data-cage-row={row}>
   <rect x="12" y="10" width="76" height={rows*100-20} rx="28" fill="none" stroke="#05070c" strokeWidth="9"/>
   {Array.from({length:19},(_,i)=>{const x=-300+i*24;return <g key={i}><path d={'M'+x+' 0l'+rows*100+' '+rows*100} fill="none" stroke="#05070c" strokeWidth="4"/><path d={'M'+(100-x)+' 0l-'+rows*100+' '+rows*100} fill="none" stroke="#05070c" strokeWidth="4"/></g>;})}
 </g>;})}
 </g>
 {breaking&&<g key={breaking}>{Array.from({length:10},(_,i)=>{const row=breaking==='top'?0:breaking==='middle'?1:rows-1;const x=23+i*19%55,y=row*100+12+Math.floor(i/2)*17;return <path key={i} className="enjo-shell-fragment" d={'M'+(x-6)+' '+y+'l12 14m-12 0 12 -14'} fill="none" stroke="#07090e" strokeWidth="4" strokeLinecap="round" style={{'--enjo-shard-x':(i%2?1:-1)*(35+i*4)+'px','--enjo-shard-y':(-20-i*3)+'px','--enjo-shard-spin':(i%2?1:-1)*70+'deg'} as CSSProperties}/>;})}</g>}
 </svg>;}
// 着弾後：落ちた地面の列から、範囲の高さぶんだけ炎の柱が下から吹き上がる（中央から外へ少しずつ遅れて）
export function EnjoBlast({range,paused=false}:{range:{x:number;y:number}[];paused?:boolean}){
 const svg=useRef<SVGSVGElement|null>(null);useEffect(()=>{if(paused)svg.current?.pauseAnimations();else svg.current?.unpauseAnimations();},[paused]);
 const id=useId().replace(/:/g,'');const columns=new Map<number,number>();range.forEach(p=>columns.set(p.x,(columns.get(p.x)??0)+1));const xs=[...columns.keys()].sort((a,b)=>a-b),left=xs[0];
 const contour=(wave:number)=>{let d='M'+left+' 9V8.7';for(const x of xs){const y=9-columns.get(x)!;d+=' Q'+(x+.08)+' '+(y+.6)+' '+(x+.3)+' '+(y+.9)+' C'+(x+.65+wave)+' '+(y+1.2)+' '+(x+.55-wave)+' '+(y+.4)+' '+(x+.6)+' '+y+' Q'+(x+.86)+' '+(y+.2)+' '+(x+1)+' '+(y+.8);}return d+'V9Z';};
 const d=contour(0);
 return <div className="enjo-blast" data-enjo-paused={paused} aria-hidden="true"><svg ref={svg} className="enjo-connected-fire" viewBox="0 0 9 9"><defs><linearGradient id={id+'fire'} x1="0" y1="1" x2="0" y2="0"><stop stopColor="#ff1305"/><stop offset=".48" stopColor="#ff4b0d"/><stop offset="1" stopColor="#ffaf35"/></linearGradient><linearGradient id={id+'heart'} x1="0" y1="1" x2="0" y2="0"><stop stopColor="#ff4d0e"/><stop offset=".5" stopColor="#ffb323"/><stop offset="1" stopColor="#fff0ac"/></linearGradient></defs>
 <g className="enjo-fire-sheet"><path d={d} fill={'url(#'+id+'fire)'}><animate attributeName="d" values={d+';'+contour(.15)+';'+contour(-.12)+';'+d} dur=".85s" repeatCount="indefinite"/></path><g transform="translate(4.5 9) scale(.88 .8) translate(-4.5 -9)"><path d={d} fill={'url(#'+id+'heart)'}/></g></g>
 </svg>{xs.flatMap(x=>[0,1,2,3].map(k=><b key={x+'-'+k} className="enjo-ember enjo-free-ember" style={{left:(x+.2+k*.17)/9*100+'%',bottom:'8%','--enjo-lag':Math.abs(x-4)*.05+'s','--enjo-ember':k,'--enjo-drift':((k%2?1:-1)*(15+k*12))+'px'} as CSSProperties}/>))}</div>;
}

export function EnjomePreview({paused=false}:{paused?:boolean}){
 const [phase,setPhase]=useState<EnjoPhase>('wall'),[fever,setFever]=useState(false),[auto,setAuto]=useState(false);
 const [rows,setRows]=useState<2|3>(2);const steps=enjoSteps(rows);
 const [sound,setSound]=useState(false);const audio=useRef<AudioContext|null>(null);
 useEffect(()=>()=>{void audio.current?.close();},[]);
 useEffect(()=>{if(!audio.current)return;if(paused||!sound)void audio.current.suspend();else void audio.current.resume();},[paused,sound]);
 useEffect(()=>{const ctx=audio.current;if(!ctx||!sound)return;const bus=ctx.createGain();bus.gain.value=.65;bus.connect(ctx.destination);if(phase==='breakUpper'||phase==='breakMiddle'||phase==='breakLower')playEnjoWallBreak(ctx,bus);if(phase==='blast')playEnjoImpact(ctx,bus);return()=>bus.disconnect();},[phase,sound]);
 const range=enjoRange(fever),keys=new Set(range.map(p=>p.x+','+p.y));
 useEffect(()=>{if(paused)return;if(!auto&&phase!=='breakUpper'&&phase!=='breakMiddle'&&phase!=='breakLower'&&phase!=='drop'&&phase!=='blast')return;const times={wall:1000,breakUpper:660,middle:1000,breakMiddle:660,lower:1000,breakLower:660,ready:900,hover:1100,drop:450,blast:1700,done:0};if(phase==='done'){setAuto(false);return;}const timer=setTimeout(()=>setPhase(steps[steps.indexOf(phase)+1]),times[phase]);return()=>clearTimeout(timer);},[phase,auto,paused,rows]);
 // 2026-10-19：盤面のクラスは enjo-phase-○○。以前の「enjo-wall」は壁の飾りと同じ名前で、最初の段階だけ盤面が浮いて表示されていた
 return <section className="enjo-preview" data-paused={paused}><div className="enjo-tools"><button onClick={()=>{setAuto(true);setPhase('wall');}}>▶ 一連のデモを再生</button><button aria-pressed={fever} onClick={()=>{setFever(v=>!v);setAuto(false);setPhase('wall');}}>{fever?'FEVER：9・7・5・3・1':'通常：7・5・3・1'}</button><button onClick={()=>{setAuto(false);setPhase('wall');}}>リセット</button><button onClick={()=>{setRows(v=>v===2?3:2);setAuto(false);setPhase('wall');}}>壁：{rows}セル（全段解除）</button><label><input type="checkbox" checked={sound} onChange={e=>{if(e.target.checked){audio.current??=new AudioContext();void audio.current.resume();}setSound(e.target.checked);}}/> SEを鳴らす（初期OFF）</label></div>
 <p className="enjo-status" aria-live="polite">{ENJO_LABELS[phase]}</p><div className={'enjo-board enjo-phase-'+phase}>
 {Array.from({length:81},(_,i)=>{const x=i%9,y=Math.floor(i/9),hit=keys.has(x+','+y),occupied=enjoDemoOccupied(x,y,phase,rows);return <span key={i} className={'enjo-cell '+(hit?'enjo-target ':'')+(phase==='blast'&&hit?'enjo-hit ':'')+(phase==='done'&&hit?'enjo-cleared':'')} style={{'--enjo-delay':Math.abs(x-4)*.07+(8-y)*.09+'s'} as CSSProperties}>{occupied&&!(phase==='done'&&hit)&&(i%11===0?<span className="enjo-obstacle">💣</span>:i%5===0?<span className="enjo-obstacle enjo-enemy">× ×</span>:<span className={'enjo-die enjo-die-'+i%3}><i/><i/><i/></span>)}</span>;})}
 {phase==='blast'&&<EnjoBlast range={range} paused={paused}/>}
 {phase!=='blast'&&phase!=='done'&&<button className={'enjo-bomb'+(rows===3?' enjo-tall-capsule':'')} disabled={phase!=='ready'||auto} onClick={()=>setPhase('hover')} aria-label="エンジョーボムをタップして上空待機"><EnjomeBomb paused={paused} rows={rows} walls={phase==='wall'?rows:phase==='middle'||phase==='breakUpper'?rows-1 as 1|2:phase==='lower'||phase==='breakMiddle'?1:0} breaking={phase==='breakUpper'?'top':phase==='breakMiddle'?'middle':phase==='breakLower'?'bottom':undefined}/></button>}
 {phase==='hover'&&<span className="enjo-wait">上空待機</span>}
 </div><div className="enjo-tools">{(phase==='wall'||phase==='middle'||phase==='lower')&&<button disabled={auto} onClick={()=>setPhase(phase==='wall'?'breakUpper':phase==='middle'?'breakMiddle':'breakLower')}>{phase==='wall'?'隣接セヴン目 → 上部の壁を除去':phase==='middle'?'隣接セヴン目 → 中部の壁を除去':'隣接セヴン目 → 下部の壁を除去'}</button>}{phase==='hover'&&<button disabled={auto} onClick={()=>setPhase('drop')}>次のサイを落とす → 発動</button>}</div><small>デザイン・挙動の確認用デモ。範囲内の敵・ボムをすべて破壊する想定。9列の模式盤で通常16セル／FEVER25セルを表示しています。実ゲームへの配置・盤端での扱いは未実装です。</small></section>;
}
