import { Dimensions, PixelRatio, Platform, Share } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import * as api from '@chatynkowo/api'
import type { OAuthProvider, Profile, Session } from '@chatynkowo/api'
import {
  CONTACT_EMAIL,
  diagnosticsEnvelope,
  gather as gatherWithin,
  reportFileName,
  reportText,
  storedEntry,
  type DiagnosticsEnvelope,
  type Gathered,
  type StoredFind,
} from '@chatynkowo/core'
import * as Application from 'expo-application'
import { Camera } from 'expo-camera'
import * as Device from 'expo-device'
import { File, Paths } from 'expo-file-system'
import { getCalendars, getLocales } from 'expo-localization'
import * as Location from 'expo-location'
import * as MailComposer from 'expo-mail-composer'
import { STORAGE_KEYS, SUPABASE_ANON_KEY, SUPABASE_URL } from '../config'
import { previewEnabled } from './account-preview'
import { configured, fetchFinds } from './sync'
import { appVersion } from './version'

/* The report a seeker sends from the app when something went wrong: the
   build, the phone and its system, the connection, the permissions the
   app was given, the account as the app and the backend see it, and
   everything the app keeps on the device, as one JSON document. The
   site's twin is apps/web/src/lib/diagnostics.ts; the rules both follow
   (the envelope, the gathering of parts, the secrets taken out) are
   core's diagnostics.ts. An app cannot read what a browser keeps for the
   site, so each client reports its own storage.

   Making the report reads and never writes, asks for no permission and
   reads neither the position nor a picture. It leaves the phone only when
   the seeker sends it. */

type Permission = { status: string; canAskAgain: boolean }

export type AppDiagnosticsReport = DiagnosticsEnvelope & {
  client: 'app'
  app: {
    version: string
    /* The number the store counts builds by. */
    build: string | null
    /* The commit the app was built from. */
    commit: string
    id: string | null
    platform: typeof Platform.OS
    /* A development build, which talks to a bundler. */
    development: boolean
    language: string
  }
  device: Gathered<{
    brand: string | null
    manufacturer: string | null
    model: string | null
    /* Apple's own name of the model (iPhone15,2); Android has none. */
    modelId: string | null
    system: string | null
    systemVersion: string | null
    /* Android's API level. */
    apiLevel: number | null
    /* A phone or a tablet in the hand, not an emulator. */
    physical: boolean
    memoryBytes: number | null
    locales: string[]
    timeZone: string | null
    screen: { width: number; height: number; scale: number; fontScale: number }
  }>
  network: Gathered<{ type: string; connected: boolean | null; internetReachable: boolean | null; expensive: boolean | null }>
  /* What the app may do, as the system has it now; nothing is asked for. */
  permissions: Gathered<{ location: Permission; camera: Permission }>
  /* The cottages as the app holds them: the cached files themselves stay
     out of `storage` and are named there by their age and size. */
  content: { status: string; codes: string; cottages: number; stale: boolean }
  account: {
    /* The sign-ins this build offers; none means the app runs signed out. */
    offered: OAuthProvider[]
    signedIn: boolean
    /* The provider the account began with, and every one it signs in through. */
    provider: OAuthProvider | null
    identities: string[]
    sessionExpiresAt: string | null
    /* What the access token says of the session; the token itself is a
       secret and stays out. */
    tokenClaims: Gathered<Record<string, unknown>> | null
    profile: Profile | null
  }
  backend: {
    address: string
    /* Asked now: the providers the backend offers and the finds the
       account holds. */
    signInProviders: Gathered<OAuthProvider[]>
    accountFinds: Gathered<Record<string, StoredFind>> | null
  }
  storage: Gathered<Record<string, unknown>>
}

export type DiagnosticsSubject = {
  session: Session | null
  profile: Profile | null
  offered: OAuthProvider[]
  language: string
  content: AppDiagnosticsReport['content']
}

/* How long a question to the backend or to the system may take before the
   report goes on without the answer: a seeker with a broken connection
   should not wait for it. */
const ANSWER_MS = 4000

function gather<T>(read: () => T | Promise<T>): Promise<Gathered<T>> {
  return gatherWithin(read, ANSWER_MS)
}

/* Everything the app keeps in AsyncStorage, with the secrets out. A cached
   content file (the cottages, the stories, the rewards, the codes) is
   named by its age and size instead of its text: it is the published
   content, the same for everyone, and would make the report too heavy to
   send. */
async function storedEntries(): Promise<Record<string, unknown>> {
  const keys = [...(await AsyncStorage.getAllKeys())].sort()
  const pairs = await AsyncStorage.multiGet(keys)
  return Object.fromEntries(
    pairs.map(([key, stored]) => {
      if (stored === null) return [key, null]
      if (!key.startsWith(STORAGE_KEYS.contentCache)) return [key, storedEntry(key, stored)]
      const storedAt = /"storedAt":"([^"]+)"/.exec(stored)?.[1] ?? null
      return [key, { storedAt, characters: stored.length }]
    }),
  )
}

