'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Textarea, Label } from '@/components/ui'

const inputClass =
  'w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white ' +
  'placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500'

interface FeedbackItem { id: number; description: string; order: number }

// ─── Individual item row ─────────────────────────────────────────────────────

function FeedbackItemRow({
  item, index, isEditing, onStartEdit, onSave, onCancel, onDelete,
}: {
  item: FeedbackItem; index: number; isEditing: boolean
  onStartEdit: () => void; onSave: (desc: string) => void
  onCancel: () => void; onDelete: () => void
}) {
  const [editText, setEditText] = useState(item.description)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      setEditText(item.description)
      // select all on next tick so the ref is mounted
      requestAnimationFrame(() => inputRef.current?.select())
    }
  }, [isEditing, item.description])

  function commitEdit() {
    const trimmed = editText.trim()
    if (!trimmed || trimmed === item.description) { onCancel(); return }
    onSave(trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
    if (e.key === 'Escape') { e.preventDefault(); onCancel() }
  }

  if (isEditing) {
    return (
      <li className="flex items-center gap-2 py-2">
        <span className="text-sm text-gray-400 dark:text-gray-500 w-5 text-right shrink-0">{index + 1}.</span>
        <input
          ref={inputRef}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitEdit}
          className={`${inputClass} flex-1 py-1.5! text-sm!`}
          autoFocus
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={commitEdit}
          className="text-green-500 hover:text-green-400 transition-colors shrink-0 p-1"
          aria-label="Confirm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onDelete}
          className="text-gray-400 hover:text-red-400 transition-colors shrink-0 p-1"
          aria-label="Delete"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </li>
    )
  }

  return (
    <li className="group flex items-center gap-2 py-2">
      <span className="text-sm text-gray-400 dark:text-gray-500 w-5 text-right shrink-0">{index + 1}.</span>
      <button
        type="button"
        onClick={onStartEdit}
        className="flex-1 text-left text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors cursor-text min-w-0 truncate"
      >
        {item.description}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 sm:opacity-0 max-sm:opacity-100 text-gray-400 hover:text-red-400 transition-all shrink-0 p-1"
        aria-label={`Delete: ${item.description}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </li>
  )
}

// ─── Main panel ──────────────────────────────────────────────────────────────

export default function DriverFeedbackPanel({
  serviceId, items, feedbackNotes, onItemAdded, onItemUpdated, onItemDeleted, onNotesSaved,
  itemsApiPath, notesField,
}: {
  serviceId: number
  items: FeedbackItem[]
  feedbackNotes: string | null
  onItemAdded: (item: FeedbackItem) => void
  onItemUpdated: (item: FeedbackItem) => void
  onItemDeleted: (itemId: number) => void
  onNotesSaved: (text: string) => void
  /** Override the items API path (default: feedback-items) */
  itemsApiPath?: string
  /** Override the notes field name on PATCH /api/services/:id (default: driverFeedbackNotes) */
  notesField?: string
}) {
  const tService = useTranslations('service')
  const tCommon  = useTranslations('common')
  const apiPath  = itemsApiPath ?? 'feedback-items'
  const notesFld = notesField   ?? 'driverFeedbackNotes'

  const [editingId, setEditingId] = useState<number | null>(null)
  const [addText, setAddText]     = useState('')
  const [addError, setAddError]   = useState('')
  const [notesText, setNotesText] = useState(feedbackNotes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)

  // Sync notesText when prop changes externally
  useEffect(() => { setNotesText(feedbackNotes ?? '') }, [feedbackNotes])

  // ── Add item ──
  async function addItem() {
    const trimmed = addText.trim()
    if (!trimmed) return
    setAddError('')
    try {
      const res = await fetch(`/api/services/${serviceId}/${apiPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: trimmed }),
      })
      const json = await res.json()
      if (!res.ok) { setAddError(json.error ?? 'Error'); return }
      onItemAdded(json.item)
      setAddText('')
    } catch { setAddError(tCommon('connectionFailed')) }
  }

  function handleAddKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); addItem() }
    if (e.key === 'Escape') { e.preventDefault(); setAddText(''); setAddError('') }
  }

  // ── Edit item ──
  async function saveEdit(itemId: number, description: string) {
    try {
      const res = await fetch(`/api/services/${serviceId}/${apiPath}/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })
      const json = await res.json()
      if (res.ok) onItemUpdated(json.item)
    } catch { /* silent — item stays as-is */ }
    setEditingId(null)
  }

  // ── Delete item ──
  async function deleteItem(itemId: number) {
    setEditingId(null)
    try {
      await fetch(`/api/services/${serviceId}/${apiPath}/${itemId}`, { method: 'DELETE' })
      onItemDeleted(itemId)
    } catch { /* silent */ }
  }

  // ── Save notes ──
  async function saveNotes() {
    setSavingNotes(true)
    try {
      await fetch(`/api/services/${serviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [notesFld]: notesText }),
      })
      onNotesSaved(notesText)
    } finally { setSavingNotes(false) }
  }

  function handleNotesBlur() {
    if (notesText !== (feedbackNotes ?? '')) saveNotes()
  }

  const notesDirty = notesText !== (feedbackNotes ?? '')

  return (
    <div className="px-5 py-4 space-y-3">
      {/* Items list */}
      {items.length > 0 && (
        <ul className="space-y-0">
          {items.map((item, i) => (
            <FeedbackItemRow
              key={item.id}
              item={item}
              index={i}
              isEditing={editingId === item.id}
              onStartEdit={() => setEditingId(item.id)}
              onSave={(desc) => saveEdit(item.id, desc)}
              onCancel={() => setEditingId(null)}
              onDelete={() => deleteItem(item.id)}
            />
          ))}
        </ul>
      )}

      {/* Add input */}
      <div>
        <input
          ref={addInputRef}
          value={addText}
          onChange={(e) => { setAddText(e.target.value); setAddError('') }}
          onKeyDown={handleAddKeyDown}
          placeholder={tService('feedback.addPlaceholder')}
          className={`${inputClass} text-sm!`}
        />
        {addError && <p className="text-xs text-red-400 mt-1">{addError}</p>}
      </div>

      {/* Notes textarea */}
      <div>
        <Label>{tService(notesFld)}</Label>
        <Textarea
          rows={2}
          value={notesText}
          onChange={(e) => setNotesText(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder={tService('feedbackNotesPlaceholder')}
        />
        {notesDirty && (
          <button
            onClick={saveNotes}
            disabled={savingNotes}
            className="mt-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50"
          >
            {savingNotes ? tCommon('saving') : tService('saveFeedbackNotes')}
          </button>
        )}
      </div>
    </div>
  )
}
