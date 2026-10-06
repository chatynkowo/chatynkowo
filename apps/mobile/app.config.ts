import type { ConfigContext, ExpoConfig } from 'expo/config'

/* app.json holds the configuration that never changes; this adds what
   depends on the environment (apps/mobile/.env, see .env.example), so a
   change there is followed by a native rebuild:
   - Sign in with Apple: the capability and its plugin, unless
     EXPO_PUBLIC_APPLE_SIGN_IN is "0" (a free Personal Team cannot sign it;
     a store build that offers Google must carry it).
   - Google sign-in: the library's plugin with the iOS URL scheme, which is
     the iOS client id (EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) read backwards;
     the plugin refuses to run without one.
   - The app's Apple team (APPLE_TEAM_ID): it signs device builds, and the
     backend's Sign in with Apple script reads it from here.
   - The AdMob app ids (EXPO_PUBLIC_ADMOB_ANDROID_APP_ID, EXPO_PUBLIC_ADMOB_IOS_APP_ID)
     for the rewarded ad of the support sheet: the native SDK reads them
     from the manifests and aborts at launch without one, so Google's
     sample app ids stand in until the real ones are set. App measurement
     waits for the SDK's initialisation, which the app runs only after the
     consent check, the first time an ad is asked for. The Android backend
     is named (the classic SDK, written to gradle.properties) because the
     library's Gradle script (17.2.0) fails to evaluate when neither that
     nor a key of its own in app.json says which SDK to build against. */
/* Google's sample AdMob app ids: they let the SDK start and serve its test
   ads to a build that has no AdMob account behind it yet. */
const ADMOB_SAMPLE_APP_IDS = {
  android: 'ca-app-pub-3940256099942544~3347511713',
  ios: 'ca-app-pub-3940256099942544~1458002511',
} as const

export default ({ config }: ConfigContext): ExpoConfig => {
  const appleSignIn = process.env.EXPO_PUBLIC_APPLE_SIGN_IN !== '0'
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  const appleTeamId = process.env.APPLE_TEAM_ID
  const admobAndroidAppId = process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || ADMOB_SAMPLE_APP_IDS.android
  const admobIosAppId = process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || ADMOB_SAMPLE_APP_IDS.ios
  const plugins = [...(config.plugins ?? [])]
  if (appleSignIn) plugins.push('expo-apple-authentication')
  if (googleIosClientId) plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosClientId.split('.').reverse().join('.') }])
  plugins.push(['react-native-google-mobile-ads', { androidSdk: 'classic', androidAppId: admobAndroidAppId, iosAppId: admobIosAppId, delayAppMeasurementInit: true }])
  /* app.json carries the name and the slug the type asks for. */
  return {
    ...config,
    ios: { ...config.ios, usesAppleSignIn: appleSignIn, ...(appleTeamId ? { appleTeamId } : {}) },
    plugins,
  } as ExpoConfig
}
