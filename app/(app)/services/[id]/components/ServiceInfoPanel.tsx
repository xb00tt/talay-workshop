'use client'

import { useTranslations } from 'next-intl'
import type { FullService } from '../types'
import { fmtDate } from '../helpers'

interface ServiceInfoPanelProps {
  service: FullService
  partsTotal: number
}

export default function ServiceInfoPanel({ service, partsTotal }: ServiceInfoPanelProps) {
  const tService = useTranslations('service')
  const tTruck = useTranslations('truck')
  const tWorkCard = useTranslations('workCard')

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/80 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700/80">
        <h3 className="font-semibold text-sm text-gray-800 dark:text-white">
          {tService('title')}
        </h3>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-3 text-sm">
        {/* Truck plate */}
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tTruck('plateNumber')}
          </span>
          <span className="font-semibold text-gray-800 dark:text-white">
            {service.truckPlateSnapshot}
          </span>
        </div>

        {/* Make / Model */}
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tTruck('makeModel')}
          </span>
          <span className="text-gray-700 dark:text-gray-300">
            {service.truck.make} {service.truck.model}
          </span>
        </div>

        {/* Year */}
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tTruck('year')}
          </span>
          <span className="text-gray-700 dark:text-gray-300">
            {service.truck.year ?? '—'}
          </span>
        </div>

        {/* Mileage at intake */}
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tService('mileageAtService')}
          </span>
          <span className="text-gray-700 dark:text-gray-300">
            {service.mileageAtService != null
              ? `${service.mileageAtService.toLocaleString()} km`
              : '—'}
          </span>
        </div>

        {/* Scheduled date */}
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tService('scheduledDate')}
          </span>
          <span className="text-gray-700 dark:text-gray-300">
            {fmtDate(service.scheduledDate)}
          </span>
        </div>

        {/* Intake date */}
        {service.startDate && (
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">
              {tService('startDate')}
            </span>
            <span className="text-gray-700 dark:text-gray-300">
              {fmtDate(service.startDate)}
            </span>
          </div>
        )}

        {/* Driver */}
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">
            {tService('driver')}
          </span>
          <span className="text-gray-700 dark:text-gray-300">
            {service.driverNameSnapshot ?? '—'}
          </span>
        </div>

        {/* ADR badge */}
        {service.truck.isAdr && (
          <div className="flex justify-between items-center">
            <span className="text-gray-500 dark:text-gray-400">ADR</span>
            <span className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20 text-xs font-semibold rounded-full px-2 py-0.5">
              ADR
            </span>
          </div>
        )}

        {/* Parts total */}
        <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700/80">
          <span className="text-gray-500 dark:text-gray-400">
            {tWorkCard('partsTotal')}
          </span>
          <span className="font-bold text-gray-900 dark:text-white">
            €{partsTotal.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  )
}
