export interface Alarm {
  id: string;
  time: string; // "HH:MM" in 24-hour format
  enabled: boolean;
  label: string;
  days: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday. Empty means play once and turn off.
  soundId: string;
  snoozeCount: number;
  snoozeDuration: number; // in minutes
  isSnoozed: boolean;
  snoozedUntil: number | null; // Milliseconds timestamp
}

export interface SoundOption {
  id: string;
  name: string;
  description: string;
}

export const SOUND_OPTIONS: SoundOption[] = [
  { id: 'zen-chime', name: 'Zen Chime', description: 'Gentle bell and resonant hum' },
  { id: 'digital-pulse', name: 'Digital Pulse', description: 'Clean modern beep melody' },
  { id: 'cosmic-harmony', name: 'Cosmic Harmony', description: 'Dreamy synthesizer chords' },
  { id: 'morning-breeze', name: 'Morning Breeze', description: 'Uplifting soft synth chord progression' },
  { id: 'marimba-pulse', name: 'Marimba Pulse', description: 'Happy rhythmic wooden mallet tones' },
  { id: 'classic-retro', name: 'Retro Alarm', description: 'Playful classic double-beep alert' },
];
