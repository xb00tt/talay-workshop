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
