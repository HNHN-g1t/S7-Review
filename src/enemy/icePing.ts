// Shared crystalline "pi-keen". Called only after an explicit sound-enabled user setting.
export function playIcePing(ctx:AudioContext,destination:AudioNode){
 const now=ctx.currentTime;
 [1568,2352,3136,4704].forEach((frequency,i)=>{
  const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(frequency*.87,now);osc.frequency.exponentialRampToValueAtTime(frequency,now+.035);
  gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.075/(i+1),now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+.4);
  osc.connect(gain);gain.connect(destination);osc.start(now);osc.stop(now+.42);osc.onended=()=>{osc.disconnect();gain.disconnect();};
 });
}

// Eight short filtered air sweeps, one per freezing cell: "shui-shui-shui...".
export function playIceFreeze(ctx:AudioContext,destination:AudioNode){
 for(let i=0;i<8;i++){
  const at=ctx.currentTime+i*.125,noise=ctx.createBufferSource(),buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.12),ctx.sampleRate),data=buffer.getChannelData(0);
  let seed=37+i;for(let j=0;j<data.length;j++){seed=(seed*16807)%2147483647;data[j]=(seed/2147483647*2-1);}
  noise.buffer=buffer;const filter=ctx.createBiquadFilter(),gain=ctx.createGain();filter.type='bandpass';filter.Q.value=2.5;filter.frequency.setValueAtTime(900,at);filter.frequency.exponentialRampToValueAtTime(6200,at+.11);
  gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.12,at+.025);gain.gain.exponentialRampToValueAtTime(.0001,at+.12);
  noise.connect(filter);filter.connect(gain);gain.connect(destination);noise.start(at);noise.stop(at+.12);noise.onended=()=>{noise.disconnect();filter.disconnect();gain.disconnect();};
 }
}
// Bright glass attack followed by a shimmering metallic tail: "sharriiin".
export function playIceCrash(ctx:AudioContext,destination:AudioNode){
 const at=ctx.currentTime;
 [2150,2873,3917,5480,7290].forEach((f,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(f*1.12,at);osc.frequency.exponentialRampToValueAtTime(f,at+.08);gain.gain.setValueAtTime(.065/(1+i*.45),at);gain.gain.exponentialRampToValueAtTime(.0001,at+.58);osc.connect(gain);gain.connect(destination);osc.start(at);osc.stop(at+.6);osc.onended=()=>{osc.disconnect();gain.disconnect();};});
 const noise=ctx.createBufferSource(),buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.18),ctx.sampleRate),data=buffer.getChannelData(0);let seed=71;for(let j=0;j<data.length;j++){seed=(seed*16807)%2147483647;data[j]=seed/2147483647*2-1;}noise.buffer=buffer;
 const filter=ctx.createBiquadFilter(),gain=ctx.createGain();filter.type='highpass';filter.frequency.value=3200;gain.gain.setValueAtTime(.16,at);gain.gain.exponentialRampToValueAtTime(.0001,at+.18);noise.connect(filter);filter.connect(gain);gain.connect(destination);noise.start(at);noise.stop(at+.18);noise.onended=()=>{noise.disconnect();filter.disconnect();gain.disconnect();};
}
