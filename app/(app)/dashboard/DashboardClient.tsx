'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// ─── Types ──────────────────────────────────────────────────────────────────

type ActiveStatus = 'INTAKE' | 'IN_PROGRESS' | 'QUALITY_CHECK' | 'READY'

interface ActiveService {
  id: number
  truckPlateSnapshot: string
  truckMake: string
  truckModel: string
  status: string
  startDate: string | null
  createdAt: string
}

interface BayInfo {
  id: number
  name: string
  service: (ActiveService & { status: ActiveStatus }) | null
}

interface UpcomingService {
  id: number
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

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  INTAKE:        'bg-blue-600/20 text-blue-400 border-blue-500/30',
  IN_PROGRESS:   'bg-indigo-600/20 text-indigo-400 border-indigo-500/30',
  QUALITY_CHECK: 'bg-purple-600/20 text-purple-400 border-purple-500/30',
  READY:         'bg-green-600/20 text-green-400 border-green-500/30',
}

const BAY_BORDER: Record<string, string> = {
  INTAKE:        'border-blue-500/30',
  IN_PROGRESS:   'border-indigo-500/30',
  QUALITY_CHECK: 'border-purple-500/30',
  READY:         'border-green-500/30',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysInService(startDate: string | null, createdAt: string): number {
  const ref = startDate ?? createdAt
  const diffMs = Date.now() - new Date(ref).getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getUTCFullYear()}`
}

function fmtKm(km: number, kmUnit: string) {
  return Math.round(km).toLocaleString('bg-BG') + kmUnit
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status, label }: { status: string; label: string }) {
  const color = STATUS_COLOR[status] ?? 'bg-gray-600/20 text-gray-400 border-gray-500/30'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium border ${color}`}>
      {label}
    </span>
  )
}

