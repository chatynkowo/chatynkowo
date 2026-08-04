import { useEffect, useRef, useState } from 'react'
import { Pause, Play, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
}

export function AudioPlayer({ src, title }: { src: string; title: string }) {
  const { t } = useTranslation()
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)

  useEffect(() => {
    setPlaying(false); setCurrent(0); setDuration(0)
    audioRef.current?.load()
  }, [src])

  async function togglePlayback() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) await audio.play()
    else audio.pause()
  }

  function changeVolume(next: number) {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = next
    setVolume(next)
  }

  const progress = duration ? (current / duration) * 100 : 0

  return (
    <div className="custom-audio">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <button className="audio-play" type="button" onClick={() => void togglePlayback()} aria-label={playing ? t('audio.pause', { title }) : t('audio.play', { title })}>
        {playing ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
      </button>
      <label className="audio-seek">
        <span className="sr-only">{t('audio.position')}</span>
        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={current}
          style={{ '--range-progress': `${progress}%` } as React.CSSProperties}
          onChange={(event) => {
            const next = Number(event.target.value)
            if (audioRef.current) audioRef.current.currentTime = next
            setCurrent(next)
          }}
        />
      </label>
      <time className="audio-time">{formatTime(current)} <span>/ {formatTime(duration)}</span></time>
      <button className="audio-mute" type="button" onClick={() => changeVolume(volume ? 0 : 1)} aria-label={volume ? t('audio.mute') : t('audio.unmute')}>
        {volume ? <SpeakerHigh size={19} weight="fill" /> : <SpeakerSlash size={19} weight="fill" />}
      </button>
      <label className="audio-volume">
        <span className="sr-only">{t('audio.volume')}</span>
        <input type="range" min="0" max="1" step="0.05" value={volume} style={{ '--range-progress': `${volume * 100}%` } as React.CSSProperties} onChange={(event) => changeVolume(Number(event.target.value))} />
      </label>
    </div>
  )
}
