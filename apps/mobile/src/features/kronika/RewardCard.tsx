import { Image, Pressable, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { RewardLevel } from '@chatynkowo/core'
import { contentUrl } from '../../lib/content'
import { RewardIcon, ShieldIcon, Text, colors, iconSize, radius, space } from '../../ui'

/* One tile of the Kronika grid: the card illustration (or an icon while the
   editor has not published one), the level name and its earned state. */
export function RewardCard({ level, earned, onPress }: { level: RewardLevel; earned: boolean; onPress: () => void }) {
  const { t } = useTranslation()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${level.name}, ${earned ? t('treasury.badgeEarned') : t('treasury.badgeLocked')}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, earned && styles.cardEarned, pressed && styles.pressed]}
    >
      <View style={styles.art}>
        {level.image ? (
          <Image source={{ uri: contentUrl(level.image) }} style={[styles.image, !earned && styles.imageLocked]} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : earned ? (
          <RewardIcon size={iconSize.hero} weight="fill" color={colors.accentStrong} />
        ) : (
          <ShieldIcon size={iconSize.hero} color={colors.inkFaint} />
        )}
      </View>
      <Text weight="bold" numberOfLines={2} align="center">
        {level.name}
      </Text>
      <Text variant="small" tone={earned ? 'accent' : 'faint'} align="center">
        {earned ? t('treasury.badgeEarned') : t('treasury.badgeLocked')}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexBasis: '47%',
    flexGrow: 1,
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
  pressed: {
    opacity: 0.9,
  },
  art: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    backgroundColor: colors.pageRaised,
    overflow: 'hidden',
    marginBottom: space.xs,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageLocked: {
    opacity: 0.35,
  },
})
