import { useWindowDimensions } from 'react-native';

export const colors = {
  bg: '#F6F6F3',
  surface: '#FFFFFF',
  ink: '#16191D',
  inkSoft: '#5B6168',
  line: '#E3E4E0',
  land: '#DADDD6',
  landFaded: '#E8EAE5',
  landStroke: '#FFFFFF',
  sea: '#EDF3F7',
  accent: '#2F5BEA',
  accentSoft: '#E6ECFD',
  correct: '#1F9D55',
  correctSoft: '#E3F5EA',
  wrong: '#D93B3B',
  wrongSoft: '#FBE7E7',
  hint: '#E89B0C',
};

// Soft, distinguishable fills for regions once they are placed.
export const placedPalette = ['#8FB8F2', '#9FD8B4', '#F5C58A', '#E9A7B8', '#B9A9EC', '#93D3D6', '#F2DB86'];

export function paletteFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return placedPalette[h % placedPalette.length];
}

export type LayoutMode = 'phone' | 'board';

/** "board" = large landscape screens (desktop, smartboard, tablet landscape). */
export function useLayoutMode(): { mode: LayoutMode; width: number; height: number; s: (n: number) => number } {
  const { width, height } = useWindowDimensions();
  const mode: LayoutMode = width >= 1000 || (width >= 760 && width > height) ? 'board' : 'phone';
  // Type/spacing scale: bigger on very large screens so it reads from the back of a classroom.
  const k = mode === 'board' ? Math.min(1.6, Math.max(1.1, width / 1200)) : 1;
  return { mode, width, height, s: (n) => Math.round(n * k) };
}
