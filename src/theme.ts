import { Platform, useWindowDimensions } from 'react-native';

/** "Explorer" palette: grape ink, violet primary, sunny gold rewards, sandy 3D land on a bright ocean. */
export const colors = {
  bg: '#F4F1FF',
  bgDeep: '#E7E0FF',
  surface: '#FFFFFF',
  surfaceLip: '#DCD3FA',
  ink: '#22184A',
  inkSoft: '#6B6390',
  line: '#E4DEF7',

  primary: '#6C47FF',
  primaryDark: '#4B2ED1',
  primarySoft: '#EEE9FF',
  sun: '#FFC83D',
  sunDark: '#E0A400',
  coral: '#FF6B6B',
  mint: '#20C997',
  sky: '#3BA3FF',

  ocean: '#BFE7F8',
  oceanDeep: '#A3DAF2',
  wave: '#D9F2FC',

  landTop: '#FFF0D2',
  landSide: '#D4AE72',
  landStroke: '#EED9AE',
  landFadedTop: '#F7EEDC',
  landFadedSide: '#E2D3B4',
  border: '#7A5A30',
  shadow: '#2A1F5C',
};

// On the web, fall back to a clean system sans-serif while the custom fonts download.
const family = (name: string) =>
  Platform.OS === 'web' ? `${name}, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` : name;

export const fonts = {
  display: family('Baloo2_800ExtraBold'),
  displayBold: family('Baloo2_700Bold'),
  body: family('Nunito_600SemiBold'),
  bodyBold: family('Nunito_800ExtraBold'),
  black: family('Nunito_900Black'),
};

export type Tier = 'perfect' | 'great' | 'good' | 'close' | 'missed';

export type Rating = {
  tier: Tier;
  label: string;
  /** strong text colour */
  color: string;
  /** top face of a placed region */
  fill: string;
  /** extruded side of a placed region */
  side: string;
  stars: 0 | 1 | 2 | 3;
};

export function rate(accuracy: number): Rating {
  if (accuracy >= 100) return { tier: 'perfect', label: 'Perfect', color: '#B07A00', fill: '#FFD54A', side: '#E0A400', stars: 3 };
  if (accuracy >= 80) return { tier: 'great', label: 'Great', color: '#13895A', fill: '#63DDA2', side: '#22A66A', stars: 2 };
  if (accuracy >= 50) return { tier: 'good', label: 'Good', color: '#2F6FC0', fill: '#94C8FF', side: '#4D93E0', stars: 1 };
  if (accuracy > 0) return { tier: 'close', label: 'Close', color: '#C15A1C', fill: '#FFB585', side: '#E07B3C', stars: 0 };
  return { tier: 'missed', label: 'Missed', color: '#C93A3A', fill: '#FF9F9F', side: '#E05656', stars: 0 };
}

export const RATING_LEGEND = [100, 90, 60, 20, 0].map(rate);

export type LayoutMode = 'phone' | 'board';

/** "board" = large landscape screens (desktop, smartboard, tablet landscape). */
export function useLayoutMode(): { mode: LayoutMode; width: number; height: number; s: (n: number) => number } {
  const { width, height } = useWindowDimensions();
  const mode: LayoutMode = width >= 1000 || (width >= 760 && width > height) ? 'board' : 'phone';
  // Type/spacing scale: bigger on very large screens so it reads from the back of a classroom.
  const k = mode === 'board' ? Math.min(1.6, Math.max(1.05, width / 1250)) : 1;
  return { mode, width, height, s: (n) => Math.round(n * k) };
}
