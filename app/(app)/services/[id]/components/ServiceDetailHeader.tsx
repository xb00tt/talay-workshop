'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { SERVICE_STATUS_COLOR } from '@/lib/status-config'
import type { FullService } from '../types'
import { STAGE_ORDER } from '../types'
import ProgressPipeline from './ProgressPipeline'

interface ServiceDetailHeaderProps {
  service: FullService
  canReschedule: boolean
  canCancel: boolean
  warnings: string[]
  onAdvance: () => void
  onRegress: () => void
  onPrint: () => void
  onReschedule: () => void
  onCancel: () => void
  onStartIntake: () => void
}

export default function ServiceDetailHeader({
  service,
  canReschedule,
  canCancel,
  warnings,
  onAdvance,
  onRegress,
  onPrint,
  onReschedule,
  onCancel,
  onStartIntake,
}: ServiceDetailHeaderProps) {
  const tService = useTranslations('service')
  const tCommon  = useTranslations('common')

  const { status } = service
  const currentIdx = STAGE_ORDER.indexOf(status)
  const nextStage = currentIdx >= 0 && currentIdx < STAGE_ORDER.length - 1
    ? STAGE_ORDER[currentIdx + 1]
    : null

  const isActive = status === 'INTAKE' || status === 'IN_PROGRESS'
  const isTerminal = status === 'COMPLETED' || status === 'CANCELLED'

  /* ── shared button styles ── */
  const outline =
    'text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
  const redOutline =
    'text-sm text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors'
  const primaryBlue =
    'text-sm text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg font-medium transition-colors'
  const amber =
    'text-sm text-white bg-amber-600 hover:bg-amber-500 px-3 py-1.5 rounded-lg font-medium transition-colors'
  const emerald =
    'text-sm text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg font-medium transition-colors'

  /* ── inline SVG icons ── */
  const iconClass = 'w-4 h-4'

  const ChevronLeft = (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
    </svg>
  )

  const PrintIcon = (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  )

  const CalendarIcon = (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )

  const WarningIcon = (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )

  const CheckIcon = (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
    </svg>
  )

  /* ── action buttons per status ── */
  function renderActions() {
    if (status === 'SCHEDULED') {
      return (
        <>
          {canReschedule && (
            <button className={outline} onClick={onReschedule}>
              <span className="inline-flex items-center gap-1.5">
                {CalendarIcon}
                {tService('reschedule')}
              </span>
            </button>
          )}
          <button className={primaryBlue} onClick={onStartIntake}>
            {tService('moveToIntake')}
          </button>
          {canCancel && (
            <button className={redOutline} onClick={onCancel}>
              {tService('cancelOrder')}
            </button>
          )}
        </>
      )
    }

    if (isActive) {
      const hasWarnings = warnings.length > 0
      const advanceBtnClass = hasWarnings ? amber : primaryBlue
      const advanceLabel = nextStage
        ? `${tService('advance')} \u2192 ${tService(`status.${nextStage}`)}`
        : tService('advance')

      return (
        <>
          <button className={outline} onClick={onPrint}>
            <span className="inline-flex items-center gap-1.5">
              {PrintIcon}
              {tCommon('print')}
            </span>
          </button>
          <button className={advanceBtnClass} onClick={onAdvance}>
            <span className="inline-flex items-center gap-1.5">
              {hasWarnings && WarningIcon}
              {advanceLabel}
            </span>
          </button>
          {canCancel && (
            <button className={redOutline} onClick={onCancel}>
              {tService('cancelOrder')}
            </button>
          )}
        </>
      )
    }

    if (status === 'READY') {
      return (
        <>
          <button className={outline} onClick={onPrint}>
            <span className="inline-flex items-center gap-1.5">
              {PrintIcon}
              {tCommon('print')}
            </span>
          </button>
          <button className={outline} onClick={onRegress}>
            {tService('returnToInProgress')}
          </button>
          <button className={emerald} onClick={onAdvance}>
            <span className="inline-flex items-center gap-1.5">
              {CheckIcon}
              {tService('moveToCompleted')}
            </span>
          </button>
          {canCancel && (
            <button className={redOutline} onClick={onCancel}>
              {tService('cancelOrder')}
            </button>
          )}
        </>
      )
    }

    if (isTerminal) {
      return (
        <button className={outline} onClick={onPrint}>
          <span className="inline-flex items-center gap-1.5">
            {PrintIcon}
            {tCommon('print')}
          </span>
        </button>
      )
    }

    return null
  }

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700/80 px-6 lg:px-8 py-4 sticky top-0 z-10">
      {/* Row 1: Breadcrumb + Actions */}
      <div className="flex items-center justify-between mb-3">
        {/* Left: breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Link
            href="/services"
            className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            {ChevronLeft}
            {tService('list')}
          </Link>
          <span>/</span>
          <span className="font-bold text-gray-900 dark:text-white">
            {service.truckPlateSnapshot}
          </span>
          <span
            className={
              SERVICE_STATUS_COLOR[service.status] +
              ' text-xs font-semibold rounded-full px-2 py-0.5 ml-1'
            }
          >
            {tService(`status.${service.status}`)}
          </span>
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-2">
          {renderActions()}
        </div>
      </div>

      {/* Row 2: ProgressPipeline */}
      <ProgressPipeline currentStatus={service.status} />
    </header>
  )
}
