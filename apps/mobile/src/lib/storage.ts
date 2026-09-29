import AsyncStorage from '@react-native-async-storage/async-storage'

/* JSON in AsyncStorage, with failures swallowed: the app must keep working
   when storage is full or unavailable, the same way the site survives a
   disabled localStorage. A failed read is logged in development so a
   corrupt entry does not go unnoticed while nothing is shown for it. */

function warn(key: string, error: unknown) {
  if (__DEV__) console.warn(`storage: could not read ${key}`, error)
}

function parse<T>(key: string, raw: string | null | undefined): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch (error) {
    warn(key, error)
    return null
  }
}

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    return parse<T>(key, await AsyncStorage.getItem(key))
  } catch (error) {
    warn(key, error)
    return null
  }
}

/* The same read, but a storage that cannot be read throws instead of
   answering null: for the progress, where an absent entry and a failed read
   must not look alike (an empty Kronika would be saved over the real one). */
export async function readJsonStrict<T>(key: string): Promise<T | null> {
  return parse<T>(key, await AsyncStorage.getItem(key))
}

/* Several keys in one native round trip (the boot reads); a missing or
   unparsable entry is null at its position. */
export async function readJsonMany<T>(keys: readonly string[]): Promise<Array<T | null>> {
  try {
    const pairs = await AsyncStorage.multiGet([...keys])
    const byKey = new Map(pairs)
    return keys.map((key) => parse<T>(key, byKey.get(key)))
  } catch (error) {
    keys.forEach((key) => warn(key, error))
    return keys.map(() => null)
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Discovery still opens even when progress cannot be persisted.
  }
}
