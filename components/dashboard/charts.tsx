// Small server-rendered charts for the owner stats page. No chart library:
// plain elements, one hue (indigo-600, checked for contrast on the white
// card), thin marks, hairline grid. Every mark has a hover/focus tooltip
// (CSS only), and every chart has a table view, so no value needs the pointer.

export interface Datum {
  key: string;
  /** Short axis/row label. */
  label: string;
  value: number;
  /** Shown as the tooltip's value line, e.g. "١٢ کات". */
  valueText: string;
  /** Tooltip's second line, e.g. the full date. */
  detail?: string;
}

const BAR = "bg-indigo-600";

/** Round a maximum up to 1 / 2 / 5 × 10ⁿ, so the axis reads clean numbers. */
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  const n = max / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function Tooltip({ d, align }: { d: Datum; align: "start" | "center" | "end" }) {
  const pos = align === "start" ? "start-0" : align === "end" ? "end-0" : "left-1/2 -translate-x-1/2";
  return (
    <span
      role="tooltip"
      className={`pointer-events-none invisible absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-xl bg-slate-900 px-2.5 py-1.5 text-start opacity-0 shadow-md transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 ${pos}`}
    >
      <span className="block text-sm font-bold text-white">{d.valueText}</span>
      {d.detail && <span className="block text-xs text-slate-300">{d.detail}</span>}
    </span>
  );
}

/** Columns over time or over an ordered scale (days, weeks, hours). Labels the tallest column only. */
export function ColumnChart({ data, tick, table }: { data: Datum[]; tick: (n: number) => string; table: TableText }) {
  const max = Math.max(0, ...data.map((d) => d.value));
  const top = niceMax(max);
  const every = data.length <= 8 ? 1 : data.length <= 16 ? 2 : Math.ceil(data.length / 7);
  const peak = data.findIndex((d) => d.value === max && max > 0);
  const align = (i: number) => (i < data.length / 3 ? "start" : i >= (data.length * 2) / 3 ? "end" : "center");

  return (
    <div className="space-y-2">
      {/* overflow-x-clip: a tooltip at the edge never widens the page */}
      <div className="relative h-48 overflow-x-clip pt-8">
        {/* Hairline grid at 0, ½ and the top, with clean tick numbers */}
        {[1, 0.5, 0].map((f) => (
          <div key={f} className="absolute inset-x-0 flex translate-y-1/2 items-center gap-2" style={{ bottom: `calc(1.5rem + ${f} * (100% - 3.5rem))` }}>
            <span className="w-7 shrink-0 text-end text-[0.7rem] tabular-nums text-slate-400">{tick(Math.round(top * f))}</span>
            <span className="h-px flex-1 bg-slate-100" />
          </div>
        ))}
        <ul className="absolute inset-x-0 bottom-6 top-8 flex items-end gap-[2px] ps-9">
          {data.map((d, i) => {
            const h = (d.value / top) * 100;
            return (
              <li
                key={d.key}
                tabIndex={0}
                aria-label={`${d.detail ?? d.label}: ${d.valueText}`}
                className="group relative flex h-full min-w-0 flex-1 items-end justify-center rounded-md outline-none focus-visible:bg-indigo-50"
              >
                {i === peak && (
                  <span className="absolute inset-x-0 text-center text-xs font-bold text-slate-700" style={{ bottom: `calc(${h}% + 0.25rem)` }}>
                    {tick(d.value)}
                  </span>
                )}
                {d.value > 0 && (
                  <span className={`block w-full max-w-6 rounded-t-[4px] ${BAR} transition-opacity group-hover:opacity-80`} style={{ height: `${h}%` }} />
                )}
                <Tooltip d={d} align={align(i)} />
              </li>
            );
          })}
        </ul>
        {/* Axis labels: every n-th, so they never collide */}
        <ol className="absolute inset-x-0 bottom-0 flex h-5 gap-[2px] ps-9" aria-hidden>
          {data.map((d, i) => (
            <li key={d.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[0.7rem] text-slate-400">
              {i % every === 0 ? d.label : ""}
            </li>
          ))}
        </ol>
      </div>
      <DataTable data={data} text={table} />
    </div>
  );
}

/** Horizontal bars, one row per item (largest first unless `keepOrder`), name and figure beside each. */
export function BarList({ data, table, keepOrder = false, total }: { data: Datum[]; table: TableText; keepOrder?: boolean; total?: (d: Datum) => string }) {
  const rows = keepOrder ? data : [...data].sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...rows.map((d) => d.value));
  return (
    <div className="space-y-2">
      <ul className="space-y-3">
        {rows.map((d) => (
          <li key={d.key} tabIndex={0} aria-label={`${d.label}: ${d.valueText}`} className="group relative rounded-xl outline-none focus-visible:bg-indigo-50">
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-semibold text-slate-700">{d.label}</span>
              <span className="shrink-0 tabular-nums text-slate-500">{total ? total(d) : d.valueText}</span>
            </div>
            <div className="h-3">
              {d.value > 0 && (
                <div className={`h-full rounded-e-[4px] ${BAR} transition-opacity group-hover:opacity-80`} style={{ width: `${(d.value / max) * 100}%` }} />
              )}
            </div>
          </li>
        ))}
      </ul>
      <DataTable data={rows} text={table} />
    </div>
  );
}

export interface TableText {
  show: string;
  name: string;
  value: string;
}

function DataTable({ data, text }: { data: Datum[]; text: TableText }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer select-none text-xs font-semibold text-indigo-600">{text.show}</summary>
      <table className="mt-2 w-full text-start">
        <thead>
          <tr className="border-b border-slate-100 text-xs text-slate-500">
            <th className="py-1.5 text-start font-medium">{text.name}</th>
            <th className="py-1.5 text-end font-medium">{text.value}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key} className="border-b border-slate-50">
              <td className="py-1.5 text-slate-700">{d.detail ?? d.label}</td>
              <td className="py-1.5 text-end tabular-nums text-slate-700">{d.valueText}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** A headline number: label, value, optional note. */
export function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="card space-y-1">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {note && <p className="text-xs text-slate-400">{note}</p>}
    </div>
  );
}
