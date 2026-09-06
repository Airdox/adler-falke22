/**
 * Realistic Iron & Heavy Metal Acoustic Sound Synthesizer
 * Built using the Web Audio API without external audio file dependencies.
 * Synthesizes authentic cast-iron strikes, metallic ringing modes, heavy iron switches, and taps.
 */

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

let soundVolume = 0.85;
let soundEnabled = true;

export function setIronSoundVolume(volume: number) {
  soundVolume = Math.max(0, Math.min(1, volume));
}

export function getIronSoundVolume(): number {
  return soundVolume;
}

export function setIronSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
}

export function isIronSoundEnabled(): boolean {
  return soundEnabled;
}

/**
 * Plays a massive, resonant cast-iron strike / anvil clang
 * Simulates heavy iron mass impact, inharmonic modal resonances, and metallic sustain.
 */
export function playIronClang(intensity: number = 1.0) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(soundVolume * intensity, now);
  masterGain.connect(ctx.destination);

  // 1. Heavy physical iron impact thud (low-frequency body resonance)
  const thudOsc = ctx.createOscillator();
  const thudGain = ctx.createGain();
  thudOsc.type = 'triangle';
  thudOsc.frequency.setValueAtTime(140, now);
  thudOsc.frequency.exponentialRampToValueAtTime(45, now + 0.18);
  thudGain.gain.setValueAtTime(0.7, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  thudOsc.connect(thudGain);
  thudGain.connect(masterGain);
  thudOsc.start(now);
  thudOsc.stop(now + 0.25);

  // 2. High metallic impact transient (hammer on iron click)
  const noiseBufferSize = Math.floor(ctx.sampleRate * 0.04);
  const noiseBuffer = ctx.createBuffer(1, noiseBufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseBufferSize; i++) {
    noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (noiseBufferSize * 0.2));
  }
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(4200, now);
  noiseFilter.Q.setValueAtTime(3.5, now);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.8, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(masterGain);
  noiseSource.start(now);

  // 3. Resonant inharmonic iron modes (characteristic cast-iron acoustics)
  // Real cast iron modal ratios are non-harmonic: ~1.0, 2.32, 4.14, 6.78, 9.4
  const fundamental = 260; // Hz for heavy microphone housing
  const modes = [
    { freq: fundamental * 1.0, q: 35, amp: 0.6, decay: 1.4 },
    { freq: fundamental * 2.38, q: 45, amp: 0.5, decay: 1.1 },
    { freq: fundamental * 4.12, q: 55, amp: 0.4, decay: 0.8 },
    { freq: fundamental * 6.65, q: 60, amp: 0.25, decay: 0.5 },
    { freq: fundamental * 9.21, q: 70, amp: 0.15, decay: 0.35 },
    { freq: fundamental * 12.8, q: 80, amp: 0.1, decay: 0.2 },
  ];

  modes.forEach((mode) => {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Slight detune for raw iron roughness
    osc.frequency.setValueAtTime(mode.freq * (1 + (Math.random() * 0.02 - 0.01)), now);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(mode.freq, now);
    filter.Q.setValueAtTime(mode.q, now);

    gain.gain.setValueAtTime(mode.amp, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + mode.decay);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + mode.decay + 0.05);
  });
}

/**
 * Plays a heavy mechanical iron switch toggle sound (latching an industrial switch)
 */
export function playIronSwitch(engage: boolean = true) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(soundVolume * 0.9, now);
  masterGain.connect(ctx.destination);

  // Micro-click 1: mechanical contact strike
  const clickOsc1 = ctx.createOscillator();
  const clickGain1 = ctx.createGain();
  clickOsc1.type = 'square';
  clickOsc1.frequency.setValueAtTime(engage ? 1800 : 1200, now);
  clickOsc1.frequency.exponentialRampToValueAtTime(engage ? 320 : 220, now + 0.035);
  clickGain1.gain.setValueAtTime(0.5, now);
  clickGain1.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  clickOsc1.connect(clickGain1);
  clickGain1.connect(masterGain);
  clickOsc1.start(now);
  clickOsc1.stop(now + 0.05);

  // Micro-click 2: heavy iron lever latch (offset by 25ms)
  const offset = 0.025;
  const latchOsc = ctx.createOscillator();
  const latchFilter = ctx.createBiquadFilter();
  const latchGain = ctx.createGain();

  latchOsc.type = 'triangle';
  latchOsc.frequency.setValueAtTime(engage ? 620 : 450, now + offset);
  latchOsc.frequency.exponentialRampToValueAtTime(engage ? 180 : 120, now + offset + 0.08);

  latchFilter.type = 'lowpass';
  latchFilter.frequency.setValueAtTime(1200, now + offset);

  latchGain.gain.setValueAtTime(0, now);
  latchGain.gain.setValueAtTime(0.7, now + offset);
  latchGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);

  latchOsc.connect(latchFilter);
  latchFilter.connect(latchGain);
  latchGain.connect(masterGain);
  latchOsc.start(now + offset);
  latchOsc.stop(now + offset + 0.15);

  // Short iron ring tail
  const ringOsc = ctx.createOscillator();
  const ringGain = ctx.createGain();
  ringOsc.type = 'sine';
  ringOsc.frequency.setValueAtTime(engage ? 880 : 640, now + offset);
  ringGain.gain.setValueAtTime(0.2, now + offset);
  ringGain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.35);
  ringOsc.connect(ringGain);
  ringGain.connect(masterGain);
  ringOsc.start(now + offset);
  ringOsc.stop(now + offset + 0.4);
}

/**
 * Plays a tactile iron tap (knocking on the heavy cast-iron housing)
 */
export function playIronTap() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(soundVolume * 0.75, now);
  masterGain.connect(ctx.destination);

  // Strike transient
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(540, now);
  osc.frequency.exponentialRampToValueAtTime(190, now + 0.06);
  gain.gain.setValueAtTime(0.6, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.1);

  // High metallic ping
  const pingOsc = ctx.createOscillator();
  const pingGain = ctx.createGain();
  pingOsc.type = 'sine';
  pingOsc.frequency.setValueAtTime(1750, now);
  pingGain.gain.setValueAtTime(0.35, now);
  pingGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
  pingOsc.connect(pingGain);
  pingGain.connect(masterGain);
  pingOsc.start(now);
  pingOsc.stop(now + 0.5);
}

/**
 * Plays an iron disengage / stop sound with heavy acoustic dampening
 */
export function playIronStop() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(soundVolume * 0.85, now);
  masterGain.connect(ctx.destination);

  // Heavy metal thud
  const thud = ctx.createOscillator();
  const thudGain = ctx.createGain();
  thud.type = 'triangle';
  thud.frequency.setValueAtTime(110, now);
  thud.frequency.exponentialRampToValueAtTime(35, now + 0.15);
  thudGain.gain.setValueAtTime(0.8, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  thud.connect(thudGain);
  thudGain.connect(masterGain);
  thud.start(now);
  thud.stop(now + 0.22);

  // Metallic spring reverb rattle
  const springOsc = ctx.createOscillator();
  const springGain = ctx.createGain();
  springOsc.type = 'sawtooth';
  springOsc.frequency.setValueAtTime(380, now);
  springOsc.frequency.exponentialRampToValueAtTime(140, now + 0.25);
  springGain.gain.setValueAtTime(0.2, now);
  springGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
  springOsc.connect(springGain);
  springGain.connect(masterGain);
  springOsc.start(now);
  springOsc.stop(now + 0.35);
}
