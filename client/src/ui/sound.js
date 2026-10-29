/** Sonido ambiente generado con Web Audio (sin archivos externos): zumbido grave + "whoosh" en transiciones. */
export function createSound() {
  let ctx = null;
  let master = null;
  let enabled = false;

  function start() {
    if (ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    filter.Q.value = 3;
    const drone = ctx.createGain();
    drone.gain.value = 0.07;
    filter.connect(drone).connect(master);
    [55, 55.4, 82.4].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.connect(filter);
      osc.start();
    });
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
  }

  function setEnabled(value) {
    enabled = value;
    if (value) start();
    if (!ctx) return;
    if (value) ctx.resume();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.linearRampToValueAtTime(value ? 0.6 : 0, ctx.currentTime + 0.6);
  }

  function whoosh() {
    if (!enabled || !ctx) return;
    const length = ctx.sampleRate * 1.1;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 1.2;
    band.frequency.setValueAtTime(180, ctx.currentTime);
    band.frequency.exponentialRampToValueAtTime(2800, ctx.currentTime + 0.9);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.25);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.1);
    src.connect(band).connect(gain).connect(master);
    src.start();
  }

  function blip() {
    if (!enabled || !ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 1240;
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  return { setEnabled, whoosh, blip, get enabled() { return enabled; } };
}
