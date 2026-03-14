'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'

// ─── Icons ─────────────────────────────────────────────────────────────────────

const P = {
  home:      'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  calendar:  'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  clipboard: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  truck:     'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h8l2-2zM13 16l2-5h3l2 5-2 2h-3l-2-2z',
  persons:   'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  wrench:    'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  check:     'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  box:       'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  chart:     'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  bars:      'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
  xmark:     'M6 18L18 6M6 6l12 12',
  logout:    'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9',
  cog:       'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  shield:    'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
  arrowLeft: 'M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18',
}

type IconName = keyof typeof P

function Ico({ name, className = 'w-4 h-4' }: { name: IconName; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d={P[name]} />
    </svg>
  )
}

// ─── Nav definitions ───────────────────────────────────────────────────────────

interface NavItem {
  href: string
  labelKey: string
  icon: IconName
  showActiveCount?: boolean
  showTruckCount?:  boolean
}
interface NavGroup { groupKey?: string; items: NavItem[] }

const MAIN_NAV: NavGroup[] = [
  {
    items: [
      { href: '/dashboard', labelKey: 'dashboard', icon: 'home'      },
      { href: '/services',  labelKey: 'services',  icon: 'clipboard', showActiveCount: true },
      { href: '/calendar',  labelKey: 'calendar',  icon: 'calendar'  },
    ],
  },
  {
    groupKey: 'groupFleet',
    items: [
      { href: '/trucks',    labelKey: 'trucks',    icon: 'truck',   showTruckCount: true },
      { href: '/drivers',   labelKey: 'drivers',   icon: 'persons'  },
      { href: '/mechanics', labelKey: 'mechanics', icon: 'wrench'   },
    ],
  },
  {
    groupKey: 'groupManagement',
    items: [
      { href: '/reports', labelKey: 'reports', icon: 'chart' },
    ],
  },
]

const CONFIG_NAV: NavGroup[] = [
  {
    items: [
      { href: '/checklist', labelKey: 'checklistTemplate', icon: 'check' },
      { href: '/equipment', labelKey: 'equipment',         icon: 'box'   },
    ],
  },
]

const ADMIN_NAV_GROUP: NavGroup = {
  groupKey: 'groupAdmin',
  items: [
    { href: '/admin/users',     labelKey: 'users',    icon: 'persons' },
    { href: '/admin/settings',  labelKey: 'settings', icon: 'cog'     },
    { href: '/admin/audit-log', labelKey: 'auditLog', icon: 'shield'  },
  ],
}

// ─── Nav link ──────────────────────────────────────────────────────────────────

