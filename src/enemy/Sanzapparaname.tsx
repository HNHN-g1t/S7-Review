import {rockOutline} from './SanzapparanamePreview';
import {sanzEruptionScale} from './sanzapparanameRules';
export type SanzShot={x:number;y:number;dame:boolean;delay:number;landed?:boolean};
export function Sanzapparaname({cells,elapsed,charge,hit,paused}:{cells:{x:number;y:number}[];elapsed:number;charge:number;hit:boolean;paused:boolean}) {
  if(!cells.length)return null;
  const bottom=Math.max(...cells.map(p=>p.y)),center=3,top=bottom-2;
  const removed=new Set([5,3,1].flatMap((n,row)=>Array.from({length:n},(_,i)=>({id:`${row}-${i}`,x:center-(n-1)/2+i,y:bottom-row}))).filter(p=>!cells.some(q=>p.x===q.x&&p.y===q.y)).map(p=>p.id));
  const outline=rockOutline(removed), heat=Math.min(1,charge/4),scale=elapsed<0?1:sanzEruptionScale(elapsed);
  const mix=(a:number[],b:number[])=>`rgb(${a.map((v,i)=>Math.round(v+(b[i]-v)*heat)).join(',')})`;
  return <svg aria-hidden className="sanz-game-body" viewBox="0 0 7 14" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',overflow:'visible',zIndex:100}}>
    <style>{`@keyframes sanz-impact{0%,28%,56%{opacity:.95}14%,42%{opacity:.1}100%{opacity:0}}@keyframes sanz-game-particle{0%{opacity:0;transform:translateY(0)}11%{opacity:.8}22%{opacity:0;transform:translateY(-11px)}100%{opacity:0}}@keyframes sanz-game-particle-max{0%{opacity:0;transform:translateY(0)}11%{opacity:.8}22%{opacity:0;transform:translateY(-99px)}100%{opacity:0}}`}</style>
    <defs><linearGradient id="sanz-game-heat" x2="0" y2="1"><stop stopColor={mix([233,55,66],[255,4,12])}/><stop offset="1" stopColor={mix([25,159,186],[255,65,30])}/></linearGradient><linearGradient id="sanz-game-bevel" x2="1" y2="1"><stop stopColor="#fff" stopOpacity=".4"/><stop offset="1" stopColor="#000" stopOpacity=".4"/></linearGradient><clipPath id="sanz-game-rock"><path d={outline}/></clipPath><clipPath id="sanz-game-eye"><path d="M96 112 Q115 121 134 112 Q132 125 115 125 Q98 125 96 112Z"/></clipPath></defs>
    <g transform={`translate(${center-2},${top}) scale(${1/46}) translate(0,138) scale(1,${scale}) translate(0,-138)`}>
      <path d={outline} fill="url(#sanz-game-heat)"/><g clipPath="url(#sanz-game-rock)">{Array.from({length:14},(_,i)=><rect key={i} y={i*10} width="230" height="3" fill="#142c3e" opacity=".2"/>)}{Array.from({length:heat>=1?40:24},(_,i)=><circle key={`p-${i}`} cx={24+(i*37)%184} cy={128-(i*19)%96} r={i%3?1.5:2.5} fill="#ffc859" style={{animation:`${heat>=1?'sanz-game-particle-max':'sanz-game-particle'} ${heat>=1?9.6:3.2}s linear -${i*.431}s infinite`,animationPlayState:paused?'paused':'running'}}/>)}<path d={outline} fill="none" stroke="url(#sanz-game-bevel)" strokeWidth="8"/>{hit&&<path d={outline} fill="white" style={{animation:'sanz-impact 240ms linear both',animationPlayState:paused?'paused':'running'}}/>}</g>
      <path d="M101 9 L127 9 L133 15 L128 24 L103 24 L97 17Z" fill="#ff3915"/><path d="M103 11 L126 11 L130 15 L124 19 L105 19 L100 16Z" fill="#050306"/>
      {hit?<path d="M96 119 Q115 129 134 119" fill="none" stroke="#16313d" strokeWidth="3.5"/>:<><path d="M96 112 Q115 121 134 112 Q132 125 115 125 Q98 125 96 112Z" fill="white"/><circle cx="115" cy="119" r="7" fill="#15354b" clipPath="url(#sanz-game-eye)"/></>}
    </g>
  </svg>;
}


// 噴き出したコイツメ・ダーメ。盤面のサイより必ず上に見えるよう、本体とは別の最前面レイヤーに描く（2026-10-14）。
// iPhone（Safari）は動いているサイを別レイヤーで描くので、translateZ(0) でこちらも独立させて z-index を効かせる
export function SanzShots({cells,elapsed,shots}:{cells:{x:number;y:number}[];elapsed:number;shots:SanzShot[]}) {
  if(!cells.length||elapsed<0||!shots.length)return null;
  const bottom=Math.max(...cells.map(p=>p.y)),center=3,top=bottom-2;
  return <svg aria-hidden className="sanz-game-shots" viewBox="0 0 7 14" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',overflow:'visible',zIndex:200,transform:'translateZ(0)',willChange:'transform'}}>
    {shots.map((shot,i)=>{const flight=elapsed-280-shot.delay;if(flight<0)return null;const p=Math.max(0,Math.min(1,flight/1476)),x=center+.5+(shot.x-center)*p,y=top+.4+(shot.y-top+.1)*p-18*p*(1-p),glow=Math.max(0,1-Math.max(0,flight-1476)/400);return <g key={i} transform={`translate(${x-.45},${y-.45})`}><rect x="-.12" y="-.12" width="1.14" height="1.14" rx=".28" fill="#ff3434" opacity={glow*.6}/>{!shot.landed&&<><rect width=".9" height=".9" rx=".18" fill="#2c3446"/>{shot.dame?<path d="M.18 .23L.38 .43M.38 .23L.18 .43M.52 .23L.72 .43M.72 .23L.52 .43" stroke="white" strokeWidth=".07"/>:<path d="M.18 .3L.3 .42L.42 .3M.5 .3L.62 .42L.74 .3" stroke="white" strokeWidth=".07" fill="none"/>}</>}</g>;})}
  </svg>;
}
