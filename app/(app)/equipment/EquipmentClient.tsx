'use client'

import { useState } from 'react'

interface EqItem {
  id: number
  name: string
  description: string | null
  order: number
  isActive: boolean
}

interface Props {
  initialItems:    EqItem[]
  initialAdrItems: EqItem[]
  canEdit: boolean
}

// ── helpers ──────────────────────────────────────────────────────────────────

function encodeId(isAdr: boolean, id: number) {
  return `${isAdr ? 'adr' : 'global'}-${id}`
}

async function patchItem(isAdr: boolean, id: number, body: object) {
  return fetch(`/api/equipment/${encodeId(isAdr, id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function deleteItem(isAdr: boolean, id: number) {
  return fetch(`/api/equipment/${encodeId(isAdr, id)}`, { method: 'DELETE' })
}

// ── AddModal ─────────────────────────────────────────────────────────────────

function AddModal({
  isAdr,
  onClose,
  onAdded,
}: {
  isAdr: boolean
  onClose: () => void
  onAdded: (item: EqItem) => void
}) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [err,  setErr]  = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setErr('Въведете наименование.'); return }
    setBusy(true); setErr('')
    try {
      const res  = await fetch('/api/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: desc || null, isAdr }),
      })
      const json = await res.json()
      if (!res.ok) { setErr(json.error ?? 'Грешка.'); return }
      onAdded(json.item)
      onClose()
    } catch { setErr('Неуспешна връзка.') }
    finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-base font-semibold text-white">
          Добави {isAdr ? 'ADR ' : ''}оборудване
        </h2>
        <form onSubmit={submit} className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Наименование *"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Описание (по желание)"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {err && <p className="text-red-400 text-xs">{err}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors">
              Отказ
            </button>
            <button type="submit" disabled={busy || !name.trim()}
              className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-50">
              {busy ? 'Запазване...' : 'Добави'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── EditModal ─────────────────────────────────────────────────────────────────

function EditModal({
  item,
  isAdr,
  onClose,
  onSaved,
}: {
  item: EqItem
  isAdr: boolean
  onClose: () => void
  onSaved: (item: EqItem) => void
}) {
  const [name, setName] = useState(item.name)
  const [desc, setDesc] = useState(item.description ?? '')
  const [err,  setErr]  = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setErr('Въведете наименование.'); return }
    setBusy(true); setErr('')
    try {
      const res  = await patchItem(isAdr, item.id, { name, description: desc || null })
      const json = await res.json()
      if (!res.ok) { setErr(json.error ?? 'Грешка.'); return }
      onSaved(json.item)
      onClose()
    } catch { setErr('Неуспешна връзка.') }
    finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-base font-semibold text-white">Редактирай</h2>
        <form onSubmit={submit} className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Описание (по желание)"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {err && <p className="text-red-400 text-xs">{err}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors">
              Отказ
            </button>
            <button type="submit" disabled={busy || !name.trim()}
              className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-50">
              {busy ? 'Запазване...' : 'Запази'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── ItemList ──────────────────────────────────────────────────────────────────

function ItemList({
  title,
  items,
  isAdr,
  canEdit,
  onAdd,
  setItems,
}: {
  title: string
  items: EqItem[]
  isAdr: boolean
  canEdit: boolean
  onAdd: () => void
  setItems: React.Dispatch<React.SetStateAction<EqItem[]>>
}) {
  const [editTarget, setEditTarget] = useState<EqItem | null>(null)
  const [busy, setBusy]             = useState(false)
  const [error, setError]           = useState('')

  const sorted   = [...items].sort((a, b) => a.order - b.order)
  const active   = sorted.filter((i) => i.isActive)
  const inactive = sorted.filter((i) => !i.isActive)

  async function toggle(item: EqItem) {
    setBusy(true); setError('')
    try {
      const res  = await patchItem(isAdr, item.id, { isActive: !item.isActive })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Грешка.'); return }
      setItems((prev) => prev.map((i) => i.id === item.id ? json.item : i))
    } catch { setError('Неуспешна връзка.') }
    finally { setBusy(false) }
  }

  async function move(item: EqItem, direction: 'up' | 'down') {
    const list    = [...active]
    const idx     = list.findIndex((i) => i.id === item.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= list.length) return
    const other   = list[swapIdx]
    const newOrd  = other.order
    const oldOrd  = item.order
    setItems((prev) => prev.map((i) => {
      if (i.id === item.id)  return { ...i, order: newOrd }
      if (i.id === other.id) return { ...i, order: oldOrd }
      return i
    }))
    try {
      await Promise.all([
        patchItem(isAdr, item.id,  { order: newOrd }),
        patchItem(isAdr, other.id, { order: oldOrd }),
      ])
    } catch {
      setItems((prev) => prev.map((i) => {
        if (i.id === item.id)  return { ...i, order: oldOrd }
        if (i.id === other.id) return { ...i, order: newOrd }
        return i
      }))
      setError('Грешка при пренареждане.')
    }
  }

  async function doDelete(item: EqItem) {
    if (!confirm(`Изтриване на "${item.name}"?`)) return
    setBusy(true); setError('')
    try {
      const res = await deleteItem(isAdr, item.id)
      if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Грешка.'); return }
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } catch { setError('Неуспешна връзка.') }
    finally { setBusy(false) }
  }

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      {editTarget && (
        <EditModal
          item={editTarget}
          isAdr={isAdr}
          onClose={() => setEditTarget(null)}
          onSaved={(updated) => {
            setItems((prev) => prev.map((i) => i.id === updated.id ? updated : i))
            setEditTarget(null)
          }}
        />
      )}

      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-white">{title} ({active.length})</h2>
        {canEdit && (
          <button onClick={onAdd}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
            + Добави
          </button>
        )}
      </div>

      {error && (
        <div className="mx-5 mt-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {active.length === 0 && inactive.length === 0 ? (
        <p className="px-5 py-10 text-sm text-gray-500 text-center">Няма позиции.</p>
      ) : (
        <>
          <ul className="divide-y divide-gray-800">
            {active.map((item, idx) => (
              <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs text-gray-500">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200">{item.name}</p>
                  {item.description && (
                    <p className="text-xs text-gray-500">{item.description}</p>
                  )}
                </div>
                {canEdit && (
                  <div className="shrink-0 flex items-center gap-1">
                    <button disabled={idx === 0 || busy} onClick={() => move(item, 'up')}
                      className="p-1 text-gray-600 hover:text-gray-300 disabled:opacity-30 transition-colors">↑</button>
                    <button disabled={idx === active.length - 1 || busy} onClick={() => move(item, 'down')}
                      className="p-1 text-gray-600 hover:text-gray-300 disabled:opacity-30 transition-colors">↓</button>
                    <button onClick={() => setEditTarget(item)}
                      className="p-1 text-gray-600 hover:text-gray-300 transition-colors text-xs">✎</button>
                    <button disabled={busy} onClick={() => toggle(item)}
                      className="px-2 py-0.5 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors disabled:opacity-50">
                      Изкл.
                    </button>
                    <button disabled={busy} onClick={() => doDelete(item)}
                      className="px-2 py-0.5 text-xs rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50">
                      Изтрий
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {inactive.length > 0 && (
            <div className="border-t border-gray-800">
              <p className="px-5 py-2 text-xs text-gray-600 font-semibold uppercase tracking-wider">
                Неактивни ({inactive.length})
              </p>
              <ul className="divide-y divide-gray-800">
                {inactive.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-5 py-2">
                    <p className="flex-1 text-sm text-gray-600 line-through">{item.name}</p>
                    {canEdit && (
                      <div className="shrink-0 flex gap-1">
                        <button disabled={busy} onClick={() => toggle(item)}
                          className="px-2 py-0.5 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors disabled:opacity-50">
                          Активирай
                        </button>
                        <button disabled={busy} onClick={() => doDelete(item)}
                          className="px-2 py-0.5 text-xs rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50">
                          Изтрий
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── EquipmentClient ───────────────────────────────────────────────────────────

export default function EquipmentClient({ initialItems, initialAdrItems, canEdit }: Props) {
  const [items,    setItems]    = useState<EqItem[]>(initialItems)
  const [adrItems, setAdrItems] = useState<EqItem[]>(initialAdrItems)
  const [addFor,   setAddFor]   = useState<'global' | 'adr' | null>(null)

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      {addFor !== null && (
        <AddModal
          isAdr={addFor === 'adr'}
          onClose={() => setAddFor(null)}
          onAdded={(item) => {
            if (addFor === 'adr') setAdrItems((prev) => [...prev, item])
            else                  setItems((prev)    => [...prev, item])
            setAddFor(null)
          }}
        />
      )}

      <div>
        <h1 className="text-xl font-bold text-white">Оборудване</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Тези списъци се използват при проверката на оборудването при приемане и предаване на камион.
        </p>
      </div>

      <ItemList
        title="Стандартно оборудване"
        items={items}
        isAdr={false}
        canEdit={canEdit}
        onAdd={() => setAddFor('global')}
        setItems={setItems}
      />

      <ItemList
        title="ADR оборудване"
        items={adrItems}
        isAdr={true}
        canEdit={canEdit}
        onAdd={() => setAddFor('adr')}
        setItems={setAdrItems}
      />
    </div>
  )
}
