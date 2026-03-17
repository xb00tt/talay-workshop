'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input, Select, Label, ErrorBox } from '@/components/ui'
import type { Section, SectionType } from '../types'

export default function AddSectionModal({
  serviceId, onClose, onAdded,
}: {
  serviceId: number; onClose: () => void; onAdded: (sec: Section) => void
}) {
  const tSection = useTranslations('section')
  const tCommon  = useTranslations('common')
  const tErrors  = useTranslations('errors')

  const SEC_ADD_OPTIONS: { value: SectionType; label: string }[] = [
    { value: 'DRIVER_FEEDBACK', label: tSection('type.DRIVER_FEEDBACK') },
    { value: 'MID_SERVICE',     label: tSection('type.MID_SERVICE') },
    { value: 'CUSTOM',          label: tSection('type.CUSTOM') },
  ]

  const [type,    setType]    = useState<SectionType>('MID_SERVICE')
  const [title,   setTitle]   = useState(tSection('type.MID_SERVICE'))
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  function handleTypeChange(t: SectionType) {
    setType(t)
    if (t === 'MID_SERVICE')     setTitle(tSection('type.MID_SERVICE'))
    if (t === 'DRIVER_FEEDBACK') setTitle(tSection('type.DRIVER_FEEDBACK'))
    if (t === 'CUSTOM')          setTitle('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError(tSection('titleRequired')); return }
    setError(''); setLoading(true)
    try {
      const res  = await fetch(`/api/services/${serviceId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tErrors('genericShort')); return }
      onAdded(json.section); onClose()
    } catch { setError(tCommon('connectionFailed')) }
    finally   { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>{tSection('typeLabel')}</Label>
        <Select value={type} onChange={(e) => handleTypeChange(e.target.value as SectionType)} className="w-full">
          {SEC_ADD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>
      <div>
        <Label>{tSection('titleLabel')} *</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tSection('titlePlaceholder')} />
      </div>
      {error && <ErrorBox msg={error} />}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm">
          {tCommon('cancel')}
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
          {loading ? tSection('adding') : tSection('addSection')}
        </button>
      </div>
    </form>
  )
}
