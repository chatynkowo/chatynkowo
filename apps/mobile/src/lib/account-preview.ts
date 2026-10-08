import type { Profile, Session } from '@chatynkowo/api'
import { ACCOUNT_PREVIEW } from '../config'

/* A stand-in account for development builds only: with
   EXPO_PUBLIC_ACCOUNT_PREVIEW=1 the app behaves as if a Google account
   were signed in, so the account screens can be looked at on an emulator
   that has no Google sign-in configured. Nothing here reaches the
   backend: sync.ts answers every account call from these values and
   keeps the finds on the device. The flag is read only under __DEV__,
   so a release build cannot carry it. */

export const previewEnabled = __DEV__ && ACCOUNT_PREVIEW

const PREVIEW_USER_ID = '00000000-0000-4000-8000-00000000c0ff'
const PREVIEW_EMAIL = 'zdobywca@gmail.com'
const PREVIEW_NAME = 'Janina Zdobywczyni'
const PREVIEW_PICTURE = 'https://www.chatynkowo.pl/assets/img/cropped-znacznik-192x192.png'
const PREVIEW_CREATED_AT = '2026-10-01T09:00:00.000Z'

export function previewSession(): Session {
  return {
    access_token: 'preview',
    refresh_token: 'preview',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: PREVIEW_USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: PREVIEW_EMAIL,
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { email: PREVIEW_EMAIL, name: PREVIEW_NAME, full_name: PREVIEW_NAME, picture: PREVIEW_PICTURE, avatar_url: PREVIEW_PICTURE },
      identities: [],
      created_at: PREVIEW_CREATED_AT,
      updated_at: PREVIEW_CREATED_AT,
    },
  }
}

let profile: Profile = {
  id: PREVIEW_USER_ID,
  public_id: 'previewseeker',
  display_name: 'Janina',
  avatar_url: PREVIEW_PICTURE,
  completed_at: null,
  created_at: PREVIEW_CREATED_AT,
}

export function previewProfile(): Profile {
  return profile
}

export function updatePreviewProfile(patch: Pick<Profile, 'display_name' | 'avatar_url'>): Profile {
  profile = { ...profile, ...patch }
  return profile
}
