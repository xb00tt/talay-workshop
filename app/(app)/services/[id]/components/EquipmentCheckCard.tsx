'use client'

import { useTranslations } from 'next-intl'
import type { FullService, EquipmentCheckItem, EqItemDef, SnapshotItem } from '../types'
import EquipmentCheckPanel from './EquipmentCheckPanel'

export default function EquipmentCheckCard({
  service,
  equipmentItems,
  adrEquipmentItems,
  lastSnapshot,
  onEquipmentSaved,
  onEquipmentSkipped,
}: {
  service: FullService
  equipmentItems: EqItemDef[]
  adrEquipmentItems: EqItemDef[]
  lastSnapshot: SnapshotItem[]
  onEquipmentSaved: (items: EquipmentCheckItem[]) => void
  onEquipmentSkipped: (phase: 'INTAKE' | 'EXIT', note: string) => void
}) {
  const tEquipment = useTranslations('equipment')

  const eqSection = service.sections.find((s) => s.type === 'EQUIPMENT_CHECK')
  if (!eqSection) return null

  const isTerminal = service.status === 'COMPLETED' || service.status === 'CANCELLED'
  const activePhase: 'INTAKE' | 'EXIT' = service.status === 'INTAKE' ? 'INTAKE' : 'EXIT'

  const allItemDefs = service.truck.isAdr
    ? [...equipmentItems, ...adrEquipmentItems]
    : equipmentItems

  const intakeItems = service.equipmentCheckItems.filter((i) => i.checkType === 'INTAKE')

  if (isTerminal) {
    // Show both phases read-only, stacked
    return (
      <div className="space-y-4">
        <EquipmentCheckPanel
          serviceId={service.id}
          sectionId={eqSection.id}
          phase="INTAKE"
          itemDefs={allItemDefs}
          existingItems={service.equipmentCheckItems}
          isSkipped={!!eqSection.intakeSkippedAt}
          skipNote={eqSection.intakeSkipNote}
          isTerminal
          lastSnapshot={lastSnapshot}
          onSaved={onEquipmentSaved}
          onSkipped={(note) => onEquipmentSkipped('INTAKE', note)}
        />
        <div className="border-t border-gray-200 dark:border-gray-700" />
        <EquipmentCheckPanel
          serviceId={service.id}
          sectionId={eqSection.id}
          phase="EXIT"
          itemDefs={allItemDefs}
          existingItems={service.equipmentCheckItems}
          isSkipped={!!eqSection.exitSkippedAt}
          skipNote={eqSection.exitSkipNote}
          isTerminal
          lastSnapshot={lastSnapshot}
          onSaved={onEquipmentSaved}
          onSkipped={(note) => onEquipmentSkipped('EXIT', note)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Active phase — editable */}
      <EquipmentCheckPanel
        serviceId={service.id}
        sectionId={eqSection.id}
        phase={activePhase}
        itemDefs={allItemDefs}
        existingItems={service.equipmentCheckItems}
        isSkipped={activePhase === 'INTAKE' ? !!eqSection.intakeSkippedAt : !!eqSection.exitSkippedAt}
        skipNote={activePhase === 'INTAKE' ? eqSection.intakeSkipNote : eqSection.exitSkipNote}
        isTerminal={false}
        lastSnapshot={lastSnapshot}
        onSaved={onEquipmentSaved}
        onSkipped={(note) => onEquipmentSkipped(activePhase, note)}
      />

      {/* If on EXIT phase, show completed intake summary below */}
      {activePhase === 'EXIT' && (intakeItems.length > 0 || eqSection.intakeSkippedAt) && (
        <>
          <div className="border-t border-gray-200 dark:border-gray-700" />
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">
              {tEquipment('intakeCheck')}
            </p>
            {eqSection.intakeSkippedAt ? (
              <p className="text-sm text-amber-400">
                {tEquipment('skippedPhase', { phase: tEquipment('intakeCheck').toLowerCase() })}
              </p>
            ) : (
              <ul className="space-y-1">
                {intakeItems.map((item) => (
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
        </>
      )}
    </div>
  )
}
