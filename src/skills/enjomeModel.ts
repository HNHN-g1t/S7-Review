export type EnjoPhase='wall'|'breakUpper'|'lower'|'breakLower'|'ready'|'hover'|'drop'|'blast'|'done';
export function enjoRange(fever:boolean){return (fever?[9,7,5,3,1]:[7,5,3,1]).flatMap((width,row)=>Array.from({length:width},(_,i)=>({x:4-Math.floor(width/2)+i,y:8-row})));}
export const ENJO_STEPS:EnjoPhase[]=['wall','breakUpper','lower','breakLower','ready','hover','drop','blast','done'];
export const ENJO_LABELS:Record<EnjoPhase,string>={wall:'① 黒い上下の壁で封印：上部を除去',breakUpper:'上部の壁が砕け、炎が光る',breakLower:'下部の壁が砕け、炎を解放',lower:'② 上部除去済み：下部の壁を除去',ready:'③ 壁解除：炎の本体をタップ',hover:'④ 炎のまま上空待機：次の落下で発動',drop:'⑤ 炎の本体が急降下',blast:'⑥ 着弾・ピラミッド状に焼き払う',done:'デモ終了：もう一度確認できます'};
