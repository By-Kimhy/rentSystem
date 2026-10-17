import Link from "next/link";
import type { Listing } from "@api/contract";
import { PROPERTY_TYPE_LABELS, formatDate, formatRent } from "@/lib/format";
import { photoUrl } from "@/lib/photos";

// The room's own photos first, then the property's.
export function listingPhotos(room: Listing) {
  return [...room.photos, ...room.property.photos];
}

// availableFrom is a date with no time, stored as midnight UTC.
export function availability(availableFrom: Date | null) {
  if (!availableFrom || formatDate(availableFrom) <= formatDate(new Date())) return "Available now";
  return `Available from ${formatDate(availableFrom)}`;
}

export function occupantsLabel(n: number) {
  return n === 1 ? "1 person" : `Up to ${n} people`;
}

export function ListingCard({ room }: { room: Listing }) {
  const cover = listingPhotos(room)[0];
  return (
    <li>
      <Link
        href={`/rooms/${room.id}`}
        className="block overflow-hidden rounded-lg border border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl(cover.fileName)} alt="" className="aspect-[4/3] w-full object-cover" />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-800">
            No photo
          </div>
        )}
        <div className="space-y-1 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {PROPERTY_TYPE_LABELS[room.property.type]} · {room.property.city}
          </p>
          <h2 className="font-semibold">
            {room.name}, {room.property.name}
          </h2>
          <p>
            <span className="text-lg font-semibold">{formatRent(room.rentPrice)}</span>
            <span className="text-sm text-zinc-500"> / month</span>
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {[room.sizeSqm && `${Number(room.sizeSqm)} m²`, occupantsLabel(room.maxOccupants), availability(room.availableFrom)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </Link>
    </li>
  );
}
