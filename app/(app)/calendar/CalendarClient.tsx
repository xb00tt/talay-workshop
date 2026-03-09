'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceStatus = 'SCHEDULED' | 'INTAKE' | 'IN_PROGRESS' | 'QUALITY_CHECK' | 'READY' | 'COMPLETED' | 'CANCELLED'

interface CalService {
  id: number
  truckPlateSnapshot: string
  status: ServiceStatus
  scheduledDate: string   // YYYY-MM-DD
  startDate:     string | null
  endDate:       string | null
}

interface TruckOption {
  id: number; plateNumber: string; make: string; model: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<ServiceStatus, string> = {
  SCHEDULED:     'bg-amber-600/30 text-amber-300',
  INTAKE:        'bg-blue-600/30 text-blue-300',
  IN_PROGRESS:   'bg-indigo-600/30 text-indigo-300',
  QUALITY_CHECK: 'bg-purple-600/30 text-purple-300',
  READY:         'bg-green-600/30 text-green-300',
  COMPLETED:     'bg-gray-600/30 text-gray-400',
  CANCELLED:     'bg-red-600/30 text-red-400',
}

// ─── CreateServiceModal ───────────────────────────────────────────────────────

function CreateServiceModal({
  date, trucks, onClose, onCreated,
}: {
  date: string; trucks: TruckOption[]
  onClose: () => void; onCreated: (service: CalService) => void
}) {
  const t       = useTranslations('calendar')
  const tCommon = useTranslations('common')

  const [truckId, setTruckId] = useState('')
  const [error,   setError]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!truckId) { setError(tCommon('error')); return }
    setSaving(true); setError('')
    try {
      const res  = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ truckId: Number(truckId), scheduledDate: date }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tCommon('error')); return }
      onCreated({
        id:                json.service.id,
        truckPlateSnapshot: json.service.truckPlateSnapshot,
        status:            json.service.status,
        scheduledDate:     json.service.scheduledDate?.slice(0, 10) ?? date,
        startDate:         null,
        endDate:           null,
      })
      router.push(`/services/${json.service.id}`)
    } catch { setError(tCommon('connectionFailed')) }
    finally { setSaving(false) }
  }

  const [dd, mm, yyyy] = date.split('-').reverse()
  const display = `${dd}.${mm}.${yyyy}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('newOrderFor', { date: display })}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:hover:text-white text-xl">×</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('selectTruckLabel')}</label>
            <select
              value={truckId} onChange={(e) => setTruckId(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              autoFocus
            >
              <option value="">{t('selectTruckPlaceholder')}</option>
              {trucks.map((tr) => (
                <option key={tr.id} value={tr.id}>{tr.plateNumber} — {tr.make} {tr.model}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
              {tCommon('cancel')}
            </button>
            <button type="submit" disabled={saving || !truckId}
              className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-50">
              {saving ? t('creating') : t('create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── MonthView ────────────────────────────────────────────────────────────────

function MonthView({
  year, month, services, canCreate, onDayClick,
}: {
  year: number; month: number; services: CalService[]
  canCreate: boolean; onDayClick: (date: string) => void
}) {
  const locale = useLocale()

  const DAYS = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, i + 1))
  )

  const firstDay = new Date(year, month, 1)
  // Monday-first: 0=Mon,...,6=Sun
  const startDow = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete weeks
  while (cells.length % 7 !== 0) cells.push(null)

  const today = new Date().toISOString().slice(0, 10)

  function dateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs text-gray-500 font-medium py-1">{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="bg-gray-50 dark:bg-gray-950 min-h-[80px]" />

          const ds = dateStr(day)
          const daySvcs = services.filter((s) => s.scheduledDate === ds)
          const isToday = ds === today

          return (
            <div
              key={i}
              className={`bg-white dark:bg-gray-900 min-h-[80px] p-1 flex flex-col ${canCreate ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/70' : ''} ${isToday ? 'ring-1 ring-blue-500 ring-inset' : ''}`}
              onClick={() => canCreate && onDayClick(ds)}
            >
              <span className={`text-xs font-medium mb-1 self-end ${isToday ? 'text-blue-400' : 'text-gray-500'}`}>
                {day}
              </span>
              <div className="space-y-0.5 flex-1">
                {daySvcs.slice(0, 3).map((svc) => (
                  <Link
                    key={svc.id}
                    href={`/services/${svc.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className={`block px-1 py-0.5 rounded-sm text-xs truncate leading-tight ${STATUS_COLOR[svc.status]}`}
                  >
                    {svc.truckPlateSnapshot}
                  </Link>
                ))}
                {daySvcs.length > 3 && (
                  <p className="text-xs text-gray-600">+{daySvcs.length - 3}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── WeekView ─────────────────────────────────────────────────────────────────

function WeekView({
  weekStart, services, canCreate, onDayClick,
}: {
  weekStart: Date; services: CalService[]
  canCreate: boolean; onDayClick: (date: string) => void
}) {
  const t       = useTranslations('calendar')
  const tService = useTranslations('service')
  const locale  = useLocale()

  const DAYS = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, i + 1))
  )

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
      {days.map((day) => {
        const ds      = day.toISOString().slice(0, 10)
        const daySvcs = services.filter((s) => s.scheduledDate === ds)
        const isToday = ds === today

        return (
          <div
            key={ds}
            className={`bg-white dark:bg-gray-900 min-h-[200px] p-2 flex flex-col ${canCreate ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/70' : ''} ${isToday ? 'ring-1 ring-blue-500 ring-inset' : ''}`}
            onClick={() => canCreate && onDayClick(ds)}
          >
            <div className="mb-2">
              <p className="text-xs text-gray-500">{DAYS[(day.getDay() + 6) % 7]}</p>
              <p className={`text-sm font-semibold ${isToday ? 'text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                {day.getDate()}.{String(day.getMonth() + 1).padStart(2, '0')}
              </p>
            </div>
            <div className="space-y-1 flex-1">
              {daySvcs.map((svc) => (
                <Link
                  key={svc.id}
                  href={`/services/${svc.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className={`block px-2 py-1 rounded-lg text-xs ${STATUS_COLOR[svc.status]}`}
                >
                  <p className="font-mono font-semibold">{svc.truckPlateSnapshot}</p>
                  <p className="opacity-80">{tService(`status.${svc.status}`)}</p>
                </Link>
              ))}
              {canCreate && (
                <div className="mt-auto pt-1">
                  <p className="text-xs text-gray-700 hover:text-gray-500 text-center">{t('newHint')}</p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── CalendarClient ───────────────────────────────────────────────────────────

export default function CalendarClient({
  initialServices, trucks, canCreate,
}: {
  initialServices: CalService[]
  trucks: TruckOption[]
  canCreate: boolean
}) {
  const t        = useTranslations('calendar')
  const tService = useTranslations('service')
  const locale   = useLocale()

  const MONTHS = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, i, 1))
  )

  const today = new Date()
  const [viewMode,    setViewMode]    = useState<'month' | 'week'>('month')
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [services,    setServices]    = useState<CalService[]>(initialServices)
  const [createDate,  setCreateDate]  = useState<string | null>(null)

  // Week start: Monday of the week containing currentDate
  function getWeekStart(d: Date) {
    const date = new Date(d)
    const dow  = (date.getDay() + 6) % 7 // 0=Mon
    date.setDate(date.getDate() - dow)
    return date
  }

  const [weekStart, setWeekStart] = useState(() => getWeekStart(today))

  function prevPeriod() {
    if (viewMode === 'month') {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    } else {
      setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })
    }
  }
  function nextPeriod() {
    if (viewMode === 'month') {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    } else {
      setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })
    }
  }
  function goToday() {
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1))
    setWeekStart(getWeekStart(today))
  }

  const headerLabel = viewMode === 'month'
    ? `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    : (() => {
        const ws = weekStart
        const we = new Date(ws); we.setDate(ws.getDate() + 6)
        return `${ws.getDate()}.${String(ws.getMonth() + 1).padStart(2,'0')} — ${we.getDate()}.${String(we.getMonth() + 1).padStart(2,'0')}.${we.getFullYear()}`
      })()

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-4">
      {createDate && canCreate && (
        <CreateServiceModal
          date={createDate}
          trucks={trucks}
          onClose={() => setCreateDate(null)}
          onCreated={(svc) => {
            setServices((prev) => [...prev, svc])
            setCreateDate(null)
          }}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={prevPeriod}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors">
            ‹
          </button>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white w-52 text-center">{headerLabel}</h2>
          <button onClick={nextPeriod}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors">
            ›
          </button>
          <button onClick={goToday}
            className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 rounded-lg transition-colors">
            {t('today')}
          </button>
        </div>

        {/* View mode toggle */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
          <button
            onClick={() => setViewMode('month')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              viewMode === 'month' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t('month')}
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              viewMode === 'week' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t('week')}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {(Object.entries(STATUS_COLOR) as [ServiceStatus, string][]).map(([status, color]) => (
          <span key={status} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs ${color}`}>
            {tService(`status.${status}`)}
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      {viewMode === 'month' ? (
        <MonthView
          year={currentDate.getFullYear()}
          month={currentDate.getMonth()}
          services={services}
          canCreate={canCreate}
          onDayClick={(date) => setCreateDate(date)}
        />
      ) : (
        <WeekView
          weekStart={weekStart}
          services={services}
          canCreate={canCreate}
          onDayClick={(date) => setCreateDate(date)}
        />
      )}

      {canCreate && (
        <p className="text-xs text-gray-600 text-center">{t('clickDayHint')}</p>
      )}
    </div>
  )
}