function BayCard({
  bay,
  statusLabel,
  dayLabel,
  freeLabel,
}: {
  bay: BayInfo
  statusLabel: string
  dayLabel: string
  freeLabel: string
}) {
  if (!bay.service) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 min-h-[128px] flex flex-col">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-auto">{bay.name}</p>
        <p className="text-sm text-gray-600 mt-3">{freeLabel}</p>
      </div>
    )
  }

  const { service } = bay
  const border = BAY_BORDER[service.status] ?? 'border-gray-700'

  return (
    <Link
      href={`/services/${service.id}`}
      className={`block bg-white dark:bg-gray-900 border ${border} rounded-xl p-4 min-h-[128px] flex flex-col hover:brightness-110 transition-all`}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{bay.name}</p>
        <StatusBadge status={service.status} label={statusLabel} />
      </div>
      <p className="font-mono font-bold text-gray-900 dark:text-white text-lg leading-tight">{service.truckPlateSnapshot}</p>
      <p className="text-xs text-gray-500 mt-0.5">{service.truckMake} {service.truckModel}</p>
      <p className="text-xs text-gray-600 mt-auto pt-2">{dayLabel}</p>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardClient({
  bays: initialBays,
  upcoming: initialUpcoming,
  mileageAlerts: initialMileageAlerts,
  unbayedServices: initialUnbayed,
}: {
  bays: BayInfo[]
  upcoming: UpcomingService[]
  mileageAlerts: MileageAlert[]
  unbayedServices: ActiveService[]
}) {
  const t = useTranslations('dashboard')
  const tService = useTranslations('service')

  const { data } = useSWR('/api/dashboard', fetcher, {
    refreshInterval:    30_000,
    fallbackData:       { bays: initialBays, upcoming: initialUpcoming, mileageAlerts: initialMileageAlerts, unbayedServices: initialUnbayed },
    revalidateOnFocus:  false,
  })

  const bays             = (data?.bays            ?? initialBays)            as BayInfo[]
  const upcoming         = (data?.upcoming         ?? initialUpcoming)        as UpcomingService[]
  const mileageAlerts    = (data?.mileageAlerts    ?? initialMileageAlerts)   as MileageAlert[]
  const unbayedServices  = (data?.unbayedServices  ?? initialUnbayed)         as ActiveService[]

  const occupiedCount = bays.filter((b) => b.service).length

  const kmUnit = t('kmUnit')

  function getDayLabel(n: number): string {
    if (n === 0) return t('today')
    if (n === 1) return t('dayInService', { days: n })
    return t('daysInServiceLabel', { days: n })
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {t('baysOccupied', { occupied: occupiedCount, total: bays.length })}
          </p>
        </div>
        {mileageAlerts.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="text-sm text-amber-400 font-medium">
              {mileageAlerts.length === 1
                ? t('truckRequiresService', { count: mileageAlerts.length })
                : t('trucksRequireService', { count: mileageAlerts.length })}
            </span>
          </div>
        )}
      </div>

      {/* Bay grid */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{t('bays')}</h2>
        {bays.length === 0 ? (
          <p className="text-sm text-gray-500">{t('noBaysConfigured')}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {bays.map((bay) => {
              const days = bay.service ? daysInService(bay.service.startDate, bay.service.createdAt) : 0
              return (
                <BayCard
                  key={bay.id}
                  bay={bay}
                  statusLabel={bay.service ? (tService(`status.${bay.service.status}`) ?? bay.service.status) : ''}
                  dayLabel={getDayLabel(days)}
                  freeLabel={t('bayFree')}
                />
              )
            })}
          </div>
        )}
      </section>

      {/* Unbayed active services (active but no bay assigned yet) */}
      {unbayedServices.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            {t('activeNoBay')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {unbayedServices.map((s) => (
              <Link
                key={s.id}
                href={`/services/${s.id}`}
                className="block bg-white dark:bg-gray-900 border border-gray-300/50 dark:border-gray-700/50 rounded-xl p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-1">
                  <p className="font-mono font-semibold text-gray-900 dark:text-white">{s.truckPlateSnapshot}</p>
                  <StatusBadge status={s.status} label={tService(`status.${s.status}`) ?? s.status} />
                </div>
                <p className="text-xs text-gray-500">{s.truckMake} {s.truckModel}</p>
                <p className="text-xs text-gray-600 mt-2">{getDayLabel(daysInService(s.startDate, s.createdAt))}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Bottom two-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Upcoming scheduled */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            {t('upcomingScheduled')}
          </h2>
          <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
            {upcoming.length === 0 ? (
              <p className="px-5 py-10 text-sm text-gray-500 text-center">{t('noUpcomingScheduled')}</p>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                {upcoming.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/services/${s.id}`}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div>
                        <p className="font-mono font-semibold text-gray-900 dark:text-white text-sm">{s.truckPlateSnapshot}</p>
                        <p className="text-xs text-gray-500">{s.truckMake} {s.truckModel}</p>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 tabular-nums">{fmtDate(s.scheduledDate)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Mileage alerts */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            {t('mileageAlerts')}
          </h2>
          <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
            {mileageAlerts.length === 0 ? (
              <p className="px-5 py-10 text-sm text-gray-500 text-center">{t('noMileageAlerts')}</p>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                {mileageAlerts.map((truck) => {
                  const kmSince = truck.lastServiceMileage !== null
                    ? truck.currentMileage - truck.lastServiceMileage
                    : truck.currentMileage
                  const overBy = kmSince - truck.mileageTriggerKm
                  return (
                    <li key={truck.id}>
                      <Link
                        href={`/trucks/${truck.id}`}
                        className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <div>
                          <p className="font-mono font-semibold text-gray-900 dark:text-white text-sm">{truck.plateNumber}</p>
                          <p className="text-xs text-gray-500">{truck.make} {truck.model}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-amber-400 font-medium">{fmtKm(kmSince, kmUnit)}</p>
                          <p className="text-xs text-gray-500">{t('overLimit', { km: fmtKm(overBy, kmUnit).trimStart() })}</p>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
