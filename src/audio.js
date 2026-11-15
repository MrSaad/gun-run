// Music playback + procedurally synthesised sound effects (no extra asset files).
export function createAudio(url) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC({ latencyHint: 'interactive' });
  const master = ctx.createGain(); master.connect(ctx.destination);
  const musicGain = ctx.createGain(); musicGain.gain.value = 0.9; musicGain.connect(master);
  const sfxGain = ctx.createGain(); sfxGain.gain.value = 0.8; sfxGain.connect(master);

  let song = null, source = null;
  const ready = fetch(url)
    .then((r) => { if (!r.ok) throw new Error('song fetch failed: ' + r.status); return r.arrayBuffer(); })
    .then((buf) => ctx.decodeAudioData(buf))
    .then((b) => { song = b; });

  const sr = ctx.sampleRate;
  const synth = (dur, fn) => {
    const b = ctx.createBuffer(1, Math.floor(dur * sr), sr);
    const d = b.getChannelData(0);
    let ph = 0, lp = 0;
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      const o = fn(t, (f) => { ph += (2 * Math.PI * f) / sr; return Math.sin(ph); }, (x, k) => (lp += (x - lp) * k));
      d[i] = Math.max(-1, Math.min(1, o));
    }
    return b;
  };
  const noise = () => Math.random() * 2 - 1;
  const buffers = {
    pistol: synth(0.3, (t, osc, lpf) => noise() * Math.exp(-t * 26) * 0.8 + osc(170 * Math.exp(-t * 14) + 45) * Math.exp(-t * 15) * 0.9 + lpf(0, 1)),
    uzi: synth(0.11, (t, osc) => noise() * Math.exp(-t * 55) * 0.7 + osc(230 * Math.exp(-t * 30) + 70) * Math.exp(-t * 40) * 0.7),
    boom: synth(0.8, (t, osc, lpf) => lpf(noise(), 0.03 + 0.5 * Math.exp(-t * 9)) * Math.exp(-t * 5.5) * 1.6 + osc(75 * Math.exp(-t * 5) + 28) * Math.exp(-t * 7) * 0.9),
    hit: synth(0.35, (t, osc) => Math.sign(osc(95)) * Math.exp(-t * 9) * 0.5 + noise() * Math.exp(-t * 20) * 0.5),
    power: synth(0.6, (t, osc) => osc(220 + t * 900) * Math.min(1, t * 20) * Math.exp(-t * 4) * 0.5),
  };

  function sfx(name, vol = 1, rate = 1) {
    if (ctx.state !== 'running') return;
    const s = ctx.createBufferSource(); s.buffer = buffers[name]; s.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = vol;
    s.connect(g); g.connect(sfxGain); s.start();
  }

  // Start the song so that song-time `offset` lands at ctx time `when`.
  function playSong(when, offset = 0) {
    stopSong();
    if (!song) return;
    source = ctx.createBufferSource(); source.buffer = song; source.connect(musicGain);
    source.start(Math.max(ctx.currentTime, when), Math.max(0, offset));
  }
  function stopSong() {
    if (source) { try { source.stop(); } catch (e) { /* not started */ } source.disconnect(); source = null; }
  }
  const latency = () => Math.min(0.25, (ctx.outputLatency || 0) + (ctx.baseLatency || 0));

  return { ctx, ready, sfx, playSong, stopSong, latency, get loaded() { return !!song; } };
}
