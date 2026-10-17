import Form from "next/form";
import Link from "next/link";
import type { Listing } from "@api/contract";
import { ApiError, apiGet } from "@/lib/api";
import { PROPERTY_TYPE_LABELS } from "@/lib/format";
import { Field, inputClass } from "@/components/landlord/fields";
import { EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/landlord/ui";
import { ListingCard } from "@/components/rooms/listing";

export const metadata = { title: "Browse rooms · RentSystem" };

const FILTER_KEYS = ["city", "type", "minRent", "maxRent", "occupants"] as const;

export default async function RoomsPage({ searchParams }: PageProps<"/rooms">) {
  const raw = await searchParams;
  const filters = Object.fromEntries(
    FILTER_KEYS.map((key) => {
      const value = raw[key];
      return [key, (Array.isArray(value) ? value[0] : value)?.trim() ?? ""];
    }),
  ) as Record<(typeof FILTER_KEYS)[number], string>;
  const filtered = FILTER_KEYS.some((key) => filters[key]);

  // A bad value typed into the URL (maxRent=abc) comes back as a 400 with the field's message.
  let rooms: Listing[] = [];
  let errors: Record<string, string[] | undefined> | undefined;
  try {
    ({ rooms } = await apiGet<{ rooms: Listing[] }>("/rooms", filters));
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 400)) throw e;
    errors = e.fieldErrors;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Browse rooms</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Rooms available to rent in apartments, condos and houses.</p>
      </div>

      <Form
        action="/rooms"
        className="grid gap-4 rounded-lg border border-zinc-200 p-4 sm:grid-cols-2 lg:grid-cols-5 dark:border-zinc-800"
      >
        <Field label="City" name="city" errors={errors}>
          <input name="city" defaultValue={filters.city} placeholder="Any city" className={inputClass} />
        </Field>
        <Field label="Type" name="type" errors={errors}>
          <select name="type" defaultValue={filters.type} className={inputClass}>
            <option value="">Any type</option>
            {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Min rent (USD)" name="minRent" errors={errors}>
          <input name="minRent" type="number" min="0" step="any" defaultValue={filters.minRent} className={inputClass} />
        </Field>
        <Field label="Max rent (USD)" name="maxRent" errors={errors}>
          <input name="maxRent" type="number" min="0" step="any" defaultValue={filters.maxRent} className={inputClass} />
        </Field>
        <Field label="People" name="occupants" errors={errors}>
          <input name="occupants" type="number" min="1" step="1" defaultValue={filters.occupants} className={inputClass} />
        </Field>
        <div className="flex gap-3 sm:col-span-2 lg:col-span-5">
          <button type="submit" className={primaryButtonClass}>
            Search
          </button>
          {filtered && (
            <Link href="/rooms" className={secondaryButtonClass}>
              Clear filters
            </Link>
          )}
        </div>
      </Form>

      {errors ? (
        <EmptyState>Fix the search fields above and try again.</EmptyState>
      ) : rooms.length === 0 ? (
        <EmptyState>{filtered ? "No rooms match your search." : "No rooms are available right now."}</EmptyState>
      ) : (
        <>
          <p className="text-sm text-zinc-500">
            {rooms.length === 1 ? "1 room" : `${rooms.length} rooms`}, cheapest first
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <ListingCard key={room.id} room={room} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
