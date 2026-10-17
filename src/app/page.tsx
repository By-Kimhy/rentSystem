import Link from "next/link";
import { buttonClass } from "@/components/field";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">Find or rent out a room</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        RentSystem connects landlords with tenants for rooms in apartments, condos and houses.
      </p>
      <div className="flex gap-3">
        <Link href="/rooms" className={buttonClass}>
          Browse rooms
        </Link>
        <Link href="/signup" className="rounded-md border border-zinc-300 px-4 py-2 font-medium dark:border-zinc-700">
          Get started
        </Link>
      </div>
    </div>
  );
}
