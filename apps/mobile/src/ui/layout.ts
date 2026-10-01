import type { ViewStyle } from 'react-native'
import { sizes } from './tokens'

/* The column reading content lives in: the whole width of a phone, at most
   `sizes.readable` on a tablet or in a wide window, centred beyond that.
   For the content containers of scroll views and lists and the columns of
   sheets; full-bleed screens (the Atlas) do not take it. */
export const readable: ViewStyle = { width: '100%', maxWidth: sizes.readable, alignSelf: 'center' }
