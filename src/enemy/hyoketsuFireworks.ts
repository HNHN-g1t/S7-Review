export const HYOKETSU_BURST_MS = 2000;
const COLORS = ['#ff5fa2','#5ee7ff','#ffc94d','#9aff67','#b892ff','#ff814d'];
// Coordinates are in cells within a fixed 3×3 square. Only filled circles are emitted.
export function hyoketsuFireworksAt(ms: number) {
 const circles: Array<{x:number;y:number;r:number;alpha:number;color:string}>=[];
 if(ms<0||ms>=HYOKETSU_BURST_MS)return circles;
 for(let wave=0;wave<25;wave++) {
  const born=wave*80,life=Math.min(500,HYOKETSU_BURST_MS-born),age=ms-born;
  if(age<0||age>=life)continue;
  const progress=age/life;
  for(let j=0;j<10;j++){
   const seed=wave*10+j,angle=j*Math.PI/5+wave*2.39996;
   const distance=progress*(.75+(seed%5)*.12),r=(.035+(seed%3)*.015)*(1-progress*.65);
   const ox=1.5+Math.sin(wave*2.1)*.23,oy=1.5+Math.cos(wave*1.7)*.23;
   circles.push({x:Math.max(r,Math.min(3-r,ox+Math.cos(angle)*distance)),y:Math.max(r,Math.min(3-r,oy+Math.sin(angle)*distance+progress*progress*.12)),r,alpha:Math.min(1,(1-progress)*1.8),color:COLORS[seed%COLORS.length]});
  }
 }
 return circles;
}
