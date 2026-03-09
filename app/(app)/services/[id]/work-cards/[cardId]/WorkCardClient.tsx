'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { PhotoGallery, NotesSection, type Photo, type NoteItem } from '@/components/PhotosAndNotes'

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkCardStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

interface Part { id: number; name: string; partNumber: string | null; quantity: number; unitCost: number | null }

interface WorkCardDetail {
  id: number
  description: string
  mechanicId: number | null
  mechanicName: string | null
  status: WorkCardStatus
  specialInstructions: string | null
  cancelledAt: string | null
  reopenedAt:  string | null
  parts:  Part[]
  notes:  NoteItem[]
  photos: Photo[]
  serviceSection: {
    id: number
    title: string
    serviceOrderId: number
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────

const WC_COLOR: Record<WorkCardStatus, string> = {
  PENDING:     'bg-gray-600/20 text-gray-400',
  ASSIGNED:    'bg-blue-600/20 text-blue-400',
  IN_PROGRESS: 'bg-indigo-600/20 text-indigo-400',
  COMPLETED:   'bg-green-600/20 text-green-400',
  CANCELLED:   'bg-red-600/20 text-red-400',
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

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
    <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
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

// ─── Add Part Modal ───────────────────────────────────────────────────────────

function AddPartModal({
  serviceId, sectionId, cardId, onClose, onAdded,
}: {
  serviceId: number; sectionId: number; cardId: number
  onClose: () => void; onAdded: (p: Part) => void
}) {
  const t = useTranslations('workCard')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')

  const [name,       setName]       = useState('')
  const [partNumber, setPartNumber] = useState('')
  const [quantity,   setQuantity]   = useState('1')
  const [unitCost,   setUnitCost]   = useState('')
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim())          { setError(t('partName')); return }
    if (!quantity || Number(quantity) <= 0) { setError(t('partQuantity')); return }
    setError(''); setLoading(true)
    try {
      const res  = await fetch(
        `/api/services/${serviceId}/sections/${sectionId}/work-cards/${cardId}/parts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:       name.trim(),
            partNumber: partNumber.trim() || null,
            quantity:   Number(quantity),
            unitCost:   unitCost ? Number(unitCost) : null,
          }),
        },
      )
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tErrors('genericShort')); return }
      onAdded(json.part); onClose()
    } catch { setError(tCommon('connectionFailed')) }
    finally   { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>{t('partName')}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('partNamePlaceholder')} autoFocus />
      </div>
      <div>
        <Label>{t('partNumber')}</Label>
        <Input value={partNumber} onChange={(e) => setPartNumber(e.target.value)} placeholder={t('partNumberPlaceholder')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{t('partQuantity')}</Label>
          <Input type="number" step="0.01" min="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div>
          <Label>{t('partUnitCost')}</Label>
          <Input type="number" step="0.01" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="0.00" />
        </div>
      </div>
      {error && <ErrorBox msg={error} />}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm">
          {tCommon('cancel')}
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
          {loading ? t('adding') : tCommon('add')}
        </button>
      </div>
    </form>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WorkCardClient({
  initialWorkCard,
  canCancelWorkCard,
  canReopenWorkCard,
  canCompleteWorkCard,
  canCreateNote,
  canUploadPhoto,
}: {
  initialWorkCard: WorkCardDetail
  canCancelWorkCard: boolean
  canReopenWorkCard: boolean
  canCompleteWorkCard: boolean
  canCreateNote: boolean
  canUploadPhoto: boolean
}) {
  const t = useTranslations('workCard')
  const tCommon = useTranslations('common')

  const [wc,          setWc]          = useState<WorkCardDetail>(initialWorkCard)
  const [showAddPart, setShowAddPart] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)

  const serviceId = wc.serviceSection.serviceOrderId
  const sectionId = wc.serviceSection.id

  function partAdded(p: Part) {
    setWc((prev) => ({ ...prev, parts: [...prev.parts, p] }))
  }

  async function deletePart(partId: number) {
    if (!confirm(t('deletePart'))) return
    await fetch(
      `/api/services/${serviceId}/sections/${sectionId}/work-cards/${wc.id}/parts/${partId}`,
      { method: 'DELETE' },
    )
    setWc((prev) => ({ ...prev, parts: prev.parts.filter((p) => p.id !== partId) }))
  }

  async function changeStatus(status: string) {
    setStatusLoading(true)
    try {
      const res  = await fetch(
        `/api/services/${serviceId}/sections/${sectionId}/work-cards/${wc.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        },
      )
      const json = await res.json()
      if (res.ok) setWc((prev) => ({ ...prev, ...json.workCard }))
    } finally { setStatusLoading(false) }
  }

  const totalCost = wc.parts
    .filter((p) => p.unitCost !== null)
    .reduce((sum, p) => sum + p.quantity * (p.unitCost ?? 0), 0)

  const isTerminal = wc.status === 'COMPLETED' || wc.status === 'CANCELLED'

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">

      {/* Back */}
      <Link
        href={`/services/${serviceId}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        ← {t('backToOrder')}
      </Link>

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">{wc.serviceSection.title}</p>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white leading-snug">{wc.description}</h1>
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${WC_COLOR[wc.status]}`}>
            {t(`status.${wc.status}`)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-600 mb-0.5">{t('mechanic')}</p>
            <p className="text-gray-600 dark:text-gray-300">{wc.mechanicName ?? '—'}</p>
          </div>
          {wc.specialInstructions && (
            <div className="col-span-2">
              <p className="text-xs text-gray-400 dark:text-gray-600 mb-0.5">{t('specialInstructions')}</p>
              <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{wc.specialInstructions}</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/services/${serviceId}/work-cards/${wc.id}/print`}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-500 transition-colors"
          >
            {tCommon('print')} →
          </Link>
          {!isTerminal && canCancelWorkCard && (
            <button
              onClick={() => changeStatus('CANCELLED')}
              disabled={statusLoading}
              className="px-3 py-1.5 text-xs rounded-lg border border-red-800 text-red-400 hover:text-red-300 hover:border-red-600 transition-colors disabled:opacity-40"
            >
              {t('cancel')}
            </button>
          )}
          {wc.status === 'CANCELLED' && canReopenWorkCard && (
            <button
              onClick={() => changeStatus('REOPEN')}
              disabled={statusLoading}
              className="px-3 py-1.5 text-xs rounded-lg border border-blue-700 text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-40"
            >
              {t('reopen')}
            </button>
          )}
          {!isTerminal && canCompleteWorkCard && (
            <button
              onClick={() => changeStatus('COMPLETED')}
              disabled={statusLoading}
              className="px-3 py-1.5 text-xs rounded-lg border border-green-800 text-green-400 hover:text-green-300 transition-colors disabled:opacity-40"
            >
              {t('complete')}
            </button>
          )}
        </div>
      </div>

      {/* Parts */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('partsAndMaterials')}</h2>
          {!isTerminal && (
            <button
              onClick={() => setShowAddPart(true)}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              + {tCommon('add')}
            </button>
          )}
        </div>

        {wc.parts.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500 text-center">{t('noParts')}</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="text-left px-5 py-2 text-xs font-semibold text-gray-500">{t('partName')}</th>
                  <th className="text-left px-5 py-2 text-xs font-semibold text-gray-500 hidden sm:table-cell">{t('partNumber')}</th>
                  <th className="text-right px-5 py-2 text-xs font-semibold text-gray-500">{t('partQuantity')}</th>
                  <th className="text-right px-5 py-2 text-xs font-semibold text-gray-500">{t('partUnitCost')}</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {wc.parts.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-100/40 dark:hover:bg-gray-800/40">
                    <td className="px-5 py-3 text-gray-900 dark:text-white">{p.name}</td>
                    <td className="px-5 py-3 text-gray-500 hidden sm:table-cell">{p.partNumber ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-right tabular-nums">{p.quantity}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-right tabular-nums">
                      {p.unitCost !== null ? p.unitCost.toFixed(2) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {!isTerminal && (
                        <button
                          onClick={() => deletePart(p.id)}
                          className="text-gray-300 dark:text-gray-700 hover:text-red-400 transition-colors text-lg leading-none"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {totalCost > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-200 dark:border-gray-800">
                    <td colSpan={3} className="px-5 py-2 text-xs text-gray-500 text-right">{t('partsTotal')}:</td>
                    <td className="px-5 py-2 text-sm font-semibold text-gray-900 dark:text-white text-right tabular-nums">
                      {totalCost.toFixed(2)} €
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </>
        )}
      </div>

      {/* Photos */}
      <PhotoGallery
        photos={wc.photos}
        uploadUrl={`/api/services/${serviceId}/sections/${sectionId}/work-cards/${wc.id}/photos`}
        deleteUrlFor={(id) => `/api/services/${serviceId}/sections/${sectionId}/work-cards/${wc.id}/photos/${id}`}
        canUpload={canUploadPhoto && !isTerminal}
        onPhotoAdded={(p) => setWc((prev) => ({ ...prev, photos: [...prev.photos, p] }))}
        onPhotoDeleted={(id) => setWc((prev) => ({ ...prev, photos: prev.photos.filter((p) => p.id !== id) }))}
      />

      {/* Notes */}
      <NotesSection
        notes={wc.notes}
        postUrl={`/api/services/${serviceId}/sections/${sectionId}/work-cards/${wc.id}/notes`}
        canCreate={canCreateNote && !isTerminal}
        onNoteAdded={(n) => setWc((prev) => ({ ...prev, notes: [...prev.notes, n] }))}
      />

      {showAddPart && (
        <Modal title={t('addPartsModal')} onClose={() => setShowAddPart(false)}>
          <AddPartModal
            serviceId={serviceId}
            sectionId={sectionId}
            cardId={wc.id}
            onClose={() => setShowAddPart(false)}
            onAdded={(p) => { partAdded(p); setShowAddPart(false) }}
          />
        </Modal>
      )}
    </div>
  )
}
