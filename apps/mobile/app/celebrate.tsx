import { RewardReveal } from '../src/features/kronika/RewardReveal'

/* The celebration route: a transparent modal the Atlas presents over itself
   once a story has closed and the celebration queue holds a level. The card
   and its rules live in RewardReveal. */
export default function CelebrateScreen() {
  return <RewardReveal />
}
