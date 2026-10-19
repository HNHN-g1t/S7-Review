// Synthesized ice: restrained cold pulses, crystalline sweep, low impact and glass tail.
function tone(ctx:AudioContext,out:AudioNode,f:number,to:number,at:number,life:number,volume:number,type:OscillatorType='sine'){
 const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(f,at);osc.frequency.exponentialRampToValueAtTime(to,at+.06);
 gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(volume,at+.006);gain.gain.exponentialRampToValueAtTime(.0001,at+life);
 osc.connect(gain);gain.connect(out);osc.start(at);osc.stop(at+life+.02);osc.onended=()=>{osc.disconnect();gain.disconnect();};
}
function frost(ctx:AudioContext,out:AudioNode,at:number,life:number,volume:number,from:number,to:number){
 const noise=ctx.createBufferSource(),buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*life),ctx.sampleRate),data=buffer.getChannelData(0);let seed=71;
 for(let i=0;i<data.length;i++){seed=seed*16807%2147483647;data[i]=seed/2147483647*2-1;}noise.buffer=buffer;
 const filter=ctx.createBiquadFilter(),gain=ctx.createGain();filter.type='bandpass';filter.Q.value=4;filter.frequency.setValueAtTime(from,at);filter.frequency.exponentialRampToValueAtTime(to,at+life*.8);
 gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(volume,at+.008);gain.gain.exponentialRampToValueAtTime(.0001,at+life);
 noise.connect(filter);filter.connect(gain);gain.connect(out);noise.start(at);noise.stop(at+life);noise.onended=()=>{noise.disconnect();filter.disconnect();gain.disconnect();};
}
export function playIcePing(ctx:AudioContext,out:AudioNode){
 [1175,1760,2350,3520].forEach((f,i)=>tone(ctx,out,f*.8,f,ctx.currentTime+i*.018,.32,.045/(i+1)));
}
export function playIceFreeze(ctx:AudioContext,out:AudioNode){
 for(let i=0;i<8;i++){const at=ctx.currentTime+i*.125;frost(ctx,out,at,.1,.055,3600,1100);tone(ctx,out,740+i*82,520+i*64,at,.09,.035);}
 tone(ctx,out,110,65,ctx.currentTime,.9,.055,'triangle');
}
const hallImpulses=new WeakMap<AudioContext,AudioBuffer>();
export function playIceCrash(ctx:AudioContext,out:AudioNode){
 const at=ctx.currentTime,send=ctx.createGain(),reverb=ctx.createConvolver(),wet=ctx.createGain();
 let impulse=hallImpulses.get(ctx);
 if(!impulse){
  impulse=ctx.createBuffer(2,Math.ceil(ctx.sampleRate*2.8),ctx.sampleRate);
  for(let ch=0;ch<2;ch++){const data=impulse.getChannelData(ch);let seed=311+ch*173,soft=0;
   for(let i=0;i<data.length;i++){seed=seed*16807%2147483647;soft=soft*.72+(seed/2147483647*2-1)*.28;const t=i/ctx.sampleRate;data[i]=soft*Math.exp(-t*2.8)*(1-Math.exp(-t*70));}
  }hallImpulses.set(ctx,impulse);
 }
 reverb.buffer=impulse;send.gain.value=.7;wet.gain.value=.34;send.connect(out);send.connect(reverb);reverb.connect(wet);wet.connect(out);
 // Stable, gently detuned glass modes: no descending comic low-pitch attack.
 frost(ctx,send,at,.065,.045,7800,4900);
 [1480,2220,2963,3950,5180,6630].forEach((f,i)=>tone(ctx,send,f,f*(1+(i%2?.0007:-.0006)),at+i*.003,1.65+i*.07,.038/(1+i*.55)));
 // Audio-clock cleanup follows suspension/resume, so pausing never truncates the hall tail.
 const clock=ctx.createOscillator(),silence=ctx.createGain();silence.gain.value=0;clock.connect(silence);silence.connect(out);clock.start(at);clock.stop(at+5.2);clock.onended=()=>{clock.disconnect();silence.disconnect();send.disconnect();reverb.disconnect();wet.disconnect();};
}
