import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Ambient motion (moving sea, swinging cards, drifting clouds, ticker) can be paused by the user,
 * and is off when the device asks for reduced motion (WCAG 2.2.2 "Pause, Stop, Hide").
 */
const KEY = 'motion-enabled';
let userEnabled = true;
let reduced = false;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v !== null) userEnabled = v === '1';
  } catch {}
  try {
    reduced = await AccessibilityInfo.isReduceMotionEnabled();
  } catch {}
  AccessibilityInfo.addEventListener?.('reduceMotionChanged', (r: boolean) => {
    reduced = r;
    emit();
  });
  emit();
}

export function toggleMotion() {
  userEnabled = !userEnabled;
  AsyncStorage.setItem(KEY, userEnabled ? '1' : '0').catch(() => {});
  emit();
}

/** true when ambient animations should run */
export function useMotion(): boolean {
  useEffect(() => {
    load();
  }, []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => userEnabled && !reduced,
    () => userEnabled && !reduced,
  );
}

/** the user's own on/off choice (for the toggle button), regardless of the system setting */
export function useMotionPreference(): boolean {
  useMotion();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => userEnabled,
    () => userEnabled,
  );
}
