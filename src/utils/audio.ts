// Web Audio API Synthesizer for high-quality alarm sounds
let audioCtx: AudioContext | null = null;
let currentLoopInterval: number | null = null;
let currentActiveNodes: { oscillators: OscillatorNode[]; gainNode: GainNode }[] = [];

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    // Standard AudioContext initialization
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Resume context if suspended (browser security restriction)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Stop all currently playing sounds
export function stopAlarmSound() {
  if (currentLoopInterval) {
    clearInterval(currentLoopInterval);
    currentLoopInterval = null;
  }

  // Stop and disconnect all active nodes
  currentActiveNodes.forEach(({ oscillators, gainNode }) => {
    oscillators.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {
        // Already stopped or not started
      }
    });
    try {
      gainNode.disconnect();
    } catch (e) {
      // Already disconnected
    }
  });
  currentActiveNodes = [];
}

// Custom Synths
function playZenChime(ctx: AudioContext, time: number, duration = 2.5): { oscillators: OscillatorNode[]; gainNode: GainNode } {
  const oscs: OscillatorNode[] = [];
  const mainGain = ctx.createGain();

  // Root note (resonant chime)
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(293.66, time); // D4 (Calm, grounded)
  
  // Overtones for chime realism
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(587.33, time); // D5 (Bright, clear oct)

  const osc3 = ctx.createOscillator();
  osc3.type = 'sine';
  osc3.frequency.setValueAtTime(880.00, time); // A5 (Fifth)

  const osc4 = ctx.createOscillator();
  osc4.type = 'sine';
  osc4.frequency.setValueAtTime(1174.66, time); // D6 (Brilliant peak)

  // Long bell decay envelope
  mainGain.gain.setValueAtTime(0, time);
  mainGain.gain.linearRampToValueAtTime(0.4, time + 0.05); // Rapid attack
  mainGain.gain.exponentialRampToValueAtTime(0.001, time + duration); // Long bell decay

  osc1.connect(mainGain);
  osc2.connect(mainGain);
  osc3.connect(mainGain);
  osc4.connect(mainGain);
  mainGain.connect(ctx.destination);

  osc1.start(time);
  osc2.start(time);
  osc3.start(time);
  osc4.start(time);

  osc1.stop(time + duration);
  osc2.stop(time + duration);
  osc3.stop(time + duration);
  osc4.stop(time + duration);

  return { oscillators: [osc1, osc2, osc3, osc4], gainNode: mainGain };
}

function playDigitalPulse(ctx: AudioContext, time: number, duration = 0.4): { oscillators: OscillatorNode[]; gainNode: GainNode } {
  const oscs: OscillatorNode[] = [];
  const mainGain = ctx.createGain();

  const osc = ctx.createOscillator();
  osc.type = 'triangle'; // Smoother than square, more modern
  osc.frequency.setValueAtTime(987.77, time); // B5 (Bright alarm note)

  const oscSub = ctx.createOscillator();
  oscSub.type = 'sine';
  oscSub.frequency.setValueAtTime(493.88, time); // B4 (Lower octave support)

  mainGain.gain.setValueAtTime(0, time);
  mainGain.gain.linearRampToValueAtTime(0.3, time + 0.01);
  mainGain.gain.setValueAtTime(0.3, time + duration - 0.05);
  mainGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  osc.connect(mainGain);
  oscSub.connect(mainGain);
  mainGain.connect(ctx.destination);

  osc.start(time);
  oscSub.start(time);
  osc.stop(time + duration);
  oscSub.stop(time + duration);

  return { oscillators: [osc, oscSub], gainNode: mainGain };
}

function playCosmicHarmony(ctx: AudioContext, time: number, duration = 3.0): { oscillators: OscillatorNode[]; gainNode: GainNode } {
  const oscs: OscillatorNode[] = [];
  const mainGain = ctx.createGain();

  // Frequencies for a gorgeous Minor 11th chord / Ambient Pad (E-G-B-D-F#)
  const freqs = [164.81, 196.00, 246.94, 293.66, 369.99]; // E3, G3, B3, D4, F#4
  
  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    
    // Add micro-detuning for lush analog chorus effect
    osc.detune.setValueAtTime((idx - 2) * 4, time);
    osc.frequency.setValueAtTime(freq, time);
    
    osc.connect(mainGain);
    oscs.push(osc);
    osc.start(time);
    osc.stop(time + duration);
  });

  // Slow ambient swell and release envelope
  mainGain.gain.setValueAtTime(0, time);
  mainGain.gain.linearRampToValueAtTime(0.25, time + 0.6); // slow swell
  mainGain.gain.setValueAtTime(0.25, time + duration - 1.0);
  mainGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  mainGain.connect(ctx.destination);

  return { oscillators: oscs, gainNode: mainGain };
}

