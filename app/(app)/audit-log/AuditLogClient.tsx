'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

function entityLink(type: string, id: string): string | null {
  switch (type) {
    case 'ServiceOrder': return `/services/${id}`
    case 'Truck':        return `/trucks/${id}`
    case 'User':         return `/users`
    case 'Bay':          return `/bays`
    case 'Mechanic':     return `/mechanics`
    case 'Driver':       return `/drivers`
    default:             return null
  }
}

interface AuditEntry {
  id: number
  userId: number | null
  userNameSnapshot: string
  action: string
  entityType: string
  entityId: string
  oldValue: string | null
  newValue: string | null
  createdAt: string
}

interface LogResult {
  logs: AuditEntry[]
  total: number
  page: number
  pageSize: number
  pages: number
}

function fmtDateTime(iso: string) {
  const d  = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()} ${hh}:${mi}`
}

export default function AuditLogClient() {
  const t      = useTranslations('auditLog')
  const tCommon = useTranslations('common')
  const [data,     setData]     = useState<LogResult | null>(null)
  const [page,     setPage]     = useState(1)
  const [search,   setSearch]   = useState('')
  const [loading,  setLoading]  = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: '50' })
      if (q) params.set('search', q)
      const res  = await fetch(`/api/audit-log?${params}`)
      const json = await res.json()
      if (res.ok) setData(json)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(1, '') }, [load])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    load(1, search)
  }

  function goPage(p: number) {
    setPage(p)
    load(p, search)
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          {data && (
            <p className="text-sm text-gray-500 mt-0.5">
              {t('totalRecords', { count: data.total.toLocaleString() })}
            </p>
          )}
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl transition-colors disabled:opacity-50 border border-gray-200 dark:border-gray-700"
        >
          {tCommon('search')}
        </button>
      </form>

      {/* Log table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
        {loading ? (
          <p className="px-5 py-10 text-sm text-gray-500 text-center">{tCommon('loading')}</p>
        ) : !data || data.logs.length === 0 ? (
          <p className="px-5 py-10 text-sm text-gray-500 text-center">{t('noRecords')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider">{t('timestamp')}</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider">{t('user')}</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider">{t('action')}</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider hidden md:table-cell">{t('entity')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {data.logs.map((entry) => (
                  <>
                    <tr
                      key={entry.id}
                      className="hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                      onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                    >
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                        {fmtDateTime(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{entry.userNameSnapshot}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-sm text-blue-300">
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                        {(() => {
                          const href = entityLink(entry.entityType, entry.entityId)
                          const label = `${entry.entityType} #${entry.entityId}`
                          return href ? (
                            <Link href={href} className="text-blue-400 hover:text-blue-300 hover:underline transition-colors" onClick={(e) => e.stopPropagation()}>
                              {label}
                            </Link>
                          ) : <span>{label}</span>
                        })()}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {(entry.oldValue || entry.newValue) ? (expanded === entry.id ? '▲' : '▼') : ''}
                      </td>
                    </tr>
                    {expanded === entry.id && (entry.oldValue || entry.newValue) && (
                      <tr key={`${entry.id}-detail`} className="bg-gray-100/50 dark:bg-gray-800/30">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            {entry.oldValue && (
                              <div>
                                <p className="text-gray-500 font-semibold mb-1">{t('before')}</p>
                                <pre className="text-gray-500 dark:text-gray-400 whitespace-pre-wrap font-mono bg-white dark:bg-gray-900 p-2 rounded-sm overflow-auto max-h-40">
                                  {(() => { try { return JSON.stringify(JSON.parse(entry.oldValue), null, 2) } catch { return entry.oldValue } })()}
                                </pre>
                              </div>
                            )}
                            {entry.newValue && (
                              <div>
                                <p className="text-gray-500 font-semibold mb-1">{t('after')}</p>
                                <pre className="text-gray-500 dark:text-gray-400 whitespace-pre-wrap font-mono bg-white dark:bg-gray-900 p-2 rounded-sm overflow-auto max-h-40">
                                  {(() => { try { return JSON.stringify(JSON.parse(entry.newValue), null, 2) } catch { return entry.newValue } })()}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <button
            disabled={page <= 1}
            onClick={() => goPage(page - 1)}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg transition-colors disabled:opacity-40"
          >
            ‹
          </button>
          <span className="text-sm text-gray-500 px-3">
            {page} / {data.pages}
          </span>
          <button
            disabled={page >= data.pages}
            onClick={() => goPage(page + 1)}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg transition-colors disabled:opacity-40"
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}
