import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { SheetHandle, Text, colors, space } from '../src/ui'

/* How the ranking is scored, as a sheet sized to its content, opened from
   the Ranking header. Dismissed by the grabber, a swipe, the scrim or the
   back gesture; nothing else to do here. */

export default function RulesScreen() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) + space.sm }]} accessible accessibilityLabel={t('ranking.rulesAria')}>
      <SheetHandle style={styles.handleInset} />
      <Text variant="eyebrow">{t('ranking.rulesTitle')}</Text>
      <Text>
        <Text weight="bold">{t('ranking.rule1Title')}. </Text>
        {t('ranking.rule1Body')}
      </Text>
      <Text>
        <Text weight="bold">{t('ranking.rule2Title')}. </Text>
        {t('ranking.rule2Body')}
      </Text>
      <Text variant="small" tone="faint">
        {t('ranking.topNote')}
      </Text>
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
})
