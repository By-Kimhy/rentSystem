import Link from "next/link";
import { acceptInvite } from "./actions";
import { ApiError, api } from "@/lib/api";
import { getOptionalUser } from "@/lib/dal";
import { ActionButton, ActionForm } from "@/components/landlord/ActionForm";
import { cardClass, primaryButtonClass, secondaryButtonClass } from "@/components/landlord/ui";

export const metadata = { title: "Invitation · RentSystem" };

type Invite = { tenantName: string; landlordName: string };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  let invite: Invite | null = null;
  try {
    invite = (await api.get<{ invite: Invite }>(`/invites/${encodeURIComponent(token)}`)).invite;
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 404)) throw e;
  }
  const user = await getOptionalUser();
  const here = `/invite/${token}`;

  return (
    <div className="mx-auto w-full max-w-md py-16">
      <div className={`${cardClass} space-y-4 p-6`}>
        <h1 className="text-xl font-semibold">Your rental on RentSystem</h1>
        {!invite ? (
          <p className="text-zinc-600 dark:text-zinc-400">
            This invite link has expired or was already used. Ask your landlord for a new one.
          </p>
        ) : (
          <>
            <p>
              {invite.landlordName} invited you to see your lease, invoices and payments as <b>{invite.tenantName}</b>,
              and to report payments online.
            </p>
            {!user ? (
              <>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Sign in or create a tenant account to accept.</p>
                <div className="flex flex-wrap gap-3">
                  <Link href={`/signup?next=${encodeURIComponent(here)}`} className={primaryButtonClass}>
                    Create an account
                  </Link>
                  <Link href={`/login?next=${encodeURIComponent(here)}`} className={secondaryButtonClass}>
                    Sign in
                  </Link>
                </div>
              </>
            ) : user.role !== "TENANT" ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                You&apos;re signed in as {user.name}, which isn&apos;t a tenant account. Sign out, then open this link again
                and sign in or create a tenant account.
              </p>
            ) : (
              <ActionForm action={acceptInvite.bind(null, token)}>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  You&apos;re signed in as {user.name} ({user.email}).
                </p>
                <ActionButton className={primaryButtonClass}>Accept and go to my dashboard</ActionButton>
              </ActionForm>
            )}
          </>
        )}
      </div>
    </div>
  );
}
