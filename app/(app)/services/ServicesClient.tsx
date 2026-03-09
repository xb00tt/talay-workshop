'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import Pagination from '@/components/Pagination'
import { useTranslations } from 'next-intl'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// ─── Types ─────────────────────────────────────────────────────────────────────

type ServiceStatus =
  | 'SCHEDULED' | 'INTAKE' | 'IN_PROGRESS' | 'QUALITY_CHECK'
  | 'READY' | 'COMPLETED' | 'CANCELLED'

interface ServiceRow {
  id: number
  truckPlateSnapshot: string
  status: ServiceStatus
  scheduledDate: string
  startDate: string | null
  endDate: string | null
  bayNameSnapshot: string | null
  driverNameSnapshot: string | null
  createdAt: string
  truck: { make: string; model: string; isAdr: boolean }
  sections: { workCards: { status: string }[] }[]
}

interface Truck {
  id: number
  plateNumber: string
  make: string
  model: string
  isActive: boolean
}

// ─── Status colours ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<ServiceStatus, string> = {
  SCHEDULED:     'bg-amber-100 text-amber-800 dark:bg-amber-600/20 dark:text-amber-400',
  INTAKE:        'bg-blue-100 text-blue-800 dark:bg-blue-600/20 dark:text-blue-400',
  IN_PROGRESS:   'bg-indigo-100 text-indigo-800 dark:bg-indigo-600/20 dark:text-indigo-400',
  QUALITY_CHECK: 'bg-purple-100 text-purple-800 dark:bg-purple-600/20 dark:text-purple-400',
  READY:         'bg-green-100 text-green-800 dark:bg-green-600/20 dark:text-green-400',
  COMPLETED:     'bg-gray-100 text-gray-600 dark:bg-gray-600/20 dark:text-gray-400',
  CANCELLED:     'bg-red-100 text-red-700 dark:bg-red-600/20 dark:text-red-400',
}

const STATUS_STRIPE: Record<ServiceStatus, string> = {
  SCHEDULED:     'bg-amber-500',
  INTAKE:        'bg-blue-500',
  IN_PROGRESS:   'bg-indigo-500',
  QUALITY_CHECK: 'bg-purple-500',
  READY:         'bg-green-500',
  COMPLETED:     'bg-gray-600',
  CANCELLED:     'bg-red-700',
}

const OPEN_BTN: Record<ServiceStatus, string> = {
  SCHEDULED:     'bg-gray-700 hover:bg-gray-600 text-white',
  INTAKE:        'bg-blue-600 hover:bg-blue-500 text-white',
  IN_PROGRESS:   'bg-blue-600 hover:bg-blue-500 text-white',
  QUALITY_CHECK: 'bg-purple-600 hover:bg-purple-500 text-white',
  READY:         'bg-green-600 hover:bg-green-500 text-white',
  COMPLETED:     'bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300',
  CANCELLED:     'bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400',
}

const ALL_STATUSES: ServiceStatus[] = [
  'SCHEDULED', 'INTAKE', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY', 'COMPLETED', 'CANCELLED',
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getUTCFullYear()}`
}

function daysInShop(startIso: string, endIso: string | null): number {
  const start = new Date(startIso).getTime()
  const end   = endIso ? new Date(endIso).getTime() : Date.now()
  return Math.max(0, Math.floor((end - start) / 86_400_000))
}

// ─── Shared UI ─────────────────────────────────────────────────────────────────

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        'w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white ' +
        'placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 ' +
        (props.className ?? '')
      }
    />
  )
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={
        'bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white ' +
        'focus:outline-hidden focus:ring-2 focus:ring-blue-500 ' +
        (props.className ?? '')
      }
    />
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{children}</label>
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="px-3 py-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg text-red-700 dark:text-red-400 text-sm">
      {msg}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:hover:text-white text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function StatusBadge({ status, label }: { status: ServiceStatus; label: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${STATUS_BADGE[status]}`}>
      {label}
    </span>
  )
}

// ─── Create service modal ──────────────────────────────────────────────────────

