import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SKILL_ENTRIES, skillPracticeUrl, type SkillEntry } from './skillCatalogue';
import { HyoketsumeDice } from './enemy/HyoketsumeDice';
import './skillsGallery.css';
const pips=[[4],[0,8],[0,4,8],[0,2,6,8],[0,2,4,6,8],[0,2,3,5,6,8]];
const colors=['#fc6dac','#8b46d2','#43ae39','#43ae39','#8b46d2','#fc6dac'];
function Diagram({entry}:{entry:SkillEntry}) {
 return <figure className="skill-demo"><div className={`skill-grid ${entry.id==='rainbow'?'tall':''}`} role="img" aria-label={entry.caption}>{entry.diagram.flatMap((row,y)=>[...row].map((v,x)=><span key={`${x}-${y}`} className={`skill-cell ${v==='*'?'effect':''}`}>
 {/[1-6]/.test(v)?<span className="skill-die" style={{background:colors[Number(v)-1]}}>{Array.from({length:9},(_,i)=><i key={i} style={{opacity:pips[Number(v)-1].includes(i)?1:0,background:Number(v)===2||Number(v)===5?'#330066':'#fff'}}/>)}</span>:v==='n'?<span className="skill-die skill-nico">{Array.from({length:9},(_,i)=><i key={i} style={{opacity:pips[x%2?4:1].includes(i)?1:0}}/>)}</span>:v==='b'?<HyoketsumeDice cell={{value:3,kind:'bomb',fuse:1}}/>:null}
 </span>))}</div><figcaption>{entry.caption}</figcaption></figure>;
}
function SkillsGallery() {
 const [selected,setSelected]=useState<number|null>(null),[run,setRun]=useState(0);
 const [visible,setVisible]=useState(true);
 const opener=useRef<HTMLButtonElement|null>(null),closeButton=useRef<HTMLButtonElement|null>(null);
 const close=()=>{setSelected(null);opener.current?.focus();};
 useEffect(()=>{
 const receive=(e:MessageEvent)=>{if(e.origin!==location.origin)return;if(e.source===parent&&e.data?.type==='sainome-review-visible')setVisible(!!e.data.visible);};
 window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
 },[]);
 useEffect(()=>{if(selected===null)return;closeButton.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[selected]);
 return <main className="skills-gallery">
 <header><a href="/review.html" target="_top">← 仕様書に戻る</a><small>SAINOME SEVEN / DESIGN REVIEW</small><h1>ヒッサツメ図鑑</h1><p>発動条件・効果・形をまとめて確認。静止図は仕組みを示す模式図です。各技のお手本・模擬戦は、消音・保存分離した実ゲームで確認できます。</p></header>
 <nav aria-label="ヒッサツメの目次">{SKILL_ENTRIES.map((s,i)=><a key={s.id} href={'#skill-'+s.id}>{String(i+1).padStart(2,'0')} {s.name}</a>)}</nav>
 <div className="skills-list">{SKILL_ENTRIES.map((s,i)=><article id={'skill-'+s.id} key={s.id}><div className="skill-heading"><span>{String(i+1).padStart(2,'0')}</span><div><small>{s.category}{s.status?' / '+s.status:''}</small><h2>{s.name}</h2></div></div><Diagram entry={s}/><dl><dt>発動条件</dt><dd>{s.condition}</dd><dt>効果</dt><dd>{s.effect}</dd></dl><p className="skill-tip">{s.tip}</p><button onClick={e=>{opener.current=e.currentTarget;setSelected(i);setRun(0);}}>{s.id==='hyoketsu'?'⚔ 模擬戦':'▶ お手本・模擬戦'}</button></article>)}</div>
 <footer>新しい技はこの図鑑へ追加していきます。ヒョーケツボムは現行のヒョーケツメによる時限爆発の確認用呼称です。</footer>
 {selected!==null&&<section className="skill-practice" role="dialog" aria-modal="true" aria-label="ヒッサツメ模擬戦"><div className="skill-practice-controls"><button ref={closeButton} onClick={close}>一覧に戻る</button><select aria-label="確認するヒッサツメ" value={selected} onChange={e=>{setSelected(Number(e.target.value));setRun(0);}}>{SKILL_ENTRIES.map((s,i)=><option key={s.id} value={i}>{s.name}</option>)}</select><button onClick={()=>setRun(n=>n+1)}>最初から</button></div><p>{SKILL_ENTRIES[selected].id==='hyoketsu'?'コイツメ・ダーメ・ヒョーケツメの混成戦。隣接する7消しで解凍。':'習得ステージのお手本→練習で、発動の形と実際の効果を確認できます。'}</p>{visible&&<iframe key={`${selected}-${run}`} title={SKILL_ENTRIES[selected].name+'のお手本・模擬戦'} src={skillPracticeUrl(SKILL_ENTRIES[selected])}/>}</section>}
 </main>;
}
createRoot(document.getElementById('root')!).render(<SkillsGallery/>);
