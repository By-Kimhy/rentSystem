import type { Metadata } from "next";
import Link from "next/link";
import type { Listing, MyApplication } from "@api/contract";
import { apiGet } from "@/lib/api";
import { getOptionalUser } from "@/lib/dal";
import { maxDate, today, toISODate } from "@/lib/dates";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_STYLES, PROPERTY_TYPE_LABELS, formatDate, formatRent } from "@/lib/format";
import { photoUrl } from "@/lib/photos";
import { BackLink, Badge, Details, cardClass, linkClass, primaryButtonClass, secondaryButtonClass } from "@/components/landlord/ui";
import { ApplyForm } from "@/components/rooms/ApplyForm";
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

      <ApplySection room={room} />
    </div>
  );
}

// Signed-out visitors are asked to sign in, tenants get the form (or their pending
// application), and landlords and admins see nothing.
async function ApplySection({ room }: { room: Listing }) {
  const user = await getOptionalUser();
  if (user && user.role !== "TENANT") return null;
  const here = `/rooms/${room.id}`;

  let body: React.ReactNode;
  if (!user) {
    body = (
      <>
        <p className="text-zinc-600 dark:text-zinc-400">Sign in with a tenant account to apply for this room.</p>
        <div className="flex flex-wrap gap-3">
          <Link href={`/login?next=${encodeURIComponent(here)}`} className={primaryButtonClass}>
            Sign in to apply
          </Link>
          <Link href={`/signup?next=${encodeURIComponent(here)}`} className={secondaryButtonClass}>
            Create an account
          </Link>
        </div>
      </>
    );
  } else {
    const { applications } = await apiGet<{ applications: MyApplication[] }>("/tenant/applications");
    const pending = applications.find((a) => a.room.id === room.id && a.status === "PENDING");
    body = pending ? (
      <>
        <p className="flex flex-wrap items-center gap-2">
          You applied on {formatDate(pending.createdAt)}
          <Badge className={APPLICATION_STATUS_STYLES[pending.status]}>{APPLICATION_STATUS_LABELS[pending.status]}</Badge>
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          The landlord will review it.{" "}
          <Link href="/tenant" className={linkClass}>
            See your applications
          </Link>
        </p>
      </>
    ) : (
      <ApplyForm
        roomId={room.id}
        maxOccupants={room.maxOccupants}
        earliestMoveIn={toISODate(room.availableFrom ? maxDate(room.availableFrom, today()) : today())}
      />
    );
  }

  return (
    <section id="apply" className={`${cardClass} space-y-4 p-6`}>
      <h2 className="text-xl font-semibold">Apply for this room</h2>
      {body}
    </section>
  );
}
