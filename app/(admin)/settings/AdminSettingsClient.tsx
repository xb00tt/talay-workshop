'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AdminSettings {
  companyName: string
  companyAddress: string
  logoPath: string | null
  frotcomUsername: string
  frotcomPassword: string
}

// ─── Shared UI primitives ──────────────────────────────────────────────────────

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        'w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white ' +
        'placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-purple-500 ' +
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
        'w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white ' +
        'placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-purple-500 resize-none ' +
        (props.className ?? '')
      }
    />
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{children}</label>
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
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function SaveBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold
        transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  )
}

// ─── Company info section ──────────────────────────────────────────────────────

function CompanySection({ initial }: { initial: AdminSettings }) {
  const t       = useTranslations('settings')
  const tCommon = useTranslations('common')
  const [companyName,    setCompanyName]    = useState(initial.companyName)
  const [companyAddress, setCompanyAddress] = useState(initial.companyAddress)
  const [logoPath,       setLogoPath]       = useState(initial.logoPath)
  const [loading,    setLoading]    = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [status,     setStatus]     = useState<{ type: 'error' | 'success'; msg: string } | null>(null)
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
      if (!res.ok) { setStatus({ type: 'error', msg: json.error ?? tCommon('error') }); return }
      setStatus({ type: 'success', msg: t('savedSuccess') })
    } catch {
      setStatus({ type: 'error', msg: tCommon('connectionFailed') })
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
      if (!res.ok) { setStatus({ type: 'error', msg: json.error ?? t('uploadError') }); return }
      setLogoPath(json.logoPath)
      setStatus({ type: 'success', msg: t('uploadSuccess') })
    } catch {
      setStatus({ type: 'error', msg: tCommon('connectionFailed') })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Section title={t('companySectionTitle')} description={t('companyDescription')}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <Label>{t('companyNameLabel')}</Label>
          <Input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Талай Транспорт ЕООД"
          />
        </div>
        <div>
          <Label>{t('companyAddressLabel')}</Label>
          <Textarea
            value={companyAddress}
            onChange={(e) => setCompanyAddress(e.target.value)}
            rows={2}
            placeholder="гр. София, ул. Примерна 1"
          />
        </div>

        {/* Logo */}
        <div>
          <Label>{t('logoSection')}</Label>
          <div className="flex items-center gap-4">
            {logoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/uploads/${logoPath}`}
                alt="Logo"
                className="h-14 w-auto rounded-lg border border-gray-300 dark:border-gray-700 object-contain bg-gray-100 dark:bg-gray-800 p-1"
              />
            ) : (
              <div className="h-14 w-24 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-xs text-gray-400 dark:text-gray-600">
                {t('noLogo')}
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
                className={`inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                  text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {uploading ? t('uploading') : t('uploadLogo')}
              </label>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">JPG, PNG, GIF, WebP</p>
            </div>
          </div>
        </div>

        {status && <StatusMsg type={status.type} msg={status.msg} />}
        <div className="flex justify-end pt-1">
          <SaveBtn loading={loading} label={loading ? tCommon('saving') : tCommon('save')} />
        </div>
      </form>
    </Section>
  )
}

// ─── Frotcom credentials section ───────────────────────────────────────────────

function FrotcomSection({ initial }: { initial: { frotcomUsername: string; frotcomPassword: string } }) {
  const t       = useTranslations('settings')
  const tCommon = useTranslations('common')
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
      if (!res.ok) { setStatus({ type: 'error', msg: json.error ?? tCommon('error') }); return }
      setStatus({ type: 'success', msg: t('savedSuccess') })
    } catch {
      setStatus({ type: 'error', msg: tCommon('connectionFailed') })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section title={t('frotcom')} description={t('frotcomDescription')}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <Label>{t('frotcomUsername')}</Label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <Label>{t('frotcomPassword')}</Label>
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xs"
            >
              {showPw ? t('hidePassword') : t('showPassword')}
            </button>
          </div>
        </div>

        {status && <StatusMsg type={status.type} msg={status.msg} />}
        <div className="flex justify-end pt-1">
          <SaveBtn loading={loading} label={loading ? tCommon('saving') : tCommon('save')} />
        </div>
      </form>
    </Section>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function AdminSettingsClient({ settings }: { settings: AdminSettings }) {
  const t = useTranslations('settings')
  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('title')}</h1>
      <div className="space-y-5">
        <CompanySection initial={settings} />
        <FrotcomSection initial={settings} />
      </div>
    </div>
  )
}
