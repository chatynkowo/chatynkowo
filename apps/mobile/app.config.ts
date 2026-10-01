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
     backend's Sign in with Apple script reads it from here. */
export default ({ config }: ConfigContext): ExpoConfig => {
  const appleSignIn = process.env.EXPO_PUBLIC_APPLE_SIGN_IN !== '0'
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  const appleTeamId = process.env.APPLE_TEAM_ID
  const plugins = [...(config.plugins ?? [])]
  if (appleSignIn) plugins.push('expo-apple-authentication')
  if (googleIosClientId) plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosClientId.split('.').reverse().join('.') }])
  /* app.json carries the name and the slug the type asks for. */
  return {
    ...config,
    ios: { ...config.ios, usesAppleSignIn: appleSignIn, ...(appleTeamId ? { appleTeamId } : {}) },
    plugins,
  } as ExpoConfig
}
