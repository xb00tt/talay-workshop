'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { EquipmentCheckItem, EqItemDef, SnapshotItem } from '../types'

type EqStatus = 'PRESENT' | 'MISSING' | 'RESTOCKED'

export default function EquipmentCheckPanel({
  serviceId, sectionId, phase, itemDefs, existingItems,
  isSkipped, skipNote, isTerminal, lastSnapshot,
  onSaved, onSkipped,
}: {
  serviceId: number; sectionId: number; phase: 'INTAKE' | 'EXIT'
  itemDefs: EqItemDef[]; existingItems: EquipmentCheckItem[]
  isSkipped: boolean; skipNote: string | null; isTerminal: boolean
  lastSnapshot: SnapshotItem[]
  onSaved: (items: EquipmentCheckItem[]) => void
  onSkipped: (note: string) => void
}) {
  const tEquipment = useTranslations('equipment')
  const tCommon    = useTranslations('common')
  const tErrors    = useTranslations('errors')

  type RowState = { status: EqStatus; explanation: string }

  const isFirstVisit = lastSnapshot.length === 0 && phase === 'INTAKE'

  function initRows(): Record<string, RowState> {
    const map: Record<string, RowState> = {}
    const snapshotByName = new Map(lastSnapshot.map((s) => [s.itemName, s.status]))
    for (const def of itemDefs) {
      const existing = existingItems.find((i) => i.itemName === def.name && i.checkType === phase)
      if (existing) {
        map[def.name] = { status: existing.status, explanation: existing.explanation ?? '' }
      } else if (isFirstVisit) {
        // First visit: default unchecked (MISSING) — user checks to mark as equipped (PRESENT)
        map[def.name] = { status: 'MISSING', explanation: '' }
      } else {
        // Returning truck: default to MISSING if previously missing, else PRESENT
        const prevStatus = snapshotByName.get(def.name)
        map[def.name] = { status: prevStatus === 'MISSING' ? 'MISSING' : 'PRESENT', explanation: '' }
      }
    }
    return map
  }

  const [rows,       setRows]       = useState<Record<string, RowState>>(initRows)
  const [saving,     setSaving]     = useState(false)
  const [skipping,   setSkipping]   = useState(false)
  const [skipInput,  setSkipInput]  = useState('')
  const [showSkip,   setShowSkip]   = useState(false)
  const [error,      setError]      = useState('')

  function setRow(name: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } }))
  }

  async function save() {
    setSaving(true); setError('')
    try {
      const items = itemDefs.map((def) => ({
        itemName:    def.name,
        status:      rows[def.name].status,
        explanation: rows[def.name].explanation || undefined,
      }))
      const res  = await fetch(`/api/services/${serviceId}/equipment-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkType: phase, items }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tErrors('genericShort')); return }
      onSaved(json.items as EquipmentCheckItem[])
    } catch { setError(tCommon('connectionFailed')) }
    finally { setSaving(false) }
  }

  async function skip() {
    setSkipping(true); setError('')
    try {
      const res  = await fetch(`/api/services/${serviceId}/equipment-check/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase, note: skipInput || undefined }),
      })
      if (!res.ok) { const j = await res.json(); setError(j.error ?? tErrors('genericShort')); return }
      const phaseLabel = phase === 'INTAKE' ? tEquipment('intakeCheck') : tEquipment('exitCheck')
      onSkipped(skipInput || `${tEquipment('skip')} (${phaseLabel})`)
      setShowSkip(false)
    } catch { setError(tCommon('connectionFailed')) }
    finally { setSkipping(false) }
  }

  const phaseLabel = phase === 'INTAKE' ? tEquipment('intakeCheck') : tEquipment('exitCheck')

  if (isSkipped) {
    return (
      <div className="py-3">
        <p className="text-sm text-amber-400">
          {tEquipment('skippedPhase', { phase: phaseLabel.toLowerCase() })}
        </p>
        {skipNote && <p className="text-xs text-gray-500 mt-0.5">{skipNote}</p>}
        {existingItems.filter((i) => i.checkType === phase).length > 0 && (
          <ul className="mt-3 space-y-1">
            {existingItems.filter((i) => i.checkType === phase).map((item) => (
              <li key={item.id} className="flex items-start gap-2 text-sm">
                <span className={
                  item.status === 'PRESENT'   ? 'text-green-400' :
                  item.status === 'MISSING'   ? 'text-red-400' : 'text-amber-400'
                }>
                  {item.status === 'PRESENT' ? '✓' : item.status === 'MISSING' ? '✗' : '↻'}
                </span>
                <span className="text-gray-600 dark:text-gray-300">{item.itemName}</span>
                {item.explanation && <span className="text-gray-500 dark:text-gray-600">— {item.explanation}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  if (isTerminal) {
    const saved = existingItems.filter((i) => i.checkType === phase)
    return saved.length === 0 ? (
      <p className="py-3 text-sm text-gray-500 dark:text-gray-600">{tEquipment('notChecked')}</p>
    ) : (
      <ul className="py-3 space-y-1">
        {saved.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-sm">
            <span className={
              item.status === 'PRESENT'   ? 'text-green-400' :
              item.status === 'MISSING'   ? 'text-red-400' : 'text-amber-400'
            }>
              {item.status === 'PRESENT' ? '✓' : item.status === 'MISSING' ? '✗' : '↻'}
            </span>
            <span className="text-gray-600 dark:text-gray-300">{item.itemName}</span>
            {item.explanation && <span className="text-gray-500 dark:text-gray-600">— {item.explanation}</span>}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="py-3 space-y-3">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
        {isFirstVisit ? tEquipment('firstVisitLabel') : phaseLabel}
      </p>

      {itemDefs.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-600">{tEquipment('noItemsDefined')}</p>
      ) : isFirstVisit ? (
        /* ── First visit: checkbox list ── */
        <div className="space-y-1">
          {itemDefs.map((def) => {
            const row = rows[def.name] ?? { status: 'MISSING' as EqStatus, explanation: '' }
            const isEquipped = row.status === 'PRESENT'
            return (
              <label
                key={def.id}
                className="flex items-center gap-3 rounded-lg bg-gray-100/50 dark:bg-gray-800/50 px-3 py-2.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isEquipped}
                  onChange={() => setRow(def.name, { status: isEquipped ? 'MISSING' : 'PRESENT' })}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-green-600 focus:ring-green-500 dark:bg-gray-700"
                />
                <span className={`flex-1 text-sm ${isEquipped ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>
                  {def.name}
                </span>
                {isEquipped && (
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                    {tEquipment('equipped')}
                  </span>
                )}
              </label>
            )
          })}
        </div>
      ) : (
        /* ── Returning truck: chip buttons with snapshot-based sorting ── */
        (() => {
          const previouslyMissing = new Set(
            lastSnapshot
              .filter((s) => s.status === 'MISSING' || s.status === 'RESTOCKED')
              .map((s) => s.itemName),
          )
          const flaggedDefs = itemDefs.filter((d) => previouslyMissing.has(d.name))
          const normalDefs  = itemDefs.filter((d) => !previouslyMissing.has(d.name))

          function renderRow(def: EqItemDef) {
            const row = rows[def.name] ?? { status: 'PRESENT' as EqStatus, explanation: '' }
            return (
              <div key={def.id} className="rounded-lg bg-gray-100/50 dark:bg-gray-800/50 px-3 py-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 min-w-0">{def.name}</span>
                  <div className="flex gap-1.5 text-xs">
                    {(phase === 'EXIT' || previouslyMissing.has(def.name)
                      ? ['PRESENT', 'MISSING', 'RESTOCKED'] as const
                      : ['PRESENT', 'MISSING'] as const
                    ).map((s) => {
                      const isActive = row.status === s
                      const colorMap = {
                        PRESENT: isActive
                          ? 'border-green-500 bg-green-500/15 text-green-700 dark:text-green-400'
                          : 'border-gray-300 text-gray-500 hover:border-green-400 dark:border-gray-600 dark:text-gray-500 dark:hover:border-green-500',
                        MISSING: isActive
                          ? 'border-red-500 bg-red-500/15 text-red-700 dark:text-red-400'
                          : 'border-gray-300 text-gray-500 hover:border-red-400 dark:border-gray-600 dark:text-gray-500 dark:hover:border-red-500',
                        RESTOCKED: isActive
                          ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-400'
                          : 'border-gray-300 text-gray-500 hover:border-amber-400 dark:border-gray-600 dark:text-gray-500 dark:hover:border-amber-500',
                      }
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setRow(def.name, { status: s })}
                          className={`rounded-full border px-2.5 py-0.5 font-medium transition-colors ${colorMap[s]}`}
                        >
                          {tEquipment(`status.${s}`)}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {row.status !== 'PRESENT' && (
                  <input
                    value={row.explanation}
                    onChange={(e) => setRow(def.name, { explanation: e.target.value })}
                    placeholder={tEquipment('notePlaceholder')}
                    className="mt-1.5 w-full bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-sm px-2 py-1 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                )}
              </div>
            )
          }

          return (
            <div className="space-y-2">
              {flaggedDefs.length > 0 && (
                <>
                  <p className="text-xs font-medium text-amber-600/80 dark:text-amber-400/70">
                    {tEquipment('previouslyMissing')}
                  </p>
                  {flaggedDefs.map(renderRow)}
                  <div className="my-1 border-t-2 border-dashed border-amber-300/60 dark:border-amber-500/30" />
                </>
              )}
              {normalDefs.map(renderRow)}
            </div>
          )
        })()
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={save}
          disabled={saving || itemDefs.length === 0}
          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? tCommon('saving') : tEquipment('saveCheck')}
        </button>
        {!showSkip && (
          <button
            onClick={() => setShowSkip(true)}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            {tEquipment('skip')}
          </button>
        )}
      </div>

      {showSkip && (
        <div className="space-y-2">
          <input
            value={skipInput}
            onChange={(e) => setSkipInput(e.target.value)}
            placeholder={tEquipment('skipNote')}
            className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowSkip(false)}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              {tCommon('cancel')}
            </button>
            <button
              onClick={skip}
              disabled={skipping}
              className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {skipping ? tEquipment('skipping') : tEquipment('confirmSkip')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
