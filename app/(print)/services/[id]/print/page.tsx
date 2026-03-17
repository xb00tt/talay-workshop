import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function fmtDate(d: Date | string | null) {
  if (!d) return '—'
  const dt = new Date(d)
  return `${String(dt.getUTCDate()).padStart(2,'0')}.${String(dt.getUTCMonth()+1).padStart(2,'0')}.${dt.getUTCFullYear()}`
}

function fmtKm(km: number | null) {
  if (km === null) return '—'
  return `${Math.round(km).toLocaleString('bg-BG')} км`
}

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Планирана', INTAKE: 'Приемане', IN_PROGRESS: 'В процес',
  READY: 'Готова', COMPLETED: 'Завършена', CANCELLED: 'Отменена',
}
const WC_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Изчакваща', IN_PROGRESS: 'В процес',
  COMPLETED: 'Завършена', CANCELLED: 'Отменена',
}

export default async function ServiceOrderPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { id } = await params
  const serviceId = Number(id)
  if (isNaN(serviceId)) notFound()

  const [service, settings] = await Promise.all([
    prisma.serviceOrder.findUnique({
      where: { id: serviceId },
      include: {
        truck: true,
        driver: { select: { name: true } },
        sections: {
          orderBy: { order: 'asc' },
          include: {
            checklistItems: true,
            workCards: {
              include: {
                mechanic: { select: { name: true } },
                parts:    true,
                notes:    { orderBy: { createdAt: 'asc' } },
              },
            },
          },
        },
        driverFeedbackItems:   { orderBy: { order: 'asc' } },
        mechanicFeedbackItems: { orderBy: { order: 'asc' } },
        notes:               { orderBy: { createdAt: 'asc' } },
        equipmentCheckItems: true,
      },
    }),
    prisma.settings.findUnique({ where: { id: 1 } }),
  ])

  if (!service) notFound()

  const allWorkCards = service.sections.flatMap((s) =>
    s.workCards.map((wc) => ({ ...wc, sectionTitle: s.title }))
  )
  const completedWorkCards = allWorkCards.filter((wc) => wc.status === 'COMPLETED')
  const totalPartsCost = completedWorkCards
    .flatMap((wc) => wc.parts)
    .reduce((sum, p) => sum + (p.unitCost ?? 0) * p.quantity, 0)

  const intakeItems = service.equipmentCheckItems.filter((i) => i.checkType === 'INTAKE')
  const exitItems   = service.equipmentCheckItems.filter((i) => i.checkType === 'EXIT')

  return (
    <>
      <title>{`Поръчка #${service.id} — ${service.truckPlateSnapshot}`}</title>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; background: white; }
        @page { size: A4; margin: 15mm; }
        @media print { .no-print { display: none !important; } }
        .page { max-width: 210mm; margin: 0 auto; padding: 20px; }
        h1 { font-size: 16pt; font-weight: bold; }
        h2 { font-size: 12pt; font-weight: bold; margin-top: 14px; margin-bottom: 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
        h3 { font-size: 10pt; font-weight: bold; margin-top: 10px; margin-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9.5pt; }
        th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
        th { background: #f0f0f0; font-weight: bold; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px; }
        .cell { border: 1px solid #ccc; padding: 5px 8px; }
        .label { font-size: 8pt; color: #555; margin-bottom: 1px; }
        .value { font-size: 10pt; font-weight: 600; }
        .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
        .badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 8pt; font-weight: bold; }
        .status-badge { background: #e0e0e0; color: #333; }
        .adr-badge { background: #FFA500; color: white; }
        .section-block { margin-top: 14px; page-break-inside: avoid; }
        .wc-block { margin-top: 8px; border: 1px solid #ddd; padding: 8px; border-radius: 4px; }
        .eq-item { display: inline-block; margin: 2px 4px 2px 0; font-size: 9pt; }
        .present { color: green; } .missing { color: red; } .restocked { color: orange; }
        .notes-list { list-style: none; }
        .notes-list li { border-bottom: 1px solid #eee; padding: 3px 0; font-size: 9.5pt; }
        .print-btn { position: fixed; top: 15px; right: 15px; padding: 8px 16px; background: #1d4ed8; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; }
        .print-btn:hover { background: #1e40af; }
      `}</style>

      <button className="print-btn no-print">Печат</button>

      <div className="page">
        {/* Company header */}
        <div className="header-row">
          <div>
            {settings?.companyName && <h1>{settings.companyName}</h1>}
            {settings?.companyAddress && <p style={{ fontSize: '9pt', color: '#555' }}>{settings.companyAddress}</p>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '10pt', fontWeight: 'bold' }}>Сервизна поръчка #{service.id}</p>
            <span className="badge status-badge">{STATUS_LABEL[service.status] ?? service.status}</span>
          </div>
        </div>

        <hr style={{ borderColor: '#ccc', marginBottom: '10px' }} />

        {/* Truck & service info */}
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
          <div className="cell">
            <div className="label">Рег. номер</div>
            <div className="value" style={{ fontFamily: 'monospace', fontSize: '13pt' }}>
              {service.truckPlateSnapshot}
              {service.truck.isAdr && <span className="badge adr-badge" style={{ marginLeft: 6 }}>ADR</span>}
            </div>
          </div>
          <div className="cell">
            <div className="label">Марка / Модел</div>
            <div className="value">{service.truck.make} {service.truck.model}{service.truck.year ? ` (${service.truck.year})` : ''}</div>
          </div>
          <div className="cell">
            <div className="label">Насрочена дата</div>
            <div className="value">{fmtDate(service.scheduledDate)}</div>
          </div>
          <div className="cell">
            <div className="label">Пробег при приемане</div>
            <div className="value">{fmtKm(service.mileageAtService)}</div>
          </div>
          <div className="cell">
            <div className="label">Шофьор</div>
            <div className="value">{service.driverNameSnapshot ?? '—'}</div>
          </div>
          <div className="cell">
            <div className="label">Начало</div>
            <div className="value">{fmtDate(service.startDate)}</div>
          </div>
          <div className="cell">
            <div className="label">Край</div>
            <div className="value">{fmtDate(service.endDate)}</div>
          </div>
        </div>

        {/* Driver feedback */}
        {(service.driverFeedbackItems.length > 0 || service.driverFeedbackNotes) && (
          <div className="section-block">
            <h2>Докладвано от шофьора</h2>
            {service.driverFeedbackItems.length > 0 && (
              <ul style={{ paddingLeft: '16px', fontSize: '9.5pt' }}>
                {service.driverFeedbackItems.map((item) => (
                  <li key={item.id}>{item.description}</li>
                ))}
              </ul>
            )}
            {service.driverFeedbackNotes && (
              <p style={{ marginTop: 4, fontSize: '9.5pt', color: '#444' }}>{service.driverFeedbackNotes}</p>
            )}
          </div>
        )}

        {/* Mechanic feedback */}
        {(service.mechanicFeedbackItems.length > 0 || service.mechanicFeedbackNotes) && (
          <div className="section-block">
            <h2>Докладвано от механика</h2>
            {service.mechanicFeedbackItems.length > 0 && (
              <ul style={{ paddingLeft: '16px', fontSize: '9.5pt' }}>
                {service.mechanicFeedbackItems.map((item) => (
                  <li key={item.id}>{item.description}</li>
                ))}
              </ul>
            )}
            {service.mechanicFeedbackNotes && (
              <p style={{ marginTop: 4, fontSize: '9.5pt', color: '#444' }}>{service.mechanicFeedbackNotes}</p>
            )}
          </div>
        )}

        {/* Checklist section */}
        {service.sections.filter((s) => s.type === 'CHECKLIST').map((sec) => (
          <div key={sec.id} className="section-block">
            <h2>Контролен списък</h2>
            <table>
              <thead>
                <tr><th style={{ width: 20 }}>#</th><th>Описание</th><th style={{ width: 80 }}>Отметнато от</th><th style={{ width: 60 }}>Дата</th></tr>
              </thead>
              <tbody>
                {sec.checklistItems.map((item, i) => (
                  <tr key={item.id}>
                    <td>{i + 1}</td>
                    <td>{item.description}</td>
                    <td style={{ color: item.isCompleted ? 'green' : 'inherit' }}>
                      {item.isCompleted ? (item.completedByName ?? '✓') : ''}
                    </td>
                    <td style={{ fontSize: '8pt' }}>
                      {item.completedAt ? fmtDate(item.completedAt) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* Equipment check */}
        {(intakeItems.length > 0 || exitItems.length > 0) && (
          <div className="section-block">
            <h2>Проверка на оборудване</h2>
            {[{ label: 'Приемане', items: intakeItems }, { label: 'Изход', items: exitItems }].map(({ label, items }) =>
              items.length > 0 ? (
                <div key={label}>
                  <h3>{label}</h3>
                  <div>
                    {items.map((item) => (
                      <span key={item.id} className="eq-item">
                        <span className={item.status === 'PRESENT' ? 'present' : item.status === 'MISSING' ? 'missing' : 'restocked'}>
                          {item.status === 'PRESENT' ? '✓' : item.status === 'MISSING' ? '✗' : '↻'}
                        </span>
                        {' '}{item.itemName}
                        {item.explanation ? ` (${item.explanation})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}

        {/* Work cards by section */}
        {service.sections.filter((s) => s.type !== 'CHECKLIST' && s.type !== 'EQUIPMENT_CHECK').map((sec) => (
          <div key={sec.id} className="section-block">
            <h2>{sec.title}</h2>
            {sec.workCards.length === 0 ? (
              <p style={{ color: '#888', fontSize: '9pt' }}>Няма работни карти.</p>
            ) : sec.workCards.map((wc) => {
              const partsCost = wc.parts.reduce((s, p) => s + (p.unitCost ?? 0) * p.quantity, 0)
              return (
                <div key={wc.id} className="wc-block">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '10pt' }}>{wc.description}</div>
                    <span className="badge status-badge">{WC_STATUS_LABEL[wc.status] ?? wc.status}</span>
                  </div>
                  {wc.mechanicName && <p style={{ fontSize: '9pt', color: '#555' }}>Механик: {wc.mechanicName}</p>}
                  {wc.specialInstructions && (
                    <p style={{ fontSize: '9pt', color: '#555', marginTop: 2 }}>Инструкции: {wc.specialInstructions}</p>
                  )}
                  {wc.parts.length > 0 && (
                    <table style={{ marginTop: 4 }}>
                      <thead>
                        <tr>
                          <th>Части</th>
                          <th style={{ width: 60 }}>Кол-во</th>
                          <th style={{ width: 70 }}>Ед. цена</th>
                          <th style={{ width: 70 }}>Общо</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wc.parts.map((p) => (
                          <tr key={p.id}>
                            <td>{p.name}{p.partNumber ? ` [${p.partNumber}]` : ''}</td>
                            <td>{p.quantity}</td>
                            <td>{p.unitCost !== null ? `${p.unitCost.toFixed(2)} €` : '—'}</td>
                            <td>{p.unitCost !== null ? `${((p.unitCost ?? 0) * p.quantity).toFixed(2)} €` : '—'}</td>
                          </tr>
                        ))}
                        {partsCost > 0 && (
                          <tr>
                            <td colSpan={3} style={{ textAlign: 'right', fontWeight: 'bold' }}>Общо части:</td>
                            <td style={{ fontWeight: 'bold' }}>{partsCost.toFixed(2)} €</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                  {wc.notes.length > 0 && (
                    <ul className="notes-list" style={{ marginTop: 4 }}>
                      {wc.notes.map((n) => (
                        <li key={n.id}>
                          <span style={{ fontSize: '8pt', color: '#777' }}>{n.userNameSnapshot}:</span>{' '}
                          {n.content}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {/* Service notes */}
        {service.notes.length > 0 && (
          <div className="section-block">
            <h2>Бележки</h2>
            <ul className="notes-list">
              {service.notes.map((n) => (
                <li key={n.id}>
                  <span style={{ fontSize: '8pt', color: '#777' }}>{n.userNameSnapshot} · {fmtDate(n.createdAt)}:</span>{' '}
                  {n.content}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Cost summary */}
        {totalPartsCost > 0 && (
          <div className="section-block">
            <h2>Общо разходи за части</h2>
            <p style={{ fontSize: '14pt', fontWeight: 'bold' }}>{totalPartsCost.toFixed(2)} €</p>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 30, borderTop: '1px solid #ccc', paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '9pt', color: '#777' }}>Разпечатано: {fmtDate(new Date())}</p>
            {service.cancellationReason && (
              <p style={{ fontSize: '9pt', color: 'red', marginTop: 4 }}>Отменена: {service.cancellationReason}</p>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '9pt', color: '#777' }}>Подпис: ___________________</p>
          </div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        document.querySelector('.print-btn')?.addEventListener('click', () => window.print())
      ` }} />
    </>
  )
}
