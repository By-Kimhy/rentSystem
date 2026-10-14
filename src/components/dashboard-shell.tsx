import type { ReactNode } from "react";

export function DashboardShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">{title}</h1>
      {children}
    </div>
  );
}

export function DashboardLoading() {
  return <p className="text-zinc-500">Loading…</p>;
}
