export type SanzCell = {x:number;y:number};
export const SANZ_CELLS: SanzCell[] = [5,3,1].flatMap((count,row)=>Array.from({length:count},(_,i)=>({x:1+(5-count)/2+i,y:11-row})));
export const sanzKey = (p:SanzCell)=>`${p.x},${p.y}`;
export const SANZ_EYE = {x:3,y:11};
export type SanzAttack = 'seven'|'sla3'|'str6'|'thunder';
export function sanzEruptionScale(elapsed:number):number {
  const keys=[[0,1],[180,.8],[360,1.16],[900,1]];
  if(elapsed<=0||elapsed>=900)return 1;
  const i=keys.findIndex(key=>key[0]>=elapsed);
  const [start,from]=keys[i-1], [end,to]=keys[i];
  const ease=(1-Math.cos(Math.PI*(elapsed-start)/(end-start)))/2;
  return from+(to-from)*ease;
}
export function hitSanz(cells:SanzCell[], range:SanzCell[], attack:SanzAttack) {
  const hit=new Set(range.map(sanzKey));
  const defeated=attack!=='seven' && hit.has(sanzKey(SANZ_EYE));
  const removed=defeated ? cells : cells.filter(p=>p.x!==3 && hit.has(sanzKey(p)));
  return {defeated,removed,remaining:cells.filter(p=>!removed.some(q=>sanzKey(p)===sanzKey(q)))};
}
export function sanzRange(target:SanzCell,attack:SanzAttack):SanzCell[] {
  if(attack==='seven')return [target];
  return Array.from({length:14},(_,y)=>({x:attack==='sla3'?target.x+y-target.y:target.x,y})).filter(p=>p.x>=0&&p.x<7);
}
