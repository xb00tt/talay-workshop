'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'

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
  const t       = useTranslations('report')
  const tCommon = useTranslations('common')

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
  const [exporting,    setExporting]    = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  const runReport = useCallback(async () => {
    if (from > to) { setError(t('dateRangeError')); return }
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ from, to })
      if (truckId) params.set('truckId', truckId)
      const res  = await fetch(`/api/reports?${params}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? tCommon('error')); return }
      setData(json)
    } catch { setError(tCommon('connectionFailed')) }
    finally { setLoading(false) }
  }, [from, to, truckId, tCommon])

  async function exportExcel() {
    if (!data) return
    setExporting(true)
    try {
      const XLSX = await import('xlsx')

      const wb = XLSX.utils.book_new()

      // Sheet 1: Services
      const svcRows = data.rows.map((r) => ({
        [t('colPlate')]:     r.plate,
        [t('colMakeModel')]: `${r.make} ${r.model}`,
        [t('colDate')]:      fmtDate(r.scheduledDate),
        [t('colDays')]:      r.daysInWorkshop ?? '',
        [t('colMileage')]:   r.mileageAtService ?? '',
        [t('colWorkCards')]: r.workCardCount,
        [t('colPartsCost')]: r.partsCost,
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(svcRows), t('tabServices'))

      // Sheet 2: Per truck
      const truckRows = data.truckSummary.map((tr) => ({
        [t('colPlate')]:     tr.plate,
        [t('colMakeModel')]: `${tr.make} ${tr.model}`,
        [t('colServices')]:  tr.serviceCount,
        [t('colTotalDays')]: Math.round(tr.totalDays * 10) / 10,
        [t('colPartsCost')]: Math.round(tr.totalPartsCost * 100) / 100,
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(truckRows), t('tabTrucks'))

      // Sheet 3: Parts usage
      const partRows = data.partsSummary.map((p) => ({
        [t('colParts')]:    p.name,
        [t('colTotalQty')]: Math.round(p.totalQty * 1000) / 1000,
        [t('colExpense')]:  Math.round(p.totalCost * 100) / 100,
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(partRows), t('tabParts'))

      XLSX.writeFile(wb, `report_${data.from}_${data.to}.xlsx`)
    } catch { alert(t('exportError')) }
    finally { setExporting(false) }
  }

  async function exportPdf() {
    if (!data) return
    setExportingPdf(true)
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])
      const doc = new jsPDF({ orientation: 'landscape' })
      const period = `${fmtDate(data.from)} – ${fmtDate(data.to)}`

      // Title
      doc.setFontSize(14)
      doc.text(t('title'), 14, 16)
      doc.setFontSize(10)
      doc.setTextColor(120)
      doc.text(period, 14, 23)
      doc.setTextColor(0)

      // Summary row
      doc.setFontSize(10)
      doc.text(`${t('completedServices')}: ${data.totals.services}   ${t('totalPartsCost')}: ${fmt(data.totals.partsCost)} €   ${t('avgDaysInWorkshop')}: ${fmt(data.totals.avgDays, 1)}`, 14, 31)

      let y = 38

      // Services table
      doc.setFontSize(11)
      doc.text(t('tabServices'), 14, y)
      y += 3
      autoTable(doc, {
        startY: y,
        head: [[t('colPlate'), t('colMakeModel'), t('colDate'), t('colDays'), t('colMileage'), t('colWorkCards'), t('colPartsCost')]],
        body: data.rows.map((r) => [
          r.plate,
          `${r.make} ${r.model}`,
          fmtDate(r.endDate),
          r.daysInWorkshop !== null ? fmt(r.daysInWorkshop, 1) : '—',
          r.mileageAtService !== null ? Math.round(r.mileageAtService).toLocaleString('bg-BG') : '—',
          r.workCardCount,
          r.partsCost > 0 ? `${fmt(r.partsCost)} €` : '—',
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      })

      // Per-truck table
      y = (doc as any).lastAutoTable.finalY + 10
      if (y > 170) { doc.addPage(); y = 14 }
      doc.setFontSize(11)
      doc.text(t('tabTrucks'), 14, y)
      y += 3
      autoTable(doc, {
        startY: y,
        head: [[t('colPlate'), t('colMakeModel'), t('colServices'), t('colTotalDays'), t('colPartsCost')]],
        body: data.truckSummary.map((tr) => [
          tr.plate,
          `${tr.make} ${tr.model}`,
          tr.serviceCount,
          fmt(tr.totalDays, 1),
          tr.totalPartsCost > 0 ? `${fmt(tr.totalPartsCost)} €` : '—',
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      })

      // Parts table
      y = (doc as any).lastAutoTable.finalY + 10
      if (y > 170) { doc.addPage(); y = 14 }
      doc.setFontSize(11)
      doc.text(t('tabParts'), 14, y)
      y += 3
      autoTable(doc, {
        startY: y,
        head: [[t('colParts'), t('colTotalQty'), t('colExpense')]],
        body: data.partsSummary.map((p) => [
          p.name,
          fmt(p.totalQty, 3),
          p.totalCost > 0 ? `${fmt(p.totalCost)} €` : '—',
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      })

      doc.save(`report_${data.from}_${data.to}.pdf`)
    } catch { alert(t('exportError')) }
    finally { setExportingPdf(false) }
  }

  function printReport() {
    window.print()
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('dateFrom')}</label>
            <input
              type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('dateTo')}</label>
            <input
              type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('truckOptional')}</label>
            <select
              value={truckId} onChange={(e) => setTruckId(e.target.value)}
              className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('selectAllTrucks')}</option>
              {trucks.map((tr) => (
                <option key={tr.id} value={tr.id}>{tr.plateNumber} — {tr.make} {tr.model}</option>
              ))}
            </select>
          </div>
          <button
            onClick={runReport}
            disabled={loading}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? t('generating') : t('generate')}
          </button>
        </div>
        {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}
      </div>

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: t('completedServices'), value: String(data.totals.services) },
              { label: t('totalPartsCost'),    value: fmt(data.totals.partsCost) },
              { label: t('avgDaysInWorkshop'), value: fmt(data.totals.avgDays, 1) },
            ].map((c) => (
              <div key={c.label} className="bg-white dark:bg-gray-900 rounded-xl p-4">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{c.value}</p>
              </div>
            ))}
          </div>

          {/* Export actions */}
          <div className="flex gap-2">
            {canExport && (
              <>
                <button
                  onClick={exportPdf}
                  disabled={exportingPdf}
                  className="px-4 py-2 text-sm border border-red-700 text-red-400 hover:bg-red-700/20 rounded-xl transition-colors disabled:opacity-50"
                >
                  {exportingPdf ? t('exporting') : t('downloadPdf')}
                </button>
                <button
                  onClick={exportExcel}
                  disabled={exporting}
                  className="px-4 py-2 text-sm border border-green-700 text-green-400 hover:bg-green-700/20 rounded-xl transition-colors disabled:opacity-50"
                >
                  {exporting ? t('exporting') : t('downloadExcel')}
                </button>
              </>
            )}
            <button
              onClick={printReport}
              className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors print:hidden"
            >
              {tCommon('print')}
            </button>
          </div>

          {/* Tab navigation */}
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
            {(['services', 'trucks', 'parts'] as const).map((tabKey) => {
              const labels = {
                services: t('tabServices'),
                trucks:   t('tabTrucks'),
                parts:    t('tabParts'),
              }
              return (
                <button
                  key={tabKey}
                  onClick={() => setTab(tabKey)}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    tab === tabKey
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  {labels[tabKey]}
                </button>
              )
            })}
          </div>

          {/* Services tab */}
          {tab === 'services' && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      {[
                        t('colPlate'), t('colMakeModel'), t('colDate'),
                        t('colDays'), t('colMileage'), t('colWorkCards'), t('colPartsCost'),
                      ].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {data.rows.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">{t('noServices')}</td></tr>
                    ) : data.rows.map((row) => (
                      <tr key={row.serviceId} className="hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-gray-900 dark:text-white">{row.plate}</td>
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
            <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      {[
                        t('colPlate'), t('colMakeModel'), t('colServices'),
                        t('colTotalDays'), t('colPartsCost'),
                      ].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {data.truckSummary.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">{t('noData')}</td></tr>
                    ) : data.truckSummary.map((tr) => (
                      <tr key={tr.truckId} className="hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-gray-900 dark:text-white">{tr.plate}</td>
                        <td className="px-4 py-3 text-gray-400">{tr.make} {tr.model}</td>
                        <td className="px-4 py-3 text-gray-400 tabular-nums">{tr.serviceCount}</td>
                        <td className="px-4 py-3 text-gray-400 tabular-nums">{fmt(tr.totalDays, 1)}</td>
                        <td className="px-4 py-3 text-gray-400 tabular-nums">
                          {tr.totalPartsCost > 0 ? `${fmt(tr.totalPartsCost)} €` : '—'}
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
            <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      {[t('colParts'), t('colTotalQty'), t('colExpense')].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {data.partsSummary.length === 0 ? (
                      <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500 text-sm">{t('noPartsUsed')}</td></tr>
                    ) : data.partsSummary.map((p, i) => (
                      <tr key={i} className="hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{p.name}</td>
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