function NavLink({
  item, label, active, badge, trailing, onClick,
}: {
  item: NavItem
  label: string
  active: boolean
  badge?:    number         // coloured count pill
  trailing?: string | number // dim trailing text
  onClick?: () => void
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
        active
          ? 'bg-blue-500/20 text-blue-300'
          : 'text-slate-400 hover:bg-white/[0.08] hover:text-slate-100'
      }`}
    >
      <Ico name={item.icon} />
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 leading-none tabular-nums">
          {badge}
        </span>
      )}
      {trailing !== undefined && badge === undefined && (
        <span className="text-xs text-slate-500 tabular-nums">{trailing}</span>
      )}
    </Link>
  )
}

// ─── Preferences modal ─────────────────────────────────────────────────────────

function PreferencesModal({
  onClose,
  initialLocale,
  initialDarkMode,
  initialPageSize,
}: {
  onClose: () => void
  initialLocale: string
  initialDarkMode: boolean
  initialPageSize: number
}) {
  const t       = useTranslations('settings')
  const tCommon = useTranslations('common')
  const [locale,   setLocale]   = useState(initialLocale)
  const [darkMode, setDarkMode] = useState(initialDarkMode)
  const [pageSize, setPageSize] = useState(String(initialPageSize))
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
      if (!res.ok) { setStatus({ type: 'error', msg: json.error ?? tCommon('error') }); return }
      setStatus({ type: 'success', msg: t('savedReloginRequired') })
    } catch {
      setStatus({ type: 'error', msg: tCommon('connectionFailed') })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-100 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('personalPreferences')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <Ico name="xmark" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('language')}</label>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="bg">Български</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('rowsPerPage')}</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
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

          {status && (
            <div className={`px-3 py-2 rounded-lg text-xs ${
              status.type === 'error'
                ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                : 'bg-green-500/10 border border-green-500/30 text-green-400'
            }`}>
              {status.msg}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {tCommon('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? tCommon('saving') : tCommon('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── User menu ─────────────────────────────────────────────────────────────────

function UserMenu({
  userName,
  userRole,
  preferredLocale,
  darkMode: initialDarkMode,
  pageSize,
}: {
  userName: string
  userRole: string
  preferredLocale: string
  darkMode: boolean
  pageSize: number
}) {
  const tAuth = useTranslations('auth')
  const tCommon = useTranslations('common')
  const tNav  = useTranslations('nav')
  const [open, setOpen] = useState(false)
  const [showPrefs, setShowPrefs] = useState(false)

  const roleLabel = userRole === 'MANAGER' ? tNav('manager') : tNav('assistant')

  const initials = userName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <>
      <div className="border-t border-white/[0.08] px-3 py-3 relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.06] transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
            <p className="text-xs text-slate-400">{roleLabel}</p>
          </div>
          <svg
            className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        </button>

        {open && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-[#0f172a] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden z-50">
            <div className="px-4 py-3 border-b border-white/[0.08]">
              <p className="text-xs font-semibold text-white truncate">{userName}</p>
              <p className="text-xs text-slate-400 mt-0.5">{roleLabel}</p>
            </div>
            <button
              onClick={() => { setOpen(false); setShowPrefs(true) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.08] hover:text-white transition-colors"
            >
              <Ico name="cog" className="w-4 h-4 text-slate-400" />
              {tAuth('preferences')}
            </button>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-white/[0.08] hover:text-red-300 transition-colors"
            >
              <Ico name="logout" className="w-4 h-4" />
              {tAuth('logout')}
            </button>
          </div>
        )}
      </div>

      {showPrefs && (
        <PreferencesModal
          onClose={() => setShowPrefs(false)}
          initialLocale={preferredLocale}
          initialDarkMode={initialDarkMode}
          initialPageSize={pageSize}
        />
      )}
    </>
  )
}

// ─── Sidebar content ───────────────────────────────────────────────────────────

function SidebarContent({
  pathname,
  userName,
  userRole,
  preferredLocale,
  darkMode,
  pageSize,
  activeServiceCount,
  truckCount,
  companyName,
  onNav,
}: {
  pathname: string
  userName: string
  userRole: string
  preferredLocale: string
  darkMode: boolean
  pageSize: number
  activeServiceCount: number
  truckCount: number
  companyName?: string
  onNav?: () => void
}) {
  const t = useTranslations('nav')
  const [view, setView] = useState<'main' | 'settings'>('main')

  const settingsGroups: NavGroup[] = [...CONFIG_NAV]
  if (userRole === 'MANAGER' || userRole === 'ADMIN') {
    settingsGroups.push(ADMIN_NAV_GROUP)
  }

  return (
    <div className="flex flex-col h-full">

      {/* Logo row */}
      <div className="px-5 py-4 flex items-center gap-3 border-b border-white/[0.08]">
        {view === 'settings' ? (
          <button
            onClick={() => setView('main')}
            className="w-8 h-8 rounded-xl bg-slate-700/60 flex items-center justify-center shrink-0 hover:bg-slate-700 transition-colors"
          >
            <Ico name="arrowLeft" className="w-4 h-4 text-slate-300" />
          </button>
        ) : (
          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
            <Ico name="cog" className="w-4 h-4 text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm leading-tight">{companyName ?? 'Workshop'}</p>
          <p className="text-slate-400 text-xs leading-tight">
            {view === 'settings' ? t('settings') : 'Управление'}
          </p>
        </div>
        {view === 'main' && (
          <button
            onClick={() => setView('settings')}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.08] transition-colors"
            title={t('settings')}
          >
            <Ico name="cog" className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      {view === 'main' ? (
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          {MAIN_NAV.map((group, gi) => (
            <div key={gi} className="space-y-0.5">
              {group.groupKey && (
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400/50">
                  {t(group.groupKey as Parameters<typeof t>[0])}
                </p>
              )}
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                const badge    = item.showActiveCount ? activeServiceCount : undefined
                const trailing = item.showTruckCount  ? truckCount         : undefined
                return (
                  <NavLink
                    key={item.href}
                    item={item}
                    label={t(item.labelKey as Parameters<typeof t>[0])}
                    active={active}
                    badge={badge}
                    trailing={trailing}
                    onClick={onNav}
                  />
                )
              })}
            </div>
          ))}
        </nav>
      ) : (
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          {settingsGroups.map((group, gi) => (
            <div key={gi} className="space-y-0.5">
              {group.groupKey && (
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400/50">
                  {t(group.groupKey as Parameters<typeof t>[0])}
                </p>
              )}
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <NavLink
                    key={item.href}
                    item={item}
                    label={t(item.labelKey as Parameters<typeof t>[0])}
                    active={active}
                    onClick={onNav}
                  />
                )
              })}
            </div>
          ))}
        </nav>
      )}

      {/* User menu */}
      <UserMenu
        userName={userName}
        userRole={userRole}
        preferredLocale={preferredLocale}
        darkMode={darkMode}
        pageSize={pageSize}
      />
    </div>
  )
}

// ─── AppShell ──────────────────────────────────────────────────────────────────

export default function AppShell({
  children,
  userName,
  userRole,
  preferredLocale,
  darkMode,
  pageSize,
  activeServiceCount = 0,
  truckCount = 0,
  companyName,
}: {
  children: React.ReactNode
  userName: string
  userRole: string
  preferredLocale: string
  darkMode: boolean
  pageSize: number
  activeServiceCount?: number
  truckCount?: number
  companyName?: string
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const sidebarProps = {
    pathname,
    userName,
    userRole,
    preferredLocale,
    darkMode,
    pageSize,
    activeServiceCount,
    truckCount,
    companyName,
  }

  return (
    <div className="flex min-h-screen">

      {/* Desktop sidebar — always dark */}
      <aside
        className="hidden lg:flex lg:flex-col w-60 fixed inset-y-0 left-0 z-30"
        style={{ background: '#1e293b', boxShadow: '4px 0 16px rgba(0,0,0,0.15)' }}
      >
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setOpen(false)} />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 w-60 z-50 transform transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: '#1e293b', boxShadow: '4px 0 16px rgba(0,0,0,0.15)' }}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-100 p-1"
        >
          <Ico name="xmark" />
        </button>
        <SidebarContent {...sidebarProps} onNav={() => setOpen(false)} />
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">

        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-20 bg-[#1e293b] px-4 py-3 flex items-center justify-between shadow-md">
          <button onClick={() => setOpen(true)} className="text-slate-400 hover:text-white">
            <Ico name="bars" />
          </button>
          <p className="text-sm font-semibold text-white">{companyName ?? 'Workshop'}</p>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-slate-400 hover:text-red-400 transition-colors"
          >
            <Ico name="logout" />
          </button>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
