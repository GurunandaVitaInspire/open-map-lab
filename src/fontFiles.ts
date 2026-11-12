/**
 * App fonts, subset to the Latin characters the app uses (see assets/fonts). Native apps load TTF;
 * fontFiles.web.ts loads the much smaller WOFF2 versions in browsers.
 * Baloo 2 and Nunito are released under the SIL Open Font License (assets/fonts/OFL-*.txt).
 */
export const FONT_FILES = {
  Baloo2_800ExtraBold: require('../assets/fonts/Baloo2-ExtraBold.ttf'),
  Nunito_600SemiBold: require('../assets/fonts/Nunito-SemiBold.ttf'),
  Nunito_800ExtraBold: require('../assets/fonts/Nunito-ExtraBold.ttf'),
  Nunito_900Black: require('../assets/fonts/Nunito-Black.ttf'),
};
