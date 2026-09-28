import { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { Cottage } from '@chatynkowo/core'
import { useStoryPlayer, type StoryTrack } from '../../lib/audio'
import { content, storyAudio } from '../../lib/content'
import { downloadRecording, localRecording } from '../../lib/recordings'
import { useContent } from '../../providers'
import { DownloadIcon, FoundIcon, IconButton, PauseIcon, PlayIcon, StoryAudioIcon, Text, colors, iconSize, radius, space } from '../../ui'

/* The story's audio card: play/pause, a seekable progress bar, and "save on
   this device" for the forest. A recording already on the device plays from
   the file; otherwise it streams, falling back to the Polish original when
   the language has none yet (core's storyAudio decides the URLs). */

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
}

export function StoryPlayer({ cottage }: { cottage: Cottage }) {
  const { t } = useTranslation()
  const { language } = useContent()
  const [localUri, setLocalUri] = useState(() => localRecording(cottage.slug, language))
  const [download, setDownload] = useState<'idle' | 'busy' | 'failed'>('idle')
  const [barWidth, setBarWidth] = useState(0)

  const track = useMemo<StoryTrack>(() => {
    const audio = storyAudio(cottage.slug, language)
    return {
      id: `${cottage.slug}:${language}`,
      url: localUri ?? audio.src,
      fallbackUrl: localUri ? undefined : audio.fallbackSrc,
      title: cottage.title,
      artist: 'Chatynkowo',
      artwork: content.storyPhotos(cottage)[0],
    }
  }, [cottage, language, localUri])

  const player = useStoryPlayer(track)
  const playing = player.status === 'playing'
  const busy = player.status === 'loading'
  const ratio = player.duration > 0 ? Math.min(1, player.position / player.duration) : 0

  async function saveOnDevice() {
    setDownload('busy')
    try {
      const audio = storyAudio(cottage.slug, language)
      const uri = await downloadRecording(player.usingFallback && audio.fallbackSrc ? audio.fallbackSrc : audio.src, cottage.slug, language)
      setLocalUri(uri)
      setDownload('idle')
    } catch {
      setDownload('failed')
    }
  }

  function seekFromPress(x: number) {
    if (!barWidth || !player.duration) return
    void player.seekTo(Math.max(0, Math.min(1, x / barWidth)) * player.duration)
  }

  const label = playing ? t('audio.pause', { title: cottage.title }) : t('audio.play', { title: cottage.title })

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <StoryAudioIcon size={iconSize.xl} weight="duotone" color={colors.accentStrong} />
        <Text weight="bold" style={styles.headText}>
          {t('story.listen')}
        </Text>
      </View>
      {player.status === 'unavailable' || player.status === 'error' ? (
        <Text tone="danger" variant="small">
          {t('mobile:story.playerUnavailable')}
        </Text>
      ) : (
        <View style={styles.transport}>
          <IconButton label={label} onPress={() => void player.toggle()} disabled={busy}>
            {busy ? (
              <ActivityIndicator color={colors.accentStrong} />
            ) : playing ? (
              <PauseIcon size={iconSize.lg} weight="fill" color={colors.accentStrong} />
            ) : (
              <PlayIcon size={iconSize.lg} weight="fill" color={colors.accentStrong} />
            )}
          </IconButton>
          <View style={styles.progress}>
            <Pressable
              accessibilityRole="adjustable"
              accessibilityLabel={t('audio.position')}
              accessibilityValue={{ min: 0, max: Math.round(player.duration), now: Math.round(player.position) }}
              onLayout={(event: LayoutChangeEvent) => setBarWidth(event.nativeEvent.layout.width)}
              onPress={(event) => seekFromPress(event.nativeEvent.locationX)}
              style={styles.bar}
            >
              <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
            </Pressable>
            <Text variant="small" tone="faint">
              {formatTime(player.position)} / {formatTime(player.duration)}
            </Text>
          </View>
        </View>
      )}
      <View style={styles.offline}>
        {localUri ? (
          <>
            <FoundIcon size={iconSize.sm} weight="fill" color={colors.success} />
            <Text variant="small" tone="success">
              {t('mobile:story.downloaded')}
            </Text>
          </>
        ) : (
          <>
            <IconButton label={t('mobile:story.download')} onPress={() => void saveOnDevice()} disabled={download === 'busy'}>
              {download === 'busy' ? <ActivityIndicator color={colors.accentStrong} /> : <DownloadIcon size={iconSize.md} color={colors.ink} />}
            </IconButton>
            <Text variant="small" tone={download === 'failed' ? 'danger' : 'soft'} style={styles.offlineText}>
              {download === 'busy' ? t('mobile:story.downloading') : download === 'failed' ? t('mobile:story.downloadFailed') : t('mobile:story.download')}
            </Text>
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  headText: {
    flex: 1,
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  progress: {
    flex: 1,
    gap: space.xs,
  },
  bar: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSoft,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  offlineText: {
    flex: 1,
  },
})
