import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'

/* Reachability, as far as the device knows, kept in one store behind one
   NetInfo listener so every consumer reads the same value and re-renders
   only on a real flip. `null` means "not yet known", which callers treat
   as online so a cold start never waits on it. The hooks built on this
   store live in src/providers/NetworkProvider.tsx. */

export function isOnline(state: NetInfoState): boolean {
  return state.isConnected === false ? false : state.isInternetReachable !== false
}

let snapshot: boolean | null = null
const listeners = new Set<() => void>()
let listening = false

function apply(state: NetInfoState) {
  const next = isOnline(state)
  if (next === snapshot) return
  snapshot = next
  listeners.forEach((listener) => listener())
}

/* The single NetInfo listener starts on first use and stays for the life
   of the process; subscribers come and go on top of it. */
function ensureListening() {
  if (listening) return
  listening = true
  NetInfo.addEventListener(apply)
}

export function subscribe(listener: () => void): () => void {
  ensureListening()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSnapshot(): boolean | null {
  return snapshot
}

/* Asks the device again (after a foreground return, when the listener may
   have slept with the app) and notifies subscribers on a flip. */
export async function refresh(): Promise<boolean | null> {
  ensureListening()
  try {
    apply(await NetInfo.fetch())
  } catch {
    // The last known value stands.
  }
  return snapshot
}
