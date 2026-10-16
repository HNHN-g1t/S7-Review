// 登場中の1段のプレス。「ドッ」の丸い低音に「キュッ」の澄んだ高域を重ねる。
// 136ms間隔で続いても尾を引かない。外部音源・残響・毎回のoscillator生成は不要。
export const HIDOIME_CRUSH_SECONDS = 0.18;
const MIN_INTERVAL_SECONDS = 0.06;
const MAX_VOICES = 2;

export function makeHidoimeCrushSamples(sampleRate: number): Float32Array {
  const samples = new Float32Array(Math.ceil(sampleRate * HIDOIME_CRUSH_SECONDS));
  const tau = Math.PI * 2;
  // 指数スイープの位相を積分。低域の2倍音を少し足し、小さいスピーカーにも芯を残す。
  const phase = (t: number, from: number, to: number, decay: number) =>
    tau * (to * t + (from - to) * decay * (1 - Math.exp(-t / decay)));
  for (let i = 0; i < samples.length; i += 1) {
    const t = i / sampleRate;
    const attack = Math.sin(Math.min(1, t / 0.004) * Math.PI / 2) ** 2;
    const tail = Math.min(1, Math.max(0, (HIDOIME_CRUSH_SECONDS - t) / 0.025)) ** 2;
    const low = phase(t, 185, 76, 0.026);
    const high = phase(t, 1680, 1120, 0.018);
    const body = (Math.sin(low) * 0.39 + Math.sin(low * 2) * 0.085) * Math.exp(-t / 0.038);
    // 正弦波だけの完全5度。高域は35msほどでほどけ、ざらつき・刺さる倍音を避ける。
    const sparkle = (Math.sin(high) * 0.17 + Math.sin(high * 1.5) * 0.06) * Math.exp(-t / 0.027);
    samples[i] = (body + sparkle) * attack * tail;
  }
  return samples;
}

export function createHidoimeCrushSound() {
  let context: AudioContext | null = null;
  let buffer: AudioBuffer | null = null;
  let lastAt = -Infinity;
  const voices = new Set<AudioBufferSourceNode>();
  const release = (source: AudioBufferSourceNode) => {
    source.onended = null;
    source.disconnect();
    voices.delete(source);
  };
  const stop = () => {
    voices.forEach(source => {
      source.stop();
      release(source);
    });
    lastAt = -Infinity;
  };
  const onStateChange = () => {
    if (context?.state !== 'running') stop();
  };
  return {
    stop,
    play(ctx: AudioContext, destination: AudioNode) {
      // resumeを待って予約しない。解除前・中断中のプレスは捨て、後からまとめて鳴らさない。
      if (ctx.state !== 'running') return;
      if (context !== ctx) {
        stop();
        context?.removeEventListener('statechange', onStateChange);
        context = ctx;
        context.addEventListener('statechange', onStateChange);
        const samples = makeHidoimeCrushSamples(ctx.sampleRate);
        buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
        buffer.getChannelData(0).set(samples);
      }
      const at = ctx.currentTime;
      // 1段に複数のサイがあっても1音。多重呼出でもノード数と合成音量を制限する。
      if (at - lastAt < MIN_INTERVAL_SECONDS) return;
      while (voices.size >= MAX_VOICES) {
        const oldest = voices.values().next().value!;
        oldest.stop();
        release(oldest);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(destination);
      source.onended = () => release(source);
      voices.add(source);
      lastAt = at;
      source.start(at);
    },
  };
}
