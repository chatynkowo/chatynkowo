import { useEffect, useRef } from 'react'
import { InteractionManager } from 'react-native'
import { useRootNavigationState, useRouter } from 'expo-router'
import { useProgress } from '../../providers'

/* The one owner of the celebration modal, mounted by the tabs layout. When
   the tabs are the top screen of the root stack (no sheet or modal over
   them, whichever tab is showing) and the in-memory queue holds a level
   earned by a live find, the reward card is presented after the story has
   closed: a short beat after the transition, or right away when the story's
   reward banner asked for it. The story marks itself open through a flag,
   which is read again while waiting because the modal unmounts only once
   its dismiss animation has ended. */

const SETTLE_MS = 350
const STORY_POLL_MS = 200
const STORY_POLL_LIMIT = 20

export function useCelebrationPresenter() {
  const router = useRouter()
  const rootState = useRootNavigationState()
  const topRoute = rootState?.routes?.[rootState.index ?? rootState.routes.length - 1]?.name
  const isFocused = topRoute === '(tabs)'
  const { celebration, isStoryOpen, wantsCelebrateNow } = useProgress()
  const inFlight = useRef(false)
  const queued = celebration.length > 0

  useEffect(() => {
    if (!isFocused || !queued || inFlight.current) return
    inFlight.current = true
    const immediate = wantsCelebrateNow()
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let polls = 0

    const present = () => {
      if (cancelled) return
      if (isStoryOpen() && polls < STORY_POLL_LIMIT) {
        polls += 1
        timer = setTimeout(present, STORY_POLL_MS)
        return
      }
      inFlight.current = false
      if (!isStoryOpen()) router.push('/celebrate')
    }

    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return
      timer = setTimeout(present, immediate ? 0 : SETTLE_MS)
    })

    return () => {
      cancelled = true
      task.cancel()
      if (timer) clearTimeout(timer)
      inFlight.current = false
    }
  }, [isFocused, queued, isStoryOpen, wantsCelebrateNow, router])
}
