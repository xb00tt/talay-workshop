'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface TemplateItem {
  id: number
  description: string
  order: number
  isActive: boolean
}

interface Props {
  initialItems: TemplateItem[]
  canEdit: boolean
}

export default function ChecklistClient({ initialItems, canEdit }: Props) {
  const t      = useTranslations('checklist')
  const tCommon = useTranslations('common')
  const [items, setItems]         = useState<TemplateItem[]>(initialItems)
  const [showAdd, setShowAdd]     = useState(false)
  const [editItem, setEditItem]   = useState<TemplateItem | null>(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  // ── Add modal ──────────────────────────────────────────────────────────────
  function AddModal() {
    const tM = useTranslations('checklist')
    const tMC = useTranslations('common')
    const [desc, setDesc] = useState('')
    const [err,  setErr]  = useState('')
    const [busy, setBusy] = useState(false)

    async function submit(e: React.FormEvent) {
      e.preventDefault()
      if (!desc.trim()) { setErr(tM('enterDesc')); return }
      setBusy(true); setErr('')
      try {
        const res  = await fetch('/api/checklist-template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: desc }),
        })
        const json = await res.json()
        if (!res.ok) { setErr(json.error ?? tMC('error')); return }
        setItems((prev) => [...prev, json.item])
        setShowAdd(false)
      } catch { setErr(tMC('connectionFailed')) }
      finally { setBusy(false) }
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{tM('addItem')}</h2>
          <form onSubmit={submit} className="space-y-3">
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              placeholder={tM('enterDesc')}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 resize-none"
              autoFocus
            />
            {err && <p className="text-red-400 text-xs">{err}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAdd(false)}
                className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                {tMC('cancel')}
              </button>
              <button type="submit" disabled={busy || !desc.trim()}
                className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-50">
                {busy ? tMC('saving') : tMC('add')}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ── Edit modal ─────────────────────────────────────────────────────────────
  function EditModal({ item }: { item: TemplateItem }) {
    const tM = useTranslations('checklist')
    const tMC = useTranslations('common')
    const [desc, setDesc] = useState(item.description)
    const [err,  setErr]  = useState('')
    const [busy, setBusy] = useState(false)

    async function submit(e: React.FormEvent) {
      e.preventDefault()
      if (!desc.trim()) { setErr(tM('enterDesc')); return }
      setBusy(true); setErr('')
      try {
        const res  = await fetch(`/api/checklist-template/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: desc }),
        })
        const json = await res.json()
        if (!res.ok) { setErr(json.error ?? tMC('error')); return }
        setItems((prev) => prev.map((i) => i.id === item.id ? json.item : i))
        setEditItem(null)
      } catch { setErr(tMC('connectionFailed')) }
      finally { setBusy(false) }
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{tM('editItem')}</h2>
          <form onSubmit={submit} className="space-y-3">
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 resize-none"
              autoFocus
            />
            {err && <p className="text-red-400 text-xs">{err}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setEditItem(null)}
                className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                {tMC('cancel')}
              </button>
              <button type="submit" disabled={busy || !desc.trim()}
                className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-50">
                {busy ? tMC('saving') : tMC('save')}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ── Toggle active ──────────────────────────────────────────────────────────
  async function toggleActive(item: TemplateItem) {
    setSaving(true); setError('')
    try {
      const res  = await fetch(`/api/checklist-template/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !item.isActive }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tCommon('error')); return }
      setItems((prev) => prev.map((i) => i.id === item.id ? json.item : i))
    } catch { setError(tCommon('connectionFailed')) }
    finally { setSaving(false) }
  }

  // ── Reorder ────────────────────────────────────────────────────────────────
  async function move(item: TemplateItem, direction: 'up' | 'down') {
    const sorted = [...items].sort((a, b) => a.order - b.order)
    const idx    = sorted.findIndex((i) => i.id === item.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return

    const other   = sorted[swapIdx]
    const newOrder = other.order
    const oldOrder = item.order

    setItems((prev) =>
      prev.map((i) => {
        if (i.id === item.id)  return { ...i, order: newOrder }
        if (i.id === other.id) return { ...i, order: oldOrder }
        return i
      })
    )

    try {
      await Promise.all([
        fetch(`/api/checklist-template/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: newOrder }),
        }),
        fetch(`/api/checklist-template/${other.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: oldOrder }),
        }),
      ])
    } catch {
      setItems((prev) =>
        prev.map((i) => {
          if (i.id === item.id)  return { ...i, order: oldOrder }
          if (i.id === other.id) return { ...i, order: newOrder }
          return i
        })
      )
      setError(t('reorderError'))
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function deleteItem(item: TemplateItem) {
    if (!confirm(`${tCommon('delete')} "${item.description}"?`)) return
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/checklist-template/${item.id}`, { method: 'DELETE' })
      if (!res.ok) { const j = await res.json(); setError(j.error ?? tCommon('error')); return }
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } catch { setError(tCommon('connectionFailed')) }
    finally { setSaving(false) }
  }

  const sorted = [...items].sort((a, b) => a.order - b.order)
  const active  = sorted.filter((i) => i.isActive)
  const inactive = sorted.filter((i) => !i.isActive)

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      {showAdd  && canEdit && <AddModal />}
      {editItem && canEdit && <EditModal item={editItem} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('templateTitle')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('subtitle')}</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors"
          >
            + {t('addItem')}
          </button>
        )}
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Active items */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('activeItems', { count: active.length })}
          </h2>
        </div>

        {active.length === 0 ? (
          <p className="px-5 py-10 text-sm text-gray-500 text-center">{t('noActiveItems')}</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {active.map((item, idx) => (
              <li key={item.id} className="flex items-start gap-3 px-5 py-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs text-gray-500 mt-0.5">
                  {idx + 1}
                </span>

                <p className="flex-1 text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{item.description}</p>

                {canEdit && (
                  <div className="shrink-0 flex items-center gap-1">
                    <button
                      disabled={idx === 0 || saving}
                      onClick={() => move(item, 'up')}
                      title="↑"
                      className="p-1 text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 transition-colors"
                    >
                      ↑
                    </button>
                    <button
                      disabled={idx === active.length - 1 || saving}
                      onClick={() => move(item, 'down')}
                      title="↓"
                      className="p-1 text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 transition-colors"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => setEditItem(item)}
                      className="p-1 text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-xs"
                    >
                      ✎
                    </button>
                    <button
                      disabled={saving}
                      onClick={() => toggleActive(item)}
                      className="px-2 py-0.5 text-xs rounded-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors disabled:opacity-50"
                    >
                      {t('disable')}
                    </button>
                    <button
                      disabled={saving}
                      onClick={() => deleteItem(item)}
                      className="px-2 py-0.5 text-xs rounded-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50"
                    >
                      {tCommon('delete')}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Inactive items */}
      {inactive.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-500">
              {t('inactiveItems', { count: inactive.length })}
            </h2>
          </div>
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {inactive.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-5 py-3">
                <p className="flex-1 text-sm text-gray-300 dark:text-gray-600 line-through leading-relaxed">
                  {item.description}
                </p>
                {canEdit && (
                  <div className="shrink-0 flex gap-1">
                    <button
                      disabled={saving}
                      onClick={() => toggleActive(item)}
                      className="px-2 py-0.5 text-xs rounded-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors disabled:opacity-50"
                    >
                      {tCommon('activate')}
                    </button>
                    <button
                      disabled={saving}
                      onClick={() => deleteItem(item)}
                      className="px-2 py-0.5 text-xs rounded-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50"
                    >
                      {tCommon('delete')}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
