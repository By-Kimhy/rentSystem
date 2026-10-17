"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { Field, buttonClass } from "@/components/field";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} errors={state?.errors?.email} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" errors={state?.errors?.password} />
      {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        No account yet?{" "}
        <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-medium underline">
          Create one
        </Link>
      </p>
    </form>
  );
}
