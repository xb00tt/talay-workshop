'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input, Label, ErrorBox } from '@/components/ui'
import type { FullService } from '../types'

export default function RescheduleModal({
  serviceId, currentDate, onClose, onDone,
}: {
  serviceId: number; currentDate: string; onClose: () => void; onDone: (svc: FullService) => void
}) {
  const tService = useTranslations('service')
  const tCommon  = useTranslations('common')
  const tErrors  = useTranslations('errors')

  const [date,    setDate]    = useState(new Date(currentDate).toISOString().slice(0, 10))
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!date) { setError(tService('selectDate')); return }
    setError(''); setLoading(true)
    try {
      const res  = await fetch(`/api/services/${serviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledDate: date }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tErrors('genericShort')); return }
      onDone(json.service); onClose()
    } catch { setError(tCommon('connectionFailed')) }
    finally   { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>{tService('newDate')} *</Label>
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
          {loading ? tCommon('saving') : tService('reschedule')}
        </button>
      </div>
    </form>
  )
}
