/**
 * Shared status type definitions and Tailwind color mappings.
 */

export type ServiceStatus =
  | 'SCHEDULED'
  | 'INTAKE'
  | 'IN_PROGRESS'
  | 'QUALITY_CHECK'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED'

export type WorkCardStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'

/** Full badge with border — use for table rows, status chips */
export const SERVICE_STATUS_COLOR: Record<ServiceStatus, string> = {
  SCHEDULED:     'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-600/20 dark:text-slate-300 dark:border-slate-600/30',
  INTAKE:        'bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
  IN_PROGRESS:   'bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  QUALITY_CHECK: 'bg-violet-50 text-violet-700 border border-violet-100 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20',
  READY:         'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  COMPLETED:     'bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-700/30 dark:text-gray-400 dark:border-gray-700/50',
  CANCELLED:     'bg-red-50 text-red-600 border border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
}

/** Text + subtle bg only — use for inline status labels (breadcrumbs, headers) */
export const SERVICE_STATUS_PILL: Record<ServiceStatus, string> = {
  SCHEDULED:     'bg-slate-600/20 text-slate-300',
  INTAKE:        'bg-blue-500/10 text-blue-400',
  IN_PROGRESS:   'bg-amber-500/10 text-amber-400',
  QUALITY_CHECK: 'bg-violet-500/10 text-violet-400',
  READY:         'bg-emerald-500/10 text-emerald-400',
  COMPLETED:     'bg-gray-700/30 text-gray-400',
  CANCELLED:     'bg-red-500/10 text-red-400',
}

export const WC_STATUS_COLOR: Record<WorkCardStatus, string> = {
  PENDING:     'bg-gray-100 text-gray-600 dark:bg-gray-600/20 dark:text-gray-400',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-600/20 dark:text-indigo-400',
  COMPLETED:   'bg-green-100 text-green-700 dark:bg-green-600/20 dark:text-green-400',
  CANCELLED:   'bg-red-100 text-red-700 dark:bg-red-600/20 dark:text-red-400',
}
