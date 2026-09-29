import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import type { Cottage } from '@chatynkowo/core'
import { SearchList } from '../src/features/atlas/SearchList'
import { useContent, useProgress } from '../src/providers'
import { colors, space } from '../src/ui'

/* The search sheet: a native page sheet over whatever is beneath with the
   cottage list and its search box. Picking a cottage dismisses the sheet
   back to the Atlas and asks it to frame the cottage; a swipe down on iOS
   or the back gesture on Android dismisses it. */
export default function SearchScreen() {
  const router = useRouter()
  const { cottages } = useContent()
  const { foundSlugs } = useProgress()

  const select = (cottage: Cottage) => {
    router.dismissTo({ pathname: '/', params: { focus: cottage.slug } })
  }

  return (
    <View style={styles.screen}>
      <SearchList cottages={cottages} foundSlugs={foundSlugs} onSelect={select} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: space.lg,
    paddingHorizontal: space.lg,
    gap: space.md,
    backgroundColor: colors.pageRaised,
  },
})
