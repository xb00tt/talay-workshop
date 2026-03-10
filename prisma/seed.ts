import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:dev.db" });
const db = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create Settings singleton
  await db.settings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      companyName: "Talay Transport",
      companyAddress: "",
      frotcomUsername: "B5jX21vu0w3SV6S",
      frotcomPassword: "0NnHoC6cF119xPSJLnbNcTBgSXq2",
    },
    update: {},
  });

  // Create initial manager account
  const existingManager = await db.user.findFirst({ where: { role: "MANAGER" } });
  if (!existingManager) {
    const passwordHash = await bcrypt.hash("admin123", 12);
    const recoveryCode = Math.random().toString(36).slice(2, 10).toUpperCase();

    const user = await db.user.create({
      data: {
        username: "admin",
        name: "Administrator",
        passwordHash,
        role: "MANAGER",
        permissions: "[]",
        preferredLocale: "bg",
        darkMode: true,
        recoveryCode,
      },
    });

    console.log(`Created manager: ${user.username}`);
    console.log(`Recovery code: ${recoveryCode}  ← save this!`);
  } else {
    console.log(`Manager already exists: ${existingManager.username}`);
  }

  // Default checklist template items
  const existingItems = await db.checklistTemplate.count();
  if (existingItems === 0) {
    await db.checklistTemplate.createMany({
      data: [
        { description: "Проверка на нивото на масло", order: 1 },
        { description: "Проверка на хладилна течност", order: 2 },
        { description: "Проверка на спирачна течност", order: 3 },
        { description: "Проверка на гуми (налягане и износване)", order: 4 },
        { description: "Проверка на светлини", order: 5 },
        { description: "Проверка на чистачки", order: 6 },
        { description: "Проверка на акумулатор", order: 7 },
        { description: "Проверка на ремъци и маркучи", order: 8 },
      ],
    });
    console.log("Created default checklist template (8 items)");
  }

  // Default equipment items
  const existingEquipment = await db.equipmentItem.count();
  if (existingEquipment === 0) {
    await db.equipmentItem.createMany({
      data: [
        { name: "Авариен триъгълник", order: 1 },
        { name: "Пожарогасител", order: 2 },
        { name: "Аптечка", order: 3 },
        { name: "Светлоотразителна жилетка", order: 4 },
        { name: "Верига за сняг", order: 5 },
        { name: "Фар за мъгла", order: 6 },
      ],
    });
    console.log("Created default equipment items (6 items)");
  }

  // Default ADR equipment items
  const existingAdr = await db.adrEquipmentItem.count();
  if (existingAdr === 0) {
    await db.adrEquipmentItem.createMany({
      data: [
        { name: "ADR документи", order: 1 },
        { name: "Специализиран пожарогасител за ADR", order: 2 },
        { name: "Защитна маска", order: 3 },
        { name: "Защитни ръкавици", order: 4 },
        { name: "Защитни очила", order: 5 },
        { name: "ADR табели", order: 6 },
      ],
    });
    console.log("Created default ADR equipment items (6 items)");
  }

  // --- Demo trucks ---
  const existingTrucks = await db.truck.count();
  if (existingTrucks === 0) {
    const trucks = await db.truck.createManyAndReturn({
      data: [
        { plateNumber: "TX 1234 AB", make: "Volvo", model: "FH16", year: 2019, currentMileage: 487500, mileageTriggerKm: 30000 },
        { plateNumber: "TX 5678 BC", make: "Scania", model: "R500", year: 2020, currentMileage: 312000, mileageTriggerKm: 30000 },
        { plateNumber: "TX 9012 CD", make: "Mercedes", model: "Actros", year: 2021, currentMileage: 198000, mileageTriggerKm: 30000 },
        { plateNumber: "TX 3456 EF", make: "DAF", model: "XF480", year: 2018, currentMileage: 621000, mileageTriggerKm: 30000, isAdr: true },
        { plateNumber: "TX 7890 GH", make: "MAN", model: "TGX 540", year: 2022, currentMileage: 95000, mileageTriggerKm: 30000 },
      ],
    });
    console.log(`Created ${trucks.length} demo trucks`);

    // Demo bays
    const bays = await db.bay.createManyAndReturn({
      data: [
        { name: "Бокс 1" },
        { name: "Бокс 2" },
        { name: "Бокс 3" },
      ],
    });
    console.log(`Created ${bays.length} bays`);

    // Demo mechanics
    const mechanics = await db.mechanic.createManyAndReturn({
      data: [
        { name: "Иван Петров" },
        { name: "Георги Димитров" },
        { name: "Стоян Иванов" },
      ],
    });
    console.log(`Created ${mechanics.length} mechanics`);

    // Demo drivers
    await db.driver.createMany({
      data: [
        { name: "Петър Стоянов" },
        { name: "Николай Георгиев" },
        { name: "Димитър Христов" },
      ],
    });
    console.log("Created 3 demo drivers");

    // Scheduled service (future — shows in upcoming queue)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await db.serviceOrder.create({
      data: {
        truckId: trucks[1].id,
        truckPlateSnapshot: trucks[1].plateNumber,
        status: "SCHEDULED",
        scheduledDate: tomorrow,
      },
    });

    // Active service in IN_PROGRESS (shows on dashboard)
    const today = new Date();
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const checklistTemplate = await db.checklistTemplate.findMany({ where: { isActive: true } });

    const activeService = await db.serviceOrder.create({
      data: {
        truckId: trucks[0].id,
        truckPlateSnapshot: trucks[0].plateNumber,
        status: "IN_PROGRESS",
        scheduledDate: threeDaysAgo,
        startDate: threeDaysAgo,
        bayId: bays[0].id,
        bayNameSnapshot: bays[0].name,
        mileageAtService: 487200,
        sections: {
          create: [
            {
              type: "CHECKLIST",
              title: "Контролен лист",
              order: 1,
              checklistItems: {
                create: checklistTemplate.map((item) => ({
                  description: item.description,
                  isCompleted: false,
                })),
              },
            },
            {
              type: "EQUIPMENT_CHECK",
              title: "Проверка на оборудване",
              order: 2,
            },
            {
              type: "DRIVER_FEEDBACK",
              title: "Сигнали от шофьор",
              order: 3,
              workCards: {
                create: [
                  {
                    mechanicId: mechanics[0].id,
                    mechanicName: mechanics[0].name,
                    description: "Смяна на масло и маслен филтър",
                    status: "IN_PROGRESS",
                    specialInstructions: "Използва SAE 15W-40",
                  },
                ],
              },
            },
          ],
        },
      },
    });
    console.log(`Created active service (IN_PROGRESS) for ${trucks[0].plateNumber}`);

    // Completed service (shows in history)
    const lastMonth = new Date();
    lastMonth.setDate(lastMonth.getDate() - 32);
    const lastMonthEnd = new Date(lastMonth);
    lastMonthEnd.setDate(lastMonthEnd.getDate() + 4);

    await db.serviceOrder.create({
      data: {
        truckId: trucks[0].id,
        truckPlateSnapshot: trucks[0].plateNumber,
        status: "COMPLETED",
        scheduledDate: lastMonth,
        startDate: lastMonth,
        endDate: lastMonthEnd,
        bayId: bays[1].id,
        bayNameSnapshot: bays[1].name,
        mileageAtService: 456000,
      },
    });
    console.log(`Created completed service for ${trucks[0].plateNumber}`);

    // Truck with mileage alert (kmSince > trigger)
    await db.serviceOrder.create({
      data: {
        truckId: trucks[3].id,
        truckPlateSnapshot: trucks[3].plateNumber,
        status: "COMPLETED",
        scheduledDate: lastMonth,
        startDate: lastMonth,
        endDate: lastMonthEnd,
        mileageAtService: 585000,  // current is 621000 → 36000 km since = over 30000 trigger
      },
    });
    console.log(`Created alert scenario for ${trucks[3].plateNumber} (36k km over limit)`);
  } else {
    console.log(`Trucks already exist (${existingTrucks}), skipping demo data`);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
