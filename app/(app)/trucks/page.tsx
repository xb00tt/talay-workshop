import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { TrucksClient } from "./TrucksClient";
import Link from "next/link";

export default function TrucksPage() {
  return (
    <>
      <PageHeader
        title="Камиони"
        actions={
          <Link href="/trucks/new">
            <Button size="sm">Добави камион</Button>
          </Link>
        }
      />
      <TrucksClient />
    </>
  );
}
