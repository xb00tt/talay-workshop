import { PageHeader } from "@/components/PageHeader";
import { NewServiceForm } from "./NewServiceForm";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NewServicePage() {
  return (
    <>
      <PageHeader
        title="Ново обслужване"
        actions={
          <Link href="/services">
            <Button size="sm" variant="outline">Назад</Button>
          </Link>
        }
      />
      <NewServiceForm />
    </>
  );
}
