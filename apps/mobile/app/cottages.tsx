import { useCallback } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CottageDirectory, type DirectoryEntry } from '../src/features/kronika/CottageDirectory'
import { useContent, useProgress } from '../src/providers'
import { colors, space } from '../src/ui'

/* The cottage directory: a page sheet over the Kronika with every cottage,
   the found ones first. A found cottage opens its tale on top; one still
   waiting dismisses the sheet back to the Atlas, which frames its clue.
   Closed by its own button, a swipe down on iOS or the back gesture on
   Android. */
export default function CottagesScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { cottages } = useContent()
  const { state } = useProgress()

  const select = useCallback(
    ({ cottage, foundAt }: DirectoryEntry) => {
      if (foundAt) router.push({ pathname: '/story/[slug]', params: { slug: cottage.slug } })
      else router.dismissTo({ pathname: '/', params: { focus: cottage.slug } })
    },
    [router],
  )

  /* Back to the Kronika beneath, or to it afresh when the directory was the
     entry point of a link. */
  const close = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace('/kronika')
  }, [router])

  return (
    <View style={[styles.screen, { paddingTop: (Platform.OS === 'android' ? insets.top : 0) + space.lg }]}>
      <CottageDirectory cottages={cottages} found={state.found} onSelect={select} onClose={close} />
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
