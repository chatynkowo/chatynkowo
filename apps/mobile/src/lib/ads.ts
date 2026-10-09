import { Platform } from 'react-native'
import {
  AdsConsent,
  AdsConsentDebugGeography,
  AdsConsentPrivacyOptionsRequirementStatus,
  AdsConsentStatus,
  MobileAds,
  TestIds,
  type AdsConsentInfo,
  type AdsConsentInfoOptions,
} from 'react-native-google-mobile-ads'
import { ADMOB_REWARDED_ANDROID_UNIT_ID, ADMOB_REWARDED_IOS_UNIT_ID } from '../config'

/* The ads SDK and Google's consent (the User Messaging Platform), the
   one module that talks to either. Two things read it: the support
   sheet's rewarded ad (src/features/support/useRewardedSupportAd.ts),
   which needs the SDK ready and the answer to "may an ad be requested,
   and may it be personalised", and the preferences screen
   (src/features/preferences), which shows where the consent stands and
   opens the form again, so a seeker in the EEA can change or withdraw
   the consent as easily as it was given (Google asks for that entry
   point, the GDPR for the ease). The consent info is one snapshot
   subscribers re-render on, in the shape of the other device stores.

   A development build asks the SDK to behave as if the device were in
   the EEA, so the form and the privacy options can be looked at on an
   emulator; the SDK honours that only on test devices (an emulator is
   one). */

/* The unit the build's configuration names for this platform; Google's
   test unit in a development build without one; none in a release build
   without one, which then offers no ad at all. */
export const REWARDED_AD_UNIT_ID: string | null = (() => {
  const configured = Platform.select({ android: ADMOB_REWARDED_ANDROID_UNIT_ID, ios: ADMOB_REWARDED_IOS_UNIT_ID }) || ''
  if (configured) return configured
  return __DEV__ ? TestIds.REWARDED : null
})()

export const adsOffered = REWARDED_AD_UNIT_ID !== null

const CONSENT_OPTIONS: AdsConsentInfoOptions = __DEV__ ? { debugGeography: AdsConsentDebugGeography.EEA } : {}

export type ConsentSnapshot = {
  /* The SDK's word on the consent; null until the first read. */
  info: AdsConsentInfo | null
  /* What the seeker actually chose where the form was answered: a
     profile for personalised ads or not. The SDK's status says only
     that an answer was given ("obtained" covers a refusal too); the
     answer itself is in the stored choices. Null while unknown. */
  personalised: boolean | null
  /* The last read or form failed (no message configured, no network). */
  failed: boolean
}

let snapshot: ConsentSnapshot = { info: null, personalised: null, failed: false }
const listeners = new Set<() => void>()

function publish(next: ConsentSnapshot) {
  snapshot = next
  listeners.forEach((listener) => listener())
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSnapshot(): ConsentSnapshot {
  return snapshot
}

/* The seeker's choice behind an answered form: where the GDPR applies,
   the profile purpose of the stored TC string; elsewhere nothing was
   asked and ads may be personalised. */
async function readChoice(info: AdsConsentInfo): Promise<boolean | null> {
  if (info.status !== AdsConsentStatus.OBTAINED) return null
  const gdprApplies = await AdsConsent.getGdprApplies()
  return gdprApplies ? (await AdsConsent.getUserChoices()).createAPersonalisedAdsProfile : true
}

/* Asks the SDK where the consent stands (its answer depends on the
   region and on what the seeker said before) and publishes it with the
   choice behind it. Throws when the SDK could not say, with the failure
   published. */
export async function refreshConsent(): Promise<AdsConsentInfo> {
  try {
    await AdsConsent.requestInfoUpdate(CONSENT_OPTIONS)
    const info = await AdsConsent.getConsentInfo()
    publish({ info, personalised: await readChoice(info), failed: false })
    return info
  } catch (error) {
    publish({ ...snapshot, failed: true })
    throw error
  }
}

export type AdsPermission = { allowed: true; personalised: boolean } | { allowed: false }

let prepared: Promise<AdsPermission> | null = null

/* Consent (the form, when the region requires one and it was not shown
   yet), then the SDK, once per process; a later ad request reuses the
   answer until the preferences screen changes it. The answer decides the
   request: personalised ads only where the seeker agreed to a profile,
   non-personalised otherwise, none when consent is required and was not
   given. A consent flow that fails (no message configured yet, no
   network) falls back to non-personalised requests, the one kind that
   needs no profile. */
export function prepareAds(): Promise<AdsPermission> {
  if (!prepared) {
    prepared = (async () => {
      let permission: AdsPermission
      try {
        const info = await AdsConsent.gatherConsent(CONSENT_OPTIONS)
        const personalised = await readChoice(info)
        publish({ info, personalised, failed: false })
        if (!info.canRequestAds) return { allowed: false }
        permission = { allowed: true, personalised: personalised ?? false }
      } catch (error) {
        if (__DEV__) console.warn('[ads] consent', error)
        publish({ ...snapshot, failed: true })
        permission = { allowed: true, personalised: false }
      }
      await MobileAds().initialize()
      return permission
    })()
    /* A failed initialisation is reported to this request; the next one
       tries again. */
    prepared.catch(() => {
      prepared = null
    })
  }
  return prepared
}

/* What the preferences screen can offer, from the SDK's word: the
   privacy options form (the EEA, once consent was given or refused), the
   consent form itself (consent required and not answered yet), or
   nothing (a region with no consent to give, or an SDK that could not
   say). */
export type ConsentAction = 'change' | 'grant' | 'none'

export function consentAction(info: AdsConsentInfo | null): ConsentAction {
  if (!info) return 'none'
  if (info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED) return 'change'
  if (info.status === AdsConsentStatus.REQUIRED && info.isConsentFormAvailable) return 'grant'
  return 'none'
}

/* Opens the form the current state calls for and publishes the new
   answer; the next ad request reads it afresh. Resolves to false when
   there was no form to open. Throws when the SDK refused or could not be
   reached. */
export async function openConsentForm(): Promise<boolean> {
  const info = snapshot.info ?? (await refreshConsent())
  const action = consentAction(info)
  if (action === 'none') return false
  if (action === 'change') await AdsConsent.showPrivacyOptionsForm()
  else await AdsConsent.loadAndShowConsentFormIfRequired()
  prepared = null
  await refreshConsent()
  return true
}
