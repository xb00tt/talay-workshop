/**
 * All permission action strings used in the app.
 * Stored as a JSON array on User.permissions.
 * MANAGERs implicitly have all permissions.
 * ASSISTANTs only have what is explicitly granted.
 */
export const PERMISSIONS = {
  SERVICE_CREATE: 'service.create',
  SERVICE_CANCEL: 'service.cancel',
  SERVICE_RESCHEDULE: 'service.reschedule',
  TRUCK_CREATE: 'truck.create',
  TRUCK_EDIT: 'truck.edit',
  TRUCK_DEACTIVATE: 'truck.deactivate',
  TRUCK_IMPORT: 'truck.import',
  WORKCARD_CREATE: 'workcard.create',
  WORKCARD_CANCEL: 'workcard.cancel',
  WORKCARD_REOPEN: 'workcard.reopen',
  WORKCARD_COMPLETE: 'workcard.complete',
  PHOTO_UPLOAD: 'photo.upload',
  NOTE_CREATE: 'note.create',
  REPORT_VIEW: 'report.view',
  REPORT_EXPORT: 'report.export',
  MECHANIC_MANAGE: 'mechanic.manage',
  CHECKLIST_EDIT: 'checklist.edit',
  EQUIPMENT_EDIT: 'equipment.edit',
  USER_MANAGE: 'user.manage',
  SETTINGS_EDIT: 'settings.edit',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export function hasPermission(
  role: string,
  permissions: string[],
  action: Permission,
): boolean {
  if (role === 'MANAGER') return true
  return permissions.includes(action)
}
