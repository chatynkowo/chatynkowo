import { CreedCard, ExpeditionNotes, GuideSteps, LoreCards, LoreIntro, TrailPhoto } from '../../../src/features/welcome/LoreSections'
import { Screen, space } from '../../../src/ui'

/* About: the site's lore and guide in one scroll under the native header,
   the same six sections the onboarding spreads over its pages. */
export default function AboutScreen() {
  return (
    <Screen mode="scroll" contentStyle={{ gap: space.xl }}>
      <LoreIntro />
      <CreedCard />
      <LoreCards />
      <GuideSteps />
      <TrailPhoto />
      <ExpeditionNotes />
    </Screen>
  )
}
