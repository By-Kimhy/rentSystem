import Link from "next/link";
import type { PropertyCard } from "@api/contract";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import { PROPERTY_TYPE_LABELS, formatRent } from "@/lib/format";
import { photoUrl } from "@/lib/photos";

export default async function PropertiesPage() {
  await requireRole("LANDLORD");
  const { properties } = await apiGet<{ properties: PropertyCard[] }>("/landlord/properties");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My properties</h1>
        <Link
          href="/landlord/properties/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Add property
        </Link>
      </div>

      {properties.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center text-zinc-500">
          You haven&apos;t added any properties yet.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {properties.map((property) => {
            const available = property.rooms.filter((r) => r.status === "AVAILABLE").length;
            const prices = property.rooms.map((r) => Number(r.rentPrice));
            return (
              <li key={property.id}>
                <Link
                  href={`/landlord/properties/${property.id}`}
                  className="block overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm hover:shadow-md"
                >
                  {property.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrl(property.photos[0].fileName)}
                      alt=""
                      className="aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center bg-zinc-100 text-sm text-zinc-400 dark:bg-zinc-800">
                      No photo
                    </div>
                  )}
                  <div className="space-y-1 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      {PROPERTY_TYPE_LABELS[property.type]} · {property.city}
                    </p>
                    <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">{property.name}</h2>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {property.rooms.length} {property.rooms.length === 1 ? "room" : "rooms"} · {available} available
                    </p>
                    {prices.length > 0 && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        From {formatRent(Math.min(...prices))} / month
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
