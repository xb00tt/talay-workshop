'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Pagination from '@/components/Pagination'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface UserRow {
  id: number
  username: string
  name: string
  role: 'MANAGER' | 'ASSISTANT'
  permissions: string
  preferredLocale: string
  darkMode: boolean
  pageSize: number
  createdAt: string
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const PERMISSION_GROUPS = [
  {
    label: 'Сервизни поръчки',
    items: ['service.create', 'service.cancel', 'service.reschedule'],
  },
  {
    label: 'Камиони',
    items: ['truck.create', 'truck.edit', 'truck.deactivate', 'truck.import'],
  },
  {
    label: 'Работни карти',
    items: ['workcard.create', 'workcard.cancel', 'workcard.reopen', 'workcard.complete'],
  },
  {
    label: 'Медия и бележки',
    items: ['photo.upload', 'note.create'],
  },
  {
    label: 'Отчети',
    items: ['report.view', 'report.export'],
  },
  {
    label: 'Работилница',
    items: ['bay.manage', 'mechanic.manage'],
  },
  {
    label: 'Конфигурация и администрация',
    items: ['checklist.edit', 'equipment.edit', 'user.manage', 'settings.edit'],
  },
]

const PERMISSION_LABELS: Record<string, string> = {
  'service.create':     'Създаване на поръчки',
  'service.cancel':     'Отмяна на поръчки',
  'service.reschedule': 'Пренасрочване на поръчки',
  'truck.create':       'Добавяне на камиони',
  'truck.edit':         'Редактиране на камиони',
  'truck.deactivate':   'Деактивиране на камиони',
  'truck.import':       'Импорт от Frotcom',
  'workcard.create':    'Създаване на работни карти',
  'workcard.cancel':    'Отмяна на работни карти',
  'workcard.reopen':    'Повторно отваряне',
  'workcard.complete':  'Завършване на работни карти',
  'photo.upload':       'Качване на снимки',
  'note.create':        'Добавяне на бележки',
  'report.view':        'Преглед на отчети',
  'report.export':      'Експорт на отчети',
  'bay.manage':         'Управление на боксове',
  'mechanic.manage':    'Управление на механици',
  'checklist.edit':     'Редактиране на чеклист шаблон',
  'equipment.edit':     'Редактиране на оборудване',
  'user.manage':        'Управление на потребители',
  'settings.edit':      'Редактиране на настройки',
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()}`
}

function parsePerms(raw: string): string[] {
  try { return JSON.parse(raw) } catch { return [] }
}

// ─── Shared UI primitives ──────────────────────────────────────────────────────

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

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={
        'w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white ' +
        'focus:outline-hidden focus:ring-2 focus:ring-blue-500 ' +
        (props.className ?? '')
      }
    />
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{children}</label>
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
      {msg}
    </div>
  )
}

// ─── Modal wrapper ─────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ─── Recovery code display ─────────────────────────────────────────────────────

function RecoveryDisplay({
  code,
  tempPassword,
  username,
  onClose,
}: {
  code: string
  tempPassword?: string
  username: string
  onClose: () => void
}) {
  const t = useTranslations('user')
  const [confirmed, setConfirmed] = useState(false)
  return (
    <div className="space-y-5">
      <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-xl p-4">
        <p className="text-yellow-300 text-sm font-semibold mb-3">⚠ {t('saveCodeWarning')}</p>
        {tempPassword && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('tempPasswordFor')} <strong className="text-gray-900 dark:text-white">{username}</strong>:</p>
            <div className="bg-white dark:bg-gray-900 rounded-lg p-2 text-center">
              <span className="font-mono text-lg font-bold text-gray-900 dark:text-white tracking-widest">{tempPassword}</span>
            </div>
          </div>
        )}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('recoveryCodeLabel')}</p>
          <div className="bg-white dark:bg-gray-900 rounded-lg p-2 text-center">
            <span className="font-mono text-lg font-bold text-gray-900 dark:text-white tracking-widest">{code}</span>
          </div>
        </div>
        <p className="text-yellow-200/70 text-xs mt-3">
          {t('showOnce')}
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1 w-4 h-4 accent-blue-500 shrink-0"
        />
        <span className="text-sm text-gray-600 dark:text-gray-300">{t('saveCodeConfirm')}</span>
      </label>

      <button
        onClick={onClose}
        disabled={!confirmed}
        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold
          transition-colors disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed"
      >
        {t('done')}
      </button>
    </div>
  )
}

// ─── Permission checkboxes ─────────────────────────────────────────────────────

function PermissionsEditor({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (perms: string[]) => void
}) {
  const t = useTranslations('user')
  const toggle = (perm: string) => {
    onChange(selected.includes(perm) ? selected.filter((p) => p !== perm) : [...selected, perm])
  }
  const allPerms = PERMISSION_GROUPS.flatMap((g) => g.items)
  const allSelected = allPerms.every((p) => selected.includes(p))
  const toggleAll = () => onChange(allSelected ? [] : allPerms)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('permissionsTitle')}</p>
        <button
          type="button"
          onClick={toggleAll}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          {allSelected ? t('deselectAll') : t('selectAll')}
        </button>
      </div>
      {PERMISSION_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            {group.label}
          </p>
          <div className="grid grid-cols-2 gap-1">
            {group.items.map((perm) => (
              <label key={perm} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selected.includes(perm)}
                  onChange={() => toggle(perm)}
                  className="w-4 h-4 accent-blue-500 shrink-0"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
                  {PERMISSION_LABELS[perm]}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Add User Modal ─────────────────────────────────────────────────────────────

function AddUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (user: UserRow) => void
}) {
  const t = useTranslations('user')
  const tCommon = useTranslations('common')
  const [username, setUsername]         = useState('')
  const [name, setName]                 = useState('')
  const [role, setRole]                 = useState<'MANAGER' | 'ASSISTANT'>('ASSISTANT')
  const [password, setPassword]         = useState('')
  const [confirmPw, setConfirmPw]       = useState('')
  const [error, setError]               = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [created, setCreated]           = useState<{ user: UserRow; recoveryCode: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError(t('passwordTooShort')); return }
    if (password !== confirmPw) { setError(t('passwordMismatch')); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, name, role, password }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tCommon('error')); return }
      onCreated(json.user)
      setCreated(json)
    } catch {
      setError(tCommon('connectionFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (created) {
    return (
      <Modal title={t('newUserSaveCode')} onClose={onClose}>
        <RecoveryDisplay
          code={created.recoveryCode}
          username={created.user.username}
          onClose={onClose}
        />
      </Modal>
    )
  }

  return (
    <Modal title={t('new')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label>{t('usernameLabel')}</Label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
            placeholder="ivan.petrov"
            autoFocus
            autoComplete="off"
          />
          <p className="text-xs text-gray-500 mt-1">{t('usernameHint')}</p>
        </div>
        <div>
          <Label>{t('fullNameLabel')}</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Иван Петров"
          />
        </div>
        <div>
          <Label>{t('roleLabel')}</Label>
          <Select value={role} onChange={(e) => setRole(e.target.value as 'MANAGER' | 'ASSISTANT')}>
            <option value="ASSISTANT">{t('role.ASSISTANT')}</option>
            <option value="MANAGER">{t('role.MANAGER')}</option>
          </Select>
        </div>
        <div>
          <Label>{t('passwordLabel')}</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('passwordMinHint')}
            autoComplete="new-password"
          />
        </div>
        <div>
          <Label>{t('confirmPasswordLabel')}</Label>
          <Input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder={t('repeatPasswordPlaceholder')}
            autoComplete="new-password"
          />
        </div>

        {error && <ErrorBox msg={error} />}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            {tCommon('cancel')}
          </button>
          <button type="submit" disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors disabled:opacity-50">
            {submitting ? tCommon('saving') : t('createUser')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Edit User Modal ───────────────────────────────────────────────────────────

function EditUserModal({
  user,
  onClose,
  onUpdated,
}: {
  user: UserRow
  onClose: () => void
  onUpdated: (user: UserRow) => void
}) {
  const t = useTranslations('user')
  const tCommon = useTranslations('common')
  const [name, setName]                 = useState(user.name)
  const [role, setRole]                 = useState(user.role)
  const [perms, setPerms]               = useState<string[]>(parsePerms(user.permissions))
  const [locale, setLocale]             = useState(user.preferredLocale)
  const [darkMode, setDarkMode]         = useState(user.darkMode)
  const [pageSize, setPageSize]         = useState(String(user.pageSize))
  const [error, setError]               = useState('')
  const [submitting, setSubmitting]     = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          role,
          permissions: role === 'ASSISTANT' ? perms : [],
          preferredLocale: locale,
          darkMode,
          pageSize: Number(pageSize),
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tCommon('error')); return }
      onUpdated(json.user)
      onClose()
    } catch {
      setError(tCommon('connectionFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`${t('editTitle')} — ${user.username}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label>{t('fullNameLabel')}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <Label>{t('roleLabel')}</Label>
          <Select value={role} onChange={(e) => setRole(e.target.value as 'MANAGER' | 'ASSISTANT')}>
            <option value="ASSISTANT">{t('role.ASSISTANT')}</option>
            <option value="MANAGER">{t('role.MANAGER')}</option>
          </Select>
        </div>

        {role === 'ASSISTANT' && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <PermissionsEditor selected={perms} onChange={setPerms} />
          </div>
        )}
        {role === 'MANAGER' && (
          <p className="text-xs text-gray-500">{t('managersFullAccess')}</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t('preferredLocale')}</Label>
            <Select value={locale} onChange={(e) => setLocale(e.target.value)}>
              <option value="bg">Български</option>
              <option value="en">English</option>
            </Select>
          </div>
          <div>
            <Label>{t('pageSize')}</Label>
            <Select value={pageSize} onChange={(e) => setPageSize(e.target.value)}>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </Select>
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={darkMode}
            onChange={(e) => setDarkMode(e.target.checked)}
            className="w-4 h-4 accent-blue-500"
          />
          <span className="text-sm text-gray-600 dark:text-gray-300">{t('darkMode')}</span>
        </label>

        {error && <ErrorBox msg={error} />}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            {tCommon('cancel')}
          </button>
          <button type="submit" disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors disabled:opacity-50">
            {submitting ? tCommon('saving') : tCommon('save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Reset Password Modal ──────────────────────────────────────────────────────

function ResetPasswordModal({
  user,
  onClose,
}: {
  user: UserRow
  onClose: () => void
}) {
  const t = useTranslations('user')
  const tCommon = useTranslations('common')
  const [error, setError]           = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult]         = useState<{ tempPassword: string; recoveryCode: string } | null>(null)

  async function confirm() {
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/users/${user.id}/reset-password`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tCommon('error')); return }
      setResult(json)
    } catch {
      setError(tCommon('connectionFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <Modal title={t('resetDone')} onClose={onClose}>
        <RecoveryDisplay
          code={result.recoveryCode}
          tempPassword={result.tempPassword}
          username={user.username}
          onClose={onClose}
        />
      </Modal>
    )
  }

  return (
    <Modal title={t('resetTitle')} onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t('resetDesc', { name: user.name, username: user.username })}
        </p>
        {error && <ErrorBox msg={error} />}
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            {tCommon('cancel')}
          </button>
          <button onClick={confirm} disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors disabled:opacity-50">
            {submitting ? t('generating') : t('resetButton')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Delete Confirm Modal ──────────────────────────────────────────────────────

function DeleteModal({
  user,
  onClose,
  onDeleted,
}: {
  user: UserRow
  onClose: () => void
  onDeleted: (id: number) => void
}) {
  const t = useTranslations('user')
  const tCommon = useTranslations('common')
  const [error, setError]           = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function confirm() {
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tCommon('error')); return }
      onDeleted(user.id)
      onClose()
    } catch {
      setError(tCommon('connectionFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={t('deleteTitle')} onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t('deleteDesc', { name: user.name, username: user.username })}
        </p>
        {error && <ErrorBox msg={error} />}
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            {tCommon('cancel')}
          </button>
          <button onClick={confirm} disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors disabled:opacity-50">
            {submitting ? t('deleting') : tCommon('delete')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Role badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: 'MANAGER' | 'ASSISTANT' }) {
  const t = useTranslations('user')
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
      role === 'MANAGER'
        ? 'bg-blue-600/20 text-blue-400'
        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
    }`}>
      {role === 'MANAGER' ? t('role.MANAGER') : t('role.ASSISTANT')}
    </span>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

type ModalState =
  | { type: 'add' }
  | { type: 'edit'; user: UserRow }
  | { type: 'reset'; user: UserRow }
  | { type: 'delete'; user: UserRow }
  | null

export default function UsersClient({
  initialUsers,
  currentUserId,
  pageSize,
}: {
  initialUsers: UserRow[]
  currentUserId: number
  pageSize: number
}) {
  const t = useTranslations('user')
  const tCommon = useTranslations('common')
  const [users, setUsers]     = useState<UserRow[]>(initialUsers)
  const [modal, setModal]     = useState<ModalState>(null)
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)

  useEffect(() => { setPage(1) }, [search])

  function upsertUser(updated: UserRow) {
    setUsers((prev) => {
      const idx = prev.findIndex((u) => u.id === updated.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = updated
        return next
      }
      return [...prev, updated].sort((a, b) => a.name.localeCompare(b.name, 'bg'))
    })
  }

  function removeUser(id: number) {
    setUsers((prev) => prev.filter((u) => u.id !== id))
  }

  const q = search.trim().toLowerCase()
  const filteredUsers = q
    ? users.filter((u) =>
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q)
      )
    : users

  const totalPages   = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const visibleUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize)

  return (
    <>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('list')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{t('countLabel', { count: users.length })}</p>
          </div>
          <button
            onClick={() => setModal({ type: 'add' })}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            {t('new')}
          </button>
        </div>

        {/* Search */}
        <div className="mb-5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full max-w-sm bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('title')}
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('permissions')}
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    {tCommon('date')}
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {visibleUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900 dark:text-white">{user.name}</p>
                      <p className="text-xs text-gray-500 font-mono">{user.username}</p>
                    </td>
                    <td className="px-5 py-4">
                      <RoleBadge role={user.role} />
                      {user.role === 'ASSISTANT' && (
                        <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                          {t('permCount', { count: parsePerms(user.permissions).length })}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-400 hidden sm:table-cell">
                      {fmtDate(user.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <ActionBtn
                          label={tCommon('edit')}
                          onClick={() => setModal({ type: 'edit', user })}
                        >
                          <PencilIcon />
                        </ActionBtn>
                        <ActionBtn
                          label={t('resetPassword')}
                          onClick={() => setModal({ type: 'reset', user })}
                        >
                          <KeyIcon />
                        </ActionBtn>
                        <ActionBtn
                          label={tCommon('delete')}
                          danger
                          onClick={() => setModal({ type: 'delete', user })}
                        >
                          <TrashIcon />
                        </ActionBtn>
                      </div>
                    </td>
                  </tr>
                ))}

                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-gray-500">
                      {tCommon('noResults')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={filteredUsers.length}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>
      </div>

      {/* Modals */}
      {modal?.type === 'add' && (
        <AddUserModal
          onClose={() => setModal(null)}
          onCreated={(user) => { upsertUser(user); }}
        />
      )}
      {modal?.type === 'edit' && (
        <EditUserModal
          user={modal.user}
          onClose={() => setModal(null)}
          onUpdated={upsertUser}
        />
      )}
      {modal?.type === 'reset' && (
        <ResetPasswordModal
          user={modal.user}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'delete' && (
        <DeleteModal
          user={modal.user}
          onClose={() => setModal(null)}
          onDeleted={removeUser}
        />
      )}
    </>
  )
}

// ─── Small icon buttons ────────────────────────────────────────────────────────

function ActionBtn({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`p-1.5 rounded-lg transition-colors ${
        danger
          ? 'text-gray-400 dark:text-gray-600 hover:text-red-400 hover:bg-red-400/10'
          : 'text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

function PencilIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  )
}

function KeyIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  )
}
