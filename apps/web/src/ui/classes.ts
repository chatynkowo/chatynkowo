/* Joins class names, skipping falsy entries — the one helper every
   component uses for conditional classes. */
export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}
