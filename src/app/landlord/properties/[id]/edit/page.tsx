import Link from "next/link";
import type { PropertyDetail } from "@api/contract";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import { PhotoGrid } from "@/components/landlord/PhotoGrid";
import { PropertyForm } from "@/components/landlord/PropertyForm";

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("LANDLORD");
  const { property } = await apiGet<{ property: PropertyDetail }>(`/landlord/properties/${id}`);

  return (
    <div className="max-w-2xl space-y-6">
      <Link href={`/landlord/properties/${property.id}`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        ← {property.name}
      </Link>
      <h1 className="text-2xl font-semibold">Edit property</h1>
      <PhotoGrid photos={property.photos} editable />
      <PropertyForm property={property} />
    </div>
  );
}
