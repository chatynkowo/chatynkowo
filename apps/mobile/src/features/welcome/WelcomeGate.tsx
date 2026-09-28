import { useEffect } from 'react'
import { useRootNavigationState, useRouter } from 'expo-router'
import { STORAGE_KEYS } from '../../config'
import { readJson, writeJson } from '../../lib/storage'

/* Opens the welcome screen once, on the first launch; the screen itself
   marks the visit when it is left. Later visits come from the profile. */
export function WelcomeGate() {
  const router = useRouter()
  const ready = Boolean(useRootNavigationState()?.key)

  useEffect(() => {
    if (!ready) return
    let current = true
    void readJson<boolean>(STORAGE_KEYS.welcomeSeen).then((seen) => {
      if (current && !seen) router.push('/welcome')
    })
    return () => {
      current = false
    }
  }, [ready, router])

  return null
}

export function markWelcomeSeen() {
  return writeJson(STORAGE_KEYS.welcomeSeen, true)
}
