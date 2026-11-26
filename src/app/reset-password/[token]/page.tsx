import Link from "next/link";
import { ApiError, api } from "@/lib/api";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Choose a new password · RentSystem" };

export default async function ResetPasswordPage({ params }: PageProps<"/reset-password/[token]">) {
  const { token } = await params;
  let email: string | null = null;
  try {
    email = (await api.get<{ email: string }>(`/auth/reset-password/${encodeURIComponent(token)}`)).email;
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 404)) throw e;
  }

  return (
    <div className="mx-auto w-full max-w-sm py-16">
      <h1 className="mb-2 text-2xl font-semibold">Choose a new password</h1>
      {email ? (
        <>
          <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
            For <b>{email}</b>. Every other device signed in to this account will be signed out.
          </p>
          <ResetPasswordForm token={token} />
        </>
      ) : (
        <div className="space-y-4">
          <p className="text-zinc-600 dark:text-zinc-400">This reset link has expired or was already used.</p>
          <Link href="/forgot-password" className="text-sm font-medium underline">
            Ask for a new link
          </Link>
        </div>
      )}
    </div>
  );
}