function CreateModal({
  trucks,
  onClose,
  onCreated,
  preselectedDate,
}: {
  trucks: Truck[]
  onClose: () => void
  onCreated: (service: ServiceRow) => void
  preselectedDate?: string
}) {
  const t = useTranslations('service')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')

  const [truckId, setTruckId]             = useState('')
  const [scheduledDate, setScheduledDate] = useState(preselectedDate ?? '')
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
      onCreated(json.service)
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

// ─── Reschedule modal ──────────────────────────────────────────────────────────

function RescheduleModal({
  service,
  onClose,
  onUpdated,
}: {
  service: ServiceRow
  onClose: () => void
  onUpdated: (s: ServiceRow) => void
}) {
  const t = useTranslations('service')
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
      onUpdated(json.service)
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

// ─── Service card ──────────────────────────────────────────────────────────────

function ServiceCard({
  s,
  t,
  tCommon,
  canReschedule,
  onReschedule,
}: {
  s: ServiceRow
  t: ReturnType<typeof useTranslations>
  tCommon: ReturnType<typeof useTranslations>
  canReschedule: boolean
  onReschedule: (s: ServiceRow) => void
}) {
  const isTerminal = s.status === 'COMPLETED' || s.status === 'CANCELLED'

  // Work card counts (exclude CANCELLED cards and system sections with no cards)
  const allWc   = (s.sections ?? []).flatMap((sec) => sec.workCards).filter((wc) => wc.status !== 'CANCELLED')
  const doneWc  = allWc.filter((wc) => wc.status === 'COMPLETED').length
  const totalWc = allWc.length
  const progress = totalWc > 0 ? doneWc / totalWc : 0

  // Days in shop
  let daysLabel: string | null = null
  if (s.startDate) {
    const days = daysInShop(s.startDate, s.endDate)
    daysLabel = isTerminal
      ? t('daysInShop', { days })
      : days === 0 ? t('enteredToday') : t('daysInShop', { days })
  }

  return (
    <div className="flex bg-white dark:bg-gray-900 rounded-xl border border-gray-300 dark:border-gray-800 overflow-hidden hover:border-gray-400 dark:hover:border-gray-700 transition-colors group">
      {/* Status stripe */}
      <div className={`w-1 shrink-0 ${STATUS_STRIPE[s.status]}`} />

      {/* Main content */}
      <div className="flex-1 flex flex-wrap gap-x-6 gap-y-3 px-5 py-4 items-center min-w-0">

        {/* Truck identity */}
        <div className="min-w-37.5 flex-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-gray-900 dark:text-white text-base leading-tight">
              {s.truckPlateSnapshot}
            </span>
            {s.truck.isAdr && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-orange-500/20 text-orange-400 rounded leading-tight">
                ADR
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{s.truck.make} {s.truck.model}</p>
          {s.driverNameSnapshot && (
            <p className="text-xs text-gray-600 mt-0.5 truncate">{s.driverNameSnapshot}</p>
          )}
        </div>

        {/* Dates */}
        <div className="min-w-27.5 flex-1">
          <p className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">
            {t('scheduledDate')}
          </p>
          <p className="text-sm text-gray-900 dark:text-white mt-0.5">{fmtDate(s.scheduledDate)}</p>
          {daysLabel && (
            <p className={`text-xs mt-0.5 ${isTerminal ? 'text-gray-600' : 'text-amber-400'}`}>
              {daysLabel}
            </p>
          )}
        </div>

        {/* Status + Bay */}
        <div className="min-w-32.5 flex-1">
          <StatusBadge status={s.status} label={t(`status.${s.status}`)} />
          {s.bayNameSnapshot && (
            <p className="text-xs text-gray-500 mt-1.5">
              <span className="text-gray-600">{t('bay')}: </span>{s.bayNameSnapshot}
            </p>
          )}
        </div>

        {/* Work card progress — only when there are cards */}
        {totalWc > 0 && (
          <div className="min-w-27.5 flex-1 hidden md:block">
            <p className="text-xs text-gray-500 mb-1.5">
              {doneWc}/{totalWc} {tCommon('workCards')}
            </p>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${doneWc === totalWc ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-4 border-l border-gray-300 dark:border-gray-800 shrink-0">
        {/* Reschedule icon button — SCHEDULED only */}
        {canReschedule && s.status === 'SCHEDULED' && (
          <button
            onClick={() => onReschedule(s)}
            title={t('reschedule')}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
        )}

        {/* Intake protocol print — SCHEDULED and INTAKE */}
        {(s.status === 'SCHEDULED' || s.status === 'INTAKE') && (
          <Link
            href={`/services/${s.id}/intake-protocol`}
            target="_blank"
            title={t('intakeProtocol')}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </Link>
        )}

        {/* Open / view button */}
        <Link
          href={`/services/${s.id}`}
          className={`px-3 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${OPEN_BTN[s.status]}`}
        >
          {t('open')}
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

type ModalState =
  | 'create'
  | { type: 'reschedule'; service: ServiceRow }
  | null

export default function ServicesClient({
  initialServices,
  initialTotal,
  initialPageSize,
  trucks,
  canCreate,
  canReschedule,
}: {
  initialServices: ServiceRow[]
  initialTotal: number
  initialPageSize: number
  trucks: Truck[]
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

  const { data, mutate } = useSWR(`/api/services?${params}`, fetcher, {
    refreshInterval:   30_000,
    fallbackData:      { services: initialServices, total: initialTotal, page: 1, pageSize, totalPages: Math.ceil(initialTotal / pageSize) },
    revalidateOnFocus: false,
    keepPreviousData:  true,
  })

  const services:   ServiceRow[] = data?.services   ?? initialServices
  const total:      number       = data?.total       ?? initialTotal
  const totalPages: number       = data?.totalPages  ?? Math.ceil(initialTotal / pageSize)

  function upsert() { mutate() }

  return (
    <>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('list')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{t('resultsCount', { count: total })}</p>
          </div>
          {canCreate && (
            <button
              onClick={() => setModal('create')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <span className="text-lg leading-none">+</span>
              {t('new')}
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="active">{t('filterActive')}</option>
            <option value="all">{t('filterAll')}</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{t(`status.${s}`)}</option>
            ))}
          </Select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="flex-1 min-w-50 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* List */}
        <div className="space-y-2">
          {services.map((s) => (
            <ServiceCard
              key={s.id}
              s={s}
              t={t}
              tCommon={tCommon}
              canReschedule={canReschedule}
              onReschedule={(svc) => setModal({ type: 'reschedule', service: svc })}
            />
          ))}
          {services.length === 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-300 dark:border-gray-800 px-5 py-12 text-center text-gray-500">
              {t('noResults')}
            </div>
          )}
        </div>

        <div className="mt-2">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>
      </div>

      {modal === 'create' && (
        <Modal title={t('new')} onClose={() => setModal(null)}>
          <CreateModal
            trucks={trucks}
            onClose={() => setModal(null)}
            onCreated={upsert}
          />
        </Modal>
      )}
      {modal !== null && modal !== 'create' && modal.type === 'reschedule' && (
        <Modal title={t('reschedule')} onClose={() => setModal(null)}>
          <RescheduleModal
            service={modal.service}
            onClose={() => setModal(null)}
            onUpdated={upsert}
          />
        </Modal>
      )}
    </>
  )
}
