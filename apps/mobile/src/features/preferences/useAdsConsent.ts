import { useEffect, useSyncExternalStore } from 'react'
import { adsOffered, getSnapshot, refreshConsent, subscribe, type ConsentSnapshot } from '../../lib/ads'
import { useForeground, useReconnect } from '../../providers'

/* The consent snapshot as React state, read from the SDK when the
   screen mounts and again on every reconnect and return to the
   foreground (the form may have been answered elsewhere, the region may
   have become reachable). A build with no ad never asks. */
export function useAdsConsent(): ConsentSnapshot {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const read = () => {
    if (adsOffered) refreshConsent().catch((error: unknown) => console.warn('[ads] consent', error))
  }
  useEffect(read, [])
  useReconnect(read)
  useForeground(read)
  return snapshot
}
