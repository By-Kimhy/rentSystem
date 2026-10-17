import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteProperty, deleteRoom } from "../actions";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import {
  PROPERTY_TYPE_LABELS,
  ROOM_STATUS_LABELS,
  ROOM_STATUS_STYLES,
  formatDate,
  formatRent,
} from "@/lib/format";
import { photoUrl } from "@/lib/photos";
import { ConfirmButton } from "@/components/landlord/ConfirmButton";
import { PhotoGrid } from "@/components/landlord/PhotoGrid";

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const landlord = await requireRole("LANDLORD");
  const property = await prisma.property.findFirst({
    where: { id, landlordId: landlord.id },
    include: {
      photos: { orderBy: { createdAt: "asc" } },
      rooms: {
        orderBy: { name: "asc" },
        include: { photos: { take: 1, orderBy: { createdAt: "asc" } }, _count: { select: { leases: true } } },
      },
    },
  });
  if (!property) notFound();
  const hasLeases = property.rooms.some((r) => r._count.leases > 0);

  return (
    <div className="space-y-8">
      <Link href="/landlord/properties" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        ← My properties
      </Link>

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {PROPERTY_TYPE_LABELS[property.type]}
            </p>
            <h1 className="text-2xl font-semibold">{property.name}</h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              {property.address}, {property.city}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link href={`/landlord/properties/${property.id}/edit`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
              Edit property
            </Link>
            {!hasLeases && (
              <ConfirmButton
                action={deleteProperty.bind(null, property.id)}
                message="Delete this property and all of its rooms and photos?"
              >
                Delete property
              </ConfirmButton>
            )}
          </div>
        </div>
        {property.description && <p className="whitespace-pre-line text-zinc-700 dark:text-zinc-300">{property.description}</p>}
        <PhotoGrid photos={property.photos} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Rooms</h2>
          <Link
            href={`/landlord/properties/${property.id}/rooms/new`}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Add room
          </Link>
        </div>

        {property.rooms.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center text-zinc-500">
            No rooms yet. Add the first one.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            {property.rooms.map((room) => (
              <li key={room.id} className="flex flex-wrap items-center gap-4 p-4">
                {room.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl(room.photos[0].fileName)} alt="" className="h-16 w-20 rounded object-cover" />
                ) : (
                  <div className="flex h-16 w-20 items-center justify-center rounded bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800">
                    No photo
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{room.name}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {formatRent(room.rentPrice)} / month
                    {room.sizeSqm && ` · ${Number(room.sizeSqm)} m²`} · up to {room.maxOccupants}{" "}
                    {room.maxOccupants === 1 ? "person" : "people"}
                  </p>
                  {room.availableFrom && (
                    <p className="text-sm text-zinc-500">Available from {formatDate(room.availableFrom)}</p>
                  )}
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROOM_STATUS_STYLES[room.status]}`}>
                  {ROOM_STATUS_LABELS[room.status]}
                </span>
                <Link
                  href={`/landlord/properties/${property.id}/rooms/${room.id}/edit`}
                  className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  Edit
                </Link>
                <Link
                  href={`/landlord/leases/new?room=${room.id}`}
                  className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  New lease
                </Link>
                {room._count.leases === 0 && (
                  <ConfirmButton action={deleteRoom.bind(null, room.id)} message={`Delete room "${room.name}"?`}>
                    Delete
                  </ConfirmButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
