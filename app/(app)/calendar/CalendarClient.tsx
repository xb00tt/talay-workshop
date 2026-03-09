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
  truckMake:  string
  truckModel: string
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
  SCHEDULED:     'bg-amber-100 text-amber-800 dark:bg-amber-600/30 dark:text-amber-300',
  INTAKE:        'bg-blue-100 text-blue-800 dark:bg-blue-600/30 dark:text-blue-300',
  IN_PROGRESS:   'bg-indigo-100 text-indigo-800 dark:bg-indigo-600/30 dark:text-indigo-300',
  QUALITY_CHECK: 'bg-purple-100 text-purple-800 dark:bg-purple-600/30 dark:text-purple-300',
  READY:         'bg-green-100 text-green-800 dark:bg-green-600/30 dark:text-green-300',
  COMPLETED:     'bg-gray-100 text-gray-600 dark:bg-gray-600/30 dark:text-gray-400',
  CANCELLED:     'bg-red-100 text-red-700 dark:bg-red-600/30 dark:text-red-400',
}

const ACTIVE_STATUSES: ServiceStatus[] = ['INTAKE', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY']

// ─── Span helpers ─────────────────────────────────────────────────────────────

function getServiceSpan(svc: CalService, today: string): { start: string; end: string } {
  if (svc.status === 'SCHEDULED') {
    return { start: svc.scheduledDate, end: svc.scheduledDate }
  }
  if (svc.status === 'CANCELLED') {
    const d = svc.startDate?.slice(0, 10) ?? svc.scheduledDate
    return { start: d, end: d }
  }
  const start = svc.startDate?.slice(0, 10) ?? svc.scheduledDate
  const end   = svc.endDate?.slice(0, 10)   ?? today
  return { start, end }
}

function occupies(svc: CalService, date: string, today: string): boolean {
  const { start, end } = getServiceSpan(svc, today)
  return date >= start && date <= end
}

// Monday-first day-of-week: 0=Mon … 6=Sun
function dowMon(date: string): number {
  return (new Date(date + 'T12:00:00').getDay() + 6) % 7
}

function daysInServiceCount(startDate: string | null, today: string): number {
  if (!startDate) return 0
  const ms = new Date(today).getTime() - new Date(startDate).getTime()
  return Math.max(1, Math.floor(ms / 86400000) + 1)
}

// ─── Greedy slot assignment (week Gantt) ─────────────────────────────────────

function assignSlots(svcs: CalService[], weekDays: string[], today: string): Map<number, number> {
  const sorted = [...svcs].sort((a, b) => {
    const sa = getServiceSpan(a, today).start
    const sb = getServiceSpan(b, today).start
    return sa < sb ? -1 : sa > sb ? 1 : 0
  })
  const slots: { from: string; to: string }[][] = []
  const assignment = new Map<number, number>()
  for (const svc of sorted) {
    const { start, end } = getServiceSpan(svc, today)
    const visStart = weekDays.find(d => d >= start) ?? weekDays[0]
    const visEnd   = [...weekDays].reverse().find(d => d <= end) ?? weekDays[6]
    let row = slots.findIndex(occ => !occ.some(seg => visStart <= seg.to && visEnd >= seg.from))
    if (row === -1) { row = slots.length; slots.push([]) }
    slots[row].push({ from: visStart, to: visEnd })
    assignment.set(svc.id, row)
  }
  return assignment
}

// Returns 0-based column indices within the week (clamped to 0–6)
function getWeekCols(svc: CalService, weekDays: string[], today: string): { startCol: number; endCol: number } {
  const { start, end } = getServiceSpan(svc, today)
  const startCol = Math.max(0, weekDays.findIndex(d => d >= start))
  const endCol   = weekDays.reduce<number>((acc, d, i) => d <= end ? i : acc, startCol)
  return { startCol, endCol }
}

// ─── DayPopover — shown when month cell has >3 services ──────────────────────

function DayPopover({
  date, services, today, onClose,
}: {
  date: string; services: CalService[]; today: string; onClose: () => void
}) {
  const tService = useTranslations('service')
  const [dd, mm, yyyy] = date.split('-').reverse()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {dd}.{mm}.{yyyy}
          </p>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {services.map((svc) => (
            <Link
              key={svc.id}
              href={`/services/${svc.id}`}
              onClick={onClose}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${STATUS_COLOR[svc.status]}`}
            >
              <span>
                <span className="font-mono font-bold">{svc.truckPlateSnapshot}</span>
                <span className="ml-2 opacity-70 text-xs">{svc.truckMake} {svc.truckModel}</span>
              </span>
              <span className="text-xs opacity-80 shrink-0 ml-2">{tService(`status.${svc.status}`)}</span>
            </Link>
          ))}
        </div>
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
  const [popoverDay, setPopoverDay] = useState<string | null>(null)

  const DAYS = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, i + 1))
  )

  const firstDay   = new Date(year, month, 1)
  const startDow   = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const today = new Date().toISOString().slice(0, 10)

  function dateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return (
    <div>
      {popoverDay && (
        <DayPopover
          date={popoverDay}
          services={services.filter(s => occupies(s, popoverDay, today))}
          today={today}
          onClose={() => setPopoverDay(null)}
        />
      )}

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs text-gray-500 font-medium py-1">{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-800 rounded-xl overflow-hidden">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="bg-gray-50 dark:bg-gray-950 min-h-20" />

          const ds      = dateStr(day)
          const daySvcs = services.filter((s) => occupies(s, ds, today))
          const isToday = ds === today
          const dow     = dowMon(ds)

          return (
            <div
              key={i}
              className={`bg-white dark:bg-gray-900 min-h-20 p-1 flex flex-col ${canCreate ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/70' : ''} ${isToday ? 'ring-1 ring-blue-500 ring-inset' : ''}`}
              onClick={() => canCreate && onDayClick(ds)}
            >
              <span className={`text-xs font-medium mb-1 self-end ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
                {day}
              </span>
              <div className="space-y-0.5 flex-1">
                {daySvcs.slice(0, 3).map((svc) => {
                  const { start, end } = getServiceSpan(svc, today)
                  const isVisStart = ds === start || dow === 0
                  const isVisEnd   = ds === end   || dow === 6
                  const showText   = ds === start || dow === 0
                  const rounding   = isVisStart && isVisEnd ? 'rounded-sm'
                    : isVisStart ? 'rounded-l-sm rounded-r-none'
                    : isVisEnd   ? 'rounded-r-sm rounded-l-none'
                    : 'rounded-none'
                  return (
                    <Link
                      key={svc.id}
                      href={`/services/${svc.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className={`block px-1 py-0.5 text-xs truncate leading-tight ${STATUS_COLOR[svc.status]} ${rounding}`}
                    >
                      {showText ? svc.truckPlateSnapshot : '\u00A0'}
                    </Link>
                  )
                })}
                {daySvcs.length > 3 && (
                  <button
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline leading-tight px-1"
                    onClick={(e) => { e.stopPropagation(); setPopoverDay(ds) }}
                  >
                    +{daySvcs.length - 3}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── GanttWeekView ────────────────────────────────────────────────────────────

function GanttWeekView({
  weekStart, services, canCreate, onDayClick,
}: {
  weekStart: Date; services: CalService[]
  canCreate: boolean; onDayClick: (date: string) => void
}) {
  const tService = useTranslations('service')
  const locale   = useLocale()

  const DAYS = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, i + 1))
  )

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  const weekDays = days.map(d => d.toISOString().slice(0, 10))
  const today    = new Date().toISOString().slice(0, 10)

  const weekSvcs  = services.filter(svc => weekDays.some(d => occupies(svc, d, today)))
  const slotMap   = assignSlots(weekSvcs, weekDays, today)
  const numSlots  = weekSvcs.length === 0 ? 0 : Math.max(...weekSvcs.map(s => slotMap.get(s.id) ?? 0)) + 1
  // rows: 1=header, 2..numSlots+1=event rows, numSlots+2=empty fill
  const totalGridRows = numSlots + 2

  return (
    <div
      className="border border-gray-300 dark:border-gray-800 rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        gridTemplateRows: `auto${numSlots > 0 ? ` repeat(${numSlots}, 2.25rem)` : ''} minmax(4rem, 1fr)`,
        gap: '1px',
      }}
    >
      {/* Row 1: Day headers */}
      {days.map((day, i) => {
        const ds      = weekDays[i]
        const isToday = ds === today
        return (
          <div
            key={`h${i}`}
            style={{ gridColumn: i + 1, gridRow: 1 }}
            className="bg-white dark:bg-gray-900 p-2"
          >
            <p className="text-xs text-gray-500">{DAYS[(day.getDay() + 6) % 7]}</p>
            <p className={`text-sm font-semibold ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
              {day.getDate()}.{String(day.getMonth() + 1).padStart(2, '0')}
            </p>
          </div>
        )
      })}

      {/* Background click areas — each column spans all event + fill rows */}
      {days.map((_, i) => {
        const ds      = weekDays[i]
        const isToday = ds === today
        return (
          <div
            key={`bg${i}`}
            style={{ gridColumn: i + 1, gridRowStart: 2, gridRowEnd: totalGridRows + 1 }}
            className={`bg-white dark:bg-gray-900 ${isToday ? 'ring-1 ring-blue-500 ring-inset' : ''} ${canCreate ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/70' : ''}`}
            onClick={() => canCreate && onDayClick(ds)}
          />
        )
      })}

      {/* Event bars */}
      {weekSvcs.map((svc) => {
        const { startCol, endCol } = getWeekCols(svc, weekDays, today)
        const slotRow  = (slotMap.get(svc.id) ?? 0) + 2  // +2: offset past header row
        const { start } = getServiceSpan(svc, today)
        const showText = weekDays[startCol] === start || startCol === 0

        const roundLeft  = startCol === 0 || weekDays[startCol] === start
        const roundRight = endCol === 6   || weekDays[endCol]   === getServiceSpan(svc, today).end
        const rounding   = roundLeft && roundRight ? 'rounded-lg mx-1'
          : roundLeft  ? 'rounded-l-lg ml-1 mr-0'
          : roundRight ? 'rounded-r-lg ml-0 mr-1'
          : 'rounded-none mx-0'

        return (
          <Link
            key={svc.id}
            href={`/services/${svc.id}`}
            onClick={(e) => e.stopPropagation()}
            style={{ gridColumn: `${startCol + 1} / ${endCol + 2}`, gridRow: slotRow }}
            className={`relative z-10 flex items-center overflow-hidden h-8 my-0.5 px-2 text-xs ${STATUS_COLOR[svc.status]} ${rounding}`}
          >
            {showText && (
              <span className="min-w-0">
                <span className="block font-mono font-semibold truncate leading-tight">{svc.truckPlateSnapshot}</span>
                <span className="block opacity-70 truncate leading-tight">{svc.truckMake} {svc.truckModel}</span>
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}

// ─── AgendaView ───────────────────────────────────────────────────────────────

function AgendaView({
  weekStart, services,
}: {
  weekStart: Date; services: CalService[]
}) {
  const t        = useTranslations('calendar')
  const tService = useTranslations('service')
  const locale   = useLocale()

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })
  const weekDays = days.map(d => d.toISOString().slice(0, 10))
  const today    = new Date().toISOString().slice(0, 10)

  // Group each service under the first day of the week it occupies
  const grouped = new Map<string, CalService[]>()
  for (const svc of services) {
    const firstDay = weekDays.find(d => occupies(svc, d, today))
    if (!firstDay) continue
    if (!grouped.has(firstDay)) grouped.set(firstDay, [])
    grouped.get(firstDay)!.push(svc)
  }

  const hasSome = [...grouped.values()].some(arr => arr.length > 0)

  if (!hasSome) {
    return (
      <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
        {t('noServicesThisWeek')}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {weekDays.map((ds) => {
        const svcs = grouped.get(ds)
        if (!svcs || svcs.length === 0) return null
        const date = days[weekDays.indexOf(ds)]
        const dayLabel = new Intl.DateTimeFormat(locale, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)

        return (
          <div key={ds}>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wider mb-2 capitalize">
              {dayLabel}
            </h3>
            <div className="space-y-2">
              {svcs.map((svc) => {
                const isActive  = ACTIVE_STATUSES.includes(svc.status)
                const dayCount  = isActive ? daysInServiceCount(svc.startDate, today) : null
                return (
                  <Link
                    key={svc.id}
                    href={`/services/${svc.id}`}
                    className="flex items-center justify-between gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/70 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-sm text-gray-900 dark:text-white truncate">
                        {svc.truckPlateSnapshot}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {svc.truckMake} {svc.truckModel}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {dayCount !== null && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {t('dayN', { n: dayCount })}
                        </span>
                      )}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${STATUS_COLOR[svc.status]}`}>
                        {tService(`status.${svc.status}`)}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
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
      const tr = trucks.find(t => t.id === Number(truckId))
      onCreated({
        id:                 json.service.id,
        truckPlateSnapshot: json.service.truckPlateSnapshot,
        truckMake:          tr?.make  ?? '',
        truckModel:         tr?.model ?? '',
        status:             json.service.status,
        scheduledDate:      json.service.scheduledDate?.slice(0, 10) ?? date,
        startDate:          null,
        endDate:            null,
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
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
  const [viewMode,    setViewMode]    = useState<'month' | 'week' | 'agenda'>('month')
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [services,    setServices]    = useState<CalService[]>(initialServices)
  const [createDate,  setCreateDate]  = useState<string | null>(null)

  function getWeekStart(d: Date) {
    const date = new Date(d)
    const dow  = (date.getDay() + 6) % 7
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

  function switchView(mode: 'month' | 'week' | 'agenda') {
    if (mode !== 'month' && viewMode === 'month') {
      // Sync weekStart to the visible month
      setWeekStart(getWeekStart(new Date(currentDate.getFullYear(), currentDate.getMonth(), today.getDate())))
    }
    if (mode === 'month' && viewMode !== 'month') {
      // Sync currentDate to the visible week
      setCurrentDate(new Date(weekStart.getFullYear(), weekStart.getMonth(), 1))
    }
    setViewMode(mode)
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
            className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 rounded-lg transition-colors">
            {t('today')}
          </button>
        </div>

        {/* View mode toggle */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
          {(['month', 'week', 'agenda'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => switchView(mode)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                viewMode === mode ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {t(mode as 'month' | 'week' | 'agenda')}
            </button>
          ))}
        </div>
      </div>

      {/* Legend (hidden in agenda view — status is shown inline on cards) */}
      {viewMode !== 'agenda' && (
        <div className="flex flex-wrap gap-3">
          {(Object.entries(STATUS_COLOR) as [ServiceStatus, string][]).map(([status, color]) => (
            <span key={status} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs ${color}`}>
              {tService(`status.${status}`)}
            </span>
          ))}
        </div>
      )}

      {/* Calendar grid */}
      {viewMode === 'month' ? (
        <MonthView
          year={currentDate.getFullYear()}
          month={currentDate.getMonth()}
          services={services}
          canCreate={canCreate}
          onDayClick={(date) => setCreateDate(date)}
        />
      ) : viewMode === 'week' ? (
        <GanttWeekView
          weekStart={weekStart}
          services={services}
          canCreate={canCreate}
          onDayClick={(date) => setCreateDate(date)}
        />
      ) : (
        <AgendaView
          weekStart={weekStart}
          services={services}
        />
      )}

      {canCreate && viewMode !== 'agenda' && (
        <p className="text-xs text-gray-600 text-center">{t('clickDayHint')}</p>
      )}
    </div>
  )
}
