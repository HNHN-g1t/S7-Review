import {CAMPAIGN_MISSIONS,wallUnlocked,wallUnlockHint} from '../story/wall1';
export type Position={x:number;y:number};
export type Layout=Record<number,Position>;
export const DEFAULT_LAYOUT:Layout={0:{x:13.8,y:83.1},20:{x:35.2,y:77.8},21:{x:16.2,y:53.5},22:{x:60.6,y:65.8},23:{x:36.3,y:53.5},24:{x:16.1,y:37.7},25:{x:88.2,y:48.7},26:{x:32,y:17.3},27:{x:87.7,y:79.3}};
export const MAP_STAGES=[{stage:0,number:'0',title:'はじまりの練習',theme:'となり合うサイで7を作ろう',context:'サイカといっしょに、最初の一歩。',kind:'lesson',optional:false},...CAMPAIGN_MISSIONS.filter(m=>m.wall===1)];
export function mapState(stage:number,cleared:number[],allOpen:boolean){return cleared.includes(stage)?'cleared':allOpen||wallUnlocked(stage,cleared)?'open':'locked';}
export function unlockText(stage:number,cleared:number[]){return wallUnlockHint(stage,cleared);}
export function readLayout(raw:string|null):Layout{const next=structuredClone(DEFAULT_LAYOUT);if(!raw)return next;try{const data=JSON.parse(raw);for(const key of Object.keys(next)){const p=data[key];if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100)next[Number(key)]={x:p.x,y:p.y};}}catch{/* Keep canonical coordinates if old review data is invalid. */}return next;}
export function exportMapReview(layout:Layout,note:string){return '本マップ：ウォール1\n修正メモ：'+(note.trim()||'なし')+'\n配置（画像左上を0%,0%とした中心座標）：\n'+JSON.stringify(layout,null,2);}
