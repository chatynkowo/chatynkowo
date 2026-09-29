import { useEffect } from 'react'
import { useRouter } from 'expo-router'

/* A path the app does not know (a stale link, a mistyped deep link) lands
   on the Atlas instead of an error page: back to the tabs already there, or
   the Atlas in their place when this was the only screen. */
export default function NotFound() {
  const router = useRouter()
  useEffect(() => {
    router.dismissTo('/')
  }, [router])
  return null
}
