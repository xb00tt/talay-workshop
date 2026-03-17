'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// ─── Types ────────────────────────────────────────────────────────────────────

type ActiveStatus = 'INTAKE' | 'IN_PROGRESS' | 'READY'

const STATUSES: ActiveStatus[] = ['INTAKE', 'IN_PROGRESS', 'READY']

interface ActiveService {
  id: number
  truckPlateSnapshot: string
  truckMake: string
  truckModel: string
  status: ActiveStatus
  startDate: string | null
  createdAt: string
  driverNameSnapshot: string | null
  firstMechanic: string | null
  mechanicCount: number
  totalWorkCards: number
  completedWorkCards: number
}

interface UpcomingService {
  id: number
  truckId: number
  truckPlateSnapshot: string
  truckMake: string
  truckModel: string
  scheduledDate: string
}

interface MileageAlert {
  id: number
  plateNumber: string
  make: string
  model: string
  currentMileage: number
  mileageTriggerKm: number
  lastServiceMileage: number | null
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STALE_DAYS: Record<ActiveStatus, number> = {
  INTAKE:      2,
  IN_PROGRESS: 5,
  READY:       2,
}

const STATUS_CONFIG: Record<ActiveStatus, {
  dot:      string
  badge:    string
  tabActive: string
}> = {
  INTAKE: {
    dot:       'bg-blue-500',
    badge:     'bg-blue-500/10 text-blue-600 dark:text-blue-300',
    tabActive: 'border-b-blue-500 text-blue-400',
  },
  IN_PROGRESS: {
    dot:       'bg-amber-500',
    badge:     'bg-amber-500/10 text-amber-600 dark:text-amber-300',
    tabActive: 'border-b-amber-500 text-amber-400',
  },
  READY: {
    dot:       'bg-emerald-500',
    badge:     'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    tabActive: 'border-b-emerald-500 text-emerald-400',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysInService(startDate: string | null, createdAt: string): number {
  const ref = startDate ?? createdAt
  return Math.max(0, Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000))
}

function dayUrgencyColor(days: number): string {
  if (days <= 1) return 'text-slate-400'
  if (days === 2) return 'text-yellow-500'
  if (days <= 4) return 'text-amber-500'
  return 'text-red-500'
}

function fmtKm(km: number) {
  return Math.round(km).toLocaleString('bg-BG') + ' км'
}

const STATUS_BAR_COLOR: Record<ActiveStatus, string> = {
  INTAKE:      'bg-blue-500',
  IN_PROGRESS: 'bg-amber-500',
  READY:       'bg-emerald-500',
}

function relativeDay(scheduledDate: string): string | null {
  const now   = new Date()
  const sched = new Date(scheduledDate)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const schedStart = new Date(Date.UTC(sched.getUTCFullYear(), sched.getUTCMonth(), sched.getUTCDate()))
  const diff  = Math.round((schedStart.getTime() - todayStart.getTime()) / 86_400_000)
  if (diff === 0) return 'днес'
  if (diff === 1) return 'утре'
  if (diff > 1 && diff <= 7) return `след ${diff}д`
  return null
}

// ─── Camera placeholder ───────────────────────────────────────────────────────

const CAMERAS = [
  { id: 1, label: 'КАНАЛ 1' },
  { id: 2, label: 'КАНАЛ 2' },
  { id: 3, label: 'ВХОД'    },
  { id: 4, label: 'ПАРКИНГ' },
]

function CameraCard({ label }: { label: string }) {
  const [ts, setTs] = useState('')

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const dd  = String(now.getDate()).padStart(2, '0')
      const mm  = String(now.getMonth() + 1).padStart(2, '0')
      const hms = now.toTimeString().slice(0, 8)
      setTs(`${dd}.${mm} · ${hms}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className="rounded-xl overflow-hidden relative select-none"
      style={{ background: '#0a0c10', border: '1px solid #1e2530', aspectRatio: '16/10' }}
    >
      {/* Scanlines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.06) 3px,rgba(0,0,0,0.06) 4px)' }}
      />
      {/* Centre camera icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg className="w-9 h-9" style={{ color: 'rgba(255,255,255,0.05)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.069A1 1 0 0121 8.816v6.368a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>
      {/* Corner brackets */}
      {[
        'top-2 left-2 border-t border-l',
        'top-2 right-2 border-t border-r',
        'bottom-6 left-2 border-b border-l',
        'bottom-6 right-2 border-b border-r',
      ].map((cls, i) => (
        <div
          key={i}
          className={`absolute w-3 h-3 ${cls}`}
          style={{ borderColor: 'rgba(74,222,128,0.35)', borderWidth: '1.5px' }}
        />
      ))}
      {/* Offline dot */}
      <div className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-slate-600" />
      {/* Bottom bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2.5 py-1"
        style={{ background: 'rgba(0,0,0,0.65)', fontFamily: 'ui-monospace, monospace' }}
      >
        <span className="text-[11px] font-medium" style={{ color: 'rgba(74,222,128,0.8)' }}>{label}</span>
        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{ts}</span>
      </div>
    </div>
  )
}

// ─── Kanban column ────────────────────────────────────────────────────────────

function LaneColumn({
  status,
  services,
  statusLabel,
  dayLabel,
}: {
  status: ActiveStatus
  services: ActiveService[]
  statusLabel: string
  dayLabel: (n: number) => string
}) {
  const cfg    = STATUS_CONFIG[status]
  const sorted = [...services].sort(
    (a, b) => daysInService(b.startDate, b.createdAt) - daysInService(a.startDate, a.createdAt),
  )

  return (
    <div className="flex flex-col gap-2">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide flex-1 truncate" style={{ fontFamily: "'Outfit', sans-serif" }}>
          {statusLabel}
        </span>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full tabular-nums ${cfg.badge}`}>
          {services.length}
        </span>
      </div>

      {/* Cards */}
      {sorted.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">—</p>
      ) : (
        sorted.map((svc) => {
          const days       = daysInService(svc.startDate, svc.createdAt)
          const isStale    = days >= STALE_DAYS[status]
          const isCritical = days >= 5
          const pct        = svc.totalWorkCards > 0 ? (svc.completedWorkCards / svc.totalWorkCards) * 100 : 0
          return (
            <Link
              key={svc.id}
              href={`/services/${svc.id}`}
              className={`block rounded-xl p-3 transition-all
                border border-[#c4cdd9] dark:border-gray-800
                shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-none
                hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] dark:hover:bg-gray-800/60
                ${isStale
                  ? 'border-l-[3px] border-l-red-400 bg-red-50/50 dark:bg-red-950/30'
                  : 'bg-white dark:bg-gray-900'
                }
              `}
            >
              <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {svc.truckPlateSnapshot}
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                {svc.truckMake} {svc.truckModel}
              </p>

              {/* Progress bar */}
              {svc.totalWorkCards > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${STATUS_BAR_COLOR[status]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-slate-400 shrink-0">
                    {svc.completedWorkCards}/{svc.totalWorkCards}
                  </span>
                </div>
              )}

              <div className="mt-2 flex items-center justify-between gap-1 min-w-0">
                <span className="text-xs text-slate-400 dark:text-slate-500 truncate min-w-0">
                  {svc.driverNameSnapshot
                    ? svc.driverNameSnapshot
                    : svc.firstMechanic
                      ? `${svc.firstMechanic}${svc.mechanicCount > 1 ? ` +${svc.mechanicCount - 1}` : ''}`
                      : null
                  }
                </span>
                <span className={`flex items-center gap-1 text-xs font-medium tabular-nums shrink-0 ${dayUrgencyColor(days)}`} aria-label={isStale ? 'Просрочен' : undefined}>
                  {isCritical && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                  {dayLabel(days)}
                </span>
              </div>
            </Link>
          )
        })
      )}
    </div>
  )
}

