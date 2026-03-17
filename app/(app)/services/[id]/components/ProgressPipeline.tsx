'use client'

import type { ServiceStatus } from '../types'
import { STAGE_ORDER } from '../types'
import { resolvedStageState } from '../helpers'
import { useTranslations } from 'next-intl'

interface ProgressPipelineProps {
  currentStatus: ServiceStatus
}

const DISPLAY_STAGES = STAGE_ORDER.slice(0, 5) // SCHEDULED through READY

function getDotClasses(stage: ServiceStatus, state: 'done' | 'active' | 'locked'): string {
  if (state === 'done') {
    return 'bg-blue-600 text-white'
  }
  if (state === 'active') {
    if (stage === 'READY') {
      return 'bg-emerald-600 text-white ring-4 ring-emerald-600/20'
    }
    return 'bg-blue-600 text-white ring-4 ring-blue-600/20'
  }
  return 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
}

function getLineClasses(state: 'done' | 'active' | 'locked'): string {
  if (state === 'done') {
    return 'bg-blue-600'
  }
  return 'bg-gray-200 dark:bg-gray-700'
}

function getLabelClasses(stage: ServiceStatus, state: 'done' | 'active' | 'locked'): string {
  if (state === 'done') {
    return 'text-blue-600 dark:text-blue-400 font-medium'
  }
  if (state === 'active') {
    if (stage === 'READY') {
      return 'text-emerald-700 dark:text-emerald-300 font-semibold'
    }
    return 'text-blue-700 dark:text-blue-300 font-semibold'
  }
  return 'text-gray-400 dark:text-gray-500'
}

export default function ProgressPipeline({ currentStatus }: ProgressPipelineProps) {
  const tService = useTranslations('service')

  return (
    <div className="flex items-center">
      {DISPLAY_STAGES.map((stage, i) => {
        const state = resolvedStageState(stage, currentStatus)
        const isLast = i === DISPLAY_STAGES.length - 1
        const dotClasses = getDotClasses(stage, state)
        const lineClasses = getLineClasses(state)
        const labelClasses = getLabelClasses(stage, state)

        return (
          <div key={stage} className="flex flex-col items-center gap-1 flex-1">
            <div className="flex items-center w-full">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${dotClasses}`}
              >
                {state === 'done' ? '✓' : i + 1}
              </div>
              {!isLast && <div className={`flex-1 h-0.5 ${lineClasses}`} />}
              {isLast && <div className="flex-1" />}
            </div>
            <span className={`text-xs ${labelClasses}`}>
              {tService(`status.${stage}`)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
