import { StyleSheet, View } from 'react-native'
import { initials } from '@chatynkowo/core'
import { ContentImage } from './ContentImage'
import { Text, type TextVariant } from './Text'
import { colors, radius } from './tokens'

/* The one avatar of the app: a seeker's picture in a pill, or, when the
   account shares none or keeps it off the leaderboard, a disc with the
   initials of the name, the same rules as the site's ranking page. Drawn
   on the leaderboard rows and the podium, in the Ranking's account card,
   on the Profile's account row and the account screen's identity header,
   at the size each place asks for. */

export type AvatarProps = {
  /* The name the initials are taken from. */
  name: string
  uri: string | null
  /* The diameter, in points. */
  size: number
}

/* The initials grow with the disc: a line of small text on a list row, the
   display face on the account screen's large portrait. */
const LARGE = 72
const MEDIUM = 48

function initialsVariant(size: number): TextVariant {
  if (size >= LARGE) return 'title'
  return size >= MEDIUM ? 'body' : 'small'
}

export function Avatar({ name, uri, size }: AvatarProps) {
  const frame = { width: size, height: size, borderRadius: radius.pill }
  if (uri) return <ContentImage uri={uri} radius={radius.pill} style={frame} />
  return (
    <View style={[styles.initials, frame]}>
      <Text variant={initialsVariant(size)} weight="bold" tone="accent">
        {initials(name)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  initials: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceSoft,
  },
})
