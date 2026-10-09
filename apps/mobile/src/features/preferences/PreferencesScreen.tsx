import { useState } from 'react'
import { AdsConsentStatus } from 'react-native-google-mobile-ads'
import { useTranslation } from 'react-i18next'
import { adsOffered, consentAction, openConsentForm, type ConsentSnapshot } from '../../lib/ads'
import { useOnline, useToast } from '../../providers'
import { Screen, SettingsRow, SettingsSection, Text, WatchAdIcon, colors, iconSize, space, useTabBarClearance } from '../../ui'
import { useAdsConsent } from './useAdsConsent'

/* The preferences screen (the route /profile/preferences), reached from
   the account screen and from the Profile list, so it is there for a
   seeker who is signed out as well: the consent to ads, which Google's
   form decides. The screen names where the consent stands (given,
   refused, not answered, not required in this region, unknown) and offers the one row
   that reopens the form: the privacy options in the EEA once an answer
   was given (change it, or withdraw it as easily as it was given), the
   consent form where it is still due, nothing where the region asks for
   no consent. A build that shows no ad says so and offers nothing. */

/* The dictionary key of the consent's state. The SDK's "obtained" says
   only that the form was answered; the answer (a profile for
   personalised ads, or none) is what the seeker wants to see. */
function statusKey(snapshot: ConsentSnapshot): string {
  const { info, personalised, failed } = snapshot
  if (!info) return failed ? 'mobile:preferences.statusUnavailable' : 'mobile:preferences.statusLoading'
  switch (info.status) {
    case AdsConsentStatus.OBTAINED:
      return personalised === false ? 'mobile:preferences.statusRefused' : 'mobile:preferences.statusObtained'
    case AdsConsentStatus.REQUIRED:
      return 'mobile:preferences.statusRequired'
    case AdsConsentStatus.NOT_REQUIRED:
      return 'mobile:preferences.statusNotRequired'
    default:
      return 'mobile:preferences.statusUnknown'
  }
}

export function PreferencesScreen() {
  const { t } = useTranslation()
  const toast = useToast()
  const online = useOnline()
  const tabBarClearance = useTabBarClearance()
  const consent = useAdsConsent()
  const [opening, setOpening] = useState(false)

  const contentStyle = { gap: space.xl, paddingBottom: space.xxl + tabBarClearance }

  if (!adsOffered) {
    return (
      <Screen contentStyle={contentStyle}>
        <SettingsSection title={t('mobile:preferences.adsTitle')} footer={t('mobile:preferences.adsNotInBuild')}>
          <SettingsRow icon={<WatchAdIcon size={iconSize.md} color={colors.inkSoft} />} label={t('mobile:preferences.consentRow')} value={t('mobile:preferences.statusNotRequired')} />
        </SettingsSection>
      </Screen>
    )
  }

  const info = consent.info
  const action = consentAction(info)
  const status = t(statusKey(consent))
  const canOpen = action !== 'none' && online !== false && !opening

  /* What the section says under its rows: the network first, then why
     there is no form to open, else what the form is for. */
  const footer =
    online === false
      ? t('mobile:preferences.offline')
      : consent.failed
        ? t('mobile:preferences.unavailable')
        : info && action === 'none'
          ? t('mobile:preferences.notRequired')
          : t('mobile:preferences.adsFooter')

  async function open() {
    if (!canOpen) return
    setOpening(true)
    try {
      const shown = await openConsentForm()
      if (shown) toast.show({ tone: 'success', text: t('mobile:preferences.saved') })
    } catch (error) {
      console.warn('[ads] consent form', error)
      toast.show({ tone: 'error', text: t('mobile:preferences.failed') })
    } finally {
      setOpening(false)
    }
  }

  return (
    <Screen contentStyle={contentStyle}>
      <Text tone="soft">{t('mobile:preferences.lead')}</Text>
      <SettingsSection title={t('mobile:preferences.adsTitle')} footer={footer}>
        <SettingsRow icon={<WatchAdIcon size={iconSize.md} color={colors.accentStrong} />} label={t('mobile:preferences.consentRow')} value={status} />
        <SettingsRow
          label={action === 'grant' ? t('mobile:preferences.grant') : t('mobile:preferences.change')}
          trailing="chevron"
          disabled={!canOpen}
          accessibilityHint={t('mobile:preferences.openHint')}
          onPress={() => void open()}
        />
      </SettingsSection>
    </Screen>
  )
}
