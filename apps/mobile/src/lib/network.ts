import { useEffect, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'

/* Reachability, as far as the device knows. `null` means "not yet known",
   which callers treat as online so a cold start never waits on it. */

export function useOnline(): boolean | null {
  const [online, setOnline] = useState<boolean | null>(null)
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(state.isConnected === false ? false : state.isInternetReachable !== false)
    })
    return unsubscribe
  }, [])
  return online
}

/* Calls `listener` every time the device comes back online. */
export function onReconnect(listener: () => void): () => void {
  let wasOnline: boolean | null = null
  return NetInfo.addEventListener((state) => {
    const online = state.isConnected !== false && state.isInternetReachable !== false
    if (online && wasOnline === false) listener()
    wasOnline = online
  })
}
