import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { Alert, AppState, Linking } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { EUROPE_BOUNDS, isWithinBounds } from '@chatynkowo/core'
import { forgetLocated, hasLocatedBefore, locate, permissionState, requestPermission, watchPosition, type Position } from '../../lib/location'
import { useToast } from '../../providers'
import type { AtlasMapHandle } from './AtlasMap'

/* The seeker's dot and the locate control. Once the permission is granted
   the position is watched whenever the Atlas is in front (the screen
   focused, the app not in the background). The first fix of a launch is
   handed to `onFirstFix`, the screen's chance to bring the camera to the
   seeker; after that the dot follows quietly: no camera movement, no
   notices. The control eases the camera to the latest fix; the first time
   it asks for the permission and a fresh fix in context, and from then on
   a one-time grant that lapsed while the app was away is asked for again
   by the Atlas itself, at most once per launch, a refusal ending that. A
   refusal the system will not ask about again opens the app settings
   through a native alert; every other miss (askable refusal, no fix,
   outside the expedition map) is a short toast above the bottom row. */

const NOTICE_MS = 4000

/* A running watch, or one still waiting for its native subscription. */
type Watch = { stop: (() => void) | null }

type UseLocateOptions = {
  /* The launch's first fix from the watch, when it lies on the expedition
     map and the control has not framed the seeker already. */
  onFirstFix: (fix: Position) => void
}

export function useLocate(map: RefObject<AtlasMapHandle | null>, { onFirstFix }: UseLocateOptions) {
  const { t } = useTranslation()
  const toast = useToast()
  const [position, setPosition] = useState<Position | null>(null)
  const [locating, setLocating] = useState(false)
  const latestFix = useRef<Position | null>(null)
  const focused = useRef(false)
  const watch = useRef<Watch | null>(null)
  /* The seeker has been framed this launch, by the control or the first fix. */
  const framed = useRef(false)
  /* The permission has been asked for this launch, by the Atlas or the
     control: the system's answer comes back through an app-state change
     that would start the watch, and with it the ask, again. */
  const asked = useRef(false)
  const onFirstFixRef = useRef(onFirstFix)
  useEffect(() => {
    onFirstFixRef.current = onFirstFix
  })
  const mounted = useRef(true)
  useEffect(
    () => () => {
      mounted.current = false
    },
    [],
  )

  const setFix = useCallback((fix: Position) => {
    latestFix.current = fix
    setPosition(fix)
  }, [])

  const onWatchFix = useCallback(
    (fix: Position) => {
      setFix(fix)
      if (framed.current) return
      framed.current = true
      if (isWithinBounds(fix, EUROPE_BOUNDS)) onFirstFixRef.current(fix)
    },
    [setFix],
  )

  const stopWatching = useCallback(() => {
    const current = watch.current
    watch.current = null
    current?.stop?.()
  }, [])

  /* Starts the watch when it may run: the Atlas in front, the permission
     granted, no watch yet. A one-time grant that lapsed is asked for again,
     once, when the seeker let the Atlas find them before; a refusal leaves
     the next ask to the control. A blur while the native subscription was
     on its way removes it the moment it arrives. */
  const startWatching = useCallback(async () => {
    const mayWatch = () => focused.current && AppState.currentState !== 'background' && !watch.current
    if (!mayWatch()) return
    const permission = await permissionState()
    let granted = permission.granted
    if (!granted && permission.canAskAgain && !asked.current && (await hasLocatedBefore()) && mayWatch()) {
      asked.current = true
      granted = (await requestPermission()).granted
      if (!granted) void forgetLocated()
    }
    if (!granted || !mayWatch()) return
    const handle: Watch = { stop: null }
    watch.current = handle
    const stop = await watchPosition(onWatchFix)
    if (watch.current === handle) handle.stop = stop
    else stop()
  }, [onWatchFix])

  /* The watch lives with the screen's focus and the app's foreground: a
     blur or an unmount ends it, the background pauses it. */
  useFocusEffect(
    useCallback(() => {
      focused.current = true
      void startWatching()
      return () => {
        focused.current = false
        stopWatching()
      }
    }, [startWatching, stopWatching]),
  )

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void startWatching()
      else if (state === 'background') stopWatching()
    })
    return () => subscription.remove()
  }, [startWatching, stopWatching])

  const notice = useCallback(
    (text: string) => {
      toast.show({ tone: 'warning', text, placement: 'bottom', durationMs: NOTICE_MS })
    },
    [toast],
  )

  /* Eases the camera to a fix, unless it lies outside the expedition map. */
  const centreOn = useCallback(
    (fix: Position) => {
      if (!isWithinBounds(fix, EUROPE_BOUNDS)) return notice(t('map.locateOutside'))
      map.current?.showPosition(fix)
    },
    [map, notice, t],
  )

  const locateMe = useCallback(async () => {
    if (locating) return
    const known = latestFix.current
    if (known) return centreOn(known)
    setLocating(true)
    asked.current = true
    const result = await locate()
    if (!mounted.current) return
    setLocating(false)
    if (result.kind === 'denied') {
      if (!result.canAskAgain) {
        Alert.alert(t('mobile:atlas.locateDenied'), undefined, [
          { text: t('mobile:common.close'), style: 'cancel' },
          { text: t('mobile:code.openSettings'), onPress: () => void Linking.openSettings() },
        ])
        return
      }
      return notice(t('mobile:atlas.locateDenied'))
    }
    /* The permission is granted now, fix or no fix: the dot follows from
       here on. */
    void startWatching()
    if (result.kind === 'failed') return notice(t('map.locateFail'))
    framed.current = true
    setFix(result.position)
    centreOn(result.position)
  }, [locating, centreOn, notice, setFix, startWatching, t])

  return { position, locating, locateMe }
}
