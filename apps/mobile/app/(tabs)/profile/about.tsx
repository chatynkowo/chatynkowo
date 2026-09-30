import { CreedCard, ExpeditionNotes, GuideSection, LoreIntro, LoreQuestions, TrailPhoto } from '../../../src/features/welcome/LoreSections'
import { Screen, space, useTabBarClearance } from '../../../src/ui'

/* About: the site's lore and guide in one scroll under the native header,
   in the site's order (the intro, the creed, the four questions, the guide
   in full with its lead and the trail at its natural height, the photo, the
   notes); the onboarding puts the questions above the creed so they can
   spread over their page. The scroll ends above the floating tab bar. */
export default function AboutScreen() {
  const tabBarClearance = useTabBarClearance()
  return (
    <Screen mode="scroll" contentStyle={{ gap: space.xl, paddingBottom: space.xxl + tabBarClearance }}>
      <LoreIntro />
      <CreedCard />
      <LoreQuestions />
      <GuideSection />
      <TrailPhoto />
      <ExpeditionNotes />
    </Screen>
  )
}
