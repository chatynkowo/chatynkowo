import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useContent, useProgress } from '../../providers'
import { ChronicleIcon, Text, colors, iconSize, radius, space } from '../../ui'

const VISIBLE_MS = 5000

/* "New reward: ..." after a discovery earns a level, the way the site shows
   it; goes away on its own. */
export function AchievementToast() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { rewards } = useContent()
  const { celebration, dismissCelebration } = useProgress()
  const latest = celebration.length ? rewards.levels.find((level) => level.id === celebration[celebration.length - 1]) : null

  useEffect(() => {
    if (!celebration.length) return
    const timer = setTimeout(dismissCelebration, VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [celebration, dismissCelebration])

  if (!latest) return null
  return (
    <View pointerEvents="none" style={[styles.toast, { top: insets.top + space.md }]} accessibilityLiveRegion="polite">
      <ChronicleIcon size={iconSize.md} weight="fill" color={colors.accentInk} />
      <Text tone="accentInk" weight="bold">
        {t('achievement.newReward', { name: latest.name })}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
})
