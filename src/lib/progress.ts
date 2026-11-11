import AsyncStorage from '@react-native-async-storage/async-storage';

/** Best average accuracy per map/mode/region, stored on this device only (no accounts). */
const key = (mapId: string, mode: string, group?: string) => `best:${mapId}:${mode}:${group || 'all'}`;

export async function getBest(mapId: string, mode: string, group?: string): Promise<number | null> {
  try {
    const v = await AsyncStorage.getItem(key(mapId, mode, group));
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}

/** Saves the score if it beats the previous best. Returns true for a new record. */
export async function saveBest(mapId: string, mode: string, group: string | undefined, score: number): Promise<boolean> {
  try {
    const prev = await getBest(mapId, mode, group);
    if (prev !== null && prev >= score) return false;
    await AsyncStorage.setItem(key(mapId, mode, group), String(score));
    return true;
  } catch {
    return false;
  }
}

/** Best score for a map across any mode/region, for the home screen. */
export async function getBestAny(mapId: string): Promise<number | null> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(`best:${mapId}:`));
    if (!keys.length) return null;
    const vals = await AsyncStorage.multiGet(keys);
    return Math.max(...vals.map(([, v]) => Number(v ?? 0)));
  } catch {
    return null;
  }
}
