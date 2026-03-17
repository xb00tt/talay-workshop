'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input, Label, ErrorBox } from '@/components/ui'
import type { FullService } from '../types'

// ── Date/time helpers (DD.MM.YYYY HH:mm ↔ Date) ────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0') }

function formatDate(d: Date) {
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

function formatTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Parse "DD.MM.YYYY" + "HH:mm" → Date | null */
function parseEntryAt(dateStr: string, timeStr: string): Date | null {
  const dm = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  const tm = timeStr.match(/^(\d{1,2}):(\d{2})$/)
  if (!dm || !tm) return null
  const d = new Date(Number(dm[3]), Number(dm[2]) - 1, Number(dm[1]), Number(tm[1]), Number(tm[2]))
  if (isNaN(d.getTime())) return null
  return d
}

// ── Auto-format helpers ─────────────────────────────────────────────────────

/** Auto-insert dots as user types a date: 1603 → 16.03. */
function autoFormatDate(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 8)}`
}

/** Auto-insert colon as user types a time: 1430 → 14:30 */
function autoFormatTime(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function IntakeModal({
  serviceId, truckId, onClose, onDone,
}: {
  serviceId: number; truckId: number
  onClose: () => void; onDone: (svc: FullService) => void
}) {
  const tService = useTranslations('service')
  const tCommon  = useTranslations('common')
  const tErrors  = useTranslations('errors')

  const now = new Date()
  const [dateStr,     setDateStr]     = useState(formatDate(now))
  const [timeStr,     setTimeStr]     = useState(formatTime(now))
  const [driverName,  setDriverName]  = useState('')
  const [mileage,     setMileage]     = useState('')
  const [driverId,    setDriverId]    = useState<number | null>(null)
  const [fetching,    setFetching]    = useState(false)
  const [fetchResult, setFetchResult] = useState<'success' | 'empty' | null>(null)
  const [fetchError,  setFetchError]  = useState('')
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(false)

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDateStr(autoFormatDate(e.target.value))
    setFetchResult(null)
  }

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTimeStr(autoFormatTime(e.target.value))
    setFetchResult(null)
  }

  async function fetchFromFrotcom() {
    const at = parseEntryAt(dateStr, timeStr)
    if (!at) { setFetchError(tService('intake.invalidDateTime')); return }
    setFetching(true)
    setFetchError('')
    setFetchResult(null)
    try {
      const res = await fetch(`/api/frotcom/vehicle-lookup?truckId=${truckId}&at=${encodeURIComponent(at.toISOString())}`)
      const json = await res.json()
      if (!res.ok) { setFetchError(json.error ?? tErrors('genericShort')); return }
      const hasData = json.driverName || json.mileage != null
      if (json.driverName) setDriverName(json.driverName)
      if (json.driverId) setDriverId(json.driverId)
      if (json.mileage != null) setMileage(String(Math.round(json.mileage)))
      setFetchResult(hasData ? 'success' : 'empty')
    } catch { setFetchError(tCommon('connectionFailed')) }
    finally { setFetching(false) }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const at = parseEntryAt(dateStr, timeStr)
    if (!at) { setError(tService('intake.invalidDateTime')); return }
    setError(''); setLoading(true)
    try {
      const res = await fetch(`/api/services/${serviceId}/intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryAt:          at.toISOString(),
          driverId:         driverId ?? undefined,
          driverName:       driverName || undefined,
          mileageAtService: mileage ? Number(mileage) : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tErrors('genericShort')); return }
      onDone(json.service); onClose()
    } catch { setError(tCommon('connectionFailed')) }
    finally { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Entry date + time */}
      <div>
        <Label>{tService('intake.entryAt')}</Label>
        <div className="flex gap-2">
          <input
            type="text"
            value={dateStr}
            onChange={handleDateChange}
            placeholder="DD.MM.YYYY"
            maxLength={10}
            required
            className="flex-2 min-w-0 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            value={timeStr}
            onChange={handleTimeChange}
            placeholder="HH:mm"
            maxLength={5}
            required
            className="flex-1 min-w-0 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Fetch from Frotcom button */}
      <button
        type="button"
        onClick={fetchFromFrotcom}
        disabled={fetching}
        className="w-full py-2 rounded-lg border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm font-medium transition-colors disabled:opacity-50"
      >
        {fetching ? tService('intake.fetching') : tService('intake.fetchFrotcom')}
      </button>
      {fetchError && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{fetchError}</p>
      )}
      {fetchResult === 'success' && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">{tService('intake.fetchSuccess')}</p>
      )}
      {fetchResult === 'empty' && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{tService('intake.fetchEmpty')}</p>
      )}

      {/* Driver name */}
      <div>
        <Label>{tService('driver')}</Label>
        <Input
          type="text"
          value={driverName}
          onChange={(e) => setDriverName(e.target.value)}
          placeholder={tService('intake.driverPlaceholder')}
        />
      </div>

      {/* Mileage */}
      <div>
        <Label>{tService('mileageAtService')} ({tCommon('kmUnit')})</Label>
        <Input
          type="number"
          value={mileage}
          onChange={(e) => setMileage(e.target.value)}
          placeholder={tService('intake.mileagePlaceholder')}
        />
      </div>

      {error && <ErrorBox msg={error} />}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm">
          {tCommon('cancel')}
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
          {loading ? tService('intake.submitting') : tService('intake.submit')}
        </button>
      </div>
    </form>
  )
}
