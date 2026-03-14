import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export async function POST(request: Request) {
  const userCount = await prisma.user.count()
  if (userCount > 0) {
    return NextResponse.json({ error: 'Already configured' }, { status: 400 })
  }

  const body = await request.json()

  // ── Basic validation ──────────────────────────────────────────────────────
  if (!body.companyName?.trim()) {
    return NextResponse.json({ error: 'Company name is required' }, { status: 422 })
  }
  if (!body.username?.trim()) {
    return NextResponse.json({ error: 'Username is required' }, { status: 422 })
  }
  if (!body.managerName?.trim()) {
    return NextResponse.json({ error: 'Manager name is required' }, { status: 422 })
  }
  if (!body.password || body.password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 422 })
  }
  const recoveryCode = crypto.randomBytes(6).toString('hex').toUpperCase()
  const passwordHash = await bcrypt.hash(body.password, 12)

  await prisma.$transaction(async (tx) => {
    // Update the Settings singleton with company info
    await tx.settings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        companyName: body.companyName.trim(),
        companyAddress: (body.companyAddress ?? '').trim(),
        frotcomUsername: 'B5jX21vu0w3SV6S',
        frotcomPassword: '0NnHoC6cF119xPSJLnbNcTBgSXq2',
      },
      update: {
        companyName: body.companyName.trim(),
        companyAddress: (body.companyAddress ?? '').trim(),
      },
    })

    // Create first manager
    await tx.user.create({
      data: {
        username: body.username.trim().toLowerCase(),
        name: body.managerName.trim(),
        passwordHash,
        role: 'ADMIN',
        permissions: '[]',
        recoveryCode,
      },
    })

    // Mechanics (optional)
    const validMechanics = (body.mechanics as string[]).filter((m) => m.trim())
    for (const name of validMechanics) {
      await tx.mechanic.create({ data: { name: name.trim() } })
    }

    // Global equipment items
    const validEquipment = (body.equipmentItems as { name: string; description: string }[]).filter(
      (e) => e.name.trim(),
    )
    for (let i = 0; i < validEquipment.length; i++) {
      await tx.equipmentItem.create({
        data: {
          name: validEquipment[i].name.trim(),
          description: validEquipment[i].description?.trim() ?? '',
          order: i + 1,
        },
      })
    }

    // ADR equipment items
    const validAdr = (body.adrEquipmentItems as { name: string; description: string }[]).filter(
      (e) => e.name.trim(),
    )
    for (let i = 0; i < validAdr.length; i++) {
      await tx.adrEquipmentItem.create({
        data: {
          name: validAdr[i].name.trim(),
          description: validAdr[i].description?.trim() ?? '',
          order: i + 1,
        },
      })
    }

    // Checklist template items
    const validChecklist = (body.checklistItems as string[]).filter((c) => c.trim())
    for (let i = 0; i < validChecklist.length; i++) {
      await tx.checklistTemplate.create({
        data: { description: validChecklist[i].trim(), order: i + 1 },
      })
    }
  })

  return NextResponse.json({ recoveryCode })
}
