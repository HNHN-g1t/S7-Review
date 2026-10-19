import { useId, type CSSProperties } from 'react';
import './gimmickDice.css';
import { ICE_CRACKS, iceCrackPair } from './iceCracks';
type Cell = {value:number;kind?:'ice'|'bomb';fuse?:number};
const colors=['#fc6dac','#8b46d2','#43ae39','#43ae39','#8b46d2','#fc6dac'];
const pips=[[4],[0,8],[0,4,8],[0,2,6,8],[0,2,4,6,8],[0,2,3,5,6,8]];

const segments: Record<number,string>={1:'bc',2:'abdeg',3:'abcdg',4:'bcfg',5:'acdfg',6:'acdefg'};
function SevenSegment({value}:{value:number|null}) {
 const paths={a:'M42 54H58L56 57H44Z',b:'M58 55V65L55 63V58Z',c:'M58 67V77L55 75V69Z',d:'M42 79H58L56 76H44Z',e:'M40 67V77L43 75V69Z',f:'M40 55V65L43 63V58Z',g:'M43 65H55L57 67L55 69H43L41 67Z'};
 return <g fill="#9eeaff">{Object.entries(paths).map(([key,d])=><path key={key} d={d} opacity={value===null?key==='g'?.4:.08:segments[value]?.includes(key)?1:.08}/>)}</g>;
}
export function HyoketsumeDice({cell,detonating=false,paused=false}: {cell: Cell;detonating?:boolean;paused?:boolean}) {
  const metalId = useId();
  const special = !!cell.kind;
  const crackSeed = Array.from(metalId).reduce((n,c)=>n*31+c.charCodeAt(0),0)>>>0;
  return <span className={`gimmick-die ${cell.kind || ''} ${detonating?'is-detonating':''}`} style={{backgroundColor:special?'transparent':colors[cell.value-1]}}>
    {special ? <span className="gimmick-idle" style={{animationPlayState:paused?'paused':'running'}}><svg className="gimmick-mech" viewBox="0 0 100 100" aria-hidden="true" style={{animationPlayState:paused?'paused':'running'}}>
      <defs><linearGradient id={metalId} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d0f5ff"/><stop offset=".18" stopColor="#64b9df"/><stop offset=".43" stopColor="#2876ad"/><stop offset=".55" stopColor="#a3e6fa"/><stop offset=".64" stopColor="#408db9"/><stop offset="1" stopColor="#174f82"/></linearGradient></defs>
      <g transform="translate(50 50) scale(1.29) translate(-50 -57.5)">
      <path d="M19 21H81L88 28V87L81 94H19L12 87V28Z" fill={`url(#${metalId})`}/>
      <path d="M20 25H79L84 30M16 32V84L21 89M23 91H79L84 86V35" fill="none" stroke="#73b6d3" strokeOpacity=".5" strokeWidth="1.5"/>
      <path d="M18 49H82M20 84H27M73 84H80" fill="none" stroke="#07192e" strokeWidth="2"/>
      {[27,73].map(x=><g className="hyoketsu-face" key={x} transform={`translate(${x} 36)`}><circle r="9" fill="#63869e" stroke="#071a31" strokeWidth="2"/><circle r="6.7" fill="#9bbdcb"/><path className="hyoketsu-eye-plus" d="M-4 0H4M0-4V4" stroke="#187bc2" strokeWidth="3" strokeLinecap="round"/></g>)}
      <g className="hyoketsu-mouth">
      <circle cx="50" cy="67" r="22" fill="#0a2038" stroke="#5c8ea7" strokeWidth="3"/>
      <circle cx="50" cy="67" r="18.8" fill="#020b15" stroke="#90c9dd" strokeWidth=".8"/>
      <SevenSegment value={cell.kind==='ice'?null:cell.fuse??6} />
      </g>
      </g>
      <path d="M50 8Q44-14 60-17" fill="none" stroke="#88cce7" strokeWidth="6"/>
      {cell.kind==='bomb'&&!detonating&&<g transform="translate(60 -17) scale(8.4)" className="hyoketsu-fuse-sparks" style={{'--fuse-play':paused?'paused':'running'} as CSSProperties}>
        <circle r="1.5" fill="#fff" className="hyoketsu-fuse-core"/>
        {Array.from({length:16},(_,i)=>{const angle=i*137.508*Math.PI/180;const reach=9+i%5*2;return <path key={i} className="hyoketsu-fuse-spark" d={`M-1 1L1 -2L-.8 -3L1.8 -5L.3 -6L1 -8L-2 -4L-.3 -3L-2 0Z`} fill={['#298dff','#9eeaff','#ffffff'][i%3]} style={{'--spark-x':Math.cos(angle)*reach+'px','--spark-y':Math.sin(angle)*reach+'px','--spark-angle':(angle*180/Math.PI+90)+'deg',animationDelay:i*-.0414+'s',animationDuration:(.32+i%4*.045)+'s'} as CSSProperties}/>;})}
      </g>}
    </svg>{cell.kind==='ice'&&<><span className="gimmick-ice-shell"/><svg className="gimmick-cracks" viewBox="0 0 100 100" aria-hidden="true">{iceCrackPair(crackSeed).flatMap((p,k)=>ICE_CRACKS[p].map((line,j)=><polyline key={`${k}-${j}`} points={line.map(([x,y])=>`${x*100},${y*100}`).join(' ')} fill="none" stroke="#e4ffff" strokeOpacity={j?.65:.9} strokeWidth={j?.65:1.7} strokeLinejoin="round"/>))}</svg></>}</span> : <span className="gimmick-pips">{Array.from({length:9},(_,i)=><i key={i} style={{opacity:pips[cell.value-1].includes(i)?1:0}} />)}</span>}
  </span>;
}