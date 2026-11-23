export type MechanicalSoundType =
  | 'key'
  | 'latch'
  | 'stop'
  | 'ff'
  | 'rew'
  | 'eject'
  | 'insert'
  | 'flip';

let sharedAudioCtx: AudioContext | null = null;
let unlockListenerBound = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function bindFirstTapAudioUnlock(): void {
  if (typeof window === 'undefined' || unlockListenerBound) return;
  unlockListenerBound = true;
  const unlock = () => {
    getAudioContext();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

function createNoiseBurst(
  ctx: AudioContext,
  durationSec: number,
  decayFactor: number
): AudioBufferSourceNode {
  const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleCount * decayFactor));
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  return source;
}

function scheduleKeyThump(
  ctx: AudioContext,
  startTime: number,
  opts: {
    startFreq: number;
    endFreq: number;
    duration: number;
    thumpGain: number;
    filterFreq: number;
    noiseGain: number;
    oscType?: OscillatorType;
  }
): void {
  const osc = ctx.createOscillator();
  const thumpGainNode = ctx.createGain();
  osc.type = opts.oscType || 'triangle';
  osc.frequency.setValueAtTime(opts.startFreq, startTime);
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(24, opts.endFreq),
    startTime + opts.duration
  );

  thumpGainNode.gain.setValueAtTime(opts.thumpGain, startTime);
  thumpGainNode.gain.exponentialRampToValueAtTime(
    0.0008,
    startTime + opts.duration
  );

  osc.connect(thumpGainNode);
  thumpGainNode.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + opts.duration + 0.01);

  const noise = createNoiseBurst(ctx, opts.duration, 0.25);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(opts.filterFreq, startTime);
  filter.Q.setValueAtTime(1.8, startTime);

  const noiseGainNode = ctx.createGain();
  noiseGainNode.gain.setValueAtTime(opts.noiseGain, startTime);
  noiseGainNode.gain.exponentialRampToValueAtTime(
    0.0008,
    startTime + opts.duration * 0.85
  );

  noise.connect(filter);
  filter.connect(noiseGainNode);
  noiseGainNode.connect(ctx.destination);
  noise.start(startTime);
  noise.stop(startTime + opts.duration);
}

function scheduleMotorWhirr(
  ctx: AudioContext,
  startTime: number,
  duration: number,
  freqs: [number, number, number],
  peakGain = 0.045
): void {
  const motorOsc = ctx.createOscillator();
  const harmonicOsc = ctx.createOscillator();
  const lp = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  motorOsc.type = 'sawtooth';
  motorOsc.frequency.setValueAtTime(freqs[0], startTime);
  motorOsc.frequency.exponentialRampToValueAtTime(freqs[1], startTime + duration * 0.45);
  motorOsc.frequency.exponentialRampToValueAtTime(freqs[2], startTime + duration);

  harmonicOsc.type = 'triangle';
  harmonicOsc.frequency.setValueAtTime(freqs[0] * 1.5, startTime);
  harmonicOsc.frequency.exponentialRampToValueAtTime(
    freqs[1] * 1.5,
    startTime + duration * 0.45
  );
  harmonicOsc.frequency.exponentialRampToValueAtTime(
    freqs[2] * 1.5,
    startTime + duration
  );

  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1850, startTime);

  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.03);
  gain.gain.setValueAtTime(peakGain * 0.85, startTime + duration - 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

  motorOsc.connect(lp);
  harmonicOsc.connect(lp);
  lp.connect(gain);
  gain.connect(ctx.destination);

  motorOsc.start(startTime);
  harmonicOsc.start(startTime);
  motorOsc.stop(startTime + duration + 0.01);
  harmonicOsc.stop(startTime + duration + 0.01);
}

export function playCassetteSwapSfx(enabled = true): void {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Stage 1 (0ms): Spring eject click & hollow plastic release
    scheduleKeyThump(ctx, now, {
      startFreq: 210,
      endFreq: 88,
      duration: 0.065,
      thumpGain: 0.085,
      filterFreq: 1350,
      noiseGain: 0.095,
      oscType: 'triangle',
    });

    // Stage 2 (+185ms): Solid plastic cassette-insert clunk & micro-latch
    scheduleKeyThump(ctx, now + 0.185, {
      startFreq: 130,
      endFreq: 42,
      duration: 0.095,
      thumpGain: 0.14,
      filterFreq: 780,
      noiseGain: 0.09,
      oscType: 'sine',
    });
    scheduleKeyThump(ctx, now + 0.23, {
      startFreq: 310,
      endFreq: 120,
      duration: 0.045,
      thumpGain: 0.05,
      filterFreq: 1750,
      noiseGain: 0.065,
      oscType: 'triangle',
    });
  } catch {
    // Ignore audio context restrictions
  }
}

