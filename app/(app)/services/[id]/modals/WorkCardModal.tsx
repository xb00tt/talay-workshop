'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Textarea, Select, Label, ErrorBox } from '@/components/ui'
import type { WorkCard, Mechanic } from '../types'

export default function WorkCardModal({
  mode, workCard, sectionId, serviceId, mechanics, onClose, onSaved,
}: {
  mode: 'add' | 'edit'; workCard?: WorkCard; sectionId: number
  serviceId: number; mechanics: Mechanic[]
  onClose: () => void; onSaved: (wc: WorkCard) => void
}) {
  const tWorkCard = useTranslations('workCard')
  const tCommon   = useTranslations('common')
  const tErrors   = useTranslations('errors')

  const [description,   setDescription]   = useState(workCard?.description ?? '')
  const [mechanicId,    setMechanicId]    = useState(workCard?.mechanicId?.toString() ?? '')
  const [instructions,  setInstructions]  = useState(workCard?.specialInstructions ?? '')
  const [error,         setError]         = useState('')
  const [loading,       setLoading]       = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) { setError(tWorkCard('descriptionRequired')); return }
    setError(''); setLoading(true)
    try {
      const url = mode === 'add'
        ? `/api/services/${serviceId}/sections/${sectionId}/work-cards`
        : `/api/services/${serviceId}/sections/${sectionId}/work-cards/${workCard!.id}`
      const res  = await fetch(url, {
        method: mode === 'add' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          mechanicId:         mechanicId ? Number(mechanicId) : null,
          specialInstructions: instructions.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tErrors('genericShort')); return }
      onSaved(json.workCard); onClose()
    } catch { setError(tCommon('connectionFailed')) }
    finally   { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>{tWorkCard('description')} *</Label>
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder={tWorkCard('descriptionPlaceholder')} autoFocus />
      </div>
      <div>
        <Label>{tWorkCard('mechanic')}</Label>
        <Select value={mechanicId} onChange={(e) => setMechanicId(e.target.value)} className="w-full">
          <option value="">— {tWorkCard('noMechanic')} —</option>
          {mechanics.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
      </div>
      <div>
        <Label>{tWorkCard('specialInstructions')}</Label>
        <Textarea rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)}
          placeholder={tWorkCard('instructionsPlaceholder')} />
      </div>
      {error && <ErrorBox msg={error} />}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm">
          {tCommon('cancel')}
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
          {loading ? tCommon('saving') : (mode === 'add' ? tWorkCard('addBtn') : tCommon('save'))}
        </button>
      </div>
    </form>
  )
}
