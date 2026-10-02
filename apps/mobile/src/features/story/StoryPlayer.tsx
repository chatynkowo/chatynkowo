import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { Cottage } from '@chatynkowo/core'
import { useStoryPlayer, type StoryTrack } from '../../lib/audio'
import { content, storyAudio } from '../../lib/content'
import { downloadRecording, localRecording } from '../../lib/recordings'
import { useContent, useToast } from '../../providers'
import { CrossfadeText, DownloadIcon, FoundIcon, IconButton, StoryAudioIcon, Text, colors, iconSize, radius, space } from '../../ui'
import { PlayPauseButton } from './PlayPauseButton'
import { ScrubBar } from './ScrubBar'

/* The story's audio card: play and pause, a scrubbable position bar, and
   "save on this device" for the forest. A recording already on the device
   plays from the file; otherwise it streams, falling back to the Polish
   original when the language has none yet (core's storyAudio decides the
   URLs), and a copy saved mid-tale is swapped in without losing the place. */

export function StoryPlayer({ cottage }: { cottage: Cottage }) {
  const { t } = useTranslation()
  const { language } = useContent()
  const toast = useToast()
  const [localUri, setLocalUri] = useState(() => localRecording(cottage.slug, language))
  const [download, setDownload] = useState<'idle' | 'busy' | 'failed'>('idle')

  /* The stream is the track; the local copy travels separately so the
     player can take it over in place. */
  const track = useMemo<StoryTrack>(() => {
    const audio = storyAudio(cottage.slug, language)
    return {
      id: `${cottage.slug}:${language}`,
      url: audio.src,
      fallbackUrl: audio.fallbackSrc,
      title: cottage.title,
      artist: 'Chatynkowo',
      artwork: content.storyPhotos(cottage)[0],
    }
  }, [cottage, language])

  const player = useStoryPlayer(track, { localUri })
  const playing = player.status === 'playing'
  const busy = player.status === 'loading'

  useEffect(() => {
    if (download === 'failed') toast.show({ tone: 'error', text: t('mobile:story.downloadFailed') })
  }, [download, toast, t])

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

  function toggle() {
    void player.toggle()
  }

  const label = playing ? t('audio.pause', { title: cottage.title }) : t('audio.play', { title: cottage.title })
  const downloadState = download === 'busy' ? t('mobile:story.downloading') : download === 'failed' ? t('mobile:story.downloadFailed') : t('mobile:story.download')

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
          <PlayPauseButton playing={playing} busy={busy} label={label} onPress={toggle} />
          <ScrubBar position={player.position} duration={player.duration} onSeek={(seconds) => void player.seekTo(seconds)} label={t('audio.position')} />
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
            <CrossfadeText value={downloadState} variant="small" tone={download === 'failed' ? 'danger' : 'soft'} style={styles.offlineText} />
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
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  offlineText: {
    flex: 1,
  },
})
