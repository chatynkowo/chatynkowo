import { Image, type ImageProps } from 'expo-image'
import { colors } from './tokens'

/* Every published picture (reward cards, story photos, avatars, pin
   images, the trail photo) goes through expo-image: cached on disk and in
   memory, cross-dissolved in, with the surface colour standing in until the
   bytes arrive. A missing uri renders the placeholder surface only. */

export type ContentImageProps = Omit<ImageProps, 'source'> & {
  uri: string | null | undefined
  aspectRatio?: number
  radius?: number
  policy?: 'memory-disk' | 'disk'
}

export function ContentImage({ uri, aspectRatio, radius = 0, policy = 'memory-disk', style, ...rest }: ContentImageProps) {
  return (
    <Image
      source={uri ? { uri } : null}
      cachePolicy={policy}
      contentFit="cover"
      placeholderContentFit="cover"
      transition={{ duration: 250, effect: 'cross-dissolve' }}
      recyclingKey={uri ?? undefined}
      accessibilityIgnoresInvertColors
      style={[{ backgroundColor: colors.surface, borderRadius: radius }, aspectRatio ? { aspectRatio } : null, style]}
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
