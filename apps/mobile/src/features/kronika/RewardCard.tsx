import { memo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import type { RewardLevel } from '@chatynkowo/core'
import { contentUrl } from '../../lib/content'
import { ContentImage, GlowPulse, PressableScale, ProgressRing, RewardIcon, ShieldIcon, Text, colors, enterUp, iconSize, radius, space } from '../../ui'

/* One tile of the Kronika grid: the card illustration (or an icon while the
   editor has not published one), the level name and its earned state. A
   locked card carries a small ring with the finds still needed; a card
   earned since the last visit wears a "new" ribbon and glows once. */

const GRID_STAGGER_MS = 60

export type RewardCardProps = {
  level: RewardLevel
  earned: boolean
  /* The seeker's finds and this level's requirement, for the corner ring. */
  found: number
  required: number | null
  /* Earned and not yet viewed: the ribbon and the one-shot glow. */
  unseen: boolean
  /* Position in the grid for the staggered entrance; null for no entrance
     (cards mounted after the first frame). */
  enterIndex: number | null
  onPress: () => void
}

export const RewardCard = memo(function RewardCard({ level, earned, found, required, unseen, enterIndex, onPress }: RewardCardProps) {
  const { t } = useTranslation()
  /* The glow needs the art's size, which the flexible column decides. */
  const [artSize, setArtSize] = useState(0)
  const showRing = !earned && typeof required === 'number' && required > 0
  const state = earned ? t('treasury.badgeEarned') : t('treasury.badgeLocked')
  const progress = showRing ? t('mobile:kronika.levelProgress', { found, required }) : null
  const accessibilityLabel = [unseen ? t('mobile:kronika.newBadge') : null, level.name, state, progress].filter(Boolean).join(', ')

  const art = (
    <View style={[styles.art, artSize ? { width: artSize } : null]}>
      {level.image ? (
        <ContentImage uri={contentUrl(level.image)} policy="disk" style={[styles.image, !earned && styles.imageLocked]} />
      ) : earned ? (
        <RewardIcon size={iconSize.hero} weight="fill" color={colors.accentStrong} />
      ) : (
        <ShieldIcon size={iconSize.hero} color={colors.inkFaint} />
      )}
      {showRing ? (
        <View style={styles.ring} accessible accessibilityLabel={progress ?? undefined}>
          <ProgressRing size={24} value={found} max={required} />
        </View>
      ) : null}
      {unseen ? (
        <View style={styles.ribbon} pointerEvents="none">
          <Text variant="small" weight="semibold" tone="accentInk" maxFontSizeMultiplier={1.2}>
            {t('mobile:kronika.newBadge')}
          </Text>
        </View>
      ) : null}
    </View>
  )

  return (
    <Animated.View entering={enterIndex === null ? undefined : enterUp(enterIndex * GRID_STAGGER_MS).springify()} style={styles.cell}>
      <PressableScale
        haptic="light"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={[styles.card, earned && styles.cardEarned, unseen && styles.cardUnseen]}
      >
        <View style={styles.artFrame} onLayout={(event) => setArtSize(Math.round(event.nativeEvent.layout.width))}>
          <GlowPulse size={artSize || 1} active={unseen && artSize > 0}>
            {art}
          </GlowPulse>
        </View>
        <Text weight="bold" numberOfLines={2} align="center">
          {level.name}
        </Text>
        <Text variant="small" tone={earned ? 'accent' : 'faint'} align="center">
          {state}
        </Text>
      </PressableScale>
    </Animated.View>
  )
})

const styles = StyleSheet.create({
  cell: {
    flex: 1,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  cardEarned: {
    borderColor: colors.lineStrong,
    backgroundColor: colors.surfaceSoft,
  },
  cardUnseen: {
    borderColor: colors.accentStrong,
  },
  artFrame: {
    width: '100%',
    aspectRatio: 1,
    marginBottom: space.xs,
  },
  art: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    backgroundColor: colors.pageRaised,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageLocked: {
    opacity: 0.35,
  },
  ring: {
    position: 'absolute',
    right: space.xs,
    bottom: space.xs,
    padding: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.pageRaised,
  },
  ribbon: {
    position: 'absolute',
    top: space.sm,
    left: space.sm,
    paddingVertical: 2,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
})
