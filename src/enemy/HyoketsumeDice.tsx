import { useId, type CSSProperties } from 'react';
import './gimmickDice.css';
import { ICE_CRACKS, iceCrackPair, iceCrackRibbon } from './iceCracks';
type Cell = {value:number;kind?:'ice'|'bomb';fuse?:number};
const colors=['#fc6dac','#8b46d2','#43ae39','#43ae39','#8b46d2','#fc6dac'];
const pips=[[4],[0,8],[0,4,8],[0,2,6,8],[0,2,4,6,8],[0,2,3,5,6,8]];

// Preserve an exact 12x face area while varying the sixteen sharp rays.
const sparkCorePoints=(()=>{
 const base=Array.from({length:32},(_,i)=>{const a=i*Math.PI/16,r=i%2?1.05:1.85;return [Math.cos(a)*r,Math.sin(a)*r];});
 const jagged=base.map(([x,y],i)=>{const f=i%2?.9:1+.25*Math.sin(i*2.7);return [x*f,y*f];});
 const area=(p:number[][])=>Math.abs(p.reduce((n,v,i)=>{const w=p[(i+1)%p.length];return n+v[0]*w[1]-v[1]*w[0];},0))/2;
 const scale=Math.sqrt(area(base)*12/area(jagged));return jagged.map(([x,y])=>`${x*scale},${y*scale}`).join(' ');
})();
const segments: Record<number,string>={0:'abcdef',1:'bc',2:'abdeg',3:'abcdg',4:'bcfg',5:'acdfg',6:'acdefg'};
function SevenSegment({value}:{value:number|null}) {
 const paths={a:'M42 54H58L56 57H44Z',b:'M58 55V65L55 63V58Z',c:'M58 67V77L55 75V69Z',d:'M42 79H58L56 76H44Z',e:'M40 67V77L43 75V69Z',f:'M40 55V65L43 63V58Z',g:'M43 65H55L57 67L55 69H43L41 67Z'};
 return <g className="hyoketsu-count" fill="#9eeaff">{Object.entries(paths).map(([key,d])=><path key={key} d={d} style={{opacity:value===null?key==='g'?.4:.08:segments[value]?.includes(key)?1:.08}}/>)}</g>;
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
      <g className="hyoketsu-body-bevel">{[[19,21],[81,21],[88,28],[88,87],[81,94],[19,94],[12,87],[12,28]].map((v,i,outer)=>{const inner=[[21,25.5],[79,25.5],[83.5,30],[83.5,85],[79,89.5],[21,89.5],[16.5,85],[16.5,30]];const q=outer[(i+1)%8],p=inner[i],r=inner[(i+1)%8];return <polygon key={i} points={`${v} ${q} ${r} ${p}`} fill={['#f1fdff','#c8f5ff','#367ba5','#21517c','#1d527f','#4b98bf','#c1f1ff','#fff'][i]}/>;})}</g>
      {[27,73].map(x=><g className="hyoketsu-face" key={x} transform={`translate(${x} 36) scale(1.2)`}><g>{Array.from({length:8},(_,i)=>{const points=(radius:number,reverse=false)=>Array.from({length:5},(_,k)=>{const a=(-135+(i+(reverse?4-k:k)/4)*45)*Math.PI/180;return `${Math.cos(a)*radius},${Math.sin(a)*radius}`;}).join(' ');return <polygon key={i} points={points(10)+' '+points(6.5,true)} fill={['#285779','#204c70','#5188a8','#b4e9f7','#edfdff','#bdeaf7','#7dbbd4','#3b779a'][i]}/>;})}</g><circle className="hyoketsu-eye-display" r="6.5" fill="#071e32"/><path className="hyoketsu-eye-plus" d={detonating?'M-4 0H4M0-4V4':'M-4 0H4'} stroke="#168eff" strokeWidth="3.4" strokeLinecap="round"/><path className="hyoketsu-eye-plus hyoketsu-eye-light" d={detonating?'M-4 0H4M0-4V4':'M-4 0H4'} stroke="#b3f5ff" strokeWidth="1.2" strokeLinecap="round"/></g>)}
      <g className="hyoketsu-mouth">
      <g>{Array.from({length:8},(_,i)=>{const points=(radius:number,reverse=false)=>Array.from({length:5},(_,k)=>{const a=(-135+(i+(reverse?4-k:k)/4)*45)*Math.PI/180;return `${50+Math.cos(a)*radius},${67+Math.sin(a)*radius}`;}).join(' ');return <polygon key={i} points={points(24)+' '+points(18,true)} fill={['#245275','#1b466a','#477ea1','#a6dfef','#e4fcff','#c4eff7','#76b6d0','#356e93'][i]}/>;})}</g>
      <circle className="hyoketsu-timer-well" cx="50" cy="67" r="18" fill="#071e32"/>
      <SevenSegment value={detonating?0:cell.kind==='ice'?null:cell.fuse??6} />
      </g>
      </g>
      <path d="M50 8Q44-14 60-17" fill="none" stroke="#88cce7" strokeWidth="6"/>
      {cell.kind==='bomb'&&!detonating&&<g transform="translate(60 -17) scale(4.4352)" className="hyoketsu-fuse-sparks" style={{'--fuse-play':paused?'paused':'running'} as CSSProperties}>
        <g className="hyoketsu-fuse-core"><polygon points={sparkCorePoints} fill="#197bff"/><polygon points={sparkCorePoints} transform="scale(.72)" fill="#68dfff"/><polygon points={sparkCorePoints} transform="scale(.4)" fill="#c9f6ff"/></g>

      </g>}
    </svg>{cell.kind==='ice'&&<><span className="gimmick-ice-shell"/><svg className="gimmick-cracks" viewBox="0 0 100 100" aria-hidden="true">{iceCrackPair(crackSeed).flatMap((p,k)=>ICE_CRACKS[p].map((line,j)=><polygon key={`${k}-${j}`} points={iceCrackRibbon(line,crackSeed+p*3+j,j).map(([x,y])=>`${x*100},${y*100}`).join(' ')} fill="#e4ffff" opacity={j?.65:.9}/>))}</svg></>}</span> : <span className="gimmick-pips">{Array.from({length:9},(_,i)=><i key={i} style={{opacity:pips[cell.value-1].includes(i)?1:0}} />)}</span>}
  </span>;
}