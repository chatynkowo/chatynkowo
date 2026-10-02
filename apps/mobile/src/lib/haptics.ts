import { Platform } from 'react-native'
import * as Haptics from 'expo-haptics'

/* Every haptic in the app goes through here, and there are only three: a
   medium tap when the seal of a freshly found cottage stamps its story,
   success when a code is accepted and a reward is revealed, error when a
   code is refused. Nothing else vibrates: no control, row, tab, pager or
   toast answers a finger with a haptic, so the phone only stirs for a
   discovery or its refusal.

   iOS maps 1:1 to the UIKit generators. Android does not use the Vibrator
   path of expo-haptics: that is a raw 40-60 ms waveform every motor renders
   as a buzz (at full strength on motors without amplitude control) and, on
   Android 8, outside the system's touch-feedback setting. The app asks
   the view for the system's haptic feedback constants instead, so each kind
   is the short, OEM-tuned click the rest of the phone uses, and the "Touch
   feedback" setting and intensity apply to this app as well. Confirm and
   Reject exist from API 30 (Android 11); older systems keep the two
   notification waveforms for success and error. Fire and forget: a missing
   engine (a simulator, some tablets), a disabled setting or a constant the
   OS declines never surfaces as an error, and never falls back to the buzz. */

export type HapticKind = 'medium' | 'success' | 'error'

/* The Android API level; Platform.Version is a string on the other platforms. */
const API_LEVEL = Platform.OS === 'android' && typeof Platform.Version === 'number' ? Platform.Version : 0
/* HapticFeedbackConstants.CONFIRM and REJECT: Android 11. */
const CONFIRM_REJECT_API = 30

function performIOS(kind: HapticKind): Promise<void> {
  switch (kind) {
    case 'medium':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    case 'success':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    case 'error':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  }
}

/* The system constants behind each kind, by the effect AOSP plays for them:
   a heavy click for the seal, the confirm and reject effects for a result. */
function performAndroid(kind: HapticKind): Promise<void> {
  const { AndroidHaptics } = Haptics
  switch (kind) {
    case 'medium':
      return Haptics.performAndroidHapticsAsync(AndroidHaptics.Long_Press)
    case 'success':
      return API_LEVEL >= CONFIRM_REJECT_API
        ? Haptics.performAndroidHapticsAsync(AndroidHaptics.Confirm)
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    case 'error':
      return API_LEVEL >= CONFIRM_REJECT_API
        ? Haptics.performAndroidHapticsAsync(AndroidHaptics.Reject)
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  }
}

function perform(kind: HapticKind): Promise<void> {
  return Platform.OS === 'android' ? performAndroid(kind) : performIOS(kind)
}

export function haptic(kind: HapticKind): void {
  perform(kind).catch(() => {
    // No haptic engine, or a constant this system lacks: silently skip.
  })
}
