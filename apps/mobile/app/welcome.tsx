import { useLocalSearchParams } from 'expo-router'
import { OnboardingPager } from '../src/features/welcome/OnboardingPager'

/* The first screen of a fresh install: four pages of lore and guide ending
   in the two ways to begin. Shown only while the welcome flag is unset (the
   root's Stack.Protected); a plaque link scanned before the first launch
   arrives here with its code and is carried into the code sheet on exit. */
export default function WelcomeScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>()
  return <OnboardingPager mode="first" code={typeof code === 'string' ? code : undefined} />
}
