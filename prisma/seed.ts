import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // ── Settings singleton ───────────────────────────────────────────────────
  await prisma.settings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      companyName: '',
      companyAddress: '',
      frotcomUsername: 'B5jX21vu0w3SV6S',
      frotcomPassword: '0NnHoC6cF119xPSJLnbNcTBgSXq2',
    },
    update: {},
  })

  console.log('✓ Settings singleton seeded')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
