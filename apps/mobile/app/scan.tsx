import { useRef, useState } from 'react'
import { Linking, StyleSheet, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { codeFromScan } from '@chatynkowo/core'
import { postScannedCode } from '../src/features/code/scanResult'
import { Button, CameraIcon, CloseIcon, IconButton, KeyIcon, ScreenFrame, Text, colors, iconSize, radius, space } from '../src/ui'

const MISS_NOTICE_MS = 2000

/* The QR scanner: reads the plaque's code and posts it to the Code tab,
   which submits it through the very same path as manual entry. */
export default function ScanScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const [permission, requestPermission] = useCameraPermissions()
  const [miss, setMiss] = useState(false)
  const done = useRef(false)
  const missTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleScan(data: string) {
    if (done.current) return
    const code = codeFromScan(data)
    if (!code) {
      setMiss(true)
      if (missTimer.current) clearTimeout(missTimer.current)
      missTimer.current = setTimeout(() => setMiss(false), MISS_NOTICE_MS)
      return
    }
    done.current = true
    postScannedCode(code)
    router.back()
  }

  const close = (
    <IconButton label={t('mobile:common.close')} onPress={() => router.back()}>
      <CloseIcon size={iconSize.lg} color={colors.ink} />
    </IconButton>
  )

  if (!permission?.granted) {
    const blocked = permission?.canAskAgain === false
    return (
      <ScreenFrame scroll={false} eyebrow={t('mobile:code.scanTitle')} title={t('mobile:code.scan')} action={close} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.ask}>
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
            <Button block icon={<KeyIcon size={iconSize.md} color={colors.ink} />} onPress={() => router.back()}>
              {t('nav.enterCode')}
            </Button>
          </View>
        </View>
      </ScreenFrame>
    )
  }

  return (
    <ScreenFrame scroll={false} padded={false} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.bar}>
        <Text variant="title">{t('mobile:code.scanTitle')}</Text>
        {close}
      </View>
      <View style={styles.camera}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={(result) => handleScan(result.data)}
        />
        <View pointerEvents="none" style={styles.viewfinder} />
      </View>
      <View style={styles.hint}>
        <Text tone={miss ? 'danger' : 'soft'} align="center" accessibilityLiveRegion="polite">
          {miss ? t('mobile:code.scanNoCode') : t('mobile:code.scanHint')}
        </Text>
      </View>
    </ScreenFrame>
  )
}

const styles = StyleSheet.create({
  ask: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xl,
    paddingBottom: space.xxl * 2,
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
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
  },
  camera: {
    flex: 1,
    marginHorizontal: space.lg,
    borderRadius: radius.card,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  /* Where to hold the plaque's code; the scanner itself reads the whole frame. */
  viewfinder: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: colors.accentStrong,
    borderRadius: radius.card,
  },
  hint: {
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
  },
})
