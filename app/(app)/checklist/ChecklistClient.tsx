'use client'

import { useState } from 'react'

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
  const [items, setItems]         = useState<TemplateItem[]>(initialItems)
  const [showAdd, setShowAdd]     = useState(false)
  const [editItem, setEditItem]   = useState<TemplateItem | null>(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  // ── Add modal ──────────────────────────────────────────────────────────────
  function AddModal() {
    const [desc, setDesc] = useState('')
    const [err,  setErr]  = useState('')
    const [busy, setBusy] = useState(false)

    async function submit(e: React.FormEvent) {
      e.preventDefault()
      if (!desc.trim()) { setErr('Въведете описание.'); return }
      setBusy(true); setErr('')
      try {
        const res  = await fetch('/api/checklist-template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: desc }),
        })
        const json = await res.json()
        if (!res.ok) { setErr(json.error ?? 'Грешка.'); return }
        setItems((prev) => [...prev, json.item])
        setShowAdd(false)
      } catch { setErr('Неуспешна връзка.') }
      finally { setBusy(false) }
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6 space-y-4">
          <h2 className="text-base font-semibold text-white">Добави точка</h2>
          <form onSubmit={submit} className="space-y-3">
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              placeholder="Описание на проверката..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              autoFocus
            />
            {err && <p className="text-red-400 text-xs">{err}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAdd(false)}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors">
                Отказ
              </button>
              <button type="submit" disabled={busy || !desc.trim()}
                className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-50">
                {busy ? 'Запазване...' : 'Добави'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ── Edit modal ─────────────────────────────────────────────────────────────
  function EditModal({ item }: { item: TemplateItem }) {
    const [desc, setDesc] = useState(item.description)
    const [err,  setErr]  = useState('')
    const [busy, setBusy] = useState(false)

    async function submit(e: React.FormEvent) {
      e.preventDefault()
      if (!desc.trim()) { setErr('Въведете описание.'); return }
      setBusy(true); setErr('')
      try {
        const res  = await fetch(`/api/checklist-template/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: desc }),
        })
        const json = await res.json()
        if (!res.ok) { setErr(json.error ?? 'Грешка.'); return }
        setItems((prev) => prev.map((i) => i.id === item.id ? json.item : i))
        setEditItem(null)
      } catch { setErr('Неуспешна връзка.') }
      finally { setBusy(false) }
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6 space-y-4">
          <h2 className="text-base font-semibold text-white">Редактирай точка</h2>
          <form onSubmit={submit} className="space-y-3">
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              autoFocus
            />
            {err && <p className="text-red-400 text-xs">{err}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setEditItem(null)}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors">
                Отказ
              </button>
              <button type="submit" disabled={busy || !desc.trim()}
                className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-50">
                {busy ? 'Запазване...' : 'Запази'}
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
      if (!res.ok) { setError(json.error ?? 'Грешка.'); return }
      setItems((prev) => prev.map((i) => i.id === item.id ? json.item : i))
    } catch { setError('Неуспешна връзка.') }
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

    // Optimistic
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
      // revert
      setItems((prev) =>
        prev.map((i) => {
          if (i.id === item.id)  return { ...i, order: oldOrder }
          if (i.id === other.id) return { ...i, order: newOrder }
          return i
        })
      )
      setError('Грешка при пренареждане.')
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function deleteItem(item: TemplateItem) {
    if (!confirm(`Изтриване на "${item.description}"?`)) return
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/checklist-template/${item.id}`, { method: 'DELETE' })
      if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Грешка.'); return }
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } catch { setError('Неуспешна връзка.') }
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
          <h1 className="text-xl font-bold text-white">Шаблон на чеклист</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Точките се копират автоматично при приемане на нов сервиз.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors"
          >
            + Добави точка
          </button>
        )}
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Active items */}
      <div className="bg-gray-900 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">
            Активни точки ({active.length})
          </h2>
        </div>

        {active.length === 0 ? (
          <p className="px-5 py-10 text-sm text-gray-500 text-center">Няма активни точки.</p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {active.map((item, idx) => (
              <li key={item.id} className="flex items-start gap-3 px-5 py-3">
                {/* Order indicator */}
                <span className="shrink-0 w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs text-gray-500 mt-0.5">
                  {idx + 1}
                </span>

                <p className="flex-1 text-sm text-gray-200 leading-relaxed">{item.description}</p>

                {canEdit && (
                  <div className="shrink-0 flex items-center gap-1">
                    {/* Move up */}
                    <button
                      disabled={idx === 0 || saving}
                      onClick={() => move(item, 'up')}
                      title="Нагоре"
                      className="p-1 text-gray-600 hover:text-gray-300 disabled:opacity-30 transition-colors"
                    >
                      ↑
                    </button>
                    {/* Move down */}
                    <button
                      disabled={idx === active.length - 1 || saving}
                      onClick={() => move(item, 'down')}
                      title="Надолу"
                      className="p-1 text-gray-600 hover:text-gray-300 disabled:opacity-30 transition-colors"
                    >
                      ↓
                    </button>
                    {/* Edit */}
                    <button
                      onClick={() => setEditItem(item)}
                      className="p-1 text-gray-600 hover:text-gray-300 transition-colors text-xs"
                    >
                      ✎
                    </button>
                    {/* Deactivate */}
                    <button
                      disabled={saving}
                      onClick={() => toggleActive(item)}
                      title="Деактивирай"
                      className="px-2 py-0.5 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors disabled:opacity-50"
                    >
                      Изкл.
                    </button>
                    {/* Delete */}
                    <button
                      disabled={saving}
                      onClick={() => deleteItem(item)}
                      className="px-2 py-0.5 text-xs rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50"
                    >
                      Изтрий
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
        <div className="bg-gray-900 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-500">
              Неактивни точки ({inactive.length})
            </h2>
          </div>
          <ul className="divide-y divide-gray-800">
            {inactive.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-5 py-3">
                <p className="flex-1 text-sm text-gray-600 line-through leading-relaxed">
                  {item.description}
                </p>
                {canEdit && (
                  <div className="shrink-0 flex gap-1">
                    <button
                      disabled={saving}
                      onClick={() => toggleActive(item)}
                      className="px-2 py-0.5 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors disabled:opacity-50"
                    >
                      Активирай
                    </button>
                    <button
                      disabled={saving}
                      onClick={() => deleteItem(item)}
                      className="px-2 py-0.5 text-xs rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50"
                    >
                      Изтрий
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
