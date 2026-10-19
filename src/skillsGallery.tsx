import { EnjomePreview, EnjomeBomb } from './skills/EnjomePreview';
import { HyoketsuBurstPreview } from './enemy/HyoketsuBurst';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SKILL_ENTRIES, skillPracticeUrl, type SkillEntry } from './skillCatalogue';
import { HyoketsumeDice } from './enemy/HyoketsumeDice';
import './skillsGallery.css';
const pips=[[4],[0,8],[0,4,8],[0,2,6,8],[0,2,4,6,8],[0,2,3,5,6,8]];
const colors=['#fc6dac','#8b46d2','#43ae39','#43ae39','#8b46d2','#fc6dac'];
function Diagram({entry}:{entry:SkillEntry}) {
 if(entry.id==='enjo')return <figure className="skill-demo enjo-live-demo"><div style={{width:76,height:152}}><EnjomeBomb walls={0}/></div><figcaption>{entry.caption}</figcaption></figure>;
 return <figure className="skill-demo"><div className={`skill-grid ${entry.id==='rainbow'?'tall':''}`} role="img" aria-label={entry.caption}>{entry.diagram.flatMap((row,y)=>[...row].map((v,x)=><span key={`${x}-${y}`} className={`skill-cell ${v==='*'?'effect':''}`}>
 {/[1-6]/.test(v)?<span className="skill-die" style={{background:colors[Number(v)-1]}}>{Array.from({length:9},(_,i)=><i key={i} style={{opacity:pips[Number(v)-1].includes(i)?1:0,background:Number(v)===2||Number(v)===5?'#330066':'#fff'}}/>)}</span>:v==='n'?<span className="skill-die skill-nico">{Array.from({length:9},(_,i)=><i key={i} style={{opacity:pips[x%2?4:1].includes(i)?1:0}}/>)}</span>:v==='b'?<HyoketsumeDice cell={{value:3,kind:'bomb',fuse:1}}/>:null}
 </span>))}</div><figcaption>{entry.caption}</figcaption></figure>;
}
function SkillsGallery() {
 const [selected,setSelected]=useState<number|null>(null),[run,setRun]=useState(0);
 const [visible,setVisible]=useState(true);
 const [practiceFever,setPracticeFever]=useState(false);
 const [enjoWalls,setEnjoWalls]=useState<2|3>(2);
 const practiceFrame=useRef<HTMLIFrameElement|null>(null);
 const opener=useRef<HTMLButtonElement|null>(null),closeButton=useRef<HTMLButtonElement|null>(null);
 const close=()=>{setSelected(null);opener.current?.focus();};
 useEffect(()=>{
 const receive=(e:MessageEvent)=>{if(e.origin!==location.origin)return;if(e.source===parent&&e.data?.type==='sainome-review-visible')setVisible(!!e.data.visible);if(e.source===practiceFrame.current?.contentWindow&&e.data?.type==='sainome-practice-exit')close();};
 window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
 },[]);
 useEffect(()=>{if(selected===null)return;closeButton.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[selected]);
 const isYou456=selected!==null&&SKILL_ENTRIES[selected].id==='you456';
 const practiceUrl=selected===null?'':skillPracticeUrl(SKILL_ENTRIES[selected])+((isYou456||selected!==null&&SKILL_ENTRIES[selected].id==='enjo')&&practiceFever?'&fever=1':'')+(selected!==null&&SKILL_ENTRIES[selected].id==='enjo'?'&walls='+enjoWalls:'');
 return <main className="skills-gallery">
 <header><a href="/review.html" target="_top">← 仕様書に戻る</a><small>SAINOME SEVEN / DESIGN REVIEW</small><h1>ヒッサツメ図鑑</h1><p>発動条件・効果・形をまとめて確認。静止図は仕組みを示す模式図です。各技のお手本・模擬戦は、消音・保存分離した実ゲームで確認できます。</p></header>
 <nav aria-label="ヒッサツメの目次">{SKILL_ENTRIES.map((s,i)=><a key={s.id} href={'#skill-'+s.id}>{String(i+1).padStart(2,'0')} {s.name}</a>)}</nav>
 <div className="skills-list">{SKILL_ENTRIES.map((s,i)=><article id={'skill-'+s.id} key={s.id}><div className="skill-heading"><span>{String(i+1).padStart(2,'0')}</span><div><small>{s.category}{s.status?' / '+s.status:''}</small><h2>{s.name}</h2></div></div><Diagram entry={s}/>{s.id==='enjo'&&<EnjomePreview paused={!visible||selected!==null}/>} {s.id==='hyoketsu'&&<HyoketsuBurstPreview paused={!visible||selected!==null}/>}<dl><dt>発動条件</dt><dd>{s.condition}</dd><dt>効果</dt><dd>{s.effect}</dd></dl><p className="skill-tip">{s.tip}</p><button onClick={e=>{opener.current=e.currentTarget;setSelected(i);setRun(0);setPracticeFever(false);}}>{s.id==='enjo'?'⚔ エンジョーボムと模擬戦':s.id==='hyoketsu'||s.id==='you456'?'⚔ 模擬戦':'▶ お手本・模擬戦'}</button></article>)}</div>
 <footer>新しい技はこの図鑑へ追加していきます。ヒョーケツボムは現行のヒョーケツメによる時限爆発の確認用呼称です。</footer>
 {selected!==null&&<section className="skill-practice" role="dialog" aria-modal="true" aria-label={SKILL_ENTRIES[selected].id==='enjo'?'エンジョーボムのデザインデモ':'ヒッサツメ模擬戦'}><div className="skill-practice-controls"><button ref={closeButton} onClick={close}>一覧に戻る</button><select aria-label="確認するヒッサツメ" value={selected} onChange={e=>{setSelected(Number(e.target.value));setRun(0);setPracticeFever(false);}}>{SKILL_ENTRIES.map((s,i)=><option key={s.id} value={i}>{s.name}</option>)}</select>{(isYou456||SKILL_ENTRIES[selected].id==='enjo')&&<button aria-pressed={practiceFever} onClick={()=>setPracticeFever(value=>!value)}>FEVERで試す</button>}{SKILL_ENTRIES[selected].id==='enjo'&&<button onClick={()=>setEnjoWalls(v=>v===2?3:2)}>壁：{enjoWalls}段</button>}<button onClick={()=>setRun(n=>n+1)}>最初から</button></div><p>{SKILL_ENTRIES[selected].id==='enjo'?'実プレイ模擬戦。隣接7消しで全段解除→炎をタップ→次の落下で発動。7列盤の外側は範囲を切り捨てます。':isYou456?'光る4→5→6をなぞる。起点から十字方向へ貫く。':SKILL_ENTRIES[selected].id==='hyoketsu'?'コイツメ・ダーメ・ヒョーケツメの混成戦。隣接する7消しで解凍。':'習得ステージのお手本→練習で、発動の形と実際の効果を確認できます。'}</p>{visible&&<iframe ref={practiceFrame} key={`${selected}-${run}-${practiceFever}-${enjoWalls}`} title={SKILL_ENTRIES[selected].name+'のお手本・模擬戦'} src={practiceUrl}/>}</section>}
 </main>;
}
createRoot(document.getElementById('root')!).render(<SkillsGallery/>);
