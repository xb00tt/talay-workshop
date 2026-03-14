'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'

// ─── Icon helper ───────────────────────────────────────────────────────────────

const P = {
  users:   'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  cog:     'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  book:    'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
  wrench:  'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z',
  arrow:   'M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18',
  bars:    'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
  xmark:   'M6 18L18 6M6 6l12 12',
  logout:  'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9',
  shield:  'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
}

type IconName = keyof typeof P

function Ico({ name, className = 'w-5 h-5' }: { name: IconName; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d={P[name]} />
    </svg>
  )
}

// ─── Nav items ─────────────────────────────────────────────────────────────────

interface NavItem { href: string; labelKey: string; icon: IconName }

const NAV: NavItem[] = [
  { href: '/admin/users',     labelKey: 'users',     icon: 'users' },
  { href: '/admin/settings',  labelKey: 'settings',  icon: 'cog'   },
  { href: '/admin/audit-log', labelKey: 'auditLog',  icon: 'book'  },
]

function NavLink({ item, label, active, onClick }: { item: NavItem; label: string; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-purple-600/20 text-purple-400'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      <Ico name={item.icon} />
      {label}
    </Link>
  )
}

// ─── Sidebar content ───────────────────────────────────────────────────────────

function SidebarContent({
  pathname,
  userName,
  onNav,
}: {
  pathname: string
  userName: string
  onNav?: () => void
}) {
  const t     = useTranslations('nav')
  const tAuth = useTranslations('auth')
  const tAdmin = useTranslations('admin')

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-5 border-b border-gray-300 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center shrink-0">
            <Ico name="shield" className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{tAdmin('adminPanel')}</p>
            <p className="text-xs text-gray-500 leading-tight">Talay Workshop</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            label={t(item.labelKey as Parameters<typeof t>[0])}
            active={pathname === item.href || pathname.startsWith(item.href + '/')}
            onClick={onNav}
          />
        ))}
      </nav>

      {/* Back to workshop */}
      <div className="px-3 pb-3">
        <Link
          href="/dashboard"
          onClick={onNav}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <Ico name="arrow" />
          {tAdmin('backToWorkshop')}
        </Link>
      </div>

      {/* User */}
      <div className="border-t border-gray-300 dark:border-gray-800 px-3 py-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-purple-400">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{userName}</p>
            <p className="text-xs text-purple-400">{tAdmin('adminRole')}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            title={tAuth('logout')}
            className="text-gray-400 hover:text-red-400 transition-colors p-1"
          >
            <Ico name="logout" className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── AdminShell ────────────────────────────────────────────────────────────────

export default function AdminShell({
  children,
  userName,
}: {
  children: React.ReactNode
  userName: string
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const tAdmin = useTranslations('admin')

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-60 bg-white dark:bg-gray-900 border-r border-gray-300 dark:border-gray-800 fixed inset-y-0 left-0 z-30">
        <SidebarContent pathname={pathname} userName={userName} />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 w-60 bg-white dark:bg-gray-900 border-r border-gray-300 dark:border-gray-800 z-50 transform transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute top-3 right-3 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white p-1"
        >
          <Ico name="xmark" />
        </button>
        <SidebarContent
          pathname={pathname}
          userName={userName}
          onNav={() => setOpen(false)}
        />
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-20 bg-gray-50/80 dark:bg-gray-950/80 backdrop-blur-xs border-b border-gray-300 dark:border-gray-800 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setOpen(true)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <Ico name="bars" />
          </button>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{tAdmin('adminPanel')}</p>
          <Link href="/dashboard" className="text-gray-500 hover:text-blue-400 transition-colors">
            <Ico name="arrow" />
          </Link>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
