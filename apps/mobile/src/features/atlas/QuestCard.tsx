import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { PressableScale, ProgressRing, Text, mapPalette, radius, space } from '../../ui'

/* The quest line as a card on the map: the ring of finds out of the total,
   the stage, the count and the next level's distance. Tapping it opens the
   Kronika. Hidden until the content knows how many cottages there are. */

type QuestCardProps = {
  found: number
  total: number
  upcoming: { name: string; remaining: number } | null
}

export function QuestCard({ found, total, upcoming }: QuestCardProps) {
  const { t } = useTranslation()
  const router = useRouter()
  if (total === 0) return null

  const open = () => router.navigate('/kronika')

  return (
    <PressableScale
      accessibilityLabel={t('mobile:atlas.questCardAria', { found, total })}
      onPress={open}
      style={styles.card}
    >
      <ProgressRing size={34} value={found} max={total} />
      <View style={styles.text}>
        <Text variant="caption" style={styles.chromeInk} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {t('quest.stage', { stage: found + 1 })}
        </Text>
        <Text weight="bold" variant="compact" style={styles.chromeInk} numberOfLines={1}>
          {t('mobile:atlas.progress', { found, total })}
        </Text>
        <Text variant="small" style={styles.next} numberOfLines={2}>
          {upcoming ? t('quest.nextLevel', { name: upcoming.name, count: upcoming.remaining }) : t('quest.allFound')}
        </Text>
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    maxWidth: '62%',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: mapPalette.chromeBorder,
    borderRadius: radius.control,
    backgroundColor: mapPalette.chrome,
  },
  text: {
    flexShrink: 1,
    gap: 1,
  },
  chromeInk: {
    color: mapPalette.chromeInk,
  },
  next: {
    color: mapPalette.chromeInk,
    opacity: 0.85,
  },
})
