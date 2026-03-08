'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
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

const SVC_LABEL: Record<ServiceStatus, string> = {
  SCHEDULED:     'Планирана',
  INTAKE:        'Приемане',
  IN_PROGRESS:   'В процес',
  QUALITY_CHECK: 'Контрол на качеството',
  READY:         'Готова',
  COMPLETED:     'Завършена',
  CANCELLED:     'Отменена',
}
const SVC_COLOR: Record<ServiceStatus, string> = {
  SCHEDULED:     'bg-amber-600/20 text-amber-400',
  INTAKE:        'bg-blue-600/20 text-blue-400',
  IN_PROGRESS:   'bg-indigo-600/20 text-indigo-400',
  QUALITY_CHECK: 'bg-purple-600/20 text-purple-400',
  READY:         'bg-green-600/20 text-green-400',
  COMPLETED:     'bg-gray-600/20 text-gray-400',
  CANCELLED:     'bg-red-600/20 text-red-400',
}
const WC_LABEL: Record<WorkCardStatus, string> = {
  PENDING:     'Изчакваща',
  ASSIGNED:    'Назначена',
  IN_PROGRESS: 'В процес',
  COMPLETED:   'Завършена',
  CANCELLED:   'Отменена',
}
const WC_COLOR: Record<WorkCardStatus, string> = {
  PENDING:     'bg-gray-600/20 text-gray-400',
  ASSIGNED:    'bg-blue-600/20 text-blue-400',
  IN_PROGRESS: 'bg-indigo-600/20 text-indigo-400',
  COMPLETED:   'bg-green-600/20 text-green-400',
  CANCELLED:   'bg-red-600/20 text-red-400',
}
const SEC_LABEL: Record<SectionType, string> = {
  CHECKLIST:       'Контролен списък',
  DRIVER_FEEDBACK: 'Шофьорска об. вр.',
  MID_SERVICE:     'Открит при сервиза',
  EQUIPMENT_CHECK: 'Проверка оборудване',
  CUSTOM:          'Персонализиран',
}
const SEC_ADD_OPTIONS: { value: SectionType; label: string }[] = [
  { value: 'DRIVER_FEEDBACK', label: 'Шофьорска обратна връзка' },
  { value: 'MID_SERVICE',     label: 'Открит при сервиза' },
  { value: 'CUSTOM',          label: 'Персонализиран' },
]

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
        'placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ' +
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
        'placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ' +
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
        'focus:outline-none focus:ring-2 focus:ring-blue-500 ' +
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
  const [bayId,   setBayId]   = useState('')
  const [driverId, setDriverId] = useState('')
  const [mileage,  setMileage]  = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!bayId) { setError('Изберете бокс.'); return }
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
      if (!res.ok) { setError(json.error ?? 'Грешка.'); return }
      onDone(json.service); onClose()
    } catch { setError('Неуспешна връзка.') }
    finally   { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>Бокс *</Label>
        <Select value={bayId} onChange={(e) => setBayId(e.target.value)} className="w-full">
          <option value="">— Изберете бокс —</option>
          {bays.map((b) => (
            <option key={b.id} value={b.id} disabled={occupiedBayIds.includes(b.id)}>
              {b.name}{occupiedBayIds.includes(b.id) ? ' (зает)' : ''}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Шофьор (по избор)</Label>
        <Select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="w-full">
          <option value="">— Без шофьор —</option>
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
      </div>
      <div>
        <Label>Пробег при приемане (км)</Label>
        <Input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="напр. 450000" />
      </div>
      {error && <ErrorBox msg={error} />}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors text-sm">
          Откажи
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
          {loading ? 'Приемане...' : 'Приеми'}
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
  const [reason,  setReason]  = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) { setError('Въведете причина за отмяна.'); return }
    setError(''); setLoading(true)
    try {
      const res  = await fetch(`/api/services/${serviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED', cancellationReason: reason }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Грешка.'); return }
      onDone(json.service); onClose()
    } catch { setError('Неуспешна връзка.') }
    finally   { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-gray-400">Поръчката ще бъде отменена и запазена в историята.</p>
      <div>
        <Label>Причина за отмяна *</Label>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Въведете причина..." />
      </div>
      {error && <ErrorBox msg={error} />}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors text-sm">
          Назад
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
          {loading ? 'Отмяна...' : 'Отмени поръчката'}
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
  const [date,    setDate]    = useState(new Date(currentDate).toISOString().slice(0, 10))
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!date) { setError('Изберете дата.'); return }
    setError(''); setLoading(true)
    try {
      const res  = await fetch(`/api/services/${serviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledDate: date }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Грешка.'); return }
      onDone(json.service); onClose()
    } catch { setError('Неуспешна връзка.') }
    finally   { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>Нова планирана дата *</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} autoFocus />
      </div>
      {error && <ErrorBox msg={error} />}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors text-sm">
          Откажи
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
          {loading ? 'Запазване...' : 'Пренасрочи'}
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
  const [type,    setType]    = useState<SectionType>('MID_SERVICE')
  const [title,   setTitle]   = useState('Открит при сервиза')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  function handleTypeChange(t: SectionType) {
    setType(t)
    if (t === 'MID_SERVICE')     setTitle('Открит при сервиза')
    if (t === 'DRIVER_FEEDBACK') setTitle('Шофьорска обратна връзка')
    if (t === 'CUSTOM')          setTitle('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Въведете заглавие.'); return }
    setError(''); setLoading(true)
    try {
      const res  = await fetch(`/api/services/${serviceId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Грешка.'); return }
      onAdded(json.section); onClose()
    } catch { setError('Неуспешна връзка.') }
    finally   { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>Тип раздел</Label>
        <Select value={type} onChange={(e) => handleTypeChange(e.target.value as SectionType)} className="w-full">
          {SEC_ADD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>
      <div>
        <Label>Заглавие *</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заглавие на раздела" />
      </div>
      {error && <ErrorBox msg={error} />}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors text-sm">
          Откажи
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
          {loading ? 'Добавяне...' : 'Добави раздел'}
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
  const [description,   setDescription]   = useState(workCard?.description ?? '')
  const [mechanicId,    setMechanicId]    = useState(workCard?.mechanicId?.toString() ?? '')
  const [instructions,  setInstructions]  = useState(workCard?.specialInstructions ?? '')
  const [error,         setError]         = useState('')
  const [loading,       setLoading]       = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) { setError('Въведете описание.'); return }
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
      if (!res.ok) { setError(json.error ?? 'Грешка.'); return }
      onSaved(json.workCard); onClose()
    } catch { setError('Неуспешна връзка.') }
    finally   { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>Описание *</Label>
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Описание на работата" autoFocus />
      </div>
      <div>
        <Label>Механик</Label>
        <Select value={mechanicId} onChange={(e) => setMechanicId(e.target.value)} className="w-full">
          <option value="">— Без механик —</option>
          {mechanics.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
      </div>
      <div>
        <Label>Специални инструкции</Label>
        <Textarea rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)}
          placeholder="Допълнителни инструкции..." />
      </div>
      {error && <ErrorBox msg={error} />}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors text-sm">
          Откажи
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
          {loading ? 'Запазване...' : (mode === 'add' ? 'Добави карта' : 'Запази')}
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
  const [desc,    setDesc]    = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!desc.trim()) { setError('Въведете описание.'); return }
    setError(''); setLoading(true)
    try {
      const res  = await fetch(`/api/services/${serviceId}/feedback-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Грешка.'); return }
      onAdded(json.item); onClose()
    } catch { setError('Неуспешна връзка.') }
    finally   { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>Докладвана неизправност *</Label>
        <Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="напр. Шум при спиране" autoFocus />
      </div>
      {error && <ErrorBox msg={error} />}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors text-sm">
          Откажи
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
          {loading ? 'Добавяне...' : 'Добави'}
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
            <p className="text-xs text-gray-600 mt-1">{wc.parts.length} части</p>
          )}
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${WC_COLOR[wc.status]} shrink-0`}>
          {WC_LABEL[wc.status]}
        </span>
      </div>
      {!serviceTerminal && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <SmallBtn onClick={onEdit}>Редактирай</SmallBtn>
          <Link
            href={`/services/${serviceId}/work-cards/${wc.id}`}
            className="px-2.5 py-1 text-xs rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            Детайли →
          </Link>
          {wc.status !== 'CANCELLED' && wc.status !== 'COMPLETED' && canCancelWC && (
            <SmallBtn variant="danger" onClick={() => changeStatus('CANCELLED')} disabled={loading}>
              Отмени
            </SmallBtn>
          )}
          {wc.status === 'CANCELLED' && canReopenWC && (
            <SmallBtn variant="primary" onClick={() => changeStatus('REOPEN')} disabled={loading}>
              Отвори отново
            </SmallBtn>
          )}
          {wc.status !== 'CANCELLED' && wc.status !== 'COMPLETED' && canCompleteWC && (
            <SmallBtn variant="success" onClick={() => changeStatus('COMPLETED')} disabled={loading}>
              Завърши
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
      if (!res.ok) { setError(json.error ?? 'Грешка.'); return }
      onSaved(json.items as EquipmentCheckItem[])
    } catch { setError('Неуспешна връзка.') }
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
      if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Грешка.'); return }
      onSkipped(skipInput || `Пропуснато (${phase === 'INTAKE' ? 'Приемане' : 'Изход'})`)
      setShowSkip(false)
    } catch { setError('Неуспешна връзка.') }
    finally { setSkipping(false) }
  }

  const phaseLabel = phase === 'INTAKE' ? 'Приемане' : 'Изход'

  if (isSkipped) {
    return (
      <div className="py-3">
        <p className="text-sm text-amber-400">
          Проверката при {phaseLabel.toLowerCase()} е пропусната.
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
      <p className="py-3 text-sm text-gray-600">Не е извършена проверка.</p>
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
        <p className="text-sm text-gray-600">Няма позиции в списъка с оборудване.</p>
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
                          {s === 'PRESENT' ? 'Налично' : s === 'MISSING' ? 'Липсва' : 'Попълнено'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                {row.status !== 'PRESENT' && (
                  <input
                    value={row.explanation}
                    onChange={(e) => setRow(def.name, { explanation: e.target.value })}
                    placeholder="Бележка..."
                    className="mt-1.5 w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          {saving ? 'Запазване...' : 'Запази проверката'}
        </button>
        {!showSkip && (
          <button
            onClick={() => setShowSkip(true)}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Пропусни
          </button>
        )}
      </div>

      {showSkip && (
        <div className="space-y-2">
          <input
            value={skipInput}
            onChange={(e) => setSkipInput(e.target.value)}
            placeholder="Причина за пропускане (по избор)"
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowSkip(false)}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Отказ
            </button>
            <button
              onClick={skip}
              disabled={skipping}
              className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {skipping ? 'Пропускане...' : 'Потвърди пропускане'}
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
  const [showAddWC,   setShowAddWC]   = useState(false)
  const [editingWC,   setEditingWC]   = useState<WorkCard | null>(null)
  const [deleting,    setDeleting]    = useState(false)

  const doneCount = sec.checklistItems.filter((i) => i.isCompleted).length

  async function deleteSection() {
    if (!confirm('Изтриване на раздела?')) return
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
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">
            {SEC_LABEL[sec.type]}
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
            Изтрий
          </button>
        )}
      </div>

      {/* Content */}
      <div className="px-4">
        {sec.type === 'CHECKLIST' && (
          sec.checklistItems.length === 0 ? (
            <p className="py-4 text-sm text-gray-600">Няма елементи в контролния списък.</p>
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
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Приемане</p>
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
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 mt-3">Изход</p>
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
                <p className="py-4 text-sm text-gray-600">Проверката се извършва при Приемане.</p>
              )}
            </div>
          )
        })()}

        {(sec.type === 'DRIVER_FEEDBACK' || sec.type === 'MID_SERVICE' || sec.type === 'CUSTOM') && (
          sec.workCards.length === 0 ? (
            <p className="py-4 text-sm text-gray-600">Няма работни карти в този раздел.</p>
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
            + Добави работна карта
          </button>
        </div>
      )}

      {showAddWC && (
        <Modal title="Нова работна карта" onClose={() => setShowAddWC(false)}>
          <WorkCardModal
            mode="add" sectionId={sec.id} serviceId={serviceId} mechanics={mechanics}
            onClose={() => setShowAddWC(false)}
            onSaved={(wc) => { onWorkCardAdded(wc); setShowAddWC(false) }}
          />
        </Modal>
      )}
      {editingWC && (
        <Modal title="Редактиране на работна карта" onClose={() => setEditingWC(null)}>
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

// ─── Main component ───────────────────────────────────────────────────────────

const NEXT_STATUS_LABEL: Partial<Record<ServiceStatus, string>> = {
  INTAKE:        'Напредни → В процес',
  IN_PROGRESS:   'Напредни → Контрол на качеството',
  QUALITY_CHECK: 'Напредни → Готова',
  READY:         'Завърши поръчката',
}

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
  const [service,        setService]        = useState<FullService>(initialService)
  const [modal,          setModal]          = useState<ModalState>(null)
  const [feedbackText,   setFeedbackText]   = useState(initialService.driverFeedbackNotes ?? '')
  const [savingFB,       setSavingFB]       = useState(false)
  const [advancing,      setAdvancing]      = useState(false)
  const [stageWarnings,  setStageWarnings]  = useState<string[]>([])

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

  async function advanceStage(force = false) {
    setAdvancing(true)
    try {
      const res  = await fetch(`/api/services/${service.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const json = await res.json()
      if (!res.ok) { alert(json.error ?? 'Грешка.'); return }
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">

      {/* Back */}
      <Link href="/services" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 transition-colors">
        ← Назад към поръчките
      </Link>

      {/* Header card */}
      <div className="bg-gray-900 rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-mono text-2xl font-bold text-white">{service.truckPlateSnapshot}</h1>
              {service.truck.isAdr && (
                <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">ADR</span>
              )}
              {service.truck.frotcomVehicleId && (
                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">Frotcom</span>
              )}
            </div>
            <p className="text-sm text-gray-400">
              {service.truck.make} {service.truck.model}
              {service.truck.year ? ` · ${service.truck.year}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/services/${service.id}/print`}
              target="_blank"
              className="px-3 py-1.5 text-xs border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 rounded-lg transition-colors"
            >
              Печат
            </Link>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${SVC_COLOR[service.status]}`}>
              {SVC_LABEL[service.status]}
            </span>
          </div>
        </div>

        {/* Meta grid */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-600 mb-0.5">Планирана дата</p>
            <p className="text-gray-300">{fmtDate(service.scheduledDate)}</p>
          </div>
          {service.startDate && (
            <div>
              <p className="text-xs text-gray-600 mb-0.5">Приета</p>
              <p className="text-gray-300">{fmtDate(service.startDate)}</p>
            </div>
          )}
          {service.endDate && (
            <div>
              <p className="text-xs text-gray-600 mb-0.5">Приключена</p>
              <p className="text-gray-300">{fmtDate(service.endDate)}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-600 mb-0.5">Бокс</p>
            <p className="text-gray-300">{service.bayNameSnapshot ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-0.5">Шофьор</p>
            <p className="text-gray-300">{service.driverNameSnapshot ?? '—'}</p>
          </div>
          {service.mileageAtService !== null && (
            <div>
              <p className="text-xs text-gray-600 mb-0.5">Пробег при приемане</p>
              <p className="text-gray-300">{Math.round(service.mileageAtService).toLocaleString('bg-BG')} км</p>
            </div>
          )}
        </div>

        {/* Cancellation reason */}
        {service.cancellationReason && (
          <div className="mt-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-xs text-red-400 font-medium mb-0.5">Причина за отмяна</p>
            <p className="text-sm text-red-300">{service.cancellationReason}</p>
          </div>
        )}

        {/* Actions */}
        {!isTerminal && (
          <div className="mt-4 space-y-3">
            {/* Stage warnings */}
            {stageWarnings.length > 0 && (
              <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-xs font-semibold text-amber-400 mb-1">Предупреждения:</p>
                <ul className="text-sm text-amber-300 space-y-0.5 list-disc list-inside">
                  {stageWarnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => { setStageWarnings([]); advanceStage(true) }}
                    disabled={advancing}
                    className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    Продължи въпреки предупрежденията
                  </button>
                  <button onClick={() => setStageWarnings([])} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">
                    Откажи
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {service.status === 'SCHEDULED' && (
                <button
                  onClick={() => setModal('intake')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Приеми поръчката
                </button>
              )}
              {NEXT_STATUS_LABEL[service.status] && (
                <button
                  onClick={() => advanceStage(false)}
                  disabled={advancing}
                  className={`px-4 py-2 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 ${
                    service.status === 'READY'
                      ? 'bg-green-600 hover:bg-green-500'
                      : 'bg-blue-600 hover:bg-blue-500'
                  }`}
                >
                  {advancing ? 'Зареждане...' : NEXT_STATUS_LABEL[service.status]}
                </button>
              )}
              {service.status === 'SCHEDULED' && canReschedule && (
                <button
                  onClick={() => setModal('reschedule')}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl transition-colors"
                >
                  Пренасрочи
                </button>
              )}
              {canCancel && (
                <button
                  onClick={() => setModal('cancel')}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-red-400 text-sm rounded-xl transition-colors"
                >
                  Откажи поръчката
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Driver feedback items */}
      {(service.status !== 'SCHEDULED') && (
        <div className="bg-gray-900 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Докладвано от шофьора</h2>
            {!isTerminal && (
              <button onClick={() => setModal('addFeedback')}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                + Добави
              </button>
            )}
          </div>
          {service.driverFeedbackItems.length === 0 ? (
            <p className="text-sm text-gray-600">Няма докладвани неизправности.</p>
          ) : (
            <ul className="space-y-2 mb-4">
              {service.driverFeedbackItems.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-2">
                  <p className="text-sm text-gray-300">• {item.description}</p>
                  {!isTerminal && (
                    <button onClick={() => deleteFeedbackItem(item.id)}
                      className="text-gray-700 hover:text-red-400 transition-colors shrink-0 text-lg leading-none">×</button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <Label>Бележки от шофьора</Label>
            <Textarea
              rows={2}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Допълнителни бележки..."
              disabled={isTerminal}
            />
            {!isTerminal && feedbackText !== (service.driverFeedbackNotes ?? '') && (
              <button
                onClick={saveFeedbackNotes}
                disabled={savingFB}
                className="mt-2 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
              >
                {savingFB ? 'Запазване...' : 'Запази бележките'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sections */}
      {service.sections.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Раздели</h2>
          {service.sections.map((sec) => (
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
              onChecklistItemToggled={(updated) => checklistItemToggled(sec.id, updated)}
              onWorkCardAdded={(wc) => workCardAdded(sec.id, wc)}
              onWorkCardUpdated={(wc) => workCardUpdated(sec.id, wc)}
              onEquipmentCheckSaved={(items, phase) => equipmentCheckSaved(items, phase)}
              onEquipmentCheckSkipped={(phase, note) => equipmentCheckSkipped(phase, note)}
            />
          ))}
        </div>
      )}

      {/* Add section */}
      {!isTerminal && service.status !== 'SCHEDULED' && (
        <button
          onClick={() => setModal('addSection')}
          className="w-full py-3 border border-dashed border-gray-700 hover:border-gray-500 text-sm text-gray-500 hover:text-gray-300 rounded-xl transition-colors"
        >
          + Добави раздел
        </button>
      )}

      {/* Photos */}
      <PhotoGallery
        photos={service.photos}
        uploadUrl={`/api/services/${service.id}/photos`}
        deleteUrlFor={(id) => `/api/services/${service.id}/photos/${id}`}
        canUpload={canUploadPhoto && !isTerminal}
        onPhotoAdded={(p) => setService((prev) => ({ ...prev, photos: [...prev.photos, p] }))}
        onPhotoDeleted={(id) => setService((prev) => ({ ...prev, photos: prev.photos.filter((p) => p.id !== id) }))}
      />

      {/* Notes */}
      <NotesSection
        notes={service.notes}
        postUrl={`/api/services/${service.id}/notes`}
        canCreate={canCreateNote && !isTerminal}
        onNoteAdded={(n) => setService((prev) => ({ ...prev, notes: [...prev.notes, n] }))}
      />

      {/* ── Modals ── */}
      {modal === 'intake' && (
        <Modal title="Приемане на поръчката" onClose={() => setModal(null)}>
          <IntakeModal
            serviceId={service.id} bays={bays} drivers={drivers} occupiedBayIds={occupiedBayIds}
            onClose={() => setModal(null)} onDone={(svc) => setService(svc as FullService)}
          />
        </Modal>
      )}
      {modal === 'cancel' && (
        <Modal title="Отмяна на поръчката" onClose={() => setModal(null)}>
          <CancelServiceModal
            serviceId={service.id}
            onClose={() => setModal(null)}
            onDone={(svc) => mergeService(svc)}
          />
        </Modal>
      )}
      {modal === 'reschedule' && (
        <Modal title="Пренасрочване" onClose={() => setModal(null)}>
          <RescheduleModal
            serviceId={service.id} currentDate={service.scheduledDate}
            onClose={() => setModal(null)} onDone={(svc) => mergeService(svc)}
          />
        </Modal>
      )}
      {modal === 'addSection' && (
        <Modal title="Нов раздел" onClose={() => setModal(null)}>
          <AddSectionModal
            serviceId={service.id}
            onClose={() => setModal(null)} onAdded={sectionAdded}
          />
        </Modal>
      )}
      {modal === 'addFeedback' && (
        <Modal title="Докладвана неизправност" onClose={() => setModal(null)}>
          <AddFeedbackModal
            serviceId={service.id}
            onClose={() => setModal(null)} onAdded={feedbackItemAdded}
          />
        </Modal>
      )}
    </div>
  )
}
