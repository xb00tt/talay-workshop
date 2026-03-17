'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ServiceNote } from '../types'
import { fmtDateTime } from '../helpers'

interface ServiceNotesPanelProps {
  serviceId: number
  notes: ServiceNote[]
  canCreateNote: boolean
  onNoteAdded: (note: ServiceNote) => void
}

export default function ServiceNotesPanel({
  serviceId,
  notes,
  canCreateNote,
  onNoteAdded,
}: ServiceNotesPanelProps) {
  const tCommon = useTranslations('common')
  const tNote = useTranslations('note')
  const tWorkCard = useTranslations('workCard')

  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!input.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/services/${serviceId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input.trim() }),
      })
      const json = await res.json()
      if (res.ok) {
        onNoteAdded(json.note)
        setInput('')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/80 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700/80">
        <span className="font-semibold text-sm text-gray-800 dark:text-white">
          {tCommon('notes')}
        </span>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <div className="px-5 py-4 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {tWorkCard('noNotes')}
          </p>
        </div>
      ) : (
        <div className="px-5 py-3 space-y-3">
          {notes.map((note, i) => (
            <div
              key={note.id}
              className={`text-sm ${i > 0 ? 'border-t border-gray-100 dark:border-gray-800 pt-3' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {note.userNameSnapshot}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {fmtDateTime(note.createdAt)}
                </span>
              </div>
              <p className="text-gray-600 dark:text-gray-300">{note.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add note input */}
      {canCreateNote && (
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={tNote('placeholder')}
            onKeyDown={(e) => e.key === 'Enter' && !saving && submit()}
            className="flex-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500"
          />
          <button
            onClick={submit}
            disabled={saving || !input.trim()}
            className="text-xs text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 flex-shrink-0 disabled:opacity-50 transition-colors"
          >
            {saving ? tCommon('saving') : tNote('add')}
          </button>
        </div>
      )}
    </div>
  )
}
