'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { SERVICE_STATUS_COLOR } from '@/lib/status-config'
import type { ServiceStatus } from '../types'

// ── Types ────────────────────────────────────────────────────────────────────

interface HistoryPart { name: string; quantity: number; unitCost: number | null }
interface HistoryWorkCard { id: number; description: string; mechanicName: string | null; parts: HistoryPart[] }
interface HistoryService {
  id: number; status: ServiceStatus; scheduledDate: string
  mileageAtService: number | null; driverNameSnapshot: string | null
  cancellationReason: string | null; partsCost: number; workCards: HistoryWorkCard[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getUTCFullYear()}`
}

function fmtKm(km: number) {
  return `${Math.round(km).toLocaleString('bg-BG')} км`
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ServiceHistoryModal({
  truckId, currentServiceId,
}: {
  truckId: number; currentServiceId: number
}) {
  const tService = useTranslations('service')
  const tTruck   = useTranslations('truck')
  const tCommon  = useTranslations('common')

  const [services, setServices] = useState<HistoryService[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetch(`/api/trucks/${truckId}/service-history?exclude=${currentServiceId}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Error')
        setServices(json.services)
      })
      .catch(() => setError(tCommon('connectionFailed')))
      .finally(() => setLoading(false))
  }, [truckId, currentServiceId, tCommon])

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-500 py-6 text-center">{error}</p>
  }

  if (services.length === 0) {
    return <p className="text-sm text-gray-500 py-10 text-center">{tTruck('noServiceOrders')}</p>
  }

  return (
    <ul className="divide-y divide-gray-200 dark:divide-gray-800 -mx-6">
      {services.map((svc) => {
        const isExpanded = expanded.has(svc.id)
        const hasDetails = svc.workCards.length > 0

        return (
          <li key={svc.id}>
            {/* Summary row */}
            <button
              type="button"
              onClick={() => hasDetails && toggle(svc.id)}
              className={`w-full text-left px-6 py-3.5 flex items-start justify-between gap-4 transition-colors ${
                hasDetails ? 'hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer' : 'cursor-default'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {/* Chevron */}
                  {hasDetails && (
                    <svg
                      className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                  {!hasDetails && <span className="w-3.5 shrink-0" />}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${SERVICE_STATUS_COLOR[svc.status]}`}>
                    {tService(`status.${svc.status}` as any)}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-300">{fmtDate(svc.scheduledDate)}</span>
                </div>
                {svc.driverNameSnapshot && (
                  <p className="text-xs text-gray-500 ml-5.5 pl-px">{tService('driver')}: {svc.driverNameSnapshot}</p>
                )}
                {svc.workCards.length > 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5 ml-5.5 pl-px">
                    {tTruck('completedWorkCards', { count: svc.workCards.length })}
                  </p>
                )}
                {svc.cancellationReason && (
                  <p className="text-xs text-red-500 mt-0.5 ml-5.5 pl-px">{tTruck('cancelledNote')} {svc.cancellationReason}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                {svc.mileageAtService != null && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 tabular-nums">{fmtKm(svc.mileageAtService)}</p>
                )}
                {svc.partsCost > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">{svc.partsCost.toFixed(2)} €</p>
                )}
              </div>
            </button>

            {/* Expanded detail */}
            {isExpanded && svc.workCards.length > 0 && (
              <div className="px-6 pb-4 pl-12">
                <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg px-4 py-3 space-y-3">
                  {svc.workCards.map((wc) => (
                    <div key={wc.id}>
                      <p className="text-sm text-gray-700 dark:text-gray-200">
                        {wc.description}
                        {wc.mechanicName && (
                          <span className="text-gray-400 dark:text-gray-500"> — {wc.mechanicName}</span>
                        )}
                      </p>
                      {wc.parts.length > 0 && (
                        <ul className="mt-1 ml-4 space-y-0.5">
                          {wc.parts.map((p, i) => (
                            <li key={i} className="text-xs text-gray-500 dark:text-gray-400">
                              {p.name} ×{p.quantity}
                              {p.unitCost != null && (
                                <span className="text-gray-400 dark:text-gray-500"> ({(p.unitCost * p.quantity).toFixed(2)} €)</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
                <a
                  href={`/services/${svc.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-blue-500 hover:text-blue-400 transition-colors"
                >
                  {tService('openFullOrder')} →
                </a>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
