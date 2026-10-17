import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getOptionalUser } from "@/lib/dal";
import { ROLE_HOME, ROLE_LABEL } from "@/lib/roles";

export async function UserNav() {
  const user = await getOptionalUser();

  if (!user) {
    return (
      <div className="flex items-center gap-4 text-sm">
        <Link href="/login" className="hover:underline">
          Sign in
        </Link>
        <Link href="/signup" className="rounded-md bg-zinc-900 px-3 py-1.5 text-white dark:bg-zinc-100 dark:text-zinc-900">
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 text-sm">
      <Link href={ROLE_HOME[user.role]} className="hover:underline">
        {user.name} <span className="text-zinc-500">({ROLE_LABEL[user.role]})</span>
      </Link>
      <form action={logout}>
        <button type="submit" className="hover:underline">
          Sign out
        </button>
      </form>
    </div>
  );
}
