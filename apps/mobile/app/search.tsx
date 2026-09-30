import { useCallback } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import type { Cottage } from '@chatynkowo/core'
import { SearchList } from '../src/features/atlas/SearchList'
import { useContent, useProgress } from '../src/providers'
import { CloseIcon, IconButton, Text, colors, iconSize, space } from '../src/ui'

/* The search sheet: a native page sheet over whatever is beneath with a
   header row (the heading and a close button), the search box and the
   cottage list. Picking a cottage dismisses the sheet back to the Atlas and
   asks it to frame the cottage; the close button, a swipe down on iOS or
   the back button on Android dismisses it. */
export default function SearchScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { cottages } = useContent()
  const { foundSlugs } = useProgress()

  const select = useCallback(
    (cottage: Cottage) => {
      router.dismissTo({ pathname: '/', params: { focus: cottage.slug } })
    },
    [router],
  )

  /* Back to the Atlas beneath, or to it afresh when the sheet was the entry
     point of a link. */
  const close = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace('/')
  }, [router])

  /* iOS presents the sheet below the status bar; Android draws it full
     screen, so the status bar's height is added there. */
  const topInset = Platform.OS === 'android' ? insets.top : 0

  return (
    <View style={[styles.screen, { paddingTop: topInset + space.lg }]}>
      <View style={styles.header}>
        <Text variant="heading" accessibilityRole="header" style={styles.title}>
          {t('mobile:atlas.list')}
        </Text>
        <IconButton label={t('mobile:common.close')} onPress={close}>
          <CloseIcon size={iconSize.lg} color={colors.ink} />
        </IconButton>
      </View>
      <SearchList cottages={cottages} foundSlugs={foundSlugs} onSelect={select} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: space.lg,
    gap: space.md,
    backgroundColor: colors.pageRaised,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  title: {
    flex: 1,
  },
})
