import type { Photo } from '@/components/PhotosAndNotes'

export type ServiceStatus   = 'SCHEDULED' | 'INTAKE' | 'IN_PROGRESS' | 'READY' | 'COMPLETED' | 'CANCELLED'
export type SectionType     = 'CHECKLIST' | 'DRIVER_FEEDBACK' | 'MID_SERVICE' | 'EQUIPMENT_CHECK' | 'CUSTOM'
export type WorkCardStatus  = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export interface ChecklistItem {
  id: number; description: string; isCompleted: boolean
  completedAt: string | null; completedByName: string | null
}
export interface WCNote  { id: number; content: string; userNameSnapshot: string; createdAt: string }
export interface WCPhoto { id: number; caption: string | null; filePath: string; createdAt: string }
export interface Part    { id: number; name: string; partNumber: string | null; quantity: number; unitCost: number | null }
export interface WorkCard {
  id: number; description: string; mechanicId: number | null; mechanicName: string | null
  status: WorkCardStatus; specialInstructions: string | null
  cancelledAt: string | null; reopenedAt: string | null
  mechanic: { id: number; name: string } | null
  parts: Part[]; notes: WCNote[]; photos: WCPhoto[]
}
export interface Section {
  id: number; type: SectionType; title: string; order: number
  intakeSkippedAt: string | null; intakeSkipNote: string | null
  exitSkippedAt:   string | null; exitSkipNote:   string | null
  checklistItems: ChecklistItem[]; workCards: WorkCard[]
}
export interface FeedbackItem { id: number; description: string; order: number }
export interface EquipmentCheckItem { id: number; itemName: string; status: 'PRESENT' | 'MISSING' | 'RESTOCKED'; explanation: string | null; checkType: 'INTAKE' | 'EXIT' }
export interface EqItemDef { id: number; name: string; description: string | null }
export interface SnapshotItem { itemName: string; status: 'PRESENT' | 'MISSING' | 'RESTOCKED' }
export interface ServiceNote  { id: number; content: string; userNameSnapshot: string; createdAt: string }
export interface FullService {
  id: number; truckPlateSnapshot: string; status: ServiceStatus
  scheduledDate: string; startDate: string | null; endDate: string | null
  mileageAtService: number | null
  driverId: number | null; driverNameSnapshot: string | null
  driverFeedbackNotes: string | null; mechanicFeedbackNotes: string | null
  cancellationReason: string | null; createdAt: string
  truck: { id: number; make: string; model: string; year: number | null; isAdr: boolean; frotcomVehicleId: string | null }
  driver: { id: number; name: string } | null
  sections: Section[]
  equipmentCheckItems: EquipmentCheckItem[]
  driverFeedbackItems: FeedbackItem[]
  mechanicFeedbackItems: FeedbackItem[]
  notes: ServiceNote[]
  photos: Photo[]
}
export interface Driver   { id: number; name: string }
export interface Mechanic { id: number; name: string }

export type ModalState = 'intake' | 'cancel' | 'reschedule' | 'addSection' | 'equipmentCheck' | 'confirmAdvance' | 'serviceHistory' | null

export const STAGE_ORDER: ServiceStatus[] = [
  'SCHEDULED', 'INTAKE', 'IN_PROGRESS', 'READY', 'COMPLETED',
]
