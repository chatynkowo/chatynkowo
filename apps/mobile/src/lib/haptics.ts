import { Platform } from 'react-native'
import * as Haptics from 'expo-haptics'

/* Every haptic in the app goes through here, so the mapping from a moment
   to a feel is decided once: selection on controls, light on primary
   actions, medium on a pin and the seal, success and error on the code
   result. Fire and forget: a missing engine (a simulator, some tablets)
   never surfaces as an error. */

export type HapticKind = 'select' | 'light' | 'medium' | 'success' | 'warning' | 'error'

function perform(kind: HapticKind): Promise<void> {
  switch (kind) {
    case 'select':
      /* Selection haptics feel stronger on Android; the light impact matches iOS better. */
      return Platform.OS === 'android' ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) : Haptics.selectionAsync()
    case 'light':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    case 'medium':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    case 'success':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    case 'warning':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    case 'error':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  }
}

export function haptic(kind: HapticKind): void {
  perform(kind).catch(() => {
    // No haptic engine: silently skip.
  })
}
