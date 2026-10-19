// Four branched fracture patterns, normalized to one cell. Two distinct patterns per tile.
export const ICE_CRACKS = [
 [[[.07,0],[.24,.28],[.17,.57],[.34,.78]],[[.24,.28],[.52,.22],[.67,.05]],[[.17,.57],[0,.69]]],
 [[[1,.19],[.76,.34],[.69,.61],[.85,.91]],[[.76,.34],[.49,.44],[.38,.27]],[[.69,.61],[.49,.74]]],
 [[[.24,1],[.37,.77],[.55,.68],[.48,.43]],[[.37,.77],[.14,.72],[.03,.84]],[[.55,.68],[.79,.72],[1,.58]]],
 [[[.72,0],[.64,.24],[.43,.36],[.32,.57]],[[.43,.36],[.2,.29],[0,.38]],[[.64,.24],[.85,.37],[.94,.53]]]
];
export function iceCrackPair(seed:number){const a=((seed%4)+4)%4;return [a,(a+1+Math.floor(Math.abs(seed)/4)%3)%4];}

// Filled ribbons taper to a sharp tip; deterministic 1-in-5 heavy fractures.
export function iceCrackRibbon(line:number[][],seed:number,branch:number){
 const width=(branch?.009:.022)*(Math.abs(seed)%5===0?2.4:1);
 const left:number[][]=[],right:number[][]=[];
 line.forEach(([x,y],i)=>{const prev=line[Math.max(0,i-1)],next=line[Math.min(line.length-1,i+1)];const dx=next[0]-prev[0],dy=next[1]-prev[1],len=Math.hypot(dx,dy)||1;
 const half=i===line.length-1?0:width*.5*(1-i/line.length*.55);
 left.push([x-dy/len*half,y+dx/len*half]);right.push([x+dy/len*half,y-dx/len*half]);});
 return [...left,...right.reverse()];
}
