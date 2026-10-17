import Link from "next/link";
import type { PropertyDetail } from "@api/contract";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import { RoomForm } from "@/components/landlord/RoomForm";

export default async function NewRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("LANDLORD");
  const { property } = await apiGet<{ property: PropertyDetail }>(`/landlord/properties/${id}`);

  return (
    <div className="max-w-2xl space-y-6">
      <Link href={`/landlord/properties/${property.id}`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        ← {property.name}
      </Link>
      <h1 className="text-2xl font-semibold">Add a room</h1>
      <RoomForm propertyId={property.id} />
    </div>
  );
}
