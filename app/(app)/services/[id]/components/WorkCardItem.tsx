'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { WC_STATUS_COLOR } from '@/lib/status-config'
import type { WorkCard } from '../types'
import SmallBtn from './SmallBtn'

export default function WorkCardItem({
  wc, serviceId, sectionId, canCancelWC, canReopenWC, canCompleteWC, serviceTerminal,
  onUpdated, onEdit,
}: {
  wc: WorkCard; serviceId: number; sectionId: number
  canCancelWC: boolean; canReopenWC: boolean; canCompleteWC: boolean; serviceTerminal: boolean
  onUpdated: (wc: WorkCard) => void; onEdit: () => void
}) {
  const tWorkCard = useTranslations('workCard')
  const tCommon   = useTranslations('common')

  const [loading, setLoading] = useState(false)

  async function changeStatus(status: string) {
    setLoading(true)
    try {
      const res  = await fetch(`/api/services/${serviceId}/sections/${sectionId}/work-cards/${wc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (res.ok) onUpdated(json.workCard)
    } finally { setLoading(false) }
  }

  const partsTotal = wc.parts.reduce((sum, p) => sum + p.quantity * (p.unitCost ?? 0), 0)

  return (
    <div className="py-3 border-b border-gray-300 dark:border-gray-800 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 dark:text-white">{wc.description}</p>
          {wc.mechanicName && (
            <p className="text-xs text-gray-500 mt-0.5">{wc.mechanicName}</p>
          )}
          {wc.specialInstructions && (
            <p className="text-xs text-gray-600 italic mt-1">{wc.specialInstructions}</p>
          )}
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${WC_STATUS_COLOR[wc.status]} shrink-0`}>
          {tWorkCard(`status.${wc.status}`)}
        </span>
      </div>

      {/* Inline parts table */}
      {wc.parts.length > 0 && (
        <div className="mt-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 dark:text-gray-400">
                <th className="text-left font-medium pb-1">{tWorkCard('parts')}</th>
                <th className="text-right font-medium pb-1 w-16">{tWorkCard('qty')}</th>
                <th className="text-right font-medium pb-1 w-20">{tWorkCard('cost')}</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 dark:text-gray-300">
              {wc.parts.map((p) => (
                <tr key={p.id} className="border-t border-gray-200 dark:border-gray-700/50">
                  <td className="py-1">
                    {p.name}
                    {p.partNumber && <span className="text-gray-400 ml-1">#{p.partNumber}</span>}
                  </td>
                  <td className="text-right py-1">{p.quantity}</td>
                  <td className="text-right py-1">{p.unitCost != null ? `€${(p.quantity * p.unitCost).toFixed(2)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
            {partsTotal > 0 && (
              <tfoot>
                <tr className="border-t border-gray-300 dark:border-gray-600 font-medium text-gray-900 dark:text-white">
                  <td className="pt-1" colSpan={2}>{tWorkCard('total')}</td>
                  <td className="text-right pt-1">€{partsTotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Inline notes */}
      {wc.notes.length > 0 && (
        <div className="mt-2 space-y-1">
          {wc.notes.map((n) => (
            <p key={n.id} className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium text-gray-600 dark:text-gray-300">{n.userNameSnapshot}:</span>{' '}
              {n.content}
            </p>
          ))}
        </div>
      )}

      {!serviceTerminal && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <SmallBtn onClick={onEdit}>{tCommon('edit')}</SmallBtn>
          <Link
            href={`/services/${serviceId}/work-cards/${wc.id}`}
            className="px-2.5 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          >
            {tWorkCard('details')}
          </Link>
          {wc.status !== 'CANCELLED' && wc.status !== 'COMPLETED' && canCancelWC && (
            <SmallBtn variant="danger" onClick={() => changeStatus('CANCELLED')} disabled={loading}>
              {tWorkCard('cancel')}
            </SmallBtn>
          )}
          {wc.status === 'CANCELLED' && canReopenWC && (
            <SmallBtn variant="primary" onClick={() => changeStatus('REOPEN')} disabled={loading}>
              {tWorkCard('reopen')}
            </SmallBtn>
          )}
          {wc.status !== 'CANCELLED' && wc.status !== 'COMPLETED' && canCompleteWC && (
            <SmallBtn variant="success" onClick={() => changeStatus('COMPLETED')} disabled={loading}>
              {tWorkCard('complete')}
            </SmallBtn>
          )}
        </div>
      )}
    </div>
  )
}
