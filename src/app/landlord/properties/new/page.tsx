import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { PropertyForm } from "@/components/landlord/PropertyForm";

export default async function NewPropertyPage() {
  await requireRole("LANDLORD");
  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/landlord/properties" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        ← My properties
      </Link>
      <h1 className="text-2xl font-semibold">Add a property</h1>
      <PropertyForm />
    </div>
  );
}
