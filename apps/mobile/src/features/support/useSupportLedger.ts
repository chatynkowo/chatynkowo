import { useSyncExternalStore } from 'react'
import { getSnapshot, subscribe, type SupportLedger } from '../../lib/support-store'

/* The support ledger as React state: the counts on this device, read once
   from storage and kept current by every record. */
export function useSupportLedger(): SupportLedger {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
