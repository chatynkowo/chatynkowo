import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { PinInput } from '../src/features/code/PinInput'
import { useCodeEntry, type CodePhase } from '../src/features/code/useCodeEntry'
import { useContent } from '../src/providers'
import { Button, CottageIcon, QrIcon, SealIcon, SheetHandle, Text, colors, iconSize, radius, space, type TextTone } from '../src/ui'

/* The discovery gate as a bottom sheet over whatever the seeker was doing:
   four digits from the plaque, checked the moment the fourth one lands, or
   the QR scanner. Opened from the Atlas (with the framed cottage's slug), the
   cottage sheet, the onboarding, the empty states and plaque links (with the
   code already in the route). The story replaces the sheet on success. */

const CODE_LENGTH = 4

const statusTone: Record<CodePhase, TextTone> = {
  idle: 'soft',
  checking: 'soft',
  waiting: 'soft',
  error: 'danger',
  success: 'success',
}

export default function CodeSheet() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { slug, code } = useLocalSearchParams<{ slug?: string; code?: string }>()
  const { cottageBySlug, lookupStatus, refreshLookup } = useContent()
  const target = slug ? cottageBySlug(slug) : undefined
  const entry = useCodeEntry({ expectedSlug: target?.slug, codeParam: code })

  const status = entry.messageKey ? t(entry.messageKey, entry.messageParams) : ''
  /* Typing is the primary path; the button is the assistive fallback. */
  const showSubmit = entry.value.length === CODE_LENGTH && entry.phase !== 'checking' && entry.phase !== 'success'

  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
      <SheetHandle />
      <View style={styles.seal}>
        <SealIcon size={iconSize.emblem} weight="duotone" color={colors.accentStrong} />
      </View>
      <View style={styles.heading}>
        <Text variant="eyebrow" align="center">
          {t('quest.gateKicker')}
        </Text>
        <Text variant="heading" align="center" accessibilityRole="header">
          {t('quest.gateTitle')}
        </Text>
        <Text variant="small" tone="soft" align="center">
          {t('quest.gateLead')}
        </Text>
      </View>
      {target ? (
        <View style={styles.chip}>
          <CottageIcon size={iconSize.sm} weight="fill" color={colors.accentStrong} />
          <Text variant="small" weight="semibold" numberOfLines={1} style={styles.chipText}>
            {t('mobile:code.forCottage', { title: target.title })}
          </Text>
        </View>
      ) : null}
      <View style={styles.form}>
        <Text variant="small" weight="semibold" align="center">
          {t('quest.codeLabel')}
        </Text>
        <PinInput value={entry.value} onChange={entry.change} onSubmit={() => void entry.submit()} phase={entry.phase} autoFocus />
        <View style={styles.status}>
          <Text variant="small" tone={statusTone[entry.phase]} align="center" accessibilityLiveRegion="polite" style={styles.statusText}>
            {status}
          </Text>
          {lookupStatus === 'error' ? (
            <Button variant="subtle" onPress={() => void refreshLookup()}>
              {t('mobile:common.retry')}
            </Button>
          ) : null}
        </View>
      </View>
      {showSubmit ? (
        <Button block onPress={() => void entry.submit()}>
          {t('quest.submit')}
        </Button>
      ) : null}
      <Button block icon={<QrIcon size={iconSize.md} color={colors.ink} />} onPress={() => router.replace('/scan')}>
        {t('mobile:code.scan')}
      </Button>
      <Text variant="small" tone="faint" align="center">
        {t('mobile:code.offlineHint')}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: {
    padding: space.lg,
    gap: space.md,
    backgroundColor: colors.pageRaised,
  },
  seal: {
    alignItems: 'center',
  },
  heading: {
    gap: space.xs,
  },
  chip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    maxWidth: '100%',
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  chipText: {
    flexShrink: 1,
  },
  form: {
    gap: space.md,
  },
  status: {
    alignItems: 'center',
    gap: space.sm,
  },
  statusText: {
    minHeight: 20,
  },
})
