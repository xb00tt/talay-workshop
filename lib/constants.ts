/** Rolling session duration in seconds (1 hour) */
export const SESSION_MAX_AGE = 60 * 60;

/** SWR polling interval in milliseconds (30 seconds) */
export const POLLING_INTERVAL = 30_000;

/** Dashboard upcoming services queue cap */
export const DASHBOARD_QUEUE_SIZE = 10;

/** Default mileage alert threshold (km) */
export const DEFAULT_MILEAGE_TRIGGER_KM = 30_000;

/** Default pagination page size */
export const DEFAULT_PAGE_SIZE = 10;

/** Maximum photo dimension (px) on longest side — resized on upload */
export const PHOTO_MAX_DIMENSION = 2000;

/** Photo compression quality (0–100) */
export const PHOTO_QUALITY = 85;

/** Frotcom API base URL */
export const FROTCOM_BASE_URL = "https://v2api.frotcom.com/v2";

/** Date display format */
export const DATE_FORMAT = "dd.MM.yyyy";

/** Currency symbol */
export const CURRENCY = "€";

/** Auto-created section titles (used at Intake) */
export const SECTION_TITLES = {
  CHECKLIST: "Чеклист",
  EQUIPMENT_CHECK: "Проверка на оборудването",
} as const;

/** Service order status display order */
export const STATUS_ORDER = [
  "SCHEDULED",
  "INTAKE",
  "IN_PROGRESS",
  "QUALITY_CHECK",
  "READY",
  "COMPLETED",
  "CANCELLED",
] as const;

/** Permission action strings */
export const PERMISSIONS = {
  SERVICE_CREATE: "service.create",
  SERVICE_CANCEL: "service.cancel",
  SERVICE_RESCHEDULE: "service.reschedule",
  TRUCK_CREATE: "truck.create",
  TRUCK_EDIT: "truck.edit",
  TRUCK_DEACTIVATE: "truck.deactivate",
  TRUCK_IMPORT: "truck.import",
  WORKCARD_CREATE: "workcard.create",
  WORKCARD_CANCEL: "workcard.cancel",
  WORKCARD_REOPEN: "workcard.reopen",
  WORKCARD_COMPLETE: "workcard.complete",
  PHOTO_UPLOAD: "photo.upload",
  NOTE_CREATE: "note.create",
  REPORT_VIEW: "report.view",
  REPORT_EXPORT: "report.export",
  BAY_MANAGE: "bay.manage",
  MECHANIC_MANAGE: "mechanic.manage",
  CHECKLIST_EDIT: "checklist.edit",
  EQUIPMENT_EDIT: "equipment.edit",
  USER_MANAGE: "user.manage",
  SETTINGS_EDIT: "settings.edit",
} as const;

export type PermissionAction = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
