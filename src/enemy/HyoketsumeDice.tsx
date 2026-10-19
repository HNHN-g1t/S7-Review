import { useId, type CSSProperties } from 'react';
import './gimmickDice.css';
type Cell = {value:number;kind?:'ice'|'bomb';fuse?:number};
const colors=['#fc6dac','#8b46d2','#43ae39','#43ae39','#8b46d2','#fc6dac'];
const pips=[[4],[0,8],[0,4,8],[0,2,6,8],[0,2,4,6,8],[0,2,3,5,6,8]];

const segments: Record<number,string>={1:'bc',2:'abdeg',3:'abcdg',4:'bcfg',5:'acdfg',6:'acdefg'};
function SevenSegment({value}:{value:number|null}) {
 const paths={a:'M42 54H58L56 57H44Z',b:'M58 55V65L55 63V58Z',c:'M58 67V77L55 75V69Z',d:'M42 79H58L56 76H44Z',e:'M40 67V77L43 75V69Z',f:'M40 55V65L43 63V58Z',g:'M43 65H55L57 67L55 69H43L41 67Z'};
 return <g fill={value!==null&&value<=2?'#ff5648':'#ffcb57'}>{Object.entries(paths).map(([key,d])=><path key={key} d={d} opacity={value===null?key==='g'?.4:.08:segments[value]?.includes(key)?1:.08}/>)}</g>;
}
export function HyoketsumeDice({cell,detonating=false,paused=false}: {cell: Cell;detonating?:boolean;paused?:boolean}) {
  const metalId = useId();
  const special = !!cell.kind;
  return <span className={`gimmick-die ${cell.kind || ''} ${detonating?'is-detonating':''}`} style={{backgroundColor:special?'transparent':colors[cell.value-1]}}>
    {special ? <span className="gimmick-idle" style={{animationPlayState:paused?'paused':'running'}}><svg className="gimmick-mech" viewBox="0 0 100 100" aria-hidden="true" style={{animationPlayState:paused?'paused':'running'}}>
      <defs><linearGradient id={metalId} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#709caf"/><stop offset=".18" stopColor="#254765"/><stop offset=".43" stopColor="#0c213e"/><stop offset=".55" stopColor="#3a6680"/><stop offset=".64" stopColor="#15314e"/><stop offset="1" stopColor="#071729"/></linearGradient></defs>
      <g transform="translate(50 50) scale(1.29) translate(-50 -57.5)">
      <path d="M19 21H81L88 28V87L81 94H19L12 87V28Z" fill={`url(#${metalId})`}/>
      <path d="M20 25H79L84 30M16 32V84L21 89M23 91H79L84 86V35" fill="none" stroke="#73b6d3" strokeOpacity=".5" strokeWidth="1.5"/>
      <path d="M18 49H82M20 84H27M73 84H80" fill="none" stroke="#07192e" strokeWidth="2"/>
      {[27,73].map(x=><g key={x} transform={`translate(${x} 36)`}><circle r="9" fill="#63869e" stroke="#071a31" strokeWidth="2"/><circle r="6.7" fill="#9bbdcb"/><path d="M-5 0H5" stroke="#112940" strokeWidth="3" strokeLinecap="round"/></g>)}
      <circle cx="50" cy="67" r="22" fill="#0a2038" stroke="#5c8ea7" strokeWidth="3"/>
      <circle cx="50" cy="67" r="18.8" fill="#020b15" stroke="#90c9dd" strokeWidth=".8"/>
      <SevenSegment value={cell.kind==='ice'?null:cell.fuse??6} />
      </g>
      <path d="M60 8Q61-16 78-10" fill="none" stroke="#d4a75b" strokeWidth="6"/>
      {cell.kind==='bomb'&&!detonating&&<g transform="translate(78 -10) scale(4)" className="hyoketsu-fuse-sparks" style={{'--fuse-play':paused?'paused':'running'} as CSSProperties}>
        <circle r="2" fill="#fff8b0"/>
        {Array.from({length:7},(_,i)=>{const angle=i*Math.PI*2/7;return <circle key={i} className="hyoketsu-fuse-spark" r={i%2?1:1.5} fill={i%2?'#ffe13d':'#fff5a0'} style={{'--spark-x':Math.cos(angle)*12+'px','--spark-y':Math.sin(angle)*12+'px',animationDelay:i*-.09+'s'} as CSSProperties}/>;})}
      </g>}
    </svg>{cell.kind==='ice'&&<><span className="gimmick-ice-shell"/><span className="gimmick-crack"/></>}</span> : <span className="gimmick-pips">{Array.from({length:9},(_,i)=><i key={i} style={{opacity:pips[cell.value-1].includes(i)?1:0}} />)}</span>}
  </span>;
}