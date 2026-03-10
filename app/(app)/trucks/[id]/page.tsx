import { TruckProfileClient } from "./TruckProfileClient";

type Props = { params: Promise<{ id: string }> };

export default async function TruckProfilePage({ params }: Props) {
  const { id } = await params;
  return <TruckProfileClient truckId={parseInt(id)} />;
}
