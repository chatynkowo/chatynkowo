/* App entry. The polyfills come first (supabase-js needs crypto.getRandomValues
   and a complete URL), then expo-router mounts the app/ directory. */
import 'react-native-get-random-values'
import 'react-native-url-polyfill/auto'
import 'expo-router/entry'
