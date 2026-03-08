'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { PhotoGallery, NotesSection, type Photo, type NoteItem } from '@/components/PhotosAndNotes'

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceStatus   = 'SCHEDULED' | 'INTAKE' | 'IN_PROGRESS' | 'QUALITY_CHECK' | 'READY' | 'COMPLETED' | 'CANCELLED'
type SectionType     = 'CHECKLIST' | 'DRIVER_FEEDBACK' | 'MID_SERVICE' | 'EQUIPMENT_CHECK' | 'CUSTOM'
type WorkCardStatus  = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

interface ChecklistItem {
  id: number; description: string; isCompleted: boolean
  completedAt: string | null; completedByName: string | null
}
interface WCNote  { id: number; content: string; userNameSnapshot: string; createdAt: string }
interface WCPhoto { id: number; caption: string | null; filePath: string; createdAt: string }
interface Part    { id: number; name: string; partNumber: string | null; quantity: number; unitCost: number | null }
interface WorkCard {
  id: number; description: string; mechanicId: number | null; mechanicName: string | null
  status: WorkCardStatus; specialInstructions: string | null
  cancelledAt: string | null; reopenedAt: string | null
  mechanic: { id: number; name: string } | null
  parts: Part[]; notes: WCNote[]; photos: WCPhoto[]
}
interface Section {
  id: number; type: SectionType; title: string; order: number
  intakeSkippedAt: string | null; intakeSkipNote: string | null
  exitSkippedAt:   string | null; exitSkipNote:   string | null
  checklistItems: ChecklistItem[]; workCards: WorkCard[]
}
interface FeedbackItem { id: number; description: string; order: number }
interface EquipmentCheckItem { id: number; itemName: string; status: 'PRESENT' | 'MISSING' | 'RESTOCKED'; explanation: string | null; checkType: 'INTAKE' | 'EXIT' }
interface EqItemDef { id: number; name: string; description: string | null }
interface ServiceNote  { id: number; content: string; userNameSnapshot: string; createdAt: string }
interface FullService {
  id: number; truckPlateSnapshot: string; status: ServiceStatus
  scheduledDate: string; startDate: string | null; endDate: string | null
  mileageAtService: number | null; bayId: number | null; bayNameSnapshot: string | null
  driverId: number | null; driverNameSnapshot: string | null
  driverFeedbackNotes: string | null; cancellationReason: string | null; createdAt: string
  truck: { id: number; make: string; model: string; year: number | null; isAdr: boolean; frotcomVehicleId: string | null }
  bay: { id: number; name: string } | null
  driver: { id: number; name: string } | null
  sections: Section[]
  equipmentCheckItems: EquipmentCheckItem[]
  driverFeedbackItems: FeedbackItem[]
  notes: ServiceNote[]
  photos: Photo[]
}
interface Bay      { id: number; name: string }
interface Driver   { id: number; name: string }
interface Mechanic { id: number; name: string }

// ─── Config ───────────────────────────────────────────────────────────────────

const SVC_COLOR: Record<ServiceStatus, string> = {
  SCHEDULED:     'bg-amber-600/20 text-amber-400',
  INTAKE:        'bg-blue-600/20 text-blue-400',
  IN_PROGRESS:   'bg-indigo-600/20 text-indigo-400',
  QUALITY_CHECK: 'bg-purple-600/20 text-purple-400',
  READY:         'bg-green-600/20 text-green-400',
  COMPLETED:     'bg-gray-600/20 text-gray-400',
  CANCELLED:     'bg-red-600/20 text-red-400',
}
const WC_COLOR: Record<WorkCardStatus, string> = {
  PENDING:     'bg-gray-600/20 text-gray-400',
  ASSIGNED:    'bg-blue-600/20 text-blue-400',
  IN_PROGRESS: 'bg-indigo-600/20 text-indigo-400',
  COMPLETED:   'bg-green-600/20 text-green-400',
  CANCELLED:   'bg-red-600/20 text-red-400',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d  = new Date(iso)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getUTCFullYear()}`
}
function fmtDateTime(iso: string) {
  const d  = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()} ${hh}:${mi}`
}
function canDeleteSection(sec: Section) {
  if (sec.type === 'CHECKLIST' || sec.type === 'EQUIPMENT_CHECK') return false
  return !sec.workCards.some((wc) => wc.status !== 'PENDING' && wc.status !== 'CANCELLED')
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        'w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white ' +
        'placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 ' +
        (props.className ?? '')
      }
    />
  )
}
function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={
        'w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white ' +
        'placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 resize-none ' +
        (props.className ?? '')
      }
    />
  )
}
function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={
        'bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white ' +
        'focus:outline-hidden focus:ring-2 focus:ring-blue-500 ' +
        (props.className ?? '')
      }
    />
  )
}
function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-300 mb-1">{children}</label>
}
function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
      {msg}
    </div>
  )
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-gray-900 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
function SmallBtn({ onClick, children, variant = 'default', disabled }: {
  onClick?: () => void; children: React.ReactNode
  variant?: 'default' | 'danger' | 'success' | 'primary'; disabled?: boolean
}) {
  const colors = {
    default: 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-500',
    danger:  'border-red-800 text-red-400 hover:text-red-300 hover:border-red-600',
    success: 'border-green-800 text-green-400 hover:text-green-300 hover:border-green-600',
    primary: 'border-blue-700 text-blue-400 hover:text-blue-300 hover:border-blue-500',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-2.5 py-1 text-xs rounded-lg border transition-colors disabled:opacity-40 ${colors[variant]}`}
    >
      {children}
    </button>
  )
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function IntakeModal({
  serviceId, bays, drivers, occupiedBayIds, onClose, onDone,
}: {
  serviceId: number; bays: Bay[]; drivers: Driver[]; occupiedBayIds: number[]
  onClose: () => void; onDone: (svc: FullService) => void
}) {
  const tService = useTranslations('service')
  const tCommon  = useTranslations('common')
  const tErrors  = useTranslations('errors')

  const [bayId,   setBayId]   = useState('')
  const [driverId, setDriverId] = useState('')
  const [mileage,  setMileage]  = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!bayId) { setError(tService('intake.bayRequired')); return }
    setError(''); setLoading(true)
    try {
      const res  = await fetch(`/api/services/${serviceId}/intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bayId:            Number(bayId),
          driverId:         driverId ? Number(driverId) : undefined,
          mileageAtService: mileage ? Number(mileage) : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tErrors('genericShort')); return }
      onDone(json.service); onClose()
    } catch { setError(tCommon('connectionFailed')) }
    finally   { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>{tService('bay')} *</Label>
        <Select value={bayId} onChange={(e) => setBayId(e.target.value)} className="w-full">
          <option value="">— {tService('intake.selectBay')} —</option>
          {bays.map((b) => (
            <option key={b.id} value={b.id} disabled={occupiedBayIds.includes(b.id)}>
              {b.name}{occupiedBayIds.includes(b.id) ? ` (${tService('intake.bayOccupied')})` : ''}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>{tService('driver')} ({tCommon('optional')})</Label>
        <Select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="w-full">
          <option value="">— {tService('intake.noDriver')} —</option>
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
      </div>
      <div>
        <Label>{tService('mileageAtService')} ({tCommon('kmUnit')})</Label>
        <Input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder={tService('intake.mileagePlaceholder')} />
      </div>
      {error && <ErrorBox msg={error} />}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors text-sm">
          {tCommon('cancel')}
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
          {loading ? tService('intake.submitting') : tService('intake.submit')}
        </button>
      </div>
    </form>
  )
}

function CancelServiceModal({
  serviceId, onClose, onDone,
}: {
  serviceId: number; onClose: () => void; onDone: (svc: FullService) => void
}) {
  const tService = useTranslations('service')
  const tCommon  = useTranslations('common')
  const tErrors  = useTranslations('errors')

  const [reason,  setReason]  = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) { setError(tService('cancelModal.reasonRequired')); return }
    setError(''); setLoading(true)
    try {
      const res  = await fetch(`/api/services/${serviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED', cancellationReason: reason }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tErrors('genericShort')); return }
      onDone(json.service); onClose()
    } catch { setError(tCommon('connectionFailed')) }
    finally   { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-gray-400">{tService('cancelModal.info')}</p>
      <div>
        <Label>{tService('cancellationReason')} *</Label>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tService('cancelModal.reasonPlaceholder')} />
      </div>
      {error && <ErrorBox msg={error} />}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors text-sm">
          {tCommon('back')}
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
          {loading ? tService('cancelModal.submitting') : tService('cancelModal.submit')}
        </button>
      </div>
    </form>
  )
}

function RescheduleModal({
  serviceId, currentDate, onClose, onDone,
}: {
  serviceId: number; currentDate: string; onClose: () => void; onDone: (svc: FullService) => void
}) {
  const tService = useTranslations('service')
  const tCommon  = useTranslations('common')
  const tErrors  = useTranslations('errors')

  const [date,    setDate]    = useState(new Date(currentDate).toISOString().slice(0, 10))
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!date) { setError(tService('selectDate')); return }
    setError(''); setLoading(true)
    try {
      const res  = await fetch(`/api/services/${serviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledDate: date }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tErrors('genericShort')); return }
      onDone(json.service); onClose()
    } catch { setError(tCommon('connectionFailed')) }
    finally   { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>{tService('newDate')} *</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} autoFocus />
      </div>
      {error && <ErrorBox msg={error} />}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors text-sm">
          {tCommon('cancel')}
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
          {loading ? tCommon('saving') : tService('reschedule')}
        </button>
      </div>
    </form>
  )
}

