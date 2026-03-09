import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function WorkCardPrintPage({
  params,
}: {
  params: Promise<{ id: string; cardId: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { id, cardId } = await params
  const serviceId = Number(id)
  const wcId      = Number(cardId)

  const [workCard, settings] = await Promise.all([
    prisma.workCard.findFirst({
      where: {
        id:             wcId,
        serviceSection: { serviceOrder: { id: serviceId } },
      },
      include: {
        parts:          true,
        serviceSection: {
          include: {
            serviceOrder: {
              include: {
                truck:  { select: { id: true, plateNumber: true, make: true, model: true, year: true } },
                driver: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.settings.findUnique({ where: { id: 1 } }),
  ])

  if (!workCard) notFound()

  const svc     = workCard.serviceSection.serviceOrder
  const truck   = svc.truck
  const section = workCard.serviceSection

  const lastService = await prisma.serviceOrder.findFirst({
    where:   { truckId: truck.id, status: 'COMPLETED', id: { not: serviceId } },
    orderBy: { endDate: 'desc' },
    include: {
      sections: {
        include: { workCards: { where: { status: 'COMPLETED' }, include: { parts: true } } },
      },
    },
  })

  function fmtDate(d: Date | string | null) {
    if (!d) return '—'
    const dt = new Date(d)
    return `${String(dt.getUTCDate()).padStart(2, '0')}.${String(dt.getUTCMonth() + 1).padStart(2, '0')}.${dt.getUTCFullYear()}`
  }

  const companyName    = settings?.companyName    || 'Talay Workshop'
  const companyAddress = settings?.companyAddress || ''

  const WC_STATUS: Record<string, string> = {
    PENDING: 'Изчакваща', ASSIGNED: 'Назначена',
    IN_PROGRESS: 'В процес', COMPLETED: 'Завършена', CANCELLED: 'Отменена',
  }

  const blankRows     = Math.max(0, 5 - workCard.parts.length)
  const lastWorkCards = lastService?.sections.flatMap((s) => s.workCards).filter((wc) => wc.status === 'COMPLETED') ?? []

  return (
    <div className="bg-white min-h-screen">
      {/* Print / back buttons */}
      <div className="print:hidden fixed top-4 right-4 z-10 flex gap-2">
        <button
          id="print-btn"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl cursor-pointer"
        >
          Принтирай
        </button>
        <a href={`/services/${serviceId}`} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-xl">
          ← Назад
        </a>
      </div>

      {/* A4 content */}
      <div className="text-gray-900 p-10 max-w-[210mm] mx-auto font-sans text-sm leading-snug">

        {/* Company header */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-gray-900">
          <div>
            <p className="text-xl font-bold">{companyName}</p>
            {companyAddress && <p className="text-gray-600 text-xs mt-0.5">{companyAddress}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">РАБОТНА КАРТА</p>
            <p className="text-gray-500 text-xs">#{workCard.id}</p>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="space-y-1.5">
            <PRow label="Камион" value={`${truck.plateNumber} — ${truck.make} ${truck.model}${truck.year ? ` (${truck.year})` : ''}`} />
            <PRow label="Раздел" value={section.title} />
            <PRow label="Шофьор" value={svc.driverNameSnapshot ?? '—'} />
          </div>
          <div className="space-y-1.5">
            <PRow label="Механик" value={workCard.mechanicName ?? '—'} />
            <PRow label="Статус"  value={WC_STATUS[workCard.status] ?? workCard.status} />
            <PRow label="Дата"    value={fmtDate(svc.scheduledDate)} />
          </div>
        </div>

        {/* Task description */}
        <PSec title="Описание на задачата">
          <p className="whitespace-pre-wrap">{workCard.description}</p>
        </PSec>

        {workCard.specialInstructions && (
          <PSec title="Специални инструкции">
            <p className="whitespace-pre-wrap font-medium">{workCard.specialInstructions}</p>
          </PSec>
        )}

        {/* Parts table */}
        <PSec title="Части и материали">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-1 font-semibold w-5/12">Наименование</th>
                <th className="text-left py-1 font-semibold w-3/12">Арт. номер</th>
                <th className="text-right py-1 font-semibold w-1/12">Кол.</th>
                <th className="text-right py-1 font-semibold w-2/12">Цена (€)</th>
              </tr>
            </thead>
            <tbody>
              {workCard.parts.map((p) => (
                <tr key={p.id} className="border-b border-gray-300">
                  <td className="py-1">{p.name}</td>
                  <td className="py-1 text-gray-500">{p.partNumber ?? '—'}</td>
                  <td className="py-1 text-right">{p.quantity}</td>
                  <td className="py-1 text-right">{p.unitCost !== null ? p.unitCost.toFixed(2) : '—'}</td>
                </tr>
              ))}
              {Array.from({ length: blankRows }).map((_, i) => (
                <tr key={`b${i}`} className="border-b border-gray-300 h-8"><td /><td /><td /><td /></tr>
              ))}
            </tbody>
          </table>
        </PSec>

        {/* Last service summary */}
        {lastService && (
          <PSec title="Последен сервиз — обобщение">
            <div className="text-xs text-gray-600 space-y-1">
              <p>
                <span className="font-medium">Дата:</span> {fmtDate(lastService.endDate)}
                {lastService.mileageAtService !== null
                  ? `  ·  Пробег: ${Math.round(lastService.mileageAtService).toLocaleString('bg-BG')} км`
                  : ''}
              </p>
              {lastWorkCards.length > 0 && (
                <>
                  <p className="font-medium">Извършена работа:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {lastWorkCards.map((wc) => <li key={wc.id}>{wc.description}</li>)}
                  </ul>
                </>
              )}
            </div>
          </PSec>
        )}

        {/* Signatures */}
        <div className="mt-10 grid grid-cols-2 gap-10">
          <div><div className="border-b border-gray-400 h-10 mb-1" /><p className="text-xs text-gray-500">Подпис механик</p></div>
          <div><div className="border-b border-gray-400 h-10 mb-1" /><p className="text-xs text-gray-500">Подпис приемащ</p></div>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          @page { size: A4; margin: 15mm; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
      <script dangerouslySetInnerHTML={{ __html: `document.getElementById('print-btn').onclick=function(){window.print()};` }} />
    </div>
  )
}

function PRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 shrink-0 w-20">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function PSec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-300 pb-1 mb-2">{title}</h3>
      {children}
    </div>
  )
}
