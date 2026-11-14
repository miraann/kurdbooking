"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, MessageCircle, Trash2 } from "lucide-react";
import { fill } from "@/lib/format";
import { useI18n } from "@/components/i18n/I18nProvider";
import { ResetLink } from "@/components/forms/ResetLink";
import { ActionButton } from "@/components/ui/ActionButton";
import { createStaffLogin, removeStaffLogin, staffResetLink } from "@/app/[lang]/dashboard/actions";

// No look-alike characters (0/O, 1/l/I), so the password is easy to read out.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newPassword(length = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/**
 * A staff member's own login. None yet: email + password form; after it is
 * made, the details to pass on (copy / WhatsApp), then the page refreshes.
 * Has one: the email, a reset link, and remove. The owner's own row (or a
 * manager's) only shows whose login it is.
 */
export function StaffLogin({
  staffId,
  staffName,
  login,
}: {
  staffId: string;
  staffName: string;
  login: { email: string; staffRole: boolean } | null;
}) {
  const { t, href } = useI18n();
  const d = t.dashboard.staffDetail;
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [made, setMade] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  if (made) {
    const loginUrl = `${window.location.origin}${href("/login")}`;
    const text = fill(d.shareText, { name: staffName, link: loginUrl, email: made.email, password: made.password });
    return (
      <div className="space-y-3 rounded-2xl bg-emerald-50 p-4 text-emerald-900">
        <p className="flex items-center gap-2 font-bold"><Check className="size-5" aria-hidden /> {fill(d.created, { name: staffName })}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-emerald-700">{t.login.email}</dt>
          <dd dir="ltr" className="text-start font-mono">{made.email}</dd>
          <dt className="text-emerald-700">{t.login.password}</dt>
          <dd dir="ltr" className="text-start font-mono">{made.password}</dd>
        </dl>
        <div className="flex flex-wrap gap-2">
          <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="btn-primary">
            <MessageCircle className="size-4" aria-hidden /> {t.super.shop.resetSend}
          </a>
          <button type="button" className="btn-ghost" onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true), () => {})}>
            <Copy className="size-4" aria-hidden /> {copied ? t.common.copied : d.copyAll}
          </button>
          <button type="button" className="btn-tonal" onClick={() => router.refresh()}>{d.done}</button>
        </div>
      </div>
    );
  }

  if (login && !login.staffRole) {
    return (
      <p className="text-sm text-slate-600">
        {d.ownerLogin} <span dir="ltr" className="font-semibold">{login.email}</span>
      </p>
    );
  }

  if (login) {
    return (
      <div className="space-y-5">
        <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <KeyRound className="size-4 text-indigo-600" aria-hidden /> {d.hasLoginText}
          <span dir="ltr" className="font-semibold text-slate-900">{login.email}</span>
        </p>
        <div className="space-y-2">
          <h3 className="font-bold">{d.resetTitle}</h3>
          <p className="text-sm text-slate-500">{d.resetHelp}</p>
          <ResetLink
            make={staffResetLink.bind(null, staffId)}
            label={d.resetTitle}
            message={fill(d.resetMessage, { name: staffName })}
          />
        </div>
        <ActionButton
          action={removeStaffLogin.bind(null, staffId)}
          confirmText={fill(d.removeQ, { name: staffName })}
          className="btn-danger"
        >
          <Trash2 className="size-4" aria-hidden /> {d.remove}
        </ActionButton>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        start(async () => {
          const result = await createStaffLogin(staffId, email, password);
          if (result.ok) setMade({ email: email.trim().toLowerCase(), password });
          else setError(result.message ?? t.errors.generic);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="label">{t.login.email}</span>
          <input type="email" required dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className="input" autoComplete="off" />
        </label>
        <label className="block space-y-1.5">
          <span className="label">{t.login.password}</span>
          <span className="flex gap-2">
            <input
              type="text"
              required
              minLength={8}
              maxLength={72}
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input font-mono"
              autoComplete="new-password"
            />
            <button type="button" className="btn-tonal shrink-0 px-3" onClick={() => setPassword(newPassword())}>
              {t.super.newShop.generate}
            </button>
          </span>
          <span className="block text-xs text-slate-500">{d.passwordHelp}</span>
        </label>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? t.common.pleaseWait : d.create}
      </button>
    </form>
  );
}
