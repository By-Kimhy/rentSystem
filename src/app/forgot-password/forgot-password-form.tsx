"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/app/actions/auth";
import { Field, buttonClass } from "@/components/field";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  if (state?.message === "sent") {
    return (
      <div className="space-y-4" role="status">
        <p>
          If <b>{state.values?.email}</b> has an account, a reset link is on its way. It works once and expires in an
          hour. Check your spam folder if it doesn&apos;t arrive in a few minutes.
        </p>
        <Link href="/login" className="text-sm font-medium underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} errors={state?.errors?.email} />
      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Remembered it?{" "}
        <Link href="/login" className="font-medium underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
