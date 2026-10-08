import { SupportSheet } from '../src/features/support/SupportSheet'

/* The support route: a sheet over whatever is beneath (the profile, the
   Kronika, a tale, the Atlas after a celebration) with the two ways to
   support Chatynkowo. The sheet and its rules live in SupportSheet; the
   invitations that open it are SupportCard. */
export default function SupportScreen() {
  return <SupportSheet />
}
