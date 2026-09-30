import * as Location from 'expo-location'
import type { LatLng } from '@chatynkowo/core'
import { STORAGE_KEYS } from '../config'
import { readJson, writeJson } from './storage'

/* The seeker's position for the Atlas: one fix when they press the locate
   control (the permission is asked for then, in context), and a watch that
   follows them while the Atlas is in front once the permission is granted.
   Foreground only, never in the background. A fix that does not arrive in
   time falls back to the last known one. The app remembers that the seeker
   let it find them once: a one-time grant ("Allow Once", "Only this time")
   lapses once the app has been away, and from then on the Atlas may ask
   again by itself, once per launch; a refusal of that ask is forgotten, so
   the next ask comes from the control again. */

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

export type Permission = {
  granted: boolean
  /* False once the system will not show the prompt again. */
  canAskAgain: boolean
}

/* The foreground permission as it stands; never asks. */
export async function permissionState(): Promise<Permission> {
  try {
    const current = await Location.getForegroundPermissionsAsync()
    return { granted: current.granted, canAskAgain: current.canAskAgain }
  } catch {
    return { granted: false, canAskAgain: false }
  }
}

/* Asks for the foreground permission; the system's prompt, or its answer
   from before when it will not prompt again. */
export async function requestPermission(): Promise<Permission> {
  try {
    const asked = await Location.requestForegroundPermissionsAsync()
    return { granted: asked.granted, canAskAgain: asked.canAskAgain }
  } catch {
    return { granted: false, canAskAgain: false }
  }
}

/* The current permission, requesting it only when the system still allows
   the prompt. */
async function ensurePermission(): Promise<Permission> {
  const current = await permissionState()
  if (current.granted || !current.canAskAgain) return current
  return requestPermission()
}

/* Whether the seeker let the Atlas find them before (see above). */
export async function hasLocatedBefore(): Promise<boolean> {
  return (await readJson<boolean>(STORAGE_KEYS.locatedOnce)) === true
}

function rememberLocated(): Promise<void> {
  return writeJson(STORAGE_KEYS.locatedOnce, true)
}

/* After a refusal of the ask the Atlas made by itself. */
export function forgetLocated(): Promise<void> {
  return writeJson(STORAGE_KEYS.locatedOnce, false)
}

export async function locate(): Promise<LocateResult> {
  try {
    const permission = await ensurePermission()
    if (!permission.granted) return { kind: 'denied', canAskAgain: permission.canAskAgain }
    /* The grant, not the fix, is what the next launch may build on. */
    void rememberLocated()
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
   function is called. For a granted permission (see `permissionState`); a
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
