import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function fmtDate(d: Date | string | null) {
  if (!d) return '—'
  const dt = new Date(d)
  return `${String(dt.getUTCDate()).padStart(2, '0')}.${String(dt.getUTCMonth() + 1).padStart(2, '0')}.${dt.getUTCFullYear()}`
}

export default async function IntakeProtocolPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { id } = await params
  const serviceId = Number(id)
  if (isNaN(serviceId)) notFound()

  const [service, settings, equipmentItems, adrEquipmentItems] = await Promise.all([
    prisma.serviceOrder.findUnique({
      where: { id: serviceId },
      include: { truck: true },
    }),
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.equipmentItem.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
    prisma.adrEquipmentItem.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
  ])

  if (!service) notFound()

  const allItems = service.truck.isAdr
    ? [...equipmentItems, ...adrEquipmentItems]
    : equipmentItems

  // Split into two columns for the equipment table
  const leftCol  = allItems.filter((_, i) => i % 2 === 0)
  const rightCol = allItems.filter((_, i) => i % 2 === 1)

  return (
    <>
      <title>{`Приемателен протокол — ${service.truckPlateSnapshot} — ${fmtDate(service.scheduledDate)}`}</title>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; background: white; }
        @page { size: A4; margin: 15mm; }
        @media print { .no-print { display: none !important; } }
        .page { max-width: 210mm; margin: 0 auto; padding: 20px; }
        h1 { font-size: 15pt; font-weight: bold; }
        h2 { font-size: 11pt; font-weight: bold; margin-top: 18px; margin-bottom: 6px; border-bottom: 2px solid #111; padding-bottom: 3px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #111; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; margin-top: 10px; border: 1px solid #bbb; }
        .info-cell { padding: 6px 8px; border-right: 1px solid #bbb; border-bottom: 1px solid #bbb; }
        .info-cell:nth-child(3n) { border-right: none; }
        .info-cell.last-row { border-bottom: none; }
        .info-label { font-size: 8pt; color: #666; margin-bottom: 2px; }
        .info-value { font-size: 10pt; font-weight: 600; min-height: 16px; }
        .info-blank { font-size: 10pt; color: #bbb; border-bottom: 1px dotted #bbb; height: 18px; }
        .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 7pt; font-weight: bold; background: #FFA500; color: white; margin-left: 6px; vertical-align: middle; }
        .eq-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9.5pt; }
        .eq-table th { background: #f0f0f0; font-weight: bold; text-align: left; padding: 4px 6px; border: 1px solid #bbb; font-size: 8.5pt; }
        .eq-table td { border: 1px solid #bbb; padding: 5px 6px; vertical-align: middle; }
        .eq-table .cb-cell { width: 24px; text-align: center; font-size: 13pt; }
        .eq-table .name-cell { }
        .eq-table .divider { border-left: 2px solid #bbb; }
        .lines-block { margin-top: 8px; }
        .write-line { border-bottom: 1px solid #bbb; height: 24px; margin-bottom: 2px; }
        .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 30px; }
        .sig-area { }
        .sig-name-line { border-bottom: 1px solid #333; height: 36px; margin-bottom: 4px; }
        .sig-label { font-size: 8.5pt; color: #555; }
        .declaration { margin-top: 16px; font-size: 8.5pt; color: #555; line-height: 1.6; border: 1px solid #ccc; padding: 7px 10px; background: #fafafa; }
        .print-btn { position: fixed; top: 15px; right: 15px; padding: 8px 16px; background: #1d4ed8; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; }
        .section-note { font-size: 8.5pt; color: #777; margin-top: 4px; font-style: italic; }
      `}</style>

      <button className="print-btn no-print">Печат</button>

      <div className="page">

        {/* Header */}
        <div className="header">
          <div>
            {settings?.companyName && <h1>{settings.companyName}</h1>}
            {settings?.companyAddress && <p style={{ fontSize: '9pt', color: '#666', marginTop: 2 }}>{settings.companyAddress}</p>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '14pt', fontWeight: 'bold' }}>ПРИЕМАТЕЛЕН ПРОТОКОЛ</p>
            <p style={{ fontSize: '9pt', color: '#666', marginTop: 2 }}>Поръчка #{service.id} · {fmtDate(service.scheduledDate)}</p>
          </div>
        </div>

        {/* Truck info — pre-filled from app */}
        <h2>Данни за превозното средство</h2>
        <div className="info-grid">
          <div className="info-cell">
            <div className="info-label">Рег. номер</div>
            <div className="info-value" style={{ fontFamily: 'monospace', fontSize: '12pt' }}>
              {service.truckPlateSnapshot}
              {service.truck.isAdr && <span className="badge">ADR</span>}
            </div>
          </div>
          <div className="info-cell">
            <div className="info-label">Марка / Модел</div>
            <div className="info-value">{service.truck.make} {service.truck.model}{service.truck.year ? ` (${service.truck.year})` : ''}</div>
          </div>
          <div className="info-cell">
            <div className="info-label">Насрочена дата</div>
            <div className="info-value">{fmtDate(service.scheduledDate)}</div>
          </div>
          {/* Fields left blank to be filled manually */}
          <div className="info-cell last-row">
            <div className="info-label">Шофьор (три имена)</div>
            <div className="info-blank" />
          </div>
          <div className="info-cell last-row">
            <div className="info-label">Бокс</div>
            <div className="info-blank" />
          </div>
          <div className="info-cell last-row">
            <div className="info-label">Пробег при приемане (км)</div>
            <div className="info-blank" />
          </div>
        </div>

        {/* Equipment checklist */}
        <h2>Проверка на оборудване</h2>
        <p className="section-note">Отбележете всяка позиция: □ Налично &nbsp;□ Липсва</p>
        {allItems.length === 0 ? (
          <p style={{ fontSize: '9.5pt', color: '#888', fontStyle: 'italic', marginTop: 8 }}>Няма дефинирано оборудване.</p>
        ) : (
          <table className="eq-table">
            <thead>
              <tr>
                <th className="cb-cell">Нал.</th>
                <th className="cb-cell">Липс.</th>
                <th className="name-cell">Наименование</th>
                <th className="cb-cell divider">Нал.</th>
                <th className="cb-cell">Липс.</th>
                <th className="name-cell">Наименование</th>
              </tr>
            </thead>
            <tbody>
              {leftCol.map((item, i) => {
                const right = rightCol[i]
                return (
                  <tr key={item.id}>
                    <td className="cb-cell">□</td>
                    <td className="cb-cell">□</td>
                    <td className="name-cell">{item.name}</td>
                    {right ? (
                      <>
                        <td className="cb-cell divider">□</td>
                        <td className="cb-cell">□</td>
                        <td className="name-cell">{right.name}</td>
                      </>
                    ) : (
                      <>
                        <td className="divider" />
                        <td />
                        <td />
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Driver's report */}
        <h2>Доклад на шофьора</h2>
        <p className="section-note">Опишете всички проблеми, неизправности или забележки към превозното средство.</p>
        <div className="lines-block" style={{ marginTop: 10 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="write-line" />
          ))}
        </div>

        {/* Declaration */}
        <div className="declaration">
          С подписването на настоящия протокол двете страни удостоверяват, че посочените данни за оборудването
          и докладваните проблеми са верни и точни към момента на приемането на превозното средство в сервиза.
        </div>

        {/* Signatures */}
        <div className="sig-grid">
          <div className="sig-area">
            <div className="sig-name-line" />
            <div className="sig-label">Подпис и печат на шофьора &nbsp;/&nbsp; Дата: ___________</div>
          </div>
          <div className="sig-area">
            <div className="sig-name-line" />
            <div className="sig-label">Подпис на приемащия &nbsp;/&nbsp; Дата: ___________</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 20, paddingTop: 8, borderTop: '1px solid #ddd', fontSize: '8pt', color: '#aaa', textAlign: 'center' }}>
          Разпечатано: {fmtDate(new Date())} · {settings?.companyName ?? ''} · Поръчка #{service.id}
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        document.querySelector('.print-btn')?.addEventListener('click', () => window.print())
      ` }} />
    </>
  )
}
