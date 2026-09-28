import { Image, StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { kronikaLevels, requiredFinds } from '@chatynkowo/core'
import { contentUrl } from '../../src/lib/content'
import { useContent, useProgress } from '../../src/providers'
import { CloseIcon, IconButton, MarkdownView, RewardIcon, ScreenFrame, Text, colors, iconSize, radius, space } from '../../src/ui'

/* One reward card in full: the illustration, whether and when it was
   earned (or what it takes), and its description. */
export default function RewardScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { rewards, total } = useContent()
  const { state } = useProgress()
  const level = kronikaLevels(rewards.levels, state.badges).find((candidate) => candidate.id === id)
  const badge = level ? state.badges[level.id] : undefined

  const close = (
    <IconButton label={t('reward.closeAria')} onPress={() => router.back()}>
      <CloseIcon size={iconSize.lg} color={colors.ink} />
    </IconButton>
  )

  if (!level) {
    return (
      <ScreenFrame title={t('quest.chronicle')} action={close} edges={['top', 'left', 'right', 'bottom']}>
        <Text tone="soft">{t('treasury.fallbackEmpty')}</Text>
      </ScreenFrame>
    )
  }

  const required = requiredFinds(level, total)
  const lockedHint = typeof required !== 'number' || required <= 0 ? t('reward.lockedNone') : t('reward.lockedHint', { count: required })
  const earnedOn = badge ? new Date(badge.earnedAt).toLocaleDateString(i18n.resolvedLanguage) : null

  return (
    <ScreenFrame eyebrow={t('quest.chronicle')} title={level.name} action={close} edges={['top', 'left', 'right', 'bottom']}>
      {level.image ? (
        <Image source={{ uri: contentUrl(level.image) }} style={styles.art} resizeMode="cover" accessibilityLabel={level.name} accessibilityIgnoresInvertColors />
      ) : null}
      {badge ? (
        <View style={styles.status}>
          <RewardIcon size={iconSize.md} weight="fill" color={colors.accentStrong} />
          <Text tone="accent" weight="bold">
            {t('reward.earned')}
          </Text>
          {earnedOn ? (
            <Text tone="faint" variant="small">
              {t('mobile:kronika.earnedOn', { date: earnedOn })}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text tone="soft">{lockedHint}</Text>
      )}
      {level.body ? <MarkdownView>{level.body}</MarkdownView> : null}
    </ScreenFrame>
  )
}

const styles = StyleSheet.create({
  art: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
  },
})
