import { Baloo2_700Bold, Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2';
import { Nunito_600SemiBold, Nunito_800ExtraBold, Nunito_900Black } from '@expo-google-fonts/nunito';
import { FontDisplay, useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { initSound } from '../lib/sound';
import { colors } from '../theme';

// On the web, show text in a system font straight away and swap in the custom fonts once they
// arrive (~1.6 MB), so slow school networks never see a blank screen.
const swap = (uri: number) => ({ uri, display: FontDisplay.SWAP });

export default function RootLayout() {
  useEffect(() => {
    initSound();
  }, []);
  const [loaded, error] = useFonts({
    Baloo2_700Bold: swap(Baloo2_700Bold),
    Baloo2_800ExtraBold: swap(Baloo2_800ExtraBold),
    Nunito_600SemiBold: swap(Nunito_600SemiBold),
    Nunito_800ExtraBold: swap(Nunito_800ExtraBold),
    Nunito_900Black: swap(Nunito_900Black),
  });
  // Native apps bundle the fonts, so waiting a moment there avoids a visible font jump.
  if (Platform.OS !== 'web' && !loaded && !error) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </>
  );
}
