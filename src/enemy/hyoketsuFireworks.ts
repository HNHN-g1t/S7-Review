export const HYOKETSU_BURST_MS = 2600;
// Counterclockwise from the top: top, upper-left, left, lower-left, bottom, lower-right, right, upper-right.
export const HYOKETSU_RING = [{x:1,y:0},{x:0,y:0},{x:0,y:1},{x:0,y:2},{x:1,y:2},{x:2,y:2},{x:2,y:1},{x:2,y:0}];
export function hyoketsuIceState(ms:number){
 const phase=ms<1000?'freeze':ms<1400?'sweep':ms<2000?'shatter':ms<2600?'afterglow':'done';
 return {phase,frozen:Math.max(0,Math.min(8,Math.floor(ms/125))),progress:phase==='freeze'?Math.max(0,ms/1000):phase==='sweep'?(ms-1000)/400:phase==='shatter'?(ms-1400)/600:1};
}
