import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { ReduceMotion, enterUp, fade, useReducedMotion } from '../../ui'

/* The ceremony's stagger: below the hero, each piece of the story (the
   unlock line, the reward banner, the title, the virtue, the player) rises
   into place 90 ms after the one before, once the seal has stamped; the tale
   itself fades in, and the support card closes the stagger after it. A
   revisit, and every reduced-motion open, is one short fade. */

export type StoryRevealMode = 'ceremony' | 'revisit'

type StoryUnlockRevealProps = {
  mode: StoryRevealMode
  /* Position in the stagger, from 0. */
  order?: number
  /* Rise into place, or only fade (the markdown body). */
  kind?: 'rise' | 'fade'
  style?: StyleProp<ViewStyle>
  children: ReactNode
}

/* The seal stamps at 250 ms and settles around 400 ms; the lines follow. */
const STAGGER_START_MS = 400
const STAGGER_STEP_MS = 90
const BODY_FADE_MS = 300
const REVISIT_FADE_MS = 200

export function StoryUnlockReveal({ mode, order = 0, kind = 'rise', style, children }: StoryUnlockRevealProps) {
  const reduceMotion = useReducedMotion()
  const delay = STAGGER_START_MS + order * STAGGER_STEP_MS
  const entering = reduceMotion
    ? /* The one animation kept under reduced motion: a plain fade. */
      FadeIn.duration(REVISIT_FADE_MS).reduceMotion(ReduceMotion.Never)
    : mode === 'revisit'
      ? fade(REVISIT_FADE_MS)
      : kind === 'fade'
        ? fade(BODY_FADE_MS).delay(delay)
        : enterUp(delay)
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  )
}
