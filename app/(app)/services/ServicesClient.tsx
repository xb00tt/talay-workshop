'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { SERVICE_STATUS_COLOR } from '@/lib/status-config'
import { Input, Select, Label, ErrorBox, Modal } from '@/components/ui'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// ─── Types ───────────────────────────────────────────────────────────────────────

type ServiceStatus =
  | 'SCHEDULED' | 'INTAKE' | 'IN_PROGRESS'
  | 'READY' | 'COMPLETED' | 'CANCELLED'

interface ServiceRow {
  id: number
  truckPlateSnapshot: string
  status: ServiceStatus
  scheduledDate: string
  startDate: string | null
  endDate: string | null
  driverNameSnapshot: string | null
  createdAt: string
  truck: {
    make: string
    model: string
    isAdr: boolean
    year: number | null
    currentMileage: number | null
  }
  sections: { workCards: { status: string; mechanicName: string | null }[] }[]
}

interface Truck {
  id: number
  plateNumber: string
  make: string
  model: string
  isActive: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────────

// Grid columns: plate | truck | status | mechanic | driver | date | days
const COL = '110px 1fr 134px 128px 112px 80px 56px'

// ─── Helpers ──────────────────────────────────────────────────────────────────────

function fmtDateShort(iso: string) {
  const d = new Date(iso)
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function fmtMileage(km: number) {
  return Math.round(km).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + '\u00a0км'
}

function daysInShop(startIso: string, endIso: string | null): number {
  const start = new Date(startIso).getTime()
  const end   = endIso ? new Date(endIso).getTime() : Date.now()
  return Math.max(0, Math.floor((end - start) / 86_400_000))
}

// ─── Shared UI ───────────────────────────────────────────────────────────────────


// ─── Create modal ─────────────────────────────────────────────────────────────────

function CreateModal({
  trucks,
  onClose,
  onCreated,
}: {
  trucks: Truck[]
  onClose: () => void
  onCreated: () => void
}) {
  const t      = useTranslations('service')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')

  const [truckId, setTruckId]             = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const activeTrucks = trucks.filter((tr) => tr.isActive)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!truckId)       { setError(t('selectTruck')); return }
    if (!scheduledDate) { setError(t('selectDate')); return }
    setLoading(true)
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ truckId: Number(truckId), scheduledDate }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tErrors('generic')); return }
      onCreated()
      onClose()
    } catch {
      setError(tErrors('generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>{tCommon('truck')} *</Label>
        <Select value={truckId} onChange={(e) => setTruckId(e.target.value)} className="w-full">
          <option value="">{t('selectTruckPlaceholder')}</option>
          {activeTrucks.map((tr) => (
            <option key={tr.id} value={tr.id}>
              {tr.plateNumber} — {tr.make} {tr.model}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>{t('scheduledDate')} *</Label>
        <Input
          type="date"
          value={scheduledDate}
          onChange={(e) => setScheduledDate(e.target.value)}
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
          {loading ? t('creating') : t('create')}
        </button>
      </div>
    </form>
  )
}

// ─── Reschedule modal ─────────────────────────────────────────────────────────────

function RescheduleModal({
  service,
  onClose,
  onUpdated,
}: {
  service: ServiceRow
  onClose: () => void
  onUpdated: () => void
}) {
  const t      = useTranslations('service')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')

  const isoDate = new Date(service.scheduledDate).toISOString().slice(0, 10)
  const [date,    setDate]    = useState(isoDate)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!date) { setError(t('selectDate')); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/services/${service.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledDate: date }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tErrors('generic')); return }
      onUpdated()
      onClose()
    } catch {
      setError(tErrors('generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t('reschedulingOf')}{' '}
        <strong className="text-gray-900 dark:text-white">{service.truckPlateSnapshot}</strong>
      </p>
      <div>
        <Label>{t('newDate')} *</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} autoFocus />
      </div>
      {error && <ErrorBox msg={error} />}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm">
          {tCommon('cancel')}
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
          {loading ? t('saving') : t('reschedule')}
        </button>
      </div>
    </form>
  )
}

// ─── Table row ────────────────────────────────────────────────────────────────────

function ServiceTableRow({
  s,
  t,
  canReschedule,
  onReschedule,
}: {
  s: ServiceRow
  t: ReturnType<typeof useTranslations>
  canReschedule: boolean
  onReschedule: (s: ServiceRow) => void
}) {
  const router     = useRouter()
  const isScheduled = s.status === 'SCHEDULED'
  const isTerminal  = s.status === 'COMPLETED' || s.status === 'CANCELLED'

  const days    = s.startDate ? daysInShop(s.startDate, s.endDate) : null
  const isStale = !isTerminal && days !== null && days >= 5

  const activeWorkCards = s.sections.flatMap((sec) => sec.workCards).filter((wc) => wc.status !== 'CANCELLED' && wc.mechanicName)
  const firstMechanic   = activeWorkCards[0]?.mechanicName ?? null
  const extraMechanics  = activeWorkCards.length > 1 ? activeWorkCards.length - 1 : 0

  const dateIso = isScheduled ? s.scheduledDate : (s.startDate ?? s.scheduledDate)

  const daysClass =
    days === null ? 'text-slate-400 dark:text-gray-600' :
    days >= 7     ? 'text-red-500 dark:text-red-400 font-bold' :
    days >= 4     ? 'text-amber-600 dark:text-amber-400 font-semibold' :
                    'text-slate-600 dark:text-gray-400 font-medium'

  const truckMeta = [
    s.truck.year,
    s.truck.currentMileage != null ? fmtMileage(s.truck.currentMileage) : null,
  ].filter(Boolean).join(' · ')

  return (
    <div
      role="row"
      onClick={() => router.push(`/services/${s.id}`)}
      className={[
        'grid px-5 py-3 items-center cursor-pointer',
        'border-b border-slate-100 dark:border-gray-800 last:border-b-0',
        'hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors group',
        isScheduled ? 'bg-slate-50/50 dark:bg-gray-900/30' : '',
        isStale     ? 'bg-red-50/40 dark:bg-red-500/5' : '',
      ].filter(Boolean).join(' ')}
      style={{ gridTemplateColumns: COL }}
    >
      {/* Plate */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-bold text-slate-900 dark:text-white text-sm tracking-wide font-mono truncate">
          {s.truckPlateSnapshot}
        </span>
        {s.truck.isAdr && (
          <span className="shrink-0 text-[9px] font-bold bg-orange-500/20 text-orange-500 dark:text-orange-400 px-1 py-0.5 rounded leading-tight">
            ADR
          </span>
        )}
      </div>

      {/* Truck info */}
      <div className="min-w-0">
        <div className="text-sm text-slate-800 dark:text-gray-200 truncate">
          {s.truck.make} {s.truck.model}
        </div>
        {truckMeta && (
          <div className="text-xs text-slate-400 dark:text-gray-500 mt-0.5 truncate">{truckMeta}</div>
        )}
      </div>

      {/* Status */}
      <div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SERVICE_STATUS_COLOR[s.status]}`}>
          {t(`status.${s.status}`)}
        </span>
      </div>

      {/* Mechanic */}
      <div className="text-sm text-slate-600 dark:text-gray-400 truncate flex items-center gap-1">
        {firstMechanic
          ? <>
              <span className="truncate">{firstMechanic}</span>
              {extraMechanics > 0 && (
                <span className="shrink-0 text-xs text-slate-400 dark:text-gray-500">+{extraMechanics}</span>
              )}
            </>
          : <span className="text-slate-300 dark:text-gray-600">—</span>
        }
      </div>

      {/* Driver */}
      <div className="text-sm text-slate-600 dark:text-gray-400 truncate">
        {s.driverNameSnapshot ?? <span className="text-slate-300 dark:text-gray-600">—</span>}
      </div>

      {/* Date */}
      <div className="text-sm text-slate-500 dark:text-gray-500">
        {fmtDateShort(dateIso)}
      </div>

      {/* Days / reschedule */}
      <div className="flex items-center justify-center">
        {isScheduled && canReschedule ? (
          <button
            onClick={(e) => { e.stopPropagation(); onReschedule(s) }}
            className="text-xs font-medium px-2 py-1 rounded-md bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-700 hover:text-slate-700 dark:hover:text-gray-200 transition-colors"
          >
            {t('reschedule')}
          </button>
        ) : (
          <span className={`text-sm text-center ${daysClass}`} aria-label={isStale ? 'Просрочен' : undefined}>
            {days !== null ? String(days) : '—'}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────────

type ModalState =
  | 'create'
  | { type: 'reschedule'; service: ServiceRow }
  | null

export default function ServicesClient({
  initialServices,
  initialTotal,
  initialPageSize,
  trucks,
  statusCounts,
  canCreate,
  canReschedule,
}: {
  initialServices: ServiceRow[]
  initialTotal: number
  initialPageSize: number
  trucks: Truck[]
  statusCounts: Record<string, number>
  canCreate: boolean
  canReschedule: boolean
}) {
  const t      = useTranslations('service')
  const tCommon = useTranslations('common')

  const [modal,        setModal]        = useState<ModalState>(null)
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [search,       setSearch]       = useState('')
  const [page,         setPage]         = useState(1)
  const pageSize = initialPageSize

  useEffect(() => { setPage(1) }, [statusFilter, search])

  const params = new URLSearchParams({
    page:     String(page),
    pageSize: String(pageSize),
    status:   statusFilter,
    q:        search.trim(),
  })

  const { data, mutate, isValidating } = useSWR(`/api/services?${params}`, fetcher, {
    refreshInterval:   30_000,
    fallbackData:      { services: initialServices, total: initialTotal, page: 1, pageSize, totalPages: Math.ceil(initialTotal / pageSize) },
    revalidateOnFocus: false,
    keepPreviousData:  true,
  })

  const services:   ServiceRow[] = data?.services  ?? initialServices
  const total:      number       = data?.total      ?? initialTotal
  const totalPages: number       = data?.totalPages ?? Math.ceil(initialTotal / pageSize)

  // Per-status counts for tab badges
  const activeCount    = (['INTAKE', 'IN_PROGRESS', 'READY'] as const).reduce((n, s) => n + (statusCounts[s] ?? 0), 0)
  const scheduledCount = statusCounts['SCHEDULED'] ?? 0
  const completedCount = statusCounts['COMPLETED'] ?? 0

  const TABS = [
    { value: 'active',         label: t('filterAll'),              count: activeCount + scheduledCount },
    { value: 'INTAKE',         label: t('status.INTAKE'),          count: statusCounts['INTAKE']         ?? 0 },
    { value: 'IN_PROGRESS',    label: t('status.IN_PROGRESS'),     count: statusCounts['IN_PROGRESS']    ?? 0 },
    { value: 'READY',          label: t('status.READY'),           count: statusCounts['READY']          ?? 0 },
    { value: 'SCHEDULED',      label: t('status.SCHEDULED'),       count: scheduledCount },
    { value: 'COMPLETED',      label: t('status.COMPLETED'),       count: null },
    { value: 'CANCELLED',      label: t('status.CANCELLED'),       count: null },
  ]

  // Pagination helpers
  const from  = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to    = Math.min(page * pageSize, total)

  return (
    <>
      {/* ── Sticky page header ──────────────────────────────────────────────── */}
      <header className="bg-white dark:bg-gray-900 border-b border-[#c4cdd9] dark:border-gray-800 px-6 md:px-8 py-4 flex items-center justify-between sticky top-0 z-10 gap-4">
        <div className="min-w-0">
          <h1 className="font-semibold text-slate-900 dark:text-white text-lg leading-tight">{t('list')}</h1>
          <p className="text-sm text-slate-500 dark:text-gray-500 mt-0.5 truncate">
            {t('headerStats', { active: activeCount, scheduled: scheduledCount, completed: completedCount })}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setModal('create')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded-lg font-medium transition-colors shadow-sm shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('new')}
          </button>
        )}
      </header>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div className="px-6 md:px-8 py-5 flex flex-col gap-4">

        {/* Filters row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-gray-800 p-1 rounded-xl overflow-x-auto shrink-0 max-w-full">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={[
                  'text-[13px] font-medium px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap transition-all',
                  statusFilter === tab.value
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-[#c4cdd9] dark:border-gray-600'
                    : 'text-slate-500 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-700/60 hover:text-slate-800 dark:hover:text-gray-200',
                ].join(' ')}
              >
                {tab.label}
                {tab.count !== null && tab.count > 0 && (
                  <span className={`ml-1.5 text-xs ${statusFilter === tab.value ? 'text-slate-400 dark:text-gray-500' : 'text-slate-400 dark:text-gray-600'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-auto sm:min-w-[180px] sm:max-w-xs">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="pl-9 pr-4 py-1.5 text-sm border border-slate-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-slate-800 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 w-full"
            />
          </div>
        </div>

        {/* Table card */}
        <div className={`bg-white dark:bg-gray-900 rounded-xl border border-[#c4cdd9] dark:border-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-none overflow-hidden relative transition-opacity ${isValidating && data ? 'opacity-60 pointer-events-none' : ''}`}>
          {isValidating && data && (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-200 dark:bg-blue-900 z-10">
              <div className="h-full bg-blue-500 animate-pulse" />
            </div>
          )}

          {/* Scrollable table wrapper */}
          <div className="overflow-x-auto">

            {/* Column header */}
            <div
              className="grid px-5 py-2.5 bg-slate-50 dark:bg-gray-800/60 border-b border-slate-200 dark:border-gray-800 text-xs font-semibold text-slate-500 dark:text-gray-500 uppercase tracking-wide"
              style={{ gridTemplateColumns: COL, minWidth: '720px' }}
            >
              <span>{t('colPlate')}</span>
              <span>{tCommon('truck')}</span>
              <span>{tCommon('status')}</span>
              <span>{t('colMechanic')}</span>
              <span>{t('driver')}</span>
              <span>{tCommon('date')}</span>
              <span className="text-center">{t('colDays')}</span>
            </div>

            {/* Rows */}
            <div role="rowgroup" style={{ minWidth: '720px' }}>
              {services.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-slate-400 dark:text-gray-600">
                  {t('noResults')}
                </div>
              ) : (
                services.map((s) => (
                  <ServiceTableRow
                    key={s.id}
                    s={s}
                    t={t}
                    canReschedule={canReschedule}
                    onReschedule={(svc) => setModal({ type: 'reschedule', service: svc })}
                  />
                ))
              )}
            </div>
          </div>

          {/* Pagination footer */}
          <div className="px-5 py-3 border-t border-slate-200 dark:border-gray-800 flex items-center justify-between gap-4 bg-slate-50 dark:bg-gray-800/30">
            <span className="text-xs text-slate-500 dark:text-gray-500 shrink-0">
              {total === 0 ? '0' : `${from}–${to}`} / {total}
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="text-xs px-2.5 py-1.5 rounded border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ←
                </button>

                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  // Show pages around current page
                  const pg = totalPages <= 7
                    ? i + 1
                    : page <= 4
                      ? i + 1
                      : page >= totalPages - 3
                        ? totalPages - 6 + i
                        : page - 3 + i
                  return (
                    <button
                      key={pg}
                      onClick={() => setPage(pg)}
                      className={[
                        'text-xs px-2.5 py-1.5 rounded border transition-colors',
                        page === pg
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700',
                      ].join(' ')}
                    >
                      {pg}
                    </button>
                  )
                })}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="text-xs px-2.5 py-1.5 rounded border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  →
                </button>
              </div>
            )}

            <span className="text-xs text-slate-400 dark:text-gray-600 shrink-0">
              {pageSize} {tCommon('rowsPerPage')}
            </span>
          </div>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {modal === 'create' && (
        <Modal title={t('new')} onClose={() => setModal(null)}>
          <CreateModal
            trucks={trucks}
            onClose={() => setModal(null)}
            onCreated={() => mutate()}
          />
        </Modal>
      )}
      {modal !== null && modal !== 'create' && modal.type === 'reschedule' && (
        <Modal title={t('reschedule')} onClose={() => setModal(null)}>
          <RescheduleModal
            service={modal.service}
            onClose={() => setModal(null)}
            onUpdated={() => mutate()}
          />
        </Modal>
      )}
    </>
  )
}
