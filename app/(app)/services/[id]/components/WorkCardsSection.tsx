'use client'

import { useTranslations } from 'next-intl'
import type { FullService, WorkCard, Section } from '../types'
import WorkCardItem from './WorkCardItem'

interface WorkCardsSectionProps {
  service: FullService
  canCreateWorkCard: boolean
  canCancelWC: boolean
  canReopenWC: boolean
  canCompleteWC: boolean
  onAddWorkCard: (sectionId: number) => void
  onEditWorkCard: (wc: WorkCard, sectionId: number) => void
  onWorkCardUpdated: (sectionId: number, wc: WorkCard) => void
}

const WORK_CARD_SECTION_TYPES = new Set(['DRIVER_FEEDBACK', 'MID_SERVICE', 'CUSTOM'])

export default function WorkCardsSection({
  service,
  canCreateWorkCard,
  canCancelWC,
  canReopenWC,
  canCompleteWC,
  onAddWorkCard,
  onEditWorkCard,
  onWorkCardUpdated,
}: WorkCardsSectionProps) {
  const tWorkCard = useTranslations('workCard')

  const isTerminal = service.status === 'COMPLETED' || service.status === 'CANCELLED'

  const workCardSections = service.sections.filter(
    (s) => WORK_CARD_SECTION_TYPES.has(s.type)
  )

  const allWorkCards = workCardSections.flatMap((s) => s.workCards)

  const hasPending = allWorkCards.some(
    (wc) => wc.status === 'PENDING' || wc.status === 'IN_PROGRESS'
  )

  const defaultSectionId = workCardSections[0]?.id

  // SCHEDULED empty state
  if (service.status === 'SCHEDULED') {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/80 rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-gray-700 dark:text-gray-200 text-sm">{tWorkCard('scheduledEmpty')}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{tWorkCard('scheduledEmptyDesc')}</p>
        </div>
      </div>
    )
  }

  const showSectionHeaders = workCardSections.length > 1

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/80 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-gray-800 dark:text-white">{tWorkCard('title')}</span>
          {hasPending && <span className="w-2 h-2 rounded-full bg-amber-400" />}
        </div>
        {canCreateWorkCard && !isTerminal && defaultSectionId != null && (
          <button
            onClick={() => onAddWorkCard(defaultSectionId)}
            className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {tWorkCard('addBtn')}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {allWorkCards.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
            {tWorkCard('noWorkCards')}
          </div>
        ) : (
          workCardSections.map((section) => {
            if (section.workCards.length === 0) return null
            return (
              <div key={section.id}>
                {showSectionHeaders && (
                  <div className="px-5 pt-3 pb-1">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {section.title}
                    </p>
                  </div>
                )}
                {section.workCards.map((wc) => (
                  <div key={wc.id} className="px-5">
                    <WorkCardItem
                      wc={wc}
                      serviceId={service.id}
                      sectionId={section.id}
                      canCancelWC={canCancelWC}
                      canReopenWC={canReopenWC}
                      canCompleteWC={canCompleteWC}
                      serviceTerminal={isTerminal}
                      onUpdated={(updated) => onWorkCardUpdated(section.id, updated)}
                      onEdit={() => onEditWorkCard(wc, section.id)}
                    />
                  </div>
                ))}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
