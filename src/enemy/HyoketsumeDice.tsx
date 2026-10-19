import { useId } from 'react';
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
    {special ? <span className="gimmick-idle"><svg className="gimmick-mech" viewBox="0 0 100 100" aria-hidden="true" style={{animationPlayState:paused?'paused':'running'}}>
      <defs><radialGradient id={metalId} cx="32%" cy="25%"><stop stopColor="#65707b"/><stop offset=".4" stopColor="#252b34"/><stop offset="1" stopColor="#06080d"/></radialGradient></defs>
      <path d="M52 23L55 10L69 13L65 26" fill="#434c59" stroke="#99a6b2" strokeWidth="2"/>
      <path d="M61 12Q62 2 75 8" fill="none" stroke="#d4a75b" strokeWidth="4"/>
      <circle cx="50" cy="56" r="36" fill={`url(#${metalId})`}/>
      <path d="M20 46Q50 62 82 45M31 26Q19 57 36 87M68 26Q83 58 65 88" fill="none" stroke="#606c79" strokeWidth="2"/>
      {[[-1,0],[1,0],[0,-1],[0,1]].map(([x,y],i)=><g key={i} transform={`translate(${50+x*29} ${56+y*29})`}><circle r="4" fill="#a5aeb6"/><path d="M-2 0H2" stroke="#202732" strokeWidth="1.5"/></g>)}
      <g transform="translate(35 38)"><circle r="8" fill="#aab5be" stroke="#303b45" strokeWidth="2"/><path d="M-5 0H5M0-5V5" stroke="#26303c" strokeWidth="3"/></g>
      <g transform="translate(65 38)"><circle r="8" fill="#aab5be" stroke="#303b45" strokeWidth="2"/><path d="M-5 0H5" stroke="#26303c" strokeWidth="3"/></g>
      <rect x="25" y="51" width="50" height="31" rx="2" fill="#020508" stroke="#7d8b97" strokeWidth="3"/>
      <SevenSegment value={cell.kind==='ice'?null:cell.fuse??6} />
    </svg>{cell.kind==='ice'&&<><span className="gimmick-ice-shell"/><span className="gimmick-crack"/></>}</span> : <span className="gimmick-pips">{Array.from({length:9},(_,i)=><i key={i} style={{opacity:pips[cell.value-1].includes(i)?1:0}} />)}</span>}
  </span>;
}