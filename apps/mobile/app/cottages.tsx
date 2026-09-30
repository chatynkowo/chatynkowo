import { useCallback } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import type { Cottage } from '@chatynkowo/core'
import { CottageDirectory } from '../src/features/cottages/CottageDirectory'
import { useContent, useProgress } from '../src/providers'
import { colors, space } from '../src/ui'

/* The cottage directory: a page sheet over the Atlas or the Kronika with
   every cottage, the found ones first, a search box and a filter. The
   Atlas's search control opens it with the keyboard up (`search=1`).
   Picking a cottage dismisses the sheet back to the Atlas, which frames it.
   Closed by its own button, a swipe down on iOS or the back button on
   Android. */
export default function CottagesScreen() {
  const { search } = useLocalSearchParams<{ search?: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { cottages } = useContent()
  const { state } = useProgress()

  const select = useCallback(
    (cottage: Cottage) => {
      router.dismissTo({ pathname: '/', params: { focus: cottage.slug } })
    },
    [router],
  )

  /* Back to the screen beneath, or to the Atlas afresh when the directory
     was the entry point of a link. */
  const close = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace('/')
  }, [router])

  /* iOS presents the sheet below the status bar; Android draws it full
     screen, so the status bar's height is added there. */
  const topInset = Platform.OS === 'android' ? insets.top : 0

  return (
    <View style={[styles.screen, { paddingTop: topInset + space.lg }]}>
      <CottageDirectory cottages={cottages} found={state.found} searching={search === '1'} onSelect={select} onClose={close} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: space.lg,
    backgroundColor: colors.pageRaised,
  },
})
