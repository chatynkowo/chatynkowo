import { useEffect } from 'react'
import { useIsFocused, useRouter } from 'expo-router'
import { useProgress } from '../../providers'

/* The one owner of the celebration modal, mounted by the tabs layout. The
   tabs are the top screen of the root stack exactly while the `(tabs)`
   route is focused (no sheet or modal over them, whichever tab is showing),
   so the focus drives the presenter: `useIsFocused` flips in the very
   commit that pops the story, and that flip re-renders this hook even
   though React Navigation otherwise shields the tabs screen from stack
   changes. When the tabs are focused and the in-memory queue holds a level
   earned by a live find, the reward card is pushed after a short settle
   (the story's native dismiss animation is still running: the native stack
   drops the story from the React tree in the pop commit itself), or after
   a brief beat when the story's reward banner asked for it. Losing focus
   before the timer fires (a sheet opened in the meantime) cancels the push. */

const SETTLE_MS = 350
/* The banner's path: long enough for the pop and the push to land in
   separate frames, so the card keeps its fade. */
const PROMPT_MS = 100

export function useCelebrationPresenter() {
  const router = useRouter()
  const isFocused = useIsFocused()
  const { celebration, wantsCelebrateNow } = useProgress()
  const queued = celebration.length > 0

  useEffect(() => {
    if (!isFocused || !queued) return
    const immediate = wantsCelebrateNow()
    const timer = setTimeout(() => router.push('/celebrate'), immediate ? PROMPT_MS : SETTLE_MS)
    return () => clearTimeout(timer)
  }, [isFocused, queued, wantsCelebrateNow, router])
}
