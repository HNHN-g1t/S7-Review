// Shared crystalline "pi-keen". Called only after an explicit sound-enabled user setting.
export function playIcePing(ctx:AudioContext,destination:AudioNode){
 const now=ctx.currentTime;
 [1568,2352,3136,4704].forEach((frequency,i)=>{
  const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(frequency*.87,now);osc.frequency.exponentialRampToValueAtTime(frequency,now+.035);
  gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.075/(i+1),now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+.4);
  osc.connect(gain);gain.connect(destination);osc.start(now);osc.stop(now+.42);osc.onended=()=>{osc.disconnect();gain.disconnect();};
 });
}
