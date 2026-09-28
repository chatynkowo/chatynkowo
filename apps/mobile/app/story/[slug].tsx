import { StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { StoryPhotos } from '../../src/features/story/StoryPhotos'
import { StoryPlayer } from '../../src/features/story/StoryPlayer'
import { useContent } from '../../src/providers'
import { CloseIcon, FoundIcon, IconButton, MarkdownView, ScreenFrame, Text, colors, iconSize, space } from '../../src/ui'

/* A cottage's tale, presented as a modal after a code opens it (or from the
   Atlas for a cottage already found): photos, the unlock line, the virtue,
   the recording and the story text. The player stops itself when the modal
   closes (see lib/audio.ts). */
export default function StoryScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { slug, revisit } = useLocalSearchParams<{ slug: string; revisit?: string }>()
  const { cottageBySlug } = useContent()
  const cottage = cottageBySlug(slug)
  const previouslyFound = revisit === '1'

  const close = (
    <IconButton label={t('story.closeAria')} onPress={() => router.back()}>
      <CloseIcon size={iconSize.lg} color={colors.ink} />
    </IconButton>
  )

  if (!cottage) {
    return (
      <ScreenFrame title={t('mobile:story.notFound')} action={close} edges={['top', 'left', 'right', 'bottom']}>
        <Text tone="soft">{t('atlas.errorBody')}</Text>
      </ScreenFrame>
    )
  }

  return (
    <ScreenFrame padded={false} edges={['top', 'left', 'right', 'bottom']} contentStyle={styles.frame}>
      <View style={styles.close}>{close}</View>
      <StoryPhotos cottage={cottage} />
      <View style={styles.body}>
        <View style={styles.unlocked}>
          <FoundIcon size={iconSize.md} weight="fill" color={previouslyFound ? colors.inkSoft : colors.success} />
          <Text tone={previouslyFound ? 'soft' : 'success'} weight="semibold">
            {previouslyFound ? t('story.foundBefore') : t('story.unlocked')}
          </Text>
        </View>
        <Text variant="display" accessibilityRole="header">
          {cottage.title}
        </Text>
        {cottage.virtue ? (
          <Text tone="soft">
            {t('story.virtuePrefix')} <Text weight="bold">{cottage.virtue}</Text>
          </Text>
        ) : null}
        <StoryPlayer cottage={cottage} />
        <MarkdownView>{cottage.storyMarkdown}</MarkdownView>
      </View>
    </ScreenFrame>
  )
}

const styles = StyleSheet.create({
  frame: {
    paddingTop: space.sm,
  },
  close: {
    alignItems: 'flex-end',
    paddingHorizontal: space.lg,
  },
  body: {
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  unlocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
})
