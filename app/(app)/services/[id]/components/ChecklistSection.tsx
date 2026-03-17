'use client'

import { useTranslations } from 'next-intl'
import type { FullService, ChecklistItem } from '../types'
import ChecklistItemRow from './ChecklistItemRow'

export default function ChecklistSection({
  service,
  userName,
  onChecklistItemToggled,
}: {
  service: FullService
  userName: string
  onChecklistItemToggled: (sectionId: number, updated: ChecklistItem) => void
}) {
  const tSection = useTranslations('section')

  const section = service.sections.find(s => s.type === 'CHECKLIST')
  if (!section) return null

  const completed = section.checklistItems.filter(i => i.isCompleted).length
  const total = section.checklistItems.length
  const isTerminal = service.status === 'COMPLETED' || service.status === 'CANCELLED'

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/80 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700/80 flex items-center gap-3">
        <span className="font-semibold text-sm text-gray-800 dark:text-white">
          {tSection('type.CHECKLIST')}
        </span>
        <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20">
          {completed} / {total}
        </span>
      </div>

      <div className="px-5 py-2">
        {section.checklistItems.map(item => (
          <ChecklistItemRow
            key={item.id}
            item={item}
            serviceId={service.id}
            sectionId={section.id}
            disabled={isTerminal}
            userName={userName}
            onToggled={(updated) => onChecklistItemToggled(section.id, updated)}
          />
        ))}
      </div>
    </div>
  )
}
