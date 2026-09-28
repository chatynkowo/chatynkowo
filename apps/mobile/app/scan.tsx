import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { codeFromScan } from '@chatynkowo/core'
import { postScannedCode } from '../src/features/code/scanResult'
import { Button, CameraIcon, CloseIcon, IconButton, ScreenFrame, Text, colors, iconSize, radius, space } from '../src/ui'

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
    return (
      <ScreenFrame eyebrow={t('mobile:code.scanTitle')} title={t('mobile:code.scan')} action={close} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.ask}>
          <CameraIcon size={iconSize.hero} color={colors.accentStrong} />
          <Text tone="soft" align="center">
            {permission?.canAskAgain === false ? t('mobile:code.cameraDenied') : t('mobile:code.cameraRequest')}
          </Text>
          {permission?.canAskAgain !== false ? (
            <Button variant="primary" onPress={() => void requestPermission()}>
              {t('mobile:code.cameraAllow')}
            </Button>
          ) : null}
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
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={(result) => handleScan(result.data)}
      />
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
    alignItems: 'center',
    gap: space.lg,
    paddingVertical: space.xxl,
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
  },
  hint: {
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
  },
})
