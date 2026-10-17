"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/landlord", label: "Dashboard" },
  { href: "/landlord/properties", label: "Properties" },
  { href: "/landlord/applications", label: "Applications" },
  { href: "/landlord/tenants", label: "Tenants" },
  { href: "/landlord/leases", label: "Leases" },
  { href: "/landlord/invoices", label: "Invoices" },
  { href: "/landlord/payments", label: "Payments" },
];

export function LandlordNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-zinc-200 dark:border-zinc-800 print:hidden">
      <ul className="mx-auto flex w-full max-w-4xl gap-1 overflow-x-auto px-6 text-sm">
        {LINKS.map(({ href, label }) => {
          const active = href === "/landlord" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`block whitespace-nowrap border-b-2 px-3 py-3 ${
                  active
                    ? "border-zinc-900 font-medium text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                    : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
