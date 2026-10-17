import Link from "next/link";
import type { Application } from "@api/contract";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_STYLES, formatDate, formatRent } from "@/lib/format";
import { Badge, EmptyState, PageHeader, cardClass, tableClass, tdClass, thClass } from "@/components/landlord/ui";

export const metadata = { title: "Applications · RentSystem" };

const FILTERS = [
  { key: "", label: "Pending" },
  { key: "all", label: "All" },
];

export default async function ApplicationsPage({ searchParams }: PageProps<"/landlord/applications">) {
  await requireRole("LANDLORD");
  const { show: rawShow } = await searchParams;
  const filter = FILTERS.find((f) => f.key === rawShow) ?? FILTERS[0];
  const { applications } = await apiGet<{ applications: Application[] }>("/landlord/applications", { show: filter.key });

  return (
    <div className="space-y-6">
      <PageHeader title="Applications" />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Tenants apply from your rooms&apos; public listings. Approving an application adds the applicant to your tenants
        so you can write their lease.
      </p>
      <div className="flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key ? `/landlord/applications?show=${f.key}` : "/landlord/applications"}
            className={`rounded-full border px-3 py-1 ${
              filter.key === f.key
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      {applications.length === 0 ? (
        <EmptyState>{filter.key ? "No applications yet." : "No applications are waiting for you."}</EmptyState>
      ) : (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className={tableClass}>
            <thead className="border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className={thClass}>Applicant</th>
                <th className={thClass}>Room</th>
                <th className={thClass}>Move in</th>
                <th className={thClass}>People</th>
                <th className={thClass}>Applied</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {applications.map((a) => (
                <tr key={a.id}>
                  <td className={tdClass}>
                    <Link href={`/landlord/applications/${a.id}`} className="font-medium hover:underline">
                      {a.applicant.name}
                    </Link>
                  </td>
                  <td className={tdClass}>
                    {a.room.name}, {a.room.property.name}
                    <span className="block text-xs text-zinc-500">{formatRent(a.room.rentPrice)} / month</span>
                  </td>
                  <td className={tdClass}>{formatDate(a.moveInDate)}</td>
                  <td className={tdClass}>{a.occupants}</td>
                  <td className={tdClass}>{formatDate(a.createdAt)}</td>
                  <td className={tdClass}>
                    <Badge className={APPLICATION_STATUS_STYLES[a.status]}>{APPLICATION_STATUS_LABELS[a.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
