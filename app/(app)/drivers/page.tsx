import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function DriversPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const drivers = await prisma.driver.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  })

  const active   = drivers.filter((d) => d.isActive)
  const inactive = drivers.filter((d) => !d.isActive)

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Шофьори</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Шофьорите се импортират автоматично от Frotcom при импорт на камиони.
        </p>
      </div>

      <div className="bg-gray-900 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Активни шофьори ({active.length})</h2>
        </div>
        {active.length === 0 ? (
          <p className="px-5 py-10 text-sm text-gray-500 text-center">Няма шофьори. Импортирайте камиони от Frotcom.</p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {active.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm text-gray-200">{d.name}</p>
                  {d.frotcomDriverId && (
                    <p className="text-xs text-gray-600">Frotcom ID: {d.frotcomDriverId}</p>
                  )}
                </div>
                <span className="text-xs text-green-500">Активен</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {inactive.length > 0 && (
        <div className="bg-gray-900 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-500">Неактивни шофьори ({inactive.length})</h2>
          </div>
          <ul className="divide-y divide-gray-800">
            {inactive.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-5 py-3 opacity-60">
                <p className="text-sm text-gray-500">{d.name}</p>
                <span className="text-xs text-gray-600">Неактивен</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
