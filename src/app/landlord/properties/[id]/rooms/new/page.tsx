import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { RoomForm } from "@/components/landlord/RoomForm";

export default async function NewRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const landlord = await requireRole("LANDLORD");
  const property = await prisma.property.findFirst({ where: { id, landlordId: landlord.id } });
  if (!property) notFound();

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
