import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useSyncExternalStore } from 'react';

/**
 * Game sounds. All files are CC0 (public domain): effects and jingles by Kenney (kenney.nl),
 * music "Happy Adventure (Loop)" by TinyWorlds (opengameart.org). See assets/sounds/CREDITS.md.
 */
const SFX = {
  tap: require('../../assets/sounds/tap.mp3'),
  pickup: require('../../assets/sounds/pickup.mp3'),
  drop: require('../../assets/sounds/drop.mp3'),
  snap: require('../../assets/sounds/snap.mp3'),
  correct: require('../../assets/sounds/correct.mp3'),
  wrong: require('../../assets/sounds/wrong.mp3'),
  great: require('../../assets/sounds/great.mp3'),
  perfect: require('../../assets/sounds/perfect.mp3'),
  complete: require('../../assets/sounds/complete.mp3'),
} as const;
const MUSIC = require('../../assets/sounds/music-happy-adventure.mp3');

export type Sfx = keyof typeof SFX;

const VOLUME: Partial<Record<Sfx, number>> = { tap: 0.5, pickup: 0.6, drop: 0.6, wrong: 0.55 };
const MUSIC_VOLUME = 0.3;
const KEY = 'sound-settings';

type Settings = { sfx: boolean; music: boolean };
// Effects on, music off by default (music on a classroom smartboard can be disruptive).
let settings: Settings = { sfx: true, music: false };
const listeners = new Set<() => void>();
const players: Partial<Record<Sfx, AudioPlayer>> = {};
let music: AudioPlayer | null = null;
let started = false;

function emit() {
  listeners.forEach((l) => l());
}

function player(name: Sfx) {
  let p = players[name];
  if (!p) {
    p = createAudioPlayer(SFX[name]);
    p.volume = VOLUME[name] ?? 0.85;
    players[name] = p;
  }
  return p;
}

function syncMusic() {
  try {
    if (settings.music) {
      if (!music) {
        music = createAudioPlayer(MUSIC);
        music.loop = true;
        music.volume = MUSIC_VOLUME;
      }
      if (!music.playing) music.play();
    } else if (music?.playing) {
      music.pause();
    }
  } catch {
    // audio can be unavailable (e.g. blocked autoplay); the game works without it
  }
}

/** Call once at app start: loads saved settings and preloads the effects. */
export async function initSound() {
  if (started) return;
  started = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
  } catch {}
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) settings = { ...settings, ...JSON.parse(raw) };
  } catch {}
  emit();
  // Preload the (small) effects a moment after start-up, so they never compete with the first
  // paint for bandwidth. playSfx() also creates players on demand if someone is faster.
  setTimeout(() => {
    (Object.keys(SFX) as Sfx[]).forEach((n) => {
      try {
        player(n);
      } catch {}
    });
  }, 2500);
}

export function playSfx(name: Sfx) {
  // Browsers only allow audio after a user gesture, so this is also where saved music resumes.
  if (settings.music && !music?.playing) syncMusic();
  if (!settings.sfx) return;
  try {
    const p = player(name);
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {}
}

function save() {
  AsyncStorage.setItem(KEY, JSON.stringify(settings)).catch(() => {});
  emit();
}

export function toggleSfx() {
  settings = { ...settings, sfx: !settings.sfx };
  save();
  if (settings.sfx) playSfx('tap');
}

export function toggleMusic() {
  settings = { ...settings, music: !settings.music };
  syncMusic();
  save();
}

export function useSoundSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => settings,
    () => settings,
  );
}
