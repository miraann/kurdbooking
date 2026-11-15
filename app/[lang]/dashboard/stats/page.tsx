import Link from "next/link";
import { connection } from "next/server";
import { requireShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, dayOfWeek, todayKey } from "@/lib/booking";
import { fill } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { APPOINTMENT_STATUS } from "@/lib/labels";
import type { AppointmentStatus } from "@/lib/types";
import { BarList, ColumnChart, StatTile, type Datum } from "@/components/dashboard/charts";

// Owner stats for a chosen period (30 days / 3 months / 12 months): headline
// numbers, bookings over time, statuses, top services, staff, busiest days
// and hours. Counted in the shop's time zone from the shop's own bookings.

const RANGES = { "30": 30, "90": 90, "365": 365 } as const;
type Range = keyof typeof RANGES;
const PAGE = 1000; // Supabase returns at most 1000 rows per request
const MAX_ROWS = 20000;
// Week starts on Saturday, as people in Kurdistan and Iraq count it.
const WEEK = [6, 0, 1, 2, 3, 4, 5];
const STATUSES: AppointmentStatus[] = ["completed", "confirmed", "pending", "cancelled", "no_show"];

interface Row {
  starts_at: string;
  status: AppointmentStatus;
  price_iqd: number | null;
  service_name: string | null;
  staff_id: string;
}