function playClassicRetro(ctx: AudioContext, time: number, duration = 0.15): { oscillators: OscillatorNode[]; gainNode: GainNode } {
  const oscs: OscillatorNode[] = [];
  const mainGain = ctx.createGain();

  const osc = ctx.createOscillator();
  osc.type = 'square'; // Classic retro beeper
  osc.frequency.setValueAtTime(2000, time); // High pitched beep

  mainGain.gain.setValueAtTime(0, time);
  mainGain.gain.linearRampToValueAtTime(0.2, time + 0.005);
  mainGain.gain.setValueAtTime(0.2, time + duration - 0.02);
  mainGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  osc.connect(mainGain);
  mainGain.connect(ctx.destination);

  osc.start(time);
  osc.stop(time + duration);

  return { oscillators: [osc], gainNode: mainGain };
}

function playMorningBreeze(ctx: AudioContext, time: number, duration = 3.5): { oscillators: OscillatorNode[]; gainNode: GainNode } {
  const oscs: OscillatorNode[] = [];
  const mainGain = ctx.createGain();

  // Uplifting chord notes: A4 (440.00), C#5 (554.37), E5 (659.25), A5 (880.00)
  const notes = [440.00, 554.37, 659.25, 880.00];
  
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    
    // Staggered note onset times for harp-like effect
    const noteTime = time + idx * 0.15;
    osc.frequency.setValueAtTime(freq, noteTime);
    
    const noteGain = ctx.createGain();
    noteGain.gain.setValueAtTime(0, noteTime);
    noteGain.gain.linearRampToValueAtTime(0.12, noteTime + 0.3);
    noteGain.gain.exponentialRampToValueAtTime(0.001, noteTime + duration - idx * 0.15);

    osc.connect(noteGain);
    noteGain.connect(mainGain);
    oscs.push(osc);
    osc.start(noteTime);
    osc.stop(time + duration);
  });

  mainGain.gain.setValueAtTime(0.8, time);
  mainGain.connect(ctx.destination);

  return { oscillators: oscs, gainNode: mainGain };
}

function playMarimbaPulse(ctx: AudioContext, time: number, freq = 523.25, duration = 0.22): { oscillators: OscillatorNode[]; gainNode: GainNode } {
  const oscs: OscillatorNode[] = [];
  const mainGain = ctx.createGain();

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, time);

  // Quick overtone click for wooden mallet strikes
  const clickOsc = ctx.createOscillator();
  clickOsc.type = 'sine';
  clickOsc.frequency.setValueAtTime(freq * 3.5, time);

  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.15, time);
  clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

  mainGain.gain.setValueAtTime(0, time);
  mainGain.gain.linearRampToValueAtTime(0.35, time + 0.005);
  mainGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  osc.connect(mainGain);
  clickOsc.connect(clickGain);
  clickGain.connect(mainGain);
  mainGain.connect(ctx.destination);

  osc.start(time);
  clickOsc.start(time);
  osc.stop(time + duration);
  clickOsc.stop(time + duration);

  return { oscillators: [osc, clickOsc], gainNode: mainGain };
}

