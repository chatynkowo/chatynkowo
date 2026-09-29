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
   over) as soon as the first one fails to load. A copy saved on the device
   plays from the file; one that lands while the stream is playing is
   swapped in without losing the position. */

export type StoryTrack = {
  id: string
  url: string
  fallbackUrl?: string
  title: string
  artist: string
  artwork?: string
}

export type StoryPlayerOptions = {
  /* The recording saved on the device, when there is one. */
  localUri?: string | null
}

type PlayerStatus = 'unavailable' | 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error'

let configured: Promise<void> | null = null

/* The audio session: keep playing when the app goes to the background and
   take the lock-screen controls (doNotMix is what ties them to us). Once
   per process, on the first play, so opening a story never touches the
   session of whatever else is playing. */
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

export function useStoryPlayer(track: StoryTrack | null, { localUri = null }: StoryPlayerOptions = {}) {
  const [activeUrl, setActiveUrl] = useState<string | null>(track?.url ?? null)
  const [failed, setFailed] = useState(false)
  const resumeAfterSwap = useRef(false)
  /* What the native player was created with: the local copy when it was
     already on the device, else the stream. expo-audio rebuilds the player
     when this changes, so a copy arriving later goes through replace()
     instead (below) and the position survives. */
  const [source, setSource] = useState<string | null>(() => localUri ?? track?.url ?? null)
  const appliedLocal = useRef<string | null>(localUri)
  const latestLocal = useRef(localUri)
  useEffect(() => {
    latestLocal.current = localUri
  })

  /* A new track starts from its own URL (or its own local copy) again. */
  useEffect(() => {
    setActiveUrl(track?.url ?? null)
    setSource(latestLocal.current ?? track?.url ?? null)
    appliedLocal.current = latestLocal.current
    setFailed(false)
    resumeAfterSwap.current = false
  }, [track?.url])

  const player = useAudioPlayer(source ? { uri: source } : null, { updateInterval: 500 })
  const status = useAudioPlayerStatus(player)

  /* The language's file is missing (static hosting, no existence check):
     drop to the Polish original once, then report the error for real. */
  useEffect(() => {
    if (!track || !activeUrl) return
    const loadFailed = Boolean(status.error) || status.playbackState === 'error' || status.playbackState === 'failed'
    if (!loadFailed) return
    if (track.fallbackUrl && activeUrl !== track.fallbackUrl) {
      resumeAfterSwap.current = status.playing || resumeAfterSwap.current
      setActiveUrl(track.fallbackUrl)
      setSource(track.fallbackUrl)
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

  /* The recording was just saved on the device: continue from the file at
     the same position. Before the stream has loaded there is nothing to
     keep, so the player is simply rebuilt on the file. */
  useEffect(() => {
    if (!localUri || localUri === appliedLocal.current) return
    appliedLocal.current = localUri
    if (!status.isLoaded) {
      setSource(localUri)
      return
    }
    const position = status.currentTime
    const wasPlaying = status.playing
    try {
      player.replace({ uri: localUri })
      void (async () => {
        try {
          if (position > 0) await player.seekTo(position)
          if (wasPlaying) startPlayback()
        } catch {
          // The copy plays from its start instead.
        }
      })()
    } catch {
      // The stream keeps playing; the copy is used on the next open.
    }
  }, [localUri, status.isLoaded, status.currentTime, status.playing, player, startPlayback])

  /* The tale has ended: give the lock screen back. */
  useEffect(() => {
    if (!status.didJustFinish) return
    try {
      player.clearLockScreenControls()
    } catch {
      // Already released.
    }
  }, [status.didJustFinish, player])

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
