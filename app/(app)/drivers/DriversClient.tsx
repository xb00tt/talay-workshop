'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface Driver {
  id: number
  name: string
  frotcomDriverId: string | null
  isActive: boolean
}

export default function DriversClient({
  initialDrivers,
  isManager,
}: {
  initialDrivers: Driver[]
  isManager: boolean
}) {
  const t       = useTranslations('driver')
  const tCommon = useTranslations('common')
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers)
  const [toggling, setToggling] = useState<number | null>(null)

  async function toggleActive(driver: Driver) {
    setToggling(driver.id)
    try {
      const res  = await fetch(`/api/drivers/${driver.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ isActive: !driver.isActive }),
      })
      const json = await res.json()
      if (res.ok) {
        setDrivers((prev) => prev.map((d) => d.id === driver.id ? json.driver : d))
      }
    } finally {
      setToggling(null)
    }
  }

  const active   = drivers.filter((d) => d.isActive)
  const inactive = drivers.filter((d) => !d.isActive)

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('list')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('subtitle')}</p>
      </div>

      {drivers.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl">
          <p className="px-5 py-12 text-center text-gray-500">{t('empty')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {active.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {tCommon('active')} ({active.length})
                </h2>
              </div>
              <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                {active.map((d) => (
                  <li key={d.id} className="flex items-center justify-between px-5 py-3 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{d.name}</p>
                      {d.frotcomDriverId && (
                        <p className="text-xs text-gray-300 dark:text-gray-600 mt-0.5">{t('frotcomId')}: {d.frotcomDriverId}</p>
                      )}
                    </div>
                    {isManager && (
                      <button
                        onClick={() => toggleActive(d)}
                        disabled={toggling === d.id}
                        className="shrink-0 px-3 py-1.5 text-xs rounded-lg border border-red-800/50 text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                      >
                        {toggling === d.id ? '...' : tCommon('deactivate')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {inactive.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-xs font-semibold text-gray-300 dark:text-gray-600 uppercase tracking-wider">
                  {tCommon('inactive')} ({inactive.length})
                </h2>
              </div>
              <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                {inactive.map((d) => (
                  <li key={d.id} className="flex items-center justify-between px-5 py-3 gap-4">
                    <p className="text-sm text-gray-500 truncate">{d.name}</p>
                    {isManager && (
                      <button
                        onClick={() => toggleActive(d)}
                        disabled={toggling === d.id}
                        className="shrink-0 px-3 py-1.5 text-xs rounded-lg border border-green-800/50 text-green-400 hover:bg-green-400/10 transition-colors disabled:opacity-50"
                      >
                        {toggling === d.id ? '...' : tCommon('activate')}
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
  )
}
