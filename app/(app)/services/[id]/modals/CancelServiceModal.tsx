'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Textarea, Label, ErrorBox } from '@/components/ui'
import type { FullService } from '../types'

export default function CancelServiceModal({
  serviceId, onClose, onDone,
}: {
  serviceId: number; onClose: () => void; onDone: (svc: FullService) => void
}) {
  const tService = useTranslations('service')
  const tCommon  = useTranslations('common')
  const tErrors  = useTranslations('errors')

  const [reason,  setReason]  = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) { setError(tService('cancelModal.reasonRequired')); return }
    setError(''); setLoading(true)
    try {
      const res  = await fetch(`/api/services/${serviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED', cancellationReason: reason }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tErrors('genericShort')); return }
      onDone(json.service); onClose()
    } catch { setError(tCommon('connectionFailed')) }
    finally   { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{tService('cancelModal.info')}</p>
      <div>
        <Label>{tService('cancellationReason')} *</Label>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tService('cancelModal.reasonPlaceholder')} />
      </div>
      {error && <ErrorBox msg={error} />}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm">
          {tCommon('back')}
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
          {loading ? tService('cancelModal.submitting') : tService('cancelModal.submit')}
        </button>
      </div>
    </form>
  )
}