export default async function StatsPage({ searchParams }: PageProps<"/[lang]/dashboard/stats">) {
  const { range: rawRange } = await searchParams;
  const range: Range = rawRange === "30" || rawRange === "365" ? rawRange : "90";
  await connection(); // the period ends now: never prerender
  const [{ shop }, { lang, t, f }] = await Promise.all([requireShop(["owner", "manager"]), getI18n()]);
  const s = t.dashboard.stats;
  const supabase = await createClient();
  const tz = shop.timezone;

  const today = todayKey(tz);
  const firstDay = addDays(today, -(RANGES[range] - 1));
  // A day either side, then the exact local days are kept below.
  const from = new Date(Date.parse(`${firstDay}T00:00:00Z`) - 86_400_000).toISOString();
  const to = new Date().toISOString();

  const rows: Row[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const { data, error } = await supabase
      .from("appointments")
      .select("starts_at, status, price_iqd, service_name, staff_id")
      .eq("shop_id", shop.id)
      .gte("starts_at", from)
      .lt("starts_at", to)
      .order("starts_at")
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) break;
  }
  const { data: staffRows } = await supabase.from("staff").select("id, name").eq("shop_id", shop.id).order("sort_order");
  const staffName = new Map((staffRows ?? []).map((r) => [r.id as string, r.name as string]));

  // Local date and hour of each booking.
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
  const items = rows
    .map((r) => {
      const p = Object.fromEntries(local.formatToParts(new Date(r.starts_at)).map((x) => [x.type, x.value]));
      return { ...r, dateKey: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
    })
    .filter((r) => r.dateKey >= firstDay && r.dateKey <= today);

  const count = (n: number) => fill(s.count, { n: f.num(n) });
  const table = { show: s.table, name: s.colName, value: s.colValue };

  if (items.length === 0) {
    return (
      <div className="space-y-5">
        <Header range={range} />
        <p className="card text-center text-sm text-slate-500">{s.empty}</p>
      </div>
    );
  }

  // ── Headline numbers ──
  const by = (st: AppointmentStatus) => items.filter((r) => r.status === st).length;
  const completed = by("completed");
  const noShow = by("no_show");
  const finished = completed + noShow;
  const income = items.filter((r) => r.status === "completed").reduce((sum, r) => sum + (r.price_iqd ?? 0), 0);

  // ── Over time: days (30), weeks from Saturday (90) or months (365) ──
  const bucketOf = (dateKey: string) => {
    if (range === "30") return dateKey;
    if (range === "365") return dateKey.slice(0, 7);
    return addDays(dateKey, -((dayOfWeek(dateKey) + 1) % 7)); // back to Saturday
  };
  const buckets: string[] = [];
  for (let d = firstDay; d <= today; d = addDays(d, 1)) {
    const b = bucketOf(d);
    if (buckets[buckets.length - 1] !== b) buckets.push(b);
  }
  const perBucket = new Map<string, number>();
  for (const r of items) perBucket.set(bucketOf(r.dateKey), (perBucket.get(bucketOf(r.dateKey)) ?? 0) + 1);
  const overTime: Datum[] = buckets.map((b) => {
    const value = perBucket.get(b) ?? 0;
    const [y, m, d] = b.split("-").map(Number);
    return {
      key: b,
      value,
      valueText: count(value),
      label: range === "365" ? f.num(m) : range === "30" ? f.num(d) : `${f.num(d)}/${f.num(m)}`,
      detail: range === "365" ? `${f.month(m)} ${f.num(y)}` : range === "30" ? f.date(b) : fill(s.weekOf, { date: f.date(b) }),
    };
  });

  // ── Statuses, services, staff ──
  const statusData: Datum[] = STATUSES.map((st) => {
    const n = by(st);
    return { key: st, label: APPOINTMENT_STATUS[st][lang], value: n, valueText: `${count(n)} · ${f.percent((n / items.length) * 100)}` };
  }).filter((d) => d.value > 0);

  const services = new Map<string, { n: number; income: number }>();
  for (const r of items) {
    if (r.status === "cancelled") continue;
    const name = r.service_name || "—";
    const e = services.get(name) ?? { n: 0, income: 0 };
    e.n += 1;
    if (r.status === "completed") e.income += r.price_iqd ?? 0;
    services.set(name, e);
  }
  const serviceData: Datum[] = [...services.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 8)
    .map(([name, e]) => ({ key: name, label: name, value: e.n, valueText: e.income ? `${count(e.n)} · ${f.iqd(e.income)}` : count(e.n) }));

  const perStaff = new Map<string, number>();
  for (const r of items) if (r.status !== "cancelled") perStaff.set(r.staff_id, (perStaff.get(r.staff_id) ?? 0) + 1);
  const staffData: Datum[] = [...perStaff.entries()].map(([id, n]) => ({ key: id, label: staffName.get(id) ?? "—", value: n, valueText: count(n) }));

  // ── Busiest days and hours (cancelled bookings left out) ──
  const live = items.filter((r) => r.status !== "cancelled");
  const weekdayData: Datum[] = WEEK.map((dow) => {
    const n = live.filter((r) => dayOfWeek(r.dateKey) === dow).length;
    return { key: String(dow), label: f.day(dow), value: n, valueText: count(n) };
  });
  const hours = live.map((r) => r.hour);
  const firstHour = Math.min(...hours, 24);
  const lastHour = Math.max(...hours, -1);
  const hourData: Datum[] = [];
  for (let h = firstHour; h <= lastHour; h++) {
    const n = hours.filter((x) => x === h).length;
    const hh = `${String(h).padStart(2, "0")}:00`;
    hourData.push({ key: hh, label: f.num(h % 12 === 0 ? 12 : h % 12), value: n, valueText: count(n), detail: `${f.time(hh)} – ${f.time(`${String((h + 1) % 24).padStart(2, "0")}:00`)}` });
  }

  return (
    <div className="space-y-6">
      <Header range={range} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label={s.bookings} value={f.num(items.length)} />
        <StatTile label={s.completed} value={f.num(completed)} />
        <StatTile label={s.noShowRate} value={finished ? f.percent((noShow / finished) * 100) : "—"} note={fill(s.noShowNote, { n: f.num(noShow) })} />
        <StatTile label={s.income} value={f.iqd(income)} note={s.incomeNote} />
      </div>

      <section className="card space-y-3">
        <h2 className="font-bold">{range === "30" ? s.perDay : range === "365" ? s.perMonth : s.perWeek}</h2>
        <ColumnChart data={overTime} tick={(n) => f.num(n)} table={table} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="font-bold">{s.byStatus}</h2>
          <BarList data={statusData} table={table} />
        </section>
        <section className="card space-y-3">
          <h2 className="font-bold">{s.topServices}</h2>
          <BarList data={serviceData} table={table} />
        </section>
        <section className="card space-y-3">
          <h2 className="font-bold">{s.byWeekday}</h2>
          <BarList data={weekdayData} table={table} keepOrder />
        </section>
        {hourData.length > 0 && (
          <section className="card space-y-3">
            <h2 className="font-bold">{s.byHour}</h2>
            <ColumnChart data={hourData} tick={(n) => f.num(n)} table={table} />
          </section>
        )}
        {staffData.length > 1 && (
          <section className="card space-y-3">
            <h2 className="font-bold">{s.byStaff}</h2>
            <BarList data={staffData} table={table} />
          </section>
        )}
      </div>
    </div>
  );
}

/** Title and the period picker (it scopes everything below it). */
async function Header({ range }: { range: Range }) {
  const { t, href } = await getI18n();
  const s = t.dashboard.stats;
  return (
    <div className="space-y-3">
      <div>
        <h1 className="page-title">{s.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{s.help}</p>
      </div>
      <nav className="flex flex-wrap gap-2" aria-label={s.period}>
        {(Object.keys(RANGES) as Range[]).map((r) => (
          <Link
            key={r}
            href={href(`/dashboard/stats?range=${r}`)}
            aria-current={r === range ? "page" : undefined}
            className={r === range ? "btn-primary px-3 py-1.5" : "btn-ghost px-3 py-1.5"}
          >
            {s.ranges[r]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
