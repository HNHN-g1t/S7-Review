import { playIceFreeze, playIceCrash } from './icePing';
import { useEffect, useRef, useState } from 'react';
import { HYOKETSU_BURST_MS, HYOKETSU_RING, hyoketsuIceState } from './hyoketsuFireworks';
import { HyoketsumeDice } from './HyoketsumeDice';
import './hyoketsuBurst.css';
import { ICE_CRACKS, iceCrackPair } from './iceCracks';
type Point={x:number;y:number};
export function HyoketsuBurst({cell,flashCells=[],paused=false,onEnd,onSweep,onCrash}:{cell:number;flashCells?:Point[];paused?:boolean;onEnd?:()=>void;onSweep?:()=>void;onCrash?:()=>void}) {
 const canvas=useRef<HTMLCanvasElement>(null),latest=useRef({paused,flashCells,onEnd,onSweep,onCrash});latest.current={paused,flashCells,onEnd,onSweep,onCrash};
 useEffect(()=>{
  const ctx=canvas.current?.getContext('2d');if(!ctx)return;
  const size=3*cell,dpr=Math.min(devicePixelRatio||1,2);canvas.current!.width=Math.round(size*dpr);canvas.current!.height=Math.round(size*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const crackSeed=Math.floor(Math.random()*65536);
  let elapsed=0,last=performance.now(),frame=0,ended=false,swept=false,crashed=false;
  const draw=(now:number)=>{
   const delta=Math.max(0,now-last);last=now;
   if(!latest.current.paused&&!document.hidden)elapsed=Math.min(HYOKETSU_BURST_MS,elapsed+delta);
   ctx.clearRect(0,0,size,size);
   if(elapsed>=HYOKETSU_BURST_MS){if(!ended){ended=true;latest.current.onEnd?.();}return;}
   const state=hyoketsuIceState(elapsed);
   if(elapsed>=1000&&!swept){swept=true;latest.current.onSweep?.();}
   if(elapsed>=1400&&!crashed){crashed=true;latest.current.onCrash?.();}
   ctx.globalCompositeOperation='source-over';
   const tile=(x:number,y:number,alpha:number)=>{
    ctx.save();ctx.translate(x*cell,y*cell);ctx.globalAlpha=alpha;
    ctx.beginPath();ctx.moveTo(cell*.12,0);ctx.lineTo(cell*.88,0);ctx.lineTo(cell,cell*.14);ctx.lineTo(cell,cell*.88);ctx.lineTo(cell*.86,cell);ctx.lineTo(cell*.1,cell);ctx.lineTo(0,cell*.86);ctx.lineTo(0,cell*.12);ctx.closePath();ctx.clip();
    const ice=ctx.createLinearGradient(0,0,cell,cell);ice.addColorStop(0,'#d5fbff');ice.addColorStop(.28,'#248fe7');ice.addColorStop(.65,'#2dd2c8');ice.addColorStop(1,'#b0f4ff');ctx.fillStyle=ice;ctx.fillRect(0,0,cell,cell);
    // Eight planar facets give the clipped block a dice-like bevel.
    const rim=[[.12,0],[.88,0],[1,.14],[1,.88],[.86,1],[.1,1],[0,.86],[0,.12]];
    rim.forEach((p,i)=>{const q=rim[(i+1)%8];ctx.fillStyle=['#edffff','#c3f6ff','#397da7','#235c8e','#24658f','#74c6df','#c0f5ff','#f4ffff'][i];ctx.beginPath();ctx.moveTo(p[0]*cell,p[1]*cell);ctx.lineTo(q[0]*cell,q[1]*cell);ctx.lineTo((.5+(q[0]-.5)*.82)*cell,(.5+(q[1]-.5)*.82)*cell);ctx.lineTo((.5+(p[0]-.5)*.82)*cell,(.5+(p[1]-.5)*.82)*cell);ctx.closePath();ctx.fill();});
    iceCrackPair(crackSeed+x*17+y*31).forEach(p=>ICE_CRACKS[p].forEach((line,j)=>{ctx.strokeStyle=j?'#b5f3ff':'#e9ffff';ctx.lineWidth=cell*(j?.009:.022);ctx.beginPath();line.forEach(([px,py],i)=>{if(i)ctx.lineTo(px*cell,py*cell);else ctx.moveTo(px*cell,py*cell);});ctx.stroke();}));
    if(state.phase==='sweep'){
     const d=(-1+state.progress*5)*cell-(x+y)*cell*.5;
     const shine=ctx.createLinearGradient(d-cell*.28,d-cell*.28,d+cell*.28,d+cell*.28);shine.addColorStop(0,'#ffffff00');shine.addColorStop(.5,'#fff');shine.addColorStop(1,'#ffffff00');ctx.fillStyle=shine;ctx.fillRect(0,0,cell,cell);
    }
    // Two crisp four-point glints per frozen tile. The same glints travel with shards.
    const frozenAt=x===1&&y===1?1100:(HYOKETSU_RING.findIndex(p=>p.x===x&&p.y===y)+1)*125;
    if(elapsed>=frozenAt){
     for(let k=0;k<2;k++){
      const seed=crackSeed+x*17+y*31+k*43;
      const pulse=Math.pow(Math.max(0,Math.sin((elapsed-frozenAt)/95+seed)),5);
      if(pulse<.02)continue;
      const gx=(.2+(seed%57)/100)*cell,gy=(.18+((seed*7)%61)/100)*cell,r=cell*(.07+.07*pulse);
      ctx.save();ctx.globalAlpha=alpha*pulse;ctx.translate(gx,gy);
      ctx.fillStyle='#a7edff';ctx.beginPath();ctx.moveTo(0,-r*1.4);ctx.lineTo(r*.17,-r*.17);ctx.lineTo(r,0);ctx.lineTo(r*.17,r*.17);ctx.lineTo(0,r*1.4);ctx.lineTo(-r*.17,r*.17);ctx.lineTo(-r,0);ctx.lineTo(-r*.17,-r*.17);ctx.closePath();ctx.fill();
      ctx.fillStyle='#fff';ctx.fillRect(-r*.08,-r*.65,r*.16,r*1.3);ctx.fillRect(-r*.5,-r*.08,r,r*.16);ctx.restore();
     }
    }
    ctx.restore();
   };
   if(state.phase==='freeze'||state.phase==='sweep'){
    HYOKETSU_RING.forEach((p,i)=>{const alpha=Math.max(0,Math.min(1,(elapsed-i*125)/125));if(alpha>0)tile(p.x,p.y,alpha);});
    if(elapsed>=1000)tile(1,1,Math.min(1,(elapsed-1000)/100));
   }else if(state.phase==='shatter'){
    const progress=state.progress;
    [{x:1,y:1},...HYOKETSU_RING].forEach(({x,y},index)=>{
     ctx.globalAlpha=1;ctx.fillStyle='#232b36';ctx.fillRect(x*cell,y*cell,cell,cell);
     const rim=[[.12,0],[.88,0],[1,.14],[1,.88],[.86,1],[.1,1],[0,.86],[0,.12]];
     const seed=crackSeed+index*31;
     const hub=[.34+(seed%29)/100,.34+((seed*7)%29)/100];
     for(let j=0;j<8;j++){
      const p=rim[j],q=rim[(j+1)%8];
      const center=[(hub[0]+p[0]+q[0])/3,(hub[1]+p[1]+q[1])/3];
      const dx=center[0]-.5,dy=center[1]-.5;
      const travel=progress*progress;
      ctx.save();ctx.translate((x+center[0])*cell+dx*cell*travel*1.5,(y+center[1])*cell+dy*cell*travel*1.5+travel*cell*.25);
      ctx.rotate((j%2?1:-1)*progress*(.18+(seed%5)*.04));ctx.translate(-center[0]*cell,-center[1]*cell);
      // Clip the original ice face so the gradient, rim and cracks survive the break.
      ctx.save();ctx.beginPath();ctx.moveTo(hub[0]*cell,hub[1]*cell);ctx.lineTo(p[0]*cell,p[1]*cell);ctx.lineTo(q[0]*cell,q[1]*cell);ctx.closePath();ctx.clip();
      ctx.translate(-x*cell,-y*cell);tile(x,y,1-progress);ctx.restore();
      // Narrow facets on fresh cut edges, with asymmetric light and dark faces.
      const vertices=[hub,p,q];
      vertices.forEach((v,k)=>{const w=vertices[(k+1)%3];const inset=(point:number[])=>[point[0]*.94+center[0]*.06,point[1]*.94+center[1]*.06];const vi=inset(v),wi=inset(w);
       ctx.globalAlpha=(1-progress)*.95;ctx.fillStyle=(j+k)%3===0?'#347ca8':(j+k)%3===1?'#e4ffff':'#83dcf6';
       ctx.beginPath();ctx.moveTo(v[0]*cell,v[1]*cell);ctx.lineTo(w[0]*cell,w[1]*cell);ctx.lineTo(wi[0]*cell,wi[1]*cell);ctx.lineTo(vi[0]*cell,vi[1]*cell);ctx.closePath();ctx.fill();
      });ctx.restore();
     }
    });
   }
   if(state.phase==='afterglow'){ctx.globalAlpha=1;ctx.fillStyle='#232b36';ctx.fillRect(0,0,size,size);}
   if(elapsed>=1800){
    // Detached icy glints outlive the glass by another 600 ms.
    const fade=elapsed<2000?1:(2600-elapsed)/600;
    for(let i=0;i<24;i++){
     const seed=crackSeed+i*97, pulse=Math.pow(Math.max(0,Math.sin(elapsed/80+i*2.4)),3)*fade;
     if(pulse<.02)continue;
     const x=(.12+(seed%277)/100)*cell,y=(.1+((seed*13)%278)/100)*cell,r=cell*(.035+.065*pulse);
     ctx.save();ctx.translate(x,y);ctx.globalAlpha=pulse;ctx.fillStyle=i%3?'#b6f3ff':'#fff';
     ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(r*.16,-r*.16);ctx.lineTo(r,0);ctx.lineTo(r*.16,r*.16);ctx.lineTo(0,r);ctx.lineTo(-r*.16,r*.16);ctx.lineTo(-r,0);ctx.lineTo(-r*.16,-r*.16);ctx.closePath();ctx.fill();ctx.restore();
    }
   }
   ctx.globalAlpha=1;frame=requestAnimationFrame(draw);
  };
  draw(last);return()=>cancelAnimationFrame(frame);
 },[cell]);
 return <canvas className="hyoketsu-fireworks" aria-hidden="true" ref={canvas} style={{width:cell*3,height:cell*3}}/>;
}
export function HyoketsuBurstPreview({paused=false}:{paused?:boolean}){
 const audio=useRef<AudioContext|null>(null);
 const [sound,setSound]=useState(false),[loop,setLoop]=useState(false),[stopped,setStopped]=useState(false);
 useEffect(()=>()=>{void audio.current?.close();},[]);
 useEffect(()=>{if(audio.current){if(paused||stopped||!sound)void audio.current.suspend();else void audio.current.resume();}},[paused,stopped,sound]);
 const [run,setRun]=useState(0),[phase,setPhase]=useState<'idle'|'running'|'done'>('idle');
 useEffect(()=>{if(phase==='running'&&sound&&audio.current)playIceFreeze(audio.current,audio.current.destination);},[run,phase]);
 useEffect(()=>{if(!loop||phase!=='done'||paused||stopped)return;const timer=setTimeout(()=>{setRun(n=>n+1);setPhase('running');},650);return()=>clearTimeout(timer);},[loop,phase,paused,stopped]);
 const points=Array.from({length:9},(_,i)=>({x:i%3,y:Math.floor(i/3)}));
 return <div className="hyoketsu-burst-preview"><button type="button" onClick={()=>{if(sound){audio.current??=new AudioContext();void audio.current.resume();}setLoop(false);setStopped(false);setRun(n=>n+1);setPhase('running');}}>▶ 発動アニメを再生（2600ms）</button><button type="button" onClick={()=>{setLoop(false);setStopped(false);setPhase('idle');}}>▶ アイドリング再生</button><button type="button" aria-pressed={loop} onClick={()=>{if(sound){audio.current??=new AudioContext();void audio.current.resume();}setLoop(true);setStopped(false);setRun(n=>n+1);setPhase('running');}}>↻ 発動ローテーション再生</button><button type="button" aria-pressed={stopped} onClick={()=>setStopped(v=>!v)}>{stopped?'再開':'一時停止'}</button><label><input type="checkbox" checked={sound} onChange={e=>setSound(e.target.checked)}/> SEを鳴らす（初期OFF）</label><div className="hyoketsu-burst-board" role="img" aria-label="1000msの左回り凍結、400msの斜めライトスイープ、600msの氷の2Dクラッシュ">{points.map((_,i)=><span key={i} className="hyoketsu-burst-cell">{phase!=='done'&&(i===4?<HyoketsumeDice detonating={phase==='running'} paused={paused||stopped} cell={{value:3,kind:'bomb',fuse:1}}/>:i===1||i===7?<span className="hyoketsu-burst-enemy">{i===1?'●':'××'}</span>:<span className="hyoketsu-burst-die" style={{background:['#fc6dac','#43ae39','#8b46d2'][i%3]}}><i/><i/><i/></span>)}</span>)}{phase==='running'&&<HyoketsuBurst key={run} paused={paused||stopped} cell={64} flashCells={points} onCrash={()=>{if(sound&&audio.current)playIceCrash(audio.current,audio.current.destination);}} onEnd={()=>setPhase('done')}/>}</div><small>{phase==='running'?'左回り凍結 → ライトスイープ → 氷のクラッシュ':phase==='done'?'2.6秒間の氷演出が終了。もう一度再生できます。':'1000ms凍結＋400ms輝き＋600msクラッシュ＋600ms残光。実ゲームと共通。'}</small></div>;
}
