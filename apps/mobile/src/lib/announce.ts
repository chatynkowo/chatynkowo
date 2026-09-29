import { AccessibilityInfo } from 'react-native'

/* Speaks a message through VoiceOver or TalkBack without moving focus: code
   results, scan misses, locate errors, the unlock line, toasts. Android
   callers keep accessibilityLiveRegion="polite" on the same element so the
   text is also read when the announcement is dropped. */
export function announce(text: string): void {
  try {
    AccessibilityInfo.announceForAccessibility(text)
  } catch {
    // Nothing to do without a screen reader bridge.
  }
}
