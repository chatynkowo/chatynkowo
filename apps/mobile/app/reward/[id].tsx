import { StyleSheet, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { formatDay, kronikaLevels, requiredFinds } from '@chatynkowo/core'
import { contentUrl } from '../../src/lib/content'
import { useContent, useProgress } from '../../src/providers'
import { colors, ContentImage, iconSize, MarkdownView, ProgressRing, radius, RewardIcon, SheetRoute, ShieldIcon, space, Text } from '../../src/ui'

/* One reward card in full, as a sheet that opens at three fifths of the
   screen and can be pulled to the top: the illustration, whether and when
   it was earned (or how far the seeker is from it), and its description,
   one scroll inside the sheet. */

const SNAP_POINTS = ['60%', '100%']

export default function RewardScreen() {
  const { t, i18n } = useTranslation()
  const { id, earned } = useLocalSearchParams<{ id: string; earned?: string }>()
  const { rewards, total } = useContent()
  const { state, foundCount } = useProgress()

  const level = kronikaLevels(rewards.levels, state.badges).find((candidate) => candidate.id === id)
  const badge = level ? state.badges[level.id] : undefined

  if (!level) {
    return (
      <SheetRoute snapPoints={SNAP_POINTS} fit={false} scroll>
        <View style={styles.content}>
          <Text variant="eyebrow">{t('quest.chronicle')}</Text>
          <Text tone="soft">{t('treasury.fallbackEmpty')}</Text>
        </View>
      </SheetRoute>
    )
  }

  const required = requiredFinds(level, total)
  const hasRequirement = typeof required === 'number' && required > 0
  const earnedOn = badge ? formatDay(badge.earnedAt, i18n.resolvedLanguage ?? i18n.language) : null
  const justEarned = earned === '1'

  return (
    <SheetRoute snapPoints={SNAP_POINTS} fit={false} scroll>
      <View style={styles.content}>
        <View style={styles.head}>
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
      </View>
    </SheetRoute>
  )
}

const styles = StyleSheet.create({
  content: {
    gap: space.md,
    paddingTop: space.sm,
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
