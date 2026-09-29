import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { RewardLevel } from '@chatynkowo/core'
import { haptic } from '../../lib/haptics'
import { ChronicleIcon, MarkdownView, ProgressRing, Text, colors, iconSize, radius, space } from '../../ui'

/* The head of the Kronika grid: the subtitle with the chronicle emblem, the
   progress card (finds out of the total as a ring, the next level to earn)
   and the intro the editor published for the collection. */

export type CollectionHeaderProps = {
  found: number
  total: number
  /* The first level still locked and how many finds it still needs; null
     once everything is earned. */
  next: { level: RewardLevel; remaining: number } | null
  /* Markdown from the reward config. */
  intro: string
  /* Plain fallback shown when there is no intro. */
  note: string | null
}

export function CollectionHeader({ found, total, next, intro, note }: CollectionHeaderProps) {
  const { t } = useTranslation()
  /* Nothing to say about levels until the cottages are known. */
  const quest = total <= 0 ? null : next ? t('quest.nextLevel', { name: next.level.name, count: next.remaining }) : t('quest.allFound')
  const progress = t('mobile:atlas.progress', { found, total })

  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text variant="eyebrow" style={styles.subtitle}>
          {t('mobile:kronika.subtitle')}
        </Text>
        <ChronicleIcon size={iconSize.emblem} weight="duotone" color={colors.accentStrong} />
      </View>
      <View style={styles.card} accessible accessibilityLabel={[t('mobile:kronika.progressAria', { found, total }), quest].filter(Boolean).join('. ')}>
        <ProgressRing size={64} value={found} max={total} label={String(found)} onSettled={() => haptic('light')} />
        <View style={styles.cardText}>
          <Text weight="bold">{progress}</Text>
          {quest ? (
            <Text variant="small" tone="soft">
              {quest}
            </Text>
          ) : null}
        </View>
      </View>
      {intro ? <MarkdownView>{intro}</MarkdownView> : note ? <Text tone="soft">{note}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    gap: space.lg,
    paddingBottom: space.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  subtitle: {
    flex: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  cardText: {
    flex: 1,
    gap: space.xs,
  },
})
