"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "@/app/actions/auth";
import { Field, buttonClass } from "@/components/field";

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);
  const role = state?.values?.role ?? "TENANT";

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Full name" name="name" autoComplete="name" defaultValue={state?.values?.name} errors={state?.errors?.name} />
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} errors={state?.errors?.email} />
      <Field label="Password" name="password" type="password" autoComplete="new-password" errors={state?.errors?.password} />
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-medium">I am a</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="role" value="TENANT" defaultChecked={role === "TENANT"} />
          Tenant, looking for a room
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="role" value="LANDLORD" defaultChecked={role === "LANDLORD"} />
          Landlord, renting out rooms
        </label>
        {state?.errors?.role?.map((e) => (
          <span key={e} className="text-red-600">
            {e}
          </span>
        ))}
      </fieldset>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
