import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import type { AdminOverview, AdminProperty, UserListItem } from "@api/contract";
import { setUserDisabled } from "./actions";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import { PROPERTY_TYPE_LABELS, formatDate, formatRent } from "@/lib/format";
import { fromCents } from "@/lib/money";
import { ROLE_LABEL } from "@/lib/roles";
import { DashboardLoading, DashboardShell } from "@/components/dashboard-shell";
import { ActionButton, ActionForm } from "@/components/landlord/ActionForm";
import { inputClass } from "@/components/landlord/fields";
import { Badge, cardClass, primaryButtonClass, tableClass, tdClass, thClass } from "@/components/landlord/ui";

export const metadata = { title: "Admin · RentSystem" };

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <DashboardShell title="Admin dashboard">
      <Suspense fallback={<DashboardLoading />}>
        <AdminContent searchParams={searchParams} />
      </Suspense>
    </DashboardShell>
  );
}

// One search box for both lists (accounts by name or email; properties by name, city or landlord).
function Search({ q }: { q: string }) {
  return (
    <Form action="/admin" className="flex gap-2">
      <input
        name="q"
        defaultValue={q}
        placeholder="Search accounts and properties"
        aria-label="Search accounts and properties"
        className={`${inputClass} mt-0`}
      />
      <button type="submit" className={primaryButtonClass}>
        Search
      </button>
      {q && (
        <Link href="/admin" className="self-center text-sm text-blue-600 hover:underline dark:text-blue-400">
          Clear
        </Link>
      )}
    </Form>
  );
}

function Showing({ shown, total, q }: { shown: number; total: number; q: string }) {
  if (total === shown && !q) return null;
  return (
    <p className="text-sm text-zinc-500">
      {total === 0
        ? "Nothing matches."
        : shown < total
          ? `Showing the newest ${shown} of ${total}${q ? " matches" : ""}. Search to find others.`
          : `${total} ${total === 1 ? "match" : "matches"}.`}
    </p>
  );
}

const usd = (cents: number) => formatRent(Number(fromCents(cents)));

async function AdminContent({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  const admin = await requireRole("ADMIN");
  const { q: rawQ } = await searchParams;
  const q = typeof rawQ === "string" ? rawQ.trim() : "";
  const [overview, { users, total: userTotal }, { properties, total: propertyTotal }] = await Promise.all([
    apiGet<AdminOverview>("/admin/overview"),
    apiGet<{ users: UserListItem[]; total: number }>("/admin/users", { q }),
    apiGet<{ properties: AdminProperty[]; total: number }>("/admin/properties", { q }),
  ]);

  const tiles: [string, string, string?][] = [
    ["Landlords", String(overview.users.landlords)],
    [
      "Tenants",
      String(overview.users.tenants),
      overview.users.disabled ? `${overview.users.disabled} disabled accounts` : undefined,
    ],
    [
      "Rooms let",
      `${overview.rooms.occupied} of ${overview.rooms.total}`,
      `${overview.rooms.available} available, ${overview.properties} properties`,
    ],
    ["Active leases", String(overview.activeLeases), `${overview.pendingApplications} pending applications`],
    ["Billed this month", usd(overview.billedCents)],
    ["Collected this month", usd(overview.collectedCents)],
  ];

  return (
    <div className="space-y-10">
      <p className="text-zinc-600 dark:text-zinc-400">Signed in as {admin.email}.</p>

      <section className="grid gap-4 sm:grid-cols-3">
        {tiles.map(([label, value, note]) => (
          <div key={label} className={`${cardClass} p-4`}>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
            {note && <p className="text-sm text-zinc-500">{note}</p>}
          </div>
        ))}
      </section>

      <Search q={q} />

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Accounts</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Disabling an account signs it out everywhere and stops it signing in. Its data stays as it is.
        </p>
        <Showing shown={users.length} total={userTotal} q={q} />
        <div className={`${cardClass} overflow-x-auto`}>
          <table className={tableClass}>
            <thead className="border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className={thClass}>Name</th>
                <th className={thClass}>Role</th>
                <th className={thClass}>Joined</th>
                <th className={thClass}>Status</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className={tdClass}>
                    {u.name}
                    <div className="text-zinc-500">{u.email}</div>
                  </td>
                  <td className={tdClass}>
                    {ROLE_LABEL[u.role]}
                    {u.role === "LANDLORD" && (
                      <div className="text-zinc-500">
                        {u._count.properties === 1 ? "1 property" : `${u._count.properties} properties`}
                      </div>
                    )}
                  </td>
                  <td className={tdClass}>{formatDate(u.createdAt)}</td>
                  <td className={tdClass}>
                    {u.disabledAt ? (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                        Disabled {formatDate(u.disabledAt)}
                      </Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">Active</Badge>
                    )}
                  </td>
                  <td className={`${tdClass} text-right`}>
                    {u.role !== "ADMIN" && (
                      <ActionForm
                        action={setUserDisabled.bind(null, u.id, !u.disabledAt)}
                        confirmMessage={u.disabledAt ? undefined : `Disable ${u.name}'s account? They will be signed out.`}
                      >
                        <ActionButton
                          className={`text-sm hover:underline ${u.disabledAt ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"}`}
                        >
                          {u.disabledAt ? "Enable" : "Disable"}
                        </ActionButton>
                      </ActionForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Properties</h2>
        <Showing shown={properties.length} total={propertyTotal} q={q} />
        <div className={`${cardClass} overflow-x-auto`}>
          <table className={tableClass}>
            <thead className="border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className={thClass}>Property</th>
                <th className={thClass}>Landlord</th>
                <th className={thClass}>Rooms</th>
                <th className={thClass}>Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {properties.map((p) => (
                <tr key={p.id}>
                  <td className={tdClass}>
                    {p.name}
                    <div className="text-zinc-500">
                      {PROPERTY_TYPE_LABELS[p.type]} · {p.city}
                    </div>
                  </td>
                  <td className={tdClass}>
                    {p.landlord.name}
                    {p.landlord.disabledAt && <span className="text-red-600 dark:text-red-400"> (disabled)</span>}
                    <div className="text-zinc-500">{p.landlord.email}</div>
                  </td>
                  <td className={tdClass}>
                    {p.rooms.filter((r) => r.status === "OCCUPIED").length} of {p.rooms.length} let
                  </td>
                  <td className={tdClass}>{formatDate(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
