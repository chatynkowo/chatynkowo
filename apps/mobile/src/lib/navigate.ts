import { Linking, Platform } from 'react-native'
import type { LatLng } from '@chatynkowo/core'
import { STORAGE_KEYS } from '../config'
import { readJson, writeJson } from './storage'

/* "Navigate" on a cottage: hand the pin to the system maps app. On iOS the
   seeker picks Apple Maps or Google Maps once (when both are installed) and
   the choice is remembered; Android asks whatever handles geo: URIs; the
   web Google Maps link is the last resort. */

export type MapsApp = 'apple' | 'google'

export type NavigateOptions = {
  /* Shown once on iOS when Google Maps is installed and nothing is
     remembered yet (an action sheet with the two apps); resolving null
     cancels the navigation. */
  chooser?: (choices: MapsApp[]) => Promise<MapsApp | null>
}

async function canOpen(url: string) {
  try {
    return await Linking.canOpenURL(url)
  } catch {
    return false
  }
}

/* Apple Maps unless Google Maps is installed and either remembered or
   chosen now; the choice is kept for the next cottage. */
async function iosChoice(googleUrl: string, chooser?: NavigateOptions['chooser']): Promise<MapsApp | null> {
  if (!(await canOpen(googleUrl))) return 'apple'
  const remembered = await readJson<MapsApp>(STORAGE_KEYS.mapsApp)
  if (remembered === 'apple' || remembered === 'google') return remembered
  if (!chooser) return 'apple'
  const picked = await chooser(['apple', 'google'])
  if (!picked) return null
  void writeJson(STORAGE_KEYS.mapsApp, picked)
  return picked
}

export async function openInMaps({ lat, lng }: LatLng, label: string, options: NavigateOptions = {}) {
  const point = `${lat},${lng}`
  const encodedLabel = encodeURIComponent(label)
  const fallback = `https://www.google.com/maps/dir/?api=1&destination=${point}`
  let candidates: string[] = []
  if (Platform.OS === 'ios') {
    const googleUrl = `comgooglemaps://?daddr=${point}&q=${encodedLabel}`
    const choice = await iosChoice(googleUrl, options.chooser)
    if (!choice) return
    candidates =
      choice === 'google'
        ? [googleUrl]
        : [`maps://?daddr=${point}&q=${encodedLabel}`, `https://maps.apple.com/?daddr=${point}&q=${encodedLabel}`]
  } else if (Platform.OS === 'android') {
    candidates = [`geo:${point}?q=${point}(${encodedLabel})`]
  }
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
