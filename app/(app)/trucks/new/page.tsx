import { PageHeader } from "@/components/PageHeader";
import { NewTruckForm } from "./NewTruckForm";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NewTruckPage() {
  return (
    <>
      <PageHeader
        title="Нов камион"
        actions={
          <Link href="/trucks">
            <Button size="sm" variant="outline">Назад</Button>
          </Link>
        }
      />
      <NewTruckForm />
    </>
  );
}
