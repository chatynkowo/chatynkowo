import { NicknameSheet } from '../src/features/profile/NicknameSheet'

/* The nickname route: a sheet over whatever is beneath (the account
   screen, the Ranking) with the one field of the leaderboard entry. The
   sheet and its rules live in NicknameSheet. */
export default function NicknameRoute() {
  return <NicknameSheet />
}
