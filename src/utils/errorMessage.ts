import { isString } from 'es-toolkit'

export function getUserFacingErrorMessage(
  error: unknown,
  fallback: string,
) {
  if (!isString(error)) return fallback

  const trimmed = error.trim()

  if (!trimmed) return fallback

  // Keep technical dumps in logs only; UI shows a stable localized sentence.
  if (/^[A-Z_]+Error:|^Error:|at\s+\S+|\\\\|\/Users\/|C:\\/i.test(trimmed)) {
    return fallback
  }

  return trimmed.length > 120 ? fallback : trimmed
}
