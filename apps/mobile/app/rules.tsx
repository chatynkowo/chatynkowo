import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { SheetRoute, Text, space } from '../src/ui'

/* How the ranking is scored, as a sheet sized to its content, opened from
   the Ranking header. Dismissed like every sheet; nothing else to do here. */

export default function RulesScreen() {
  const { t } = useTranslation()
  return (
    <SheetRoute>
      <View style={styles.sheet}>
        <Text variant="eyebrow" accessibilityRole="header">
          {t('ranking.rulesTitle')}
        </Text>
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
    </SheetRoute>
  )
}

const styles = StyleSheet.create({
  sheet: {
    gap: space.md,
    paddingTop: space.sm,
  },
})
