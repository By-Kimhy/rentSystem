"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPassword } from "@/app/actions/auth";
import { Field, buttonClass } from "@/components/field";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword.bind(null, token), undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="New password" name="password" type="password" autoComplete="new-password" errors={state?.errors?.password} />
      <Field label="Type it again" name="confirm" type="password" autoComplete="new-password" errors={state?.errors?.confirm} />
      {state?.message && (
        <p className="text-sm text-red-600">
          {state.message}{" "}
          <Link href="/forgot-password" className="underline">
            Ask for a new link
          </Link>
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
