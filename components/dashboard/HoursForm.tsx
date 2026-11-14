"use client";

import { useActionState } from "react";
import { initialActionState, type ActionState } from "@/lib/fields";
import { fill } from "@/lib/format";
import type { WorkingHours } from "@/lib/types";
import { useI18n } from "@/components/i18n/I18nProvider";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Switch } from "@/components/ui/Switch";

// Week starts on Saturday, as people in Kurdistan and Iraq count it.
const ORDER = [6, 0, 1, 2, 3, 4, 5];
const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

export function HoursForm({
  hours,
  action,
  saveLabel,
}: {
  hours: WorkingHours[];
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  saveLabel?: string;
}) {
  const { t, f } = useI18n();
  const h = t.dashboard.hours;
  const [state, formAction] = useActionState(action, initialActionState);
  const byDay = new Map(hours.map((x) => [x.day_of_week, x]));

  return (
    <form action={formAction} key={state.nonce ?? 0} className="card space-y-3">
      <div className="hidden grid-cols-[7rem_4rem_1fr_1fr_1fr_1fr] gap-2 text-xs text-slate-500 sm:grid">
        <span>{h.day}</span><span>{h.open}</span><span>{h.from}</span><span>{h.to}</span><span>{h.breakFrom}</span><span>{h.breakTo}</span>
      </div>
      {ORDER.map((d) => {
        const day = byDay.get(d);
        return (
          <div key={d} className="grid grid-cols-2 items-center gap-2 border-b border-slate-100 pb-3 sm:grid-cols-[7rem_4rem_1fr_1fr_1fr_1fr] sm:border-0 sm:pb-0">
            <span className="font-semibold">{f.day(d)}</span>
            <label className="flex items-center gap-2 text-sm">
              <Switch name={`open_${d}`} defaultChecked={day?.is_open ?? true} label={fill(h.isOpen, { day: f.day(d) })} />
              <span className="sm:hidden">{h.open}</span>
            </label>
            <input type="time" name={`from_${d}`} defaultValue={hhmm(day?.open_time) || "10:00"} className="input" aria-label={h.from} />
            <input type="time" name={`to_${d}`} defaultValue={hhmm(day?.close_time) || "20:00"} className="input" aria-label={h.to} />
            <input type="time" name={`bstart_${d}`} defaultValue={hhmm(day?.break_start)} className="input" aria-label={h.breakFrom} />
            <input type="time" name={`bend_${d}`} defaultValue={hhmm(day?.break_end)} className="input" aria-label={h.breakTo} />
          </div>
        );
      })}
      {state.message && <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{state.message}</p>}
      <SubmitButton>{saveLabel ?? h.save}</SubmitButton>
    </form>
  );
}
