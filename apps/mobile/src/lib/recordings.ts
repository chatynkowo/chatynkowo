import { Directory, File, Paths } from 'expo-file-system'
import type { Language } from '@chatynkowo/core'

/* Story recordings kept on the device, one directory per language, so a
   tale can be heard where there is no signal. Files live in the document
   directory (the cache directory may be purged by the system). */

function recordingsDirectory(language: Language) {
  return new Directory(Paths.document, 'stories', language)
}

function recordingFile(slug: string, language: Language) {
  return new File(recordingsDirectory(language), `${slug}.mp3`)
}

/* The local file URI when the recording is on the device, else null. */
export function localRecording(slug: string, language: Language): string | null {
  try {
    const file = recordingFile(slug, language)
    return file.exists ? file.uri : null
  } catch {
    return null
  }
}

export async function downloadRecording(url: string, slug: string, language: Language): Promise<string> {
  const directory = recordingsDirectory(language)
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true })
  const file = await File.downloadFileAsync(url, recordingFile(slug, language), { idempotent: true })
  return file.uri
}
