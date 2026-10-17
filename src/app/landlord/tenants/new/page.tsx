import { requireRole } from "@/lib/dal";
import { TenantForm } from "@/components/landlord/TenantForm";
import { BackLink } from "@/components/landlord/ui";

export const metadata = { title: "Add tenant · RentSystem" };

export default async function NewTenantPage() {
  await requireRole("LANDLORD");
  return (
    <div className="max-w-2xl space-y-6">
      <BackLink href="/landlord/tenants">Tenants</BackLink>
      <h1 className="text-2xl font-semibold">Add tenant</h1>
      <TenantForm />
    </div>
  );
}
