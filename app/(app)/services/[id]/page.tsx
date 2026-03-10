import { ServiceDetailClient } from "./ServiceDetailClient";

type Props = { params: Promise<{ id: string }> };

export default async function ServiceDetailPage({ params }: Props) {
  const { id } = await params;
  return <ServiceDetailClient serviceId={parseInt(id)} />;
}