export function playAutoReverseFlipSfx(enabled = true): void {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Crisp mechanical relay click
    scheduleKeyThump(ctx, now, {
      startFreq: 420,
      endFreq: 140,
      duration: 0.05,
      thumpGain: 0.075,
      filterFreq: 2100,
      noiseGain: 0.09,
      oscType: 'square',
    });

    // 2. Quick reverse-motor whirr synced with 180-deg cassette flip
    scheduleMotorWhirr(ctx, now + 0.05, 0.29, [420, 960, 480], 0.042);

    // 3. Solid head-bridge latch clunk as opposite side engages
    scheduleKeyThump(ctx, now + 0.34, {
      startFreq: 145,
      endFreq: 46,
      duration: 0.085,
      thumpGain: 0.13,
      filterFreq: 950,
      noiseGain: 0.095,
      oscType: 'triangle',
    });
  } catch {
    // Ignore audio context restrictions
  }
}

export function playMechanicalClick(
  type: MechanicalSoundType,
  enabled = true
): void {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    switch (type) {
      case 'latch':
        // ~60ms crisp key-latch click + low-frequency resonant thump
        scheduleKeyThump(ctx, now, {
          startFreq: 165,
          endFreq: 48,
          duration: 0.062,
          thumpGain: 0.11,
          filterFreq: 1120,
          noiseGain: 0.095,
          oscType: 'triangle',
        });
        break;

      case 'stop':
        // Heavy spring pop-up release clack
        scheduleKeyThump(ctx, now, {
          startFreq: 235,
          endFreq: 62,
          duration: 0.065,
          thumpGain: 0.12,
          filterFreq: 1480,
          noiseGain: 0.11,
          oscType: 'sine',
        });
        break;

      case 'ff':
        // Key click + brief ~250ms high-pitched forward tape-motor spooling whirr
        scheduleKeyThump(ctx, now, {
          startFreq: 240,
          endFreq: 85,
          duration: 0.055,
          thumpGain: 0.085,
          filterFreq: 1350,
          noiseGain: 0.08,
          oscType: 'triangle',
        });
        scheduleMotorWhirr(ctx, now + 0.03, 0.24, [540, 1180, 860], 0.04);
        break;

      case 'rew':
        // Key click + brief ~250ms rewind tape-motor spooling whirr
        scheduleKeyThump(ctx, now, {
          startFreq: 215,
          endFreq: 75,
          duration: 0.055,
          thumpGain: 0.085,
          filterFreq: 1200,
          noiseGain: 0.08,
          oscType: 'triangle',
        });
        scheduleMotorWhirr(ctx, now + 0.03, 0.24, [960, 440, 620], 0.04);
        break;

      case 'eject':
        scheduleKeyThump(ctx, now, {
          startFreq: 205,
          endFreq: 86,
          duration: 0.062,
          thumpGain: 0.085,
          filterFreq: 1300,
          noiseGain: 0.09,
          oscType: 'triangle',
        });
        break;

      case 'insert':
        scheduleKeyThump(ctx, now, {
          startFreq: 130,
          endFreq: 44,
          duration: 0.085,
          thumpGain: 0.135,
          filterFreq: 820,
          noiseGain: 0.085,
          oscType: 'sine',
        });
        break;

      case 'flip':
        playAutoReverseFlipSfx(enabled);
        break;

      case 'key':
      default:
        // Tactile ~55ms UI / plastic key click
        scheduleKeyThump(ctx, now, {
          startFreq: 270,
          endFreq: 85,
          duration: 0.055,
          thumpGain: 0.075,
          filterFreq: 1550,
          noiseGain: 0.065,
          oscType: 'triangle',
        });
        break;
    }
  } catch {
    // Ignore audio context blocks
  }
}
