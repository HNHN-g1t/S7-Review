import {CAMPAIGN_MISSIONS,wallUnlocked,wallUnlockHint} from '../story/wall1';
export type Position={x:number;y:number};
export type Layout=Record<number,Position>;
export {WALL_ONE_LAYOUT as DEFAULT_LAYOUT} from '../story/wallOneLayout';
import {WALL_ONE_LAYOUT as DEFAULT_LAYOUT} from '../story/wallOneLayout';
export const MAP_STAGES=[{stage:0,number:'0',title:'はじまりの練習',theme:'となり合うサイで7を作ろう',context:'サイカといっしょに、最初の一歩。',kind:'lesson',optional:false},...CAMPAIGN_MISSIONS.filter(m=>m.wall===1)];
export function mapState(stage:number,cleared:number[],allOpen:boolean){return cleared.includes(stage)?'cleared':allOpen||wallUnlocked(stage,cleared)?'open':'locked';}
export function unlockText(stage:number,cleared:number[]){return wallUnlockHint(stage,cleared);}
export function readLayout(raw:string|null):Layout{const next=structuredClone(DEFAULT_LAYOUT);if(!raw)return next;try{const data=JSON.parse(raw);for(const key of Object.keys(next)){const p=data[key];if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100)next[Number(key)]={x:p.x,y:p.y};}}catch{/* Keep canonical coordinates if old review data is invalid. */}return next;}
export function exportMapReview(layout:Layout,note:string){return '本マップ：ウォール1\n修正メモ：'+(note.trim()||'なし')+'\n配置（画像左上を0%,0%とした中心座標）：\n'+JSON.stringify(readLayout(JSON.stringify(layout)),null,2);}
