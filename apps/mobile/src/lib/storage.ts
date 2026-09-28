import AsyncStorage from '@react-native-async-storage/async-storage'

/* JSON in AsyncStorage, with failures swallowed: the app must keep working
   when storage is full or unavailable, the same way the site survives a
   disabled localStorage. */

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Discovery still opens even when progress cannot be persisted.
  }
}
