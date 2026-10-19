import { playIcePing } from './icePing';
import { useEffect, useRef, useState } from 'react';
import { HYOKETSU_BURST_MS, HYOKETSU_RING, hyoketsuIceState } from './hyoketsuFireworks';
import { HyoketsumeDice } from './HyoketsumeDice';
import './hyoketsuBurst.css';
type Point={x:number;y:number};
export function HyoketsuBurst({cell,flashCells=[],paused=false,onEnd,onSweep}:{cell:number;flashCells?:Point[];paused?:boolean;onEnd?:()=>void;onSweep?:()=>void}) {
 const canvas=useRef<HTMLCanvasElement>(null),latest=useRef({paused,flashCells,onEnd,onSweep});latest.current={paused,flashCells,onEnd,onSweep};
 useEffect(()=>{
  const ctx=canvas.current?.getContext('2d');if(!ctx)return;
  const size=3*cell,dpr=Math.min(devicePixelRatio||1,2);canvas.current!.width=Math.round(size*dpr);canvas.current!.height=Math.round(size*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  let elapsed=0,last=performance.now(),frame=0,ended=false,swept=false;
  const draw=(now:number)=>{
   const delta=Math.max(0,now-last);last=now;
   if(!latest.current.paused&&!document.hidden)elapsed=Math.min(HYOKETSU_BURST_MS,elapsed+delta);
   ctx.clearRect(0,0,size,size);
   if(elapsed>=HYOKETSU_BURST_MS){if(!ended){ended=true;latest.current.onEnd?.();}return;}
   const state=hyoketsuIceState(elapsed);
   if(elapsed>=1000&&!swept){swept=true;latest.current.onSweep?.();}
   ctx.globalCompositeOperation='source-over';
   const tile=(x:number,y:number,alpha:number)=>{
    ctx.save();ctx.translate(x*cell,y*cell);ctx.globalAlpha=alpha;
    ctx.beginPath();ctx.moveTo(cell*.12,0);ctx.lineTo(cell*.88,0);ctx.lineTo(cell,cell*.14);ctx.lineTo(cell,cell*.88);ctx.lineTo(cell*.86,cell);ctx.lineTo(cell*.1,cell);ctx.lineTo(0,cell*.86);ctx.lineTo(0,cell*.12);ctx.closePath();ctx.clip();
    const ice=ctx.createLinearGradient(0,0,cell,cell);ice.addColorStop(0,'#d5fbff');ice.addColorStop(.28,'#248fe7');ice.addColorStop(.65,'#2dd2c8');ice.addColorStop(1,'#b0f4ff');ctx.fillStyle=ice;ctx.fillRect(0,0,cell,cell);
    ctx.strokeStyle='#d8ffff';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(cell*.1,cell*.1);ctx.lineTo(cell*.8,cell*.14);ctx.lineTo(cell*.92,cell*.78);ctx.moveTo(cell*.22,0);ctx.lineTo(cell*.46,cell*.45);ctx.lineTo(cell*.25,cell);ctx.moveTo(cell*.46,cell*.45);ctx.lineTo(cell,cell*.65);ctx.stroke();
    if(state.phase==='sweep'){
     const d=(-1+state.progress*5)*cell-(x+y)*cell*.5;
     const shine=ctx.createLinearGradient(d-cell*.28,d-cell*.28,d+cell*.28,d+cell*.28);shine.addColorStop(0,'#ffffff00');shine.addColorStop(.5,'#fff');shine.addColorStop(1,'#ffffff00');ctx.fillStyle=shine;ctx.fillRect(0,0,cell,cell);
    }ctx.restore();
   };
   if(state.phase!=='shatter'){
    HYOKETSU_RING.forEach((p,i)=>{const alpha=Math.max(0,Math.min(1,(elapsed-i*125)/125));if(alpha>0)tile(p.x,p.y,alpha);});
    if(elapsed>=1000)tile(1,1,Math.min(1,(elapsed-1000)/100));
   }else{
    const progress=state.progress;
    [{x:1,y:1},...HYOKETSU_RING].forEach(({x,y},index)=>{
     ctx.globalAlpha=1;ctx.fillStyle='#232b36';ctx.fillRect(x*cell,y*cell,cell,cell);
     const corners=[[0,0],[1,0],[1,1],[0,1]];
     for(let j=0;j<4;j++){
      const p=corners[j],q=corners[(j+1)%4];ctx.save();const cx=(x+.5)*cell,cy=(y+.5)*cell;
      ctx.translate(cx+(x-1+(p[0]+q[0]-1)*.5)*cell*progress*.6,cy+(y-1+(p[1]+q[1]-1)*.5)*cell*progress*.6+progress*progress*cell*.35);ctx.rotate((j%2?1:-1)*progress*.35);
      ctx.globalAlpha=1-progress;ctx.fillStyle=['#278fe7','#55dad8','#cdfaff','#68bff1'][(j+index)%4];ctx.strokeStyle='#e3ffff';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo((p[0]-.5)*cell,(p[1]-.5)*cell);ctx.lineTo((q[0]-.5)*cell,(q[1]-.5)*cell);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
     }
    });
   }
   ctx.globalAlpha=1;frame=requestAnimationFrame(draw);
  };
  draw(last);return()=>cancelAnimationFrame(frame);
 },[cell]);
 return <canvas className="hyoketsu-fireworks" aria-hidden="true" ref={canvas} style={{width:cell*3,height:cell*3}}/>;
}
export function HyoketsuBurstPreview({paused=false}:{paused?:boolean}){
 const audio=useRef<AudioContext|null>(null);
 const [sound,setSound]=useState(false);
 useEffect(()=>()=>{void audio.current?.close();},[]);
 const [run,setRun]=useState(0),[phase,setPhase]=useState<'idle'|'running'|'done'>('idle');
 const points=Array.from({length:9},(_,i)=>({x:i%3,y:Math.floor(i/3)}));
 return <div className="hyoketsu-burst-preview"><button type="button" onClick={()=>{if(sound){audio.current??=new AudioContext();void audio.current.resume();}setRun(n=>n+1);setPhase('running');}}>▶ 発動アニメを再生（2000ms）</button><label><input type="checkbox" checked={sound} onChange={e=>setSound(e.target.checked)}/> SEを鳴らす（初期OFF）</label><div className="hyoketsu-burst-board" role="img" aria-label="1000msの左回り凍結、400msの斜めライトスイープ、600msの氷の2Dクラッシュ">{points.map((_,i)=><span key={i} className="hyoketsu-burst-cell">{phase!=='done'&&(i===4?<HyoketsumeDice detonating={phase==='running'} paused={paused} cell={{value:3,kind:'bomb',fuse:1}}/>:i===1||i===7?<span className="hyoketsu-burst-enemy">{i===1?'●':'××'}</span>:<span className="hyoketsu-burst-die" style={{background:['#fc6dac','#43ae39','#8b46d2'][i%3]}}><i/><i/><i/></span>)}</span>)}{phase==='running'&&<HyoketsuBurst key={run} paused={paused} cell={64} flashCells={points} onSweep={()=>{if(sound&&audio.current)playIcePing(audio.current,audio.current.destination);}} onEnd={()=>setPhase('done')}/>}</div><small>{phase==='running'?'左回り凍結 → ライトスイープ → 氷のクラッシュ':phase==='done'?'2秒間の氷演出が終了。もう一度再生できます。':'1000ms凍結＋400ms輝き＋600msクラッシュ。実ゲームと共通。'}</small></div>;
}
