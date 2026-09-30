import { CreedCard, ExpeditionNotes, GuideSection, LoreCards, LoreIntro, TrailPhoto } from '../../../src/features/welcome/LoreSections'
import { Screen, space, useTabBarClearance } from '../../../src/ui'

/* About: the site's lore and guide in one scroll under the native header,
   the same six sections the onboarding spreads over its pages, the guide's
   steps as the trail. The scroll ends above the floating tab bar. */
export default function AboutScreen() {
  const tabBarClearance = useTabBarClearance()
  return (
    <Screen mode="scroll" contentStyle={{ gap: space.xl, paddingBottom: space.xxl + tabBarClearance }}>
      <LoreIntro />
      <CreedCard />
      <LoreCards />
      <GuideSection />
      <TrailPhoto />
      <ExpeditionNotes />
    </Screen>
  )
}
