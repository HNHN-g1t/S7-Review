export type EnjoPhase='wall'|'breakUpper'|'middle'|'breakMiddle'|'lower'|'breakLower'|'ready'|'hover'|'drop'|'blast'|'done';
export function enjoRange(fever:boolean){return (fever?[9,7,5,3,1]:[7,5,3,1]).flatMap((width,row)=>Array.from({length:width},(_,i)=>({x:4-Math.floor(width/2)+i,y:8-row})));}
export const ENJO_STEPS:EnjoPhase[]=['wall','breakUpper','lower','breakLower','ready','hover','drop','blast','done'];
export const ENJO_LABELS:Record<EnjoPhase,string>={wall:'① 黒い上下の壁で封印：上部を除去',breakUpper:'上部の壁が砕け、炎が光る',middle:'中段の壁を解除：全段解除まで起動不可',breakMiddle:'中段の壁が砕ける',breakLower:'下部の壁が砕け、炎を解放',lower:'② 上部除去済み：下部の壁を除去',ready:'③ 壁解除：炎の本体をタップ',hover:'④ 炎のまま上空待機：次の落下で発動',drop:'⑤ 炎の本体が急降下',blast:'⑥ 着弾・ピラミッド状に焼き払う',done:'デモ終了：もう一度確認できます'};

export function enjoDemoOccupied(x:number,y:number,phase:EnjoPhase,rows:2|3=2){if(y<4)return false;if(x===4&&(y===5||y===6||(rows===3&&y===4)))return false;if(x===4&&phase==='drop'&&(y===7||y===8))return false;return true;}

export function enjoSteps(rows:2|3):EnjoPhase[]{return rows===3?[...ENJO_STEPS.slice(0,2),'middle','breakMiddle',...ENJO_STEPS.slice(2)]:ENJO_STEPS;}
