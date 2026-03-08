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
  bayNameSnapshot: string | null
  createdAt: string
  truck: { make: string; model: string }
}

interface Truck {
  id: number
  plateNumber: string
  make: string
  model: string
  isActive: boolean
}

// ─── Status colors ──────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<ServiceStatus, string> = {
  SCHEDULED:     'bg-amber-600/20 text-amber-400',
  INTAKE:        'bg-blue-600/20 text-blue-400',
  IN_PROGRESS:   'bg-indigo-600/20 text-indigo-400',
  QUALITY_CHECK: 'bg-purple-600/20 text-purple-400',
  READY:         'bg-green-600/20 text-green-400',
  COMPLETED:     'bg-gray-600/20 text-gray-400',
  CANCELLED:     'bg-red-600/20 text-red-400',
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

// ─── Shared UI ─────────────────────────────────────────────────────────────────

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        'w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white ' +
        'placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 ' +
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
        'bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white ' +
        'focus:outline-hidden focus:ring-2 focus:ring-blue-500 ' +
        (props.className ?? '')
      }
    />
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-300 mb-1">{children}</label>
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
      {msg}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-gray-900 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function StatusBadge({ status, label }: { status: ServiceStatus; label: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${STATUS_COLOR[status]}`}>
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

  const [truckId, setTruckId]           = useState('')
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
        <Label>{tCommon('truck') ?? 'Камион'} *</Label>
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
          className="flex-1 py-2.5 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors text-sm">
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
      <p className="text-sm text-gray-400">
        {t('reschedulingOf')}{' '}
        <strong className="text-white">{service.truckPlateSnapshot}</strong>
      </p>
      <div>
        <Label>{t('newDate')} *</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} autoFocus />
      </div>
      {error && <ErrorBox msg={error} />}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors text-sm">
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
  const t = useTranslations('service')
  const tCommon = useTranslations('common')
  const tTruck = useTranslations('truck')

  const [modal,        setModal]        = useState<ModalState>(null)
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [search,       setSearch]       = useState('')
  const [page,         setPage]         = useState(1)
  const pageSize = initialPageSize

  // Reset to page 1 when filters change
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function upsert(_?: ServiceRow) {
    mutate()
  }

  return (
    <>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('list')}</h1>
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
            className="flex-1 min-w-[200px] bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Table */}
        <div className="bg-gray-900 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{tTruck('title')}</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">{tCommon('date')}</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{tCommon('status')}</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">{t('bay')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {services.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-mono font-semibold text-white">{s.truckPlateSnapshot}</p>
                      <p className="text-xs text-gray-500">{s.truck.make} {s.truck.model}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-300 hidden sm:table-cell">
                      {fmtDate(s.scheduledDate)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={s.status} label={t(`status.${s.status}`)} />
                    </td>
                    <td className="px-5 py-4 text-gray-400 hidden lg:table-cell">
                      {s.bayNameSnapshot ?? '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {canReschedule && s.status === 'SCHEDULED' && (
                          <button
                            onClick={() => setModal({ type: 'reschedule', service: s })}
                            className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                          >
                            {t('reschedule')}
                          </button>
                        )}
                        <Link
                          href={`/services/${s.id}`}
                          className="px-2.5 py-1.5 text-xs rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
                        >
                          {t('open')}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {services.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-gray-500">
                      {t('noResults')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
