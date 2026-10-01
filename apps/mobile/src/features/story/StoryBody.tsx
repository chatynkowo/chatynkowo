import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { formatDay, type Cottage } from '@chatynkowo/core'
import { NewRewardBanner } from '../kronika/NewRewardBanner'
import { FoundIcon, MarkdownView, Text, colors, iconSize, space } from '../../ui'
import { SealStamp } from './SealStamp'
import { StoryPlayer } from './StoryPlayer'
import { StoryUnlockReveal } from './StoryUnlockReveal'

/* Everything below the hero, the same for a fresh unlock and a revisit so
   the two can never drift: the unlock or found-before line, the reward
   banner, the title, the virtue, the recording and the tale. The ceremony
   adds the seal and staggers the lines in; a revisit fades them. */

export type StoryBodyProps = {
  cottage: Cottage
  ceremony: boolean
  /* ISO date of the discovery, shown on a revisit. */
  foundAt: string | null
  /* The level earned by this find, when there is one. */
  newReward: { name: string } | null
  onOpenReward: () => void
  onSealSettled: () => void
}

export function StoryBody({ cottage, ceremony, foundAt, newReward, onOpenReward, onSealSettled }: StoryBodyProps) {
  const { t, i18n } = useTranslation()
  const mode = ceremony ? 'ceremony' : 'revisit'
  const foundOn = foundAt ? formatDay(foundAt, i18n.resolvedLanguage ?? i18n.language) : null
  let order = 0
  const next = () => order++

  return (
    <View style={styles.body}>
      {ceremony ? <SealStamp onSettled={onSealSettled} /> : null}
      <StoryUnlockReveal mode={mode} order={next()}>
        <View style={styles.unlockRow}>
          <FoundIcon size={iconSize.md} weight="fill" color={ceremony ? colors.success : colors.inkSoft} />
          <Text tone={ceremony ? 'success' : 'soft'} weight="semibold" accessibilityLiveRegion="polite">
            {ceremony ? t('story.unlocked') : t('story.foundBefore')}
          </Text>
        </View>
        {!ceremony && foundOn ? (
          <Text variant="small" tone="faint" style={styles.foundOn}>
            {t('mobile:cottages.foundOn', { date: foundOn })}
          </Text>
        ) : null}
      </StoryUnlockReveal>
      {ceremony && newReward ? (
        <StoryUnlockReveal mode={mode} order={next()}>
          <NewRewardBanner name={newReward.name} onPress={onOpenReward} />
        </StoryUnlockReveal>
      ) : null}
      <StoryUnlockReveal mode={mode} order={next()}>
        <Text variant="display" accessibilityRole="header">
          {cottage.title}
        </Text>
      </StoryUnlockReveal>
      {cottage.virtue ? (
        <StoryUnlockReveal mode={mode} order={next()}>
          <Text tone="soft">
            {t('story.virtuePrefix')} <Text weight="bold">{cottage.virtue}</Text>
          </Text>
        </StoryUnlockReveal>
      ) : null}
      <StoryUnlockReveal mode={mode} order={next()}>
        <StoryPlayer cottage={cottage} />
      </StoryUnlockReveal>
      <StoryUnlockReveal mode={mode} order={next()} kind="fade">
        <MarkdownView>{cottage.storyMarkdown}</MarkdownView>
      </StoryUnlockReveal>
    </View>
  )
}

const styles = StyleSheet.create({
  body: {
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  unlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  foundOn: {
    marginTop: space.xs,
  },
})
