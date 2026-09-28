import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { PinInput } from '../../src/features/code/PinInput'
import { useCodeEntry } from '../../src/features/code/useCodeEntry'
import { useContent } from '../../src/providers'
import { Button, ForwardIcon, QrIcon, ScreenFrame, SealIcon, Text, colors, iconSize, space } from '../../src/ui'

/* The Code tab: the site's discovery gate — four digits from the plaque, or
   the QR scanner, both feeding the same code path. */
export default function CodeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { status, lookup } = useContent()
  const entry = useCodeEntry()
  const ready = status === 'ready' && Boolean(lookup)

  return (
    <ScreenFrame eyebrow={t('quest.gateKicker')} title={t('quest.gateTitle')} lead={t('quest.gateLead')}>
      <View style={styles.seal}>
        <SealIcon size={iconSize.emblem} weight="duotone" color={colors.accentStrong} />
      </View>
      <View style={styles.form}>
        <Text variant="small" tone="soft" weight="semibold" align="center">
          {t('quest.codeLabel')}
        </Text>
        <PinInput value={entry.value} onChange={entry.change} onSubmit={() => void entry.submit()} disabled={entry.checking || !ready} invalid={entry.phase === 'error'} />
        <Button
          variant="primary"
          block
          busy={entry.checking}
          disabled={!ready}
          iconAfter={<ForwardIcon size={iconSize.md} color={colors.accentInk} />}
          onPress={() => void entry.submit()}
        >
          {entry.checking ? t('quest.checking') : t('quest.submit')}
        </Button>
        {entry.messageKey ? (
          <Text tone={entry.phase === 'error' ? 'danger' : entry.phase === 'success' ? 'success' : 'soft'} align="center" accessibilityLiveRegion="polite">
            {t(entry.messageKey)}
          </Text>
        ) : null}
      </View>
      <Button block icon={<QrIcon size={iconSize.md} color={colors.ink} />} onPress={() => router.push('/scan')} disabled={!ready}>
        {t('mobile:code.scan')}
      </Button>
      <Text variant="small" tone="faint" align="center">
        {ready ? t('mobile:code.offlineHint') : t('mobile:common.loading')}
      </Text>
    </ScreenFrame>
  )
}

const styles = StyleSheet.create({
  seal: {
    alignItems: 'center',
  },
  form: {
    gap: space.md,
  },
})
