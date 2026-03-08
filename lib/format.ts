/**
 * Shared formatting utilities used throughout the app.
 */

/** Format a date as DD.MM.YYYY (UTC). Returns '—' for null/undefined. */
export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const dt = new Date(d)
  return (
    String(dt.getUTCDate()).padStart(2, '0') +
    '.' +
    String(dt.getUTCMonth() + 1).padStart(2, '0') +
    '.' +
    dt.getUTCFullYear()
  )
}

/** Format a datetime as DD.MM.YYYY HH:MM (local time). */
export function fmtDateTime(iso: string): string {
  const d  = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()} ${hh}:${mi}`
}

/** Format a mileage value as "N км" (bg-BG locale). Returns '—' for null. */
export function fmtKm(km: number | null | undefined): string {
  if (km == null) return '—'
  return `${Math.round(km).toLocaleString('bg-BG')} км`
}
