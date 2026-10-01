import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Linking, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import { Stack, useIsFocused, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { codeFromScan } from '@chatynkowo/core'
import { ScannerViewfinder, type ViewfinderState } from '../src/features/code/ScannerViewfinder'
import { useCodeEntry, type ResolveOutcome } from '../src/features/code/useCodeEntry'
import { haptic } from '../src/lib/haptics'
import { useCloseModal, useContent } from '../src/providers'
import { Button, CameraIcon, CrossfadeText, KeyIcon, NATIVE_HEADER_HEIGHT, Text, colors, headerRightItems, iconSize, mapPalette, radius, sizes, space } from '../src/ui'

/* The QR scanner: the camera under a transparent bar with the torch and
   close items, gold corner marks to aim with, and a pill that says what is
   happening. A plaque code locks the camera and goes through the very same
   code path as manual entry; the story then replaces this screen. Foreign
   QR codes and unknown codes are said out loud and scanning resumes. */

/* How long the read of an unknown code shows before scanning resumes. */
const UNKNOWN_RESUME_MS = 1600
/* How long the foreign-QR notice stays, and the least between two warnings. */
const MISS_NOTICE_MS = 2000
/* The camera reports the same code many times a second; one read per beat. */
const SCAN_THROTTLE_MS = 250
/* The story arrives after the accepted line has been read. */
const OPEN_STORY_MS = 500

type Notice = 'read' | 'miss' | null

export default function ScanScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const focused = useIsFocused()
  const [permission, requestPermission] = useCameraPermissions()
  const { lookupStatus } = useContent()

  const [torch, setTorch] = useState(false)
  const [locked, setLocked] = useState(false)
  const [appActive, setAppActive] = useState(AppState.currentState === 'active')
  const [viewfinder, setViewfinder] = useState<ViewfinderState>('idle')
  const [notice, setNotice] = useState<Notice>(null)
  /* The code being checked while the lookup is still on its way. */
  const [heldCode, setHeldCode] = useState<string | null>(null)

  const lockedRef = useRef(false)
  const lastScanAt = useRef(0)
  const lastMissWarningAt = useRef(0)
  const missTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const lock = useCallback((next: boolean) => {
    lockedRef.current = next
    setLocked(next)
  }, [])

  /* The hook's reset, reached from the outcome callback declared before it. */
  const resetEntry = useRef<() => void>(() => undefined)

  const onOutcome = useCallback(
    (outcome: ResolveOutcome) => {
      setNotice(null)
      switch (outcome.kind) {
        case 'new':
        case 'found':
          setViewfinder('success')
          return
        case 'waiting':
          setViewfinder('idle')
          return
        case 'unknown':
        case 'invalid':
        case 'failed':
          setViewfinder('error')
          if (resumeTimer.current) clearTimeout(resumeTimer.current)
          resumeTimer.current = setTimeout(() => {
            resumeTimer.current = null
            resetEntry.current()
            setHeldCode(null)
            setViewfinder('idle')
            lock(false)
          }, UNKNOWN_RESUME_MS)
      }
    },
    [lock],
  )

  const entry = useCodeEntry({ onOutcome, successDelayMs: OPEN_STORY_MS })
  const { submit } = entry
  resetEntry.current = entry.reset

  /* The camera is off while the app is in the background. */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'))
    return () => subscription.remove()
  }, [])

  useEffect(
    () => () => {
      if (missTimer.current) clearTimeout(missTimer.current)
      if (resumeTimer.current) clearTimeout(resumeTimer.current)
    },
    [],
  )

  const miss = useCallback(() => {
    const now = Date.now()
    if (now - lastMissWarningAt.current >= MISS_NOTICE_MS) {
      lastMissWarningAt.current = now
      haptic('warning')
      setViewfinder('miss')
    }
    setNotice('miss')
    if (missTimer.current) clearTimeout(missTimer.current)
    missTimer.current = setTimeout(() => {
      missTimer.current = null
      setNotice((current) => (current === 'miss' ? null : current))
      setViewfinder((current) => (current === 'miss' ? 'idle' : current))
    }, MISS_NOTICE_MS)
  }, [])

  const handleScan = useCallback(
    ({ data }: BarcodeScanningResult) => {
      if (lockedRef.current) return
      const now = Date.now()
      if (now - lastScanAt.current < SCAN_THROTTLE_MS) return
      lastScanAt.current = now
      const code = codeFromScan(data)
      if (!code) {
        miss()
        return
      }
      lock(true)
      if (missTimer.current) clearTimeout(missTimer.current)
      haptic('success')
      setViewfinder('success')
      setNotice('read')
      setHeldCode(code)
      void submit(code)
    },
    [lock, miss, submit],
  )

  const close = useCloseModal()

  const toggleTorch = useCallback(() => {
    haptic('select')
    setTorch((current) => !current)
  }, [])

  const enterCode = useCallback(() => {
    if (heldCode) router.replace({ pathname: '/code', params: { code: heldCode } })
    else router.replace('/code')
  }, [router, heldCode])

  const headerItems = headerRightItems([
    { role: torch ? 'torchOff' : 'torchOn', label: t(torch ? 'mobile:code.torchOff' : 'mobile:code.torchOn'), onPress: toggleTorch },
    { role: 'close', label: t('mobile:common.close'), onPress: close },
  ])

  const lookupFailed = entry.phase === 'waiting' && lookupStatus === 'error'
  const pill =
    notice === 'read'
      ? t('mobile:code.scanRead')
      : notice === 'miss'
        ? t('mobile:code.scanNoCode')
        : entry.messageKey
          ? t(entry.messageKey, entry.messageParams)
          : t('mobile:code.scanHint')

  /* Nothing but the surface until the permission state is known: no flash
     of the rationale for someone who already granted it. */
  if (permission === null) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={headerItems} />
      </View>
    )
  }

  if (!permission.granted) {
    const blocked = permission.canAskAgain === false
    return (
      <View style={[styles.screen, styles.ask, { paddingTop: insets.top + NATIVE_HEADER_HEIGHT + space.lg, paddingBottom: insets.bottom + space.xl }]}>
        <Stack.Screen options={headerItems} />
        <View style={styles.askIcon}>
          <CameraIcon size={iconSize.emblem} weight="duotone" color={colors.accentStrong} />
        </View>
        <Text tone="soft" align="center">
          {blocked ? t('mobile:code.cameraDenied') : t('mobile:code.cameraRequest')}
        </Text>
        <View style={styles.askActions}>
          {blocked ? (
            <Button variant="primary" block onPress={() => void Linking.openSettings()}>
              {t('mobile:code.openSettings')}
            </Button>
          ) : (
            <Button variant="primary" block onPress={() => void requestPermission()}>
              {t('mobile:code.cameraAllow')}
            </Button>
          )}
          <Button block icon={<KeyIcon size={iconSize.md} color={colors.ink} />} onPress={() => router.replace('/code')}>
            {t('nav.enterCode')}
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={headerItems} />
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        enableTorch={torch}
        active={focused && appActive && !locked}
        onBarcodeScanned={handleScan}
      />
      <View pointerEvents="none" style={[styles.aim, { paddingTop: insets.top + NATIVE_HEADER_HEIGHT, paddingBottom: insets.bottom + space.xl + sizes.button + space.xl }]}>
        <ScannerViewfinder state={viewfinder} />
      </View>
      <View style={[styles.pill, { bottom: insets.bottom + space.xl }]} accessibilityLiveRegion="polite">
        <CrossfadeText value={pill} variant="small" weight="semibold" align="center" style={styles.pillText} />
        {lookupFailed ? (
          <Button block icon={<KeyIcon size={iconSize.md} color={colors.ink} />} onPress={enterCode}>
            {t('nav.enterCode')}
          </Button>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
  },
  aim: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: mapPalette.chromeBorder,
    backgroundColor: mapPalette.chrome,
  },
  pillText: {
    color: mapPalette.chromeInk,
  },
  ask: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xl,
    paddingHorizontal: space.lg,
  },
  askIcon: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 48,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  askActions: {
    alignSelf: 'stretch',
    gap: space.sm,
  },
})
