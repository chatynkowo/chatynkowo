import { useFonts } from 'expo-font'
import { CormorantGaramond_400Regular } from '@expo-google-fonts/cormorant-garamond/400Regular'
import { CormorantGaramond_400Regular_Italic } from '@expo-google-fonts/cormorant-garamond/400Regular_Italic'
import { CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond/600SemiBold'
import { CinzelDecorative_700Bold } from '@expo-google-fonts/cinzel-decorative/700Bold'

/* Loads the faces the site uses and no others. The repository ships the
   site's fonts as woff2 only, which native platforms cannot read, so the
   TTFs come from the Google Fonts packages, imported per weight so only
   these four end up in the bundle. The family names match `fonts` in
   tokens.ts. Returns [loaded, error] like expo-font's hook. */
export function useAppFonts() {
  return useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_400Regular_Italic,
    CormorantGaramond_600SemiBold,
    CinzelDecorative_700Bold,
  })
}
