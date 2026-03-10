import { WorkCardClient } from "./WorkCardClient";

type Props = { params: Promise<{ id: string; cardId: string }> };

export default async function WorkCardPage({ params }: Props) {
  const { id, cardId } = await params;
  return <WorkCardClient serviceId={parseInt(id)} cardId={parseInt(cardId)} />;
}
