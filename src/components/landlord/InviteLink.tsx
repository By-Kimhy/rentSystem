"use client";

import { useState, useTransition } from "react";
import { createInvite } from "@/app/landlord/tenants/actions";
import { inputClass } from "./fields";
import { secondaryButtonClass } from "./ui";

// Makes an invite link and shows it once, ready to copy into a message to the tenant.
export function InviteLink({ tenantId, hasInvite }: { tenantId: string; hasInvite: boolean }) {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const create = () =>
    startTransition(async () => {
      const result = await createInvite(tenantId);
      setCopied(false);
      setError(result.error ?? null);
      setLink(result.token ? `${window.location.origin}/invite/${result.token}` : null);
    });

  return (
    <div className="space-y-2">
      <button type="button" onClick={create} disabled={pending} className={secondaryButtonClass}>
        {pending ? "Working…" : hasInvite || link ? "Create a new link" : "Create invite link"}
      </button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {link && (
        <div className="space-y-1">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Send this link to the tenant. It is shown only now, works once, and replaces any earlier link.
          </p>
          <div className="flex gap-2">
            <input readOnly value={link} onFocus={(e) => e.target.select()} className={`${inputClass} mt-0`} />
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true))}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
