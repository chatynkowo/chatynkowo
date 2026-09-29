import { Platform } from 'react-native'
import * as Haptics from 'expo-haptics'

/* Every haptic in the app goes through here, so the mapping from a moment
   to a feel is decided once (section 3 of the design). Fire and forget: a
   missing engine or a simulator never surfaces as an error. */

export type HapticKind = 'select' | 'light' | 'medium' | 'success' | 'warning' | 'error'

/* One switch to silence every haptic, e.g. for a screen recording. */
const HAPTICS_ENABLED = true

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
  if (!HAPTICS_ENABLED || Platform.OS === 'web') return
  try {
    perform(kind).catch(() => {
      // No haptic engine (simulator, some tablets): silently skip.
    })
  } catch {
    // Same: a haptic is never worth an error.
  }
}

/* The stable reference for components that want a hook-shaped API. */
export function useHaptic(): (kind: HapticKind) => void {
  return haptic
}
