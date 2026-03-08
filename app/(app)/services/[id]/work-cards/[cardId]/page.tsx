import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import WorkCardClient from './WorkCardClient'

export default async function WorkCardDetailPage({
  params,
}: {
  params: Promise<{ id: string; cardId: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { id, cardId } = await params
  const serviceId = Number(id)
  const wcId      = Number(cardId)

  const workCard = await prisma.workCard.findFirst({
    where: {
      id:             wcId,
      serviceSection: { serviceOrderId: serviceId },
    },
    include: {
      parts:    true,
      notes:    { orderBy: { createdAt: 'asc' } },
      photos:   { orderBy: { createdAt: 'asc' } },
      serviceSection: {
        select: { id: true, title: true, serviceOrderId: true },
      },
    },
  })

  if (!workCard) notFound()

  const { role, permissions } = session.user

  return (
    <WorkCardClient
      initialWorkCard={{
        ...workCard,
        cancelledAt: workCard.cancelledAt?.toISOString() ?? null,
        reopenedAt:  workCard.reopenedAt?.toISOString() ?? null,
        notes:  workCard.notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
        photos: workCard.photos.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
      }}
      canCancelWorkCard={hasPermission(role, permissions, 'workcard.cancel')}
      canReopenWorkCard={hasPermission(role, permissions, 'workcard.reopen')}
      canCompleteWorkCard={hasPermission(role, permissions, 'workcard.complete')}
      canCreateNote={hasPermission(role, permissions, 'note.create')}
      canUploadPhoto={hasPermission(role, permissions, 'photo.upload')}
    />
  )
}
