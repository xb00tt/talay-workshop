'use client'

import { useState } from 'react'
import type { ChecklistItem } from '../types'
import { fmtDateTime } from '../helpers'

export default function ChecklistItemRow({
  item, serviceId, sectionId, disabled, userName,
  onToggled,
}: {
  item: ChecklistItem; serviceId: number; sectionId: number
  disabled: boolean; userName: string
  onToggled: (updated: ChecklistItem) => void
}) {
  const [saving, setSaving] = useState(false)

  async function toggle() {
    if (saving || disabled) return
    const next = !item.isCompleted
    // Optimistic
    onToggled({ ...item, isCompleted: next, completedByName: next ? userName : null, completedAt: next ? new Date().toISOString() : null })
    setSaving(true)
    try {
      const res  = await fetch(`/api/services/${serviceId}/sections/${sectionId}/checklist-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: next }),
      })
      const json = await res.json()
      if (!res.ok) {
        // Revert
        onToggled({ ...item, isCompleted: item.isCompleted, completedByName: item.completedByName, completedAt: item.completedAt })
      } else {
        onToggled({
          ...item,
          isCompleted:     json.item.isCompleted,
          completedByName: json.item.completedByName,
          completedAt:     json.item.completedAt,
        })
      }
    } catch {
      onToggled({ ...item })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-300 dark:border-gray-800 last:border-0">
      <button
        onClick={toggle}
        disabled={disabled || saving}
        className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          item.isCompleted
            ? 'bg-green-500 border-green-500'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
        } disabled:opacity-50`}
      >
        {item.isCompleted && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${item.isCompleted ? 'line-through text-gray-500' : 'text-gray-900 dark:text-white'}`}>
          {item.description}
        </p>
        {item.isCompleted && item.completedByName && (
          <p className="text-xs text-gray-600 mt-0.5">
            {item.completedByName}{item.completedAt ? ` · ${fmtDateTime(item.completedAt)}` : ''}
          </p>
        )}
      </div>
    </div>
  )
}
