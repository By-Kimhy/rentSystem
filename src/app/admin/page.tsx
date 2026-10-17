import { Suspense } from "react";
import type { UserListItem } from "@api/contract";
import { apiGet } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import { ROLE_LABEL } from "@/lib/roles";
import { DashboardLoading, DashboardShell } from "@/components/dashboard-shell";

export const metadata = { title: "Admin · RentSystem" };

export default function AdminPage() {
  return (
    <DashboardShell title="Admin dashboard">
      <Suspense fallback={<DashboardLoading />}>
        <AdminContent />
      </Suspense>
    </DashboardShell>
  );
}

async function AdminContent() {
  const admin = await requireRole("ADMIN");
  const { users } = await apiGet<{ users: UserListItem[] }>("/admin/users");

  return (
    <>
      <p className="mb-6 text-zinc-600 dark:text-zinc-400">Signed in as {admin.email}. All accounts:</p>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 dark:border-zinc-800">
          <tr>
            <th className="py-2">Name</th>
            <th className="py-2">Email</th>
            <th className="py-2">Role</th>
            <th className="py-2">Joined</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-zinc-100 dark:border-zinc-900">
              <td className="py-2">{u.name}</td>
              <td className="py-2">{u.email}</td>
              <td className="py-2">{ROLE_LABEL[u.role]}</td>
              <td className="py-2">{u.createdAt.toISOString().slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
