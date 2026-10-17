import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { PhotoGrid } from "@/components/landlord/PhotoGrid";
import { RoomForm } from "@/components/landlord/RoomForm";

export default async function EditRoomPage({ params }: { params: Promise<{ id: string; roomId: string }> }) {
  const { id, roomId } = await params;
  const landlord = await requireRole("LANDLORD");
  const room = await prisma.room.findFirst({
    where: { id: roomId, propertyId: id, property: { landlordId: landlord.id } },
    include: { property: { select: { name: true } }, photos: { orderBy: { createdAt: "asc" } } },
  });
  if (!room) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <Link href={`/landlord/properties/${id}`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        ← {room.property.name}
      </Link>
      <h1 className="text-2xl font-semibold">Edit {room.name}</h1>
      <PhotoGrid photos={room.photos} editable />
      <RoomForm
        propertyId={id}
        room={{
          id: room.id,
          name: room.name,
          rentPrice: room.rentPrice.toString(),
          sizeSqm: room.sizeSqm?.toString() ?? "",
          maxOccupants: String(room.maxOccupants),
          status: room.status,
          availableFrom: room.availableFrom ? formatDate(room.availableFrom) : "",
          description: room.description ?? "",
        }}
      />
    </div>
  );
}
