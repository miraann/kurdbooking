"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/lib/fields";

/** A button that runs a bound Server Action, with optional confirm(). */
export function ActionButton({
  action,
  children,
  confirmText,
  className = "btn-ghost",
}: {
  action: () => Promise<ActionState | void>;
  children: React.ReactNode;
  confirmText?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        className={className}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          setError("");
          start(async () => {
            const result = await action();
            if (result && !result.ok && result.message) setError(result.message);
          });
        }}
      >
        {pending ? "…" : children}
      </button>
      {error && <span className="text-xs text-rose-700">{error}</span>}
    </span>
  );
}
