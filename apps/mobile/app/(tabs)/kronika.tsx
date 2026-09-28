import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { finalLevelId, kronikaLevels } from '@chatynkowo/core'
import { RewardCard } from '../../src/features/kronika/RewardCard'
import { useContent, useProgress } from '../../src/providers'
import { ChronicleIcon, LinkButton, MarkdownView, ScreenFrame, Text, colors, iconSize, space } from '../../src/ui'

/* The Kronika tab: the intro from the reward config and the grid of levels,
   earned and still locked; the full set unlocks the ranking invite. */
export default function KronikaScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { rewards, total } = useContent()
  const { state, foundCount } = useProgress()
  const levels = useMemo(() => kronikaLevels(rewards.levels, state.badges), [rewards.levels, state.badges])
  const completed = total > 0 && Boolean(state.badges[finalLevelId(rewards.levels)])

  return (
    <ScreenFrame
      eyebrow={t('mobile:kronika.subtitle')}
      title={rewards.treasury.title}
      action={<ChronicleIcon size={iconSize.emblem} weight="duotone" color={colors.accentStrong} />}
    >
      {rewards.treasury.intro ? (
        <MarkdownView>{rewards.treasury.intro}</MarkdownView>
      ) : (
        <Text tone="soft">{foundCount ? t('treasury.fallbackProgress', { found: foundCount, total }) : t('treasury.fallbackEmpty')}</Text>
      )}
      <View style={styles.grid} accessibilityRole="list">
        {levels.map((level) => (
          <RewardCard
            key={level.id}
            level={level}
            earned={Boolean(state.badges[level.id])}
            onPress={() => router.push({ pathname: '/reward/[id]', params: { id: level.id } })}
          />
        ))}
      </View>
      {completed ? (
        <LinkButton variant="primary" block href="/ranking">
          {t('treasury.seeRanking')}
        </LinkButton>
      ) : null}
    </ScreenFrame>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
})
