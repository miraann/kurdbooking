"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarDays, Check, Clock, Loader2, Scissors } from "lucide-react";
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
              <span className="text-xs text-neutral-500">
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
                {m.title && <span className="text-xs text-neutral-500">{m.title}</span>}
              </Choice>
            ))}
          </div>
        </Step>
      )}

      {/* 3. Day + time */}
      {service && (
        <Step n={f.num(staffForService.length > 1 ? 3 : 2)} title={b.dayTime}>
          <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2 scrollbar-hide">
            {days.map((d) => {
              const on = d === date;
              const isToday = d === props.today;
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => { setDate(d); setTime(""); setSlots(null); }}
                  className={`flex w-16 shrink-0 snap-start touch-manipulation flex-col items-center gap-0.5 rounded-2xl border py-3 transition active:scale-95 ${
                    on ? "border-transparent text-white shadow-md" : isToday ? "bg-white" : "border-neutral-200 bg-white text-neutral-600 shadow-sm"
                  }`}
                  style={on ? { background: "var(--shop-primary)" } : isToday ? { borderColor: "var(--shop-primary)", color: "var(--shop-primary)" } : undefined}
                >
                  <span className={`text-[0.6rem] font-semibold ${on ? "text-white/80" : ""}`}>{f.day(dayOfWeek(d))}</span>
                  <span className={`text-lg font-bold leading-none ${on || isToday ? "" : "text-neutral-800"}`}>{f.num(Number(d.slice(8)))}</span>
                  <span
                    className={`mt-0.5 size-1.5 rounded-full ${isToday || on ? "" : "invisible"}`}
                    style={{ background: on ? "rgb(255 255 255 / 0.5)" : "var(--shop-primary)" }}
                  />
                </button>
              );
            })}
          </div>
          <div className="mt-3">
            {slots === null ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-busy="true" aria-label={t.common.pleaseWait}>
                {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-neutral-100" />)}
              </div>
            ) : slots.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="grid size-14 place-items-center rounded-full border border-neutral-200 bg-neutral-50">
                  <Clock className="size-6 text-neutral-300" aria-hidden />
                </div>
                <p className="px-6 text-sm leading-relaxed text-neutral-500">{b.noSlots}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    aria-pressed={slot === time}
                    onClick={() => setTime(slot)}
                    className={`h-14 touch-manipulation rounded-2xl border text-sm font-semibold transition active:scale-[0.97] ${
                      slot === time ? "border-transparent text-white shadow-md" : "border-neutral-200 bg-white text-neutral-800 shadow-sm hover:border-neutral-300"
                    }`}
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
            <ul className="grid gap-2 rounded-2xl border border-neutral-100 bg-neutral-50 p-3 text-sm sm:grid-cols-3">
              <SummaryItem icon={<Scissors className="size-4" />} text={service.name} />
              <SummaryItem icon={<CalendarDays className="size-4" />} text={f.date(date)} />
              <SummaryItem icon={<Clock className="size-4" />} text={f.time(time)} />
            </ul>
            <input name="name" required minLength={2} maxLength={80} placeholder={b.fullName} className="input-shop" autoComplete="name" />
            <input name="phone" type="tel" dir="ltr" required placeholder="07XX XXX XXXX" className="input-shop" autoComplete="tel" />
            <textarea name="note" maxLength={500} rows={2} placeholder={b.note} className="input-shop h-auto py-3.5" />
            {error && <ErrorBox message={error} />}
            <button type="submit" disabled={pending} className="btn-shop w-full">
              {pending ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
              {props.autoConfirm ? b.book : b.request}
            </button>
          </form>
        </Step>
      )}
      {error && !time && <ErrorBox message={error} />}
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="card-shop space-y-4">
      <h2 className="flex items-center gap-2.5 text-lg font-bold text-neutral-900">
        <span className="grid size-8 place-items-center rounded-full text-sm text-white shadow-sm" style={{ background: "var(--shop-primary)" }}>
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
      className={`flex touch-manipulation flex-col items-start gap-0.5 rounded-2xl border px-4 py-3.5 text-start transition active:scale-[0.98] ${
        selected ? "border-transparent ring-2" : "border-neutral-200 bg-white shadow-sm hover:border-neutral-300"
      }`}
      style={
        selected
          ? ({
              "--tw-ring-color": "var(--shop-primary)",
              background: "color-mix(in srgb, var(--shop-primary) 6%, white)",
            } as React.CSSProperties)
          : undefined
      }
    >
      {children}
    </button>
  );
}

function SummaryItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex min-w-0 items-center gap-2">
      <span
        className="grid size-8 shrink-0 place-items-center rounded-xl"
        style={{ color: "var(--shop-primary)", background: "color-mix(in srgb, var(--shop-primary) 10%, white)" }}
      >
        {icon}
      </span>
      <span className="truncate font-semibold text-neutral-800">{text}</span>
    </li>
  );
}

/** zhewar's error look: red-tinted box with an alert icon. */
function ErrorBox({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {message}
    </p>
  );
}
