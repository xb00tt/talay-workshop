'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

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
        'w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white ' +
        'placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 ' +
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
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:hover:text-white text-xl leading-none">×</button>
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
  const tCommon = useTranslations('common')
  const t       = useTranslations('bay')
  const [name, setName]       = useState(initial)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError(tCommon('nameRequired')); return }
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
          placeholder={t('namePlaceholder')}
          autoFocus
        />
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm">
            {tCommon('cancel')}
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
            {loading ? tCommon('saving') : tCommon('save')}
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
  const t       = useTranslations('bay')
  const tCommon = useTranslations('common')
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
      if (!res.ok) return json.error ?? tCommon('error')
      upsert(json.bay)
      return null
    } catch {
      return tCommon('connectionFailed')
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
      if (!res.ok) return json.error ?? tCommon('error')
      upsert(json.bay)
      return null
    } catch {
      return tCommon('connectionFailed')
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('list')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {t('activeCount', { active: active.length })}{inactive.length > 0 ? `, ${t('inactiveCount', { inactive: inactive.length })}` : ''}
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => setModal('add')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <span className="text-lg leading-none">+</span>
              {t('new')}
            </button>
          )}
        </div>

        {bays.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl">
            <p className="px-5 py-12 text-center text-gray-500">{t('empty')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {active.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-300 dark:border-gray-800">
                  <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{tCommon('active')} ({active.length})</h2>
                </div>
                <ul className="divide-y divide-gray-300 dark:divide-gray-800">
                  {active.map((bay) => (
                    <li key={bay.id} className="flex items-center px-5 py-4 gap-4">
                      <p className="flex-1 font-medium text-gray-900 dark:text-white">{bay.name}</p>
                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => setModal({ bay })}
                            className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-500 transition-colors">
                            {t('rename')}
                          </button>
                          <button onClick={() => toggleActive(bay)} disabled={toggling === bay.id}
                            className="px-3 py-1.5 text-xs rounded-lg border border-red-800/50 text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50">
                            {toggling === bay.id ? '...' : tCommon('deactivate')}
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {inactive.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-300 dark:border-gray-800">
                  <h2 className="text-xs font-semibold text-gray-300 dark:text-gray-600 uppercase tracking-wider">{tCommon('inactive')} ({inactive.length})</h2>
                </div>
                <ul className="divide-y divide-gray-300 dark:divide-gray-800">
                  {inactive.map((bay) => (
                    <li key={bay.id} className="flex items-center px-5 py-4 gap-4">
                      <p className="flex-1 font-medium text-gray-500">{bay.name}</p>
                      {canManage && (
                        <button onClick={() => toggleActive(bay)} disabled={toggling === bay.id}
                          className="px-3 py-1.5 text-xs rounded-lg border border-green-800/50 text-green-400 hover:bg-green-400/10 transition-colors disabled:opacity-50">
                          {toggling === bay.id ? '...' : tCommon('activate')}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {modal === 'add' && (
        <NameModal
          title={t('new')}
          initial=""
          onClose={() => setModal(null)}
          onSave={addBay}
        />
      )}
      {modal !== null && modal !== 'add' && (
        <NameModal
          title={t('renameTitle')}
          initial={modal.bay.name}
          onClose={() => setModal(null)}
          onSave={(name) => renameBay(modal.bay.id, name)}
        />
      )}
    </>
  )
}
