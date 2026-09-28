import { Image, ScrollView, StyleSheet, useWindowDimensions } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { Cottage } from '@chatynkowo/core'
import { content } from '../../lib/content'
import { colors, radius, space } from '../../ui'

/* The cottage's photos, a swipeable strip; a cottage without photos shows
   the shared illustration the site shows. */
export function StoryPhotos({ cottage }: { cottage: Cottage }) {
  const { t } = useTranslation()
  const { width } = useWindowDimensions()
  const photos = content.storyPhotos(cottage)
  const photoWidth = photos.length > 1 ? width - space.xl * 2 : width - space.lg * 2
  return (
    <ScrollView
      horizontal
      pagingEnabled={photos.length > 1}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      accessibilityRole="list"
    >
      {photos.map((uri, index) => (
        <Image
          key={uri}
          source={{ uri }}
          accessibilityLabel={t('story.photoAlt', { title: cottage.title })}
          accessibilityIgnoresInvertColors
          style={[styles.photo, { width: photoWidth }, index > 0 && styles.photoNext]}
          resizeMode="cover"
        />
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  strip: {
    paddingHorizontal: space.lg,
  },
  photo: {
    aspectRatio: 4 / 3,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  photoNext: {
    marginLeft: space.md,
  },
})
