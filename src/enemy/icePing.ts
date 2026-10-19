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
export function playIceCrash(ctx:AudioContext,out:AudioNode){
 const at=ctx.currentTime;
 tone(ctx,out,160,48,at,.22,.1,'triangle');frost(ctx,out,at,.15,.11,6200,2400);
 [1320,1987,2780,3760,4930].forEach((f,i)=>tone(ctx,out,f*1.035,f,at,.96+i*.035,.045/(1+i*.5)));
 [1760,2640,3520].forEach((f,i)=>tone(ctx,out,f,f*1.004,at+.48+i*.08,.42,.018/(i+1)));
}
