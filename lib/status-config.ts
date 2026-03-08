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
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'

export const SERVICE_STATUS_COLOR: Record<ServiceStatus, string> = {
  SCHEDULED:     'bg-amber-100 text-amber-700 dark:bg-amber-600/20 dark:text-amber-400',
  INTAKE:        'bg-blue-100 text-blue-700 dark:bg-blue-600/20 dark:text-blue-400',
  IN_PROGRESS:   'bg-indigo-100 text-indigo-700 dark:bg-indigo-600/20 dark:text-indigo-400',
  QUALITY_CHECK: 'bg-purple-100 text-purple-700 dark:bg-purple-600/20 dark:text-purple-400',
  READY:         'bg-green-100 text-green-700 dark:bg-green-600/20 dark:text-green-400',
  COMPLETED:     'bg-gray-100 text-gray-600 dark:bg-gray-600/20 dark:text-gray-400',
  CANCELLED:     'bg-red-100 text-red-700 dark:bg-red-600/20 dark:text-red-400',
}

export const WC_STATUS_COLOR: Record<WorkCardStatus, string> = {
  PENDING:     'bg-gray-100 text-gray-600 dark:bg-gray-600/20 dark:text-gray-400',
  ASSIGNED:    'bg-blue-100 text-blue-700 dark:bg-blue-600/20 dark:text-blue-400',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-600/20 dark:text-indigo-400',
  COMPLETED:   'bg-green-100 text-green-700 dark:bg-green-600/20 dark:text-green-400',
  CANCELLED:   'bg-red-100 text-red-700 dark:bg-red-600/20 dark:text-red-400',
}
