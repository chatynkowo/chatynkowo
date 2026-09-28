import { Linking, Platform } from 'react-native'
import type { LatLng } from '@chatynkowo/core'

/* "Navigate" on a cottage: hand the pin to the system maps app. Apple Maps
   on iOS, whatever handles geo: URIs on Android, Google Maps on the web as
   the last resort. */
export async function openInMaps({ lat, lng }: LatLng, label: string) {
  const point = `${lat},${lng}`
  const encodedLabel = encodeURIComponent(label)
  const candidates = Platform.select({
    ios: [`maps://?daddr=${point}&q=${encodedLabel}`, `https://maps.apple.com/?daddr=${point}&q=${encodedLabel}`],
    android: [`geo:${point}?q=${point}(${encodedLabel})`],
    default: [] as string[],
  })
  const fallback = `https://www.google.com/maps/dir/?api=1&destination=${point}`
  for (const url of [...candidates, fallback]) {
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url)
        return
      }
    } catch {
      // Try the next scheme.
    }
  }
  await Linking.openURL(fallback)
}
