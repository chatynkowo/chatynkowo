import { useState } from 'react'
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { kronikaLevels, requiredFinds } from '@chatynkowo/core'
import { contentUrl } from '../../src/lib/content'
import { useContent, useProgress } from '../../src/providers'
import { colors, ContentImage, iconSize, MarkdownView, ProgressRing, radius, RewardIcon, SheetHandle, ShieldIcon, space, Text } from '../../src/ui'

/* One reward card in full, as a sheet sized to its content: the
   illustration, whether and when it was earned (or how far the seeker is
   from it), and its description, which scrolls inside a bounded box so the
   sheet never outgrows the window. Dismissed by the grabber, a swipe, the
   scrim or the back gesture. */

/* The description box: at most this share of the window minus what sits
   above it, never smaller than the floor. */
const BODY_MAX_SHARE = 0.7
const BODY_MIN_HEIGHT = 120

/* The rows above the description before they are measured. */
const ESTIMATED_HEAD_HEIGHT = 160

export default function RewardScreen() {
  const { t, i18n } = useTranslation()
  const { id, earned } = useLocalSearchParams<{ id: string; earned?: string }>()
  const { rewards, total } = useContent()
  const { state, foundCount } = useProgress()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [headHeight, setHeadHeight] = useState<number | null>(null)

  const level = kronikaLevels(rewards.levels, state.badges).find((candidate) => candidate.id === id)
  const badge = level ? state.badges[level.id] : undefined
  const bottomPadding = Math.max(insets.bottom, space.lg) + space.sm

  if (!level) {
    return (
      <View style={[styles.sheet, { paddingBottom: bottomPadding }]}>
        <SheetHandle style={styles.handleInset} />
        <Text variant="eyebrow">{t('quest.chronicle')}</Text>
        <Text tone="soft">{t('treasury.fallbackEmpty')}</Text>
      </View>
    )
  }

  const required = requiredFinds(level, total)
  const hasRequirement = typeof required === 'number' && required > 0
  const earnedOn = badge ? new Date(badge.earnedAt).toLocaleDateString(i18n.resolvedLanguage) : null
  const justEarned = earned === '1'

  /* The art is square and as wide as the sheet's content. */
  const artHeight = level.image ? windowWidth - 2 * space.lg : styles.emblem.height
  const above = artHeight + (headHeight ?? ESTIMATED_HEAD_HEIGHT)
  const bodyMaxHeight = Math.max(BODY_MIN_HEIGHT, windowHeight * BODY_MAX_SHARE - above)

  return (
    <View style={[styles.sheet, { paddingBottom: bottomPadding }]}>
      <View style={styles.head} onLayout={(event) => setHeadHeight(Math.round(event.nativeEvent.layout.height))}>
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
      {level.body ? (
        <ScrollView style={{ maxHeight: bodyMaxHeight }} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator>
          <MarkdownView>{level.body}</MarkdownView>
        </ScrollView>
      ) : null}
    </View>
  )
}


const styles = StyleSheet.create({
  handleInset: {
    marginTop: -space.md,
  },
  sheet: {
    gap: space.md,
    paddingTop: space.xl,
    paddingHorizontal: space.lg,
    backgroundColor: colors.pageRaised,
  },
  head: {
    gap: space.xs,
  },
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
