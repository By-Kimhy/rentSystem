import Link from "next/link";
import type { Application } from "@api/contract";
import { approveApplication, rejectApplication } from "../actions";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import { toISODate } from "@/lib/dates";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_STYLES,
  ROOM_STATUS_LABELS,
  formatDate,
  formatRent,
} from "@/lib/format";
import { ActionButton, ActionForm } from "@/components/landlord/ActionForm";
import { BackLink, Badge, Details, cardClass, linkClass, primaryButtonClass, secondaryButtonClass } from "@/components/landlord/ui";

export const metadata = { title: "Application · RentSystem" };

export default async function ApplicationPage({ params }: PageProps<"/landlord/applications/[id]">) {
  const { id } = await params;
  await requireRole("LANDLORD");
  const { application: a } = await apiGet<{ application: Application }>(`/landlord/applications/${id}`);
  const roomHref = `/landlord/properties/${a.room.property.id}`;

  return (
    <div className="max-w-2xl space-y-8">
      <BackLink href="/landlord/applications">Applications</BackLink>

      <div className="space-y-1">
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold">
          {a.applicant.name}
          <Badge className={APPLICATION_STATUS_STYLES[a.status]}>{APPLICATION_STATUS_LABELS[a.status]}</Badge>
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Applied {formatDate(a.createdAt)} for{" "}
          <Link href={roomHref} className={linkClass}>
            {a.room.name}, {a.room.property.name}
          </Link>
        </p>
      </div>

      <section className="space-y-4">
        <Details
          items={[
            ["Email", <a key="email" href={`mailto:${a.applicant.email}`} className={linkClass}>{a.applicant.email}</a>],
            ["Phone", <a key="phone" href={`tel:${a.phone}`} className={linkClass}>{a.phone}</a>],
            ["Move-in date", formatDate(a.moveInDate)],
            ["People", `${a.occupants} (room fits ${a.room.maxOccupants})`],
            ["Rent", `${formatRent(a.room.rentPrice)} per month`],
            ["Room status", ROOM_STATUS_LABELS[a.room.status]],
          ]}
        />
        {a.message && (
          <blockquote className="whitespace-pre-line border-l-4 border-zinc-300 pl-4 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
            {a.message}
          </blockquote>
        )}
      </section>

      {a.status === "PENDING" && (
        <section className={`${cardClass} space-y-3 p-6`}>
          <h2 className="text-lg font-semibold">Decide</h2>
          {a.room.status !== "AVAILABLE" && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              This room is now {ROOM_STATUS_LABELS[a.room.status].toLowerCase()}, so you may want to decline.
            </p>
          )}
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Approving adds {a.applicant.name} to your tenants and opens a new lease for this room, starting on their
            move-in date. Nothing is signed until you save the lease.
          </p>
          <div className="flex flex-wrap gap-3">
            <ActionForm action={approveApplication.bind(null, a.id)}>
              <ActionButton className={primaryButtonClass}>Approve and write lease</ActionButton>
            </ActionForm>
            <ActionForm action={rejectApplication.bind(null, a.id)} confirmMessage={`Decline ${a.applicant.name}'s application?`}>
              <ActionButton className={secondaryButtonClass}>Decline</ActionButton>
            </ActionForm>
          </div>
        </section>
      )}

      {a.status === "APPROVED" && a.tenant && (
        <section className={`${cardClass} space-y-3 p-6`}>
          <p>
            Approved {a.decidedAt && formatDate(a.decidedAt)}. {a.applicant.name} is in your tenants as{" "}
            <Link href={`/landlord/tenants/${a.tenant.id}`} className={linkClass}>
              {a.tenant.fullName}
            </Link>
            .
          </p>
          <Link
            href={`/landlord/leases/new?${new URLSearchParams({ room: a.room.id, tenant: a.tenant.id, start: toISODate(a.moveInDate) })}`}
            className={secondaryButtonClass}
          >
            Write their lease
          </Link>
        </section>
      )}

      {a.status === "REJECTED" && a.decidedAt && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Declined {formatDate(a.decidedAt)}.</p>
      )}
    </div>
  );
}
