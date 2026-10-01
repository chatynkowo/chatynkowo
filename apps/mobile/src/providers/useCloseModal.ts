import { useCallback } from 'react'
import { useRouter } from 'expo-router'
import { useBoot } from './BootProvider'

/* Closes a modal route: back to whatever is beneath, or, when the modal was
   the entry point of a link, to the Atlas, which on a fresh install is
   still the onboarding. */
export function useCloseModal() {
  const router = useRouter()
  const { welcomeSeen } = useBoot()
  return useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace(welcomeSeen ? '/' : '/welcome')
  }, [router, welcomeSeen])
}
