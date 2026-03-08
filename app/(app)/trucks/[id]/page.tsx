import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Планирана', INTAKE: 'Приемане', IN_PROGRESS: 'В процес',
  QUALITY_CHECK: 'Контрол', READY: 'Готова', COMPLETED: 'Завършена', CANCELLED: 'Отменена',
}
const STATUS_COLOR: Record<string, string> = {
  SCHEDULED:     'bg-amber-600/20 text-amber-400',
  INTAKE:        'bg-blue-600/20 text-blue-400',
  IN_PROGRESS:   'bg-indigo-600/20 text-indigo-400',
  QUALITY_CHECK: 'bg-purple-600/20 text-purple-400',
  READY:         'bg-green-600/20 text-green-400',
  COMPLETED:     'bg-gray-600/20 text-gray-400',
  CANCELLED:     'bg-red-600/20 text-red-400',
}

function fmtDate(d: Date | string | null) {
  if (!d) return '—'
  const dt = new Date(d)
  return `${String(dt.getUTCDate()).padStart(2, '0')}.${String(dt.getUTCMonth() + 1).padStart(2, '0')}.${dt.getUTCFullYear()}`
}
function fmtKm(km: number | null) {
  if (km === null) return '—'
  return `${Math.round(km).toLocaleString('bg-BG')} км`
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800/60 rounded-xl p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

export default async function TruckProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { id } = await params
  const truckId = Number(id)
  if (isNaN(truckId)) notFound()

  const truck = await prisma.truck.findUnique({
    where: { id: truckId },
    include: {
      serviceOrders: {
        orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          bay:    { select: { name: true } },
          driver: { select: { name: true } },
          sections: {
            include: {
              workCards: {
                where:   { status: 'COMPLETED' },
                include: { parts: true },
              },
            },
          },
        },
      },
    },
  })

  if (!truck) notFound()

  const { role, permissions } = session.user
  const canEdit = hasPermission(role, permissions, 'truck.edit')

  const completedServices = truck.serviceOrders.filter((s) => s.status === 'COMPLETED')
  const activeService     = truck.serviceOrders.find(
    (s) => !['COMPLETED', 'CANCELLED'].includes(s.status),
  )

  const totalPartsCost = completedServices.reduce((sum, svc) => {
    const cost = svc.sections
      .flatMap((s) => s.workCards)
      .flatMap((wc) => wc.parts)
      .reduce((s2, p) => s2 + (p.unitCost ?? 0) * p.quantity, 0)
    return sum + cost
  }, 0)

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">

      <Link href="/trucks" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 transition-colors">
        ← Назад към камионите
      </Link>

      {/* Header */}
      <div className="bg-gray-900 rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-mono text-2xl font-bold text-white">{truck.plateNumber}</h1>
              {truck.isAdr && (
                <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">ADR</span>
              )}
              {truck.frotcomVehicleId && (
                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">Frotcom</span>
              )}
              {!truck.isActive && (
                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-700/50 text-gray-500">Неактивен</span>
              )}
            </div>
            <p className="text-gray-400">
              {truck.make} {truck.model}{truck.year ? ` · ${truck.year}` : ''}
            </p>
          </div>
          {canEdit && (
            <Link
              href="/trucks"
              className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors"
            >
              Редактирай
            </Link>
          )}
        </div>

        {/* Stats grid */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Текущ пробег"      value={fmtKm(truck.currentMileage)} />
          <StatCard label="Лимит за сервиз"   value={fmtKm(truck.mileageTriggerKm)} />
          <StatCard label="Завършени сервизи" value={String(completedServices.length)} />
          <StatCard label="Разходи за части"  value={totalPartsCost > 0 ? `${totalPartsCost.toFixed(2)} €` : '—'} />
        </div>

        {/* Active service banner */}
        {activeService && (
          <Link
            href={`/services/${activeService.id}`}
            className="mt-4 flex items-center justify-between px-4 py-3 bg-blue-600/10 border border-blue-500/30 rounded-xl hover:bg-blue-600/20 transition-colors"
          >
            <div>
              <p className="text-xs text-blue-400 font-medium mb-0.5">Активна поръчка</p>
              <p className="text-sm text-white">
                {STATUS_LABEL[activeService.status]} · {fmtDate(activeService.scheduledDate)}
                {activeService.bayNameSnapshot ? ` · Бокс: ${activeService.bayNameSnapshot}` : ''}
              </p>
            </div>
            <span className="text-blue-400 text-lg">→</span>
          </Link>
        )}
      </div>

      {/* Service history */}
      <div className="bg-gray-900 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">
            История на сервизите ({truck.serviceOrders.length})
          </h2>
        </div>

        {truck.serviceOrders.length === 0 ? (
          <p className="px-5 py-10 text-sm text-gray-500 text-center">Няма сервизни поръчки.</p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {truck.serviceOrders.map((svc) => {
              const workDone   = svc.sections.flatMap((s) => s.workCards)
              const partsCost  = workDone.flatMap((wc) => wc.parts)
                .reduce((sum, p) => sum + (p.unitCost ?? 0) * p.quantity, 0)
              return (
                <li key={svc.id}>
                  <Link
                    href={`/services/${svc.id}`}
                    className="flex items-start justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[svc.status]}`}>
                          {STATUS_LABEL[svc.status]}
                        </span>
                        <span className="text-sm text-gray-300">{fmtDate(svc.scheduledDate)}</span>
                      </div>
                      {svc.bayNameSnapshot && (
                        <p className="text-xs text-gray-500">Бокс: {svc.bayNameSnapshot}</p>
                      )}
                      {svc.driverNameSnapshot && (
                        <p className="text-xs text-gray-500">Шофьор: {svc.driverNameSnapshot}</p>
                      )}
                      {workDone.length > 0 && (
                        <p className="text-xs text-gray-600 mt-1">
                          {workDone.length} завършени работни карти
                        </p>
                      )}
                      {svc.cancellationReason && (
                        <p className="text-xs text-red-500 mt-1">
                          Отменена: {svc.cancellationReason}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {svc.mileageAtService !== null && (
                        <p className="text-sm text-gray-300 tabular-nums">{fmtKm(svc.mileageAtService)}</p>
                      )}
                      {partsCost > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">{partsCost.toFixed(2)} €</p>
                      )}
                      <p className="text-gray-600 text-sm mt-1">→</p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