// Main trigger to play a specific sound in a loop (for the alarm)
export function startAlarmSound(soundId: string) {
  stopAlarmSound(); // Ensure nothing else is playing first

  const ctx = getAudioContext();
  const triggerNextSound = () => {
    const now = ctx.currentTime;
    let node: { oscillators: OscillatorNode[]; gainNode: GainNode };

    switch (soundId) {
      case 'zen-chime':
        node = playZenChime(ctx, now, 3.5);
        break;
      case 'digital-pulse':
        // Beep beep melody
        node = playDigitalPulse(ctx, now, 0.25);
        setTimeout(() => {
          if (currentLoopInterval) {
            const extraNode = playDigitalPulse(ctx, ctx.currentTime, 0.25);
            currentActiveNodes.push(extraNode);
          }
        }, 350);
        break;
      case 'cosmic-harmony':
        node = playCosmicHarmony(ctx, now, 4.0);
        break;
      case 'morning-breeze':
        node = playMorningBreeze(ctx, now, 4.0);
        break;
      case 'marimba-pulse':
        // Play three rapid ascending bouncy notes (C5, E5, G5)
        node = playMarimbaPulse(ctx, now, 523.25, 0.22); // C5
        setTimeout(() => {
          if (currentLoopInterval) {
            const extraNode1 = playMarimbaPulse(ctx, ctx.currentTime, 659.25, 0.22); // E5
            currentActiveNodes.push(extraNode1);
          }
        }, 150);
        setTimeout(() => {
          if (currentLoopInterval) {
            const extraNode2 = playMarimbaPulse(ctx, ctx.currentTime, 783.99, 0.22); // G5
            currentActiveNodes.push(extraNode2);
          }
        }, 300);
        break;
      case 'classic-retro':
        // Double beep beep pattern
        node = playClassicRetro(ctx, now, 0.12);
        setTimeout(() => {
          if (currentLoopInterval) {
            const extraNode1 = playClassicRetro(ctx, ctx.currentTime, 0.12);
            currentActiveNodes.push(extraNode1);
          }
        }, 180);
        setTimeout(() => {
          if (currentLoopInterval) {
            const extraNode2 = playClassicRetro(ctx, ctx.currentTime, 0.12);
            currentActiveNodes.push(extraNode2);
          }
        }, 360);
        break;
      default:
        node = playZenChime(ctx, now, 3.5);
    }

    currentActiveNodes.push(node);
  };

  // Run immediately first
  triggerNextSound();

  // Set looping interval depending on sound types
  let intervalMs = 4500; // Zen chime / cosmic harmony interval
  if (soundId === 'morning-breeze') {
    intervalMs = 4500;
  } else if (soundId === 'digital-pulse') {
    intervalMs = 1500;
  } else if (soundId === 'marimba-pulse') {
    intervalMs = 1200;
  } else if (soundId === 'classic-retro') {
    intervalMs = 1200;
  }

  currentLoopInterval = window.setInterval(triggerNextSound, intervalMs);
}

// Play a single 1.5-second preview of the sound
export function playSoundPreview(soundId: string) {
  stopAlarmSound(); // Interrupt any current playing state
  
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  let node: { oscillators: OscillatorNode[]; gainNode: GainNode };

  switch (soundId) {
    case 'zen-chime':
      node = playZenChime(ctx, now, 2.5);
      break;
    case 'digital-pulse':
      node = playDigitalPulse(ctx, now, 0.25);
      setTimeout(() => {
        const extra = playDigitalPulse(ctx, ctx.currentTime, 0.25);
        currentActiveNodes.push(extra);
      }, 350);
      break;
    case 'cosmic-harmony':
      node = playCosmicHarmony(ctx, now, 2.5);
      break;
    case 'morning-breeze':
      node = playMorningBreeze(ctx, now, 2.5);
      break;
    case 'marimba-pulse':
      node = playMarimbaPulse(ctx, now, 523.25, 0.22); // C5
      setTimeout(() => {
        const extra1 = playMarimbaPulse(ctx, ctx.currentTime, 659.25, 0.22); // E5
        currentActiveNodes.push(extra1);
      }, 150);
      setTimeout(() => {
        const extra2 = playMarimbaPulse(ctx, ctx.currentTime, 783.99, 0.22); // G5
        currentActiveNodes.push(extra2);
      }, 300);
      break;
    case 'classic-retro':
      node = playClassicRetro(ctx, now, 0.12);
      setTimeout(() => {
        const extra = playClassicRetro(ctx, ctx.currentTime, 0.12);
        currentActiveNodes.push(extra);
      }, 180);
      break;
    default:
      node = playZenChime(ctx, now, 2.5);
  }

  currentActiveNodes.push(node);
  
  // Clean up nodes after a short delay
  setTimeout(() => {
    // If not in a real loop, clean up
    if (!currentLoopInterval) {
      stopAlarmSound();
    }
  }, 3000);
}
