import Link from "next/link";
import { leaseFormOptions } from "../form-data";
import { requireRole } from "@/lib/dal";
import { today, toISODate } from "@/lib/dates";
import { LeaseForm } from "@/components/landlord/LeaseForm";
import { BackLink, EmptyState, linkClass } from "@/components/landlord/ui";

export const metadata = { title: "New lease · RentSystem" };

export default async function NewLeasePage({ searchParams }: PageProps<"/landlord/leases/new">) {
  await requireRole("LANDLORD");
  const { tenant, room } = await searchParams;
  const { properties, tenants } = await leaseFormOptions();

  return (
    <div className="max-w-2xl space-y-6">
      <BackLink href="/landlord/leases">Leases</BackLink>
      <h1 className="text-2xl font-semibold">New lease</h1>
      {properties.length === 0 || tenants.length === 0 ? (
        <EmptyState>
          A lease needs a room and a tenant.{" "}
          {properties.length === 0 ? (
            <Link href="/landlord/properties/new" className={linkClass}>
              Add a property and room
            </Link>
          ) : (
            <Link href="/landlord/tenants/new" className={linkClass}>
              Add a tenant
            </Link>
          )}{" "}
          first.
        </EmptyState>
      ) : (
        <LeaseForm
          properties={properties}
          tenants={tenants}
          initial={{
            roomId: typeof room === "string" ? room : "",
            primaryTenantId: typeof tenant === "string" ? tenant : "",
            otherTenantIds: "",
            startDate: toISODate(today()),
            endDate: "",
            rentAmount: "",
            dueDay: "1",
            depositAmount: "0",
            graceDays: "3",
            lateFeeType: "NONE",
            lateFeeValue: "0",
            notes: "",
          }}
        />
      )}
    </div>
  );
}
