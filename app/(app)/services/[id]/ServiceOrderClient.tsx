'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { PhotoGallery, type Photo } from '@/components/PhotosAndNotes'
import { Modal } from '@/components/ui'
import type {
  FullService, Section, WorkCard, ChecklistItem,
  EquipmentCheckItem, EqItemDef, FeedbackItem, ServiceNote,
  Mechanic, ModalState, ServiceStatus, SnapshotItem,
} from './types'
import { STAGE_ORDER } from './types'
import {
  ServiceDetailHeader,
  WarningBanner,
  WorkCardsSection,
  ChecklistSection,
  DriverFeedbackSection,
  MechanicFeedbackSection,
  ServiceInfoPanel,
  EquipmentCheckCard,
  ServiceNotesPanel,
} from './components'
import {
  IntakeModal,
  CancelServiceModal,
  RescheduleModal,
  AddSectionModal,
  WorkCardModal,
  ServiceHistoryModal,
} from './modals'

// ─── Main component ───────────────────────────────────────────────────────────

export default function ServiceOrderClient({
  initialService, tripSinceLastService, mechanics, userName,
  canReschedule, canCancel, canCreateWorkCard, canCancelWorkCard, canReopenWorkCard, canCompleteWorkCard,
  canCreateNote, canUploadPhoto, equipmentItems, adrEquipmentItems, lastSnapshot,
}: {
  initialService: FullService
  tripSinceLastService?: number | null
  mechanics: Mechanic[]
  userName: string
  canReschedule: boolean; canCancel: boolean
  canCreateWorkCard: boolean; canCancelWorkCard: boolean
  canReopenWorkCard: boolean; canCompleteWorkCard: boolean
  canCreateNote: boolean; canUploadPhoto: boolean
  equipmentItems: EqItemDef[]; adrEquipmentItems: EqItemDef[]
  lastSnapshot: SnapshotItem[]
}) {
  const tService   = useTranslations('service')
  const tSection   = useTranslations('section')
  const tWorkCard  = useTranslations('workCard')
  const tTruck     = useTranslations('truck')
  const tErrors    = useTranslations('errors')
  const tCommon    = useTranslations('common')

  const [service,      setService]      = useState<FullService>(initialService)
  const [modal,        setModal]        = useState<ModalState>(null)
  const [advancing,    setAdvancing]    = useState(false)
  const [advanceError, setAdvanceError] = useState<string | null>(null)
  const [serverWarnings, setServerWarnings] = useState<string[]>([])

  // Work card edit/add modal state
  const [wcModalMode,  setWcModalMode]  = useState<'add' | 'edit'>('add')
  const [wcModalWC,    setWcModalWC]    = useState<WorkCard | undefined>()
  const [wcModalSecId, setWcModalSecId] = useState<number>(0)
  const [showWcModal,  setShowWcModal]  = useState(false)

  // Dismiss warning banner
  const [warningDismissed, setWarningDismissed] = useState(false)

  // SWR-style polling
  const modalRef = useRef(modal)
  useEffect(() => { modalRef.current = modal }, [modal])

  useEffect(() => {
    const id = setInterval(async () => {
      if (modalRef.current) return
      try {
        const res = await fetch(`/api/services/${initialService.id}`)
        if (!res.ok) return
        const json = await res.json()
        if (json.service) setService(json.service)
      } catch { /* ignore */ }
    }, 30_000)
    return () => clearInterval(id)
  }, [initialService.id])

  // ── Computed ───────────────────────────────────────────────────────────────

  const isTerminal = service.status === 'COMPLETED' || service.status === 'CANCELLED'

  const equipmentSection = service.sections.find((s) => s.type === 'EQUIPMENT_CHECK')
  const allWorkCards     = service.sections.flatMap((s) => s.workCards)
  const partsTotal       = allWorkCards
    .flatMap((wc) => wc.parts)
    .reduce((sum, p) => sum + p.quantity * (p.unitCost ?? 0), 0)

  // ── Warnings ───────────────────────────────────────────────────────────────

  const warnings: string[] = []
  if (service.status === 'INTAKE') {
    if (equipmentSection && !equipmentSection.intakeSkippedAt &&
        !service.equipmentCheckItems.some((i) => i.checkType === 'INTAKE')) {
      warnings.push(tService('warn.eqIntakeNotDone'))
    }
  }
  if (service.status === 'IN_PROGRESS') {
    const hasOpenCards = service.sections.some((s) =>
      s.workCards.some((wc) => wc.status === 'PENDING' || wc.status === 'IN_PROGRESS'),
    )
    if (hasOpenCards) warnings.push(tService('warn.openWorkCards'))
    if (equipmentSection && !equipmentSection.exitSkippedAt) {
      if (!service.equipmentCheckItems.some((i) => i.checkType === 'EXIT')) {
        warnings.push(tService('warn.eqExitNotDone'))
      }
      if (service.equipmentCheckItems.some((i) => i.checkType === 'EXIT' && i.status === 'MISSING')) {
        warnings.push(tService('warn.eqExitMissing'))
      }
    }
  }

  // ── Stage advance (two-step: check warnings first, confirm, then force) ───

  async function advanceStage(force = false) {
    setAdvancing(true)
    setAdvanceError(null)
    try {
      const res  = await fetch(`/api/services/${service.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const json = await res.json()
      if (!res.ok) { setAdvanceError(json.error ?? tErrors('genericShort')); return }
      // Server returned warnings — show confirmation modal
      if (json.warnings?.length > 0) {
        setServerWarnings(json.warnings)
        setModal('confirmAdvance')
        return
      }
      setService(json.service as FullService)
      setWarningDismissed(false)
      setServerWarnings([])
    } finally { setAdvancing(false) }
  }

  async function confirmAdvance() {
    setModal(null)
    await advanceStage(true)
  }

  async function regressStage() {
    setAdvancing(true)
    setAdvanceError(null)
    try {
      const res = await fetch(`/api/services/${service.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regress' }),
      })
      const json = await res.json()
      if (!res.ok) { setAdvanceError(json.error ?? tErrors('genericShort')); return }
      setService(json.service as FullService)
    } finally { setAdvancing(false) }
  }

  // ── State mutation helpers ─────────────────────────────────────────────────

  function mergeService(partial: Partial<FullService>) {
    setService((prev) => ({ ...prev, ...partial }))
  }

  function sectionAdded(sec: Section) {
    setService((prev) => ({
      ...prev,
      sections: [...prev.sections, sec].sort((a, b) => a.order - b.order),
    }))
  }

  function checklistItemToggled(secId: number, updated: ChecklistItem) {
    setService((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === secId
          ? { ...s, checklistItems: s.checklistItems.map((i) => (i.id === updated.id ? updated : i)) }
          : s,
      ),
    }))
  }

  function workCardAdded(secId: number, wc: WorkCard) {
    setService((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === secId ? { ...s, workCards: [...s.workCards, wc] } : s,
      ),
    }))
  }

  function workCardUpdated(secId: number, wc: WorkCard) {
    setService((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === secId ? { ...s, workCards: s.workCards.map((w) => (w.id === wc.id ? wc : w)) } : s,
      ),
    }))
  }

  function equipmentCheckSaved(items: EquipmentCheckItem[]) {
    setService((prev) => ({
      ...prev,
      equipmentCheckItems: [
        ...prev.equipmentCheckItems.filter((i) => !items.some((ni) => ni.checkType === i.checkType)),
        ...items,
      ],
    }))
  }

  function equipmentCheckSkipped(phase: 'INTAKE' | 'EXIT', note: string) {
    setService((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.type === 'EQUIPMENT_CHECK'
          ? phase === 'INTAKE'
            ? { ...s, intakeSkippedAt: new Date().toISOString(), intakeSkipNote: note }
            : { ...s, exitSkippedAt:   new Date().toISOString(), exitSkipNote:   note }
          : s,
      ),
    }))
  }

  function feedbackItemAdded(item: FeedbackItem) {
    setService((prev) => ({
      ...prev,
      driverFeedbackItems: [...prev.driverFeedbackItems, item].sort((a, b) => a.order - b.order),
    }))
  }

  function feedbackItemUpdated(item: FeedbackItem) {
    setService((prev) => ({
      ...prev,
      driverFeedbackItems: prev.driverFeedbackItems.map((i) => (i.id === item.id ? item : i)),
    }))
  }

  function feedbackItemDeleted(itemId: number) {
    setService((prev) => ({
      ...prev,
      driverFeedbackItems: prev.driverFeedbackItems.filter((i) => i.id !== itemId),
    }))
  }

  function feedbackNotesSaved(text: string) {
    setService((prev) => ({ ...prev, driverFeedbackNotes: text }))
  }

  function mechFeedbackItemAdded(item: FeedbackItem) {
    setService((prev) => ({
      ...prev,
      mechanicFeedbackItems: [...prev.mechanicFeedbackItems, item].sort((a, b) => a.order - b.order),
    }))
  }

  function mechFeedbackItemUpdated(item: FeedbackItem) {
    setService((prev) => ({
      ...prev,
      mechanicFeedbackItems: prev.mechanicFeedbackItems.map((i) => (i.id === item.id ? item : i)),
    }))
  }

  function mechFeedbackItemDeleted(itemId: number) {
    setService((prev) => ({
      ...prev,
      mechanicFeedbackItems: prev.mechanicFeedbackItems.filter((i) => i.id !== itemId),
    }))
  }

  function mechFeedbackNotesSaved(text: string) {
    setService((prev) => ({ ...prev, mechanicFeedbackNotes: text }))
  }

  // ── Work card modal helpers ────────────────────────────────────────────────

  function openAddWorkCard(sectionId: number) {
    setWcModalMode('add')
    setWcModalWC(undefined)
    setWcModalSecId(sectionId)
    setShowWcModal(true)
  }

  function openEditWorkCard(wc: WorkCard, sectionId: number) {
    setWcModalMode('edit')
    setWcModalWC(wc)
    setWcModalSecId(sectionId)
    setShowWcModal(true)
  }

  // ── Print handler ──────────────────────────────────────────────────────────

  function handlePrint() {
    window.open(`/services/${service.id}/print`, '_blank')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/* Sticky header */}
      <ServiceDetailHeader
        service={service}
        canReschedule={canReschedule}
        canCancel={canCancel}
        warnings={warnings}
        onAdvance={() => advanceStage()}
        onRegress={regressStage}
        onPrint={handlePrint}
        onReschedule={() => setModal('reschedule')}
        onCancel={() => setModal('cancel')}
        onStartIntake={() => setModal('intake')}
      />

      {/* Warning / success banner */}
      {warnings.length > 0 && !warningDismissed && !isTerminal && (
        <WarningBanner
          type="warning"
          title={tService('warnings')}
          description={warnings.join(' · ')}
          onDismiss={() => setWarningDismissed(true)}
        />
      )}
      {service.status === 'READY' && warnings.length === 0 && (
        <WarningBanner
          type="success"
          title={tService('stageGuidance.READY')}
        />
      )}

      {/* Advance error */}
      {advanceError && (
        <div className="mx-6 lg:mx-8 mt-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-300">{advanceError}</p>
        </div>
      )}

      {/* Two-column grid */}
      <div className="px-6 lg:px-8 py-5 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">

        {/* ── Left column ── */}
        <div className="space-y-4">

          {/* Driver + Mechanic Feedback side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DriverFeedbackSection
              service={service}
              onItemAdded={feedbackItemAdded}
              onItemUpdated={feedbackItemUpdated}
              onItemDeleted={feedbackItemDeleted}
              onNotesSaved={feedbackNotesSaved}
            />
            <MechanicFeedbackSection
              service={service}
              onItemAdded={mechFeedbackItemAdded}
              onItemUpdated={mechFeedbackItemUpdated}
              onItemDeleted={mechFeedbackItemDeleted}
              onNotesSaved={mechFeedbackNotesSaved}
            />
          </div>

          {/* Work Cards — only during IN_PROGRESS */}
          {service.status === 'IN_PROGRESS' && (
            <WorkCardsSection
              service={service}
              canCreateWorkCard={canCreateWorkCard}
              canCancelWC={canCancelWorkCard}
              canReopenWC={canReopenWorkCard}
              canCompleteWC={canCompleteWorkCard}
              onAddWorkCard={openAddWorkCard}
              onEditWorkCard={openEditWorkCard}
              onWorkCardUpdated={workCardUpdated}
            />
          )}

          {/* Checklist — only during IN_PROGRESS */}
          {service.status === 'IN_PROGRESS' && (
            <ChecklistSection
              service={service}
              userName={userName}
              onChecklistItemToggled={checklistItemToggled}
            />
          )}

          {/* Photos — below feedback, all stages except SCHEDULED */}
          {service.status !== 'SCHEDULED' && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/80 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700/80">
                <span className="font-semibold text-sm text-gray-800 dark:text-white">
                  {tCommon('notesAndPhotos')}
                </span>
              </div>
              <div className="px-5 py-4">
                <PhotoGallery
                  photos={service.photos}
                  uploadUrl={`/api/services/${service.id}/photos`}
                  deleteUrlFor={(id) => `/api/services/${service.id}/photos/${id}`}
                  canUpload={canUploadPhoto && !isTerminal}
                  onPhotoAdded={(p) => setService((prev) => ({ ...prev, photos: [...prev.photos, p] }))}
                  onPhotoDeleted={(id) => setService((prev) => ({ ...prev, photos: prev.photos.filter((ph) => ph.id !== id) }))}
                />
              </div>
            </div>
          )}

          {/* Add Section button */}
          {!isTerminal && service.status !== 'SCHEDULED' && (
            <button
              onClick={() => setModal('addSection')}
              className="w-full py-3 border border-dashed border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-xl transition-colors"
            >
              + {tSection('addSection')}
            </button>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="space-y-4 lg:order-0 order-first">

          {/* Service Info */}
          <ServiceInfoPanel service={service} partsTotal={partsTotal} />

          {/* Service History — open in modal */}
          {service.status !== 'SCHEDULED' && (
            <button
              onClick={() => setModal('serviceHistory')}
              className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/80 rounded-xl px-5 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <span className="font-semibold text-sm text-gray-800 dark:text-white">{tTruck('serviceHistory')}</span>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Equipment Check — open in modal */}
          {service.status !== 'SCHEDULED' && (
            <button
              onClick={() => setModal('equipmentCheck')}
              className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/80 rounded-xl px-5 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <span className="font-semibold text-sm text-gray-800 dark:text-white">{tCommon('equipmentCheck')}</span>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Service Notes */}
          <ServiceNotesPanel
            serviceId={service.id}
            notes={service.notes}
            canCreateNote={canCreateNote && !isTerminal}
            onNoteAdded={(n) => setService((prev) => ({ ...prev, notes: [...prev.notes, n] }))}
          />
        </div>
      </div>

      {/* ── Modals ── */}
      {modal === 'intake' && (
        <Modal title={tService('intake.title')} onClose={() => setModal(null)}>
          <IntakeModal
            serviceId={service.id}
            truckId={service.truck.id}
            onClose={() => setModal(null)}
            onDone={(svc) => { setService(svc); setModal(null) }}
          />
        </Modal>
      )}
      {modal === 'cancel' && (
        <Modal title={tService('cancelModal.title')} onClose={() => setModal(null)}>
          <CancelServiceModal
            serviceId={service.id}
            onClose={() => setModal(null)}
            onDone={(svc) => mergeService(svc)}
          />
        </Modal>
      )}
      {modal === 'reschedule' && (
        <Modal title={tService('reschedulingOf')} onClose={() => setModal(null)}>
          <RescheduleModal
            serviceId={service.id} currentDate={service.scheduledDate}
            onClose={() => setModal(null)} onDone={(svc) => mergeService(svc)}
          />
        </Modal>
      )}
      {modal === 'equipmentCheck' && (
        <Modal title={tCommon('equipmentCheck')} onClose={() => setModal(null)}>
          <EquipmentCheckCard
            service={service}
            equipmentItems={equipmentItems}
            adrEquipmentItems={adrEquipmentItems}
            lastSnapshot={lastSnapshot}
            onEquipmentSaved={equipmentCheckSaved}
            onEquipmentSkipped={equipmentCheckSkipped}
          />
        </Modal>
      )}
      {modal === 'confirmAdvance' && (
        <Modal title={tService('warnings')} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <ul className="space-y-1.5">
              {serverWarnings.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
                  <span className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {w}
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setModal(null)}
                className="text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={confirmAdvance}
                className="text-sm text-white bg-amber-600 hover:bg-amber-500 px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                {tService('continueAnyway')}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {modal === 'addSection' && (
        <Modal title={tSection('addSection')} onClose={() => setModal(null)}>
          <AddSectionModal
            serviceId={service.id}
            onClose={() => setModal(null)} onAdded={sectionAdded}
          />
        </Modal>
      )}
      {modal === 'serviceHistory' && (
        <Modal title={tTruck('serviceHistory')} onClose={() => setModal(null)} className="max-w-3xl">
          <ServiceHistoryModal truckId={service.truck.id} currentServiceId={service.id} />
        </Modal>
      )}
      {showWcModal && (
        <Modal
          title={wcModalMode === 'add' ? tWorkCard('newTitle') : tWorkCard('editTitle')}
          onClose={() => setShowWcModal(false)}
        >
          <WorkCardModal
            mode={wcModalMode}
            workCard={wcModalWC}
            sectionId={wcModalSecId}
            serviceId={service.id}
            mechanics={mechanics}
            onClose={() => setShowWcModal(false)}
            onSaved={(wc) => {
              if (wcModalMode === 'add') workCardAdded(wcModalSecId, wc)
              else workCardUpdated(wcModalSecId, wc)
              setShowWcModal(false)
            }}
          />
        </Modal>
      )}
    </div>
  )
}
