'use client'

import { useTranslations } from 'next-intl'
import type { FullService, FeedbackItem } from '../types'
import DriverFeedbackPanel from '../DriverFeedbackPanel'

export default function MechanicFeedbackSection({
  service,
  onItemAdded,
  onItemUpdated,
  onItemDeleted,
  onNotesSaved,
}: {
  service: FullService
  onItemAdded: (item: FeedbackItem) => void
  onItemUpdated: (item: FeedbackItem) => void
  onItemDeleted: (itemId: number) => void
  onNotesSaved: (text: string) => void
}) {
  const tService = useTranslations('service')

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/80 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700/80">
        <span className="font-semibold text-sm text-gray-800 dark:text-white">{tService('mechanicFeedback')}</span>
      </div>
      <div className="px-5 py-3">
        <DriverFeedbackPanel
          serviceId={service.id}
          items={service.mechanicFeedbackItems}
          feedbackNotes={service.mechanicFeedbackNotes}
          itemsApiPath="mechanic-feedback-items"
          notesField="mechanicFeedbackNotes"
          onItemAdded={onItemAdded}
          onItemUpdated={onItemUpdated}
          onItemDeleted={onItemDeleted}
          onNotesSaved={onNotesSaved}
        />
      </div>
    </div>
  )
}
