import { withTimeout } from './platform'

/* Diagnostics rules, free of any platform: what the two clients' reports
   share. A report is one JSON document a seeker makes when something went
   wrong and sends to us themselves; the site makes its own from the
   browser (apps/web/src/lib/diagnostics.ts), the app from the device
   (apps/mobile/src/lib/diagnostics.ts), and neither can read the other's
   storage. Both gather their parts with `gather`, so a part that fails
   says why in its place (the report is for the day something is broken,
   so it must not break with it), and pass what they read from storage
   through `withoutSecrets`, so a report in the wrong hands opens no
   account. */

/* The head of every report: which client made it, and when. */
export type DiagnosticsEnvelope = {
  format: 'chatynkowo-diagnostics'
  version: 1
  client: 'site' | 'app'
  createdAt: string
}

export function diagnosticsEnvelope(client: DiagnosticsEnvelope['client'], now: Date = new Date()): DiagnosticsEnvelope {
  return { format: 'chatynkowo-diagnostics', version: 1, client, createdAt: now.toISOString() }
}

/* A part of the report, or the reason it could not be gathered. */
export type Gathered<T> = T | { failed: string }

function reasonOf(reason: unknown): string {
  /* A backend error carries its code and details as own properties. */
  if (reason instanceof Error) return JSON.stringify({ ...reason, name: reason.name, message: reason.message })
  return typeof reason === 'string' ? reason : JSON.stringify(reason) ?? String(reason)
}

/* One part of the report, read on its own and given `ms` to answer: a
   read that throws, or a question nobody answers, becomes its reason. */
export async function gather<T>(read: () => T | Promise<T>, ms: number): Promise<Gathered<T>> {
  try {
    return await withTimeout(Promise.resolve().then(read), ms)
  } catch (reason) {
    return { failed: reasonOf(reason) }
  }
}

/* What signs someone in: the session's tokens, the provider's tokens, the
   editor's GitHub token, anything stored under such a name, and any value
   shaped like one wherever it sits. `token_type` only names the kind. */
const SECRET_NAME = /token|secret|password|verifier/i
const SECRET_VALUE = /^(eyJ[\w-]+\.[\w-]+\.[\w-]*|gh[pousr]_\w+|github_pat_\w+)$/

/* A stored value with every secret replaced by a note of its length, so
   the report still says the secret was there. */
export function withoutSecrets(value: unknown, name = ''): unknown {
  if (typeof value === 'string') {
    const secret = (SECRET_NAME.test(name) && name !== 'token_type') || SECRET_VALUE.test(value)
    return secret ? `[removed: ${value.length} characters]` : value
  }
  if (Array.isArray(value)) return value.map((item) => withoutSecrets(item, name))
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, withoutSecrets(item, key)]))
  }
  return value
}

/* A storage entry as a report shows it: the JSON most entries are, or the
   plain text the rest are (the chosen language), with the secrets out. */
export function storedEntry(key: string, stored: string): unknown {
  let value: unknown = stored
  try {
    value = JSON.parse(stored)
  } catch {
    // Plain text.
  }
  return withoutSecrets(value, key)
}

/* The report as the text a seeker sends and reads. */
export function reportText(report: DiagnosticsEnvelope): string {
  return JSON.stringify(report, null, 2)
}

/* chatynkowo-diagnostics-20261112-1002.json, by the report's own time. */
export function reportFileName(report: DiagnosticsEnvelope): string {
  const [date, time] = report.createdAt.split('T')
  return `chatynkowo-diagnostics-${date.replaceAll('-', '')}-${time.slice(0, 5).replace(':', '')}.json`
}
