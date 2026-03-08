'use client'

import { useState, useRef } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CompanySettings {
  companyName: string
  companyAddress: string
  logoPath: string | null
  frotcomUsername?: string
  frotcomPassword?: string
}

interface PersonalPrefs {
  preferredLocale: string
  darkMode: boolean
  pageSize: number
}

// ─── Shared UI primitives ──────────────────────────────────────────────────────

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

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={
        'w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white ' +
        'placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ' +
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
        'w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white ' +
        'focus:outline-none focus:ring-2 focus:ring-blue-500 ' +
        (props.className ?? '')
      }
    />
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-300 mb-1">{children}</label>
}

function StatusMsg({ type, msg }: { type: 'error' | 'success'; msg: string }) {
  return (
    <div className={`px-3 py-2 rounded-lg text-sm ${
      type === 'error'
        ? 'bg-red-500/10 border border-red-500/30 text-red-400'
        : 'bg-green-500/10 border border-green-500/30 text-green-400'
    }`}>
      {msg}
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-gray-900 rounded-2xl p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function SaveBtn({ loading, label = 'Запази' }: { loading: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold
        transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Запазване...' : label}
    </button>
  )
}

// ─── Company info section ──────────────────────────────────────────────────────

function CompanySection({ initial }: { initial: CompanySettings }) {
  const [companyName,    setCompanyName]    = useState(initial.companyName)
  const [companyAddress, setCompanyAddress] = useState(initial.companyAddress)
  const [logoPath,       setLogoPath]       = useState(initial.logoPath)
  const [loading,  setLoading]  = useState(false)
  const [uploading, setUploading] = useState(false)
  const [status,   setStatus]   = useState<{ type: 'error' | 'success'; msg: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setStatus(null)
    setLoading(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, companyAddress }),
      })
      const json = await res.json()
      if (!res.ok) { setStatus({ type: 'error', msg: json.error ?? 'Грешка.' }); return }
      setStatus({ type: 'success', msg: 'Запазено успешно.' })
    } catch {
      setStatus({ type: 'error', msg: 'Неуспешна връзка.' })
    } finally {
      setLoading(false)
    }
  }

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setStatus(null)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      const res = await fetch('/api/settings/logo', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setStatus({ type: 'error', msg: json.error ?? 'Грешка при качване.' }); return }
      setLogoPath(json.logoPath)
      setStatus({ type: 'success', msg: 'Логото е качено успешно.' })
    } catch {
      setStatus({ type: 'error', msg: 'Неуспешна връзка.' })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Section title="Фирмени данни" description="Показва се на разпечатките.">
      <form onSubmit={save} className="space-y-4">
        <div>
          <Label>Наименование на компанията</Label>
          <Input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Талай Транспорт ЕООД"
          />
        </div>
        <div>
          <Label>Адрес</Label>
          <Textarea
            value={companyAddress}
            onChange={(e) => setCompanyAddress(e.target.value)}
            rows={2}
            placeholder="гр. София, ул. Примерна 1"
          />
        </div>

        {/* Logo */}
        <div>
          <Label>Лого</Label>
          <div className="flex items-center gap-4">
            {logoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/uploads/${logoPath}`}
                alt="Лого"
                className="h-14 w-auto rounded-lg border border-gray-700 object-contain bg-gray-800 p-1"
              />
            ) : (
              <div className="h-14 w-24 rounded-lg border border-dashed border-gray-600 flex items-center justify-center text-xs text-gray-600">
                Няма лого
              </div>
            )}
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={uploadLogo}
                className="hidden"
                id="logo-upload"
              />
              <label
                htmlFor="logo-upload"
                className={`inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-600 text-sm
                  text-gray-300 hover:bg-gray-800 cursor-pointer transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {uploading ? 'Качване...' : 'Качи лого'}
              </label>
              <p className="text-xs text-gray-600 mt-1">JPG, PNG, GIF, WebP</p>
            </div>
          </div>
        </div>

        {status && <StatusMsg type={status.type} msg={status.msg} />}
        <div className="flex justify-end pt-1">
          <SaveBtn loading={loading} />
        </div>
      </form>
    </Section>
  )
}

// ─── Frotcom credentials section ───────────────────────────────────────────────

function FrotcomSection({ initial }: { initial: { frotcomUsername: string; frotcomPassword: string } }) {
  const [username, setUsername] = useState(initial.frotcomUsername)
  const [password, setPassword] = useState(initial.frotcomPassword)
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [status,   setStatus]   = useState<{ type: 'error' | 'success'; msg: string } | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setStatus(null)
    setLoading(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frotcomUsername: username, frotcomPassword: password }),
      })
      const json = await res.json()
      if (!res.ok) { setStatus({ type: 'error', msg: json.error ?? 'Грешка.' }); return }
      setStatus({ type: 'success', msg: 'Запазено успешно.' })
    } catch {
      setStatus({ type: 'error', msg: 'Неуспешна връзка.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section
      title="Frotcom интеграция"
      description="Данни за достъп до Frotcom API."
    >
      <form onSubmit={save} className="space-y-4">
        <div>
          <Label>Потребителско име</Label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <Label>Парола</Label>
          <div className="relative">
            <Input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
            >
              {showPw ? 'Скрий' : 'Покажи'}
            </button>
          </div>
        </div>

        {status && <StatusMsg type={status.type} msg={status.msg} />}
        <div className="flex justify-end pt-1">
          <SaveBtn loading={loading} />
        </div>
      </form>
    </Section>
  )
}

// ─── Personal preferences section ─────────────────────────────────────────────

function PersonalSection({ initial }: { initial: PersonalPrefs }) {
  const [locale,   setLocale]   = useState(initial.preferredLocale)
  const [darkMode, setDarkMode] = useState(initial.darkMode)
  const [pageSize, setPageSize] = useState(String(initial.pageSize))
  const [loading,  setLoading]  = useState(false)
  const [status,   setStatus]   = useState<{ type: 'error' | 'success'; msg: string } | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setStatus(null)
    setLoading(true)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredLocale: locale, darkMode, pageSize: Number(pageSize) }),
      })
      const json = await res.json()
      if (!res.ok) { setStatus({ type: 'error', msg: json.error ?? 'Грешка.' }); return }
      setStatus({ type: 'success', msg: 'Запазено. Промените влизат в сила след повторен вход.' })
    } catch {
      setStatus({ type: 'error', msg: 'Неуспешна връзка.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section
      title="Мои предпочитания"
      description="Личните настройки влизат в сила след повторен вход."
    >
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Език</Label>
            <Select value={locale} onChange={(e) => setLocale(e.target.value)}>
              <option value="bg">Български</option>
              <option value="en">English</option>
            </Select>
          </div>
          <div>
            <Label>Редове на страница</Label>
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
          <span className="text-sm text-gray-300">Тъмен режим</span>
        </label>

        {status && <StatusMsg type={status.type} msg={status.msg} />}
        <div className="flex justify-end pt-1">
          <SaveBtn loading={loading} />
        </div>
      </form>
    </Section>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function SettingsClient({
  settings,
  canEdit,
  currentUser,
}: {
  settings: CompanySettings
  canEdit: boolean
  currentUser: PersonalPrefs
}) {
  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">Настройки</h1>
      <div className="space-y-5">
        {canEdit && <CompanySection initial={settings} />}
        {canEdit && settings.frotcomUsername !== undefined && (
          <FrotcomSection
            initial={{
              frotcomUsername: settings.frotcomUsername ?? '',
              frotcomPassword: settings.frotcomPassword ?? '',
            }}
          />
        )}
        <PersonalSection initial={currentUser} />
      </div>
    </div>
  )
}