function AddSectionModal({
  serviceId, onClose, onAdded,
}: {
  serviceId: number; onClose: () => void; onAdded: (sec: Section) => void
}) {
  const tSection = useTranslations('section')
  const tCommon  = useTranslations('common')
  const tErrors  = useTranslations('errors')

  const SEC_ADD_OPTIONS: { value: SectionType; label: string }[] = [
    { value: 'DRIVER_FEEDBACK', label: tSection('type.DRIVER_FEEDBACK') },
    { value: 'MID_SERVICE',     label: tSection('type.MID_SERVICE') },
    { value: 'CUSTOM',          label: tSection('type.CUSTOM') },
  ]

  const [type,    setType]    = useState<SectionType>('MID_SERVICE')
  const [title,   setTitle]   = useState(tSection('type.MID_SERVICE'))
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  function handleTypeChange(t: SectionType) {
    setType(t)
    if (t === 'MID_SERVICE')     setTitle(tSection('type.MID_SERVICE'))
    if (t === 'DRIVER_FEEDBACK') setTitle(tSection('type.DRIVER_FEEDBACK'))
    if (t === 'CUSTOM')          setTitle('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError(tSection('titleRequired')); return }
    setError(''); setLoading(true)
    try {
      const res  = await fetch(`/api/services/${serviceId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tErrors('genericShort')); return }
      onAdded(json.section); onClose()
    } catch { setError(tCommon('connectionFailed')) }
    finally   { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>{tSection('typeLabel')}</Label>
        <Select value={type} onChange={(e) => handleTypeChange(e.target.value as SectionType)} className="w-full">
          {SEC_ADD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>
      <div>
        <Label>{tSection('titleLabel')} *</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tSection('titlePlaceholder')} />
      </div>
      {error && <ErrorBox msg={error} />}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors text-sm">
          {tCommon('cancel')}
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
          {loading ? tSection('adding') : tSection('addSection')}
        </button>
      </div>
    </form>
  )
}

function WorkCardModal({
  mode, workCard, sectionId, serviceId, mechanics, onClose, onSaved,
}: {
  mode: 'add' | 'edit'; workCard?: WorkCard; sectionId: number
  serviceId: number; mechanics: Mechanic[]
  onClose: () => void; onSaved: (wc: WorkCard) => void
}) {
  const tWorkCard = useTranslations('workCard')
  const tCommon   = useTranslations('common')
  const tErrors   = useTranslations('errors')

  const [description,   setDescription]   = useState(workCard?.description ?? '')
  const [mechanicId,    setMechanicId]    = useState(workCard?.mechanicId?.toString() ?? '')
  const [instructions,  setInstructions]  = useState(workCard?.specialInstructions ?? '')
  const [error,         setError]         = useState('')
  const [loading,       setLoading]       = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) { setError(tWorkCard('descriptionRequired')); return }
    setError(''); setLoading(true)
    try {
      const url = mode === 'add'
        ? `/api/services/${serviceId}/sections/${sectionId}/work-cards`
        : `/api/services/${serviceId}/sections/${sectionId}/work-cards/${workCard!.id}`
      const res  = await fetch(url, {
        method: mode === 'add' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          mechanicId:         mechanicId ? Number(mechanicId) : null,
          specialInstructions: instructions.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tErrors('genericShort')); return }
      onSaved(json.workCard); onClose()
    } catch { setError(tCommon('connectionFailed')) }
    finally   { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>{tWorkCard('description')} *</Label>
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder={tWorkCard('descriptionPlaceholder')} autoFocus />
      </div>
      <div>
        <Label>{tWorkCard('mechanic')}</Label>
        <Select value={mechanicId} onChange={(e) => setMechanicId(e.target.value)} className="w-full">
          <option value="">— {tWorkCard('noMechanic')} —</option>
          {mechanics.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
      </div>
      <div>
        <Label>{tWorkCard('specialInstructions')}</Label>
        <Textarea rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)}
          placeholder={tWorkCard('instructionsPlaceholder')} />
      </div>
      {error && <ErrorBox msg={error} />}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors text-sm">
          {tCommon('cancel')}
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
          {loading ? tCommon('saving') : (mode === 'add' ? tWorkCard('addBtn') : tCommon('save'))}
        </button>
      </div>
    </form>
  )
}

function AddFeedbackModal({
  serviceId, onClose, onAdded,
}: {
  serviceId: number; onClose: () => void; onAdded: (item: FeedbackItem) => void
}) {
  const tService = useTranslations('service')
  const tCommon  = useTranslations('common')
  const tErrors  = useTranslations('errors')

  const [desc,    setDesc]    = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!desc.trim()) { setError(tService('feedback.descRequired')); return }
    setError(''); setLoading(true)
    try {
      const res  = await fetch(`/api/services/${serviceId}/feedback-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tErrors('genericShort')); return }
      onAdded(json.item); onClose()
    } catch { setError(tCommon('connectionFailed')) }
    finally   { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>{tService('feedback.issueLabel')} *</Label>
        <Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={tService('feedback.issuePlaceholder')} autoFocus />
      </div>
      {error && <ErrorBox msg={error} />}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors text-sm">
          {tCommon('cancel')}
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
          {loading ? tCommon('loading') : tCommon('add')}
        </button>
      </div>
    </form>
  )
}

// ─── Checklist item row ───────────────────────────────────────────────────────

function ChecklistItemRow({
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
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-800 last:border-0">
      <button
        onClick={toggle}
        disabled={disabled || saving}
        className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          item.isCompleted
            ? 'bg-green-500 border-green-500'
            : 'border-gray-600 hover:border-gray-400'
        } disabled:opacity-50`}
      >
        {item.isCompleted && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${item.isCompleted ? 'line-through text-gray-500' : 'text-white'}`}>
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

// ─── Work card row ────────────────────────────────────────────────────────────

function WorkCardRow({
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

  return (
    <div className="py-3 border-b border-gray-800 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white">{wc.description}</p>
          {wc.mechanicName && (
            <p className="text-xs text-gray-500 mt-0.5">{wc.mechanicName}</p>
          )}
          {wc.specialInstructions && (
            <p className="text-xs text-gray-600 italic mt-1">{wc.specialInstructions}</p>
          )}
          {wc.parts.length > 0 && (
            <p className="text-xs text-gray-600 mt-1">{wc.parts.length} {tWorkCard('partsCount')}</p>
          )}
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${WC_COLOR[wc.status]} shrink-0`}>
          {tWorkCard(`status.${wc.status}`)}
        </span>
      </div>
      {!serviceTerminal && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <SmallBtn onClick={onEdit}>{tCommon('edit')}</SmallBtn>
          <Link
            href={`/services/${serviceId}/work-cards/${wc.id}`}
            className="px-2.5 py-1 text-xs rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
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

// ─── Equipment check panel ────────────────────────────────────────────────────

type EqStatus = 'PRESENT' | 'MISSING' | 'RESTOCKED'

function EquipmentCheckPanel({
  serviceId, sectionId, phase, itemDefs, existingItems,
  isSkipped, skipNote, isTerminal,
  onSaved, onSkipped,
}: {
  serviceId: number; sectionId: number; phase: 'INTAKE' | 'EXIT'
  itemDefs: EqItemDef[]; existingItems: EquipmentCheckItem[]
  isSkipped: boolean; skipNote: string | null; isTerminal: boolean
  onSaved: (items: EquipmentCheckItem[]) => void
  onSkipped: (note: string) => void
}) {
  const tEquipment = useTranslations('equipment')
  const tCommon    = useTranslations('common')
  const tErrors    = useTranslations('errors')

  type RowState = { status: EqStatus; explanation: string }

  function initRows(): Record<string, RowState> {
    const map: Record<string, RowState> = {}
    for (const def of itemDefs) {
      const existing = existingItems.find((i) => i.itemName === def.name && i.checkType === phase)
      map[def.name] = { status: existing?.status ?? 'PRESENT', explanation: existing?.explanation ?? '' }
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
                <span className="text-gray-300">{item.itemName}</span>
                {item.explanation && <span className="text-gray-600">— {item.explanation}</span>}
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
      <p className="py-3 text-sm text-gray-600">{tEquipment('notChecked')}</p>
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
            <span className="text-gray-300">{item.itemName}</span>
            {item.explanation && <span className="text-gray-600">— {item.explanation}</span>}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="py-3 space-y-3">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{phaseLabel}</p>

      {itemDefs.length === 0 ? (
        <p className="text-sm text-gray-600">{tEquipment('noItemsDefined')}</p>
      ) : (
        <div className="space-y-2">
          {itemDefs.map((def) => {
            const row = rows[def.name] ?? { status: 'PRESENT' as EqStatus, explanation: '' }
            return (
              <div key={def.name} className="rounded-lg bg-gray-800/50 px-3 py-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex-1 text-sm text-gray-200 min-w-0">{def.name}</span>
                  <div className="flex gap-2 text-xs">
                    {(['PRESENT', 'MISSING', 'RESTOCKED'] as const).map((s) => (
                      <label key={s} className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio" name={`eq-${phase}-${def.name}`} value={s}
                          checked={row.status === s}
                          onChange={() => setRow(def.name, { status: s })}
                          className="accent-blue-500"
                        />
                        <span className={
                          s === 'PRESENT'   ? 'text-green-400' :
                          s === 'MISSING'   ? 'text-red-400' : 'text-amber-400'
                        }>
                          {tEquipment(`status.${s}`)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                {row.status !== 'PRESENT' && (
                  <input
                    value={row.explanation}
                    onChange={(e) => setRow(def.name, { explanation: e.target.value })}
                    placeholder={tEquipment('notePlaceholder')}
                    className="mt-1.5 w-full bg-gray-700 border border-gray-600 rounded-sm px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                )}
              </div>
            )
          })}
        </div>
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
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
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
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowSkip(false)}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
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

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({
  sec, serviceId, mechanics, userName, canCreateWC, canCancelWC, canReopenWC, canCompleteWC,
  serviceTerminal, serviceStatus, isAdr,
  equipmentItems, adrEquipmentItems, equipmentCheckItems,
  onSectionDeleted, onChecklistItemToggled, onWorkCardAdded, onWorkCardUpdated,
  onEquipmentCheckSaved, onEquipmentCheckSkipped,
}: {
  sec: Section; serviceId: number; mechanics: Mechanic[]; userName: string
  canCreateWC: boolean; canCancelWC: boolean; canReopenWC: boolean; canCompleteWC: boolean
  serviceTerminal: boolean; serviceStatus: ServiceStatus; isAdr: boolean
  equipmentItems: EqItemDef[]; adrEquipmentItems: EqItemDef[]; equipmentCheckItems: EquipmentCheckItem[]
  onSectionDeleted: () => void
  onChecklistItemToggled: (updated: ChecklistItem) => void
  onWorkCardAdded: (wc: WorkCard) => void
  onWorkCardUpdated: (wc: WorkCard) => void
  onEquipmentCheckSaved: (items: EquipmentCheckItem[], phase: 'INTAKE' | 'EXIT') => void
  onEquipmentCheckSkipped: (phase: 'INTAKE' | 'EXIT', note: string) => void
}) {
  const tSection   = useTranslations('section')
  const tChecklist = useTranslations('checklist')
  const tEquipment = useTranslations('equipment')
  const tCommon    = useTranslations('common')
  const tWorkCard  = useTranslations('workCard')

  const [showAddWC,   setShowAddWC]   = useState(false)
  const [editingWC,   setEditingWC]   = useState<WorkCard | null>(null)
  const [deleting,    setDeleting]    = useState(false)

  const doneCount = sec.checklistItems.filter((i) => i.isCompleted).length

  async function deleteSection() {
    if (!confirm(tSection('deleteConfirm'))) return
    setDeleting(true)
    try {
      await fetch(`/api/services/${serviceId}/sections/${sec.id}`, { method: 'DELETE' })
      onSectionDeleted()
    } finally { setDeleting(false) }
  }

  const showAddWorkCard = !serviceTerminal && canCreateWC &&
    sec.type !== 'CHECKLIST' && sec.type !== 'EQUIPMENT_CHECK'

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">{sec.title}</h3>
          <span className="text-xs px-1.5 py-0.5 rounded-sm bg-gray-800 text-gray-500">
            {tSection(`type.${sec.type}`)}
          </span>
          {sec.type === 'CHECKLIST' && (
            <span className="text-xs text-gray-500">
              {doneCount}/{sec.checklistItems.length}
            </span>
          )}
        </div>
        {!serviceTerminal && canDeleteSection(sec) && (
          <button
            onClick={deleteSection}
            disabled={deleting}
            className="text-xs text-gray-600 hover:text-red-400 transition-colors disabled:opacity-40"
          >
            {tSection('deleteSection')}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="px-4">
        {sec.type === 'CHECKLIST' && (
          sec.checklistItems.length === 0 ? (
            <p className="py-4 text-sm text-gray-600">{tChecklist('noItems')}</p>
          ) : (
            sec.checklistItems.map((item) => (
              <ChecklistItemRow
                key={item.id}
                item={item}
                serviceId={serviceId}
                sectionId={sec.id}
                disabled={serviceTerminal}
                userName={userName}
                onToggled={onChecklistItemToggled}
              />
            ))
          )
        )}

        {sec.type === 'EQUIPMENT_CHECK' && (() => {
          const allItems = isAdr ? [...equipmentItems, ...adrEquipmentItems] : equipmentItems
          const showIntake = ['INTAKE', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY', 'COMPLETED'].includes(serviceStatus)
          const showExit   = ['QUALITY_CHECK', 'READY', 'COMPLETED'].includes(serviceStatus)
          return (
            <div className="divide-y divide-gray-800">
              {showIntake && (
                <div className="px-0 py-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{tEquipment('intakeCheck')}</p>
                  <EquipmentCheckPanel
                    serviceId={serviceId} sectionId={sec.id} phase="INTAKE"
                    itemDefs={allItems} existingItems={equipmentCheckItems}
                    isSkipped={!!sec.intakeSkippedAt} skipNote={sec.intakeSkipNote}
                    isTerminal={serviceTerminal || showExit}
                    onSaved={(items) => onEquipmentCheckSaved(items, 'INTAKE')}
                    onSkipped={(note) => onEquipmentCheckSkipped('INTAKE', note)}
                  />
                </div>
              )}
              {showExit && (
                <div className="px-0 py-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 mt-3">{tEquipment('exitCheck')}</p>
                  <EquipmentCheckPanel
                    serviceId={serviceId} sectionId={sec.id} phase="EXIT"
                    itemDefs={allItems} existingItems={equipmentCheckItems}
                    isSkipped={!!sec.exitSkippedAt} skipNote={sec.exitSkipNote}
                    isTerminal={serviceTerminal}
                    onSaved={(items) => onEquipmentCheckSaved(items, 'EXIT')}
                    onSkipped={(note) => onEquipmentCheckSkipped('EXIT', note)}
                  />
                </div>
              )}
              {!showIntake && (
                <p className="py-4 text-sm text-gray-600">{tEquipment('checkAtIntake')}</p>
              )}
            </div>
          )
        })()}

        {(sec.type === 'DRIVER_FEEDBACK' || sec.type === 'MID_SERVICE' || sec.type === 'CUSTOM') && (
          sec.workCards.length === 0 ? (
            <p className="py-4 text-sm text-gray-600">{tSection('noWorkCards')}</p>
          ) : (
            sec.workCards.map((wc) => (
              <WorkCardRow
                key={wc.id}
                wc={wc}
                serviceId={serviceId}
                sectionId={sec.id}
                canCancelWC={canCancelWC}
                canReopenWC={canReopenWC}
                canCompleteWC={canCompleteWC}
                serviceTerminal={serviceTerminal}
                onUpdated={onWorkCardUpdated}
                onEdit={() => setEditingWC(wc)}
              />
            ))
          )
        )}
      </div>

      {/* Footer */}
      {showAddWorkCard && (
        <div className="px-4 py-3 border-t border-gray-800">
          <button
            onClick={() => setShowAddWC(true)}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            + {tSection('addWorkCard')}
          </button>
        </div>
      )}

      {showAddWC && (
        <Modal title={tWorkCard('newTitle')} onClose={() => setShowAddWC(false)}>
          <WorkCardModal
            mode="add" sectionId={sec.id} serviceId={serviceId} mechanics={mechanics}
            onClose={() => setShowAddWC(false)}
            onSaved={(wc) => { onWorkCardAdded(wc); setShowAddWC(false) }}
          />
        </Modal>
      )}
      {editingWC && (
        <Modal title={tWorkCard('editTitle')} onClose={() => setEditingWC(null)}>
          <WorkCardModal
            mode="edit" workCard={editingWC} sectionId={sec.id} serviceId={serviceId} mechanics={mechanics}
            onClose={() => setEditingWC(null)}
            onSaved={(wc) => { onWorkCardUpdated(wc); setEditingWC(null) }}
          />
        </Modal>
      )}
    </div>
  )
}

// ─── Collapsible panel ────────────────────────────────────────────────────────

const PANEL_ICON_BG: Record<string, string> = {
  checklist: 'bg-blue-900/40',
  equipment: 'bg-amber-900/40',
  feedback:  'bg-purple-900/40',
  notes:     'bg-gray-700/60',
  card:      'bg-indigo-900/40',
}

function PanelIcon({ kind }: { kind: string }) {
  if (kind === 'checklist') return (
    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  )
  if (kind === 'equipment') return (
    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
  if (kind === 'feedback') return (
    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  )
  if (kind === 'notes') return (
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
  return (
    <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function CollapsiblePanel({
  title, children, kind = 'card', progress, defaultOpen = true, badge, headerRight,
}: {
  title: string; children: React.ReactNode; kind?: string
  progress?: { done: number; total: number }; defaultOpen?: boolean
  badge?: string | number; headerRight?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o) } }}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 ${PANEL_ICON_BG[kind] ?? 'bg-gray-700/60'} rounded-lg flex items-center justify-center shrink-0`}>
            <PanelIcon kind={kind} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white flex items-center gap-2 flex-wrap">
              {title}
              {badge !== undefined && (
                <span className="text-xs text-gray-500 font-normal">{badge}</span>
              )}
            </div>
            {progress && (
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '0%' }}
                  />
                </div>
                <span className="text-xs text-gray-400">{progress.done} / {progress.total}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {headerRight}
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
            onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {open && <div className="border-t border-gray-800">{children}</div>}
    </div>
  )
}

// ─── Stage rail helpers ────────────────────────────────────────────────────────

const STAGE_ORDER: ServiceStatus[] = [
  'SCHEDULED', 'INTAKE', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY', 'COMPLETED',
]

function resolvedStageState(
  stage: ServiceStatus,
  current: ServiceStatus,
): 'done' | 'active' | 'locked' {
  if (current === 'CANCELLED') return stage === 'SCHEDULED' ? 'done' : 'locked'
  const ci = STAGE_ORDER.indexOf(current)
  const si = STAGE_ORDER.indexOf(stage)
  if (si < ci)  return 'done'
  if (si === ci) return 'active'
  return 'locked'
}

// ─── Main component ───────────────────────────────────────────────────────────

type ModalState = 'intake' | 'cancel' | 'reschedule' | 'addSection' | 'addFeedback' | null

export default function ServiceOrderClient({
  initialService, bays, drivers, mechanics, occupiedBayIds, userName,
  canReschedule, canCancel, canCreateWorkCard, canCancelWorkCard, canReopenWorkCard, canCompleteWorkCard,
  canCreateNote, canUploadPhoto, equipmentItems, adrEquipmentItems,
}: {
  initialService: FullService
  bays: Bay[]; drivers: Driver[]; mechanics: Mechanic[]
  occupiedBayIds: number[]; userName: string
  canReschedule: boolean; canCancel: boolean
  canCreateWorkCard: boolean; canCancelWorkCard: boolean
  canReopenWorkCard: boolean; canCompleteWorkCard: boolean
  canCreateNote: boolean; canUploadPhoto: boolean
  equipmentItems: EqItemDef[]; adrEquipmentItems: EqItemDef[]
}) {
  const tService = useTranslations('service')
  const tSection = useTranslations('section')
  const tCommon  = useTranslations('common')
  const tErrors  = useTranslations('errors')

  const [service,          setService]          = useState<FullService>(initialService)
  const [modal,            setModal]            = useState<ModalState>(null)
  const [feedbackText,     setFeedbackText]     = useState(initialService.driverFeedbackNotes ?? '')
  const [savingFB,         setSavingFB]         = useState(false)
  const [advancing,        setAdvancing]        = useState(false)
  const [stageWarnings,    setStageWarnings]    = useState<string[]>([])
  const [expandedRailStage, setExpandedRailStage] = useState<ServiceStatus | null>(null)

  const modalRef = useRef(modal)
  useEffect(() => { modalRef.current = modal }, [modal])

  useEffect(() => {
    const id = setInterval(async () => {
      if (modalRef.current) return           // don't disrupt open modals
      try {
        const res = await fetch(`/api/services/${initialService.id}`)
        if (!res.ok) return
        const json = await res.json()
        if (json.service) setService(json.service)
      } catch { /* ignore network errors */ }
    }, 30_000)
    return () => clearInterval(id)
  }, [initialService.id])

  const isTerminal = service.status === 'COMPLETED' || service.status === 'CANCELLED'

  // Map of next status labels using translation keys
  const NEXT_STATUS_LABEL: Partial<Record<ServiceStatus, string>> = {
    INTAKE:        `${tService('advance')} → ${tService('status.IN_PROGRESS')}`,
    IN_PROGRESS:   `${tService('advance')} → ${tService('status.QUALITY_CHECK')}`,
    QUALITY_CHECK: `${tService('advance')} → ${tService('status.READY')}`,
    READY:         tService('moveToCompleted'),
  }

  async function advanceStage(force = false) {
    setAdvancing(true)
    try {
      const res  = await fetch(`/api/services/${service.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const json = await res.json()
      if (!res.ok) { alert(json.error ?? tErrors('genericShort')); return }
      if (json.warnings?.length) {
        setStageWarnings(json.warnings)
        return
      }
      setStageWarnings([])
      setService(json.service as FullService)
    } finally { setAdvancing(false) }
  }

  // ── State helpers ──────────────────────────────────────────────────────────

  function mergeService(partial: Partial<FullService>) {
    setService((prev) => ({ ...prev, ...partial }))
  }

  function sectionAdded(sec: Section) {
    setService((prev) => ({
      ...prev,
      sections: [...prev.sections, sec].sort((a, b) => a.order - b.order),
    }))
  }

  function sectionDeleted(secId: number) {
    setService((prev) => ({ ...prev, sections: prev.sections.filter((s) => s.id !== secId) }))
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

  function equipmentCheckSaved(items: EquipmentCheckItem[], phase: 'INTAKE' | 'EXIT') {
    setService((prev) => ({
      ...prev,
      equipmentCheckItems: [
        ...prev.equipmentCheckItems.filter((i) => i.checkType !== phase),
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

  async function deleteFeedbackItem(itemId: number) {
    await fetch(`/api/services/${service.id}/feedback-items/${itemId}`, { method: 'DELETE' })
    setService((prev) => ({
      ...prev,
      driverFeedbackItems: prev.driverFeedbackItems.filter((i) => i.id !== itemId),
    }))
  }

  async function saveFeedbackNotes() {
    setSavingFB(true)
    try {
      await fetch(`/api/services/${service.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverFeedbackNotes: feedbackText }),
      })
      setService((prev) => ({ ...prev, driverFeedbackNotes: feedbackText }))
    } finally { setSavingFB(false) }
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  const checklistSection  = service.sections.find((s) => s.type === 'CHECKLIST')
  const equipmentSection  = service.sections.find((s) => s.type === 'EQUIPMENT_CHECK')
  const workCardSections  = service.sections.filter((s) =>
    s.type === 'DRIVER_FEEDBACK' || s.type === 'MID_SERVICE' || s.type === 'CUSTOM',
  )
  const allWorkCards       = service.sections.flatMap((s) => s.workCards)
  const activeWorkCards    = allWorkCards.filter((wc) => wc.status !== 'CANCELLED')
  const completedWorkCards = activeWorkCards.filter((wc) => wc.status === 'COMPLETED')
  const checklistItems     = checklistSection?.checklistItems ?? []
  const completedChecklist = checklistItems.filter((i) => i.isCompleted)

  const isCancelled = service.status === 'CANCELLED'

  const stageGuidance: Partial<Record<ServiceStatus, string>> = {
    SCHEDULED:     tService('stageGuidance.SCHEDULED'),
    INTAKE:        tService('stageGuidance.INTAKE'),
    IN_PROGRESS:   tService('stageGuidance.IN_PROGRESS'),
    QUALITY_CHECK: tService('stageGuidance.QUALITY_CHECK'),
    READY:         tService('stageGuidance.READY'),
    COMPLETED:     tService('stageGuidance.COMPLETED'),
    CANCELLED:     tService('stageGuidance.CANCELLED'),
  }

  // Panel visibility and default-open state per stage
  const showEqCheck   = service.status !== 'SCHEDULED' && service.status !== 'IN_PROGRESS'
  const showChecklist = !['SCHEDULED', 'INTAKE'].includes(service.status)
  const showWorkCards = !['SCHEDULED', 'INTAKE'].includes(service.status)
  const showFeedback  = service.status !== 'SCHEDULED'
  const showNotes     = service.status !== 'SCHEDULED'
  const eqDefaultOpen      = service.status === 'INTAKE' || service.status === 'QUALITY_CHECK'
  const clDefaultOpen      = service.status === 'IN_PROGRESS' || service.status === 'QUALITY_CHECK'
  const feedbackDefaultOpen = service.status === 'INTAKE' || service.status === 'IN_PROGRESS'

  // ── Rail item renderer (closure over component state) ──────────────────────

  function RailItem({ stage, isLast }: { stage: ServiceStatus; isLast: boolean }) {
    const railState = resolvedStageState(stage, service.status)
    const expanded  = expandedRailStage === stage

    const summaryLine: Partial<Record<ServiceStatus, string>> = {
      SCHEDULED:     fmtDate(service.scheduledDate),
      INTAKE:        [service.bayNameSnapshot, service.mileageAtService != null ? `${Math.round(service.mileageAtService).toLocaleString('bg-BG')} km` : null].filter(Boolean).join(' · '),
      IN_PROGRESS:   service.startDate ? fmtDate(service.startDate) : '',
      QUALITY_CHECK: `${completedWorkCards.length}/${activeWorkCards.length} work cards`,
      READY:         service.bayNameSnapshot ?? '',
      COMPLETED:     service.endDate ? fmtDate(service.endDate) : '',
    }

    const dotCls =
      railState === 'done'   ? 'bg-green-500/20 border-green-500' :
      railState === 'active' ? 'bg-blue-600 border-blue-400 shadow-[0_0_0_4px_rgba(59,130,246,0.2)]' :
                               'bg-gray-800 border-gray-700'
    const labelCls =
      railState === 'done'   ? 'text-green-400' :
      railState === 'active' ? 'text-blue-400 font-bold' :
                               'text-gray-600'

    return (
      <div className="flex flex-col items-start">
        <div
          className={`flex items-center gap-3 w-full py-1 ${railState === 'done' && summaryLine[stage] ? 'cursor-pointer' : ''}`}
          onClick={railState === 'done' && summaryLine[stage] ? () => setExpandedRailStage(expanded ? null : stage) : undefined}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${dotCls}`}>
            {railState === 'done'   && <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
            {railState === 'active' && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
            {railState === 'locked' && <div className="w-2 h-2 rounded-full bg-gray-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-semibold leading-tight ${labelCls}`}>
              {tService(`status.${stage}`)}
            </div>
            {(railState === 'done' || railState === 'active') && summaryLine[stage] && !expanded && (
              <div className="text-xs text-gray-500 truncate mt-0.5">{summaryLine[stage]}</div>
            )}
          </div>
          {railState === 'done' && summaryLine[stage] && (
            <svg className={`w-3.5 h-3.5 text-gray-600 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
        {expanded && summaryLine[stage] && (
          <div className="ml-11 mb-1 text-xs text-gray-400">{summaryLine[stage]}</div>
        )}
        {!isLast && (
          <div className={`w-0.5 ml-[15px] my-0.5 ${railState === 'done' ? 'bg-green-500/40' : 'bg-gray-700'}`} style={{ minHeight: 12 }} />
        )}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex overflow-hidden" style={{ height: '100dvh' }}>

      {/* ═══ Stage Rail (desktop) ═══ */}
      <div className="hidden lg:flex flex-col w-56 shrink-0 bg-gray-900 border-r border-gray-800 overflow-y-auto">
        {/* Truck mini-card */}
        <div className="p-4 border-b border-gray-800 shrink-0">
          <div className="text-xs text-gray-500 mb-1">#{service.id}</div>
          <div className="font-mono text-sm font-bold text-white">{service.truckPlateSnapshot}</div>
          <div className="text-xs text-gray-400">{service.truck.make} {service.truck.model}{service.truck.year ? ` · ${service.truck.year}` : ''}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {service.truck.isAdr && (
              <span className="text-xs bg-orange-900/50 text-orange-400 border border-orange-800/50 px-1.5 py-0.5 rounded-sm font-medium">ADR</span>
            )}
            {service.truck.frotcomVehicleId && (
              <span className="text-xs bg-sky-900/40 text-sky-400 border border-sky-800/40 px-1.5 py-0.5 rounded-sm">Frotcom</span>
            )}
            {service.bayNameSnapshot && (
              <span className="text-xs text-gray-500">{tService('bay')}: {service.bayNameSnapshot}</span>
            )}
          </div>
        </div>

        {/* Stage list */}
        <div className="flex-1 p-4">
          {STAGE_ORDER.map((stage, idx) => (
            <RailItem key={stage} stage={stage} isLast={idx === STAGE_ORDER.length - 1} />
          ))}
          {isCancelled && (
            <div className="mt-2 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-900/30 border-2 border-red-700 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-red-400">{tService('status.CANCELLED')}</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Main content ═══ */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* ── Top bar (breadcrumb + actions) ── */}
        <div className="shrink-0 bg-gray-900/95 border-b border-gray-800 px-4 lg:px-6 py-3 flex items-center justify-between gap-3">
          <nav className="flex items-center gap-2 text-sm min-w-0">
            <Link href="/services" className="text-gray-400 hover:text-white transition-colors hidden sm:inline">
              {tService('backToOrders').replace('←', '').trim()}
            </Link>
            <Link href="/services" className="text-gray-400 hover:text-white sm:hidden">←</Link>
            <span className="text-gray-600 hidden sm:inline">›</span>
            <Link href={`/trucks/${service.truck.id}`} className="text-blue-400 hover:text-blue-300 font-mono font-medium truncate transition-colors">
              {service.truckPlateSnapshot}
            </Link>
            <span className="text-gray-600">›</span>
            <span className={`font-semibold truncate inline-flex items-center gap-1.5 ${SVC_COLOR[service.status]}`}>
              {tService(`status.${service.status}`)}
            </span>
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/services/${service.id}/print`}
              target="_blank"
              className="px-3 py-1.5 text-xs border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span className="hidden sm:inline">{tCommon('print')}</span>
            </Link>
            {canCancel && !isTerminal && (
              <button
                onClick={() => setModal('cancel')}
                className="px-3 py-1.5 text-xs bg-red-900/30 hover:bg-red-900/60 text-red-400 border border-red-800/50 rounded-lg transition-colors"
              >
                {tService('cancelOrder')}
              </button>
            )}
          </div>
        </div>

        {/* ── Mobile progress bar ── */}
        <div className="lg:hidden shrink-0 bg-gray-900 border-b border-gray-800 px-4 py-2.5">
          <div className="flex gap-1 mb-1.5">
            {STAGE_ORDER.map((stage) => {
              const s = resolvedStageState(stage, service.status)
              return (
                <div key={stage} className={`h-1.5 flex-1 rounded-full ${s === 'done' ? 'bg-green-500' : s === 'active' ? 'bg-blue-500' : 'bg-gray-700'}`} />
              )
            })}
          </div>
          <p className="text-xs text-center text-gray-400">{tService(`status.${service.status}`)}</p>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto bg-gray-950">

          {/* Stage header */}
          <div className="px-4 lg:px-6 pt-5 pb-4 border-b border-gray-800">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {!isCancelled && service.status !== 'COMPLETED' && (
                  <div className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-1">
                    Step {STAGE_ORDER.indexOf(service.status) + 1} of {STAGE_ORDER.length}
                  </div>
                )}
                <h1 className="text-xl font-bold text-white">{tService(`status.${service.status}`)}</h1>
                <p className="text-sm text-gray-400 mt-1 max-w-xl leading-relaxed">
                  {stageGuidance[service.status]}
                </p>
              </div>
              {/* Mini counters */}
              {(checklistItems.length > 0 || activeWorkCards.length > 0) && !isCancelled && (
                <div className="flex gap-2 shrink-0">
                  {checklistItems.length > 0 && showChecklist && (
                    <div className="bg-gray-800 rounded-lg px-3 py-2 border border-gray-700 text-center min-w-[56px]">
                      <div className="text-sm font-bold text-white leading-tight">
                        {completedChecklist.length}<span className="text-gray-500 text-xs font-normal">/{checklistItems.length}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{tCommon('checklist')}</div>
                    </div>
                  )}
                  {activeWorkCards.length > 0 && (
                    <div className="bg-gray-800 rounded-lg px-3 py-2 border border-gray-700 text-center min-w-[56px]">
                      <div className="text-sm font-bold text-white leading-tight">
                        {completedWorkCards.length}<span className="text-gray-500 text-xs font-normal">/{activeWorkCards.length}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{tCommon('workCards')}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Panels */}
          <div className="px-4 lg:px-6 py-5 space-y-4">

            {/* Cancellation banner */}
            {isCancelled && service.cancellationReason && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-xs font-medium text-red-400 mb-0.5">{tService('cancellationReason')}</p>
                <p className="text-sm text-red-300">{service.cancellationReason}</p>
              </div>
            )}

            {/* SCHEDULED: truck info + preview */}
            {service.status === 'SCHEDULED' && (
              <>
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xl font-bold text-white">{service.truckPlateSnapshot}</span>
                        {service.truck.isAdr && (
                          <span className="px-1.5 py-0.5 rounded-sm text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">ADR</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">{service.truck.make} {service.truck.model}{service.truck.year ? ` · ${service.truck.year}` : ''}</p>
                    </div>
                    {canReschedule && (
                      <button
                        onClick={() => setModal('reschedule')}
                        className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                      >
                        {tService('reschedule')}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-0.5">{tService('scheduledDate')}</p>
                      <p className="text-sm text-gray-200 font-medium">{fmtDate(service.scheduledDate)}</p>
                    </div>
                    {service.mileageAtService !== null && (
                      <div>
                        <p className="text-xs text-gray-600 mb-0.5">{tService('mileageAtService')}</p>
                        <p className="text-sm text-gray-200">{Math.round(service.mileageAtService).toLocaleString('bg-BG')} {tCommon('kmUnit')}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl px-5 py-4">
                  <p className="text-sm font-semibold text-blue-300 mb-1">↓ {tService('status.INTAKE')}</p>
                  <p className="text-sm text-gray-400">{tService('moveToIntakeDesc')}</p>
                </div>
              </>
            )}

            {/* Equipment Check */}
            {showEqCheck && equipmentSection && (
              <CollapsiblePanel
                key={`eq-${service.status}`}
                title={tCommon('equipmentCheck')}
                kind="equipment"
                defaultOpen={eqDefaultOpen}
                badge={
                  equipmentSection.intakeSkippedAt && equipmentSection.exitSkippedAt
                    ? tCommon('skipped')
                    : equipmentSection.intakeSkippedAt
                    ? `Intake ${tCommon('skipped').toLowerCase()}`
                    : equipmentSection.exitSkippedAt
                    ? `Exit ${tCommon('skipped').toLowerCase()}`
                    : undefined
                }
              >
                <div className="px-4 py-3">
                  <SectionCard
                    sec={equipmentSection}
                    serviceId={service.id}
                    mechanics={mechanics}
                    userName={userName}
                    canCreateWC={canCreateWorkCard}
                    canCancelWC={canCancelWorkCard}
                    canReopenWC={canReopenWorkCard}
                    canCompleteWC={canCompleteWorkCard}
                    serviceTerminal={isTerminal}
                    serviceStatus={service.status}
                    isAdr={service.truck.isAdr}
                    equipmentItems={equipmentItems}
                    adrEquipmentItems={adrEquipmentItems}
                    equipmentCheckItems={service.equipmentCheckItems}
                    onSectionDeleted={() => sectionDeleted(equipmentSection.id)}
                    onChecklistItemToggled={(u) => checklistItemToggled(equipmentSection.id, u)}
                    onWorkCardAdded={(wc) => workCardAdded(equipmentSection.id, wc)}
                    onWorkCardUpdated={(wc) => workCardUpdated(equipmentSection.id, wc)}
                    onEquipmentCheckSaved={(items, phase) => equipmentCheckSaved(items, phase)}
                    onEquipmentCheckSkipped={(phase, note) => equipmentCheckSkipped(phase, note)}
                  />
                </div>
              </CollapsiblePanel>
            )}

            {/* Driver Feedback */}
            {showFeedback && (
              <CollapsiblePanel
                title={tService('driverFeedback')}
                kind="feedback"
                defaultOpen={feedbackDefaultOpen}
                badge={service.driverFeedbackItems.length > 0 ? service.driverFeedbackItems.length : undefined}
                headerRight={
                  !isTerminal ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setModal('addFeedback') }}
                      className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-sm transition-colors"
                    >
                      + {tCommon('add')}
                    </button>
                  ) : undefined
                }
              >
                <div className="px-5 py-4 space-y-3">
                  {service.driverFeedbackItems.length === 0 ? (
                    <p className="text-sm text-gray-600">{tService('noFeedbackItems')}</p>
                  ) : (
                    <ul className="space-y-2">
                      {service.driverFeedbackItems.map((item) => (
                        <li key={item.id} className="flex items-start justify-between gap-2">
                          <p className="text-sm text-gray-300">• {item.description}</p>
                          {!isTerminal && (
                            <button onClick={() => deleteFeedbackItem(item.id)} className="text-gray-700 hover:text-red-400 transition-colors shrink-0 text-lg leading-none">×</button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div>
                    <Label>{tService('driverFeedbackNotes')}</Label>
                    <Textarea
                      rows={2}
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder={tService('feedbackNotesPlaceholder')}
                      disabled={isTerminal}
                    />
                    {!isTerminal && feedbackText !== (service.driverFeedbackNotes ?? '') && (
                      <button
                        onClick={saveFeedbackNotes}
                        disabled={savingFB}
                        className="mt-2 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {savingFB ? tCommon('saving') : tService('saveFeedbackNotes')}
                      </button>
                    )}
                  </div>
                </div>
              </CollapsiblePanel>
            )}

            {/* Checklist */}
            {showChecklist && checklistSection && (
              <CollapsiblePanel
                key={`cl-${service.status}`}
                title={tCommon('checklist')}
                kind="checklist"
                defaultOpen={clDefaultOpen}
                progress={{ done: completedChecklist.length, total: checklistItems.length }}
              >
                <div className="px-5 py-3">
                  {checklistItems.length === 0 ? (
                    <p className="py-2 text-sm text-gray-600">{tCommon('noItems')}</p>
                  ) : (
                    checklistItems.map((item) => (
                      <ChecklistItemRow
                        key={item.id}
                        item={item}
                        serviceId={service.id}
                        sectionId={checklistSection.id}
                        disabled={isTerminal}
                        userName={userName}
                        onToggled={(u) => checklistItemToggled(checklistSection.id, u)}
                      />
                    ))
                  )}
                </div>
              </CollapsiblePanel>
            )}

            {/* Work card sections */}
            {showWorkCards && workCardSections.map((sec) => (
              <SectionCard
                key={sec.id}
                sec={sec}
                serviceId={service.id}
                mechanics={mechanics}
                userName={userName}
                canCreateWC={canCreateWorkCard}
                canCancelWC={canCancelWorkCard}
                canReopenWC={canReopenWorkCard}
                canCompleteWC={canCompleteWorkCard}
                serviceTerminal={isTerminal}
                serviceStatus={service.status}
                isAdr={service.truck.isAdr}
                equipmentItems={equipmentItems}
                adrEquipmentItems={adrEquipmentItems}
                equipmentCheckItems={service.equipmentCheckItems}
                onSectionDeleted={() => sectionDeleted(sec.id)}
                onChecklistItemToggled={(u) => checklistItemToggled(sec.id, u)}
                onWorkCardAdded={(wc) => workCardAdded(sec.id, wc)}
                onWorkCardUpdated={(wc) => workCardUpdated(sec.id, wc)}
                onEquipmentCheckSaved={(items, phase) => equipmentCheckSaved(items, phase)}
                onEquipmentCheckSkipped={(phase, note) => equipmentCheckSkipped(phase, note)}
              />
            ))}

            {/* Add section */}
            {!isTerminal && service.status !== 'SCHEDULED' && (
              <button
                onClick={() => setModal('addSection')}
                className="w-full py-3 border border-dashed border-gray-700 hover:border-gray-500 text-sm text-gray-500 hover:text-gray-300 rounded-xl transition-colors"
              >
                + {tSection('addSection')}
              </button>
            )}

            {/* Notes & Photos */}
            {showNotes && (
              <CollapsiblePanel
                title={tCommon('notesAndPhotos')}
                kind="notes"
                defaultOpen={false}
                badge={`${service.notes.length} · ${service.photos.length}`}
              >
                <div className="px-5 py-4 space-y-4">
                  <PhotoGallery
                    photos={service.photos}
                    uploadUrl={`/api/services/${service.id}/photos`}
                    deleteUrlFor={(id) => `/api/services/${service.id}/photos/${id}`}
                    canUpload={canUploadPhoto && !isTerminal}
                    onPhotoAdded={(p) => setService((prev) => ({ ...prev, photos: [...prev.photos, p] }))}
                    onPhotoDeleted={(id) => setService((prev) => ({ ...prev, photos: prev.photos.filter((p) => p.id !== id) }))}
                  />
                  <NotesSection
                    notes={service.notes}
                    postUrl={`/api/services/${service.id}/notes`}
                    canCreate={canCreateNote && !isTerminal}
                    onNoteAdded={(n) => setService((prev) => ({ ...prev, notes: [...prev.notes, n] }))}
                  />
                </div>
              </CollapsiblePanel>
            )}

          </div>
        </div>

        {/* ── Bottom Action Bar ── */}
        {!isTerminal && (
          <div className="shrink-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 px-4 lg:px-6 py-4">
            {/* Warnings */}
            {stageWarnings.length > 0 && (
              <div className="flex items-start gap-3 mb-4 p-3 bg-amber-900/20 border border-amber-800/40 rounded-lg">
                <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <ul className="text-sm text-amber-300 space-y-0.5">
                    {stageWarnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => { setStageWarnings([]); advanceStage(true) }}
                      disabled={advancing}
                      className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {tService('continueAnyway')}
                    </button>
                    <button onClick={() => setStageWarnings([])} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">
                      {tCommon('cancel')}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-gray-600 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                {tCommon('live')}
              </div>
              <div className="flex items-center gap-2">
                {service.status === 'SCHEDULED' && (
                  <button
                    onClick={() => setModal('intake')}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
                  >
                    {tService('moveToIntake')}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                )}
                {NEXT_STATUS_LABEL[service.status] && (
                  <button
                    onClick={() => advanceStage(false)}
                    disabled={advancing}
                    className={`px-5 py-2 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 ${
                      service.status === 'READY' ? 'bg-green-600 hover:bg-green-500' : 'bg-blue-600 hover:bg-blue-500'
                    }`}
                  >
                    {advancing ? tCommon('loading') : NEXT_STATUS_LABEL[service.status]}
                    {!advancing && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Modals ── */}
      {modal === 'intake' && (
        <Modal title={tService('intake.title')} onClose={() => setModal(null)}>
          <IntakeModal
            serviceId={service.id} bays={bays} drivers={drivers} occupiedBayIds={occupiedBayIds}
            onClose={() => setModal(null)} onDone={(svc) => setService(svc as FullService)}
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
      {modal === 'addSection' && (
        <Modal title={tSection('addSection')} onClose={() => setModal(null)}>
          <AddSectionModal
            serviceId={service.id}
            onClose={() => setModal(null)} onAdded={sectionAdded}
          />
        </Modal>
      )}
      {modal === 'addFeedback' && (
        <Modal title={tService('feedback.modalTitle')} onClose={() => setModal(null)}>
          <AddFeedbackModal
            serviceId={service.id}
            onClose={() => setModal(null)} onAdded={feedbackItemAdded}
          />
        </Modal>
      )}
    </div>
  )
}

