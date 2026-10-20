import * as Application from 'expo-application'
import Constants from 'expo-constants'

/* The installed build, as the Profile tab shows it: the version the store
   lists (the native version name, app.json's "version"), the build number
   the store counts (Android's versionCode, iOS's build number; EAS sets it
   remotely) and the short hash of the commit it was built from
   (extra.commitHash, see app.config.ts). Native values are null in Expo Go
   and in a web run; the config's version stands in then. */
export type AppVersion = {
  version: string
  build: string | null
  commit: string
}

export function appVersion(): AppVersion {
  const extra = Constants.expoConfig?.extra as { commitHash?: unknown } | undefined
  return {
    version: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '0.0.0',
    build: Application.nativeBuildVersion,
    commit: typeof extra?.commitHash === 'string' ? extra.commitHash : 'dev',
  }
}
