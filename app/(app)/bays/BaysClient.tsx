'use client'

import { useState } from 'react'

interface Bay {
  id: number
  name: string
  isActive: boolean
}

// ─── Shared UI ─────────────────────────────────────────────────────────────────

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        'w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white ' +
        'placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ' +
        (props.className ?? '')
      }
    />
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-gray-900 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Add / Edit modal ──────────────────────────────────────────────────────────

function NameModal({
  initial,
  title,
  onClose,
  onSave,
}: {
  initial: string
  title: string
  onClose: () => void
  onSave: (name: string) => Promise<string | null>
}) {
  const [name, setName]       = useState(initial)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Името е задължително.'); return }
    setError('')
    setLoading(true)
    const err = await onSave(name.trim())
    setLoading(false)
    if (err) { setError(err); return }
    onClose()
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Наименование"
          autoFocus
        />
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors text-sm">
            Откажи
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
            {loading ? 'Запазване...' : 'Запази'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function BaysClient({
  initialBays,
  canManage,
}: {
  initialBays: Bay[]
  canManage: boolean
}) {
  const [bays, setBays]   = useState<Bay[]>(initialBays)
  const [modal, setModal] = useState<'add' | { bay: Bay } | null>(null)
  const [toggling, setToggling] = useState<number | null>(null)

  function upsert(updated: Bay) {
    setBays((prev) => {
      const idx = prev.findIndex((b) => b.id === updated.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next }
      return [...prev, updated]
    })
  }

  async function addBay(name: string): Promise<string | null> {
    try {
      const res = await fetch('/api/bays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const json = await res.json()
      if (!res.ok) return json.error ?? 'Грешка.'
      upsert(json.bay)
      return null
    } catch {
      return 'Неуспешна връзка.'
    }
  }

  async function renameBay(id: number, name: string): Promise<string | null> {
    try {
      const res = await fetch(`/api/bays/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const json = await res.json()
      if (!res.ok) return json.error ?? 'Грешка.'
      upsert(json.bay)
      return null
    } catch {
      return 'Неуспешна връзка.'
    }
  }

  async function toggleActive(bay: Bay) {
    setToggling(bay.id)
    try {
      const res = await fetch(`/api/bays/${bay.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !bay.isActive }),
      })
      const json = await res.json()
      if (res.ok) upsert(json.bay)
    } finally {
      setToggling(null)
    }
  }

  const active   = bays.filter((b) => b.isActive)
  const inactive = bays.filter((b) => !b.isActive)

  return (
    <>
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Сервизни места</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {active.length} активни{inactive.length > 0 ? `, ${inactive.length} неактивни` : ''}
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => setModal('add')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <span className="text-lg leading-none">+</span>
              Ново сервизно място
            </button>
          )}
        </div>

        <div className="bg-gray-900 rounded-2xl overflow-hidden">
          {bays.length === 0 && (
            <p className="px-5 py-12 text-center text-gray-500">Няма сервизни места.</p>
          )}
          <ul className="divide-y divide-gray-800">
            {bays.map((bay) => (
              <li key={bay.id} className="flex items-center px-5 py-4 gap-4">
                <div className="flex-1">
                  <p className="font-medium text-white">{bay.name}</p>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  bay.isActive
                    ? 'bg-green-600/20 text-green-400'
                    : 'bg-gray-700 text-gray-500'
                }`}>
                  {bay.isActive ? 'Активно' : 'Неактивно'}
                </span>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setModal({ bay })}
                      className="px-3 py-1.5 text-xs rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                    >
                      Преименувай
                    </button>
                    <button
                      onClick={() => toggleActive(bay)}
                      disabled={toggling === bay.id}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-50 ${
                        bay.isActive
                          ? 'border-red-800/50 text-red-400 hover:bg-red-400/10'
                          : 'border-green-800/50 text-green-400 hover:bg-green-400/10'
                      }`}
                    >
                      {toggling === bay.id ? '...' : bay.isActive ? 'Деактивирай' : 'Активирай'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {modal === 'add' && (
        <NameModal
          title="Ново сервизно място"
          initial=""
          onClose={() => setModal(null)}
          onSave={addBay}
        />
      )}
      {modal !== null && modal !== 'add' && (
        <NameModal
          title="Преименуване"
          initial={modal.bay.name}
          onClose={() => setModal(null)}
          onSave={(name) => renameBay(modal.bay.id, name)}
        />
      )}
    </>
  )
}
