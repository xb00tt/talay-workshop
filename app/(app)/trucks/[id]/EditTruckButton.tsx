'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface Truck {
  id: number; plateNumber: string; make: string; model: string
  year: number | null; isAdr: boolean; mileageTriggerKm: number
  currentMileage: number | null; frotcomVehicleId: string | null
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        'w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white ' +
        'placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 ' +
        (props.className ?? '')
      }
    />
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{children}</label>
}

export default function EditTruckButton({ truck, canEdit }: { truck: Truck; canEdit: boolean }) {
  const router = useRouter()
  const t       = useTranslations('truck')
  const tCommon = useTranslations('common')

  const [open,    setOpen]    = useState(false)
  const [make,    setMake]    = useState(truck.make)
  const [model,   setModel]   = useState(truck.model)
  const [year,    setYear]    = useState(truck.year?.toString() ?? '')
  const [isAdr,   setIsAdr]   = useState(truck.isAdr)
  const [trigger, setTrigger] = useState(truck.mileageTriggerKm.toString())
  const [mileage, setMileage] = useState(truck.currentMileage?.toString() ?? '')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  if (!canEdit) return null

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/trucks/${truck.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          make, model,
          year: year ? Number(year) : null,
          isAdr,
          mileageTriggerKm: Number(trigger) || 30000,
          ...(!truck.frotcomVehicleId && mileage ? { currentMileage: Number(mileage) } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tCommon('error')); return }
      setOpen(false)
      router.refresh()
    } catch {
      setError(tCommon('connectionFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl transition-colors"
      >
        {tCommon('edit')}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('editTruck')}</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white text-xl leading-none">×</button>
            </div>
            <form onSubmit={save} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>{t('plateNumberShort')}</Label>
                  <Input value={truck.plateNumber} disabled className="opacity-60" />
                </div>
                <div>
                  <Label>{t('makeRequired')}</Label>
                  <Input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Volvo" required />
                </div>
                <div>
                  <Label>{t('modelRequired')}</Label>
                  <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="FH 500" required />
                </div>
                <div>
                  <Label>{t('year')}</Label>
                  <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2020" min="1900" max="2100" />
                </div>
                <div>
                  <Label>{t('mileageTrigger')}</Label>
                  <Input type="number" value={trigger} onChange={(e) => setTrigger(e.target.value)} min="1000" />
                </div>
                {!truck.frotcomVehicleId && (
                  <div className="col-span-2">
                    <Label>{t('currentMileageShort')}</Label>
                    <Input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="250000" min="0" />
                  </div>
                )}
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={isAdr} onChange={(e) => setIsAdr(e.target.checked)} className="w-4 h-4 accent-blue-500" />
                <span className="text-sm text-gray-600 dark:text-gray-300">{t('adrTruck')}</span>
              </label>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm">
                  {tCommon('cancel')}
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50">
                  {loading ? tCommon('saving') : tCommon('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
