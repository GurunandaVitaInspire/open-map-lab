import { Baloo2_700Bold, Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2';
import { Nunito_600SemiBold, Nunito_800ExtraBold, Nunito_900Black } from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../theme';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Baloo2_700Bold,
    Baloo2_800ExtraBold,
    Nunito_600SemiBold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });
  // Render nothing for the brief moment fonts load (falls back to system fonts if they fail).
  if (!loaded && !error) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </>
  );
}
