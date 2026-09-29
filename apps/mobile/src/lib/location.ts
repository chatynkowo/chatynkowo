import * as Location from 'expo-location'
import type { LatLng } from '@chatynkowo/core'

/* The seeker's position for the Atlas, asked for only when they press the
   locate control, never at start-up, and never in the background. A fix
   that does not arrive in time falls back to the last known one. */

export type Position = LatLng & {
  /* Radius of the reading's uncertainty in metres, when the device says. */
  accuracy: number | null
}

export type LocateResult =
  | { kind: 'ok'; position: Position }
  /* `canAskAgain` false means the system will not show the prompt again;
     the screen offers the app settings instead. */
  | { kind: 'denied'; canAskAgain: boolean }
  | { kind: 'failed' }

const FIX_TIMEOUT_MS = 12_000

function toPosition(reading: Location.LocationObject): Position {
  return { lat: reading.coords.latitude, lng: reading.coords.longitude, accuracy: reading.coords.accuracy }
}

/* The current permission, requesting it only when the system still allows
   the prompt. */
async function ensurePermission(): Promise<{ granted: boolean; canAskAgain: boolean }> {
  const current = await Location.getForegroundPermissionsAsync()
  if (current.granted) return { granted: true, canAskAgain: current.canAskAgain }
  if (!current.canAskAgain) return { granted: false, canAskAgain: false }
  const asked = await Location.requestForegroundPermissionsAsync()
  return { granted: asked.granted, canAskAgain: asked.canAskAgain }
}

export async function locate(): Promise<LocateResult> {
  try {
    const permission = await ensurePermission()
    if (!permission.granted) return { kind: 'denied', canAskAgain: permission.canAskAgain }
    const fresh = await Promise.race<Location.LocationObject | null>([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
    ])
    const reading = fresh ?? (await Location.getLastKnownPositionAsync())
    return reading ? { kind: 'ok', position: toPosition(reading) } : { kind: 'failed' }
  } catch {
    return { kind: 'failed' }
  }
}
