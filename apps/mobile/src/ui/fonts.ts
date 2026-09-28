import { useFonts } from 'expo-font'
import { CormorantGaramond_400Regular } from '@expo-google-fonts/cormorant-garamond/400Regular'
import { CormorantGaramond_400Regular_Italic } from '@expo-google-fonts/cormorant-garamond/400Regular_Italic'
import { CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond/600SemiBold'
import { CormorantGaramond_700Bold } from '@expo-google-fonts/cormorant-garamond/700Bold'
import { CinzelDecorative_700Bold } from '@expo-google-fonts/cinzel-decorative/700Bold'
import { CinzelDecorative_900Black } from '@expo-google-fonts/cinzel-decorative/900Black'

/* Loads the two families the tokens name. The repository ships the site's
   fonts as woff2 only, which native platforms cannot read, so the TTFs come
   from the Google Fonts packages — imported per weight, so only the six
   faces in use end up in the bundle. The family names match `fonts` in
   tokens.ts. Returns [loaded, error] like expo-font's hook. */
export function useAppFonts() {
  return useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_400Regular_Italic,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
    CinzelDecorative_700Bold,
    CinzelDecorative_900Black,
  })
}
