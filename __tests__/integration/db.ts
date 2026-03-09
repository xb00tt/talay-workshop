import { PrismaClient } from '../../lib/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const adapter = new PrismaLibSql({ url: 'file:./prisma/test.db' })
export const db = new PrismaClient({ adapter })

/**
 * Delete all rows in safe FK order before each test.
 * SQLite FK constraints are enabled by Prisma, so order matters.
 */
export async function cleanDb() {
  await db.auditLog.deleteMany()
  await db.photo.deleteMany()
  await db.workCardNote.deleteMany()
  await db.part.deleteMany()
  await db.workCard.deleteMany()
  await db.serviceChecklistItem.deleteMany()
  await db.truckEquipmentSnapshotItem.deleteMany()
  await db.truckEquipmentSnapshot.deleteMany()
  await db.equipmentCheckItem.deleteMany()
  await db.driverFeedbackItem.deleteMany()
  await db.note.deleteMany()
  await db.serviceSection.deleteMany()
  await db.serviceOrder.deleteMany()
  await db.truck.deleteMany()
  await db.bay.deleteMany()
  await db.driver.deleteMany()
  await db.mechanic.deleteMany()
  await db.checklistTemplate.deleteMany()
  await db.equipmentItem.deleteMany()
  await db.adrEquipmentItem.deleteMany()
  await db.user.deleteMany()
  await db.settings.deleteMany()
}
