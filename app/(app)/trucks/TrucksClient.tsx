'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import Pagination from '@/components/Pagination'
import type { EnrichedTruck } from '@/lib/truck-enrichment'

type Truck = EnrichedTruck

type ModalState =
  | 'add'
  | { type: 'edit'; truck: Truck }
  | { type: 'mileage'; truck: Truck }
  | { type: 'toggle'; truck: Truck }
  | null

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
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:hover:text-white text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function fmtMileage(km: number | null) {
  if (km == null) return '—'
  return `${Math.round(km).toLocaleString('bg-BG')} км`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`
}

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED:     'bg-amber-100 text-amber-800 dark:bg-amber-600/20 dark:text-amber-400',
  INTAKE:        'bg-blue-100 text-blue-800 dark:bg-blue-600/20 dark:text-blue-400',
  IN_PROGRESS:   'bg-indigo-100 text-indigo-800 dark:bg-indigo-600/20 dark:text-indigo-400',
  QUALITY_CHECK: 'bg-purple-100 text-purple-800 dark:bg-purple-600/20 dark:text-purple-400',
  READY:         'bg-green-100 text-green-800 dark:bg-green-600/20 dark:text-green-400',
}

// ─── Truck form (add + edit) ───────────────────────────────────────────────────

function TruckForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Truck
  onClose: () => void
  onSaved: (truck: Truck) => void
}) {
  const t = useTranslations('truck')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')

  const isEdit = !!initial
  const [plateNumber,      setPlateNumber]    = useState(initial?.plateNumber      ?? '')
  const [make,             setMake]           = useState(initial?.make             ?? '')
  const [model,            setModel]          = useState(initial?.model            ?? '')
  const [year,             setYear]           = useState(initial?.year?.toString() ?? '')
  const [isAdr,            setIsAdr]          = useState(initial?.isAdr            ?? false)
  const [mileageTriggerKm, setMileageTrigger] = useState(initial?.mileageTriggerKm?.toString() ?? '30000')
  const [currentMileage,   setCurrentMileage] = useState(initial?.currentMileage?.toString() ?? '')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const isFrotcom = !!initial?.frotcomVehicleId

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const body = {
        plateNumber,
        make,
        model,
        year:             year ? Number(year) : null,
        isAdr,
        mileageTriggerKm: Number(mileageTriggerKm) || 30000,
        ...((!isFrotcom && currentMileage) && { currentMileage: Number(currentMileage) }),
      }
      const url    = isEdit ? `/api/trucks/${initial!.id}` : '/api/trucks'
      const method = isEdit ? 'PATCH' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tErrors('genericShort')); return }
      onSaved(json.truck)
      onClose()
    } catch {
      setError(tErrors('connectionFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>{t('plateNumberRequired')}</Label>
          <Input
            value={plateNumber}
            onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
            placeholder="СА 0000 АА"
            disabled={isFrotcom}
            className={isFrotcom ? 'opacity-60' : ''}
          />
        </div>
        <div>
          <Label>{t('makeRequired')}</Label>
          <Input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Volvo" />
        </div>
        <div>
          <Label>{t('modelRequired')}</Label>
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="FH 500" />
        </div>
        <div>
          <Label>{t('year')}</Label>
          <Input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2020"
            min="1900"
            max="2100"
          />
        </div>
        <div>
          <Label>{t('mileageTriggerShort')}</Label>
          <Input
            type="number"
            value={mileageTriggerKm}
            onChange={(e) => setMileageTrigger(e.target.value)}
            placeholder="30000"
            min="1000"
          />
        </div>
        {!isFrotcom && (
          <div className="col-span-2">
            <Label>{t('currentMileageShort')}</Label>
            <Input
              type="number"
              value={currentMileage}
              onChange={(e) => setCurrentMileage(e.target.value)}
              placeholder="250000"
              min="0"
            />
          </div>
        )}
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isAdr}
          onChange={(e) => setIsAdr(e.target.checked)}
          className="w-4 h-4 accent-blue-500"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">{t('adrTruck')}</span>
      </label>

      {error && <ErrorBox msg={error} />}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm">
          {tCommon('cancel')}
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
          {loading ? tCommon('saving') : isEdit ? tCommon('save') : tCommon('add')}
        </button>
      </div>
    </form>
  )
}

// ─── Update mileage modal (non-Frotcom) ───────────────────────────────────────

function MileageModal({ truck, onClose, onSaved }: { truck: Truck; onClose: () => void; onSaved: (t: Truck) => void }) {
  const t = useTranslations('truck')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')

  const [value,   setValue]  = useState(truck.currentMileage?.toString() ?? '')
  const [error,   setError]  = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!value) { setError(t('enterMileage')); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/trucks/${truck.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentMileage: Number(value) }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tErrors('genericShort')); return }
      onSaved(json.truck)
      onClose()
    } catch {
      setError(tErrors('connectionFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t('updateMileageFor')} <strong className="text-gray-900 dark:text-white">{truck.plateNumber}</strong>
      </p>
      <div>
        <Label>{t('mileageKm')}</Label>
        <Input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="250000"
          min="0"
          autoFocus
        />
      </div>
      {error && <ErrorBox msg={error} />}
      <div className="flex gap-3">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm">
          {tCommon('cancel')}
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
          {loading ? tCommon('saving') : t('update')}
        </button>
      </div>
    </form>
  )
}

// ─── Toggle active modal ───────────────────────────────────────────────────────

function ToggleModal({ truck, onClose, onSaved }: { truck: Truck; onClose: () => void; onSaved: (t: Truck) => void }) {
  const t = useTranslations('truck')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')

  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function confirm() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/trucks/${truck.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !truck.isActive }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tErrors('genericShort')); return }
      onSaved(json.truck)
      onClose()
    } catch {
      setError(tErrors('connectionFailed'))
    } finally {
      setLoading(false)
    }
  }

  const action = truck.isActive ? t('deactivationAction') : t('activationAction')

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {tCommon('confirm')} {action}{' '}
        <strong className="text-gray-900 dark:text-white">{truck.plateNumber}</strong> — {truck.make} {truck.model}.
        {truck.isActive && ` ${t('historyPreserved')}`}
      </p>
      {error && <ErrorBox msg={error} />}
      <div className="flex gap-3">
        <button onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm">
          {tCommon('cancel')}
        </button>
        <button onClick={confirm} disabled={loading}
          className={`flex-1 py-2.5 rounded-xl text-white font-semibold text-sm transition-colors disabled:opacity-50 ${
            truck.isActive ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'
          }`}>
          {loading ? '...' : truck.isActive ? tCommon('deactivate') : tCommon('activate')}
        </button>
      </div>
    </div>
  )
}

// ─── Import result banner ──────────────────────────────────────────────────────

function ImportResult({ result, onClose }: { result: { imported: number; skipped: number; errors: string[] }; onClose: () => void }) {
  const t = useTranslations('truck')
  const tCommon = useTranslations('common')

  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm">
      <div className="flex-1">
        <p className="font-medium text-gray-900 dark:text-white">
          {t('importComplete', { imported: result.imported, skipped: result.skipped })}
        </p>
        {result.errors.length > 0 && (
          <p className="text-red-400 mt-1 text-xs">{result.errors.slice(0, 3).join('; ')}</p>
        )}
      </div>
      <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:hover:text-white text-lg leading-none shrink-0" aria-label={tCommon('close')}>×</button>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function TrucksClient({
  initialTrucks,
  pageSize,
  canCreate,
  canEdit,
  canDeactivate,
  canImport,
}: {
  initialTrucks: Truck[]
  pageSize: number
  canCreate: boolean
  canEdit: boolean
  canDeactivate: boolean
  canImport: boolean
}) {
  const t = useTranslations('truck')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')
  const tService = useTranslations('service')

  const [trucks,    setTrucks]    = useState<Truck[]>(initialTrucks)
  const [modal,     setModal]     = useState<ModalState>(null)
  const [search,    setSearch]    = useState('')
  const [page,      setPage]      = useState(1)

  useEffect(() => { setPage(1) }, [search])

  const [importing,    setImporting]    = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)
  const [importError,  setImportError]  = useState('')
  const [syncing,      setSyncing]      = useState(false)
  const [syncResult,   setSyncResult]   = useState<{ updated: number; errors: string[] } | null>(null)
  const [syncError,    setSyncError]    = useState('')

  function upsert(updated: Truck) {
    setTrucks((prev) => {
      const idx = prev.findIndex((t) => t.id === updated.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next }
      return [...prev, updated].sort((a, b) => a.plateNumber.localeCompare(b.plateNumber))
    })
  }

  async function refreshList() {
    const res  = await fetch('/api/trucks')
    const json = await res.json()
    if (res.ok) setTrucks(json.trucks)
  }

  async function runImport() {
    setImporting(true); setImportError(''); setImportResult(null)
    try {
      const res  = await fetch('/api/trucks/import', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setImportError(json.error ?? tErrors('genericShort')); return }
      setImportResult(json)
      await refreshList()
    } catch {
      setImportError(tErrors('connectionFailed'))
    } finally {
      setImporting(false)
    }
  }

  async function runSyncMileage() {
    setSyncing(true); setSyncError(''); setSyncResult(null)
    try {
      const res  = await fetch('/api/trucks/sync-mileage', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setSyncError(json.error ?? tErrors('genericShort')); return }
      setSyncResult(json)
      await refreshList()
    } catch { setSyncError(tErrors('connectionFailed')) }
    finally { setSyncing(false) }
  }

  const active   = trucks.filter((t) => t.isActive).length
  const inactive = trucks.filter((t) => !t.isActive).length
  const alerts   = trucks.filter((t) => t.mileageAlert && t.isActive).length

  const q = search.trim().toLowerCase()
  const visible = q
    ? trucks.filter((t) =>
        t.plateNumber.toLowerCase().includes(q) ||
        t.make.toLowerCase().includes(q) ||
        t.model.toLowerCase().includes(q)
      )
    : trucks

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize))
  const paginated  = visible.slice((page - 1) * pageSize, page * pageSize)

  return (
    <>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('list')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {t('activeCount', { count: active })}
              {inactive > 0 ? `, ${t('inactiveCount', { count: inactive })}` : ''}
              {alerts > 0 && (
                <span className="ml-2 text-amber-700 dark:text-amber-400 font-medium">⚠ {t('alertCount', { count: alerts })}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canImport && (
              <>
                <button
                  onClick={runSyncMileage}
                  disabled={syncing}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-400 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  {syncing ? tCommon('syncing') : t('syncMileage')}
                </button>
                <button
                  onClick={runImport}
                  disabled={importing}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-400 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  {importing ? tCommon('importing') : t('frotcomImport')}
                </button>
              </>
            )}
            {canCreate && (
              <button
                onClick={() => setModal('add')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <span className="text-lg leading-none">+</span>
                {t('new')}
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full max-w-sm bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Feedback banners */}
        {syncError && (
          <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl text-red-700 dark:text-red-400 text-sm">{syncError}</div>
        )}
        {syncResult && (
          <div className="mb-4 px-4 py-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-xl text-green-700 dark:text-green-400 text-sm">
            {t('syncComplete', { updated: syncResult.updated })}
            {syncResult.errors.length > 0 && (
              <ul className="mt-1 text-xs text-gray-500">{syncResult.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            )}
          </div>
        )}
        {importError && (
          <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl text-red-700 dark:text-red-400 text-sm">{importError}</div>
        )}
        {importResult && (
          <div className="mb-4">
            <ImportResult result={importResult} onClose={() => setImportResult(null)} />
          </div>
        )}

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300 dark:border-gray-800">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('plateNumberShort')}</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">{t('makeModel')}</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">{t('mileage')}</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">{t('lastService')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300 dark:divide-gray-800">
                {paginated.map((truck) => (
                  <tr key={truck.id} className={`hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors ${!truck.isActive ? 'opacity-50' : ''}`}>

                    {/* Plate + badges + active service chip */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/trucks/${truck.id}`}
                          className="font-mono font-semibold text-gray-900 dark:text-white hover:text-blue-400 transition-colors underline-offset-2 hover:underline"
                        >
                          {truck.plateNumber}
                        </Link>
                        {truck.mileageAlert && (
                          <span title={t('needsService')} className="text-amber-600 dark:text-amber-400 text-sm leading-none">⚠</span>
                        )}
                        {truck.isAdr && (
                          <span className="inline-flex items-center px-1.5 py-0 rounded-sm text-xs font-bold bg-orange-100 text-orange-700 dark:bg-orange-600/20 dark:text-orange-400">ADR</span>
                        )}
                        {!truck.isActive && (
                          <span className="inline-flex items-center px-1.5 py-0 rounded-sm text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-500">{tCommon('inactive')}</span>
                        )}
                        {truck.frotcomVehicleId && (
                          <span className="text-xs text-gray-600">Frotcom</span>
                        )}
                      </div>
                      {/* Active service chip */}
                      {truck.activeService && (
                        <Link
                          href={`/services/${truck.activeService.id}`}
                          className={`mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-opacity hover:opacity-80 ${STATUS_COLOR[truck.activeService.status] ?? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
                        >
                          {tService(`status.${truck.activeService.status}` as any)}
                          {truck.activeService.bayNameSnapshot && ` · ${truck.activeService.bayNameSnapshot}`}
                          <span className="opacity-60">→</span>
                        </Link>
                      )}
                    </td>

                    {/* Make / Model */}
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <p className="text-gray-900 dark:text-white">{truck.make} {truck.model}</p>
                      {truck.year && <p className="text-xs text-gray-500">{truck.year}</p>}
                    </td>

                    {/* Mileage + km since last service */}
                    <td className="px-5 py-4 hidden md:table-cell">
                      <p className={truck.mileageAlert ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-gray-600 dark:text-gray-300'}>
                        {fmtMileage(truck.currentMileage)}
                      </p>
                      {truck.kmSinceService != null && (
                        <p className={`text-xs mt-0.5 ${truck.mileageAlert ? 'text-amber-600 dark:text-amber-500' : 'text-gray-600'}`}>
                          +{Math.round(truck.kmSinceService).toLocaleString('bg-BG')} км от сервиз
                        </p>
                      )}
                    </td>

                    {/* Last service date */}
                    <td className="px-5 py-4 text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                      {fmtDate(truck.lastServiceDate)}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        <Link
                          href={`/trucks/${truck.id}`}
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                        >
                          Профил
                        </Link>
                        {canEdit && (
                          <button
                            onClick={() => setModal({ type: 'edit', truck })}
                            className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                          >
                            {tCommon('edit')}
                          </button>
                        )}
                        {canEdit && !truck.frotcomVehicleId && (
                          <button
                            onClick={() => setModal({ type: 'mileage', truck })}
                            className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                          >
                            Пробег
                          </button>
                        )}
                        {canDeactivate && (
                          <button
                            onClick={() => setModal({ type: 'toggle', truck })}
                            className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                              truck.isActive
                                ? 'border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-400/10'
                                : 'border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800/50 dark:text-green-400 dark:hover:bg-green-400/10'
                            }`}
                          >
                            {truck.isActive ? tCommon('deactivate') : tCommon('activate')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {trucks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-gray-500">
                      {t('noTrucks')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={visible.length}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>
      </div>

      {/* Modals */}
      {modal === 'add' && (
        <Modal title={t('new')} onClose={() => setModal(null)}>
          <TruckForm onClose={() => setModal(null)} onSaved={upsert} />
        </Modal>
      )}
      {modal !== null && modal !== 'add' && modal.type === 'edit' && (
        <Modal title={t('editTruck')} onClose={() => setModal(null)}>
          <TruckForm initial={modal.truck} onClose={() => setModal(null)} onSaved={upsert} />
        </Modal>
      )}
      {modal !== null && modal !== 'add' && modal.type === 'mileage' && (
        <Modal title={t('updateMileage')} onClose={() => setModal(null)}>
          <MileageModal truck={modal.truck} onClose={() => setModal(null)} onSaved={upsert} />
        </Modal>
      )}
      {modal !== null && modal !== 'add' && modal.type === 'toggle' && (
        <Modal
          title={modal.truck.isActive ? t('deactivate') : t('activateTruck')}
          onClose={() => setModal(null)}
        >
          <ToggleModal truck={modal.truck} onClose={() => setModal(null)} onSaved={upsert} />
        </Modal>
      )}
    </>
  )
}
