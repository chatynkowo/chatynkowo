import { useCallback, useEffect, useRef, useState } from 'react'
import { AdEventType, RewardedAd, RewardedAdEventType } from 'react-native-google-mobile-ads'
import { REWARDED_AD_UNIT_ID, adsOffered, prepareAds, type AdsPermission } from '../../lib/ads'

/* The rewarded ad of the support sheet, the one place the app shows an
   ad: the player asks for it, watches it to the end and that is the
   support (nothing is unlocked by it). One ad per request, loaded when
   asked for and shown as soon as it is in; the hook reports where the
   request stands so the sheet can say so, and calls back once the ad
   network says the ad was watched to the end.

   Before the first request the consent flow and the SDK are readied by
   src/lib/ads.ts (Google's User Messaging Platform: in the EEA the form
   configured in the AdMob account, once; elsewhere nothing), whose
   answer decides the request: personalised ads only where the player
   agreed to a profile, non-personalised otherwise, and no ad at all when
   consent is required and was not given. The consent can be changed or
   withdrawn later on the preferences screen. The unit comes from the
   build's configuration per platform; a development build without one
   uses Google's test unit, a release build offers no ad. */

export type RewardedAdStatus =
  | 'idle'
  /* Consent, the SDK and the ad itself are being readied. */
  | 'loading'
  | 'showing'
  /* Closed before the end: nothing earned. */
  | 'dismissed'
  /* No ad to show right now (no fill, no network, a timeout). */
  | 'unavailable'
  /* Consent is required and was not given. */
  | 'refused'
  | 'error'

const UNAVAILABLE_REASONS: ReadonlySet<string> = new Set(['no-fill', 'mediation-no-fill', 'network-error', 'timeout'])

/* The SDK's reason for a failed load or show (`AdErrorPayload.reason`), or
   'unknown' for an error of another shape. */
function reasonOf(error: unknown): string {
  return typeof error === 'object' && error !== null && 'reason' in error ? String((error as { reason: unknown }).reason) : 'unknown'
}

type Live = { ad: RewardedAd; release: () => void }

export function useRewardedSupportAd(onRewarded: () => void): { offered: boolean; status: RewardedAdStatus; watch: () => void } {
  const [status, setStatus] = useState<RewardedAdStatus>('idle')
  const live = useRef<Live | null>(null)
  /* Which request is current: an answer to an older one is dropped. */
  const generation = useRef(0)
  const onRewardedRef = useRef(onRewarded)
  useEffect(() => {
    onRewardedRef.current = onRewarded
  }, [onRewarded])

  const release = useCallback(() => {
    live.current?.release()
    live.current = null
  }, [])

  useEffect(
    () => () => {
      generation.current += 1
      release()
    },
    [release],
  )

  const watch = useCallback(() => {
    const unit = REWARDED_AD_UNIT_ID
    if (!unit || live.current) return
    generation.current += 1
    const mine = generation.current
    const current = () => generation.current === mine
    setStatus('loading')
    void (async () => {
      let permission: AdsPermission
      try {
        permission = await prepareAds()
      } catch (error) {
        console.warn('[support] ads init', error)
        if (current()) setStatus('error')
        return
      }
      if (!current()) return
      if (!permission.allowed) {
        setStatus('refused')
        return
      }
      const ad = RewardedAd.createForAdRequest(unit, { requestNonPersonalizedAdsOnly: !permission.personalised })
      let earned = false
      const reward = () => {
        release()
        setStatus('idle')
        onRewardedRef.current()
      }
      const fail = (error: unknown) => {
        release()
        const reason = reasonOf(error)
        if (__DEV__) console.warn('[support] ad', reason, error)
        setStatus(UNAVAILABLE_REASONS.has(reason) ? 'unavailable' : 'error')
      }
      const subscriptions = [
        ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
          ad.show().catch(fail)
        }),
        ad.addAdEventListener(AdEventType.OPENED, () => setStatus('showing')),
        /* The reward comes when the ad has been watched to the end, before
           the close; the close then settles the request. */
        ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
          earned = true
        }),
        ad.addAdEventListener(AdEventType.CLOSED, () => {
          if (earned) reward()
          else {
            release()
            setStatus('dismissed')
          }
        }),
        ad.addAdEventListener(AdEventType.ERROR, fail),
      ]
      live.current = {
        ad,
        release: () => {
          for (const unsubscribe of subscriptions) unsubscribe()
          ad.destroy()
        },
      }
      ad.load()
    })()
  }, [release])

  return { offered: adsOffered, status, watch }
}