// ─── Alerts card ──────────────────────────────────────────────────────────────

function AlertsCard({ alerts, scheduleLabel }: { alerts: MileageAlert[]; scheduleLabel: string }) {
  if (alerts.length === 0) return null
  return (
    <div
      id="alerts"
      className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-[#c4cdd9] dark:border-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-none"
    >
      <div className="px-4 py-3 bg-red-50 dark:bg-red-500/8 border-b border-red-100 dark:border-red-500/20 flex items-center gap-2">
        <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="text-sm font-semibold text-red-700 dark:text-red-400 flex-1">КМ Сигнали</span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 tabular-nums">
          {alerts.length}
        </span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-gray-800">
        {alerts.map((truck) => {
          const kmSince = truck.lastServiceMileage != null
            ? truck.currentMileage - truck.lastServiceMileage
            : truck.currentMileage
          return (
            <div key={truck.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-sm text-slate-800 dark:text-white truncate">{truck.plateNumber}</p>
                <p className="text-xs text-slate-400 tabular-nums">
                  {fmtKm(kmSince)} / {fmtKm(truck.mileageTriggerKm)}
                </p>
              </div>
              <Link
                href={`/services/new?truckId=${truck.id}`}
                className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                {scheduleLabel}
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Upcoming card ────────────────────────────────────────────────────────────

function UpcomingCard({ upcoming, emptyLabel, viewAllLabel, alertTruckIds }: {
  upcoming: UpcomingService[]
  emptyLabel: string
  viewAllLabel: string
  alertTruckIds: Set<number>
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-[#c4cdd9] dark:border-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-none">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-gray-800 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300" style={{ fontFamily: "'Outfit', sans-serif" }}>Предстоящи</span>
        <Link href="/services" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
          {viewAllLabel}
        </Link>
      </div>
      {upcoming.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-400 text-center">{emptyLabel}</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-gray-800">
          {upcoming.slice(0, 8).map((s) => {
            const d       = new Date(s.scheduledDate)
            const day     = d.getUTCDate()
            const mon     = d.toLocaleString('bg-BG', { month: 'short' }).replace('.', '')
            const rel     = relativeDay(s.scheduledDate)
            const hasAlert = alertTruckIds.has(s.truckId)
            return (
              <Link
                key={s.id}
                href={`/services/${s.id}`}
                className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums" style={{ fontFamily: "'Outfit', sans-serif" }}>{day}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-sm text-slate-800 dark:text-white truncate">{s.truckPlateSnapshot}</p>
                    {hasAlert && (
                      <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">{s.truckMake} {s.truckModel}</p>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{rel ?? mon}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardClient({
  initialActiveServices,
  upcoming: initialUpcoming,
  mileageAlerts: initialMileageAlerts,
  userName,
}: {
  initialActiveServices: ActiveService[]
  upcoming: UpcomingService[]
  mileageAlerts: MileageAlert[]
  userName: string
}) {
  const t        = useTranslations('dashboard')
  const tService = useTranslations('service')

  const { data } = useSWR('/api/dashboard', fetcher, {
    refreshInterval:   30_000,
    fallbackData:      { activeServices: initialActiveServices, upcoming: initialUpcoming, mileageAlerts: initialMileageAlerts },
    revalidateOnFocus: false,
  })

  const activeServices = (data?.activeServices ?? initialActiveServices) as ActiveService[]
  const upcoming       = (data?.upcoming       ?? initialUpcoming)       as UpcomingService[]
  const mileageAlerts  = (data?.mileageAlerts  ?? initialMileageAlerts)  as MileageAlert[]

  const [activeTab, setActiveTab] = useState<ActiveStatus>('INTAKE')
  const [greeting,  setGreeting]  = useState('')
  const [dateStr,   setDateStr]   = useState('')
  const isFirstMount = useRef(true)

  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? t('greetingMorning') : h < 18 ? t('greetingAfternoon') : t('greetingEvening'))
    setDateStr(new Date().toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' }))
    // Mark first mount complete after animations have time to play
    const timer = setTimeout(() => { isFirstMount.current = false }, 800)
    return () => clearTimeout(timer)
  }, [t])

  const alertTruckIds = new Set(mileageAlerts.map((a) => a.id))


  const byStatus = Object.fromEntries(
    STATUSES.map((s) => [s, activeServices.filter((svc) => svc.status === s)]),
  ) as Record<ActiveStatus, ActiveService[]>

  function getDayLabel(n: number): string {
    if (n === 0) return t('today')
    if (n === 1) return t('dayInService', { days: n })
    return t('daysInServiceLabel', { days: n })
  }

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Sticky header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-slate-200 dark:border-gray-800 px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-semibold text-slate-900 dark:text-white text-lg leading-tight truncate" style={{ fontFamily: "'Outfit', sans-serif" }}>
            {greeting}{userName ? `, ${userName.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {dateStr}
            {activeServices.length > 0 && (
              <> · {t('activeOrdersCount', { count: activeServices.length })}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {mileageAlerts.length > 0 && (
            <a
              href="#alerts"
              className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-3 py-1.5 rounded-lg font-medium hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="hidden sm:inline">{mileageAlerts.length} {t('statAlerts').toLowerCase()}</span>
              <span className="sm:hidden">{mileageAlerts.length}</span>
            </a>
          )}
          <Link
            href="/services"
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded-lg font-medium transition-colors shadow-sm"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">{t('newOrder')}</span>
          </Link>
        </div>
      </header>

      <div className="px-6 lg:px-8 py-6 space-y-6">

        {/* ── Camera feeds ───────────────────────────────────────────────────────── */}
        <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-3">
          {CAMERAS.map((cam) => <CameraCard key={cam.id} label={cam.label} />)}
        </div>

        {/* ── Content grid ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Kanban — 2/3 */}
          <div className="lg:col-span-2">
            {activeServices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-gray-900 rounded-xl border border-[#c4cdd9] dark:border-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-none">
                <svg className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                </svg>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('noTrucksInWorkshop')}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('noTrucksInWorkshopHint')}</p>
                <Link
                  href="/services"
                  className="mt-4 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('newOrder')}
                </Link>
              </div>
            ) : (
              <>
                {/* Desktop 4-col kanban */}
                <div className="hidden md:grid md:grid-cols-4 gap-4">
                  {STATUSES.map((status, i) => (
                    <div key={status} className={isFirstMount.current ? 'animate-slide-up' : ''} style={isFirstMount.current ? { animationDelay: `${100 + i * 75}ms` } : undefined}>
                      <LaneColumn
                        status={status}
                        services={byStatus[status]}
                        statusLabel={tService(`status.${status}` as Parameters<typeof tService>[0])}
                        dayLabel={getDayLabel}
                      />
                    </div>
                  ))}
                </div>

                {/* Mobile tabbed */}
                <div className="md:hidden">
                  <div className="flex border-b border-slate-200 dark:border-gray-800 mb-4">
                    {STATUSES.map((status) => {
                      const cfg      = STATUS_CONFIG[status]
                      const isActive = activeTab === status
                      return (
                        <button
                          key={status}
                          onClick={() => setActiveTab(status)}
                          className={`flex-1 py-2.5 text-xs font-medium transition-colors flex flex-col items-center gap-0.5 border-b-2
                            ${isActive ? cfg.tabActive : 'text-slate-400 border-transparent'}`}
                        >
                          <span className="truncate w-full text-center px-1">
                            {t(`short${status}` as Parameters<typeof t>[0])}
                          </span>
                          <span className="font-bold tabular-nums">{byStatus[status].length}</span>
                        </button>
                      )
                    })}
                  </div>
                  <LaneColumn
                    status={activeTab}
                    services={byStatus[activeTab]}
                    statusLabel={tService(`status.${activeTab}` as Parameters<typeof tService>[0])}
                    dayLabel={getDayLabel}
                  />
                </div>
              </>
            )}
          </div>

          {/* Right panel — 1/3 */}
          <div className="space-y-4">
            <div className={isFirstMount.current ? 'animate-slide-up' : ''} style={isFirstMount.current ? { animationDelay: '200ms' } : undefined}>
              <AlertsCard alerts={mileageAlerts} scheduleLabel={t('schedule')} />
            </div>
            <div className={isFirstMount.current ? 'animate-slide-up' : ''} style={isFirstMount.current ? { animationDelay: '275ms' } : undefined}>
              <UpcomingCard
                upcoming={upcoming}
                emptyLabel={t('noUpcomingScheduled')}
                viewAllLabel={t('viewAll')}
                alertTruckIds={alertTruckIds}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