function permission({ status, canAskAgain }: { status: string; canAskAgain: boolean }): Permission {
  return { status, canAskAgain }
}

export async function collectDiagnostics({ session, profile, offered, language, content }: DiagnosticsSubject): Promise<AppDiagnosticsReport> {
  const { version, build, commit } = appVersion()
  const [device, network, permissions, claims, signInProviders, accountFinds, storage] = await Promise.all([
    gather(() => {
      const window = Dimensions.get('window')
      return {
        brand: Device.brand,
        manufacturer: Device.manufacturer,
        model: Device.modelName,
        modelId: Device.modelId as string | null,
        system: Device.osName,
        systemVersion: Device.osVersion,
        apiLevel: Device.platformApiLevel,
        physical: Device.isDevice,
        memoryBytes: Device.totalMemory,
        locales: getLocales().map((locale) => locale.languageTag),
        timeZone: getCalendars()[0]?.timeZone ?? null,
        screen: { width: window.width, height: window.height, scale: PixelRatio.get(), fontScale: PixelRatio.getFontScale() },
      }
    }),
    gather(async () => {
      const state = await NetInfo.fetch()
      const details = state.details as { isConnectionExpensive?: boolean } | null
      return { type: state.type, connected: state.isConnected, internetReachable: state.isInternetReachable, expensive: details?.isConnectionExpensive ?? null }
    }),
    gather(async () => {
      const [location, camera] = await Promise.all([Location.getForegroundPermissionsAsync(), Camera.getCameraPermissionsAsync()])
      return { location: permission(location), camera: permission(camera) }
    }),
    session ? gather(() => api.tokenClaims(session.access_token)) : null,
    gather(() => {
      if (!configured) throw new Error('The backend is not configured.')
      return api.enabledProviders({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY })
    }),
    session ? gather(() => fetchFinds(session)) : null,
    gather(storedEntries),
  ])

  return {
    ...diagnosticsEnvelope('app'),
    client: 'app',
    app: {
      version,
      build,
      commit,
      id: Application.applicationId,
      platform: Platform.OS,
      development: __DEV__,
      language,
    },
    device,
    network,
    permissions,
    content,
    account: {
      offered,
      signedIn: session !== null,
      provider: session ? api.sessionProvider(session) : null,
      identities: session?.user.identities?.map((identity) => identity.provider) ?? [],
      sessionExpiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
      /* The stand-in account of a development build has no real token. */
      tokenClaims: previewEnabled ? null : claims,
      profile,
    },
    backend: { address: SUPABASE_URL, signInProviders, accountFinds },
    storage,
  }
}

/* The report as a file in the cache directory, where the mail composer
   and the share sheet take it from; the system clears the directory by
   itself. Returns the file's address. */
function writeReport(report: AppDiagnosticsReport): string {
  const file = new File(Paths.cache, reportFileName(report))
  if (file.exists) file.delete()
  file.create()
  file.write(reportText(report))
  return file.uri
}

/* How handing the report over ended. */
export type SendOutcome =
  | 'sent'
  | 'saved'
  | 'cancelled'
  /* Android hands the message to the mail app and never says what
     happened to it there. */
  | 'unknown'
  /* No mail is set up on the phone; the caller offers the share sheet. */
  | 'no-mail'

/* A message to us with the report attached and the address, the subject
   and the first line filled in: the seeker writes what happened and
   sends. Throws when the report cannot be written or the composer cannot
   open. */
export async function mailReport(report: AppDiagnosticsReport, words: { subject: string; body: string }): Promise<SendOutcome> {
  if (!(await MailComposer.isAvailableAsync())) return 'no-mail'
  const { status } = await MailComposer.composeAsync({ recipients: [CONTACT_EMAIL], subject: words.subject, body: words.body, attachments: [writeReport(report)] })
  if (Platform.OS !== 'ios') return 'unknown'
  if (status === MailComposer.MailComposerStatus.SENT) return 'sent'
  return status === MailComposer.MailComposerStatus.SAVED ? 'saved' : 'cancelled'
}

/* The system's share sheet, for a seeker who sends mail from another app
   or wants to keep the report: the file on iOS, the text on Android,
   whose share intent takes no file from here. Resolves to whether
   something was done with it. */
export async function shareReport(report: AppDiagnosticsReport, title: string): Promise<boolean> {
  const result = await Share.share(Platform.OS === 'ios' ? { url: writeReport(report), title } : { message: reportText(report), title }, { subject: title })
  return result.action !== Share.dismissedAction
}
