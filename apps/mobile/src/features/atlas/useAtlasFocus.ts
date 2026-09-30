import { useCallback, useEffect, useRef } from 'react'
import { useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router'
import type { Cottage } from '@chatynkowo/core'

/* The two ways a cottage gets framed without a pin tap: the `focus` route
   param (the cottage directory, a story link for an unfound cottage, a deep
   link) and a fresh find (`lastFound` from the progress provider). A find
   made while another screen is on top waits for the Atlas's next focus. */

export type FocusReason = 'param' | 'found'

type UseAtlasFocusOptions = {
  cottageBySlug: (slug: string) => Cottage | undefined
  lastFound: { slug: string; at: number } | null
  onFocus: (cottage: Cottage, reason: FocusReason) => void
}

export function useAtlasFocus({ cottageBySlug, lastFound, onFocus }: UseAtlasFocusOptions) {
  const router = useRouter()
  const isFocused = useIsFocused()
  const { focus } = useLocalSearchParams<{ focus?: string }>()

  const onFocusRef = useRef(onFocus)
  useEffect(() => {
    onFocusRef.current = onFocus
  })

  /* The param is consumed once the cottage exists (content may still be
     loading when a deep link arrives). */
  useEffect(() => {
    if (!focus) return
    const cottage = cottageBySlug(focus)
    if (!cottage) return
    onFocusRef.current(cottage, 'param')
    router.setParams({ focus: undefined })
  }, [focus, cottageBySlug, router])

  /* A find set before this screen existed is not replayed. */
  const handledAt = useRef<number | null>(lastFound?.at ?? null)
  const pending = useRef<{ slug: string; at: number } | null>(null)

  const frameFound = useCallback(
    (found: { slug: string; at: number }) => {
      const cottage = cottageBySlug(found.slug)
      if (cottage) onFocusRef.current(cottage, 'found')
    },
    [cottageBySlug],
  )

  useEffect(() => {
    if (!lastFound || lastFound.at === handledAt.current) return
    handledAt.current = lastFound.at
    if (isFocused) frameFound(lastFound)
    else pending.current = lastFound
  }, [lastFound, isFocused, frameFound])

  useFocusEffect(
    useCallback(() => {
      const waiting = pending.current
      if (!waiting) return
      pending.current = null
      frameFound(waiting)
    }, [frameFound]),
  )
}
