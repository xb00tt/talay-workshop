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
  status: ActiveStatus
  startDate: string | null
  createdAt: string
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
  INTAKE:        'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-600/20 dark:text-blue-400 dark:border-blue-500/30',
  IN_PROGRESS:   'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-600/20 dark:text-indigo-400 dark:border-indigo-500/30',
  QUALITY_CHECK: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-600/20 dark:text-purple-400 dark:border-purple-500/30',
  READY:         'bg-green-100 text-green-800 border-green-300 dark:bg-green-600/20 dark:text-green-400 dark:border-green-500/30',
}

const CARD_BORDER: Record<string, string> = {
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
  const color = STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-600/20 dark:text-gray-400 dark:border-gray-500/30'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium border ${color}`}>
      {label}
    </span>
  )
}

function ActiveServiceCard({
  service,
  statusLabel,
  dayLabel,
}: {
  service: ActiveService
  statusLabel: string
  dayLabel: string
}) {
  const border = CARD_BORDER[service.status] ?? 'border-gray-700'
  return (
    <Link
      href={`/services/${service.id}`}
      className={`block bg-white dark:bg-gray-900 border ${border} rounded-xl p-4 min-h-[110px] flex flex-col hover:brightness-110 transition-all`}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="font-mono font-bold text-gray-900 dark:text-white text-lg leading-tight">
          {service.truckPlateSnapshot}
        </p>
        <StatusBadge status={service.status} label={statusLabel} />
      </div>
      <p className="text-xs text-gray-500">{service.truckMake} {service.truckModel}</p>
      <p className="text-xs text-gray-600 mt-auto pt-2">{dayLabel}</p>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardClient({
  initialActiveServices,
  upcoming: initialUpcoming,
  mileageAlerts: initialMileageAlerts,
}: {
  initialActiveServices: ActiveService[]
  upcoming: UpcomingService[]
  mileageAlerts: MileageAlert[]
}) {
  const t = useTranslations('dashboard')
  const tService = useTranslations('service')

  const { data } = useSWR('/api/dashboard', fetcher, {
    refreshInterval:    30_000,
    fallbackData:       { activeServices: initialActiveServices, upcoming: initialUpcoming, mileageAlerts: initialMileageAlerts },
    revalidateOnFocus:  false,
  })

  const activeServices = (data?.activeServices ?? initialActiveServices) as ActiveService[]
  const upcoming       = (data?.upcoming       ?? initialUpcoming)       as UpcomingService[]
  const mileageAlerts  = (data?.mileageAlerts  ?? initialMileageAlerts)  as MileageAlert[]

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
            {t('inWorkshopCount', { count: activeServices.length })}
          </p>
        </div>
        {mileageAlerts.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">
              {mileageAlerts.length === 1
                ? t('truckRequiresService', { count: mileageAlerts.length })
                : t('trucksRequireService', { count: mileageAlerts.length })}
            </span>
          </div>
        )}
      </div>

      {/* In Workshop */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          {t('inWorkshop')}
        </h2>
        {activeServices.length === 0 ? (
          <p className="text-sm text-gray-500">{t('noTrucksInWorkshop')}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {activeServices.map((svc) => {
              const days = daysInService(svc.startDate, svc.createdAt)
              return (
                <ActiveServiceCard
                  key={svc.id}
                  service={svc}
                  statusLabel={tService(`status.${svc.status}`) ?? svc.status}
                  dayLabel={getDayLabel(days)}
                />
              )
            })}
          </div>
        )}
      </section>

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
              <ul className="divide-y divide-gray-300 dark:divide-gray-800">
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
              <ul className="divide-y divide-gray-300 dark:divide-gray-800">
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
                          <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">{fmtKm(kmSince, kmUnit)}</p>
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
