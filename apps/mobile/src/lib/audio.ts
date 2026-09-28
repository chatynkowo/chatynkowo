import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import {
  requestNotificationPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioStatus,
} from 'expo-audio'

/* The story player on top of expo-audio: one recording at a time, playback
   that continues in the background, lock-screen and notification controls
   with the story's title and photo. A language without its own recording
   falls back to the Polish original (core's storyAudio hands both URLs
   over) as soon as the first one fails to load. */

export type StoryTrack = {
  id: string
  url: string
  fallbackUrl?: string
  title: string
  artist: string
  artwork?: string
}

type PlayerStatus = 'unavailable' | 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error'

let configured: Promise<void> | null = null

/* The audio session: keep playing when the app goes to the background and
   take the lock-screen controls (doNotMix is what ties them to us). Once
   per process. */
function configureAudio(): Promise<void> {
  if (!configured) {
    configured = setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
      interruptionModeAndroid: 'doNotMix',
    }).catch(() => {
      configured = null
    })
  }
  return configured
}

let notificationsAsked = false

/* Android 13+ shows the media controls in the notification shade only with
   this permission; asked once, on the first play. */
async function askForMediaNotification() {
  if (Platform.OS !== 'android' || notificationsAsked) return
  notificationsAsked = true
  try {
    await requestNotificationPermissionsAsync()
  } catch {
    // Without it playback still works, only the shade control is missing.
  }
}

function statusOf(status: AudioStatus, failed: boolean): PlayerStatus {
  if (failed) return 'error'
  if (status.error || status.playbackState === 'error' || status.playbackState === 'failed') return 'error'
  if (!status.isLoaded) return 'loading'
  if (status.playing) return status.isBuffering ? 'loading' : 'playing'
  if (status.didJustFinish || status.playbackState === 'ended') return 'ended'
  return status.currentTime > 0 ? 'paused' : 'ready'
}

const NEAR_END_SECONDS = 0.5

export function useStoryPlayer(track: StoryTrack | null) {
  const [activeUrl, setActiveUrl] = useState<string | null>(track?.url ?? null)
  const [failed, setFailed] = useState(false)
  const resumeAfterSwap = useRef(false)

  /* A new track starts from its own URL again. */
  useEffect(() => {
    setActiveUrl(track?.url ?? null)
    setFailed(false)
    resumeAfterSwap.current = false
  }, [track?.url])

  const player = useAudioPlayer(activeUrl ? { uri: activeUrl } : null, { updateInterval: 500 })
  const status = useAudioPlayerStatus(player)

  useEffect(() => {
    void configureAudio()
  }, [])

  /* The language's file is missing (static hosting, no existence check):
     drop to the Polish original once, then report the error for real. */
  useEffect(() => {
    if (!track || !activeUrl) return
    const loadFailed = Boolean(status.error) || status.playbackState === 'error' || status.playbackState === 'failed'
    if (!loadFailed) return
    if (track.fallbackUrl && activeUrl !== track.fallbackUrl) {
      resumeAfterSwap.current = status.playing || resumeAfterSwap.current
      setActiveUrl(track.fallbackUrl)
      return
    }
    setFailed(true)
  }, [status.error, status.playbackState, status.playing, track, activeUrl])

  const startPlayback = useCallback(() => {
    if (!track) return
    player.setActiveForLockScreen(true, { title: track.title, artist: track.artist, artworkUrl: track.artwork })
    player.play()
  }, [player, track])

  /* A fallback that replaced a playing recording continues on its own. */
  useEffect(() => {
    if (resumeAfterSwap.current && status.isLoaded) {
      resumeAfterSwap.current = false
      startPlayback()
    }
  }, [status.isLoaded, startPlayback])

  /* Leaving the story stops the tale and gives the lock screen back. The
     hook releases the native player right after this. */
  useEffect(
    () => () => {
      try {
        player.pause()
        player.clearLockScreenControls()
      } catch {
        // Already released.
      }
    },
    [player],
  )

  const toggle = useCallback(async () => {
    if (!track) return
    if (status.playing) {
      player.pause()
      return
    }
    await configureAudio()
    void askForMediaNotification()
    if (status.duration > 0 && status.currentTime >= status.duration - NEAR_END_SECONDS) await player.seekTo(0)
    startPlayback()
  }, [track, status.playing, status.duration, status.currentTime, player, startPlayback])

  const seekTo = useCallback((position: number) => player.seekTo(position), [player])

  return {
    status: statusOf(status, failed),
    position: status.currentTime,
    duration: status.duration,
    toggle,
    seekTo,
    usingFallback: Boolean(track?.fallbackUrl) && activeUrl === track?.fallbackUrl,
  }
}
