import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { rateLimit, getIp } from '@/lib/rateLimit'

export async function POST(request: Request) {
  // Rate-limit: 5 attempts per 15 minutes per IP
  const ip = getIp(request)
  const rl = rateLimit(`recover:${ip}`, 5, 15 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Твърде много опити. Опитайте отново след 15 минути.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    )
  }

  const { username, recoveryCode, newPassword } = await request.json()

  if (!username?.trim() || !recoveryCode?.trim() || !newPassword) {
    return NextResponse.json({ error: 'Всички полета са задължителни.' }, { status: 422 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Паролата трябва да е поне 8 символа.' }, { status: 422 })
  }

  const user = await prisma.user.findUnique({ where: { username: username.trim().toLowerCase() } })

  // Deliberately vague error — don't reveal whether the user exists
  if (!user || !user.recoveryCode || user.recoveryCode !== recoveryCode.trim().toUpperCase()) {
    return NextResponse.json({ error: 'Невалидно потребителско име или код за възстановяване.' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, recoveryCode: null },
  })

  return NextResponse.json({ ok: true })
}
