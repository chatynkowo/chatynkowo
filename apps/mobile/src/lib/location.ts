import * as Location from 'expo-location'
import type { LatLng } from '@chatynkowo/core'

/* The seeker's position for the Atlas, asked for only when they press the
   locate control — never at start-up, and never in the background. A fix
   that does not arrive in time falls back to the last known one. */

export type LocateResult = { kind: 'ok'; position: LatLng } | { kind: 'denied' } | { kind: 'failed' }

const FIX_TIMEOUT_MS = 12_000

function toLatLng(reading: Location.LocationObject): LatLng {
  return { lat: reading.coords.latitude, lng: reading.coords.longitude }
}

export async function locate(): Promise<LocateResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return { kind: 'denied' }
    const fresh = await Promise.race<Location.LocationObject | null>([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
    ])
    const reading = fresh ?? (await Location.getLastKnownPositionAsync())
    return reading ? { kind: 'ok', position: toLatLng(reading) } : { kind: 'failed' }
  } catch {
    return { kind: 'failed' }
  }
}
