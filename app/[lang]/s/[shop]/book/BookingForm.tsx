"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { addDays, dayOfWeek } from "@/lib/booking";

import { bookingsKey, type SavedBooking } from "@/lib/saved-bookings";
import { useI18n } from "@/components/i18n/I18nProvider";
import { bookAppointment } from "./actions";

interface ServiceOption { id: string; name: string; duration_minutes: number; price_iqd: number | null }
interface StaffOption { id: string; name: string; title: string | null; photo_url: string | null; is_active: boolean }

export function BookingForm(props: {
  slug: string;
  base: string;
  today: string;
  maxDaysAhead: number;
  autoConfirm: boolean;
  services: ServiceOption[];
  staff: StaffOption[];
  staffServices: { staff_id: string; service_id: string }[];
}) {
  const router = useRouter();
  const { t, f, href } = useI18n();
  const b = t.booking;
  const [serviceId, setServiceId] = useState(props.services.length === 1 ? props.services[0].id : "");
  const [staffId, setStaffId] = useState("any");
  const [date, setDate] = useState(props.today);
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const service = props.services.find((s) => s.id === serviceId);
  const staffForService = useMemo(
    () =>
      props.staff.filter((m) => {
        const mine = props.staffServices.filter((l) => l.staff_id === m.id);
        return mine.length === 0 || mine.some((l) => l.service_id === serviceId);
      }),
    [props.staff, props.staffServices, serviceId],
  );
  const days = useMemo(
    () => Array.from({ length: Math.min(props.maxDaysAhead + 1, 30) }, (_, i) => addDays(props.today, i)),
    [props.today, props.maxDaysAhead],
  );

  // Load free times whenever service / staff / day change.
  useEffect(() => {
    if (!serviceId) return;
    const controller = new AbortController();
    const q = new URLSearchParams({ service: serviceId, staff: staffId, date });
    fetch(`/api/shops/${props.slug}/slots?${q}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d: { slots?: string[] }) => setSlots(d.slots ?? []))
      .catch(() => {});
    return () => controller.abort();
  }, [serviceId, staffId, date, reload, props.slug]);

  function submit(formData: FormData) {
    setError("");
    start(async () => {
      const result = await bookAppointment(props.slug, {
        serviceId,
        staffId,
        date,
        time,
        name: String(formData.get("name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        note: String(formData.get("note") ?? ""),
      });
      if (!result.ok) {
        setError(result.message);
        if (result.slotTaken) {
          setTime("");
          setSlots(null);
          setReload((r) => r + 1); // fetch the free times again
        }
        return;
      }
      try {
        const saved: SavedBooking[] = JSON.parse(localStorage.getItem(bookingsKey(props.slug)) ?? "[]");
        saved.unshift({ id: result.id, token: result.token, when: `${f.date(date)} · ${f.time(time)}`, service: service?.name ?? "" });
        localStorage.setItem(bookingsKey(props.slug), JSON.stringify(saved.slice(0, 20)));
      } catch {
        // private mode / storage blocked: the receipt link still works
      }
      router.push(href(`${props.base}/appointment/${result.id}?t=${result.token}`));
    });
  }

  return (
    <div className="space-y-6">
      {/* 1. Service */}
      <Step n={f.num(1)} title={b.chooseService}>
        <div className="grid gap-2 sm:grid-cols-2">
          {props.services.map((s) => (
            <Choice
              key={s.id}
              selected={s.id === serviceId}
              onClick={() => { setServiceId(s.id); setStaffId("any"); setTime(""); setSlots(null); }}
            >
              <span className="font-semibold">{s.name}</span>
              <span className="text-xs text-slate-500">
                {f.minutes(s.duration_minutes)}{s.price_iqd != null ? ` · ${f.iqd(s.price_iqd)}` : ""}
              </span>
            </Choice>
          ))}
        </div>
      </Step>

      {/* 2. Staff (only when there's a choice) */}
      {service && staffForService.length > 1 && (
        <Step n={f.num(2)} title={b.who}>
          <div className="flex flex-wrap gap-2">
            <Choice selected={staffId === "any"} onClick={() => { setStaffId("any"); setTime(""); setSlots(null); }}>
              <span className="font-semibold">{b.anyone}</span>
            </Choice>
            {staffForService.map((m) => (
              <Choice key={m.id} selected={staffId === m.id} onClick={() => { setStaffId(m.id); setTime(""); setSlots(null); }}>
                <span className="font-semibold">{m.name}</span>
                {m.title && <span className="text-xs text-slate-500">{m.title}</span>}
              </Choice>
            ))}
          </div>
        </Step>
      )}

      {/* 3. Day + time */}
      {service && (
        <Step n={f.num(staffForService.length > 1 ? 3 : 2)} title={b.dayTime}>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
            {days.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => { setDate(d); setTime(""); setSlots(null); }}
                className={`flex w-16 shrink-0 flex-col items-center rounded-xl border py-2 text-xs transition ${
                  d === date ? "border-transparent text-white" : "border-slate-200 bg-white text-slate-600"
                }`}
                style={d === date ? { background: "var(--shop-primary)" } : undefined}
              >
                <span>{f.day(dayOfWeek(d))}</span>
                <span className="text-lg font-bold">{f.num(Number(d.slice(8)))}</span>
              </button>
            ))}
          </div>
          <div className="mt-3">
            {slots === null ? (
              <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> {t.common.pleaseWait}</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-slate-500">{b.noSlots}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setTime(slot)}
                    className={`rounded-xl border py-2 text-sm transition ${slot === time ? "border-transparent text-white" : "border-slate-200 bg-white"}`}
                    style={slot === time ? { background: "var(--shop-primary)" } : undefined}
                  >
                    {f.time(slot)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Step>
      )}

      {/* 4. Details */}
      {service && time && (
        <Step n={f.num(staffForService.length > 1 ? 4 : 3)} title={b.yourDetails}>
          <form action={submit} className="space-y-3">
            <p className="rounded-xl bg-slate-50 p-3 text-sm">
              {service.name} · {f.date(date)} · {f.time(time)}
            </p>
            <input name="name" required minLength={2} maxLength={80} placeholder={b.fullName} className="input" autoComplete="name" />
            <input name="phone" type="tel" dir="ltr" required placeholder="07XX XXX XXXX" className="input" autoComplete="tel" />
            <textarea name="note" maxLength={500} rows={2} placeholder={b.note} className="input" />
            {error && <p className="text-sm text-rose-700">{error}</p>}
            <button type="submit" disabled={pending} className="btn-shop w-full py-3 text-base">
              {pending ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
              {props.autoConfirm ? b.book : b.request}
            </button>
          </form>
        </Step>
      )}
      {error && !time && <p className="text-sm text-rose-700">{error}</p>}
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-3">
      <h2 className="flex items-center gap-2 font-bold">
        <span className="grid size-7 place-items-center rounded-full text-sm text-white" style={{ background: "var(--shop-primary)" }}>
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-start transition ${
        selected ? "border-transparent ring-2" : "border-slate-200 bg-white hover:border-slate-300"
      }`}
      style={selected ? ({ "--tw-ring-color": "var(--shop-primary)" } as React.CSSProperties) : undefined}
    >
      {children}
    </button>
  );
}
