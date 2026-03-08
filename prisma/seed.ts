import 'dotenv/config'
import { PrismaClient } from '../lib/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import bcrypt from 'bcryptjs'

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// Store as start-of-day UTC (date-only semantics)
const dt = (date: string, time = '00:00:00') => new Date(`${date}T${time}.000Z`)

async function main() {
  // ── Settings ──────────────────────────────────────────────────────────────
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {
      companyName: 'Талай Транспорт ООД',
      companyAddress: 'гр. Пловдив, ул. Индустриална 15, п.к. 4000',
    },
    create: {
      id: 1,
      companyName: 'Талай Транспорт ООД',
      companyAddress: 'гр. Пловдив, ул. Индустриална 15, п.к. 4000',
      frotcomUsername: 'B5jX21vu0w3SV6S',
      frotcomPassword: '0NnHoC6cF119xPSJLnbNcTBgSXq2',
    },
  })
  console.log('✓ Settings')

  // ── Find existing manager ─────────────────────────────────────────────────
  const manager = await prisma.user.findFirst({ where: { role: 'MANAGER' } })
  if (!manager) throw new Error('No manager found! Complete the setup wizard first.')
  const mgrId = manager.id
  const mgrName = manager.name
  console.log(`✓ Manager: ${mgrName} (${manager.username})`)

  // ── Assistant user ─────────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { username: 'assist' },
    create: {
      username: 'assist',
      name: 'Мария Георгиева',
      passwordHash: bcrypt.hashSync('assist123', 10),
      role: 'ASSISTANT',
      permissions: JSON.stringify([
        'service.create', 'workcard.create', 'workcard.complete',
        'photo.upload', 'note.create', 'report.view',
      ]),
      preferredLocale: 'bg',
      darkMode: true,
      recoveryCode: 'AST-2024-WXYZ',
    },
    update: {},
  })
  console.log('✓ Assistant user  →  assist / assist123')

  // ── Bays ──────────────────────────────────────────────────────────────────
  const bayCount = await prisma.bay.count()
  const newBayNames = [
    'Бокс 2', 'Бокс 3', 'Бокс 4 - Диагностика',
    'Бокс 5 - ТИР', 'Бокс 6 - ADR', 'Бокс 7', 'Бокс 8',
  ]
  for (let i = 0; i < Math.max(0, 8 - bayCount); i++) {
    await prisma.bay.create({ data: { name: newBayNames[i], isActive: true } })
  }
  const bays = await prisma.bay.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } })
  console.log(`✓ Bays  (${bays.length} total)`)

  // ── Mechanics ─────────────────────────────────────────────────────────────
  const mechCount = await prisma.mechanic.count()
  const newMechNames = [
    'Стоян Димитров', 'Георги Христов', 'Димитър Йорданов',
    'Александър Тодоров', 'Васил Стоянов', 'Красимир Маринов', 'Николай Попов',
  ]
  for (let i = 0; i < Math.max(0, 8 - mechCount); i++) {
    await prisma.mechanic.create({ data: { name: newMechNames[i], isActive: true } })
  }
  const mechanics = await prisma.mechanic.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } })
  console.log(`✓ Mechanics  (${mechanics.length} total)`)

  // ── Checklist Template ────────────────────────────────────────────────────
  const clCount = await prisma.checklistTemplate.count()
  const allClItems = [
    'Проверка нивото на моторното масло',
    'Проверка нивото на охладителната течност',
    'Проверка нивото на спирачната течност',
    'Проверка нивото на хидравличното масло',
    'Проверка и смяна на маслен филтър',
    'Проверка на въздушния филтър',
    'Проверка на горивния филтър',
    'Проверка на гумите — налягане и износване',
    'Проверка на спирачните колодки и дискове',
    'Проверка на осветлението — фарове, мигачи, стопове',
    'Проверка на чистачките и нивото на течността за миене',
    'Проверка на акумулатора и зареждане',
    'Проверка на ремъците — алтернатор, климатик',
    'Проверка на изпускателната система',
    'Проверка на кормилния механизъм и лагерите',
    'Проверка на окачването и амортисьорите',
    'Калибриране / проверка на тахографа',
  ]
  for (let i = clCount; i < allClItems.length; i++) {
    await prisma.checklistTemplate.create({ data: { description: allClItems[i], order: i + 1, isActive: true } })
  }
  const clTemplates = await prisma.checklistTemplate.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } })
  console.log(`✓ Checklist template  (${clTemplates.length} items)`)

  // ── Equipment Items ───────────────────────────────────────────────────────
  const eqCount = await prisma.equipmentItem.count()
  const allEqItems = [
    { name: 'Аптечка', description: 'Стандартна пътна аптечка' },
    { name: 'Светлоотразителен триъгълник', description: 'Минимум 2 бр.' },
    { name: 'Пожарогасител', description: 'CO₂, минимум 2 kg' },
    { name: 'Обезопасителен жилет', description: 'Минимум 1 бр.' },
    { name: 'Буксировъчно въже / верига', description: '' },
    { name: 'Кабели за стартиране', description: 'За тежкотоварни МПС' },
    { name: 'Резервна крушка комплект', description: '' },
    { name: 'Документи на камиона', description: 'Регистрационен талон, застраховка, техн. преглед' },
    { name: 'Противоплъзгащи вериги', description: 'Комплект за задна ос' },
    { name: 'Инструментален комплект', description: 'Ключове, отвертки, клещи' },
    { name: 'Манометър за гуми', description: '' },
    { name: 'Лопата', description: 'За зимни условия' },
    { name: 'Калници и странични протектори', description: 'Проверка за наличие и повреди' },
  ]
  for (let i = eqCount; i < allEqItems.length; i++) {
    await prisma.equipmentItem.create({ data: { name: allEqItems[i].name, description: allEqItems[i].description, order: i + 1, isActive: true } })
  }
  const equipItems = await prisma.equipmentItem.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } })
  console.log(`✓ Equipment items  (${equipItems.length} total)`)

  // ── ADR Equipment Items ───────────────────────────────────────────────────
  const adrCount = await prisma.adrEquipmentItem.count()
  const allAdrItems = [
    { name: 'ADR Сертификат на водача', description: 'Валиден документ' },
    { name: 'Одобрен тип ПС (ADR)', description: 'Свидетелство за одобрение' },
    { name: 'ADR Аварийни карти (TREMCARD)', description: 'За всеки превозван товар' },
    { name: 'ADR Пожарогасител', description: '6 kg прахов' },
    { name: 'Защитни ръкавици и очила', description: 'Химически устойчиви' },
    { name: 'Защитен костюм', description: 'EN 340 сертифициран' },
    { name: 'Инхалатор / дихателна маска', description: '' },
    { name: 'Сигнализиращи конуси', description: 'Минимум 3 бр.' },
    { name: 'ADR маркировки и оранжеви табели', description: 'Проверка за четливост' },
    { name: 'Комплект за аварийно разливане', description: 'Абсорбент и съд за събиране' },
  ]
  for (let i = adrCount; i < allAdrItems.length; i++) {
    await prisma.adrEquipmentItem.create({ data: { name: allAdrItems[i].name, description: allAdrItems[i].description, order: i + 1, isActive: true } })
  }
  console.log('✓ ADR equipment items')

  // ── Skip service orders if already exist ─────────────────────────────────
  const soCount = await prisma.serviceOrder.count()
  if (soCount > 0) {
    console.log(`\n⚠  Service orders already exist (${soCount}) — skipping sample service data.`)
    return
  }

  // ── Query trucks & drivers ─────────────────────────────────────────────────
  const trucks = await prisma.truck.findMany({
    select: { id: true, plateNumber: true, isAdr: true, currentMileage: true },
    orderBy: { id: 'asc' },
  })
  const drivers = await prisma.driver.findMany({
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
    take: 40,
  })
  if (trucks.length < 20) {
    console.log('⚠  Not enough trucks (need 20+). Import from Frotcom first.')
    return
  }

  // Helpers
  const mech = (i: number) => mechanics[i % mechanics.length]
  const drv  = (i: number) => drivers[i % drivers.length]
  const bay  = (i: number) => bays[i % bays.length]

  const stdEquip = equipItems.slice(0, 8).map(e => e.name)

  async function addEquipCheck(soId: number, checkType: 'INTAKE' | 'EXIT', items: string[], restockedIdx: number[] = []) {
    for (let i = 0; i < items.length; i++) {
      await prisma.equipmentCheckItem.create({
        data: { serviceOrderId: soId, itemName: items[i], status: restockedIdx.includes(i) ? 'RESTOCKED' : 'PRESENT', checkType },
      })
    }
  }

  async function addNote(soId: number, content: string) {
    await prisma.note.create({ data: { serviceOrderId: soId, content, userId: mgrId, userNameSnapshot: mgrName } })
  }

  async function addAudit(soId: number, oldStatus: string, newStatus: string) {
    await prisma.auditLog.create({
      data: { userId: mgrId, userNameSnapshot: mgrName, action: 'STATUS_CHANGE', entityType: 'ServiceOrder', entityId: String(soId), oldValue: JSON.stringify(oldStatus), newValue: JSON.stringify(newStatus) },
    })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COMPLETED service orders  (10)  — Jan & Feb 2026
  // ══════════════════════════════════════════════════════════════════════════

  type CompletedSpec = {
    t: number; d: number; b: number
    mileage: number; sched: string; start: string; end: string
    driverFeedback: string
    dfItems: string[]
    midItems: { desc: string; parts: { name: string; pn?: string; qty: number; cost?: number }[] }[]
    extraNote?: string
  }

  const completedSpecs: CompletedSpec[] = [
    {
      t: 0, d: 0, b: 0, mileage: 412500, sched: '2026-01-06', start: '2026-01-06', end: '2026-01-07',
      driverFeedback: 'Вибрация при скорост над 80 км/ч. Климатикът не охлажда.',
      dfItems: ['Вибрация — предна ос / гуми', 'Климатик — слабо охлаждане'],
      midItems: [
        { desc: 'Балансиране на гуми — предна ос', parts: [{ name: 'Тежести за балансиране', qty: 6, cost: 2.5 }, { name: 'Сачмен лагер SKF', pn: 'SKF-32216', qty: 2, cost: 85 }] },
        { desc: 'Дозареждане на климатична система', parts: [{ name: 'Хладилен агент R134a', pn: 'REF-R134', qty: 0.8, cost: 45 }] },
        { desc: 'Смяна маслен филтър + масло', parts: [{ name: 'Масло 10W-40 синт.', pn: 'OIL-10W40', qty: 28, cost: 12.5 }, { name: 'Маслен филтър', pn: 'MF-7732', qty: 1, cost: 38 }] },
      ],
    },
    {
      t: 1, d: 1, b: 1, mileage: 287600, sched: '2026-01-12', start: '2026-01-12', end: '2026-01-14',
      driverFeedback: 'Скърцане от предния мост. Спирачките отиват надолу.',
      dfItems: ['Скърцане — преден мост при завиване', 'Хлабав спирачен педал'],
      midItems: [
        { desc: 'Проверка и смазване на кормилни накрайници', parts: [{ name: 'Греп за кормилни накрайници', qty: 2, cost: 8 }] },
        { desc: 'Смяна спирачни накладки + въздушване', parts: [{ name: 'Спирачни накладки комплект', pn: 'BP-2241K', qty: 1, cost: 145 }, { name: 'Спирачна течност DOT4', qty: 1, cost: 18 }] },
        { desc: 'Регулировка на разпределителя', parts: [] },
      ],
    },
    {
      t: 2, d: 2, b: 2, mileage: 534200, sched: '2026-01-19', start: '2026-01-19', end: '2026-01-20',
      driverFeedback: 'Изтичане на масло под двигателя.',
      dfItems: ['Течащ маслен уплътнител — картер'],
      midItems: [
        { desc: 'Смяна маслен уплътнител на картера', parts: [{ name: 'Уплътнение картер', pn: 'OIL-SEAL-401', qty: 1, cost: 65 }] },
        { desc: 'Почистване и обезмасляване на двигателния отсек', parts: [{ name: 'Обезмаслител', qty: 2, cost: 12 }] },
      ],
    },
    {
      t: 3, d: 3, b: 3, mileage: 198300, sched: '2026-01-26', start: '2026-01-27', end: '2026-01-28',
      driverFeedback: 'Колан за алтернатора се е скъсал.',
      dfItems: ['Скъсан ремък за алтернатора'],
      midItems: [
        { desc: 'Смяна на ремъка на алтернатора и обтегача', parts: [{ name: 'Поликлинов ремък', pn: 'BELT-6PK2075', qty: 1, cost: 92 }, { name: 'Обтегач ремък', qty: 1, cost: 55 }] },
      ],
    },
    {
      t: 4, d: 4, b: 4, mileage: 367800, sched: '2026-02-03', start: '2026-02-03', end: '2026-02-04',
      driverFeedback: 'Турбото свири на студено. Харчи повече гориво.',
      dfItems: ['Свирене на турбо — на студено', 'Повишен разход на гориво'],
      midItems: [
        { desc: 'Проверка и подмяна тръбопровод на турбото', parts: [{ name: 'Маркуч турбо', pn: 'TH-8831', qty: 1, cost: 185 }] },
        { desc: 'Почистване и калибровка на горивна дюза', parts: [{ name: 'Инжекторна дюза', pn: 'INJ-DEN-12', qty: 2, cost: 310 }] },
      ],
    },
    {
      t: 5, d: 5, b: 0, mileage: 445100, sched: '2026-02-09', start: '2026-02-09', end: '2026-02-11',
      driverFeedback: 'Леко гуменото тракане при неравности.',
      dfItems: ['Тракане — заден мост при неравности'],
      midItems: [
        { desc: 'Смяна буфери и тампони на окачването', parts: [{ name: 'Буфер амортисьор комплект', qty: 4, cost: 38 }] },
        { desc: 'Смяна задни амортисьори', parts: [{ name: 'Амортисьор заден', pn: 'SA-3311-R', qty: 2, cost: 245 }] },
      ],
    },
    {
      t: 6, d: 6, b: 1, mileage: 623700, sched: '2026-02-16', start: '2026-02-16', end: '2026-02-17',
      driverFeedback: 'Стъклото на предното огледало напукано. Вентилаторът на кабината не работи.',
      dfItems: ['Напукано странично огледало', 'Вентилатор на кабина — не работи'],
      midItems: [
        { desc: 'Смяна стъкло на дясно странично огледало', parts: [{ name: 'Стъкло огледало', pn: 'MIR-R-094', qty: 1, cost: 78 }] },
        { desc: 'Смяна вентилатор кабина', parts: [{ name: 'Вентилатор кабина', pn: 'FAN-CAB-22', qty: 1, cost: 155 }] },
      ],
    },
    {
      t: 7, d: 7, b: 2, mileage: 312400, sched: '2026-02-20', start: '2026-02-20', end: '2026-02-21',
      driverFeedback: 'Акумулаторът трудно стартира при студено. АБС лампата свети.',
      dfItems: ['Слаб акумулатор', 'Сигнална лампа АБС — активна'],
      midItems: [
        { desc: 'Смяна на акумулатор', parts: [{ name: 'Акумулатор 12V 220Ah', pn: 'BAT-220', qty: 1, cost: 420 }] },
        { desc: 'Диагностика и нулиране АБС', parts: [] },
        { desc: 'Смяна на АБС сензор — заден ляв', parts: [{ name: 'АБС сензор', pn: 'ABS-SEN-RL', qty: 1, cost: 88 }] },
      ],
    },
    {
      t: 8, d: 8, b: 3, mileage: 489600, sched: '2026-02-24', start: '2026-02-24', end: '2026-02-25',
      driverFeedback: 'Изгоряла задна стоп-лампа. Наляганата система за гуми показва грешка.',
      dfItems: ['Изгоряла стоп-лампа — задна дясна', 'Грешка TPMS'],
      midItems: [
        { desc: 'Смяна задна стоп-лампа', parts: [{ name: 'Лампа стоп LED', qty: 1, cost: 35 }] },
        { desc: 'Калибровка на TPMS сензори', parts: [{ name: 'TPMS сензор', pn: 'TPMS-315', qty: 2, cost: 65 }] },
      ],
    },
    {
      t: 9, d: 9, b: 4, mileage: 156800, sched: '2026-03-03', start: '2026-03-03', end: '2026-03-04',
      driverFeedback: 'Няма забележки от водача.',
      dfItems: [],
      midItems: [
        { desc: 'Смяна горивен и въздушен филтър', parts: [{ name: 'Горивен филтър', pn: 'FF-5645', qty: 1, cost: 55 }, { name: 'Въздушен филтър', pn: 'AF-3914', qty: 1, cost: 72 }] },
        { desc: 'Пълен технически преглед — 150 000 km', parts: [] },
      ],
    },
  ]

  for (let idx = 0; idx < completedSpecs.length; idx++) {
    const cs = completedSpecs[idx]
    const truck = trucks[cs.t]
    const driver = drv(cs.d)
    const b = bay(cs.b)

    const so = await prisma.serviceOrder.create({
      data: {
        truckId: truck.id,
        truckPlateSnapshot: truck.plateNumber,
        status: 'COMPLETED',
        bayId: b.id,
        bayNameSnapshot: b.name,
        scheduledDate: dt(cs.sched),
        startDate: dt(cs.start, '07:30:00'),
        endDate: dt(cs.end, '16:00:00'),
        mileageAtService: cs.mileage,
        driverId: driver.id,
        driverNameSnapshot: driver.name,
        driverFeedbackNotes: cs.driverFeedback,
      },
    })

    // CHECKLIST
    const clSec = await prisma.serviceSection.create({
      data: { serviceOrderId: so.id, type: 'CHECKLIST', title: 'Технически преглед', order: 1 },
    })
    for (const item of clTemplates) {
      await prisma.serviceChecklistItem.create({
        data: { serviceSectionId: clSec.id, description: item.description, isCompleted: true, completedAt: dt(cs.end, '13:00:00'), completedByName: mgrName },
      })
    }

    // EQUIPMENT_CHECK
    await prisma.serviceSection.create({
      data: { serviceOrderId: so.id, type: 'EQUIPMENT_CHECK', title: 'Проверка на оборудване', order: 2 },
    })
    await addEquipCheck(so.id, 'INTAKE', stdEquip, idx % 3 === 0 ? [2] : [])
    await addEquipCheck(so.id, 'EXIT', stdEquip, [])

    // DRIVER_FEEDBACK
    if (cs.dfItems.length > 0) {
      const dfSec = await prisma.serviceSection.create({
        data: { serviceOrderId: so.id, type: 'DRIVER_FEEDBACK', title: 'Сигнали от водача', order: 3 },
      })
      for (let i = 0; i < cs.dfItems.length; i++) {
        await prisma.driverFeedbackItem.create({ data: { serviceOrderId: so.id, description: cs.dfItems[i], order: i + 1 } })
      }
      const wc = await prisma.workCard.create({
        data: { serviceSectionId: dfSec.id, description: cs.dfItems[0], mechanicId: mech(idx).id, mechanicName: mech(idx).name, status: 'COMPLETED' },
      })
      if (cs.dfItems.length > 1) {
        await prisma.workCard.create({
          data: { serviceSectionId: dfSec.id, description: cs.dfItems[1], mechanicId: mech(idx + 1).id, mechanicName: mech(idx + 1).name, status: 'COMPLETED' },
        })
      }
    }

    // MID_SERVICE
    const msSec = await prisma.serviceSection.create({
      data: { serviceOrderId: so.id, type: 'MID_SERVICE', title: 'Открити при преглед', order: cs.dfItems.length > 0 ? 4 : 3 },
    })
    for (let mi = 0; mi < cs.midItems.length; mi++) {
      const wc = await prisma.workCard.create({
        data: { serviceSectionId: msSec.id, description: cs.midItems[mi].desc, mechanicId: mech(idx + mi).id, mechanicName: mech(idx + mi).name, status: 'COMPLETED' },
      })
      for (const p of cs.midItems[mi].parts) {
        await prisma.part.create({ data: { workCardId: wc.id, name: p.name, partNumber: p.pn ?? null, quantity: p.qty, unitCost: p.cost ?? null } })
      }
    }

    // Snapshot
    const snap = await prisma.truckEquipmentSnapshot.create({ data: { truckId: truck.id, serviceOrderId: so.id } })
    for (const item of stdEquip) {
      await prisma.truckEquipmentSnapshotItem.create({ data: { snapshotId: snap.id, itemName: item, status: 'PRESENT' } })
    }

    // Notes & Audit
    await addNote(so.id, `Приет в сервиза. ${cs.driverFeedback}`)
    await addNote(so.id, 'Всички дейности приключени. Камионът готов за предаване.')
    await addAudit(so.id, 'SCHEDULED', 'COMPLETED')
  }
  console.log('✓ 10 COMPLETED service orders')

  // ══════════════════════════════════════════════════════════════════════════
  // CANCELLED service orders  (3)
  // ══════════════════════════════════════════════════════════════════════════

  const cancelledSpecs = [
    { t: 10, d: 10, sched: '2026-01-15', reason: 'Камионът претърпя ПТП и е изпратен за застрахователен ремонт. Предстои нова резервация след оглед.' },
    { t: 11, d: 11, sched: '2026-02-05', reason: 'Водачът е в болнични. Обслужването отложено — камионът ще дойде следващия месец.' },
    { t: 12, d: 12, sched: '2026-02-18', reason: 'Клиентска заявка за отмяна — камионът е зает на дълъг международен маршрут.' },
  ]
  for (const cs of cancelledSpecs) {
    const truck = trucks[cs.t]
    const driver = drv(cs.d)
    const so = await prisma.serviceOrder.create({
      data: {
        truckId: truck.id,
        truckPlateSnapshot: truck.plateNumber,
        status: 'CANCELLED',
        scheduledDate: dt(cs.sched),
        driverId: driver.id,
        driverNameSnapshot: driver.name,
        cancellationReason: cs.reason,
      },
    })
    await addNote(so.id, `Поръчката анулирана. Причина: ${cs.reason}`)
    await addAudit(so.id, 'SCHEDULED', 'CANCELLED')
  }
  console.log('✓ 3 CANCELLED service orders')

  // ══════════════════════════════════════════════════════════════════════════
  // IN_PROGRESS service orders  (3)  — currently in bays 2, 3, 4
  // ══════════════════════════════════════════════════════════════════════════

  const inProgressSpecs = [
    {
      t: 13, d: 13, b: 1, mileage: 301200, sched: '2026-03-07', start: '2026-03-07',
      feedback: 'Скърцане от предния мост при завиване вляво.',
      dfItems: ['Скърцане — преден мост при завиване'],
      wcDesc: 'Проверка и смазване на предния мост и кормилни накрайници',
      wcStatus: 'IN_PROGRESS' as const,
      midDesc: 'Смяна спирачни накладки — предна ос',
      midPart: { name: 'Спирачни накладки комплект', pn: 'BP-2241K', qty: 1, cost: 145 },
    },
    {
      t: 14, d: 14, b: 2, mileage: 478900, sched: '2026-03-08', start: '2026-03-08',
      feedback: 'Двигателят губи мощност при пълно натоварване.',
      dfItems: ['Загуба на мощност — при натоварване'],
      wcDesc: 'Диагностика на двигателя и системата за гориво',
      wcStatus: 'IN_PROGRESS' as const,
      midDesc: 'Почистване на горивни инжектори',
      midPart: { name: 'Почистващ препарат за инжектори', qty: 2, cost: 28 },
    },
    {
      t: 15, d: 15, b: 3, mileage: 612100, sched: '2026-03-06', start: '2026-03-06',
      feedback: 'Пропуска гарнитурата на главата. Дим от ауспуха.',
      dfItems: ['Пропускаща гарнитура на главата', 'Дим при изпускателната система'],
      wcDesc: 'Смяна на гарнитурата на главата',
      wcStatus: 'ASSIGNED' as const,
      midDesc: 'Диагностика на изпускателна система',
      midPart: { name: 'Гарнитура на главата', pn: 'HG-550N', qty: 1, cost: 380 },
    },
  ]

  for (const ips of inProgressSpecs) {
    const truck = trucks[ips.t]
    const driver = drv(ips.d)
    const b = bays[ips.b]

    const so = await prisma.serviceOrder.create({
      data: {
        truckId: truck.id,
        truckPlateSnapshot: truck.plateNumber,
        status: 'IN_PROGRESS',
        bayId: b.id,
        bayNameSnapshot: b.name,
        scheduledDate: dt(ips.sched),
        startDate: dt(ips.start, '08:00:00'),
        mileageAtService: ips.mileage,
        driverId: driver.id,
        driverNameSnapshot: driver.name,
        driverFeedbackNotes: ips.feedback,
      },
    })

    // CHECKLIST — partial
    const clSec = await prisma.serviceSection.create({
      data: { serviceOrderId: so.id, type: 'CHECKLIST', title: 'Технически преглед', order: 1 },
    })
    for (let i = 0; i < clTemplates.length; i++) {
      const done = i < 6
      await prisma.serviceChecklistItem.create({
        data: { serviceSectionId: clSec.id, description: clTemplates[i].description, isCompleted: done, completedAt: done ? dt(ips.start, '11:00:00') : null, completedByName: done ? mgrName : null },
      })
    }

    // EQUIPMENT_CHECK — intake done
    await prisma.serviceSection.create({
      data: { serviceOrderId: so.id, type: 'EQUIPMENT_CHECK', title: 'Проверка на оборудване', order: 2 },
    })
    await addEquipCheck(so.id, 'INTAKE', stdEquip)

    // DRIVER_FEEDBACK
    const dfSec = await prisma.serviceSection.create({
      data: { serviceOrderId: so.id, type: 'DRIVER_FEEDBACK', title: 'Сигнали от водача', order: 3 },
    })
    for (let i = 0; i < ips.dfItems.length; i++) {
      await prisma.driverFeedbackItem.create({ data: { serviceOrderId: so.id, description: ips.dfItems[i], order: i + 1 } })
    }
    await prisma.workCard.create({
      data: { serviceSectionId: dfSec.id, description: ips.wcDesc, mechanicId: mech(ips.b).id, mechanicName: mech(ips.b).name, status: ips.wcStatus },
    })

    // MID_SERVICE
    const msSec = await prisma.serviceSection.create({
      data: { serviceOrderId: so.id, type: 'MID_SERVICE', title: 'Открити при преглед', order: 4 },
    })
    const wc = await prisma.workCard.create({
      data: { serviceSectionId: msSec.id, description: ips.midDesc, mechanicId: mech(ips.b + 1).id, mechanicName: mech(ips.b + 1).name, status: 'PENDING' },
    })
    await prisma.part.create({ data: { workCardId: wc.id, name: ips.midPart.name, partNumber: (ips.midPart as any).pn ?? null, quantity: ips.midPart.qty, unitCost: ips.midPart.cost } })

    await addNote(so.id, `Камионът приет на ${ips.sched}. ${ips.feedback}`)
    await addAudit(so.id, 'SCHEDULED', 'IN_PROGRESS')
  }
  console.log('✓ 3 IN_PROGRESS service orders')

  // ══════════════════════════════════════════════════════════════════════════
  // INTAKE service order  (1)  — bay 5
  // ══════════════════════════════════════════════════════════════════════════

  {
    const truck = trucks[16]
    const driver = drv(16)
    const b = bays[4]
    const so = await prisma.serviceOrder.create({
      data: {
        truckId: truck.id,
        truckPlateSnapshot: truck.plateNumber,
        status: 'INTAKE',
        bayId: b.id,
        bayNameSnapshot: b.name,
        scheduledDate: dt('2026-03-08'),
        startDate: dt('2026-03-08', '09:15:00'),
        mileageAtService: 223400,
        driverId: driver.id,
        driverNameSnapshot: driver.name,
      },
    })
    await prisma.serviceSection.create({ data: { serviceOrderId: so.id, type: 'CHECKLIST', title: 'Технически преглед', order: 1 } })
    await prisma.serviceSection.create({ data: { serviceOrderId: so.id, type: 'EQUIPMENT_CHECK', title: 'Проверка на оборудване', order: 2 } })
    await addNote(so.id, 'Камионът пристигна навреме. Оформя се приемането.')
    await addAudit(so.id, 'SCHEDULED', 'INTAKE')
  }
  console.log('✓ 1 INTAKE service order')

  // ══════════════════════════════════════════════════════════════════════════
  // QUALITY_CHECK service order  (1)  — bay 6
  // ══════════════════════════════════════════════════════════════════════════

  {
    const truck = trucks[17]
    const driver = drv(17)
    const b = bays[5]
    const so = await prisma.serviceOrder.create({
      data: {
        truckId: truck.id,
        truckPlateSnapshot: truck.plateNumber,
        status: 'QUALITY_CHECK',
        bayId: b.id,
        bayNameSnapshot: b.name,
        scheduledDate: dt('2026-03-05'),
        startDate: dt('2026-03-05', '07:30:00'),
        mileageAtService: 389000,
        driverId: driver.id,
        driverNameSnapshot: driver.name,
        driverFeedbackNotes: 'Шум от турбото при рязко газуване.',
      },
    })

    const clSec = await prisma.serviceSection.create({ data: { serviceOrderId: so.id, type: 'CHECKLIST', title: 'Технически преглед', order: 1 } })
    for (const item of clTemplates) {
      await prisma.serviceChecklistItem.create({
        data: { serviceSectionId: clSec.id, description: item.description, isCompleted: true, completedAt: dt('2026-03-07', '12:00:00'), completedByName: mgrName },
      })
    }

    await prisma.serviceSection.create({ data: { serviceOrderId: so.id, type: 'EQUIPMENT_CHECK', title: 'Проверка на оборудване', order: 2 } })
    await addEquipCheck(so.id, 'INTAKE', stdEquip)

    await prisma.driverFeedbackItem.create({ data: { serviceOrderId: so.id, description: 'Шум от турбо при рязко газуване', order: 1 } })
    const dfSec = await prisma.serviceSection.create({ data: { serviceOrderId: so.id, type: 'DRIVER_FEEDBACK', title: 'Сигнали от водача', order: 3 } })
    const wc = await prisma.workCard.create({
      data: { serviceSectionId: dfSec.id, description: 'Проверка и смяна на турбокомпресор', mechanicId: mech(0).id, mechanicName: mech(0).name, status: 'COMPLETED' },
    })
    await prisma.part.create({ data: { workCardId: wc.id, name: 'Турбокомпресор', partNumber: 'TURBO-3803714', quantity: 1, unitCost: 1850 } })

    await addNote(so.id, 'Всички работни карти приключени. Предстои изходна проверка на оборудването.')
    await addAudit(so.id, 'IN_PROGRESS', 'QUALITY_CHECK')
  }
  console.log('✓ 1 QUALITY_CHECK service order')

  // ══════════════════════════════════════════════════════════════════════════
  // READY service order  (1)  — bay 7
  // ══════════════════════════════════════════════════════════════════════════

  {
    const truck = trucks[18]
    const driver = drv(18)
    const b = bays[6]
    const so = await prisma.serviceOrder.create({
      data: {
        truckId: truck.id,
        truckPlateSnapshot: truck.plateNumber,
        status: 'READY',
        bayId: b.id,
        bayNameSnapshot: b.name,
        scheduledDate: dt('2026-03-04'),
        startDate: dt('2026-03-04', '08:00:00'),
        mileageAtService: 512300,
        driverId: driver.id,
        driverNameSnapshot: driver.name,
        driverFeedbackNotes: 'Няма забележки от водача.',
      },
    })

    const clSec = await prisma.serviceSection.create({ data: { serviceOrderId: so.id, type: 'CHECKLIST', title: 'Технически преглед', order: 1 } })
    for (const item of clTemplates) {
      await prisma.serviceChecklistItem.create({
        data: { serviceSectionId: clSec.id, description: item.description, isCompleted: true, completedAt: dt('2026-03-06', '15:00:00'), completedByName: mgrName },
      })
    }

    await prisma.serviceSection.create({ data: { serviceOrderId: so.id, type: 'EQUIPMENT_CHECK', title: 'Проверка на оборудване', order: 2 } })
    await addEquipCheck(so.id, 'INTAKE', stdEquip)
    await addEquipCheck(so.id, 'EXIT', stdEquip)

    const msSec = await prisma.serviceSection.create({ data: { serviceOrderId: so.id, type: 'MID_SERVICE', title: 'Открити при преглед', order: 3 } })
    const wc = await prisma.workCard.create({
      data: { serviceSectionId: msSec.id, description: 'Смяна горивен и въздушен филтър + масло 500 000 km', mechanicId: mech(2).id, mechanicName: mech(2).name, status: 'COMPLETED' },
    })
    await prisma.part.create({ data: { workCardId: wc.id, name: 'Горивен филтър', partNumber: 'FF-5645', quantity: 1, unitCost: 55 } })
    await prisma.part.create({ data: { workCardId: wc.id, name: 'Въздушен филтър', partNumber: 'AF-3914', quantity: 1, unitCost: 72 } })
    await prisma.part.create({ data: { workCardId: wc.id, name: 'Масло 10W-40', quantity: 28, unitCost: 12.5 } })

    const snap = await prisma.truckEquipmentSnapshot.create({ data: { truckId: truck.id, serviceOrderId: so.id } })
    for (const item of stdEquip) {
      await prisma.truckEquipmentSnapshotItem.create({ data: { snapshotId: snap.id, itemName: item, status: 'PRESENT' } })
    }

    await addNote(so.id, 'Камионът готов за предаване. Уведомен е водачът.')
    await addAudit(so.id, 'QUALITY_CHECK', 'READY')
  }
  console.log('✓ 1 READY service order')

  // ══════════════════════════════════════════════════════════════════════════
  // SCHEDULED service orders  (10)  — upcoming
  // ══════════════════════════════════════════════════════════════════════════

  const scheduledSpecs = [
    { t: 19, d: 19, date: '2026-03-10' },
    { t: 20, d: 20, date: '2026-03-11' },
    { t: 21, d: 21, date: '2026-03-12' },
    { t: 22, d: 22, date: '2026-03-13' },
    { t: 23, d: 23, date: '2026-03-17' },
    { t: 24, d: 24, date: '2026-03-18' },
    { t: 25, d: 25, date: '2026-03-19' },
    { t: 26, d: 26, date: '2026-03-24' },
    { t: 27, d: 27, date: '2026-03-25' },
    { t: 28, d: 28, date: '2026-03-31' },
  ]
  for (const ss of scheduledSpecs) {
    const truck = trucks[ss.t % trucks.length]
    const driver = drv(ss.d)
    await prisma.serviceOrder.create({
      data: {
        truckId: truck.id,
        truckPlateSnapshot: truck.plateNumber,
        status: 'SCHEDULED',
        scheduledDate: dt(ss.date),
        driverId: driver.id,
        driverNameSnapshot: driver.name,
      },
    })
  }
  console.log('✓ 10 SCHEDULED service orders')

  console.log('\n🎉  Sample data seeded successfully!')
  console.log(`    Manager login:   ${manager.username} / (your existing password)`)
  console.log('    Assistant login: assist / assist123')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
