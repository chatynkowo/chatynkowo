import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Image, type ImageErrorEventData, type ImageLoadEventData, type ImageProps } from 'expo-image'
import { useReconnect } from '../providers/NetworkProvider'
import { WarningIcon, iconSize } from './icons'
import { colors } from './tokens'

/* Every published picture (reward cards, story photos, avatars, pin
   images, the trail photo) goes through expo-image: cached on disk and in
   memory, cross-dissolved in, with the surface colour standing in until the
   bytes arrive. A missing uri renders the placeholder surface only.

   expo-image reports a failed load once and never asks again, so a picture
   that failed on a flaky connection (or on a cold start with the network
   still settling) stayed blank until its view happened to remount. The load
   is retried here instead: a few times with a growing pause, at once when
   the device comes back online, and after the last failure the surface
   holds a quiet warning mark in place of the picture. */

export type ContentImageProps = Omit<ImageProps, 'source'> & {
  uri: string | null | undefined
  aspectRatio?: number
  radius?: number
  policy?: 'memory-disk' | 'disk'
}

/* The pause before each retry; the load gives up after the last one. */
const RETRY_DELAYS_MS = [1000, 3000, 8000]

/* `waiting` is the pause before a retry, `failed` the state after the last
   one; both show the bare surface, only `failed` adds the mark. */
type LoadPhase = 'loading' | 'ready' | 'waiting' | 'failed'

export function ContentImage(props: ContentImageProps) {
  /* The retry state belongs to one uri: a new uri starts afresh. */
  return <RetryingImage key={props.uri ?? ''} {...props} />
}

function RetryingImage({ uri, aspectRatio, radius = 0, policy = 'memory-disk', style, accessibilityLabel, onLoad, onError, ...rest }: ContentImageProps) {
  const [phase, setPhase] = useState<LoadPhase>('loading')
  /* Remounting the image view is what starts a new load. */
  const [generation, setGeneration] = useState(0)
  const retries = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])
  useEffect(() => clearTimer, [clearTimer])

  const reload = useCallback(() => {
    setPhase('loading')
    setGeneration((current) => current + 1)
  }, [])

  const loaded = (event: ImageLoadEventData) => {
    setPhase('ready')
    onLoad?.(event)
  }

  const failed = (event: ImageErrorEventData) => {
    const attempt = retries.current
    if (attempt < RETRY_DELAYS_MS.length) {
      retries.current = attempt + 1
      setPhase('waiting')
      timer.current = setTimeout(() => {
        timer.current = null
        reload()
      }, RETRY_DELAYS_MS[attempt])
    } else {
      setPhase('failed')
    }
    onError?.(event)
  }

  /* Back online: whatever was waiting or had given up starts over. */
  useReconnect(() => {
    if (phase !== 'waiting' && phase !== 'failed') return
    clearTimer()
    retries.current = 0
    reload()
  })

  const frame = [{ backgroundColor: colors.surface, borderRadius: radius }, aspectRatio ? { aspectRatio } : null, style]

  if (phase === 'failed') {
    return (
      <View style={[frame, styles.fallback]} accessible={Boolean(accessibilityLabel)} accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
        <WarningIcon size={iconSize.lg} color={colors.inkFaint} />
      </View>
    )
  }

  return (
    <Image
      key={generation}
      source={uri ? { uri } : null}
      cachePolicy={policy}
      contentFit="cover"
      placeholderContentFit="cover"
      transition={{ duration: 250, effect: 'cross-dissolve' }}
      recyclingKey={uri ?? undefined}
      accessibilityIgnoresInvertColors
      accessibilityLabel={accessibilityLabel}
      onLoad={loaded}
      onError={failed}
      style={frame}
      {...rest}
    />
  )
}

/* Warms the cache for pictures a screen is about to show. */
export async function prefetchContent(uris: string[]): Promise<void> {
  const list = uris.filter((uri): uri is string => Boolean(uri))
  if (!list.length) return
  try {
    await Image.prefetch(list, 'memory-disk')
  } catch {
    // A cold cache is only slower, never wrong.
  }
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
})
