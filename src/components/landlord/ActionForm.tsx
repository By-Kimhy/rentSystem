"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

export type ActionResult = { error?: string; fieldErrors?: Record<string, string[] | undefined> };

type Stamped = ActionResult & { done?: number };

// A small form around a server action that can fail with a message, e.g. "Activate lease".
// Unlike a plain form action, it keeps what was typed when the action fails and clears it on success.
export function ActionForm({
  action,
  children,
  confirmMessage,
  className = "space-y-3",
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  confirmMessage?: string;
  className?: string;
}) {
  const [state, formAction] = useActionState<Stamped, FormData>(
    async (prev, formData) => ({ ...(await action(prev, formData)), done: Date.now() }),
    {},
  );
  const form = useRef<HTMLFormElement>(null);
  const failed = Boolean(state.error || state.fieldErrors);
  useEffect(() => {
    if (state.done && !failed) form.current?.reset();
  }, [state.done, failed]);
  const fieldErrors = Object.values(state.fieldErrors ?? {}).flat().filter(Boolean);

  return (
    <form
      ref={form}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmMessage && !confirm(confirmMessage)) return;
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => formAction(data));
      }}
    >
      {children}
      {failed && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error ?? fieldErrors[0]}
        </p>
      )}
    </form>
  );
}

export function ActionButton({
  children,
  className,
  name,
  value,
}: {
  children: React.ReactNode;
  className: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={className}>
      {pending ? "Working…" : children}
    </button>
  );
}
