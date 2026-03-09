import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import EditTruckButton from './EditTruckButton'

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

function StatCard({ label, value, sub, alert }: { label: string; value: string; sub?: string; alert?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${alert ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-gray-100 dark:bg-gray-800/60'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-sm font-semibold ${alert ? 'text-amber-400' : 'text-gray-900 dark:text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
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

  const lastCompleted = completedServices[0] ?? null
  const lastServiceMileage = lastCompleted?.mileageAtService ?? null
  const kmSinceService = truck.currentMileage != null && lastServiceMileage != null
    ? truck.currentMileage - lastServiceMileage
    : null
  const mileageAlert = kmSinceService != null && kmSinceService >= truck.mileageTriggerKm

  const totalPartsCost = completedServices.reduce((sum, svc) => {
    return sum + svc.sections
      .flatMap((s) => s.workCards)
      .flatMap((wc) => wc.parts)
      .reduce((s2, p) => s2 + (p.unitCost ?? 0) * p.quantity, 0)
  }, 0)

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">

      <Link href="/trucks" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
        ← Назад към камионите
      </Link>

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="font-mono text-2xl font-bold text-gray-900 dark:text-white">{truck.plateNumber}</h1>
              {mileageAlert && (
                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  ⚠ За сервиз
                </span>
              )}
              {truck.isAdr && (
                <span className="px-1.5 py-0.5 rounded-sm text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">ADR</span>
              )}
              {truck.frotcomVehicleId && (
                <span className="px-1.5 py-0.5 rounded-sm text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">Frotcom</span>
              )}
              {!truck.isActive && (
                <span className="px-1.5 py-0.5 rounded-sm text-xs font-medium bg-gray-200 dark:bg-gray-700/50 text-gray-500">Неактивен</span>
              )}
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              {truck.make} {truck.model}{truck.year ? ` · ${truck.year}` : ''}
            </p>
          </div>
          <EditTruckButton truck={truck} canEdit={canEdit} />
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Текущ пробег" value={fmtKm(truck.currentMileage)} />
          <StatCard
            label="От последен сервиз"
            value={kmSinceService != null ? fmtKm(kmSinceService) : '—'}
            sub={lastCompleted ? `(сервиз: ${fmtKm(lastServiceMileage)})` : undefined}
            alert={mileageAlert}
          />
          <StatCard label="Лимит за сервиз"   value={fmtKm(truck.mileageTriggerKm)} />
          <StatCard label="Завършени сервизи" value={String(completedServices.length)} />
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Последен сервиз"  value={fmtDate(lastCompleted?.endDate ?? lastCompleted?.scheduledDate ?? null)} />
          <StatCard label="Разходи за части" value={totalPartsCost > 0 ? `${totalPartsCost.toFixed(2)} €` : '—'} />
        </div>

        {/* Active service banner */}
        {activeService && (
          <Link
            href={`/services/${activeService.id}`}
            className="mt-4 flex items-center justify-between px-4 py-3 bg-blue-600/10 border border-blue-500/30 rounded-xl hover:bg-blue-600/20 transition-colors"
          >
            <div>
              <p className="text-xs text-blue-400 font-medium mb-0.5">Активна поръчка</p>
              <p className="text-sm text-gray-900 dark:text-white">
                {STATUS_LABEL[activeService.status]} · {fmtDate(activeService.scheduledDate)}
                {activeService.bayNameSnapshot ? ` · ${activeService.bayNameSnapshot}` : ''}
              </p>
            </div>
            <span className="text-blue-400 text-lg">→</span>
          </Link>
        )}
      </div>

      {/* Service history */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            История на сервизите ({truck.serviceOrders.length})
          </h2>
        </div>

        {truck.serviceOrders.length === 0 ? (
          <p className="px-5 py-10 text-sm text-gray-500 text-center">Няма сервизни поръчки.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {truck.serviceOrders.map((svc) => {
              const workDone  = svc.sections.flatMap((s) => s.workCards)
              const partsCost = workDone.flatMap((wc) => wc.parts)
                .reduce((sum, p) => sum + (p.unitCost ?? 0) * p.quantity, 0)
              return (
                <li key={svc.id}>
                  <Link
                    href={`/services/${svc.id}`}
                    className="flex items-start justify-between px-5 py-4 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${STATUS_COLOR[svc.status]}`}>
                          {STATUS_LABEL[svc.status]}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-300">{fmtDate(svc.scheduledDate)}</span>
                      </div>
                      {svc.bayNameSnapshot && (
                        <p className="text-xs text-gray-500">Бокс: {svc.bayNameSnapshot}</p>
                      )}
                      {svc.driverNameSnapshot && (
                        <p className="text-xs text-gray-500">Шофьор: {svc.driverNameSnapshot}</p>
                      )}
                      {workDone.length > 0 && (
                        <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{workDone.length} завършени работни карти</p>
                      )}
                      {svc.cancellationReason && (
                        <p className="text-xs text-red-500 mt-1">Отменена: {svc.cancellationReason}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {svc.mileageAtService !== null && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 tabular-nums">{fmtKm(svc.mileageAtService)}</p>
                      )}
                      {partsCost > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">{partsCost.toFixed(2)} €</p>
                      )}
                      <p className="text-gray-400 dark:text-gray-600 text-sm mt-1">→</p>
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
