import type { Metadata } from "next";
import type { Listing } from "@api/contract";
import { apiGet } from "@/lib/api";
import { PROPERTY_TYPE_LABELS, formatRent } from "@/lib/format";
import { photoUrl } from "@/lib/photos";
import { BackLink, Details } from "@/components/landlord/ui";
import { availability, listingPhotos, occupantsLabel } from "@/components/rooms/listing";

export async function generateMetadata({ params }: PageProps<"/rooms/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { room } = await apiGet<{ room: Listing }>(`/rooms/${id}`);
  return { title: `${room.name}, ${room.property.name} · RentSystem` };
}

export default async function RoomPage({ params }: PageProps<"/rooms/[id]">) {
  const { id } = await params;
  // Only available rooms are listed; anything else is a 404.
  const { room } = await apiGet<{ room: Listing }>(`/rooms/${id}`);
  const { property } = room;
  const photos = listingPhotos(room);

  return (
    <div className="space-y-8">
      <BackLink href="/rooms">All rooms</BackLink>

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {PROPERTY_TYPE_LABELS[property.type]} · {property.city}
            </p>
            <h1 className="text-2xl font-semibold">
              {room.name}, {property.name}
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              {property.address}, {property.city}
            </p>
          </div>
          <p className="text-right">
            <span className="text-2xl font-semibold">{formatRent(room.rentPrice)}</span>
            <span className="text-zinc-500"> / month</span>
          </p>
        </div>

        {photos.length > 0 && (
          // With three or more photos the first one is shown large, beside the next two.
          <ul className={`grid gap-3 ${photos.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"}`}>
            {photos.map((photo, i) => {
              const featured = i === 0 && photos.length >= 3;
              return (
                <li key={photo.id} className={featured ? "col-span-2 row-span-2" : undefined}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl(photo.fileName)}
                    alt=""
                    className={`w-full rounded-md object-cover ${
                      featured ? "h-full" : photos.length === 1 ? "aspect-[16/9]" : "aspect-[4/3]"
                    }`}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">About this room</h2>
        <Details
          items={[
            ["Rent", `${formatRent(room.rentPrice)} per month`],
            ["Size", room.sizeSqm ? `${Number(room.sizeSqm)} m²` : "Not given"],
            ["Occupants", occupantsLabel(room.maxOccupants)],
            ["Availability", availability(room.availableFrom)],
          ]}
        />
        {room.description && <p className="whitespace-pre-line text-zinc-700 dark:text-zinc-300">{room.description}</p>}
      </section>

      {property.description && (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">About {property.name}</h2>
          <p className="whitespace-pre-line text-zinc-700 dark:text-zinc-300">{property.description}</p>
        </section>
      )}
    </div>
  );
}
