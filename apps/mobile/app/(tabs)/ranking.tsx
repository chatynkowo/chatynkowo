import { useCallback, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import type { LeaderboardRow as Row } from '@chatynkowo/api'
import { LeaderboardRow } from '../../src/features/ranking/LeaderboardRow'
import { fetchLeaderboard } from '../../src/lib/sync'
import { useContent, useProgress, useSession } from '../../src/providers'
import { Button, IconButton, ProfileIcon, ScreenFrame, SyncIcon, Text, colors, iconSize, radius, space } from '../../src/ui'

/* The Ranking tab: the leaderboard from the shared backend, the account
   block (native sign-in behind the feature flag) and the site's rules. */
export default function RankingScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { total, offline } = useContent()
  const { pendingCount } = useProgress()
  const account = useSession()
  const [rows, setRows] = useState<Row[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [signInFailed, setSignInFailed] = useState(false)

  const load = useCallback(async () => {
    if (!total) return
    setState('loading')
    try {
      setRows(await fetchLeaderboard(total))
      setState('ready')
    } catch {
      setState('error')
    }
  }, [total])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  async function signIn(provider: 'google' | 'apple') {
    setSignInFailed(false)
    const ok = await account.signIn(provider)
    if (!ok) setSignInFailed(true)
    else void load()
  }

  const mine = (row: Row) => Boolean(account.profile && row.public_id === account.profile.public_id)
  const myPlace = rows.findIndex(mine)

  return (
    <ScreenFrame
      eyebrow={t('ranking.eyebrow')}
      title={t('ranking.title')}
      lead={t('ranking.lede')}
      action={
        <IconButton label={t('mobile:ranking.profile')} onPress={() => router.push('/profile')}>
          <ProfileIcon size={iconSize.lg} color={colors.ink} />
        </IconButton>
      }
    >
      <View style={styles.account} accessibilityLiveRegion="polite">
        {!account.enabled ? (
          <Text tone="soft">{t('mobile:ranking.signInUnavailable')}</Text>
        ) : account.session ? (
          <>
            <Text>
              {t('ranking.signedInPrefix')}{' '}
              <Text weight="bold">{account.profile?.display_name || t('ranking.defaultName')}</Text>
            </Text>
            <Text tone="soft" variant="small">
              {myPlace >= 0 ? t('mobile:ranking.yourPlace', { place: myPlace + 1 }) : t('mobile:ranking.notRanked')}
            </Text>
          </>
        ) : (
          <>
            <Text variant="heading">{t('mobile:ranking.signInTitle')}</Text>
            <Text tone="soft">{t('mobile:ranking.signInLead')}</Text>
            <View style={styles.actions}>
              <Button variant="primary" busy={account.busy} onPress={() => void signIn('google')}>
                {t('mobile:ranking.signInGoogle')}
              </Button>
              {Platform.OS === 'ios' ? (
                <Button busy={account.busy} onPress={() => void signIn('apple')}>
                  {t('mobile:ranking.signInApple')}
                </Button>
              ) : null}
            </View>
            {signInFailed ? <Text tone="danger">{t('mobile:ranking.signInFailed')}</Text> : null}
          </>
        )}
        {pendingCount > 0 ? (
          <View style={styles.pending}>
            <SyncIcon size={iconSize.sm} color={colors.inkSoft} />
            <Text variant="small" tone="soft">
              {t('mobile:common.pendingSync', { count: pendingCount })}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.board}>
        <View style={styles.boardHeader}>
          <Text variant="heading" accessibilityRole="header">
            {t('ranking.allTitle')}
          </Text>
          <Text variant="small" tone="faint">
            {t('ranking.allSubtitle')}
          </Text>
        </View>
        {rows.map((row, index) => (
          <LeaderboardRow key={row.public_id} row={row} place={index + 1} total={total} mine={mine(row)} />
        ))}
        {state !== 'ready' || !rows.length ? (
          <View style={styles.status}>
            <Text tone={state === 'error' ? 'danger' : 'soft'} align="center">
              {state === 'error' ? (offline ? t('mobile:common.offlineNoData') : t('ranking.loadError')) : state === 'loading' ? t('ranking.loading') : t('ranking.empty')}
            </Text>
            {state === 'error' ? (
              <Button onPress={() => void load()}>{t('mobile:common.retry')}</Button>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.rules} accessibilityLabel={t('ranking.rulesAria')}>
        <Text variant="eyebrow">{t('ranking.rulesTitle')}</Text>
        <Text>
          <Text weight="bold">{t('ranking.rule1Title')}. </Text>
          {t('ranking.rule1Body')}
        </Text>
        <Text>
          <Text weight="bold">{t('ranking.rule2Title')}. </Text>
          {t('ranking.rule2Body')}
        </Text>
      </View>
    </ScreenFrame>
  )
}

const styles = StyleSheet.create({
  account: {
    gap: space.sm,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  actions: {
    gap: space.sm,
    marginTop: space.xs,
  },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xs,
  },
  board: {
    gap: space.xs,
  },
  boardHeader: {
    marginBottom: space.sm,
  },
  status: {
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.xl,
  },
  rules: {
    gap: space.sm,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
  },
})
