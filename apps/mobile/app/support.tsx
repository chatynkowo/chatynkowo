import { SupportSheet } from '../src/features/support/SupportSheet'

/* The support route: a sheet over whatever is beneath (the Elf tab, the
   profile) with the two ways to support Chatynkowo. The sheet and its
   rules live in SupportSheet. */
export default function SupportScreen() {
  return <SupportSheet />
}
