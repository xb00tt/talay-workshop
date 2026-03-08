'use client'

import { useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TruckOption { id: number; plateNumber: string; make: string; model: string }

interface ServiceRow {
  serviceId: number; plate: string; truckId: number; make: string; model: string
  scheduledDate: string; startDate: string | null; endDate: string | null
  mileageAtService: number | null; daysInWorkshop: number | null
  partsCost: number; workCardCount: number
}

interface TruckSummary {
  truckId: number; plate: string; make: string; model: string
  serviceCount: number; totalPartsCost: number; totalDays: number
}

interface PartSummary { name: string; totalQty: number; totalCost: number }

interface ReportData {
  from: string; to: string
  rows: ServiceRow[]
  truckSummary: TruckSummary[]
  partsSummary: PartSummary[]
  totals: { services: number; partsCost: number; avgDays: number }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null, decimals = 2) {
  if (n === null) return '—'
  return n.toLocaleString('bg-BG', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
function fmtDate(d: string | null) { return d ? d.split('-').reverse().join('.') : '—' }

// ─── Props ────────────────────────────────────────────────────────────────────

export default function ReportsClient({ trucks, canExport }: { trucks: TruckOption[]; canExport: boolean }) {
  const today    = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const todayStr = today.toISOString().slice(0, 10)

  const [from,     setFrom]     = useState(firstDay)
  const [to,       setTo]       = useState(todayStr)
  const [truckId,  setTruckId]  = useState('')
  const [data,     setData]     = useState<ReportData | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [tab,      setTab]      = useState<'services' | 'trucks' | 'parts'>('services')
  const [exporting, setExporting] = useState(false)

  const runReport = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ from, to })
      if (truckId) params.set('truckId', truckId)
      const res  = await fetch(`/api/reports?${params}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Грешка.'); return }
      setData(json)
    } catch { setError('Неуспешна връзка.') }
    finally { setLoading(false) }
  }, [from, to, truckId])

  async function exportExcel() {
    if (!data) return
    setExporting(true)
    try {
      const XLSX = await import('xlsx')

      const wb = XLSX.utils.book_new()

      // Sheet 1: Services
      const svcRows = data.rows.map((r) => ({
        'Рег. №':      r.plate,
        'Марка/Модел': `${r.make} ${r.model}`,
        'Дата насроч.': fmtDate(r.scheduledDate),
        'Дата старт':  fmtDate(r.startDate),
        'Дата край':   fmtDate(r.endDate),
        'Дни в серв.': r.daysInWorkshop ?? '',
        'Пробег':      r.mileageAtService ?? '',
        'Раб. карти':  r.workCardCount,
        'Части (€)':   r.partsCost,
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(svcRows), 'Сервизи')

      // Sheet 2: Per truck
      const truckRows = data.truckSummary.map((t) => ({
        'Рег. №':      t.plate,
        'Марка/Модел': `${t.make} ${t.model}`,
        'Сервизи':     t.serviceCount,
        'Общо дни':    Math.round(t.totalDays * 10) / 10,
        'Части (€)':   Math.round(t.totalPartsCost * 100) / 100,
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(truckRows), 'По камион')

      // Sheet 3: Parts usage
      const partRows = data.partsSummary.map((p) => ({
        'Части':      p.name,
        'Кол-во':     Math.round(p.totalQty * 1000) / 1000,
        'Разход (€)': Math.round(p.totalCost * 100) / 100,
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(partRows), 'Части')

      XLSX.writeFile(wb, `report_${data.from}_${data.to}.xlsx`)
    } catch { alert('Грешка при експорт.') }
    finally { setExporting(false) }
  }

  function printReport() {
    window.print()
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Отчети</h1>
      </div>

      {/* Filters */}
      <div className="bg-gray-900 rounded-2xl p-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">От дата</label>
            <input
              type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">До дата</label>
            <input
              type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Камион (по избор)</label>
            <select
              value={truckId} onChange={(e) => setTruckId(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Всички камиони</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>{t.plateNumber} — {t.make} {t.model}</option>
              ))}
            </select>
          </div>
          <button
            onClick={runReport}
            disabled={loading}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? 'Генериране...' : 'Генерирай'}
          </button>
        </div>
        {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}
      </div>

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Завършени сервизи', value: String(data.totals.services) },
              { label: 'Общо части (€)',    value: fmt(data.totals.partsCost) },
              { label: 'Ср. дни в серв.',   value: fmt(data.totals.avgDays, 1) },
            ].map((c) => (
              <div key={c.label} className="bg-gray-900 rounded-xl p-4">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{c.value}</p>
              </div>
            ))}
          </div>

          {/* Export actions */}
          <div className="flex gap-2">
            {canExport && (
              <button
                onClick={exportExcel}
                disabled={exporting}
                className="px-4 py-2 text-sm border border-green-700 text-green-400 hover:bg-green-700/20 rounded-xl transition-colors disabled:opacity-50"
              >
                {exporting ? 'Експорт...' : 'Изтегли Excel'}
              </button>
            )}
            <button
              onClick={printReport}
              className="px-4 py-2 text-sm border border-gray-700 text-gray-400 hover:bg-gray-800 rounded-xl transition-colors print:hidden"
            >
              Печат
            </button>
          </div>

          {/* Tab navigation */}
          <div className="flex gap-1 border-b border-gray-800">
            {(['services', 'trucks', 'parts'] as const).map((t) => {
              const labels = { services: 'Сервизи', trucks: 'По камион', parts: 'Части' }
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    tab === t
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {labels[t]}
                </button>
              )
            })}
          </div>

          {/* Services tab */}
          {tab === 'services' && (
            <div className="bg-gray-900 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {['Рег. №', 'Марка/Модел', 'Дата', 'Дни', 'Пробег', 'Раб. карти', 'Части (€)'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {data.rows.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">Няма завършени сервизи за периода.</td></tr>
                    ) : data.rows.map((row) => (
                      <tr key={row.serviceId} className="hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-white">{row.plate}</td>
                        <td className="px-4 py-3 text-gray-400">{row.make} {row.model}</td>
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmtDate(row.endDate)}</td>
                        <td className="px-4 py-3 text-gray-400 tabular-nums">{fmt(row.daysInWorkshop, 1)}</td>
                        <td className="px-4 py-3 text-gray-400 tabular-nums">
                          {row.mileageAtService !== null ? Math.round(row.mileageAtService).toLocaleString('bg-BG') : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-400 tabular-nums">{row.workCardCount}</td>
                        <td className="px-4 py-3 text-gray-400 tabular-nums">
                          {row.partsCost > 0 ? `${fmt(row.partsCost)} €` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Per-truck tab */}
          {tab === 'trucks' && (
            <div className="bg-gray-900 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {['Рег. №', 'Марка/Модел', 'Сервизи', 'Общо дни', 'Части (€)'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {data.truckSummary.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">Няма данни.</td></tr>
                    ) : data.truckSummary.map((t) => (
                      <tr key={t.truckId} className="hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-white">{t.plate}</td>
                        <td className="px-4 py-3 text-gray-400">{t.make} {t.model}</td>
                        <td className="px-4 py-3 text-gray-400 tabular-nums">{t.serviceCount}</td>
                        <td className="px-4 py-3 text-gray-400 tabular-nums">{fmt(t.totalDays, 1)}</td>
                        <td className="px-4 py-3 text-gray-400 tabular-nums">
                          {t.totalPartsCost > 0 ? `${fmt(t.totalPartsCost)} €` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Parts tab */}
          {tab === 'parts' && (
            <div className="bg-gray-900 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {['Части', 'Общо кол-во', 'Разход (€)'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {data.partsSummary.length === 0 ? (
                      <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500 text-sm">Няма използвани части.</td></tr>
                    ) : data.partsSummary.map((p, i) => (
                      <tr key={i} className="hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3 text-gray-200">{p.name}</td>
                        <td className="px-4 py-3 text-gray-400 tabular-nums">{fmt(p.totalQty, 3)}</td>
                        <td className="px-4 py-3 text-gray-400 tabular-nums">
                          {p.totalCost > 0 ? `${fmt(p.totalCost)} €` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
