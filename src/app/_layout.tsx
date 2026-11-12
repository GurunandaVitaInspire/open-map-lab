import { FontDisplay, useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { FONT_FILES } from '../fontFiles';
import { initSound } from '../lib/sound';
import { colors } from '../theme';

// On the web, show text in a system font straight away and swap in the custom fonts once they
// arrive, so slow school networks never see a blank screen.
const swap = (uri: number) => ({ uri, display: FontDisplay.SWAP });
const FONT_MAP = Object.fromEntries(Object.entries(FONT_FILES).map(([name, file]) => [name, swap(file)]));

export default function RootLayout() {
  useEffect(() => {
    initSound();
  }, []);
  const [loaded, error] = useFonts(FONT_MAP);
  // Native apps bundle the fonts, so waiting a moment there avoids a visible font jump.
  if (Platform.OS !== 'web' && !loaded && !error) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </>
  );
}
