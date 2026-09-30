import * as Location from 'expo-location'
import type { LatLng } from '@chatynkowo/core'

/* The seeker's position for the Atlas: one fix when they press the locate
   control (the permission is asked for then, never at start-up), and a
   watch that follows them while the Atlas is in front once the permission
   is granted. Foreground only, never in the background. A fix that does
   not arrive in time falls back to the last known one. */

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
/* The watch: a balanced fix once the seeker has moved 20 metres; Android
   also spaces the fixes by at least 10 seconds (iOS follows the distance
   alone). */
const WATCH_OPTIONS: Location.LocationOptions = { accuracy: Location.Accuracy.Balanced, distanceInterval: 20, timeInterval: 10_000 }

function toPosition(reading: Location.LocationObject): Position {
  return { lat: reading.coords.latitude, lng: reading.coords.longitude, accuracy: reading.coords.accuracy }
}

/* Whether the foreground permission is granted already; never asks. */
export async function hasPermission(): Promise<boolean> {
  try {
    return (await Location.getForegroundPermissionsAsync()).granted
  } catch {
    return false
  }
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

/* Follows the position, handing every fix to `handler`, until the returned
   function is called. For a granted permission (see `hasPermission`); a
   watch the system refuses resolves to a no-op stop and stays silent, the
   locate control being where a refusal is explained. */
export async function watchPosition(handler: (position: Position) => void): Promise<() => void> {
  try {
    const subscription = await Location.watchPositionAsync(WATCH_OPTIONS, (reading) => handler(toPosition(reading)))
    return () => subscription.remove()
  } catch {
    return () => undefined
  }
}
