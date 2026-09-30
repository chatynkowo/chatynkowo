import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { kronikaLevels, requiredFinds } from '@chatynkowo/core'
import { contentUrl } from '../../src/lib/content'
import { useContent, useProgress } from '../../src/providers'
import { colors, ContentImage, iconSize, MarkdownView, ProgressRing, radius, RewardIcon, SheetHandle, ShieldIcon, space, Text } from '../../src/ui'

/* One reward card in full, as a sheet that opens part-way and can be
   pulled to the full height (the detents live in the root layout): the
   illustration, whether and when it was earned (or how far the seeker is
   from it), and its description. Everything is one scroll, so a drag on
   the text moves the sheet or the page as one gesture. Dismissed by the
   grabber, a swipe, the scrim or the back gesture. */

export default function RewardScreen() {
  const { t, i18n } = useTranslation()
  const { id, earned } = useLocalSearchParams<{ id: string; earned?: string }>()
  const { rewards, total } = useContent()
  const { state, foundCount } = useProgress()
  const insets = useSafeAreaInsets()

  const level = kronikaLevels(rewards.levels, state.badges).find((candidate) => candidate.id === id)
  const badge = level ? state.badges[level.id] : undefined
  const content = [styles.content, { paddingBottom: insets.bottom + space.lg }]

  if (!level) {
    return (
      <ScrollView style={styles.sheet} contentContainerStyle={content}>
        <SheetHandle style={styles.handleInset} />
        <Text variant="eyebrow">{t('quest.chronicle')}</Text>
        <Text tone="soft">{t('treasury.fallbackEmpty')}</Text>
      </ScrollView>
    )
  }

  const required = requiredFinds(level, total)
  const hasRequirement = typeof required === 'number' && required > 0
  const earnedOn = badge ? new Date(badge.earnedAt).toLocaleDateString(i18n.resolvedLanguage) : null
  const justEarned = earned === '1'

  return (
    <ScrollView style={styles.sheet} contentContainerStyle={content}>
      <View style={styles.head}>
        <SheetHandle style={styles.handleInset} />
        <Text variant="eyebrow">{t('quest.chronicle')}</Text>
        <Text variant="title" accessibilityRole="header">
          {level.name}
        </Text>
      </View>
      {level.image ? (
        <ContentImage uri={contentUrl(level.image)} aspectRatio={1} radius={radius.card} accessibilityLabel={level.name} style={styles.art} />
      ) : (
        <View style={styles.emblem}>
          {badge ? <RewardIcon size={iconSize.emblem} weight="fill" color={colors.accentStrong} /> : <ShieldIcon size={iconSize.emblem} color={colors.inkFaint} />}
        </View>
      )}
      {badge ? (
        <View style={styles.status}>
          <RewardIcon size={iconSize.md} weight="fill" color={colors.accentStrong} />
          <Text tone="accent" weight="bold">
            {t('reward.earned')}
          </Text>
          {justEarned ? (
            <Text tone="accent" variant="small">
              {t('mobile:celebrate.earnedNow')}
            </Text>
          ) : earnedOn ? (
            <Text tone="faint" variant="small">
              {t('mobile:kronika.earnedOn', { date: earnedOn })}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.status}>
          {hasRequirement ? <ProgressRing size={40} value={foundCount} max={required} /> : null}
          <View style={styles.statusText}>
            <Text tone="soft">{hasRequirement ? t('reward.lockedHint', { count: required }) : t('reward.lockedNone')}</Text>
            {hasRequirement ? (
              <Text variant="small" tone="faint">
                {t('mobile:kronika.levelProgress', { found: foundCount, required })}
              </Text>
            ) : null}
          </View>
        </View>
      )}
      {level.body ? <MarkdownView>{level.body}</MarkdownView> : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  handleInset: {
    marginTop: -space.md,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.pageRaised,
  },
  content: {
    gap: space.md,
    paddingTop: space.xl,
    paddingHorizontal: space.lg,
  },
  head: {
    gap: space.xs,
  },
  /* The art is square and as wide as the sheet's content. */
  art: {
    width: '100%',
  },
  emblem: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  statusText: {
    flex: 1,
    gap: space.xs,
  },
})
