import { StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ChronicleIcon, NextIcon, PressableScale, Text, colors, iconSize, radius, space } from '../../ui'

/* "Nowa nagroda: ..." inside a fresh story: the accent pill that tells the
   seeker a level was earned by this find. Pressing it closes the story and
   asks the Atlas to open the celebration right away. */
export function NewRewardBanner({ name, onPress }: { name: string; onPress: () => void }) {
  const { t } = useTranslation()
  return (
    <PressableScale onPress={onPress} haptic="light" pressedFill={colors.accentBorder} accessibilityLabel={t('mobile:story.newSealAria')} style={styles.pill}>
      <ChronicleIcon size={iconSize.md} weight="fill" color={colors.accentInk} />
      <Text tone="accentInk" weight="bold" numberOfLines={2} style={styles.text}>
        {t('achievement.newReward', { name })}
      </Text>
      <NextIcon size={iconSize.sm} color={colors.accentInk} />
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    maxWidth: '100%',
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accent,
    overflow: 'hidden',
  },
  text: {
    flexShrink: 1,
  },
})
