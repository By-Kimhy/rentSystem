import Link from "next/link";

export const primaryButtonClass =
  "inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

export const secondaryButtonClass =
  "inline-block rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

export const linkClass = "text-sm text-blue-600 hover:underline dark:text-blue-400";

export const cardClass = "rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";

export function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>{children}</span>;
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={linkClass}>
      ← {children}
    </Link>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-zinc-500 dark:border-zinc-700">
      {children}
    </p>
  );
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  );
}

// A definition list for read-only details: [label, value] pairs.
export function Details({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
          <dd className="text-zinc-900 dark:text-zinc-100">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export const tableClass = "w-full text-left text-sm";
export const thClass = "px-4 py-2 font-medium text-zinc-500";
export const tdClass = "px-4 py-2 align-top";
