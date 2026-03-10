import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ServicesClient } from "./ServicesClient";
import Link from "next/link";

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        title="Обслужвания"
        actions={
          <Link href="/services/new">
            <Button size="sm">Ново обслужване</Button>
          </Link>
        }
      />
      <ServicesClient />
    </>
  );
}
