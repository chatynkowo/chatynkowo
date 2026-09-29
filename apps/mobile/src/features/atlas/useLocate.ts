import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { Alert, Linking } from 'react-native'
import { useTranslation } from 'react-i18next'
import { EUROPE_BOUNDS, isWithinBounds } from '@chatynkowo/core'
import { haptic } from '../../lib/haptics'
import { locate, type Position } from '../../lib/location'
import { useToast } from '../../providers'
import type { AtlasMapHandle } from './AtlasMap'

/* The locate control: asks for the position in context, shows the seeker's
   dot and eases the camera to it. A refusal the system will not ask about
   again opens the app settings through a native alert; every other miss
   (askable refusal, no fix, outside the expedition map) is a short toast
   above the bottom row. */

const NOTICE_MS = 4000

export function useLocate(map: RefObject<AtlasMapHandle | null>) {
  const { t } = useTranslation()
  const toast = useToast()
  const [position, setPosition] = useState<Position | null>(null)
  const [locating, setLocating] = useState(false)
  const mounted = useRef(true)
  useEffect(
    () => () => {
      mounted.current = false
    },
    [],
  )

  const notice = useCallback(
    (text: string) => {
      /* The toast fires the warning haptic itself. */
      toast.show({ tone: 'warning', text, placement: 'bottom', durationMs: NOTICE_MS })
    },
    [toast],
  )

  const locateMe = useCallback(async () => {
    if (locating) return
    setLocating(true)
    const result = await locate()
    if (!mounted.current) return
    setLocating(false)
    if (result.kind === 'denied') {
      if (!result.canAskAgain) {
        haptic('warning')
        Alert.alert(t('mobile:atlas.locateDenied'), undefined, [
          { text: t('mobile:common.close'), style: 'cancel' },
          { text: t('mobile:code.openSettings'), onPress: () => void Linking.openSettings() },
        ])
        return
      }
      return notice(t('mobile:atlas.locateDenied'))
    }
    if (result.kind === 'failed') return notice(t('map.locateFail'))
    if (!isWithinBounds(result.position, EUROPE_BOUNDS)) return notice(t('map.locateOutside'))
    haptic('light')
    setPosition(result.position)
    map.current?.showPosition(result.position)
  }, [locating, map, notice, t])

  return { position, locating, locateMe }
}
