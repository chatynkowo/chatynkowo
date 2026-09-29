import { useTranslation } from 'react-i18next'
import { Stack } from 'expo-router'
import { TabStack } from '../../../src/ui'

/* The Ranking tab's own stack: the leaderboard under a large title; the
   screen adds its header items (rules, share) itself. */
export default function RankingLayout() {
  const { t } = useTranslation()
  return (
    <TabStack>
      <Stack.Screen name="index" options={{ title: t('ranking.title') }} />
    </TabStack>
  )
}
