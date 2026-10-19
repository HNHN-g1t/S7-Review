import { useEffect, useRef, useState } from 'react';
import { HYOKETSU_BURST_MS, hyoketsuFireworksAt } from './hyoketsuFireworks';
import { HyoketsumeDice } from './HyoketsumeDice';
import './hyoketsuBurst.css';
type Point={x:number;y:number};
export function HyoketsuBurst({cell,flashCells=[],paused=false,onEnd}:{cell:number;flashCells?:Point[];paused?:boolean;onEnd?:()=>void}) {
 const canvas=useRef<HTMLCanvasElement>(null),latest=useRef({paused,flashCells,onEnd});latest.current={paused,flashCells,onEnd};
 useEffect(()=>{
  const ctx=canvas.current?.getContext('2d');if(!ctx)return;
  const size=3*cell,dpr=Math.min(devicePixelRatio||1,2);canvas.current!.width=Math.round(size*dpr);canvas.current!.height=Math.round(size*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  let elapsed=0,last=performance.now(),frame=0,ended=false;
  const draw=(now:number)=>{
   const delta=Math.max(0,now-last);last=now;
   if(!latest.current.paused&&!document.hidden)elapsed=Math.min(HYOKETSU_BURST_MS,elapsed+delta);
   ctx.clearRect(0,0,size,size);
   if(elapsed>=HYOKETSU_BURST_MS){if(!ended){ended=true;latest.current.onEnd?.();}return;}
   // Same 60ms white-flash rhythm as the standard enemy/bomb impact, covering every hit cell.
   ctx.globalCompositeOperation='source-over';ctx.globalAlpha=.7;ctx.fillStyle='#fff';
   if(Math.floor(elapsed/60)%2===0)latest.current.flashCells.forEach(p=>ctx.fillRect(p.x*cell,p.y*cell,cell,cell));
   ctx.globalCompositeOperation='lighter';
   for(const p of hyoketsuFireworksAt(elapsed)){ctx.globalAlpha=p.alpha;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x*cell,p.y*cell,p.r*cell,0,Math.PI*2);ctx.fill();}
   ctx.globalAlpha=1;frame=requestAnimationFrame(draw);
  };
  draw(last);return()=>cancelAnimationFrame(frame);
 },[cell]);
 return <canvas className="hyoketsu-fireworks" aria-hidden="true" ref={canvas} style={{width:cell*3,height:cell*3}}/>;
}
export function HyoketsuBurstPreview({paused=false}:{paused?:boolean}){
 const [run,setRun]=useState(0),[phase,setPhase]=useState<'idle'|'running'|'done'>('idle');
 const points=Array.from({length:9},(_,i)=>({x:i%3,y:Math.floor(i/3)}));
 return <div className="hyoketsu-burst-preview"><button type="button" onClick={()=>{setRun(n=>n+1);setPhase('running');}}>▶ 発動アニメを再生（2000ms）</button><div className="hyoketsu-burst-board" role="img" aria-label="3×3内のサイと敵が点滅し、円形のカラフルな花火が2秒間散り続ける見本">{points.map((_,i)=><span key={i} className="hyoketsu-burst-cell">{phase!=='done'&&(i===4?<HyoketsumeDice cell={{value:3,kind:'bomb',fuse:1}}/>:i===1||i===7?<span className="hyoketsu-burst-enemy">{i===1?'●':'××'}</span>:<span className="hyoketsu-burst-die" style={{background:['#fc6dac','#43ae39','#8b46d2'][i%3]}}><i/><i/><i/></span>)}</span>)}{phase==='running'&&<HyoketsuBurst key={run} paused={paused} cell={64} flashCells={points} onEnd={()=>setPhase('done')}/>}</div><small>{phase==='running'?'3×3の範囲内で発動中…':phase==='done'?'2秒間の花火と点滅が終了。もう一度再生できます。':'同じ花火・セル点滅を図鑑と実ゲームで共用。'}</small></div>;
}
