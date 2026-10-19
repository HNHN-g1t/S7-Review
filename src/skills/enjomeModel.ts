export type EnjoPhase='wall'|'ready'|'hover'|'drop'|'blast'|'done';
export function enjoRange(fever:boolean){return (fever?[9,7,5,3,1]:[7,5,3,1]).flatMap((width,row)=>Array.from({length:width},(_,i)=>({x:4-Math.floor(width/2)+i,y:8-row})));}
export const ENJO_STEPS:EnjoPhase[]=['wall','ready','hover','drop','blast','done'];
export const ENJO_LABELS:Record<EnjoPhase,string>={wall:'① 壁で封印：隣接セヴン目で解除',ready:'② タップ可能：ボムをタップ',hover:'③ 上空で待機：次のサイの落下を待つ',drop:'④ 急降下：最下段へ着弾',blast:'⑤ 下からピラミッド状に焼き払う',done:'デモ終了：もう一度確認できます'};
